#!/bin/bash
# 4.0 预检审批门(cursor_cli;复用 spike 8 已验证形态):fail-closed——超时/无决策/畸形一律 deny,
# jq 构造 JSON 防 fail-open;每条命令独立读决策(禁便车)。
FIRED=/tmp/saydo-precheck/hook-fired.log
DECISION=/tmp/saydo-precheck/decision
input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.command // empty' 2>/dev/null)
printf '%s\n' "$(jq -nc --arg c "$cmd" --arg ts "$(date +%s)" '{ts:$ts,cmd:$c}')" >> "$FIRED"
decision=""
for _ in $(seq 1 300); do
  if [ -f "$DECISION" ]; then decision=$(cat "$DECISION"); break; fi
  sleep 0.2
done
if [ "$decision" = "allow" ]; then jq -nc '{permission:"allow"}'; else jq -nc --arg c "$cmd" '{permission:"deny", agent_message:("SayDo precheck gate denied/timeout: "+$c)}'; fi
exit 0
