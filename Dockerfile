
# Stage 1: Install PHP dependencies
FROM php:8.3-cli-bookworm AS php-build

RUN apt-get update && apt-get install -y \
    git unzip \
    libicu-dev \
    libzip-dev \
    libpng-dev \
    libjpeg62-turbo-dev \
    libfreetype6-dev \
    libonig-dev \
    libxml2-dev \
    libcurl4-openssl-dev \
    $PHPIZE_DEPS \
    && rm -rf /var/lib/apt/lists/*

RUN docker-php-ext-configure gd \
    --with-freetype \
    --with-jpeg

RUN docker-php-ext-install -j"$(nproc)" \
    bcmath curl gd intl mbstring \
    pdo_mysql pcntl zip 

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

COPY composer.json composer.lock ./

RUN composer install \
    --no-dev \
    --no-interaction \
    --prefer-dist \
    --optimize-autoloader \
    --no-scripts

COPY . .

RUN composer dump-autoload --no-dev --optimize --no-scripts

RUN php artisan package:discover --ansi


# Stage 2: Build React / Vite Plus assets
FROM php-build AS frontend-build

COPY --from=node:22-bookworm-slim /usr/local/ /usr/local/

RUN node --version && npm --version

RUN npm ci

RUN npm run build


# Stage 3: Production PHP + NGINX
FROM php:8.3-fpm-bookworm AS production

RUN apt-get update && apt-get install -y \
    nginx bash \
    libicu72 libzip4 libpng16-16 \
    libjpeg62-turbo libfreetype6 \
    libonig5 libcurl4 libxml2 libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

RUN apt-get update && apt-get install -y \
    $PHPIZE_DEPS \
    libicu-dev libzip-dev libpng-dev \
    libjpeg62-turbo-dev libfreetype6-dev \
    libonig-dev libxml2-dev libcurl4-openssl-dev \
    && docker-php-ext-configure gd \
        --with-freetype \
        --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" \
        bcmath curl gd intl mbstring \
        pdo_mysql pcntl zip \
    && apt-get purge -y --auto-remove \
        $PHPIZE_DEPS \
        libicu-dev libzip-dev libpng-dev \
        libjpeg62-turbo-dev libfreetype6-dev \
        libonig-dev libxml2-dev libcurl4-openssl-dev \
    && rm -rf /var/lib/apt/lists/*

RUN rm -f /etc/nginx/sites-enabled/default

WORKDIR /var/www/html

COPY --from=php-build /var/www/html /var/www/html

COPY --from=frontend-build /var/www/html/public/build /var/www/html/public/build

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/start.sh /start.sh

RUN chmod +x /start.sh \
    && mkdir -p /run/nginx \
    && mkdir -p storage/framework/cache \
    && mkdir -p storage/framework/sessions \
    && mkdir -p storage/framework/views \
    && mkdir -p storage/logs \
    && mkdir -p bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache

ENV APP_ENV=production
ENV APP_DEBUG=false

EXPOSE 10000

CMD ["/start.sh"]
