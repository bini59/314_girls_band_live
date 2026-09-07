---
name: release
description: Release girls_band_live — staging(dev 통합) / production(dev→main 자동 배포) / hotfix 절차. Use when the user wants to ship, deploy, cut a release, bump a version, or "릴리즈 하자".
---

# Release: girls_band_live

브랜치 흐름: `feature/* → dev → (PR) → main → push trigger → GHCR 빌드 + self-hosted 러너 blue/green 배포`.
버전 = 프로덕션 릴리즈 단위(semver). 일상 커밋은 `package.json` version을 건드리지 않는다.

## Staging (dev 통합)

별도 스테이징 배포는 없다. `dev`가 통합 브랜치이며, 여기서 검증이 이뤄진다.

1. feature 브랜치를 `dev`에 머지 (PR 또는 fast-forward).
2. `push → dev`가 `.github/workflows/ci.yml`을 트리거: **lint + typecheck + vitest**(Postgres service) 실행.
3. CI GREEN 확인. `dev`에서 충분히 검증한 뒤에만 프로덕션 릴리즈로 넘어간다.

```bash
git checkout dev && git pull
git merge --no-ff feature/xxx    # 또는 PR 머지
git push origin dev              # ci.yml 실행
```

## Production (dev → main 자동 배포)

`dev`가 안정화되면 릴리즈한다. **main push = 즉시 자동 배포**이므로 되돌리기 어렵다.

1. **버전 bump** — `dev`에서 semver로 `package.json` version을 올린다. 규칙: 기능 추가 `minor`, 버그수정 `patch`, 파괴적 변경 `major`.
   ```bash
   git checkout dev && git pull
   # package.json version 수정 (예: 0.2.2 → 0.3.0)
   git commit -am "chore: release v0.3.0"
   git push origin dev
   ```
2. **dev → main PR** — PR을 열면 `ci.yml`(lint + typecheck + vitest)이 `pull_request → main`으로 실행된다. **모든 잡 GREEN이어야 머지 가능.**
   ```bash
   gh pr create --base main --head dev --title "Release v0.3.0" --body "..."
   ```
3. **머지** — CI GREEN 후 머지. `push → main`이 `.github/workflows/deploy.yml`을 트리거:
   - **build-and-push** (ubuntu-24.04-arm): 이미지 빌드 → GHCR 푸시.
   - **deploy** (self-hosted `gbl-prod` 러너): `scripts/deploy-blue-green.sh` 실행 → 반대 색 기동 → healthy 대기 → nginx upstream 전환 → 무중단 배포.
4. **태그 + GitHub Release** — 배포 후 태그를 찍는다 (태그 형식 `vX.Y.Z`).
   ```bash
   git checkout main && git pull
   git tag v0.3.0 && git push origin v0.3.0
   gh release create v0.3.0 --generate-notes
   ```
5. **검증** — 배포 서버 헬스 확인: `app/api/health/route.ts` 엔드포인트가 200인지, nginx가 새 색을 바라보는지(`nginx/conf.d/active-upstream.conf`) 확인.

## Hotfix (프로덕션 긴급 패치)

`main`에 직접 커밋 금지 규칙은 유지하되, 긴급 패치는 `hotfix/` 브랜치로 빠르게 돌린다.

1. `main`에서 `hotfix/xxx` 분기 → 패치 → PR `hotfix/xxx → main`(ci.yml 통과) → 머지 → 자동 배포.
   ```bash
   git checkout main && git pull
   git checkout -b hotfix/critical-xxx
   # 패치 + package.json patch bump (예: 0.3.0 → 0.3.1)
   git commit -am "fix: ... " && git commit -am "chore: release v0.3.1"
   gh pr create --base main --head hotfix/critical-xxx --title "Hotfix v0.3.1"
   ```
2. 태그 + Release: `git tag v0.3.1 && git push origin v0.3.1`.
3. **역머지 동기화** — hotfix 내용을 `dev`에 반드시 머지해서 다음 릴리즈에서 회귀하지 않게 한다.
   ```bash
   git checkout dev && git pull && git merge main && git push origin dev
   ```

## 롤백

- 빠른 롤백: `nginx/conf.d/active-upstream.conf`를 직전 색으로 되돌리고 `docker compose exec nginx nginx -s reload`.
- 정식 롤백: `git revert` 후 `main` 머지 → 재배포.

## Notes

- 배포 시크릿은 추가 등록 불필요 — GHCR 푸시/풀은 워크플로 `GITHUB_TOKEN` 사용. 서버 `.env`(러너 작업 디렉터리)에 `DATABASE_URL`/`POSTGRES_PASSWORD`/SSO 변수(`AUTH_ORIGIN`, `CLIENT_ID`, `APP_ORIGIN`, `AUTH_REQUIRED_ROLE`, `APP_SECRET`).
- `ci.yml`은 반드시 GitHub-hosted(`ubuntu-latest`) 유지 (public repo fork PR 안전).
- 버전 bump 자동화 스크립트는 없다 — `package.json` 수동 수정 + `chore: release vX.Y.Z` 커밋.
