#!/usr/bin/env bash
#
# girls_band_live blue/green 배포 스크립트.
#
# 동작:
#   1) `nginx/conf.d/active-upstream.conf` 에서 현재 활성 색(blue|green) 검출.
#   2) 반대 색을 새 이미지로 기동.
#   3) 새 컨테이너 healthcheck 통과 대기.
#   4) Prisma migrate deploy (idempotent — 이미 적용된 마이그레이션은 no-op).
#   5) nginx upstream 파일을 새 색으로 갱신 → `nginx -s reload`.
#   6) 구 색 컨테이너 stop.
#
# 사용:
#   IMAGE_TAG=sha-<...>  ./scripts/deploy-blue-green.sh
#
# 사전 조건:
#   - docker compose v2 (`docker compose ...`)
#   - 호스트에 GHCR pull 권한 (docker login ghcr.io)
#   - 환경변수: DATABASE_URL, ADMIN_PASSWORD_HASH, JWT_SECRET, POSTGRES_* (compose .env)
#   - 최초 1회: `docker compose --profile app up -d postgres nginx app-blue` 로 부트스트랩.

set -euo pipefail

# --- 입력 ---------------------------------------------------------------------
IMAGE_TAG="${IMAGE_TAG:-latest}"
IMAGE_REPO="${IMAGE_REPO:-ghcr.io/bini59/314_girls_band_live}"
FULL_IMAGE="${IMAGE_REPO}:${IMAGE_TAG}"

# nginx upstream 파일 (호스트 경로 — 컨테이너에 ro 마운트 되어 있음)
UPSTREAM_FILE="${UPSTREAM_FILE:-./nginx/conf.d/active-upstream.conf}"

# healthcheck 폴링
HEALTH_TIMEOUT_SEC="${HEALTH_TIMEOUT_SEC:-90}"
HEALTH_POLL_INTERVAL_SEC=2

# --- 함수 ---------------------------------------------------------------------
log() { printf '[deploy %s] %s\n' "$(date +%H:%M:%S)" "$*"; }

current_color() {
  grep -oE 'app-(blue|green)' "$UPSTREAM_FILE" | head -n1 | sed 's/app-//'
}

other_color() {
  [[ "$1" == "blue" ]] && echo "green" || echo "blue"
}

wait_healthy() {
  local container="$1"
  local elapsed=0
  log "waiting for $container to become healthy (timeout=${HEALTH_TIMEOUT_SEC}s)..."
  while (( elapsed < HEALTH_TIMEOUT_SEC )); do
    local status
    status=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container" 2>/dev/null || echo "missing")
    case "$status" in
      healthy) log "$container is healthy"; return 0 ;;
      unhealthy) log "ERROR: $container reported unhealthy"; docker logs --tail 50 "$container" || true; return 1 ;;
    esac
    sleep "$HEALTH_POLL_INTERVAL_SEC"
    elapsed=$((elapsed + HEALTH_POLL_INTERVAL_SEC))
  done
  log "ERROR: $container did not become healthy within ${HEALTH_TIMEOUT_SEC}s"
  docker logs --tail 50 "$container" || true
  return 1
}

# --- 1) 현재 색 판정 -----------------------------------------------------------
if [[ ! -f "$UPSTREAM_FILE" ]]; then
  log "ERROR: upstream file not found: $UPSTREAM_FILE"
  exit 1
fi

ACTIVE="$(current_color || true)"
if [[ -z "${ACTIVE:-}" ]]; then
  log "ERROR: cannot detect active color from $UPSTREAM_FILE"
  cat "$UPSTREAM_FILE"
  exit 1
fi
TARGET="$(other_color "$ACTIVE")"
log "active=$ACTIVE  target=$TARGET  image=$FULL_IMAGE"

# --- 2) 새 이미지 pull ---------------------------------------------------------
log "pulling image"
docker pull "$FULL_IMAGE"
docker tag "$FULL_IMAGE" girls-band-live:local

# --- 3) Prisma migrate (앱 기동 전에 idempotent 하게 적용) ----------------------
log "running prisma migrate deploy"
# 일회성 마이그레이션 — compose service 정의(app-blue)를 그대로 사용해
# .env 의 DATABASE_URL/POSTGRES_PASSWORD 등이 정확히 주입되도록 한다.
# (수동으로 docker run 하면 .env 가 로드되지 않아 인증 실패함)
#   -u 0:0:   nextjs 유저 홈 디렉터리 부재로 npx 캐시 쓰기 실패하는 문제 회피.
#   HOME=/tmp: npx 패키지 캐시 경로 지정.
#   --no-deps: postgres 이미 떠 있으므로 의존성 재기동 방지.
#   prisma schema 는 이미지 안 /app/prisma/schema.prisma 에 포함.
APP_IMAGE="$FULL_IMAGE" docker compose --profile app run --rm --no-deps \
  -u 0:0 \
  -e HOME=/tmp \
  --entrypoint sh \
  app-blue \
  -c "cd /tmp && npx -y prisma@5.22.0 migrate deploy --schema=/app/prisma/schema.prisma"

# --- 4) 새 색 기동 -------------------------------------------------------------
log "starting app-$TARGET with new image"
APP_IMAGE="$FULL_IMAGE" docker compose --profile app up -d "app-$TARGET"

# --- 5) 헬스 대기 --------------------------------------------------------------
if ! wait_healthy "gbl-app-$TARGET"; then
  log "rolling back: stopping app-$TARGET (active still=$ACTIVE)"
  docker compose stop "app-$TARGET" || true
  exit 1
fi

# --- 6) nginx upstream 전환 ----------------------------------------------------
log "switching nginx upstream → app-$TARGET"
echo "server app-$TARGET:3000;" > "$UPSTREAM_FILE"

if ! docker compose exec -T nginx nginx -t; then
  log "ERROR: nginx config test failed, reverting"
  echo "server app-$ACTIVE:3000;" > "$UPSTREAM_FILE"
  docker compose stop "app-$TARGET" || true
  exit 1
fi

docker compose exec -T nginx nginx -s reload
log "nginx reloaded"

# 짧은 drain — 기존 keepalive 연결이 구버전으로 흘러가는 동안 대기.
sleep 3

# --- 7) 구 색 stop -------------------------------------------------------------
log "stopping old app-$ACTIVE"
docker compose stop "app-$ACTIVE" || true

log "deploy complete: active=app-$TARGET"
docker compose ps
