# DocVault

**Secure document storage with guaranteed integrity, full version history, and full-text search.**

Upload a file → system saves it, calculates a SHA-256 fingerprint, stores metadata → if you upload a new version, the old version is kept forever → search documents by keyword using PostgreSQL full-text search → Prometheus tracks API health in real-time.

---

## Features

| Feature | Description |
|---------|-------------|
| **File Upload** | Upload any file with metadata (title, creator, format, subject) |
| **Bulk Upload** | Upload multiple files at once with per-file status tracking |
| **SHA-256 Fingerprint** | Every version gets a cryptographic fingerprint for integrity verification |
| **Version History** | Old versions are never deleted — upload new versions freely |
| **Smart Versioning** | Uploading a file with a matching name auto-adds it as a new version; format mismatches are blocked |
| **Version Download** | Download any specific version, or latest via shortcut endpoint |
| **Full-text Search** | PostgreSQL tsvector search inside PDF/DOCX content, not just metadata |
| **Bulk Delete** | Select multiple documents and delete in one action |
| **Document Preview** | Fullscreen in-browser preview: PDF, images, video (mp4/webm), audio (mp3/wav/flac), text, XLSX/DOCX rendered as HTML |
| **Version Switcher** | Flip between document versions inside the preview dialog |
| **Tags** | Add/remove tags per document, filter document list by tag |
| **Sort & Filter** | Sort by date/title/format/creator; filter by format, date range, tag |
| **Card / Table View** | Toggle between grid card view and table view |
| **Format Icons** | Colored file-type icons (PDF=red, DOCX=blue, XLSX=green, images=purple, video=orange, audio=pink) |
| **Auth** | JWT-based login, registration, and superuser roles |
| **Prometheus Metrics** | Real-time API health and request metrics at `/metrics` |
| **REST API** | Full OpenAPI/Swagger documentation at `/docs` |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.10, FastAPI, SQLModel |
| **Database** | PostgreSQL 18 |
| **Auth** | JWT (PyJWT), bcrypt passwords |
| **Migrations** | Alembic |
| **Frontend** | React 19, TypeScript, TanStack Router, shadcn/ui, Tailwind CSS |
| **API Client** | Auto-generated OpenAPI client (`@hey-api/openapi-ts`) |
| **Metrics** | Prometheus (`prometheus-fastapi-instrumentator`) |
| **Dev Runtime** | Docker Compose, uv (Python), Bun (JS) |

---

## Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [uv](https://docs.astral.sh/uv/getting-started/installation/) (Python package manager)

### 1. Clone and configure

```bash
git clone <your-repo-url>
cd docvault
```

Edit `.env` and set:

```env
POSTGRES_PASSWORD=your_secure_password
SECRET_KEY=your_secret_key_at_least_32_chars
FIRST_SUPERUSER=admin@yourdomain.com
FIRST_SUPERUSER_PASSWORD=your_admin_password
```

### 2. Lock dependencies

```bash
uv lock
```

### 3. Start the stack

```bash
docker compose up --build
```

First run takes ~3 minutes to build images and run migrations.

### 4. Open

| URL | Description |
|-----|-------------|
| http://localhost:5173 | Frontend (DocVault UI) |
| http://localhost:8000/docs | API documentation (Swagger UI) |
| http://localhost:8000/metrics | Prometheus metrics |
| http://localhost:8080 | Adminer (database GUI) |

Login with the superuser credentials from your `.env`.

---

## API Reference

All endpoints require `Authorization: Bearer <token>` header. Get a token at `POST /api/v1/login/access-token`.

### Documents

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/documents/` | Upload document + metadata (multipart/form-data) |
| `GET` | `/api/v1/documents/` | List documents (sort, filter, paginate) |
| `GET` | `/api/v1/documents/search?q=` | Full-text search inside content + metadata |
| `GET` | `/api/v1/documents/check-title?title=` | Check if a document with that title already exists |
| `GET` | `/api/v1/documents/stats` | Storage stats (document count, version count) |
| `GET` | `/api/v1/documents/{id}` | Get document with all versions |
| `DELETE` | `/api/v1/documents/{id}` | Delete document and all versions |
| `GET` | `/api/v1/documents/{id}/download` | Download latest version |
| `GET` | `/api/v1/documents/{id}/preview` | Preview latest version in browser |
| `POST` | `/api/v1/documents/{id}/versions` | Upload new version (blocks format mismatch) |
| `GET` | `/api/v1/documents/{id}/versions` | List all versions |
| `GET` | `/api/v1/documents/{id}/versions/{vid}/download` | Download specific version |
| `GET` | `/api/v1/documents/{id}/versions/{vid}/preview` | Preview specific version |
| `DELETE` | `/api/v1/documents/bulk` | Delete multiple documents by ID array |
| `GET` | `/api/v1/documents/{id}/tags` | List tags on a document |
| `POST` | `/api/v1/documents/{id}/tags` | Add tag to document |
| `DELETE` | `/api/v1/documents/{id}/tags/{tag_id}` | Remove tag from document |
| `GET` | `/api/v1/documents/tags/all` | List all tags created by current user |

### Upload a document

```bash
curl -X POST http://localhost:8000/api/v1/documents/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "title=Project Proposal" \
  -F "creator=Alice" \
  -F "format=pdf" \
  -F "subject=budget planning finance" \
  -F "file=@/path/to/proposal.pdf"
```

### Search documents

```bash
curl "http://localhost:8000/api/v1/documents/search?q=budget" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Project Structure

```
├── backend/
│   └── app/
│       ├── api/routes/
│       │   ├── documents.py    # DocVault endpoints
│       │   ├── users.py
│       │   └── login.py
│       ├── alembic/versions/   # DB migrations
│       ├── core/               # Config, DB, security
│       ├── models.py           # SQLModel table definitions
│       └── main.py             # FastAPI app + Prometheus
├── frontend/
│   └── src/
│       ├── client/             # Auto-generated API client
│       ├── components/Documents/
│       └── routes/_layout/documents.tsx
├── compose.yml
├── compose.override.yml        # Dev overrides
├── ROADMAP.md                  # Feature roadmap
└── README.md
```

---

## How Versioning Works

```
POST /documents/              → creates Document + DocumentVersion v1
POST /documents/{id}/versions → creates DocumentVersion v2 (v1 untouched)
GET  /documents/{id}          → returns doc + [v1, v2, ...]
GET  /documents/{id}/versions/{v1_id}/download → original file, unchanged
```

Each version stores: `sha256`, `original_filename`, `file_size`, `version_number`, `created_at`.

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `POSTGRES_SERVER` | Database host (use `db` in Docker) |
| `POSTGRES_PASSWORD` | Database password |
| `SECRET_KEY` | JWT signing key (min 32 chars) |
| `FIRST_SUPERUSER` | Initial admin email |
| `FIRST_SUPERUSER_PASSWORD` | Initial admin password |
| `ENVIRONMENT` | `local` / `staging` / `production` |
| `SENTRY_DSN` | Sentry DSN (optional) |

---

## Development

Backend hot-reloads on file save. Frontend requires rebuild after changes:

```bash
docker compose build frontend && docker compose up -d frontend
```

Run migrations manually:

```bash
docker compose exec backend alembic upgrade head
```

---

## Changelog

### Latest

- **Bulk delete** — checkbox multi-select on table, delete bar shows count, single `DELETE /bulk` call
- **Smart versioning** — single and bulk upload detect filename matches and route to version endpoint; format mismatches blocked at backend
- **Preview upgrades** — fullscreen 92vw × 90vh dialog, version switcher pills, metadata strip (filename · size · date · SHA-256)
- **Video & audio** — mp4/webm/mov preview via `<video>`; mp3/wav/flac/ogg via `<audio>` with waveform UI
- **UI overhaul** — colored format icons, row hover actions (preview + download without opening menu), card/table view toggle, ID column removed

---

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for planned and completed features.

---

## License

MIT