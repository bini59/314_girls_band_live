## Development flow

모든 작업은 `dev-flow`로 시작한다. 이 스킬이 트랙(light/heavy)을 판별하고 아래 단계로 위임한다:

- **계획** → `planner` (트랙 판별 + `tmp/TODO.md` 생성). 메인에서 직접 계획하지 않는다.
- **구현** → `dev-workflow` (light/heavy 실행, worktree, 통합). `.codex/agents/`의 도메인 전용 에이전트가 있으면 글로벌 범용 에이전트보다 우선 사용한다.
- **리뷰** → `review-gate` (code-reviewer 정확성/보안 → ponytail-review 오버엔지니어링). 머지 전 필수. CRITICAL/HIGH는 반드시 수정.
- **릴리즈** → `release` 스킬 (production=main / hotfix 절차, staging 없음).

작업 인테이크는 `gh-issue` 스킬로 GitHub 이슈에서 가져온다.

도메인 용어(ubiquitous language)는 `CONTEXT.md` 참조. 테스트는 수동 실행 금지 — pre-commit hook이 커밋 시 타입 체크 + 전체 테스트를 자동 실행한다.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
