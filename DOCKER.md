# Frontend Docker 환경 가이드

## 파일 구조

```
humamAppleTeamPreject001/
├── Dockerfile                    # Docker 빌드 설정
├── docker-compose.local.yml      # 로컬 개발용
├── docker-compose.frontend.yml   # 서버 배포용
├── nginx.conf                    # 서버용 (HTTPS 포함)
└── nginx.local.conf              # 로컬용 (HTTP only)
```

## 로컬 개발

### 최초 실행
```bash
cd humamAppleTeamPreject001
docker-compose -f docker-compose.local.yml up -d --build
```

### 코드 변경 후 적용
```bash
docker-compose -f docker-compose.local.yml up -d --build
```

### 접속
- http://localhost

---

## 서버 배포

### 배포 명령어
```bash
cd /home/mibeen/music_space_place/Final_team_project/humamAppleTeamPreject001
git pull
docker-compose -f docker-compose.frontend.yml up -d --build
```

### 접속
- https://imaiplan.sytes.net

---

## 로컬 vs 서버 차이

| 항목 | 로컬 | 서버 |
|------|------|------|
| compose 파일 | docker-compose.local.yml | docker-compose.frontend.yml |
| nginx 설정 | nginx.local.conf (마운트) | nginx.conf (빌드 포함) |
| HTTPS | X | O (Let's Encrypt) |
| 포트 | 80 | 80, 443 |

---

## 유용한 명령어

### 컨테이너 상태 확인
```bash
docker ps | grep musicspace-frontend
```

### 로그 확인
```bash
docker logs musicspace-frontend
```

### 컨테이너 재시작
```bash
docker restart musicspace-frontend
```

### 컨테이너 중지/삭제
```bash
docker-compose -f docker-compose.local.yml down
```

### 불필요한 이미지 정리
```bash
docker system prune -f
```
