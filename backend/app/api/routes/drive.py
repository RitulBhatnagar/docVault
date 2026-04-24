import secrets
import uuid
from typing import Any
from urllib.parse import urlencode

from fastapi import APIRouter, BackgroundTasks, HTTPException
from sqlmodel import select

from app.api.deps import CurrentUser, SessionDep
from app.core.config import settings
from app.models import (
    DriveConnection,
    DriveConnectionPublic,
    DriveFolderItem,
    DriveImportJob,
    DriveImportJobPublic,
    DriveImportRequest,
    Message,
)
from app.services.drive import (
    build_credentials,
    decrypt_token,
    encrypt_token,
    list_folders,
    run_import_job,
)

router = APIRouter(prefix="/drive", tags=["drive"])

_GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
_GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
_SCOPES = "https://www.googleapis.com/auth/drive.readonly"


def _require_drive_config() -> None:
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=503, detail="Google Drive integration not configured"
        )
    if not settings.DRIVE_TOKEN_ENCRYPTION_KEY:
        raise HTTPException(
            status_code=503, detail="Drive token encryption key not configured"
        )


# ---------- OAuth ----------


@router.get("/auth-url")
def get_auth_url(current_user: CurrentUser) -> dict[str, str]:
    _require_drive_config()
    state = secrets.token_urlsafe(32)
    # Embed user_id in state so callback can identify the user
    state_with_user = f"{state}.{current_user.id}"
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": _SCOPES,
        "access_type": "offline",
        "prompt": "consent",
        "state": state_with_user,
    }
    return {"url": f"{_GOOGLE_AUTH_URL}?{urlencode(params)}"}


@router.get("/callback")
def oauth_callback(
    *,
    session: SessionDep,
    code: str,
    state: str,
    error: str | None = None,
) -> Any:
    _require_drive_config()

    if error:
        raise HTTPException(status_code=400, detail=f"OAuth error: {error}")

    # Extract user_id from state (format: "<random>.<user_id>")
    try:
        user_id = uuid.UUID(state.split(".")[-1])
    except (ValueError, IndexError):
        raise HTTPException(status_code=400, detail="Invalid state parameter")

    # Exchange code for tokens
    import httpx  # noqa: PLC0415

    resp = httpx.post(
        _GOOGLE_TOKEN_URL,
        data={
            "code": code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        },
        timeout=15,
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to exchange OAuth code")

    token_data = resp.json()
    access_token: str = token_data["access_token"]
    refresh_token: str = token_data.get("refresh_token", "")
    expires_in: int = token_data.get("expires_in", 3600)

    from datetime import datetime, timedelta, timezone  # noqa: PLC0415

    expiry = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

    # Upsert DriveConnection
    existing = session.exec(
        select(DriveConnection).where(DriveConnection.user_id == user_id)
    ).first()

    if existing:
        existing.access_token = encrypt_token(access_token)
        existing.refresh_token = (
            encrypt_token(refresh_token) if refresh_token else existing.refresh_token
        )
        existing.token_expiry = expiry
        session.add(existing)
    else:
        conn = DriveConnection(
            user_id=user_id,
            access_token=encrypt_token(access_token),
            refresh_token=encrypt_token(refresh_token),
            token_expiry=expiry,
        )
        session.add(conn)

    session.commit()

    # Redirect to frontend with success flag
    from fastapi.responses import RedirectResponse  # noqa: PLC0415

    return RedirectResponse(url=f"{settings.FRONTEND_HOST}?drive=connected")


# ---------- Status / Disconnect ----------


@router.get("/status", response_model=DriveConnectionPublic)
def get_drive_status(*, session: SessionDep, current_user: CurrentUser) -> Any:
    connection = session.exec(
        select(DriveConnection).where(DriveConnection.user_id == current_user.id)
    ).first()
    if not connection:
        return DriveConnectionPublic(connected=False)
    return DriveConnectionPublic(connected=True, connected_at=connection.connected_at)


@router.delete("/disconnect", response_model=Message)
def disconnect_drive(*, session: SessionDep, current_user: CurrentUser) -> Any:
    connection = session.exec(
        select(DriveConnection).where(DriveConnection.user_id == current_user.id)
    ).first()
    if not connection:
        raise HTTPException(status_code=404, detail="Drive not connected")

    # Best-effort token revoke
    try:
        import httpx  # noqa: PLC0415

        httpx.post(
            "https://oauth2.googleapis.com/revoke",
            params={"token": decrypt_token(connection.access_token)},
            timeout=5,
        )
    except Exception:
        pass

    session.delete(connection)
    session.commit()
    return Message(message="Google Drive disconnected")


# ---------- Folders ----------


@router.get("/folders", response_model=list[DriveFolderItem])
def get_drive_folders(*, session: SessionDep, current_user: CurrentUser) -> Any:
    _require_drive_config()
    connection = session.exec(
        select(DriveConnection).where(DriveConnection.user_id == current_user.id)
    ).first()
    if not connection:
        raise HTTPException(status_code=400, detail="Drive not connected")

    creds = build_credentials(connection)
    folders = list_folders(creds)
    return [DriveFolderItem(id=f["id"], name=f["name"]) for f in folders]


# ---------- Import ----------


@router.post("/import", response_model=DriveImportJobPublic, status_code=202)
def start_import(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    body: DriveImportRequest,
    background_tasks: BackgroundTasks,
) -> Any:
    _require_drive_config()
    connection = session.exec(
        select(DriveConnection).where(DriveConnection.user_id == current_user.id)
    ).first()
    if not connection:
        raise HTTPException(status_code=400, detail="Drive not connected")

    job = DriveImportJob(
        user_id=current_user.id,
        folder_id=body.folder_id,
        folder_name=body.folder_name,
        status="pending",
    )
    session.add(job)
    session.commit()
    session.refresh(job)

    background_tasks.add_task(run_import_job, job.id)
    return job


@router.get("/import/{job_id}", response_model=DriveImportJobPublic)
def get_import_status(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    job_id: uuid.UUID,
) -> Any:
    job = session.exec(
        select(DriveImportJob)
        .where(DriveImportJob.id == job_id)
        .where(DriveImportJob.user_id == current_user.id)
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Import job not found")
    return job
