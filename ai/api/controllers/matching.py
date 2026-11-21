from typing import Annotated
from fastapi import Depends, HTTPException
from api.dependencies import get_matching_service
from api.schemas.matching import SemanticRequest, IcebreakerRequest
from ai.embeddings.provider import ModelBusyError
from ai.services.matching import MatchingService
from ai.services.icebreakers import suggest_icebreakers


def semantic(request: SemanticRequest, service: Annotated[MatchingService, Depends(get_matching_service)]):
    try:
        return service.semantic(request.viewerText, [(str(c.key), c.text) for c in request.candidates])
    except ModelBusyError:
        raise HTTPException(status_code=503, detail="Embedding worker is busy") from None
    except Exception:
        raise HTTPException(status_code=503, detail="Semantic matching temporarily unavailable") from None


def icebreakers(request: IcebreakerRequest):
    return {"suggestions": suggest_icebreakers(request.sharedInterests)}
