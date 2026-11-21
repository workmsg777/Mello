from fastapi import APIRouter, Depends
from api.dependencies import require_service_key
from api.controllers.matching import semantic, icebreakers
from api.schemas.matching import SemanticResponse, IcebreakerResponse

router = APIRouter(prefix="/v1", dependencies=[Depends(require_service_key)])
router.add_api_route("/matching/semantic", semantic, methods=["POST"], response_model=SemanticResponse)
router.add_api_route("/assist/icebreakers", icebreakers, methods=["POST"], response_model=IcebreakerResponse)
