# OCR (Tesseract) — Implementation Plan

## How OCR Works

### The Pipeline: Scanned PDF → Text

```
Scanned PDF (image bytes)
        │
        ▼
  pdf2image (poppler)          ← converts each PDF page to a PIL Image
        │                         at ~300 DPI (higher = better accuracy, slower)
        ▼
  Preprocessing (optional)     ← grayscale, denoise, deskew
        │                         improves Tesseract accuracy on bad scans
        ▼
  Tesseract OCR engine         ← neural net (LSTM) trained on millions of docs
        │                         reads image pixels → recognizes character shapes
        ▼
  Raw text per page            ← joined across all pages
        │
        ▼
  stored in content_text       ← same field used by full-text search
```

### Why pypdf fails on scanned PDFs

A text-layer PDF embeds actual Unicode characters in the file structure.
pypdf reads those characters directly — no vision needed.

A scanned PDF is just images wrapped in a PDF container.
There are no characters — only pixels. pypdf extracts nothing.
Tesseract reads pixels and infers what characters they represent.

### Tesseract internals (simplified)

1. **Binarization** — convert to black/white. Gray pixels become decision: ink or paper.
2. **Layout analysis** — find text blocks, columns, paragraphs, lines.
3. **Line segmentation** — split lines into individual character blobs.
4. **LSTM recognition** — sequence model reads left-to-right across each line,
   predicts the most likely character sequence (not char-by-char, full context).
4. **Confidence scoring** — each word gets a confidence %. Low confidence = bad scan.

### DPI matters

| DPI | Quality | Speed | RAM per page |
|-----|---------|-------|--------------|
| 150 | Poor    | Fast  | ~10 MB       |
| 200 | OK      | OK    | ~18 MB       |
| 300 | Good    | Slow  | ~40 MB       |
| 400 | Best    | Very slow | ~70 MB  |

Use 200 DPI for backfill (speed), 300 DPI for new uploads (quality).

### What pdf2image does

Calls `pdftoppm` (part of poppler) under the hood.
`pdftoppm` renders each PDF page as a raster image at the specified DPI.
Output: list of PIL Image objects, one per page.

---

## Detection: Is This a Scanned PDF?

```python
def needs_ocr(content_text: str | None, filename: str) -> bool:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext != "pdf":
        return False
    if not content_text or len(content_text.strip()) < 50:
        return True   # pypdf got nothing — likely scanned
    return False
```

Threshold 50 chars: avoids false positives on PDFs with tiny text headers
but otherwise empty. Tune if needed.

---

## Stack Changes

### System deps (Dockerfile)
```dockerfile
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*
```

- `tesseract-ocr` — the OCR binary + default English LSTM model
- `poppler-utils` — provides `pdftoppm` used by pdf2image
- Optional: `tesseract-ocr-[lang]` packages for other languages (e.g. `tesseract-ocr-hin` for Hindi)

### Python deps (pyproject.toml)
```
pytesseract>=0.3.10    # Python wrapper around tesseract binary
pdf2image>=1.17.0      # PDF pages → PIL images via poppler
Pillow>=10.0.0         # PIL — image manipulation (likely already transitive)
```

---

## Model Changes

### `DocumentVersion` — add `ocr_status`
```python
ocr_status: str | None = Field(default=None)
# None     = not applicable (non-PDF or text PDF)
# "pending"    = scanned PDF detected, OCR not yet run
# "processing" = OCR in progress
# "done"       = OCR completed, content_text populated
# "failed"     = OCR attempted, tesseract error
```

### `DocumentVersionPublic` — expose field
```python
ocr_status: str | None = None
```

### Alembic migration
```python
# revision: f1a2b3c4d5e6_add_ocr_status_to_documentversion
def upgrade():
    op.add_column(
        'documentversion',
        sa.Column('ocr_status', sa.String(length=20), nullable=True),
    )

def downgrade():
    op.drop_column('documentversion', 'ocr_status')
```

---

## New File: `services/ocr.py`

```python
"""OCR service — PDF page images → text via Tesseract."""

import uuid
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

MAX_OCR_PAGES = 50        # cap pages to avoid runaway jobs
OCR_DPI_NEW   = 300       # new uploads — quality
OCR_DPI_BULK  = 200       # backfill — speed


def needs_ocr(content_text: str | None, filename: str) -> bool:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext != "pdf":
        return False
    return not content_text or len(content_text.strip()) < 50


def run_ocr_for_version(version_id: uuid.UUID, db_url: str, dpi: int = OCR_DPI_NEW) -> None:
    """Run OCR on a DocumentVersion. Opens its own DB session (background-safe)."""
    from sqlmodel import Session, create_engine, select
    from app.models import DocumentVersion

    engine = create_engine(db_url)
    with Session(engine) as session:
        version = session.exec(
            select(DocumentVersion).where(DocumentVersion.id == version_id)
        ).first()
        if not version:
            return

        version.ocr_status = "processing"
        session.add(version)
        session.commit()

        try:
            text = _ocr_pdf(version.file_path, dpi)
            version.content_text = text
            version.ocr_status = "done" if text else "failed"
        except Exception:
            logger.exception("OCR failed for version %s", version_id)
            version.ocr_status = "failed"

        session.add(version)
        session.commit()
    engine.dispose()


def _ocr_pdf(file_path: str, dpi: int) -> str | None:
    import pytesseract
    from pdf2image import convert_from_path

    path = Path(file_path)
    if not path.exists():
        return None

    images = convert_from_path(str(path), dpi=dpi, last_page=MAX_OCR_PAGES)
    pages_text: list[str] = []
    for img in images:
        text = pytesseract.image_to_string(img, lang="eng")
        if text.strip():
            pages_text.append(text.strip())

    return " ".join(pages_text) if pages_text else None
```

**Key design: own DB session.**
BackgroundTask runs after the HTTP response is sent — the request's DB session
is already closed. Must open a fresh engine+session using the DB URL string.

---

## Upload Flow Changes (`documents.py`)

### Upload endpoint signature
```python
@router.post("/", response_model=DocumentPublic)
async def upload_document(
    *,
    background_tasks: BackgroundTasks,   # ← add this
    session: SessionDep,
    current_user: CurrentUser,
    ...
):
```

### After creating DocumentVersion
```python
ocr_needed = needs_ocr(content_text, file.filename or "")
version = DocumentVersion(
    ...
    content_text=content_text,
    ocr_status="pending" if ocr_needed else None,
)
session.add(version)
session.commit()

if ocr_needed:
    background_tasks.add_task(
        run_ocr_for_version,
        version.id,
        str(settings.SQLALCHEMY_DATABASE_URI),
    )
```

Same change for `upload_new_version` endpoint.

---

## Backfill Endpoints (superuser only)

### `POST /api/v1/documents/ocr/backfill`
- Queries all `DocumentVersion` where `ocr_status IS NULL` AND `original_filename` ends with `.pdf`
- Sets `ocr_status = "pending"` for all matched
- Spawns single BackgroundTask: processes sequentially (one at a time, 200 DPI)
- Returns `{"queued": N}`

### `GET /api/v1/documents/ocr/backfill/status`
- Returns:
```json
{
  "total_pdf_versions": 142,
  "pending": 98,
  "processing": 1,
  "done": 40,
  "failed": 3
}
```

Sequential processing is mandatory — pdf2image loads full page images into RAM.
Parallel = OOM risk on 3.5 GB dataset.

---

## Frontend Changes (light touch)

On document card / list row — show OCR status badge when relevant:

| `ocr_status` | Badge |
|--------------|-------|
| `"pending"`  | "OCR queued" (gray) |
| `"processing"` | "OCR running..." (blue, pulsing) |
| `"done"`     | nothing — content_text now searchable |
| `"failed"`   | "OCR failed" (red) |

Poll: `GET /documents/{id}` every 5s while status is pending/processing.
Stop polling when done or failed.

---

## Execution Order

| # | Task | File(s) touched |
|---|------|----------------|
| 1 | Dockerfile — add tesseract + poppler | `backend/Dockerfile` |
| 2 | Python deps | `backend/pyproject.toml` |
| 3 | Model: add `ocr_status` | `backend/app/models.py` |
| 4 | Alembic migration | `backend/app/alembic/versions/` |
| 5 | Create `services/ocr.py` | new file |
| 6 | Hook OCR into upload endpoints | `backend/app/api/routes/documents.py` |
| 7 | Backfill endpoints | `backend/app/api/routes/documents.py` |
| 8 | Frontend: OCR badge | `frontend/src/routes/_layout/documents.tsx` |

---

## Out of Scope (this phase)
- Multi-language OCR (add lang packages + `lang` param later)
- Image preprocessing / deskewing (improves bad scans, add later)
- Confidence score storage
- Re-OCR on version update
- Celery/Redis queue (swap in if BackgroundTasks proves unreliable)
