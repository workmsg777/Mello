FROM node:22-bookworm-slim AS backend

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci

COPY backend/tsconfig.json backend/nodemon.json backend/.sequelizerc ./
COPY backend/database ./database
COPY backend/src ./src
COPY backend/scripts ./scripts

RUN npm run build

EXPOSE 4000

CMD ["npm", "start"]

FROM python:3.12-slim-bookworm

WORKDIR /app

COPY --from=backend /usr/local/bin/node /usr/local/bin/
COPY --from=backend /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
    && useradd --create-home --user-group appuser \
    && install -d -o appuser -g appuser /home/appuser/.cache/huggingface \
    && apt-get update \
    && apt-get install -y --no-install-recommends libatomic1 \
    && rm -rf /var/lib/apt/lists/* \
    && node --version

COPY ai/requirements.txt ai/requirements-embeddings.txt ai/requirements-photo-moderation.txt /opt/mello-ai/
ARG WITH_EMBEDDINGS=false
RUN if [ "$(printf '%s' "$WITH_EMBEDDINGS" | tr '[:upper:]' '[:lower:]')" = "true" ]; then \
      pip install --no-cache-dir -r /opt/mello-ai/requirements-embeddings.txt; \
    else \
      pip install --no-cache-dir -r /opt/mello-ai/requirements.txt; \
    fi
ARG PHOTO_MODERATION_MODE=off
RUN if [ "$PHOTO_MODERATION_MODE" != "off" ]; then \
      pip install --no-cache-dir -r /opt/mello-ai/requirements-photo-moderation.txt; \
    fi

COPY ai/api /opt/mello-ai/api
COPY ai/ai /opt/mello-ai/ai
COPY --from=backend /app /app

EXPOSE 4000

CMD ["python", "-u", "scripts/start-stack.py"]
