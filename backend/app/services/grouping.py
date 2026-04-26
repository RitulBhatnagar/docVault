import re

from app.models import Document, DocumentVersion

FORMAT_CATEGORIES: dict[str, set[str]] = {
    "Images":    {"jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "tiff", "heic", "ico"},
    "Videos":    {"mp4", "mov", "avi", "mkv", "webm", "m4v", "flv"},
    "Audio":     {"mp3", "wav", "flac", "ogg", "aac", "m4a", "wma"},
    "Code":      {"py", "js", "ts", "jsx", "tsx", "sh", "rb", "go", "java", "c", "cpp", "rs", "php", "swift"},
    "Notebooks": {"ipynb"},
    "Data":      {"csv", "xlsx", "xls", "parquet", "sqlite", "db"},
    "Archives":  {"zip", "tar", "gz", "bz2", "dmg", "pkg", "iso", "rar", "7z", "deb", "rpm"},
}

DOMAIN_KEYWORDS: list[tuple[set[str], str]] = [
    ({"resume", "cv"},    "Resume"),
    ({"invoice"},         "Invoice"),
    ({"contract"},        "Contract"),
    ({"report"},          "Report"),
    ({"budget"},          "Budget"),
    ({"proposal"},        "Proposal"),
    ({"certificate"},     "Certificate"),
    ({"receipt"},         "Receipt"),
    ({"statement"},       "Statement"),
    ({"letter"},          "Letter"),
    ({"note", "notes"},   "Notes"),
]

STOPWORDS = {
    "my", "the", "a", "an", "new", "old", "temp", "test", "copy",
    "draft", "final", "untitled", "misc", "file", "doc", "document",
}

_EMAIL_RE = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b')
_SPLIT_RE = re.compile(r'[_\-\s]+|(?<=[a-z])(?=[A-Z])')


def _tokens(title: str) -> list[str]:
    return [p.strip() for p in _SPLIT_RE.split(title) if p.strip()]


def derive_cluster_key(
    doc: Document,
    latest_version: DocumentVersion | None,
) -> tuple[str, str, str]:
    """Return (key, label, kind) for a document."""
    ext = doc.format.lower().lstrip(".")

    # Priority 1: format category
    for category, exts in FORMAT_CATEGORIES.items():
        if ext in exts:
            return (f"format:{category}", category, "format")

    # Priority 2: domain keyword in title
    title_lower = doc.title.lower()
    for keywords, label in DOMAIN_KEYWORDS:
        for kw in keywords:
            if kw in title_lower:
                return (f"keyword:{label}", label, "keyword")

    # Priority 3: meaningful title prefix
    for token in _tokens(doc.title):
        if token.lower() not in STOPWORDS and len(token) >= 2:
            label = token.capitalize()
            return (f"prefix:{label}", label, "prefix")

    # Priority 4: first email found in content_text
    if latest_version and latest_version.content_text:
        match = _EMAIL_RE.search(latest_version.content_text)
        if match:
            email = match.group()
            return (f"candidate:{email}", email, "candidate")

    return ("other", "Other", "other")