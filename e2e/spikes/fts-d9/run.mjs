// 07 D9 分词 spike:trigram 对中文领域语料的召回实测(语料两批,计划 2.2/2.3)。
// 第一批 = 本仓 docs/(设计文档);第二批 = 奠基现役视图(<workspace>/.saydo/knowledge/current,2.3 后补测)。
// 按空行切段入 FTS5(trigram);查询集 = 领域术语 -> 预期来源文档;指标 = hit@5。
// 附 2 字词专项:trigram 需 >=3 字符,2 字中文词预期 0 命中(验证已知限制)。
// 用法:node run.mjs [docsDir] [batch1|batch2]

import { createRequire } from "node:module";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const require2 = createRequire(join(here, "../../../packages/daemon/package.json"));
const Database = require2("better-sqlite3");

const batch = process.argv[3] ?? "batch1";
const requestedDocsDir = process.argv[2] ?? join(here, "../../../docs");
const currentDir = join(requestedDocsDir, "current");
const docsDir = batch === "batch2" && existsSync(currentDir) ? currentDir : requestedDocsDir;

// 第二批查询集(奠基产物:core/inventory/build-test-run/conventions;字面已核实存在)
// 发现(第一轮 batch2 教训):奠基产物是短行结构化文档,标题段常 <30 字符 => 段长阈值须按批次适配
const QUERIES_BATCH2 = [
  ["语言主体", ["core"]],
  ["知识底座", ["core"]],
  ["文档指针", ["core"]],
  ["关键文件", ["inventory", "core"]],
  ["跳过清单", ["inventory"]],
  ["语言分布", ["inventory", "core"]],
  ["typecheck", ["build-test-run", "conventions"]],
  ["justfile", ["build-test-run", "inventory", "conventions"]],
  ["单仓协作约定", ["conventions"]],
  ["TypeScript", ["core", "inventory", "conventions"]],
  ["机械抽取", ["build-test-run", "core"]],
  ["未运行验证", ["build-test-run", "core"]]
];

// 第一批查询集:词 -> 预期文档前缀(命中任一即对);取自各文档核心术语
const QUERIES_BATCH1 = [
  ["记忆四层", ["06", "04"]],
  ["审批收据", ["09", "04"]],
  ["状态转换", ["09"]],
  ["验收标准", ["02", "05", "08", "09"]],
  ["唤醒词", ["02", "07", "10", "04", "05"]],
  ["沉思档", ["07", "08"]],
  ["直达验收", ["02", "04", "06"]],
  ["决策包", ["04", "09", "02"]],
  ["语音前脑", ["01", "03", "02"]],
  ["否定不复活", ["09", "04", "modules/b"]],
  ["同输入同", ["09", "modules/b"]],
  ["逐步确认", ["02", "04", "06", "10"]],
  ["上下文编译", ["08", "09", "modules/b"]],
  ["删除传播", ["05", "08", "modules/b"]],
  ["降级链", ["07", "05", "03", "modules/b"]],
  ["同意传播", ["05"]],
  ["热词偏置", ["07", "04"]],
  ["产物库", ["08", "modules/b"]],
  ["审计事件", ["09", "04"]],
  ["逐条验收", ["09", "01"]]
];
const QUERIES = batch === "batch2" ? QUERIES_BATCH2 : QUERIES_BATCH1;
// 2 字词专项:trigram 需 >=3 字符 => 2 字中文词预期 0 命中(已知限制;"幂等"存在于 11 个文件仍查不到)
const TWO_CHAR = ["幂等", "记忆", "审批", "热词"];

const db = new Database(":memory:");
db.exec("CREATE VIRTUAL TABLE p USING fts5(doc UNINDEXED, para, tokenize='trigram')");

const files = [];
for (const f of readdirSync(docsDir)) if (f.endsWith(".md")) files.push(f);
const modulesDir = join(docsDir, "modules");
if (existsSync(modulesDir)) {
  for (const f of readdirSync(modulesDir)) if (f.endsWith(".md")) files.push(`modules/${f}`);
}

const ins = db.prepare("INSERT INTO p(doc, para) VALUES (?, ?)");
// 段长阈值:设计文档(长段落)30;奠基产物(短行结构化,标题段常 <10 字符)5
const minLen = batch === "batch2" ? 5 : 30;
let paras = 0;
for (const f of files) {
  const text = readFileSync(join(docsDir, f), "utf8");
  for (const seg of text.split(/\n\s*\n/)) {
    const s = seg.trim();
    if (s.length < minLen) continue;
    ins.run(f, s);
    paras += 1;
  }
}

const top5 = db.prepare("SELECT doc FROM p WHERE p MATCH ? ORDER BY bm25(p) LIMIT 5");
const results = [];
let hits = 0;
for (const [q, expected] of QUERIES) {
  const rows = top5.all(`"${q}"`).map((r) => r.doc);
  const hit = rows.some((doc) => expected.some((e) => doc.startsWith(e)));
  if (hit) hits += 1;
  results.push({ query: q, hit, top5: rows });
}

const twoChar = [];
for (const q of TWO_CHAR) {
  const rows = top5.all(`"${q}"`).map((r) => r.doc);
  twoChar.push({ query: q, matched: rows.length });
}

const summary = {
  docsDir,
  files: files.length,
  paras,
  queries: QUERIES.length,
  hitAt5: hits,
  hitRate: Number((hits / QUERIES.length).toFixed(3)),
  twoCharKnownLimit: twoChar,
  misses: results.filter((r) => !r.hit)
};
const outName = batch === "batch2" ? "spike-output-batch2.json" : "spike-output.json";
writeFileSync(join(here, outName), JSON.stringify({ summary, results }, null, 2));
console.log("D9_SPIKE_DONE", batch, JSON.stringify(summary.hitRate), "hits", hits, "/", QUERIES.length);
