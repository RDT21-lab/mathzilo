# Mathzilo — una sola imagen: compila la PWA y la sirve junto al servidor de sincronización.
FROM node:24-alpine AS build
WORKDIR /app
COPY app/package.json app/package-lock.json ./
RUN npm ci
COPY app/ ./
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8787 DATA_DIR=/data
COPY --from=build /app/dist ./dist
COPY app/server ./server
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:8787/api/time || exit 1
CMD ["node", "server/sync-server.mjs"]
