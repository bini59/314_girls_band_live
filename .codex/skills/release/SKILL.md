---
name: release
description: Release girls-band-live — production and hotfix procedures.
---

# Release: girls-band-live

## Production (main)

The normal path is `dev` → `main` PR. A push to `main` runs
`.github/workflows/deploy.yml`: an ARM64 GitHub-hosted runner builds and pushes
`ghcr.io/bini59/314_girls_band_live:sha-<SHA>`, then the self-hosted `gbl-prod`
runner pulls it, runs `prisma migrate deploy`, and restarts the `gbl` Compose
service. There is no staging environment.

Before merging, CI must be green for lint, typecheck, and Vitest. After deploy,
verify the container health check at `/api/health` and smoke-test the public
archive and `/admin` login.

Version tags use `vX.Y.Z`; release commits use `chore: release vX.Y.Z`.

## Hotfix

Branch `hotfix/<slug>` from `main`, make the minimal patch, open a PR to
`main`, and let the same deploy workflow run after merge. Tag the resulting
release, then merge `main` back into `dev` so the fix is not lost.
