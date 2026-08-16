FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src
# No build args: the bundle is environment-agnostic. Which backend it talks to
# is decided at container start, in /config.js — so this image is built once and
# runs anywhere.
RUN npm run build

FROM nginx:1.27-alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.sh /docker-entrypoint.d/40-messenger-config.sh
RUN chmod +x /docker-entrypoint.d/40-messenger-config.sh
EXPOSE 80
