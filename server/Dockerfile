# Sürü API serveri. Build konteksti REPO KÖKÜDÜR (ortaq kod mobile/ və supabase/ qovluqlarındadır):
#   docker build -f server/Dockerfile -t suru-api .
# docker-compose.yml bunu özü edir.

FROM node:22-alpine AS build
WORKDIR /repo/server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/ ./
COPY mobile/src/data/mapping.ts /repo/mobile/src/data/mapping.ts
COPY mobile/src/domain/types.ts /repo/mobile/src/domain/types.ts
COPY supabase/functions/mygov-auth/handler.ts /repo/supabase/functions/mygov-auth/handler.ts
RUN npm run typecheck && npm run build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /repo/server/dist ./dist
COPY server/db ./db
RUN mkdir -p /data/photos && chown -R node:node /data
USER node
ENV PORT=8080 STORAGE_DIR=/data/photos
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:8080/health || exit 1
CMD ["node", "--enable-source-maps", "dist/index.js"]
