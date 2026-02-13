# MusicSpace Ubuntu Server 배포 가이드 (Spring Boot + React + Docker)

**타겟 도메인**: `imaiplan.sytes.net`
**배포 전략**: 기존 데이터베이스 이관 포함

본 가이드는 Windows/Mac 로컬 환경이 아닌 **Ubuntu Server (Linux)** 환경 실제 배포를 위한 문서입니다.
기존 문서는 삭제하거나 무시하시고, 이 문서를 기준으로 진행해 주세요.

---

## 1. 아키텍처 및 디렉토리 구조 (필수)

이 프로젝트는 **세 개의 Git 저장소**가 형제(Sibling) 폴더 구조로 위치해야 Docker 빌드가 가능합니다.

**서버 디렉토리 구조 예시:**
```
/home/ubuntu/music_space/          <-- 작업용 최상위 폴더
├── humamAppleTeamPreject001/      <-- [Frontend/Nginx/DockerConfig] (Git Repo 1)
│   ├── docker-compose.yml         <-- 실행 설정 파일
│   ├── nginx.conf
│   └── ...
├── 2TeamFinalProject-BE/          <-- [Spring Boot Backend] (Git Repo 2)
│   ├── src/
│   ├── build.gradle
│   └── ...
└── FAST_API/                      <-- [FastAPI AI Server] (Git Repo 3)
    ├── main.py
    └── ...
```

> **주의:** `docker-compose.yml` 파일이 상위 폴더의 `../2TeamFinalProject-BE`, `../FAST_API`를 참조하므로 이 구조를 반드시 지켜야 합니다.

---

## 2. 사전 요구사항 설치

서버에 접속하여 다음 명령어를 순서대로 실행합니다.

### 2.1 시스템 업데이트 및 필수 패키지
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl ufw
```

### 2.2 Docker & Docker Compose 설치
```bash
# 1. Docker 설치 스크립트 실행
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 2. 권한 설정 (sudo 없이 docker 실행)
sudo usermod -aG docker $USER
newgrp docker

# 3. 설치 확인
docker version
docker compose version
```

---

## 3. 프로젝트 설치

### 3.1 디렉토리 생성 및 클론
```bash
mkdir -p ~/music_space
cd ~/music_space

# 1. 프론트엔드 (설정 포함) 클론
git clone https://github.com/imorangepie20/humamAppleTeamPreject001.git

# 2. 백엔드 (Spring Boot) 클론 — 폴더명 2TeamFinalProject-BE 로 변경
git clone https://github.com/imorangepie20/2TeamFinalProject-PB.git 2TeamFinalProject-BE

# 3. AI 서버 (FastAPI) 클론 — 폴더명 FAST_API 로 변경
git clone https://github.com/imorangepie20/FAST_API-PB.git FAST_API
```

### 3.2 환경 변수 설정 (도메인 적용)
```bash
cd ~/music_space/humamAppleTeamPreject001

# 환경 변수 파일 생성
cp .env.docker .env
nano .env
```

**`.env` 파일 필수 설정 값 (수정하세요):**
```ini
# Database
DB_ROOT_PASSWORD=강력한_비밀번호_입력
DB_PASSWORD=강력한_비밀번호_입력

# Security
JWT_SECRET=강력한_랜덤_시크릿키_입력

# Domain & Redirect URI (중요: 도메인 적용)
TIDAL_REDIRECT_URI=http://imaiplan.sytes.net/tidal-callback

# API Keys
TIDAL_CLIENT_ID=...
TIDAL_CLIENT_SECRET=...
YOUTUBE_KEY=...
```

### 3.3 이미지 저장소 생성 (권한 설정)
```bash
# 호스트에 이미지 저장할 폴더 생성
mkdir -p public/images/{artists,covers,tracks}

# 777 권한 부여 (컨테이너 내에서 쓰기 가능하도록)
chmod -R 777 public/images
```

---

## 4. 데이터베이스 이전 (기존 DB 데이터 유지)

기존에 운영하던 로컬/서버의 DB 데이터를 그대로 가져오려면 **덤프(Export) → 전송 → 복원(Import)** 과정이 필요합니다.

### 4.1 [기존 서버] 데이터 백업 (Export)
기존 DB가 있는 곳에서 실행:
```bash
# 실행 중인 DB 컨테이너에서 덤프 추출
docker compose exec db mysqldump -u musicspace -p music_space_db > music_space_backup.sql
# (비밀번호 입력)
```

### 4.2 [새 서버] 파일 전송
`music_space_backup.sql` 파일을 새 서버(`imaiplan.sytes.net`)의 `~/music_space/humamAppleTeamPreject001/` 경로로 전송합니다. (FileZilla, SCP 등 사용)

### 4.3 [새 서버] 서비스 실행 및 복원 (Import)
1. **서비스 시작 (빈 DB로 시작됨)**
   ```bash
   cd ~/music_space/humamAppleTeamPreject001
   docker compose up -d --build
   ```

2. **데이터 복원**
   ```bash
   # 덤프 파일을 컨테이너 내부로 복사
   docker cp music_space_backup.sql musicspace-db:/tmp/backup.sql

   # 복원 실행
   docker compose exec -T db mysql -u musicspace -p music_space_db < music_space_backup.sql
   # (설정한 DB_PASSWORD 입력)
   ```

---

## 5. 도메인 및 HTTPS 설정 (`imaiplan.sytes.net`)

### 5.1 Nginx 설정
`nginx.conf` 파일에는 이미 기본 설정이 되어 있습니다. HTTPS(SSL) 적용을 위해서는 인증서 발급이 필요합니다.

### 5.2 SSL 인증서 발급 (Certbot)
무료 SSL 인증서(Let's Encrypt)를 발급받습니다.

```bash
# 1. Certbot 설치
sudo apt install -y certbot

# 2. 80 포트 확보를 위해 잠시 프론트엔드 중지
docker compose stop frontend

# 3. 인증서 발급 요청
sudo certbot certonly --standalone -d imaiplan.sytes.net

# 4. 키 파일 권한 조정
sudo chmod -R 755 /etc/letsencrypt/live/
sudo chmod -R 755 /etc/letsencrypt/archive/

# 5. 서비스 다시 시작
docker compose start frontend
```
> **참고**: HTTPS를 강제하려면 `nginx.conf`의 SSL 관련 주석을 해제하고 인증서 경로를 연결해야 합니다. (초기에는 HTTP로 우선 접속 테스트 권장)

---

## 6. 방화벽 설정

```bash
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## 7. 자동 배포 스크립트 (`deploy.sh`)

서버에서 코드를 쉽게 업데이트하기 위한 스크립트입니다.

`~/music_space/deploy.sh` 파일 생성:
```bash
nano ~/music_space/deploy.sh
```

**내용 붙여넣기:**
```bash
#!/bin/bash
BASE_DIR="$HOME/music_space"
FRONT_REPO="$BASE_DIR/humamAppleTeamPreject001"
BACK_REPO="$BASE_DIR/2TeamFinalProject-BE"

echo "🚀 배포 시작 (Target: imaiplan.sytes.net)..."

# 1. 소스 코드 업데이트
echo "📥 Git Pull..."
cd $FRONT_REPO && git pull origin main
cd $BACK_REPO && git pull origin main

# 2. 컨테이너 재빌드 및 실행
echo "🔄 Docker Rebuild..."
cd $FRONT_REPO
docker compose down
docker compose up -d --build

echo "✅ 배포 완료! http://imaiplan.sytes.net 에서 확인하세요."
docker compose ps
```

**권한 부여 및 실행:**
```bash
chmod +x ~/music_space/deploy.sh
~/music_space/deploy.sh
```

---

**모든 과정이 끝나면 브라우저에서 `http://imaiplan.sytes.net` 으로 접속하여 확인하세요.**
