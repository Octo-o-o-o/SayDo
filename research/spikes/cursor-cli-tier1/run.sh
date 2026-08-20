#!/bin/bash
# Spike 8 CLI 变体复现:验证 cursor-agent CLI(订阅态)+ .cursor/hooks.json 审批门。
# 前提:cursor-agent status 已登录;jq 已装。用法:bash run.sh
set -u
SPIKE_DIR="$(cd "$(dirname "$0")" && pwd)"   # 先解析脚本目录(cd 前),否则 cd 后相对路径失效
WT=/tmp/saydo-cli-hook
MODEL="${SPIKE_MODEL:-claude-fable-5-max}"
rm -rf "$WT" && mkdir -p "$WT/.cursor/hooks" && cd "$WT" && git init -q 2>/dev/null; echo wt > README.md
cp "$SPIKE_DIR/hooks.json" "$WT/.cursor/hooks.json"
cp "$SPIKE_DIR/hooks/gate.sh" "$WT/.cursor/hooks/gate.sh"
chmod +x "$WT/.cursor/hooks/gate.sh"

pass=0; fail=0
say(){ echo; echo "===== $1 ====="; }

# A: deny 拦截
say "A · deny 拦截"
rm -f "$WT"/{PWNED_A.txt,hook-fired.log,decision,wait.log}
cursor-agent -p --force --trust --model "$MODEL" "请用 shell 工具执行:touch $WT/PWNED_A.txt。执行后报告。" >/dev/null 2>&1
if [ -f "$WT/hook-fired.log" ] && [ ! -f "$WT/PWNED_A.txt" ]; then echo "[ok] A PASS(钩子触发且 deny 拦住)"; pass=$((pass+1)); else echo "[fail] A FAIL"; fail=$((fail+1)); fi

# B: allow 放行
say "B · allow 放行"
rm -f "$WT"/{notes_b.txt,hook-fired.log,wait.log}; echo allow > "$WT/decision"
cursor-agent -p --force --trust --model "$MODEL" "请用 shell 工具执行:touch $WT/notes_b.txt。执行后报告。" >/dev/null 2>&1
if [ -f "$WT/notes_b.txt" ]; then echo "[ok] B PASS(allow 放行)"; pass=$((pass+1)); else echo "[fail] B FAIL"; fail=$((fail+1)); fi
rm -f "$WT/decision"

# C: 阻塞等待(daemon 延迟批准)
say "C · 阻塞等待 4s 后批准"
rm -f "$WT"/{notes_c.txt,hook-fired.log,wait.log,decision}
( for i in $(seq 1 300); do [ -f "$WT/hook-fired.log" ] && break; sleep 0.2; done; sleep 3; echo allow > "$WT/decision" ) &
# 约束单命令:开放式 prompt 会让 agent 跑额外探索命令(每条都被正确门控,但干扰本测判定)
cursor-agent -p --force --trust --model "$MODEL" "只做一件事:用 shell 执行 touch $WT/notes_c.txt,然后回复 done。不要执行任何其它命令。" >/dev/null 2>&1
wait
if [ -f "$WT/notes_c.txt" ]; then echo "[ok] C PASS(阻塞等待后放行)· $(cat "$WT/wait.log" 2>/dev/null)"; pass=$((pass+1)); else echo "[fail] C FAIL"; fail=$((fail+1)); fi

echo; echo "===== 汇总:PASS=$pass FAIL=$fail ====="
[ "$fail" -eq 0 ]
