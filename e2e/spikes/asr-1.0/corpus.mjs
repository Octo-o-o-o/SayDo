// 1.0 ASR spike 种子语料(计划 1.0:50-100 条中英混说,AI 自决自建;
// 完整 300-500 条推迟到 dogfood 用真实误听积累)。
// 构成:repo 术语混说 / 通用编码术语 / 数字与预算 / CLI flag 与路径 / 纯中文基线。
// terms = 打分时的术语命中检查集(英文术语精确匹配,大小写不敏感)。

export const CORPUS = [
  // --- A. SayDo/Hopper repo 术语混说(20) ---
  { id: "a01", text: "帮我把 packages 底下 contracts 包的 digest 测试跑一遍", terms: ["contracts", "digest"] },
  { id: "a02", text: "这个任务卡的 ready for review 状态还没到,先别叫我", terms: ["ready for review"] },
  { id: "a03", text: "把 worktree 里的改动提交到 feature 分支", terms: ["worktree", "feature"] },
  { id: "a04", text: "用 pnpm install 装一下依赖,别用 npm", terms: ["pnpm install", "npm"] },
  { id: "a05", text: "daemon 的 health 接口返回二百就算正常", terms: ["daemon", "health"] },
  { id: "a06", text: "把 DDL 里的 CHECK 约束补上 auth strength 的词表", terms: ["DDL", "CHECK", "auth strength"] },
  { id: "a07", text: "EffectGrant 的 spokenForm 必须由模板渲染,不能自由造句", terms: ["EffectGrant", "spokenForm"] },
  { id: "a08", text: "跑一下 vitest,看看 storage 那几个测试红不红", terms: ["vitest", "storage"] },
  { id: "a09", text: "Hopper 的 events 点 jsonl 要按 byte cursor 断点续读", terms: ["Hopper", "jsonl", "byte cursor"] },
  { id: "a10", text: "把 tier1 runs 表的 attempt 加一,别动旧行", terms: ["tier1", "attempt"] },
  { id: "a11", text: "zod 的 schema 校验挂了,看看是不是 strictObject 的问题", terms: ["zod", "schema", "strictObject"] },
  { id: "a12", text: "outbox 的 dedupe key 是四段拼接,别漏 revision", terms: ["outbox", "dedupe key", "revision"] },
  { id: "a13", text: "settle barrier 没过就不许回叫,proof 缺一不叫", terms: ["settle barrier", "proof"] },
  { id: "a14", text: "把 RunSettled 事件的 evidence digest 存成不透明字符串", terms: ["RunSettled", "evidence digest"] },
  { id: "a15", text: "cursor agent 的 hooks 要写进点 cursor 目录", terms: ["cursor agent", "hooks"] },
  { id: "a16", text: "canUseTool 回调阻塞的时候,超时就按 deny 处理", terms: ["canUseTool", "deny"] },
  { id: "a17", text: "renderSpoken 模板里 downstream triggers 必须念出来", terms: ["renderSpoken", "downstream triggers"] },
  { id: "a18", text: "把 memory events 表重放一遍,验证 forget hard 的幂等", terms: ["memory events", "forget hard"] },
  { id: "a19", text: "SQLite 开 WAL 模式,synchronous 设成 FULL", terms: ["SQLite", "WAL", "synchronous", "FULL"] },
  { id: "a20", text: "Gate 0 没关的话 dispatch 一律拒绝,没有 bypass", terms: ["Gate 0", "dispatch", "bypass"] },

  // --- B. 通用编码术语(15) ---
  { id: "b01", text: "先 git status 看一下,再决定要不要 stash", terms: ["git status", "stash"] },
  { id: "b02", text: "把这个函数重构成 async await 的写法", terms: ["async await"] },
  { id: "b03", text: "CI 红了,看看是 lint 还是 typecheck 挂了", terms: ["CI", "lint", "typecheck"] },
  { id: "b04", text: "这个 API 返回 404,是不是路由没注册", terms: ["API", "404"] },
  { id: "b05", text: "用 docker compose 把 postgres 起起来", terms: ["docker compose", "postgres"] },
  { id: "b06", text: "把 package 点 json 里的 scripts 加一个 build 命令", terms: ["package", "json", "scripts", "build"] },
  { id: "b07", text: "这段代码有 race condition,加个锁或者用队列", terms: ["race condition"] },
  { id: "b08", text: "把 main 分支 rebase 到最新,解决冲突再 push", terms: ["main", "rebase", "push"] },
  { id: "b09", text: "环境变量放 dotenv 里,别硬编码进代码", terms: ["dotenv"] },
  { id: "b10", text: "这个接口要加 rate limit,一分钟最多六十次", terms: ["rate limit"] },
  { id: "b11", text: "WebSocket 断线要自动重连,带指数退避", terms: ["WebSocket"] },
  { id: "b12", text: "把 TypeScript 的 strict 模式打开,补上类型标注", terms: ["TypeScript", "strict"] },
  { id: "b13", text: "日志用 JSONL 格式,一行一条方便 grep", terms: ["JSONL", "grep"] },
  { id: "b14", text: "内存泄漏了,用 heap snapshot 对比一下", terms: ["heap snapshot"] },
  { id: "b15", text: "这个 SQL 要加索引,不然全表扫描太慢", terms: ["SQL"] },

  // --- C. 数字/预算/时间(10) ---
  { id: "c01", text: "预算封顶二十块钱,超了就熔断", terms: [] },
  { id: "c02", text: "墙钟上限设四十五分钟,停靠期停表", terms: [] },
  { id: "c03", text: "超时时间改成一百二十秒,重试一次", terms: [] },
  { id: "c04", text: "端口用四七一零零,别跟 vite 的冲突", terms: ["vite"] },
  { id: "c05", text: "保留期三十天,到期整份删除", terms: [] },
  { id: "c06", text: "采样率二十四 k,比特率一百六十", terms: [] },
  { id: "c07", text: "这个月已经花了一百八十六块五,快到预算了", terms: [] },
  { id: "c08", text: "测试跑了十二个,全过,零失败", terms: [] },
  { id: "c09", text: "第三步跑完了,继续第四步吗", terms: [] },
  { id: "c10", text: "停靠七十二小时没人管就自动取消", terms: [] },

  // --- D. CLI flag 与路径(10) ---
  { id: "d01", text: "加上 dash dash force 和 dash dash trust 两个参数", terms: [] },
  { id: "d02", text: "跑 hopper lint 带 json 输出,查 classification 字段", terms: ["hopper lint", "json", "classification"] },
  { id: "d03", text: "配置在波浪线点 saydo 目录下的 config 点 toml", terms: ["saydo", "config", "toml"] },
  { id: "d04", text: "git push origin main 被钩子拦了,看下 gate 日志", terms: ["git push origin main", "gate"] },
  { id: "d05", text: "npm install 加 no audit 和 no fund,快一点", terms: ["npm install", "no audit", "no fund"] },
  { id: "d06", text: "把 dist 目录清了重新 build,产物校验六项", terms: ["dist", "build"] },
  { id: "d07", text: "用 rg 搜 TODO,排除 node modules 目录", terms: ["rg", "TODO", "node modules"] },
  { id: "d08", text: "chmod 加 x 给 run 点 sh,然后直接执行", terms: ["chmod", "run", "sh"] },
  { id: "d09", text: "curl 一下 localhost 四七一零零的 health", terms: ["curl", "localhost", "health"] },
  { id: "d10", text: "tail 最后三行 events 点 jsonl,用 jq 解析 type", terms: ["tail", "events", "jsonl", "jq", "type"] },

  // --- E. 纯中文口语基线(5) ---
  { id: "e01", text: "这个方案我觉得可以,就按你说的做吧", terms: [] },
  { id: "e02", text: "等一下,刚才那个决定先不算,我再想想", terms: [] },
  { id: "e03", text: "做完记得叫我,我先去开个会", terms: [] },
  { id: "e04", text: "预览的效果不太对,标题应该更大一点", terms: [] },
  { id: "e05", text: "行,一口气跑完,别每步都问我", terms: [] }
];
