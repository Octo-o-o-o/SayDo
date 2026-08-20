#!/bin/bash
# SayDo Tier1 审批门原型(CLI 版,阻塞轮询):钩子同步挂起等 daemon 决策(模拟=轮询决策文件),
# fail-closed:超时/无决策/畸形一律 deny;jq 构造 JSON 防 fail-open。
FIRED=/tmp/saydo-cli-hook/hook-fired.log
DECISION=/tmp/saydo-cli-hook/decision
WAITLOG=/tmp/saydo-cli-hook/wait.log
input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.command // empty' 2>/dev/null)
printf '%s\n' "$(jq -nc --arg c "$cmd" --arg ts "$(date +%s)" '{ts:$ts,cmd:$c}')" >> "$FIRED"

# 阻塞等决策(最多 ~100s,留 timeout=120 余量);模拟 daemon 把审批请求推给用户、等语音/屏幕回答
decision=""
for i in $(seq 1 500); do
  if [ -f "$DECISION" ]; then decision=$(cat "$DECISION"); break; fi
  sleep 0.2
done
echo "waited_iters=$i decision=${decision:-<timeout>}" >> "$WAITLOG"

if [ "$decision" = "allow" ]; then
  jq -nc '{permission:"allow"}'
else
  jq -nc --arg c "$cmd" '{permission:"deny", agent_message:("SayDo gate denied/timeout: "+$c)}'
fi
exit 0
