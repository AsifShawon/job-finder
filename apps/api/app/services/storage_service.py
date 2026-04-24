import hashlib
from pathlib import Path

import boto3
from botocore.client import Config

from app.core.config import get_settings

settings = get_settings()


class ObjectStorage:
    def __init__(self) -> None:
        self.local_root = Path("/workspace/data/raw")
        self.local_root.mkdir(parents=True, exist_ok=True)
        self.client = boto3.client(
            "s3",
            endpoint_url=f"{'https' if settings.minio_secure else 'http'}://{settings.minio_endpoint}",
            aws_access_key_id=settings.minio_access_key,
            aws_secret_access_key=settings.minio_secret_key,
            config=Config(signature_version="s3v4"),
            region_name="us-east-1",
        )

    def ensure_bucket(self) -> None:
        existing = [b["Name"] for b in self.client.list_buckets().get("Buckets", [])]
        if settings.minio_bucket not in existing:
            self.client.create_bucket(Bucket=settings.minio_bucket)

    def put_text(self, source_url: str, payload: str) -> str:
        digest = hashlib.sha1(source_url.encode("utf-8")).hexdigest()
        key = f"snapshots/{digest}.html"
        try:
            self.ensure_bucket()
            self.client.put_object(Bucket=settings.minio_bucket, Key=key, Body=payload.encode("utf-8"))
            return f"s3://{settings.minio_bucket}/{key}"
        except Exception:
            file_path = self.local_root / f"{digest}.html"
            file_path.write_text(payload, encoding="utf-8")
            return str(file_path)
