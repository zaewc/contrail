# 수동 재배포

로컬 프로젝트 루트에서 실행한다.

```bash
rsync -az --delete \
  --exclude .git \
  --exclude node_modules \
  --exclude apps/api/.env \
  -e "ssh -p 24140" \
  ./ ubuntu@ssh.gsmsv.site:/home/ubuntu/contrail/
```

```bash
ssh -p 24140 ubuntu@ssh.gsmsv.site \
  'cd /home/ubuntu/contrail && \
  pnpm install && \
  pnpm build && \
  pm2 delete contrail-api || true; \
  cd /home/ubuntu/contrail/apps/api && \
  pm2 start "pnpm run start" --name contrail-api; \
  pm2 delete contrail-web || true; \
  cd /home/ubuntu/contrail/apps/web && \
  pm2 start "pnpm run preview" --name contrail-web; \
  pm2 save; \
  sudo nginx -t && \
  sudo systemctl reload nginx'
```

확인:

```bash
curl http://ssh.gsmsv.site:25140/health
curl -I http://ssh.gsmsv.site:25140/
```
