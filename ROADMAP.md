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

---

## High Value — Build Next 🔥

- [ ] **Content search** — extract text from PDF/DOCX on upload, index it in PostgreSQL tsvector so you can search inside documents, not just metadata
- [ ] **Document preview** — render PDF/image inline in browser (no download needed to view)
- [ ] **Duplicate detection** — block upload if SHA-256 already exists for that user; show which document is the duplicate
- [ ] **Tags** — add multiple tags to documents, filter list by tag, search by tag

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
- [ ] **Bulk upload** — upload multiple files in one request, zip extraction
- [ ] **OCR** — extract text from scanned image PDFs using Tesseract

---

## Notes

- Each feature is independent — can be shipped in any order
- Content search + async processing are naturally paired (do both together)
- S3 storage should come before scaling to multiple backend instances