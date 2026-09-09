#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Hunter System - Docker Deployment    ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
  echo -e "${YELLOW}⚠️  No .env file found. Creating from .env.example...${NC}"
  cp .env.example .env
  echo -e "${GREEN}✅ Created .env file. Please review and update secrets.${NC}"
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo -e "${RED}❌ Docker is not running. Please start Docker and try again.${NC}"
  exit 1
fi

echo -e "${BLUE}📦 Building and starting services...${NC}"

# Build and start all services
docker compose -f docker-compose.prod.yml up -d --build

echo ""
echo -e "${GREEN}✅ All services started successfully!${NC}"
echo ""

# Wait for backend to be healthy
echo -e "${BLUE}⏳ Waiting for backend to be healthy...${NC}"
for i in {1..30}; do
  if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend is healthy!${NC}"
    break
  fi
  sleep 2
done

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   Deployment Complete!                  ${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Frontend:${NC}  http://localhost"
echo -e "${BLUE}Backend:${NC}   http://localhost:3000/api/health"
echo -e "${BLUE}Adminer:${NC}   http://localhost:8080 (with --profile debug)"
echo ""
echo -e "${YELLOW}To view logs:${NC}"
echo -e "  docker compose -f docker-compose.prod.yml logs -f"
echo ""
echo -e "${YELLOW}To stop:${NC}"
echo -e "  docker compose -f docker-compose.prod.yml down"
echo ""
echo -e "${YELLOW}To include Adminer (DB admin):${NC}"
echo -e "  docker compose -f docker-compose.prod.yml --profile debug up -d"
