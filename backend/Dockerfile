FROM node:20-bookworm-slim AS base
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package*.json ./
RUN npm ci

FROM deps AS build
COPY tsconfig.json drizzle.config.ts ./
COPY src ./src
COPY tests ./tests
COPY migrations ./migrations
RUN npm run build \
  && mkdir -p /app/data

FROM base AS prod-deps
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev \
  && npm cache clean --force

FROM gcr.io/distroless/nodejs20-debian12:nonroot AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --chown=nonroot:nonroot --from=build /app/dist ./dist
COPY --chown=nonroot:nonroot --from=prod-deps /app/node_modules ./node_modules
COPY --chown=nonroot:nonroot --from=build /app/migrations ./migrations
COPY --chown=nonroot:nonroot package.json ./package.json
COPY --chown=nonroot:nonroot --from=build /app/data ./data

EXPOSE 3000
CMD ["dist/src/index.js"]
