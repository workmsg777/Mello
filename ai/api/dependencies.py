from secrets import compare_digest
from typing import Annotated
from fastapi import Header, HTTPException, Request
from ai.services.matching import MatchingService


def require_service_key(request: Request, x_service_key: Annotated[str | None, Header()] = None) -> None:
    expected = request.app.state.settings.service_key
    if x_service_key is None or not compare_digest(x_service_key.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="Service authentication required")


def get_matching_service(request: Request) -> MatchingService:
    return request.app.state.matching
