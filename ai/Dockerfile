FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt requirements-embeddings.txt ./
ARG WITH_EMBEDDINGS=false
RUN if [ "$WITH_EMBEDDINGS" = "true" ]; then pip install --no-cache-dir -r requirements-embeddings.txt; else pip install --no-cache-dir -r requirements.txt; fi
COPY api ./api
COPY ai ./ai
RUN useradd --create-home appuser && mkdir -p /home/appuser/.cache/huggingface && chown -R appuser:appuser /home/appuser/.cache
USER appuser
EXPOSE 8000
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
