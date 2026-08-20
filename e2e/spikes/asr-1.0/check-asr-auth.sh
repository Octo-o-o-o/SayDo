#!/usr/bin/env bash
# 火山 ASR 鉴权/资源授权体检(1.0 spike 辅助;不打印任何 key 值)。
# 鉴权优先级:VOLC_APP_ID + VOLC_ACCESS_TOKEN(经典三元组,X-Api-App-Key/X-Api-Access-Key)
#          > VOLC_API_KEY > DOUBAO_TTS_API_KEY(新版单 key,X-Api-Key)。
# 用法:bash e2e/spikes/asr-1.0/check-asr-auth.sh
set -u

ENV_FILE="$HOME/.saydo/.env"
val() { sed -n "s/^$1=//p" "$ENV_FILE" | head -1 | sed 's/#.*//' | tr -d ' \t\r'; }

APP_ID=$(val VOLC_APP_ID)
ACCESS_TOKEN=$(val VOLC_ACCESS_TOKEN)
API_KEY=$(val VOLC_API_KEY)
[ -z "$API_KEY" ] && API_KEY=$(val DOUBAO_TTS_API_KEY)

AUTH_ARGS=()
if [ -n "$APP_ID" ] && [ -n "$ACCESS_TOKEN" ]; then
  echo "[auth] 经典三元组(APP ID len=${#APP_ID}, Access Token len=${#ACCESS_TOKEN})"
  AUTH_ARGS=(-H "X-Api-App-Key: $APP_ID" -H "X-Api-Access-Key: $ACCESS_TOKEN")
elif [ -n "$API_KEY" ]; then
  echo "[auth] 单 API Key(len=${#API_KEY})"
  AUTH_ARGS=(-H "X-Api-Key: $API_KEY")
else
  echo "[fail] .env 里没有可用凭证(VOLC_APP_ID+VOLC_ACCESS_TOKEN 或 VOLC_API_KEY)"; exit 1
fi

overall=0

# 1) 录音文件识别 submit(HTTP,快速判资源授权;空音频占位,只看鉴权/授权码)
for RID in volc.bigasr.auc volc.seedasr.auc; do
  code=$(curl -sS -o /dev/null -m 15 -X POST "https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit" \
    "${AUTH_ARGS[@]}" -H "X-Api-Resource-Id: $RID" -H "X-Api-Request-Id: $(uuidgen)" -H "X-Api-Sequence: -1" \
    -H "Content-Type: application/json" \
    -d '{"user":{"uid":"saydo-check"},"audio":{"format":"mp3","data":""},"request":{"model_name":"bigmodel"}}' \
    -D- 2>/dev/null | sed -n 's/^x-api-status-code: //Ip' | tr -d '\r')
  case "$code" in
    20000000|45000001|45000002|45000151) echo "[ok]   auc $RID 资源已授权(status=$code)";;
    45000030) echo "[fail] auc $RID 资源未授权(45000030 not granted)"; overall=1;;
    "") echo "[warn] auc $RID 无状态码返回(网络/鉴权头被拒)"; overall=1;;
    *) echo "[warn] auc $RID status=$code(非授权类错误,资源大概率已通)";;
  esac
done

# 2) 流式 sauc 握手探测(HTTP Upgrade;403=资源未授权,101/400 类=鉴权已过)
http=$(curl -sS -o /tmp/sauc-check-body.txt -w "%{http_code}" -m 15 \
  "https://openspeech.bytedance.com/api/v3/sauc/bigmodel" \
  -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  "${AUTH_ARGS[@]}" -H "X-Api-Resource-Id: volc.bigasr.sauc.duration" -H "X-Api-Request-Id: $(uuidgen)" 2>/dev/null)
case "$http" in
  101) echo "[ok]   sauc 流式握手通过(101 Switching Protocols)";;
  403) echo "[fail] sauc 403:$(cat /tmp/sauc-check-body.txt)"; overall=1;;
  *) echo "[warn] sauc http=$http body=$(head -c 120 /tmp/sauc-check-body.txt)";;
esac

if [ "$overall" = "0" ]; then
  echo "[PASS] ASR 鉴权与资源授权就绪,可跑 1.0 定档"
else
  echo "[BLOCKED] 仍有资源未授权:确认凭证来自开通了 ASR 资源的那个账号/应用"
fi
exit $overall
