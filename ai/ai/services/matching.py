import math
from ai.embeddings.provider import EmbeddingProvider
from ai.repositories.embedding_repository import EmbeddingRepository


def cosine_similarity(left: list[float], right: list[float]) -> float:
    if not left or len(left) != len(right) or not all(math.isfinite(x) for x in left + right):
        raise ValueError("Invalid embedding dimensions or values")
    denominator = math.sqrt(sum(x * x for x in left)) * math.sqrt(sum(x * x for x in right))
    if denominator == 0:
        raise ValueError("Embedding must have nonzero norm")
    # Negative similarity is no positive semantic evidence. It is never a probability.
    return max(0.0, min(1.0, sum(a * b for a, b in zip(left, right)) / denominator))


class MatchingService:
    def __init__(self, provider: EmbeddingProvider | None):
        self.provider = provider
        self.repository = EmbeddingRepository(provider)

    def semantic(self, viewer_text: str, candidates: list[tuple[str, str]]) -> dict:
        if self.provider is None:
            raise RuntimeError("Embeddings unavailable")
        by_text = self.repository.encode_batch([viewer_text] + [text for _, text in candidates])
        return {
            "modelVersion": self.provider.version,
            "scores": [{"key": key, "similarity": cosine_similarity(by_text[viewer_text], by_text[text])} for key, text in candidates],
        }
