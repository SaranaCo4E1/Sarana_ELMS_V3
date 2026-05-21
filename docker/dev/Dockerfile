FROM php:8.4-cli

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git \
        libpq-dev \
        unzip \
    && docker-php-ext-install pdo_pgsql pgsql \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

COPY docker/entrypoints/dev.sh /usr/local/bin/elms-dev
RUN chmod +x /usr/local/bin/elms-dev

EXPOSE 8000

ENTRYPOINT ["elms-dev"]
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]
