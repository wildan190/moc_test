#!/bin/bash

set -e

php artisan optimize:clear

php artisan config:cache

php artisan route:cache

php artisan view:cache

php artisan migrate --force

# Start Supervisor
supervisord -c /etc/supervisor/supervisord.conf

php-fpm