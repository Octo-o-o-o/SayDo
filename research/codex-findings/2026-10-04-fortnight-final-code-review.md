> 本文是固定 E b51c277f036d87cd2f92be2786365efdb0cb2dba 的只读 reviewer 原报告投影。原件 7208B / SHA-256 `d162d415dab9e26c9898ba0eb986f986e39d700ef3970918f6db2059342ebeee`，保存在 `$TASK/reviews/last-cross-code-34/reports/review.md`；仅对任务根、home 与私网地址作脱敏，不改 verdict、读取层级或旧失败。root 后续补门、rc 注释修复及历史补读层级见总报告的最终读回节，不追认为本 reviewer 亲证。

# Fresh 只读代码评审 #34

结论：固定候选 E `b51c277f036d87cd2f92be2786365efdb0cb2dba` 的 I12/I13/I14 当前实现，在本轮三个判断维度内为 **PASS_SCOPED**；未发现新的 P0/P1，也没有新增 P2。整任务仍为 **RED / INCOMPLETE**，因为旧 required 8 RED、过期 CTX 的 owner 选择、4 个 dual_write_gap、20 个不可恢复原字节、全历史语义覆盖和真实设备/provider 验收均未关闭。

## 候选与覆盖

- baseline：`53be7405954bbb7e2cad299cd59f5aa3ee2dad02`
- code I：`f8d74a121037b5bc5482f927b62f93771cab059e`
- fixed E：`b51c277f036d87cd2f92be2786365efdb0cb2dba`
- 独立 preflight：HEAD=E、status 0、git-diff-v1 fingerprint=`e42dd19ca752c0ee2dca966fb0e915cbc9fce9375efcd3d45a53f060692f9727`，与宿主派发值一致。
- 逐项读取 53be→E 的 50 个生产/支持 source changed hunk及必要 caller/consumer；明细在 `coverage.json`。`production-hunks.log` 为 663435B，SHA-256 `fe846b9e5e2ab236f1d83cde1a5c166a5924ac2e7da805d3765e2e506cc0c02b`。
- `source-bindings.log` 核了70个changed code输入均与 fixed E blob 一致，22600B，SHA-256 `d391ddc81d37aac9730302a38927e42f62ec238a3d192551ae80115a563f60ce`。哈希只用于候选身份，不当语义阅读。

## 三个判断维度

1. **生产写口、状态投影与资源边界：PASS_SCOPED。** Focus 写API在非共享audit sink时前置拒绝；共享SQLite sink下状态、事件与audit在同一外层immediate事务，audit异常回滚。waiting/no-op路径补了authority/epoch检查。终态、验收冲突、包mode、风险unknown、partial detail、M0未知持久化、WS/HF/PTT receipt归属、runtime child与Windows保留、offline/RF fail-closed等changed hunk未发现新的高影响反例。
2. **I12/I13/I14：PASS_SCOPED。** 自写daemon控制直接经过 `commandToEffect → computeRisk → decideCommand`；delegation写、unset、URL子节、引号拼接与`-c`均S3且零确认，普通`--get`为S0，legacy `get`、postBuffer/version为S1。系统Chrome控制挂载生产 `VoiceProvider → MobileApp → WebSocket` 链：同请求并发只产生1个turn frame；accepted不清后来编辑；rejected和实际`WebSocket.send`抛错均保留原生稿。随后真实渲染 `FocusPage`，主线null任务/义务与具名支线同时可见。该WS与API响应是自写fake，不是实际daemon、provider、Swift或真机认证。
3. **证据声明：PASS_SCOPED_WITH_RETAINED_LIMITS。** I→E只有4条既有证据/journal路径，E不自指。当前报告如实保留I上Node3865 PASS/21 SKIP、Python160、PW64；旧CI135失败；作者完整41和固定E七小门NOT_RUN。未把root或另一reviewer的后续门结果算作本人的运行。

## 独立控制与失败原件

最终独立控制：daemon 2229B/SHA `92660d954af96680091b7583bd150137aa682b3886eb62355978c1b09d7d688b`，exit0；系统Chrome 114B/SHA `a726ca308a923f282bd6ec8263825c0167f25bf34b869403c2634adffd42ace6`，exit0。两者均有事前manifest、DEVNULL stdin、PID、开始/终态、hard/idle timeout、exit、日志bytes/SHA回执。

失败原件没有删除或改写：daemon首次CJS top-level await装配失败1505B/SHA `ff8722942b26385c83d6b44e2db18de02513392724d3ab6dcfe5fa58f7383273`；jsdom缺失1784B/SHA `4887b0e92dda9119acf9619a4c55bace985d59dc029e1b22fe12931175f068df`；Playwright默认浏览器缺失1208B/SHA `fd1bc58b41308ceea67685da246adcf9ad164c785a30703d82cf34c632ab11a6`；Vite依赖装配失败313176B/SHA `8c2ce6a457d4c1836bab4b7631dd78a4c0e84de05830ba1db7d38be346f724aa`；两次React异步断言过早471B/SHA分别为`fac6a1fe4b2fc906111595bdd65b1ef6029a10223461433ee872e64fe010c6a9`和`279d1be358487fe1f4d38be3fdfd2e8b5122364b6a7d34e6ddd103c27866ae68`。这些是控制装配/等待问题，不作为产品缺陷。

## 未验边界

本 reviewer 未运行完整just ci、完整Playwright或41门，未编译Swift/XCTest，也未运行真实iOS设备、Windows、daemon网络、provider、付费CLI、部署、merge、push或cleanup。changed tests仅按其验证能力抽读；没有把测试数量、哈希或作者证据当全部实现语义通过。

## 收口校验

现役 validator 路径缺失；pinned 2.4.2 只读副本首次因其目录缺 `strict_json.py` 以 exit1 结束，499B/SHA `c711311b275002ddcb6a3e9adb7acc651ca53787884d20db4fbb4f30defc9a2d`。使用现役只读 `strict_json.py` 作为 `PYTHONPATH` 后，同一 pinned validator 返回 `status=valid`、`next_action=stop_for_owner`，165B/SHA `42fe6f01614d4ff37f9c3fec661928c3bd3507d43178a951cde77e2b90a1805a`。自写结构消费者确认嵌入manifest与独立JSON相同且50项source唯一，exit0。候选全仓及三份报告的 `scripts/check-emoji.sh` 均exit0。post fingerprint再次得到同一HEAD与fingerprint，exit0，日志164B/SHA `4e2ddfebff0d6f9c672e0f3f45ca99ff9a60d9a926dec9227e8266beb263dba1`。

## Review manifest

```review-manifest
{
  "verdict": "RED",
  "review_ordinal": 1,
  "candidate_head": "b51c277f036d87cd2f92be2786365efdb0cb2dba",
  "diff_fingerprint": "e42dd19ca752c0ee2dca966fb0e915cbc9fce9375efcd3d45a53f060692f9727",
  "review_scope": "workflow-final",
  "blockers": [
    {
      "id": "B34-RETAINED-RED",
      "severity": "P1",
      "summary": "旧 required 8 RED、CTX09/12/16 的 owner 选择、4 个 dual_write_gap 与 20 个不可恢复原字节仍未关闭。",
      "evidence": "e2e/evidence/fortnight-audit-2026-10-03.md:63",
      "in_scope": false,
      "needs_owner_decision": true,
      "acceptance_item": "A34-WHOLE-GOAL"
    },
    {
      "id": "B34-UNRUN-REALITY",
      "severity": "P1",
      "summary": "真实 Swift/iOS 设备、Windows、provider、付费 CLI 与完整41门未由本 reviewer 运行，当前控制不能认证这些环境。",
      "evidence": "e2e/evidence/fortnight-audit-2026-10-03.md:173",
      "in_scope": false,
      "needs_owner_decision": true,
      "acceptance_item": "A34-REAL-RUNTIME"
    },
    {
      "id": "B34-HISTORICAL-COVERAGE",
      "severity": "P1",
      "summary": "本轮逐项读53be到E的50个生产/支持source hunk；160文档、46 commit及既有880未读hunk的全历史语义闭包仍不成立。",
      "evidence": "e2e/evidence/fortnight-audit-2026-10-03.md:177",
      "in_scope": false,
      "needs_owner_decision": true,
      "acceptance_item": "A34-HISTORICAL-CLOSURE"
    }
  ],
  "p2_ledger_delta": [],
  "focused_gates": [
    {
      "name": "fresh-source-bindings",
      "exit_code": 0,
      "summary": "70个changed code输入与fixed E blob逐字节一致，HEAD正确且clean"
    },
    {
      "name": "fresh-daemon-command-policy-voice-gate",
      "exit_code": 0,
      "summary": "10例delegation与普通对照沿生产分类器、策略和语音门符合预期"
    },
    {
      "name": "fresh-system-chrome-mobile-focus",
      "exit_code": 0,
      "summary": "生产移动提交链和Focus页面浏览器控制通过；fake WS不冒真实daemon/provider/native"
    }
  ],
  "stop_reason": "current I12/I13/I14 implementation has no new blocking defect in reviewed scope; whole goal remains incomplete on retained RED, owner decisions, unrecovered bytes, historical coverage, and real-runtime acceptance"
}
```
