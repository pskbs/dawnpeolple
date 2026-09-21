# 새벽사람들 in 부천

야간근무자를 위한 커뮤니티(수다방) + 오프라인 벙개모임 서비스.

자세한 기획/규칙은 [`CLAUDE.md`](./CLAUDE.md)와 [`docs/`](./docs) 폴더를 참고하세요.

## 로컬 개발

```powershell
pnpm install
pnpm dev
```

## 스크립트
- `pnpm dev` — 로컬 개발 서버
- `pnpm build:web` — 웹(Vercel)용 빌드
- `pnpm build:toss` — 앱인토스용 빌드 (Phase 2에서 `ait` CLI 반영 예정)
- `pnpm test` / `pnpm test:e2e` — 단위/E2E 테스트
- `pnpm lint` / `pnpm typecheck`
