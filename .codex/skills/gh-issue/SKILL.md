---
name: gh-issue
description: Pull a GitHub issue from bini59/314_girls_band_live, read its body + comments, grill the scope with the user, then hand off to the planner agent.
---

# GitHub Issue Intake

Pull a GitHub issue → clarify → grill the scope → planner. Work is tracked
entirely as GitHub issues in **bini59/314_girls_band_live**.

## Steps

### 1. Pick or create the issue

- Named/linked issue: `gh issue view <number> --repo bini59/314_girls_band_live --comments`.
- Browsing: `gh issue list --repo bini59/314_girls_band_live --state open`.
- Starting fresh: show the proposed title and body before `gh issue create`.

### 2. Read it fully

Read the body and every comment, then summarize the requested deliverable,
constraints, and open questions.

### 3. Grill the scope

Use `grill-with-docs` with the issue body/comments as the starting plan. Resolve
the deliverable, acceptance criteria, touched routes/modules, and ambiguities;
record material decisions in `CONTEXT.md` or an ADR and comment the issue when
appropriate.

### 4. Hand off

Delegate the shared, grilled scope and touched-file notes to `planner`, which
determines the track and creates `tmp/TODO.md`. Do not implement in this skill.
