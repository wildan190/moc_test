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

# Ensure storage permissions and directories exist in mounted volume
mkdir -p /var/www/storage/logs /var/www/storage/framework/cache/data /var/www/storage/framework/sessions /var/www/storage/framework/views
chown -R www-data:www-data /var/www/storage /var/www/bootstrap/cache || true
chmod -R 775 /var/www/storage /var/www/bootstrap/cache || true

# Ensure storage link exists
if [ ! -L /var/www/public/storage ]; then
    php artisan storage:link || true
fi

# Run database migrations
echo "Running database migrations..."
php artisan migrate --force || true

# Cache configurations for maximum production performance
echo "Caching configuration, routes, and views..."
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Execute primary command (default php-fpm)
echo "Starting PHP-FPM..."
exec php-fpm -F
