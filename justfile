# SayDo 工程任务入口(Phase 0 起;计划 0.1)
# recipe 只调 node/pnpm/uv,不绑 bash shebang。

dev:
    node scripts/dev.mjs

# 本地 Node/Python 基线(不是托管 CI 等效)
ci: ci-node ci-python
    @echo "[ok] just ci: node + python matrices green"

ci-node:
    pnpm ci:node

ci-python:
    uv --directory pipeline sync --quiet
    uv --directory pipeline run python -m ruff check .
    uv --directory pipeline run python -m pytest -q

# 提交前卫生(emoji / 活跃文档链接 / 公开树隐私)
precommit:
    bash scripts/check-emoji.sh
    node scripts/check-doc-links.mjs
    node scripts/check-public-tree-privacy.mjs --fs

# 快照备份(SQLite/JSONL/foundation/knowledge;保留期见 [params].backup_retention_days)
backup:
    pnpm --filter @saydo/daemon backup

# daemon 常驻管理(launchd,07 D17;install 属系统级变更,先过 owner 检查点)
daemon *args:
    pnpm --filter @saydo/daemon daemon {{args}}

# T2 配对入口(远程业务关闭时只说明暂不可用,不打印 token URL)
t2-pair:
    pnpm --filter @saydo/daemon t2-pair

test:
    pnpm test

typecheck:
    pnpm typecheck
