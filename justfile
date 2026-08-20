# SayDo 工程任务入口(Phase 0 起;计划 0.1)

# 一键起三进程:daemon / pipeline / console
dev:
    #!/usr/bin/env bash
    set -u
    trap 'kill 0' EXIT
    pnpm --filter @saydo/daemon dev &
    (cd pipeline && uv run python -m saydo_pipeline) &
    pnpm --filter @saydo/console dev &
    wait

# CI 等效判定(本地双矩阵;Actions 不可用时以此留证)
ci: ci-node ci-python
    @echo "[ok] just ci: node + python matrices green"

ci-node:
    pnpm typecheck
    pnpm lint
    pnpm test
    bash scripts/check-emoji.sh
    bash scripts/test-emoji-gate.sh
    bash scripts/check-hardcoded-colors.sh
    bash scripts/test-color-gate.sh
    bash scripts/test-migration-tools.sh

ci-python:
    cd pipeline && uv sync --quiet && uv run python -m ruff check . && uv run python -m pytest -q

# 快照备份(SQLite/JSONL/foundation/knowledge;保留期见 [params].backup_retention_days)
backup:
    pnpm --filter @saydo/daemon backup

# daemon 常驻管理(launchd,07 D17;install 属系统级变更,先过 owner 检查点)
daemon *args:
    pnpm --filter @saydo/daemon daemon {{args}}

# T2 手机配对 URL(一次性 token 注入;之后深链不带 token)
t2-pair:
    pnpm --filter @saydo/daemon t2-pair

test:
    pnpm test

typecheck:
    pnpm typecheck
