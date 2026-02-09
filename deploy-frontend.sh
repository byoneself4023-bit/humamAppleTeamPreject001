#!/bin/bash
# MusicSpace Frontend 배포 스크립트
# docker-compose.yml을 Single Source of Truth로 사용

set -e

cd ~/Final_team_project/humamAppleTeamPreject001

echo "=== MusicSpace Frontend Deploy ==="

# 1. 최신 코드 가져오기
echo "[1/3] Pulling latest code..."
git pull

# 2. 프론트엔드 빌드 및 재시작 (docker-compose 사용)
echo "[2/3] Building and restarting frontend..."
docker-compose up -d --build frontend

# 3. 상태 확인
echo "[3/3] Checking status..."
docker-compose ps frontend

echo ""
echo "=== Deploy Complete ==="
echo "Frontend: https://imaiplan.sytes.net"
