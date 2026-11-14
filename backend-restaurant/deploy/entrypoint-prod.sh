#!/bin/bash
set -e

echo "=== Starting Production Backend Container ==="

# Wait for PostgreSQL
if [ -n "$DB_HOST" ]; then
    echo "Waiting for PostgreSQL at $DB_HOST:${DB_PORT:-5432}..."
    while ! nc -z "$DB_HOST" "${DB_PORT:-5432}"; do
        sleep 1
    done
    echo "PostgreSQL is reachable!"
fi

# Wait for Redis
if [ -n "$REDIS_HOST" ]; then
    echo "Waiting for Redis at $REDIS_HOST:${REDIS_PORT:-6379}..."
    while ! nc -z "$REDIS_HOST" "${REDIS_PORT:-6379}"; do
        sleep 1
    done
    echo "Redis is reachable!"
fi

# Ensure storage link exists
if [ ! -L /var/www/public/storage ]; then
    php artisan storage:link || true
fi

# Cache configurations for maximum production performance
echo "Caching configuration, routes, and views..."
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Execute primary command (default php-fpm)
echo "Starting PHP-FPM..."
exec php-fpm -F
