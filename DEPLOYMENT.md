# CD/배포 가이드

## 🎯 배포 아키텍처

- **Web**: Nginx가 `/var/www/contrail`의 정적 파일을 서빙
- **API**: PM2가 Node.js 서버 관리
- **Port 25140**: Nginx를 통해 외부 접근

## 1️⃣ GitHub 저장소 준비

### 저장소 생성 및 Push
```bash
cd /Users/user/Desktop/contrail

# GitHub 저장소 생성 (https://github.com/new)
git remote add origin https://github.com/yourusername/contrail.git
git branch -M main
git push -u origin main
```

## 2️⃣ 서버 초기 설정

### Step 1: 서버 접속 및 환경 설정
```bash
# SSH 접속
ssh -p 24140 ubuntu@ssh.gsmsv.site

# 비밀번호: @*6y$x&A

# 초기 설정 스크립트 실행
bash <(curl -s https://raw.githubusercontent.com/yourusername/contrail/main/server-setup.sh)
```

### Step 2: Sudo 권한 설정 (자동 배포용)

GitHub Actions에서 sudo 명령어를 암호 없이 실행하려면, 서버에서 다음을 설정하세요:

```bash
# 서버에 SSH 접속
ssh -p 24140 ubuntu@ssh.gsmsv.site

# sudoers 편집 (안전한 방식)
sudo visudo

# 다음 라인을 파일 끝에 추가:
ubuntu ALL=(ALL) NOPASSWD: /bin/rm, /bin/cp, /usr/sbin/nginx, /bin/chown, /usr/bin/systemctl
```

또는 한 줄로:
```bash
ssh -p 24140 ubuntu@ssh.gsmsv.site "echo 'ubuntu ALL=(ALL) NOPASSWD: /bin/rm, /bin/cp, /usr/sbin/nginx, /bin/chown, /usr/bin/systemctl' | sudo tee /etc/sudoers.d/contrail-deploy"
```

### Step 3: 서버에서 .env 파일 생성
```bash
ssh -p 24140 ubuntu@ssh.gsmsv.site

# 디렉토리 이동
cd /home/ubuntu/contrail/apps/api

# .env 파일 생성
nano .env
```

다음 내용 입력:
```
GITHUB_TOKEN=your_token_here
PORT=4000
CACHE_TTL_SECONDS=21600
```

### Step 4: 초기 배포
```bash
ssh -p 24140 ubuntu@ssh.gsmsv.site "cd /home/ubuntu/contrail && bash deploy.sh"
```

## 3️⃣ GitHub Actions 자동 배포 설정

### 방법 1️⃣: 비밀번호 방식 (간단)

#### Step 1: GitHub Secrets 등록

1. GitHub 저장소로 이동: `https://github.com/yourusername/contrail`
2. **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
3. 다음 secret 추가:

| Name | Value |
|------|-------|
| `SSH_PASSWORD` | `@*6y$x&A` |

#### Step 2: 자동 배포 시작

이제 `main` 브랜치에 push하면 자동으로 배포됩니다:

```bash
# 로컬에서 수정 후 push
git add .
git commit -m "Update feature"
git push origin main

# 자동으로 배포 시작 ✅
```

---

### 방법 2️⃣: SSH 키 방식 (더 안전) ⭐

#### Step 1: 서버에서 SSH 키 생성

```bash
ssh -p 24140 ubuntu@ssh.gsmsv.site

# SSH 키 생성 (파이프라인용, 기존 키 덮어쓰지 않음)
ssh-keygen -t ed25519 -f ~/.ssh/github-actions -N ""

# 공개키를 authorized_keys에 추가
cat ~/.ssh/github-actions.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# 개인키 내용 복사 (GitHub에 등록할 것)
cat ~/.ssh/github-actions
```

#### Step 2: GitHub Secrets 등록

1. GitHub 저장소로 이동: `https://github.com/yourusername/contrail`
2. **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
3. 다음 secrets 추가:

| Name | Value |
|------|-------|
| `SSH_KEY` | ⬆️ 서버에서 복사한 개인키 내용 |
| `SSH_HOST` | `ssh.gsmsv.site` |
| `SSH_PORT` | `24140` |
| `SSH_USER` | `ubuntu` |

#### Step 3: 자동 배포 시작

```bash
git add .
git commit -m "Update feature"
git push origin main

# 자동으로 배포 시작 ✅
```

---

## 4️⃣ 배포 상태 확인

### GitHub Actions 로그 확인
1. GitHub 저장소 → **Actions** 탭
2. 최신 워크플로우 실행 상태 확인
3. 실패하면 로그를 클릭해서 상세 오류 확인

### 서버 상태 확인
```bash
ssh -p 24140 ubuntu@ssh.gsmsv.site

# PM2 API 서버 상태
pm2 status

# API 서버 로그
pm2 logs contrail-api

# Nginx 상태
sudo systemctl status nginx

# Nginx 에러 로그
sudo tail -100 /var/log/nginx/error.log

# 배포된 웹 파일 확인
ls -la /var/www/contrail/
```

## ⚡ 수동 배포

배포 스크립트를 수동으로 실행하려면:

```bash
ssh -p 24140 ubuntu@ssh.gsmsv.site "cd /home/ubuntu/contrail && bash deploy.sh"
```

또는 GitHub Actions 페이지에서 **Run workflow** 버튼을 클릭하세요.

## 🆘 문제 해결

### CD가 동작하지 않을 때

1. **SSH 연결 실패**
   - SSH 비밀번호/키가 올바른지 확인
   - 서버의 포트 24140이 열려있는지 확인

2. **Sudo 권한 오류**
   - 서버에서 sudoers 설정 확인: `sudo visudo`
   - NOPASSWD 권한이 추가되었는지 확인

3. **배포 스크립트 실패**
   - 서버 로그 확인: `ssh -p 24140 ubuntu@ssh.gsmsv.site "cd /home/ubuntu/contrail && bash deploy.sh"`
   - PM2 로그: `pm2 logs contrail-api`

4. **Nginx 오류**
   - 설정 테스트: `sudo nginx -t`
   - 에러 로그: `sudo tail -50 /var/log/nginx/error.log`
   - 접근 로그: `sudo tail -50 /var/log/nginx/access.log`

5. **포트 충돌**
   - API가 포트 4000을 사용하는지 확인: `lsof -i :4000`
   - 이미 실행 중이면: `pm2 restart contrail-api`
pm2 status

# 로그 확인
pm2 logs contrail-api
pm2 logs contrail-web

# 실시간 로그
pm2 logs
```

## 5️⃣ Nginx 리버스 프록시 설정

웹과 API를 한 포트(80)에서 제공하려면 Nginx를 설정해야 합니다.

### 자동 설정
```bash
ssh -p 24140 ubuntu@ssh.gsmsv.site "bash /tmp/nginx-setup.sh"
```

또는 직접 실행:
```bash
scp -P 24140 nginx-setup.sh ubuntu@ssh.gsmsv.site:/tmp/
ssh -p 24140 ubuntu@ssh.gsmsv.site "bash /tmp/nginx-setup.sh"
```

설정 후:
- `/` → Web UI (포트 5173)
- `/api/*` → API (포트 4000)

모두 외부적으로는 포트 80 (외부 포트 25140)으로 접속

---

## 6️⃣ 배포 순서 요약

### 첫 배포
```bash
# 1. 로컬에서 최신 코드 푸시
git add .
git commit -m "Initial setup"
git push origin main

# 2. 서버 초기 설정 (첫 1회만)
ssh -p 24140 ubuntu@ssh.gsmsv.site
bash /tmp/server-setup.sh

# 3. Nginx 설정 (첫 1회만)
bash /tmp/nginx-setup.sh

# 4. .env 파일 생성
cd /home/ubuntu/contrail
nano apps/api/.env
# GITHUB_TOKEN 입력

# 5. 수동 배포 (테스트)
bash deploy.sh

# 6. PM2 저장
pm2 save
```

### 이후 배포
```bash
# GitHub에 푸시하면 자동 배포
git push origin main
# GitHub Actions가 자동으로 배포함 ✅
```

---

## 7️⃣ 서버 접속 및 포트

배포 완료 후 접속:

- **Web UI**: `http://ssh.gsmsv.site:25140`
- **API**: `http://ssh.gsmsv.site:25140/api`

## 6️⃣ 문제 해결

### 배포 실패
```bash
# GitHub Actions 로그 확인
# Settings → Secrets이 제대로 설정되었는지 확인

# 수동 배포 시도
ssh -p 24140 ubuntu@ssh.gsmsv.site "cd /home/ubuntu/contrail && bash deploy.sh"
```

### 서비스가 실행 중이 아님
```bash
ssh -p 24140 ubuntu@ssh.gsmsv.site

# 서비스 재시작
pm2 restart contrail-api
pm2 restart contrail-web

# 또는 전체 배포 다시 실행
cd /home/ubuntu/contrail && bash deploy.sh
```

### GITHUB_TOKEN 오류
```bash
ssh -p 24140 ubuntu@ssh.gsmsv.site

# .env 파일 수정
nano /home/ubuntu/contrail/apps/api/.env

# 변경 후 서비스 재시작
pm2 restart contrail-api
```

## 7️⃣ PM2 관리 명령어

```bash
ssh -p 24140 ubuntu@ssh.gsmsv.site

# 상태 확인
pm2 status

# 로그 확인
pm2 logs

# 서비스 재시작
pm2 restart contrail-api
pm2 restart contrail-web

# 서비스 중지
pm2 stop contrail-api
pm2 stop contrail-web

# 서비스 삭제
pm2 delete contrail-api
pm2 delete contrail-web

# 저장
pm2 save
```

## 8️⃣ SSL/HTTPS 설정 (선택사항)

Let's Encrypt를 사용하여 HTTPS 설정:

```bash
ssh -p 24140 ubuntu@ssh.gsmsv.site

# Certbot 설치
sudo apt-get install certbot

# 인증서 발급 (도메인 필요)
sudo certbot certonly --standalone -d yourdomain.com

# Nginx 또는 Caddy를 프록시로 설정
```

---

## 📋 배포 자동화 흐름

```
Local (Push to GitHub)
         ↓
GitHub (Webhook)
         ↓
GitHub Actions (Runs workflow)
         ↓
SSH Connection to Server
         ↓
Run deploy.sh
         ↓
Git Pull, Install, Build, PM2 Restart
         ↓
Deployment Complete ✅
```

