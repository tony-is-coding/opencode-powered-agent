FROM oven/bun:1 AS backend-deps
WORKDIR /app
COPY backend/package.json backend/bun.lock ./
COPY backend/util/package.json ./util/
COPY backend/plugin/package.json ./plugin/
COPY backend/sdk/js/package.json ./sdk/js/
COPY backend/script/package.json ./script/
RUN bun install --frozen-lockfile

FROM oven/bun:1 AS backend
WORKDIR /app
COPY --from=backend-deps /app/node_modules ./node_modules
COPY backend/ .
ENV NODE_ENV=production
EXPOSE 4096
CMD ["bun", "run", "./src/index.ts"]

FROM node:20-alpine AS web-build
WORKDIR /app
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ .
RUN npm run build

FROM nginx:alpine AS web
COPY --from=web-build /app/dist /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
