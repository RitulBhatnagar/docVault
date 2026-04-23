import hashlib
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Document,
    DocumentPublic,
    DocumentVersion,
    DocumentVersionPublic,
    DocumentWithVersions,
    DocumentsPublic,
    Message,
)

router = APIRouter(prefix="/documents", tags=["documents"])

UPLOAD_DIR = Path("/app/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/", response_model=DocumentPublic)
async def upload_document(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    title: str = Form(...),
    creator: str = Form(...),
    format: str = Form(...),
    subject: str | None = Form(default=None),
    file: UploadFile,
) -> Any:
    content = await file.read()
    sha256 = hashlib.sha256(content).hexdigest()

    doc = Document(
        title=title,
        creator=creator,
        format=format,
        subject=subject,
        owner_id=current_user.id,
    )
    session.add(doc)
    session.flush()

    file_path = UPLOAD_DIR / f"{doc.id}_v1_{file.filename}"
    file_path.write_bytes(content)

    version = DocumentVersion(
        document_id=doc.id,
        version_number=1,
        sha256=sha256,
        file_path=str(file_path),
        original_filename=file.filename or "unknown",
        file_size=len(content),
    )
    session.add(version)
    session.commit()
    session.refresh(doc)
    return doc


@router.get("/search", response_model=DocumentsPublic)
def search_documents(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    q: str,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    search_col = func.concat(
        func.coalesce(Document.title, ""),
        " ",
        func.coalesce(Document.creator, ""),
        " ",
        func.coalesce(Document.subject, ""),
    )
    search_vector = func.to_tsvector("english", search_col)
    search_query = func.plainto_tsquery("english", q)
    ts_match = search_vector.op("@@")(search_query)

    count_stmt = (
        select(func.count())
        .select_from(Document)
        .where(Document.owner_id == current_user.id)
        .where(ts_match)
    )
    count = session.exec(count_stmt).one()

    stmt = (
        select(Document)
        .where(Document.owner_id == current_user.id)
        .where(ts_match)
        .offset(skip)
        .limit(limit)
    )
    docs = session.exec(stmt).all()
    return DocumentsPublic(data=list(docs), count=count)


@router.get("/", response_model=DocumentsPublic)
def list_documents(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    if current_user.is_superuser:
        count = session.exec(select(func.count()).select_from(Document)).one()
        docs = session.exec(select(Document).offset(skip).limit(limit)).all()
    else:
        count = session.exec(
            select(func.count())
            .select_from(Document)
            .where(Document.owner_id == current_user.id)
        ).one()
        docs = session.exec(
            select(Document)
            .where(Document.owner_id == current_user.id)
            .offset(skip)
            .limit(limit)
        ).all()
    return DocumentsPublic(data=list(docs), count=count)


@router.get("/{id}", response_model=DocumentWithVersions)
def get_document(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
) -> Any:
    doc = session.get(Document, id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not current_user.is_superuser and doc.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    versions = session.exec(
        select(DocumentVersion)
        .where(DocumentVersion.document_id == id)
        .order_by(DocumentVersion.version_number)
    ).all()
    return DocumentWithVersions(
        **doc.model_dump(),
        versions=[DocumentVersionPublic.model_validate(v) for v in versions],
    )


@router.post("/{id}/versions", response_model=DocumentVersionPublic)
async def upload_new_version(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    file: UploadFile,
) -> Any:
    doc = session.get(Document, id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not current_user.is_superuser and doc.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    content = await file.read()
    sha256 = hashlib.sha256(content).hexdigest()

    max_version = session.exec(
        select(func.max(DocumentVersion.version_number)).where(
            DocumentVersion.document_id == id
        )
    ).one()
    next_version = (max_version or 0) + 1

    file_path = UPLOAD_DIR / f"{id}_v{next_version}_{file.filename}"
    file_path.write_bytes(content)

    version = DocumentVersion(
        document_id=id,
        version_number=next_version,
        sha256=sha256,
        file_path=str(file_path),
        original_filename=file.filename or "unknown",
        file_size=len(content),
    )
    session.add(version)
    session.commit()
    session.refresh(version)
    return version


@router.get("/{id}/versions", response_model=list[DocumentVersionPublic])
def list_versions(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
) -> Any:
    doc = session.get(Document, id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not current_user.is_superuser and doc.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return session.exec(
        select(DocumentVersion)
        .where(DocumentVersion.document_id == id)
        .order_by(DocumentVersion.version_number)
    ).all()


@router.get("/{id}/versions/{version_id}/download")
def download_version(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    version_id: uuid.UUID,
) -> Any:
    doc = session.get(Document, id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not current_user.is_superuser and doc.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    version = session.get(DocumentVersion, version_id)
    if not version or version.document_id != id:
        raise HTTPException(status_code=404, detail="Version not found")

    file_path = Path(version.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        path=str(file_path),
        filename=version.original_filename,
        media_type="application/octet-stream",
    )


@router.delete("/{id}", response_model=Message)
def delete_document(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
) -> Any:
    doc = session.get(Document, id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not current_user.is_superuser and doc.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    session.delete(doc)
    session.commit()
    return Message(message="Document deleted successfully")