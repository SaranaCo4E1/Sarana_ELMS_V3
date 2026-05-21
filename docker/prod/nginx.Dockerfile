FROM node:22-alpine AS assets

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY resources ./resources
COPY public ./public
COPY tsconfig.json vite.config.js ./
RUN npm run build

FROM nginx:1.27-alpine

WORKDIR /var/www/html

COPY docker/prod/nginx.conf /etc/nginx/conf.d/default.conf
COPY public ./public
COPY --from=assets /app/public/build ./public/build

EXPOSE 80
