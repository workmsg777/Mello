from contextlib import asynccontextmanager
import logging
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.concurrency import run_in_threadpool
from threading import Lock
from api.dependencies import require_service_key
from api.config import Settings
from api.matching import router
from ai.embeddings.provider import EmbeddingProvider, SentenceTransformerProvider
from ai.services.matching import MatchingService
from ai.services.photo_moderation import PhotoModerator, PHOTO_MAX_BYTES

logger = logging.getLogger("mello.matching")


class RequestSizeLimit(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        maximum = PHOTO_MAX_BYTES if request.url.path == "/v1/photo-moderation" else request.app.state.settings.max_request_bytes
        body = bytearray()
        async for chunk in request.stream():
            if len(body) + len(chunk) > maximum:
                return JSONResponse(status_code=413, content={"detail": "Request too large"})
            body.extend(chunk)
        request._body = bytes(body)
        return await call_next(request)


def create_app(settings: Settings | None = None, provider: EmbeddingProvider | None = None, photo_moderator: PhotoModerator | None = None) -> FastAPI:
    configured = settings or Settings.from_environment()

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        configured.validate()
        encoder = provider
        if encoder is None and configured.embeddings_enabled:
            try:
                encoder = SentenceTransformerProvider(configured.model_name, configured.model_revision, configured.local_files_only, configured.model_cache_dir)
            except Exception:
                # Do not log profile text, keys, or model-provider exception payloads.
                logger.error("Embedding model unavailable; semantic requests will return 503")
        application.state.matching = MatchingService(encoder)
        moderator = photo_moderator
        if moderator is None and configured.photo_model_path:
            try:
                moderator = PhotoModerator(configured.photo_model_path)
            except Exception:
                logger.error("Photo moderation model unavailable")
        application.state.photo_moderator = moderator
        application.state.photo_gate = Lock()
        yield
        application.state.matching = MatchingService(None)

    application = FastAPI(title="Mello Matching AI", version="1.0.0", lifespan=lifespan,
                          docs_url=None, redoc_url=None, openapi_url=None)
    application.state.settings = configured
    application.add_middleware(RequestSizeLimit)
    application.include_router(router)

    @application.post("/v1/photo-moderation", dependencies=[Depends(require_service_key)])
    async def assess_photo(request: Request):
        moderator = request.app.state.photo_moderator
        gate = request.app.state.photo_gate
        if moderator is None or not gate.acquire(blocking=False):
            raise HTTPException(status_code=503, detail="Photo moderator unavailable")
        try:
            return await run_in_threadpool(moderator.assess, await request.body())
        except Exception as error:
            raise HTTPException(status_code=503, detail="Photo moderation unavailable") from error
        finally:
            gate.release()

    @application.exception_handler(RequestValidationError)
    async def validation_error(_request: Request, error: RequestValidationError):
        # FastAPI's default validation response echoes input, which may contain profile text.
        return JSONResponse(status_code=422, content={"detail": [{"loc": e["loc"], "type": e["type"]} for e in error.errors()]})

    @application.get("/health")
    def health():
        return {"status": "ok"}

    @application.get("/ready")
    def ready():
        loaded = application.state.matching.provider is not None
        return JSONResponse(status_code=200 if loaded else 503, content={"embeddingsReady": loaded})

    return application


app = create_app()
