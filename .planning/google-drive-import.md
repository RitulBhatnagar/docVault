# Google Drive Import — Implementation Plan

## Scope (MVP)
Manual one-shot import. User connects Drive → picks folder → clicks Import → sees progress → files land in vault tagged "from-drive". No polling. No auto-sync. No Google Docs native formats.

---

## New Dependencies

### Backend
```
google-auth>=2.0.0
google-auth-oauthlib>=1.0.0
google-api-python-client>=2.0.0
cryptography>=42.0.0          # Fernet token encryption at rest
```

### Frontend
```
None — standard fetch calls to new endpoints
```

---

## Database Changes

### Table: `driveconnection`
```python
class DriveConnection(SQLModel, table=True):
    id: uuid.UUID                     # PK
    user_id: uuid.UUID                # FK user.id CASCADE DELETE
    access_token: str                 # Fernet-encrypted
    refresh_token: str                # Fernet-encrypted
    token_expiry: datetime            # UTC, for auto-refresh
    connected_at: datetime
```

### Table: `driveimportjob`
```python
class DriveImportJob(SQLModel, table=True):
    id: uuid.UUID                     # PK, returned to frontend as job_id
    user_id: uuid.UUID                # FK user.id CASCADE DELETE
    folder_id: str                    # Drive folder ID
    folder_name: str                  # Display name
    status: str                       # pending | running | completed | failed
    total_files: int = 0
    imported_files: int = 0
    skipped_files: int = 0            # duplicates / unsupported
    failed_files: int = 0
    error_message: str | None = None
    created_at: datetime
    completed_at: datetime | None = None
```

### Alembic migration
Single migration: create both tables + FK constraints.

---

## New Config (env vars)

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost/api/v1/drive/callback
DRIVE_TOKEN_ENCRYPTION_KEY=...    # Fernet key, generate once: Fernet.generate_key()
```

Add to `app/core/config.py` as optional fields (feature disabled if unset).

---

## New Routes: `/api/v1/drive`

File: `backend/app/api/routes/drive.py`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/drive/auth-url` | Return Google OAuth redirect URL |
| `GET` | `/drive/callback` | OAuth callback — exchange code → store tokens |
| `GET` | `/drive/status` | Is current user connected? Returns `{connected: bool}` |
| `DELETE` | `/drive/disconnect` | Revoke token + delete DriveConnection row |
| `GET` | `/drive/folders` | List user's Drive folders (top-level + shared) |
| `POST` | `/drive/import` | Start import job → returns `{job_id: uuid}` |
| `GET` | `/drive/import/{job_id}` | Poll job status |

Register in `app/api/main.py`.

---

## New Service: `app/services/drive.py`

### Token management
```python
def encrypt_token(token: str) -> str          # Fernet encrypt
def decrypt_token(token: str) -> str          # Fernet decrypt
def get_credentials(connection: DriveConnection) -> Credentials
    # Build google.oauth2.credentials.Credentials
    # Auto-refresh if token_expiry < now + 60s
    # Save new access_token back to DB after refresh
```

### Drive API helpers
```python
def list_folders(creds: Credentials) -> list[dict]
    # files().list(q="mimeType='application/vnd.google-apps.folder'")
    # Returns [{id, name}]

def list_importable_files(creds: Credentials, folder_id: str) -> list[dict]
    # files().list(q=f"'{folder_id}' in parents and trashed=false")
    # Filter OUT: mimeType starts with "application/vnd.google-apps."
    # Returns [{id, name, mimeType, size}]

def download_file(creds: Credentials, file_id: str) -> bytes
    # files().get_media(fileId=file_id)
    # MediaIoBaseDownload → return bytes
```

### Import orchestration
```python
def run_import_job(job_id: uuid.UUID, session: Session) -> None
    # 1. Load job + user's DriveConnection
    # 2. job.status = "running"
    # 3. List importable files → set job.total_files
    # 4. For each file:
    #    a. download bytes
    #    b. sha256 → _check_duplicate (skip if dup, increment skipped)
    #    c. filename match → upload_new_version or upload_document (existing logic)
    #    d. add_tag(document, "from-drive")
    #    e. increment imported_files, commit
    # 5. job.status = "completed", job.completed_at = now
    # On any unrecoverable error: job.status = "failed", job.error_message = str(e)
```

---

## Import Flow Detail

### Skipped (not imported)
- `mimeType` starts with `application/vnd.google-apps.` (Docs, Sheets, Slides, Forms, etc.)
- SHA-256 duplicate (file already in vault for this user)

### Tag logic
After document created/versioned:
```python
# Reuse existing add_tag_to_document logic
tag = get_or_create_tag(session, owner_id=user.id, name="from-drive")
link_tag_to_document(session, document_id=doc.id, tag_id=tag.id)
```

### BackgroundTasks
`POST /drive/import` triggers `background_tasks.add_task(run_import_job, job_id, session)`.
Returns `job_id` immediately. Frontend polls `GET /drive/import/{job_id}` every 2s.

---

## Frontend Changes

### New: `DriveConnect.tsx` (settings panel or sidebar section)
- "Connect Google Drive" button → hits `/drive/auth-url` → `window.location.href = url`
- OAuth callback lands on `/drive/callback` → backend stores tokens → redirect to frontend with `?drive=connected`
- If connected: show "Drive Connected ✓" + "Disconnect" button

### New: `DriveImportModal.tsx`
- Triggered from main document list toolbar (new button: "Import from Drive")
- Step 1: Load folders via `GET /drive/folders` → show dropdown
- Step 2: "Start Import" → `POST /drive/import` → get `job_id`
- Step 3: Poll `GET /drive/import/{job_id}` every 2s
  - Show progress bar: `imported_files / total_files`
  - Show counts: imported / skipped / failed
  - On `completed`: success state, close button, link to filter by "from-drive" tag
  - On `failed`: show `error_message`

---

## Security

- OAuth scope: `https://www.googleapis.com/auth/drive.readonly` only
- Tokens encrypted at rest with Fernet (symmetric, key in env var)
- `GET /drive/callback` validates `state` param (CSRF protection — generate random state, store in session or short-lived token)
- All `/drive/*` routes require `CurrentUser` (JWT auth)
- Job access scoped: `WHERE job.user_id = current_user.id`

---

## Out of Scope (this phase)
- Google Docs / Sheets / Slides export
- Auto-sync / polling
- Sub-folder recursion (only top-level folder contents)
- Re-import (same file, changed in Drive) — treated as duplicate, skipped

---

## Build Order

1. Config + env vars
2. Alembic migration (2 new tables)
3. Models (`DriveConnection`, `DriveImportJob` + public schemas)
4. `app/services/drive.py` (token encrypt/decrypt, Drive API helpers)
5. `app/api/routes/drive.py` (all 7 endpoints)
6. Register route in `app/api/main.py`
7. Frontend: `DriveConnect` component
8. Frontend: `DriveImportModal` component
9. Frontend: wire button into document list toolbar