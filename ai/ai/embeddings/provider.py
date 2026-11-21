from typing import Protocol
import threading


class EmbeddingProvider(Protocol):
    version: str

    def encode(self, texts: list[str]) -> list[list[float]]: ...


class ModelBusyError(RuntimeError):
    pass


class SentenceTransformerProvider:
    """Load once, batch inference, bounded concurrency, no retained profile text."""

    def __init__(self, model_name: str, revision: str | None, local_files_only: bool, cache_folder: str | None = None):
        from sentence_transformers import SentenceTransformer

        self._model = SentenceTransformer(
            model_name,
            revision=revision,
            local_files_only=local_files_only,
            trust_remote_code=False,
            device="cpu",
            cache_folder=cache_folder,
        )
        self.version = f"{model_name}@{revision or 'local'}"
        self._gate = threading.BoundedSemaphore(1)

    def encode(self, texts: list[str]) -> list[list[float]]:
        if not self._gate.acquire(timeout=0.25):
            raise ModelBusyError("Embedding worker is busy")
        try:
            return self._model.encode(texts, batch_size=16, normalize_embeddings=True, show_progress_bar=False).tolist()
        finally:
            self._gate.release()
