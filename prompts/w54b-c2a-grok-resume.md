续跑 C2a,不要重做已接线代码。

上一轮在 `max turns reached` 截断,当时状态:相关单测已绿,正要跑 daemon 全量 vitest。工作树已有 executor/gateServer/approvalFlow/gate-claude/enum 等改动。

本轮只做收口:
1. 若有未写完的测试或明显编译缺口,最小补齐(C2b 范围仍不做)。
2. 依次跑并记录退出码:`pnpm --filter @saydo/daemon exec tsc --noEmit`;`pnpm --filter @saydo/daemon exec vitest run`;`UV_CACHE_DIR=/tmp/saydo-uv-cache just ci`;改动文件 `bash scripts/check-emoji.sh`。
3. 按原任务书写完整汇报(文件清单/新增测试数/门禁数字/白名单既有改动含 :202/C2b 待接线点/冲突不自决)。
4. 禁止 git clean/checkout/restore/stash/commit/push;禁止改 deploy/docs/release/docs/site/artifacts/release/live 配置。
