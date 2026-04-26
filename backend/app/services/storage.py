"""Storage service — Cloudflare R2 (S3-compatible) with local disk fallback."""

import logging
from pathlib import Path

logger = logging.getLogger(__name__)

_R2_PREFIX = "r2:"


def is_r2_key(file_path: str) -> bool:
    return file_path.startswith(_R2_PREFIX)


def to_r2_key(file_path: str) -> str:
    return file_path[len(_R2_PREFIX):]


def make_r2_path(key: str) -> str:
    return f"{_R2_PREFIX}{key}"


def _client() -> "Any":  # type: ignore[name-defined]
    import boto3  # noqa: PLC0415
    from app.core.config import settings  # noqa: PLC0415
    return boto3.client(
        "s3",
        endpoint_url=settings.R2_ENDPOINT_URL,
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name="auto",
    )


def upload_bytes(key: str, data: bytes, content_type: str = "application/octet-stream") -> None:
    from app.core.config import settings  # noqa: PLC0415
    _client().put_object(
        Bucket=settings.R2_BUCKET_NAME,
        Key=key,
        Body=data,
        ContentType=content_type,
    )


def download_bytes(key: str) -> bytes:
    from app.core.config import settings  # noqa: PLC0415
    resp = _client().get_object(Bucket=settings.R2_BUCKET_NAME, Key=key)
    return resp["Body"].read()


def delete_object(key: str) -> None:
    from app.core.config import settings  # noqa: PLC0415
    try:
        _client().delete_object(Bucket=settings.R2_BUCKET_NAME, Key=key)
    except Exception:
        logger.exception("R2 delete failed for key %s", key)


def get_file_bytes(file_path: str) -> bytes:
    """Read file from R2 or local disk based on path prefix."""
    if is_r2_key(file_path):
        return download_bytes(to_r2_key(file_path))
    return Path(file_path).read_bytes()


def delete_file(file_path: str) -> None:
    """Delete file from R2 or local disk."""
    if is_r2_key(file_path):
        delete_object(to_r2_key(file_path))
    else:
        try:
            Path(file_path).unlink(missing_ok=True)
        except Exception:
            logger.exception("Local delete failed for %s", file_path)
