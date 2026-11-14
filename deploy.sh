#!/bin/bash
# ==============================================================================
# Production Deployment Script for Restaurant System
# Uses pre-built images from GitHub Actions to prevent server CPU/RAM overload
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/deploy/docker-compose.production.yml"
ENV_FILE="$SCRIPT_DIR/deploy/.env.production"

# Styling output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}==============================================================================${NC}"
echo -e "${BLUE}     🚀 RESTAURANT SYSTEM - ZERO-OVERHEAD PRODUCTION DEPLOYMENT              ${NC}"
echo -e "${BLUE}==============================================================================${NC}"

# 1. Environment Verification
if [ ! -f "$ENV_FILE" ]; then
    if [ -f "$SCRIPT_DIR/deploy/.env.production.example" ]; then
        echo -e "${YELLOW}[!] .env.production not found. Creating from example...${NC}"
        cp "$SCRIPT_DIR/deploy/.env.production.example" "$ENV_FILE"
        echo -e "${YELLOW}[!] Created $ENV_FILE. Please update passwords & APP_KEY if necessary.${NC}"
    else
        echo -e "${RED}[ERROR] Neither .env.production nor .env.production.example found in deploy/${NC}"
        exit 1
    fi
fi

# Load environment variables
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# 2. Check Docker & Compose Command
if command -v docker &>/dev/null && docker compose version &>/dev/null; then
    DOCKER_COMPOSE="docker compose"
elif command -v docker-compose &>/dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    echo -e "${RED}[ERROR] Neither 'docker compose' nor 'docker-compose' found! Please install Docker.${NC}"
    exit 1
fi

echo -e "${GREEN}[1/6] Authenticating container registry (if token provided)...${NC}"
if [ -n "${GHCR_TOKEN:-}" ] && [ -n "${GHCR_USER:-}" ]; then
    echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin
    echo -e "${GREEN}      Authenticated with ghcr.io as $GHCR_USER${NC}"
elif [ -n "${GITHUB_TOKEN:-}" ] && [ -n "${GITHUB_ACTOR:-}" ]; then
    echo "$GITHUB_TOKEN" | docker login ghcr.io -u "$GITHUB_ACTOR" --password-stdin
    echo -e "${GREEN}      Authenticated with ghcr.io as $GITHUB_ACTOR${NC}"
else
    echo -e "${YELLOW}      Proceeding with public registry pull / existing auth...${NC}"
fi

echo -e "${GREEN}[2/6] Pulling pre-built images from GitHub Actions (0 server build overhead)...${NC}"
$DOCKER_COMPOSE --env-file "$ENV_FILE" -f "$COMPOSE_FILE" pull

echo -e "${GREEN}[3/6] Starting updated production containers...${NC}"
$DOCKER_COMPOSE --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --remove-orphans

echo -e "${GREEN}[4/6] Running database migrations...${NC}"
# Allow database and backend a few seconds to warm up
sleep 4
$DOCKER_COMPOSE --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T backend php artisan migrate --force

echo -e "${GREEN}[5/6] Optimizing Laravel configuration, routes & views...${NC}"
$DOCKER_COMPOSE --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T backend php artisan optimize:clear
$DOCKER_COMPOSE --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T backend php artisan config:cache
$DOCKER_COMPOSE --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T backend php artisan route:cache
$DOCKER_COMPOSE --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T backend php artisan view:cache

echo -e "${GREEN}[6/6] Cleaning up stale unused Docker images to preserve disk space...${NC}"
docker image prune -f --filter "until=72h" || true

echo -e "${BLUE}==============================================================================${NC}"
echo -e "${GREEN}               ✅ PRODUCTION DEPLOYMENT COMPLETED SUCCESSFULLY               ${NC}"
echo -e "${BLUE}==============================================================================${NC}"
$DOCKER_COMPOSE --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps
echo ""
echo -e "Frontend & API Gateway : ${GREEN}http://localhost:${HTTP_PORT:-80}${NC}"
echo -e "Health check endpoint  : ${GREEN}http://localhost:${HTTP_PORT:-80}/api/status${NC}"
echo -e "Redis cache & queue    : ${GREEN}Active (redis:6379)${NC}"
echo -e "${BLUE}==============================================================================${NC}"

