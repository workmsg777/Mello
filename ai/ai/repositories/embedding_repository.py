from ai.embeddings.provider import EmbeddingProvider


class EmbeddingRepository:
    def __init__(self, provider: EmbeddingProvider | None):
        self.provider = provider

    def encode_batch(self, texts: list[str]) -> dict[str, list[float]]:
        if self.provider is None:
            raise RuntimeError("Embeddings unavailable")
        # Request-local reuse only; no cross-user/profile-text cache to invalidate.
        unique = list(dict.fromkeys(texts))
        vectors = self.provider.encode(unique)
        if len(vectors) != len(unique):
            raise ValueError("Embedding provider returned an invalid batch")
        return dict(zip(unique, vectors))
