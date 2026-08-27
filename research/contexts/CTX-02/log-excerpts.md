# 日志摘录

所有时间为 UTC。

```text
01:44:16 auth.refresh cache_miss keyset=v18 latency_ms=1820 outcome=timeout
01:47:03 auth.refresh cache_miss keyset=v18 latency_ms=1944 outcome=timeout
02:01:58 deploy rollback release=2026.08.12.1 status=applied
02:12:09 auth.refresh cache_hit keyset=v18 latency_ms=12 outcome=ok
02:18:22 service.slo login_success_rate=0.997 window=5m
```

日志只保留了代表性行，不能用来精确重算总失败数。
