from dataclasses import dataclass
import os
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    service_key: str = ""
    embeddings_enabled: bool = False
    model_name: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    model_revision: str | None = "e8f8c211226b894fcb81acc59f3b34ba3efd5f42"
    local_files_only: bool = True
    model_cache_dir: str = str(Path(__file__).resolve().parents[1] / ".cache" / "huggingface" / "hub")
    max_request_bytes: int = 1_200_000
    photo_model_path: str | None = None

    @classmethod
    def from_environment(cls) -> "Settings":
        return cls(
            service_key=os.getenv("MATCHING_AI_KEY", "").strip(),
            embeddings_enabled=os.getenv("AI_EMBEDDINGS_ENABLED", "false").lower() == "true",
            model_name=os.getenv("AI_EMBEDDING_MODEL", cls.model_name),
            model_revision=os.getenv("AI_MODEL_REVISION", cls.model_revision) or None,
            local_files_only=os.getenv("AI_MODEL_LOCAL_ONLY", "true").lower() != "false",
            model_cache_dir=os.getenv("AI_MODEL_CACHE_DIR", cls.model_cache_dir),
            photo_model_path=(
                os.getenv("AI_PHOTO_MODEL_PATH") or str(Path(__file__).resolve().parents[1] / ".cache" / "vision" / "marqo.onnx")
            ) if os.getenv("PHOTO_MODERATION_MODE") in {"shadow", "auto"} else None,
        )

    def validate(self) -> None:
        if len(self.service_key) < 32:
            raise ValueError("MATCHING_AI_KEY must contain at least 32 characters")
