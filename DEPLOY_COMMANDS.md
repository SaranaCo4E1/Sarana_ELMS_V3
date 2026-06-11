# Deploy Commands

```bash
cd /var/www/html
```

## Status / Logs

```bash
docker compose --env-file .env -f docker/compose.prod.yml ps
docker compose --env-file .env -f docker/compose.prod.yml logs -f app
docker compose --env-file .env -f docker/compose.prod.yml logs -f nginx
docker compose --env-file .env -f docker/compose.prod.yml logs -f queue
```

## Laravel

```bash
docker compose --env-file .env -f docker/compose.prod.yml exec app php artisan migrate
docker compose --env-file .env -f docker/compose.prod.yml exec app php artisan migrate --seed
docker compose --env-file .env -f docker/compose.prod.yml exec app php artisan db:seed --force
docker compose --env-file .env -f docker/compose.prod.yml exec app php artisan migrate:fresh --seed --force
```

## Cache

```bash
docker compose --env-file .env -f docker/compose.prod.yml exec app php artisan optimize:clear
docker compose --env-file .env -f docker/compose.prod.yml exec app php artisan config:cache
docker compose --env-file .env -f docker/compose.prod.yml exec app php artisan route:cache
docker compose --env-file .env -f docker/compose.prod.yml exec app php artisan view:cache
```

## After Editing .env

```bash
docker compose --env-file .env -f docker/compose.prod.yml up -d --force-recreate app queue nginx
```

## Rebuild App / Assets / Composer Deps

```bash
docker compose --env-file .env -f docker/compose.prod.yml up -d --build
```

## Rebuild Specific Services

```bash
docker compose --env-file .env -f docker/compose.prod.yml up -d --build app queue
docker compose --env-file .env -f docker/compose.prod.yml up -d --build nginx app queue
```

## Shell Into Container

```bash
docker compose --env-file .env -f docker/compose.prod.yml exec app sh
```

## Stop / Start

```bash
docker compose --env-file .env -f docker/compose.prod.yml stop
docker compose --env-file .env -f docker/compose.prod.yml start
docker compose --env-file .env -f docker/compose.prod.yml restart
```
