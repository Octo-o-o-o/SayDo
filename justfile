# SayDo 工程任务入口(Phase 0 起;计划 0.1)
# recipe 只调 node/pnpm/uv,不绑 bash shebang。

dev:
    node scripts/dev.mjs

# 本地 Node/Python 基线(不是托管 CI 等效)
ci: ci-node ci-python
    @echo "[ok] just ci: node + python matrices green"

ci-node:
    pnpm typecheck
    pnpm lint
    pnpm test
    node scripts/check-emoji.mjs
    node scripts/test-emoji-gate.mjs
    node scripts/check-hardcoded-colors.mjs
    node scripts/test-color-gate.mjs
    node scripts/test-migration-tools.mjs
    node scripts/test-release-physical-evidence.mjs
    node scripts/test-release-provenance.mjs
    node scripts/test-public-text-redaction.mjs
    node scripts/test-public-tree-privacy.mjs
    node scripts/test-pairing-url-corpus.mjs
    node scripts/test-mobile-installers.mjs
    node scripts/test-mobile-release-contract.mjs
    node scripts/test-install-scripts.mjs

ci-python:
    uv --directory pipeline sync --quiet
    uv --directory pipeline run python -m ruff check .
    uv --directory pipeline run python -m pytest -q

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
