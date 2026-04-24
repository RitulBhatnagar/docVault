# DocVault — Feature Roadmap

## Shipped ✅

- [x] File upload with metadata (title, creator, format, subject)
- [x] SHA-256 integrity fingerprint on every upload
- [x] Full version history — old versions never deleted
- [x] Download any specific version
- [x] PostgreSQL full-text search on metadata
- [x] JWT authentication (login, register, superuser)
- [x] Prometheus metrics at `/metrics`
- [x] DocVault branded UI (sidebar, login, dashboard)
- [x] Docker Compose dev environment
- [x] Sort + filter documents (by date, title, format, creator, tag, date range)
- [x] Tags — add/remove tags per document, filter list by tag
- [x] Document preview — PDF/image/text render inline in browser; unsupported formats show graceful fallback
- [x] **Bulk delete** — checkbox selection on table rows, delete bar with count, single API call to `DELETE /documents/bulk`
- [x] **Smart versioning** — filename match check on upload (single + bulk); auto-route to new version; block format mismatches; pre-upload summary for bulk
- [x] **Preview upgrades** — fullscreen dialog (92vw × 90vh), version switcher (v1/v2/v3 pills + prev/next), metadata strip (filename, size, date, SHA-256)
- [x] **UI overhaul** — colored format icons (PDF=red, DOCX=blue, XLSX=green, images=purple, video=orange, audio=pink); row hover actions (preview + download inline); card view toggle (table ↔ grid); ID column removed
- [x] **Video & audio preview** — mp4/webm/mov render in `<video>` player; mp3/wav/flac/ogg render in `<audio>` player with waveform UI
- [x] **Download shortcut** — `GET /documents/{id}/download` fetches latest version without knowing version ID

---

## High Value — Build Next 🔥

- [x] **Content search** — extract text from PDF/DOCX on upload, index it in PostgreSQL tsvector so you can search inside documents, not just metadata
- [x] **Duplicate detection** — block upload if SHA-256 already exists for that user; show which document is the duplicate
- [x] **Smart versioning** — if uploaded filename matches an existing document, auto-add as new version instead of creating a new document; block format mismatches on new versions (e.g. uploading PNG into an XLSX document)

---

## Medium Value 📦

- [ ] **Audit log** — record every view/download/upload/delete with timestamp + user ID; exportable as CSV
- [ ] **Document sharing** — generate a time-limited read-only share link for any document version
- [ ] **S3 / MinIO storage** — replace local disk storage with object storage; survives container restarts and scales horizontally
- [ ] **Document expiry / archiving** — set an expiry date; archived docs hidden from default list but still accessible

---

## Advanced 🚀

- [ ] **Semantic search** — use `pgvector` + embeddings (Claude / OpenAI) to search by meaning, not just keyword match
- [ ] **Async processing** — Celery or ARQ task queue; text extraction and indexing happen in background after upload returns
- [ ] **Virus scanning** — ClamAV scan every file before saving; reject infected uploads
- [ ] **Storage quotas** — per-user upload limit (total MB); superuser can configure per user
- [x] **Bulk upload** — upload multiple files in one request, zip extraction
- [ ] **OCR** — extract text from scanned image PDFs using Tesseract

---

## Notes

- Each feature is independent — can be shipped in any order
- Content search + async processing are naturally paired (do both together)
- S3 storage should come before scaling to multiple backend instances