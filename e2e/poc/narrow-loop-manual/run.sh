#!/bin/bash
# 0.5 窄闭环 PoC · 手动版(计划 0.5;与底座并行,不建 bridge 代码)。
# 用 Hopper 锁定副本(bdd1e548,baseline.2)现状 CLI 遥控走一个真实小任务全链:
#   手写卡 -> lint 预检 -> drop -> scan(triage) -> run(fake-runner 产真实改动) -> RunSettled(settle barrier)
#   -> review show -> approve -> merge;并顺做 hopper check 确定性验收 oracle 可行性。
# 红线:独立临时 repo + 专用 vault + 锁 SHA(05 §3 红线⑦禁外部副作用);runner 用 fake(附录 §2 harness),只有 agent 是假的。
# 产出:证据落 ./evidence/(events.jsonl 尾、lint.json、check.json、逐命令记录),八条对照表见 RESULT.md。
set -u
HOPPER=~/.saydo/hopper-dist/bin/hopper.mjs
LOCKED=bdd1e548f9359789497a797eda24398beba68ac5
EVID="$(cd "$(dirname "$0")" && pwd)/evidence"
rm -rf "$EVID" && mkdir -p "$EVID"

# 版本断言(bridge 启动断言的手动版:rev-parse HEAD == 锁定 commit)
HEAD=$(cd ~/.saydo/hopper-dist && git rev-parse HEAD)
[ "$HEAD" = "$LOCKED" ] || { echo "[fail] hopper-dist HEAD=$HEAD != locked $LOCKED"; exit 1; }
echo "[ok] version assertion: HEAD == $LOCKED" | tee "$EVID/00-version.txt"

# 专用临时 vault + 独立测试 repo(禁外部副作用)
export HOPPER_VAULT=$(mktemp -d)/vault
node $HOPPER init "$HOPPER_VAULT" >/dev/null
REPO=$(mktemp -d)
git -C "$REPO" init -q -b main
printf '{"name":"poc","version":"1.0.0","private":true,"scripts":{"test":"exit 0"}}\n' > "$REPO/package.json"
git -C "$REPO" add -A && git -C "$REPO" -c user.email=t@t -c user.name=t commit -qm init
node $HOPPER --json link-project --project pocapp --repo "$REPO" --no-inbox >/dev/null
echo "vault=$HOPPER_VAULT repo=$REPO" | tee "$EVID/01-setup.txt"

# 手写任务卡(§1.3 附录格式:验收标题段 + dispatch 注释)
CARD=$(mktemp)
cat > "$CARD" <<'EOF'
---
id: saydo-poc-narrow-loop-0001
project: pocapp
runner: auto
---
# 给项目加一个 README 说明文件

创建一个 docs/GREETING.md,内容为一行问候。

## 验收标准

- 新文件 docs/GREETING.md 存在
- 文件首行包含 "hello saydo"

<!-- saydo:dispatch dsp_poc0001 rev=1 digest=sha256:poc -->
EOF

# (1) lint 预检:必须查 classification/execution_decision(missing_acceptance 只是 warning,09 §6.2)
echo "===== step lint(drop 前预检)====="
node $HOPPER --json lint "$CARD" --vault "$HOPPER_VAULT" > "$EVID/lint.json" 2>&1 || true
CLASS=$(jq -r '.result.classification // .classification // "n/a"' "$EVID/lint.json" 2>/dev/null)
EXECD=$(jq -r '.result.execution_decision // .execution_decision // "n/a"' "$EVID/lint.json" 2>/dev/null)
echo "lint: classification=$CLASS execution_decision=$EXECD"

# (2) drop -> scan
echo "===== step drop + scan ====="
TID=$(node $HOPPER --json drop --project pocapp --stdin < "$CARD" | tee "$EVID/drop.json" | jq -r '.task_id // .taskId // empty')
echo "task_id=$TID"
node $HOPPER --json scan > "$EVID/scan.json" 2>&1
node $HOPPER --json status > "$EVID/status-after-scan.json" 2>&1

# (3) run(fake-runner 产真实改动)
echo "===== step run(fake-runner)====="
SPEC=$(mktemp)
cat > "$SPEC" <<'EOF'
{"status":"completed","summary":"add greeting doc","changedFiles":[{"path":"docs/GREETING.md","content":"hello saydo\n"}]}
EOF
HOPPER_FAKE_SPEC=$SPEC node $HOPPER --json run "$TID" > "$EVID/run.json" 2>&1 || true
cat "$EVID/run.json"

# (4) settle barrier:末事件应为 RunSettled final_status=review
echo "===== step RunSettled(settle barrier)====="
tail -3 "$HOPPER_VAULT/.hopper/events.jsonl" > "$EVID/events-tail.jsonl"
tail -1 "$HOPPER_VAULT/.hopper/events.jsonl" | jq '{type, final_status: .payload.final_status, runner_status: .payload.runner_status, summary_path: .payload.summary_path, evidence_digest: .payload.evidence_digest}' | tee "$EVID/runsettled.json"

# (5) review show + approve
echo "===== step review show + approve ====="
node $HOPPER --json review show "$TID" > "$EVID/review-show.json" 2>&1 || true
node $HOPPER --json review approve "$TID" --origin saydo-bridge --receipt apr_poc_demo > "$EVID/review-approve.json" 2>&1 || true
cat "$EVID/review-approve.json" | head -5

# (6) merge(S3 动作;PoC 手动触发以验证命令面)
echo "===== step merge ====="
node $HOPPER --json merge "$TID" --origin saydo-bridge --receipt apr_poc_demo > "$EVID/merge.json" 2>&1 || true
cat "$EVID/merge.json" | head -5
node $HOPPER --json status > "$EVID/status-final.json" 2>&1

# (7) hopper check 可行性(确定性验收 oracle;--staged 喂 acceptance[])
echo "===== step check(确定性验收 oracle 可行性)====="
CRIT=$(mktemp)
printf '新文件 docs/GREETING.md 存在\n文件首行包含 "hello saydo"\n' > "$CRIT"
# 在 repo 里造 staged 改动喂 check(不依赖上面的 worktree;check 在 repo 内运行,不写事件流不动工作区)
mkdir -p "$REPO/docs" && printf 'hello saydo\n' > "$REPO/docs/GREETING.md"
git -C "$REPO" add -A
( cd "$REPO" && node $HOPPER check --staged --criteria "$CRIT" --format json > "$EVID/check.json" 2>"$EVID/check.err" )
CHECK_EXIT=$?
echo "check exit=$CHECK_EXIT (0=四闸门全绿;4=needs_human)"
jq '{verification: .verification.status, guardrails_blocked: .guardrails.blocked, acceptance: (.acceptance.schema_version // "n/a")}' "$EVID/check.json" 2>/dev/null | head -20 || cat "$EVID/check.err" | head -10

echo; echo "===== PoC done. evidence in $EVID ====="
echo "POC_DONE"
