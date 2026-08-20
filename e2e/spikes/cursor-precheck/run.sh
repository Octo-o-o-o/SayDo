#!/bin/bash
# 4.0 selected-adapter 脚本级预检(dev=cursor_cli):版本断言 + 钩子门 deny 复跑(fail-closed 仍生效)。
# 全链复验(真实审批闭环)= 4.1 出口验收项,不在本步。用法:bash run.sh
set -u
SPIKE_DIR="$(cd "$(dirname "$0")" && pwd)"
WT=/tmp/saydo-precheck
MODEL="${SPIKE_MODEL:-claude-fable-5-max}"
echo "== 版本/登录断言 =="
cursor-agent status 2>&1 | head -3 || { echo "NOT_LOGGED_IN"; exit 1; }
rm -rf "$WT" && mkdir -p "$WT/.cursor/hooks" && (cd "$WT" && git init -q); echo wt > "$WT/README.md"
sed 's#/tmp/saydo-cli-hook#/tmp/saydo-precheck#g' "$SPIKE_DIR/hooks/gate.sh" > "$WT/.cursor/hooks/gate.sh"
chmod +x "$WT/.cursor/hooks/gate.sh"
cat > "$WT/.cursor/hooks.json" <<JSON
{ "version": 1, "hooks": { "beforeShellExecution": [ { "command": "$WT/.cursor/hooks/gate.sh", "failClosed": true, "timeout": 90 } ] } }
JSON
echo "== deny 拦截(决策信箱缺省=deny;冷启动偶发无工具调用->重试至多 2 次)=="
pass=n
for attempt in 1 2 3; do
  rm -f "$WT"/{GATED.txt,hook-fired.log,decision}
  timeout 120 cursor-agent -p --force --trust --model "$MODEL" "请用 shell 工具执行:touch $WT/GATED.txt。执行后报告。" >/dev/null 2>&1
  if [ -f "$WT/hook-fired.log" ] && [ ! -f "$WT/GATED.txt" ]; then pass=y; break; fi
  echo "  attempt $attempt: hook 未触发(冷启动无工具调用),重试"
done
if [ "$pass" = "y" ]; then
  echo "PRECHECK_PASS: 钩子触发且 deny 拦住(--force 下 deny 仍生效)"
else
  echo "PRECHECK_FAIL: 连续 3 次 hook 未触发 —— 后端不符,上浮 owner(计划 4.0 风险表)"
fi
