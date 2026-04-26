"""OCR service — converts scanned PDF pages to text via Tesseract."""

import logging
import uuid
from pathlib import Path

logger = logging.getLogger(__name__)

MAX_OCR_PAGES = 50
OCR_DPI_NEW = 300
OCR_DPI_BULK = 200


def needs_ocr(content_text: str | None, filename: str) -> bool:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext != "pdf":
        return False
    return not content_text or len(content_text.strip()) < 50


def run_ocr_for_version(version_id: uuid.UUID, db_url: str, dpi: int = OCR_DPI_NEW) -> None:
    """Run OCR on a DocumentVersion. Opens its own DB session — safe for BackgroundTasks."""
    from sqlmodel import Session, create_engine, select

    from app.models import DocumentVersion

    engine = create_engine(db_url)
    try:
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
    finally:
        engine.dispose()


def run_ocr_backfill(db_url: str) -> None:
    """Process all pending OCR versions sequentially. Designed for BackgroundTasks."""
    from sqlmodel import Session, create_engine, select

    from app.models import DocumentVersion

    engine = create_engine(db_url)
    try:
        with Session(engine) as session:
            pending = session.exec(
                select(DocumentVersion).where(DocumentVersion.ocr_status == "pending")
            ).all()

        for version in pending:
            run_ocr_for_version(version.id, db_url, dpi=OCR_DPI_BULK)
    finally:
        engine.dispose()


def _ocr_pdf(file_path: str, dpi: int) -> str | None:
    import tempfile
    import pytesseract
    from pdf2image import convert_from_path
    from app.services.storage import is_r2_key, get_file_bytes  # noqa: PLC0415

    if is_r2_key(file_path):
        data = get_file_bytes(file_path)
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(data)
            tmp_path = tmp.name
        path = Path(tmp_path)
        cleanup = True
    else:
        path = Path(file_path)
        cleanup = False

    if not path.exists():
        return None

    try:
        images = convert_from_path(str(path), dpi=dpi, last_page=MAX_OCR_PAGES)
        pages_text: list[str] = []
        for img in images:
            text = pytesseract.image_to_string(img, lang="eng")
            if text.strip():
                pages_text.append(text.strip())
        return " ".join(pages_text) if pages_text else None
    finally:
        if cleanup:
            path.unlink(missing_ok=True)
