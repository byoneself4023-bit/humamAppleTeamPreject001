# MusicSpace 맥북 배포 가이드 (Docker Hub Pull 방식)

**도메인:** `http://imapplepie20.tplinkdns.com`
**대상:** 맥북 (macOS) — Docker Hub 이미지 Pull
**Compose 파일:** `docker-compose.macbook.yml`

> **빌드 방식과의 차이:**
> - 빌드 방식 (`docker-compose.fullstack-local.yml`): 맥북에서 소스를 직접 빌드 (20~40분)
> - **Docker Hub 방식 (이 문서)**: Docker Hub에서 이미지 Pull → 빌드 불필요, 빠른 시작

---

## 목차
1. [사전 요구사항](#1-사전-요구사항)
2. [이미지 Push 준비 (개발PC에서)](#2-이미지-push-준비-개발pc에서)
3. [맥북 소스 코드 준비](#3-맥북-소스-코드-준비)
4. [환경 변수(.env) 설정](#4-환경-변수env-설정)
5. [Docker Desktop 설정](#5-docker-desktop-설정)
6. [공유기 포트포워딩 설정](#6-공유기-포트포워딩-설정)
7. [맥북 네트워크 고정 설정](#7-맥북-네트워크-고정-설정)
8. [macOS 방화벽 및 절전 설정](#8-macos-방화벽-및-절전-설정)
9. [최초 실행 (맥북에서)](#9-최초-실행-맥북에서)
10. [DB 마이그레이션 적용](#10-db-마이그레이션-적용)
11. [서비스 실행 및 중지](#11-서비스-실행-및-중지)
12. [배포 후 검증](#12-배포-후-검증)
13. [코드 변경 시 업데이트 방법](#13-코드-변경-시-업데이트-방법)
14. [트러블슈팅](#14-트러블슈팅)

---

## 1. 사전 요구사항

### 맥북에 필요한 것
- **Docker Desktop for Mac** ([다운로드](https://www.docker.com/products/docker-desktop/))
  - Apple Silicon(M1~M4): "Apple Chip" 버전
  - Intel Mac: "Intel Chip" 버전
- **Git**
- **Docker Hub 계정**: [hub.docker.com](https://hub.docker.com) (이미지 pull용)

```bash
# 설치 확인
docker --version          # 24.x 이상
docker compose version    # v2.x 이상
git --version
```

---

## 2. 이미지 Push 준비 (개발 PC에서)

> **맥북에서 직접 배포한다면 이 단계 건너뜀.**
> Docker Hub에 최신 이미지가 이미 올라가 있다면 바로 [3단계](#3-맥북-소스-코드-준비)로.

### 2-1. Docker Hub 로그인 (개발 PC)
```bash
docker login
# Username: johae201
# Password: Docker Hub 비밀번호 입력
```

### 2-2. 이미지 빌드 및 Push

```bash
cd ~/humamAppleTeamPreject001   # 또는 본인 경로
```

#### 프론트엔드 (React + nginx)
```bash
docker build -t johae201/music_space_place:frontend .
docker push johae201/music_space_place:frontend
```

#### Spring Boot 백엔드
```bash
docker build -t johae201/music_space_place:spring-backend ../2TeamFinalProject-BE
docker push johae201/music_space_place:spring-backend
```

#### FastAPI AI/ML 서버
```bash
docker build -t johae201/music_space_place:fastapi ../FAST_API
docker push johae201/music_space_place:fastapi
```

#### Node.js 백엔드
```bash
docker build -t johae201/music_space_place:node-backend ./server
docker push johae201/music_space_place:node-backend
```

#### 전체 한 번에 빌드 + Push
```bash
# 아래 스크립트를 push_images.sh로 저장 후 실행
docker build -t johae201/music_space_place:frontend . && \
docker build -t johae201/music_space_place:spring-backend ../2TeamFinalProject-BE && \
docker build -t johae201/music_space_place:fastapi ../FAST_API && \
docker build -t johae201/music_space_place:node-backend ./server && \
docker push johae201/music_space_place:frontend && \
docker push johae201/music_space_place:spring-backend && \
docker push johae201/music_space_place:fastapi && \
docker push johae201/music_space_place:node-backend
```

> **Apple Silicon 맥북에 배포한다면:** 빌드 시 `--platform linux/amd64` 추가 필요할 수 있음.
> 맥북과 개발 PC 아키텍처가 같다면 불필요.

---

## 3. 맥북 소스 코드 준비

> Docker Hub 방식에서도 소스 코드가 필요한 이유:
> - `nginx.local.conf` (nginx 설정)
> - `docs/dbSchema.sql` (DB 초기화)
> - `docker-compose.macbook.yml` (compose 파일)
> - `public/` 폴더 (이미지, 업로드)

```bash
cd ~/

# 레포 클론 (같은 부모 폴더에)
git clone https://github.com/imorangepie20/humamAppleTeamPreject001.git
```

> FastAPI 데이터 파일은 Docker Hub 이미지 안에 포함됨 → 2TeamFinalProject-BE, FAST_API 클론 불필요

---

## 4. 환경 변수(.env) 설정

```bash
cd ~/humamAppleTeamPreject001

# 템플릿 복사
cp .env.docker .env
```

`.env` 파일 열어 수정:

```env
# Database (기본값 그대로 사용 가능)
DB_ROOT_PASSWORD=musicspace123
DB_NAME=music_space_db
DB_USER=musicspace
DB_PASSWORD=musicspace123

# JWT Secret — 반드시 변경!
JWT_SECRET=여기에_랜덤값_입력
# 생성: openssl rand -base64 32

# Tidal API (없으면 빈칸)
TIDAL_CLIENT_ID=
TIDAL_CLIENT_SECRET=

# Spotify API
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=

# YouTube API
YOUTUBE_KEY=

# Last.fm API
LASTFM_API_KEY=
```

---

## 5. Docker Desktop 설정

Docker Desktop 실행 → **Settings(톱니바퀴)**:

**Resources 탭:**
| 항목 | 권장값 |
|------|--------|
| CPUs | 4 이상 |
| Memory | 8GB 이상 |
| Disk image size | 30GB 이상 |

**General 탭:**
- "Start Docker Desktop when you log in" 체크 → 맥 재시작 후 자동 실행

---

## 6. 공유기 포트포워딩 설정

TP-Link 공유기 관리 페이지 (`192.168.0.1` 또는 `192.168.1.1`) 접속:

**고급 설정 → NAT 포워딩 → 가상 서버:**

| 이름 | 외부 포트 | 내부 포트 | 내부 IP | 프로토콜 |
|------|----------|---------|--------|---------|
| MusicSpace | 80 | 80 | 맥북 IP | TCP |

맥북 IP 확인:
```bash
ipconfig getifaddr en0    # Wi-Fi
ipconfig getifaddr en1    # 유선 Ethernet
```

---

## 7. 맥북 네트워크 고정 설정

포트포워딩 대상 IP가 바뀌지 않도록 고정 필요.

### 공유기에서 DHCP 예약 (권장)
TP-Link 관리 페이지 → **고급 → 네트워크 → DHCP 서버 → 주소 예약**:
- 맥북 MAC 주소 + 원하는 IP 등록

맥북 MAC 주소 확인:
```bash
# Wi-Fi
networksetup -getmacaddress Wi-Fi | awk '{print $3}'
# Ethernet
networksetup -getmacaddress Ethernet | awk '{print $3}'
```

---

## 8. macOS 방화벽 및 절전 설정

### 방화벽
**시스템 설정 → 개인정보 및 보안 → 방화벽**:
- Docker Desktop의 수신 연결 허용 확인

### 절전 방지
**시스템 설정 → 배터리 → 전원 어댑터:**
- 디스플레이 끄기: 안 함
- 네트워크 접근 시 깨우기: 체크

서비스 운영 중 터미널에서:
```bash
caffeinate -s   # Ctrl+C로 해제
```

---

## 9. 최초 실행 (맥북에서)

### 9-1. 필수 디렉터리 생성
```bash
cd ~/humamAppleTeamPreject001
mkdir -p public/images
mkdir -p public/uploads
```

### 9-2. Docker Hub 이미지 Pull
```bash
docker compose -f docker-compose.macbook.yml pull
```

> 최초 Pull 시 이미지 크기: 약 3~5GB (FastAPI 포함)
> 네트워크 속도에 따라 5~15분 소요

### 9-3. 서비스 시작
```bash
docker compose -f docker-compose.macbook.yml up -d
```

### 9-4. 기동 확인
```bash
# 컨테이너 상태 확인 (모두 Up이어야 함)
docker ps --format "table {{.Names}}\t{{.Status}}"
```

예상 결과:
```
NAMES                       STATUS
musicspace-frontend         Up
musicspace-spring-backend   Up
musicspace-fastapi          Up (healthy)
musicspace-backend          Up
musicspace-redis            Up (healthy)
musicspace-db               Up (healthy)
```

---

## 10. DB 마이그레이션 적용

> **최초 실행 시 1회만 적용.** DB 볼륨이 초기화되었을 때도 재적용.

```bash
cd ~/humamAppleTeamPreject001

# 001
docker exec -i musicspace-db mariadb -u musicspace -pmusicspace123 music_space_db < server/migrations/001_create_genres_tables.sql

# 002
docker exec -i musicspace-db mariadb -u musicspace -pmusicspace123 music_space_db < server/migrations/002_ems_scoring_tables.sql

# 003
docker exec -i musicspace-db mariadb -u musicspace -pmusicspace123 music_space_db < server/migrations/003_track_extended_metadata.sql

# stats
docker exec -i musicspace-db mariadb -u musicspace -pmusicspace123 music_space_db < server/migrations/create_stats_tables.sql

# 005
docker exec -i musicspace-db mariadb -u musicspace -pmusicspace123 music_space_db < server/migrations/005_ems_playlist_for_recommend.sql

# 007
docker exec -i musicspace-db mariadb -u musicspace -pmusicspace123 music_space_db < server/migrations/007_user_cart_table.sql

# 008
docker exec -i musicspace-db mariadb -u musicspace -pmusicspace123 music_space_db < server/migrations/008_users_grade_and_master_role.sql
```

> **004, 006은 적용 불필요** (코드에서 사용 안 함)

---

## 11. 서비스 실행 및 중지

### 시작
```bash
cd ~/humamAppleTeamPreject001
docker compose -f docker-compose.macbook.yml up -d
```

### 중지 (데이터 유지)
```bash
docker compose -f docker-compose.macbook.yml down
```

### 재시작
```bash
docker compose -f docker-compose.macbook.yml restart
```

### 특정 컨테이너 재시작
```bash
docker restart musicspace-spring-backend
docker restart musicspace-fastapi
docker restart musicspace-frontend
```

### 로그 확인
```bash
# 전체 실시간
docker compose -f docker-compose.macbook.yml logs -f

# 특정 서비스
docker logs musicspace-spring-backend --tail 50
docker logs musicspace-fastapi --tail 50
docker logs musicspace-frontend --tail 50
```

---

## 12. 배포 후 검증

### 외부 접근 (도메인)
| URL | 기대 결과 |
|-----|---------|
| `http://imapplepie20.tplinkdns.com/` | MusicSpace 메인 페이지 로딩 |
| `http://imapplepie20.tplinkdns.com/music/home` | 홈 페이지 |
| `http://imapplepie20.tplinkdns.com/swagger-ui/index.html` | Spring Boot Swagger UI |
| `http://imapplepie20.tplinkdns.com/api/fastapi/health` | FastAPI 헬스 체크 JSON |

### 로컬 접근
| URL | 기대 결과 |
|-----|---------|
| `http://localhost/` | MusicSpace 메인 페이지 |
| `http://localhost/api/m1/health` | M1 모델 상태 |

---

## 13. 코드 변경 시 업데이트 방법

### 전체 업데이트 (개발 PC에서 Push → 맥북에서 Pull)

**Step 1 — 개발 PC에서 이미지 빌드 & Push:**
```bash
# 프론트엔드 변경 시
docker build -t johae201/music_space_place:frontend . && \
docker push johae201/music_space_place:frontend

# 백엔드 변경 시
docker build -t johae201/music_space_place:spring-backend ../2TeamFinalProject-BE && \
docker push johae201/music_space_place:spring-backend

# FastAPI 변경 시
docker build -t johae201/music_space_place:fastapi ../FAST_API && \
docker push johae201/music_space_place:fastapi
```

**Step 2 — 맥북에서 Pull & 재시작:**
```bash
cd ~/humamAppleTeamPreject001
git pull   # nginx.local.conf, docker-compose.macbook.yml 등 업데이트
docker compose -f docker-compose.macbook.yml pull
docker compose -f docker-compose.macbook.yml up -d
```

### nginx 설정만 변경 시 (이미지 재빌드 불필요)
```bash
cd ~/humamAppleTeamPreject001
git pull
docker exec musicspace-frontend nginx -s reload
```

---

## 14. 트러블슈팅

### 도메인 접속 불가
```bash
# 1. 컨테이너 80포트 바인딩 확인
docker ps | grep frontend

# 2. 로컬에서 먼저 테스트
curl http://localhost/

# 3. 맥북 IP 확인 (공유기 포트포워딩 대상 IP와 일치 여부)
ipconfig getifaddr en0
```

### 이미지 Pull 실패
```bash
# Docker Hub 로그인 확인
docker login

# 이미지 이름 확인
docker pull johae201/music_space_place:frontend
```

### Spring Boot 기동 실패
```bash
docker logs musicspace-spring-backend --tail 100
```
- `user_grade` 컬럼 오류 → 마이그레이션 008 적용
- DB 연결 실패 → `musicspace-db` healthy 상태 확인 후 재시작

### FastAPI 기동 실패
```bash
docker logs musicspace-fastapi --tail 100
```
- 메모리 부족: Docker Desktop에서 Memory 8GB 이상으로 설정
- L1 Kuka 데이터 없음: fastapi 이미지에 데이터 파일 포함 여부 확인

### 포트 80 충돌
```bash
# 80포트 점유 프로세스 확인
sudo lsof -i :80

# macOS 기본 Apache 끄기
sudo apachectl stop
```

### DB 완전 초기화 (최후 수단, 모든 데이터 삭제)
```bash
docker compose -f docker-compose.macbook.yml down -v
docker compose -f docker-compose.macbook.yml up -d
# 이후 마이그레이션 재적용 필요
```

---

## 참고

| 항목 | 내용 |
|------|------|
| Docker Hub 이미지 | `johae201/music_space_place:{태그}` |
| 사용 태그 | `frontend`, `spring-backend`, `fastapi`, `node-backend` |
| nginx 설정 | `nginx.local.conf` (HTTP, 도메인 포함) |
| DB 스키마 | `docs/dbSchema.sql` |
| DB 접속 | `docker exec -it musicspace-db mariadb -u musicspace -pmusicspace123 music_space_db` |
| nginx 리로드 | `docker exec musicspace-frontend nginx -s reload` |
| 빌드 방식 가이드 | `docs/DEPLOY_MACBOOK.md` |
