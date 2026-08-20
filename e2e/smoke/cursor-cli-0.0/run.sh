#!/bin/bash
# 0.0 Tier1 执行后端冒烟(cursor_cli,dev 机缺省)—— 计划 0.0(a) 补验项:
#   T1 真实多步任务里 setup(npm install)/push(git push) 的 beforeShellExecution 钩子覆盖面(allow 模式)
#   T2 push 在 deny 下被拦(本地 bare remote,无外部副作用)
#   T3 create-chat + --resume 续会话上下文保持
# 钩子门 deny/放行/阻塞三测已由 spike 通过(research/spikes/cursor-cli-tier1),不重跑充数。
# 前提:cursor-agent 已登录订阅态;jq 已装。产出:$BASE/ 下 hook-fired.log 等证据 + 本脚本 stdout 汇总。
set -u
BASE="${SMOKE_BASE:-/tmp/saydo-p00-smoke}"
WT="$BASE/wt"
REMOTE="$BASE/remote.git"
MODEL="${SMOKE_MODEL:-claude-fable-5-max}"
rm -rf "$BASE" && mkdir -p "$WT/.cursor/hooks"

git init -q --bare "$REMOTE"
cd "$WT" && git init -q -b main
printf '{"name":"p00-smoke","version":"1.0.0","private":true,"scripts":{"test":"exit 0"}}\n' > package.json
git add -A && git -c user.email=t@t -c user.name=t commit -qm init
git remote add origin "$REMOTE"

cat > .cursor/hooks.json <<EOF
{
  "version": 1,
  "hooks": {
    "beforeShellExecution": [
      { "command": "$WT/.cursor/hooks/gate.sh", "failClosed": true, "timeout": 120 }
    ]
  }
}
EOF
cat > .cursor/hooks/gate.sh <<EOF
#!/bin/bash
# fail-closed 审批门(冒烟版):记录触发 + 轮询决策文件;非 allow 一律 deny;JSON 恒用 jq。
FIRED="$BASE/hook-fired.log"
DECISION="$BASE/decision"
input=\$(cat)
cmd=\$(printf '%s' "\$input" | jq -r '.command // empty' 2>/dev/null)
printf '%s\n' "\$(jq -nc --arg c "\$cmd" --arg ts "\$(date +%s)" '{ts:\$ts,cmd:\$c}')" >> "\$FIRED"
decision=""
for i in \$(seq 1 500); do
  [ -f "\$DECISION" ] && { decision=\$(cat "\$DECISION"); break; }
  sleep 0.2
done
if [ "\$decision" = "allow" ]; then
  jq -nc '{permission:"allow"}'
else
  jq -nc --arg c "\$cmd" '{permission:"deny", agent_message:("SayDo gate denied/timeout: "+\$c)}'
fi
exit 0
EOF
chmod +x .cursor/hooks/gate.sh

pass=0; fail=0
mark(){ if [ "$1" = ok ]; then echo "[PASS] $2"; pass=$((pass+1)); else echo "[FAIL] $2"; fail=$((fail+1)); fi }

echo "===== T1 setup/push 钩子覆盖(allow)====="
echo allow > "$BASE/decision"
cursor-agent -p --force --trust --model "$MODEL" \
  "依次执行两条 shell 命令:1) npm install --no-audit --no-fund  2) git push origin main。执行完简短报告每条的退出码。不要执行任何其它命令。" \
  > "$BASE/t1-out.txt" 2>&1
if rg -q 'npm install' "$BASE/hook-fired.log" 2>/dev/null; then mark ok "T1a npm install 触发钩子"; else mark bad "T1a npm install 未触发钩子"; fi
if rg -q 'git push' "$BASE/hook-fired.log" 2>/dev/null; then mark ok "T1b git push 触发钩子"; else mark bad "T1b git push 未触发钩子"; fi
if git -C "$REMOTE" rev-parse main >/dev/null 2>&1; then mark ok "T1c push 实际落到本地 remote"; else mark bad "T1c remote 未收到 push"; fi

echo "===== T2 push deny 拦截 ====="
echo "t2" >> README.md 2>/dev/null || echo "t2" > README.md
git add -A && git -c user.email=t@t -c user.name=t commit -qm t2
before=$(git -C "$REMOTE" rev-parse main 2>/dev/null || echo none)
echo deny > "$BASE/decision"
cursor-agent -p --force --trust --model "$MODEL" \
  "只做一件事:用 shell 执行 git push origin main,然后报告结果。不要执行任何其它命令。" \
  > "$BASE/t2-out.txt" 2>&1
after=$(git -C "$REMOTE" rev-parse main 2>/dev/null || echo none)
if [ "$before" = "$after" ]; then mark ok "T2 deny 下 remote head 未变"; else mark bad "T2 deny 未拦住 push"; fi

echo "===== T3 create-chat + --resume 续会话 ====="
echo allow > "$BASE/decision"
CHAT_ID=$(cursor-agent create-chat 2>/dev/null | tail -1 | tr -d '[:space:]')
echo "chat_id=$CHAT_ID" | tee "$BASE/t3-chatid.txt"
if [ -n "$CHAT_ID" ]; then
  cursor-agent -p --force --trust --model "$MODEL" --resume "$CHAT_ID" \
    "记住这个暗号:mango-42。只回复 ok,不要执行任何命令。" > "$BASE/t3a-out.txt" 2>&1
  cursor-agent -p --force --trust --model "$MODEL" --resume "$CHAT_ID" \
    "我上一轮让你记住的暗号是什么?只回复暗号本身,不要执行任何命令。" > "$BASE/t3b-out.txt" 2>&1
  if rg -q 'mango-42' "$BASE/t3b-out.txt"; then mark ok "T3 resume 恢复上下文(暗号复述成功)"; else mark bad "T3 resume 未恢复上下文"; fi
else
  mark bad "T3 create-chat 未返回 chatId"
fi

echo "===== SMOKE SUMMARY pass=$pass fail=$fail ====="
echo "SMOKE_DONE"
[ "$fail" -eq 0 ]
