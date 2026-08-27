#!/usr/bin/env node
import { createHash } from "node:crypto";
import {
  cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const corpusDir = dirname(fileURLToPath(import.meta.url));

function listFiles(root) {
  const result = [];
  const visit = (current) => {
    for (const name of readdirSync(current).sort()) {
      const target = join(current, name);
      if (statSync(target).isDirectory()) visit(target);
      else result.push(target);
    }
  };
  visit(root);
  return result;
}

function formalTreeDigest(root) {
  const hash = createHash("sha256");
  for (const subtree of ["questions", "contexts", "contracts"]) {
    const subtreeRoot = join(root, subtree);
    for (const file of listFiles(subtreeRoot)) {
      hash.update(relative(root, file));
      hash.update("\0");
      hash.update(readFileSync(file));
      hash.update("\0");
    }
  }
  hash.update("04-live-source-contracts.md\0");
  hash.update(readFileSync(join(root, "04-live-source-contracts.md")));
  hash.update("\0");
  return hash.digest("hex");
}

function replaceExactlyOnce(file, before, after) {
  const source = readFileSync(file, "utf8");
  const first = source.indexOf(before);
  if (first < 0 || source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`${file} 未唯一命中 mutation 片段:${before}`);
  }
  writeFileSync(file, `${source.slice(0, first)}${after}${source.slice(first + before.length)}`);
}

function questionFile(root, id) {
  const matches = readdirSync(join(root, "questions"))
    .filter((name) => name.endsWith(".md"))
    .filter((name) => readFileSync(join(root, "questions", name), "utf8").includes(`| ${id} |`));
  if (matches.length !== 1) throw new Error(`${id} 未唯一定位到问题文件`);
  return join(root, "questions", matches[0]);
}

function replaceInQuestionRow(root, id, before, after) {
  const file = questionFile(root, id);
  const lines = readFileSync(file, "utf8").split("\n");
  const indexes = lines.map((line, index) => line.startsWith(`| ${id} |`) ? index : -1).filter((index) => index >= 0);
  if (indexes.length !== 1) throw new Error(`${id} 未唯一命中问题行`);
  const index = indexes[0];
  const first = lines[index].indexOf(before);
  if (first < 0 || lines[index].indexOf(before, first + before.length) >= 0) {
    throw new Error(`${id} 问题行未唯一命中 mutation 片段:${before}`);
  }
  lines[index] = `${lines[index].slice(0, first)}${after}${lines[index].slice(first + before.length)}`;
  writeFileSync(file, lines.join("\n"));
}

function transformQuestionRow(root, id, transform) {
  const file = questionFile(root, id);
  const lines = readFileSync(file, "utf8").split("\n");
  const indexes = lines.map((line, index) => line.startsWith(`| ${id} |`) ? index : -1).filter((index) => index >= 0);
  if (indexes.length !== 1) throw new Error(`${id} 未唯一命中问题行`);
  const index = indexes[0];
  const changed = transform(lines[index]);
  if (changed === lines[index]) throw new Error(`${id} mutation 未改变问题行`);
  lines[index] = changed;
  writeFileSync(file, lines.join("\n"));
}

function mutateLiveContract(root, id, mutate) {
  const file = join(root, "contracts", "live", `${id.slice(0, 3)}.json`);
  const registry = JSON.parse(readFileSync(file, "utf8"));
  const matches = registry.contracts.filter((contract) => contract.id === id);
  if (matches.length !== 1) throw new Error(`${id} 未唯一命中 LIVE 合同源`);
  mutate(matches[0], registry);
  writeFileSync(file, `${JSON.stringify(registry, null, 2)}\n`);
}

function deleteLiveContract(root, id) {
  const file = join(root, "contracts", "live", `${id.slice(0, 3)}.json`);
  const registry = JSON.parse(readFileSync(file, "utf8"));
  const before = registry.contracts.length;
  registry.contracts = registry.contracts.filter((contract) => contract.id !== id);
  if (registry.contracts.length !== before - 1) throw new Error(`${id} 未唯一删除 LIVE 合同源`);
  writeFileSync(file, `${JSON.stringify(registry, null, 2)}\n`);
}

const sensitiveRiskIds = [
  "ENG-064", "ENG-091", "ENG-101", "PRJ-025", "PRJ-037", "PRJ-062", "PRJ-069",
  "WRT-033", "RES-004", "RES-008", "RES-022", "RES-030", "RES-035", "RES-043",
  "OPS-003", "OPS-006", "OPS-025", "OPS-031", "OPS-045", "OPS-047", "MKT-027",
  "MKT-032", "MKT-038", "DAT-008", "DAT-011", "DAT-019", "SAL-030", "FAM-008"
];
const professionalBoundaryIds = [
  "OPS-004", "DAT-005", "DAT-021", "RES-020", "RES-042", "MKT-034", "SAL-027", "LIF-018"
];
const f4DIds = [
  "ENG-120", "PRJ-068", "WRT-065", "RES-059", "OPS-053", "SAL-043",
  "MKT-043", "DAT-035", "LIF-029", "CAR-020", "FAM-020"
];

const scenarios = [
  {
    name: "删除任一 LIVE 合同",
    mutate(root) {
      deleteLiveContract(root, "OPS-051");
    },
    expect: /LIVE 题目与逐对象合同源集合不全等/u
  },
  {
    name: "泛化任一 LIVE 合同",
    mutate(root) {
      mutateLiveContract(root, "OPS-051", (contract) => {
        contract.sources[0].source_kind = "generic_fallback";
      });
    },
    expect: /OPS-051 LIVE 对象来源命中 generic fallback/u
  },
  {
    name: "LIVE 对象 reader 错配",
    mutate(root) {
      mutateLiveContract(root, "SAL-002", (contract) => {
        const source = contract.sources.find((candidate) => candidate.source_kind === "authorized_call_transcript");
        if (!source) throw new Error("SAL-002 缺 authorized_call_transcript 来源");
        source.reader_tools = ["crm"];
      });
    },
    expect: /SAL-002 LIVE reader 与对象类别错配/u
  },
  {
    name: "CTX supplemental 与 LIVE 合同错配",
    mutate(root) {
      mutateLiveContract(root, "PRJ-004", (contract) => {
        contract.fixture_supplemental = "LIVE 只读取未登记的通用对象";
      });
    },
    expect: /CTX-03\/PRJ-004 CTX supplemental 与 LIVE 来源合同不对称/u
  },
  {
    name: "04 删除任一 LIVE 合同行",
    mutate(root) {
      const file = join(root, "04-live-source-contracts.md");
      const lines = readFileSync(file, "utf8").split("\n");
      const filtered = lines.filter((line) => !line.startsWith("| OPS-051 |"));
      if (filtered.length !== lines.length - 1) throw new Error("04 未唯一删除 OPS-051 合同行");
      writeFileSync(file, filtered.join("\n"));
    },
    expect: /04 LIVE 合同行与 LIVE 题目集合不全等/u
  },
  {
    name: "频率换档与配额",
    mutate(root) {
      replaceInQuestionRow(root, "ENG-057", "| ENG-057 | L |", "| ENG-057 | H |");
    },
    expect: /ENG-057 demandPrior=H，语义基线应为 L/u
  },
  {
    name: "F1 缺省能力清单",
    mutate(root) {
      replaceInQuestionRow(root, "ENG-112", "| F2/B-AUTH |", "| F1/B-AUTH |");
    },
    expect: /ENG-112 不在缺省 coding\/workspace F1 能力基线/u
  },
  {
    name: "纯 LIVE 对象 reader",
    mutate(root) {
      replaceInQuestionRow(
        root,
        "PRJ-052",
        "tasks,document,test,bi,automation",
        "tasks,document,test,rag,automation"
      );
    },
    expect: /PRJ-052 LIVE project_outcome 缺对象相称 reader:bi/u
  },
  {
    name: "CTX+LIVE 的 live reader",
    mutate(root) {
      replaceInQuestionRow(root, "PRJ-037", "calendar,crm,forms", "calendar,rag,forms");
    },
    expect: /PRJ-037 LIVE crm_beta_registry 缺对象相称 reader:crm/u
  },
  {
    name: "CAR-011 用户材料",
    mutate(root) {
      replaceInQuestionRow(root, "CAR-011", "CTX-11+USER+LIVE", "CTX-11+LIVE");
    },
    expect: /CAR-011 输入模式语义基线不符/u
  },
  {
    name: "LRN-015 来源语义",
    mutate(root) {
      replaceExactlyOnce(
        join(root, "contexts", "CTX-06", "manifest.md"),
        "上线前须由另一位顾问做数据抽检",
        "员工上岗前须由另一位顾问检查"
      );
    },
    expect: /CTX-06\/LRN-015 不得把上线数据抽检捏造成员工上岗检查/u
  },
  {
    name: "LRN-003 题面时长归因",
    mutate(root) {
      replaceExactlyOnce(
        join(root, "contexts", "CTX-10", "manifest.md"),
        "通勤有 25 分钟且适合口头复盘",
        "通勤有 25 分钟且每天十分钟，适合口头复盘"
      );
    },
    expect: /CTX-10\/LRN-003 把题面临时条件写进 fixture claim:十分钟/u
  },
  {
    name: "LRN-006 题面会期归因",
    mutate(root) {
      replaceExactlyOnce(
        join(root, "contexts", "CTX-07", "manifest.md"),
        "账户资料记录采购流程目标",
        "下周客户会日期已定；账户资料记录采购流程目标"
      );
    },
    expect: /CTX-07\/LRN-006 把题面临时条件写进 fixture claim:下周客户会/u
  },
  {
    name: "逐题 source 特有 claim",
    mutate(root) {
      replaceExactlyOnce(
        join(root, "contexts", "CTX-06", "manifest.md"),
        "未开 change request 的 12 小时返工",
        "未开 change request 的一段时间返工"
      );
    },
    expect: /CTX-06\/OPS-024 required claim 缺 source 特有事实:12 小时/u
  },
  {
    name: "敏感读取风险与主边界",
    mutate(root) {
      replaceInQuestionRow(root, "SAL-013", "K2 S2", "K2 S0");
      replaceInQuestionRow(root, "SAL-013", "F2/B-PRIV", "F2/B0");
    },
    expect: /SAL-013 .*风险低于 S2/u
  },
  {
    name: "现实时间跨度",
    mutate(root) {
      replaceInQuestionRow(root, "LIF-013", "D1 H2", "D1 H0");
    },
    expect: /LIF-013 horizon=H0，语义基线应为 H2/u
  },
  {
    name: "历史窗口不冒充请求周期",
    mutate(root) {
      replaceInQuestionRow(root, "CAR-012", "D1 H0", "D1 H1");
    },
    expect: /CAR-012 本周期绩效是历史输入窗口，不得冒充未来请求跨度/u
  },
  {
    name: "effect 草稿边界",
    mutate(root) {
      replaceInQuestionRow(
        root,
        "OPS-052",
        "协调计划和消息草稿，不发送、不分派",
        "协调计划和消息，并直接发送和分派"
      );
    },
    expect: /OPS-052 必须明确只生成协调计划和消息草稿，不发送、不分派/u
  },
  {
    name: "客户提问自然度",
    mutate(root) {
      replaceInQuestionRow(
        root,
        "FAM-013",
        "先给我看一版共享日历和交接清单",
        "先列必要字段和回退点，再给我看一版共享日历和交接清单"
      );
    },
    expect: /FAM-013 家庭场景不得使用验收合同口吻/u
  },
  {
    name: "现势读取工具",
    mutate(root) {
      replaceInQuestionRow(root, "WRT-002", "| email |", "| notification |");
    },
    expect: /WRT-002 LIVE email_thread 缺对象相称 reader:email/u
  },
  {
    name: "ENG-091 F1 误升档",
    mutate(root) {
      replaceInQuestionRow(root, "ENG-091", "F2/B-PRIV", "F1/B-PRIV");
    },
    expect: /ENG-091 不在缺省 coding\/workspace F1 能力基线/u
  },
  {
    name: "PRJ-025 F1 误升档",
    mutate(root) {
      replaceInQuestionRow(root, "PRJ-025", "F2/B-AUTH", "F1/B-AUTH");
    },
    expect: /PRJ-025 不在缺省 coding\/workspace F1 能力基线/u
  },
  ...sensitiveRiskIds.map((id) => ({
    name: `${id} 敏感读取低标`,
    mutate(root) {
      transformQuestionRow(root, id, (line) => line.replace(/ (K[0-4]) S2 \|/u, " $1 S0 |"));
    },
    expect: new RegExp(`${id} .*风险低于 S2`, "u")
  })),
  ...professionalBoundaryIds.map((id) => ({
    name: `${id} 专业边界误标 B0`,
    mutate(root) {
      transformQuestionRow(root, id, (line) => line.replace(/\/B-(?:MED|LEG|FIN|PRIV|ID|ATTR|AUTH)(?= \|$)/u, "/B0"));
    },
    expect: new RegExp(`${id} 主边界=B0`, "u")
  })),
  {
    name: "FAM-013 同义圈外 effect 低标",
    mutate(root) {
      transformQuestionRow(root, "FAM-013", (line) => line.replace("K2 S2", "K2 S0"));
    },
    expect: /FAM-013 external_calendar_create effect 风险不得低于 S2/u
  },
  ...f4DIds.map((id) => ({
    name: `${id} F4 首个安全响应时延`,
    mutate(root) {
      transformQuestionRow(root, id, (line) => line.replace(/ (C[1-5]) D0 /u, " $1 D4 "));
    },
    expect: new RegExp(`${id} 越权请求的首个安全可审阅响应应为 D0`, "u")
  })),
  {
    name: "OPS-040 持续语义 D 档",
    mutate(root) {
      replaceInQuestionRow(root, "OPS-040", "C3 D4 H4", "C3 D1 H4");
    },
    expect: /OPS-040 定期刷新证据索引必须标 D4 并含 automation/u
  },
  {
    name: "OPS-040 持续语义工具",
    mutate(root) {
      replaceInQuestionRow(root, "OPS-040", "database,monitoring,automation,rag", "database,monitoring,rag");
    },
    expect: /OPS-040 定期刷新证据索引必须标 D4 并含 automation/u
  },
  {
    name: "LIF-026 长期退休规划时域",
    mutate(root) {
      replaceInQuestionRow(root, "LIF-026", "D0 H3", "D0 H0");
    },
    expect: /LIF-026 horizon=H0，语义基线应为 H3/u
  },
  {
    name: "OPS-020 潜客自然表达",
    mutate(root) {
      replaceInQuestionRow(root, "OPS-020", "只看我有权限查看的审批项目", "我获权查看审批项目");
    },
    expect: /OPS-020 不得使用“我获权”式合同口吻/u
  },
  {
    name: "SAL-013 潜客自然表达",
    mutate(root) {
      replaceInQuestionRow(root, "SAL-013", "只看我有权限查看的账户汇总数据", "我获权查看账户汇总数据");
    },
    expect: /SAL-013 不得使用“我获权”式合同口吻/u
  },
  {
    name: "DAT-020 潜客自然表达",
    mutate(root) {
      replaceInQuestionRow(root, "DAT-020", "只用我有权限查看的客户 cohort 最小字段", "我获权用客户 cohort 最小字段");
    },
    expect: /DAT-020 不得使用“我获权”式合同口吻/u
  },
  {
    name: "PRJ-047 source 事实与分析推断",
    mutate(root) {
      replaceExactlyOnce(
        join(root, "contexts", "CTX-03", "manifest.md"),
        "是否构成采用风险属于后续分析，不是来源原文结论",
        "来源事实表明这会构成采用风险"
      );
    },
    expect: /CTX-03\/PRJ-047 required claim 语义基线漂移/u
  }
];

const digestBefore = formalTreeDigest(corpusDir);
for (const scenario of scenarios) {
  const tempRoot = mkdtempSync(join(tmpdir(), "saydo-corpus-mutation-"));
  const tempCorpus = join(tempRoot, "corpus");
  try {
    cpSync(join(corpusDir, "questions"), join(tempCorpus, "questions"), { recursive: true });
    cpSync(join(corpusDir, "contexts"), join(tempCorpus, "contexts"), { recursive: true });
    cpSync(join(corpusDir, "contracts"), join(tempCorpus, "contracts"), { recursive: true });
    cpSync(join(corpusDir, "04-live-source-contracts.md"), join(tempCorpus, "04-live-source-contracts.md"));
    cpSync(join(corpusDir, "validate.mjs"), join(tempCorpus, "validate.mjs"));
    scenario.mutate(tempCorpus);
    const result = spawnSync(process.execPath, [join(tempCorpus, "validate.mjs")], {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024
    });
    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    if (result.status === 0 || !scenario.expect.test(output)) {
      throw new Error(`${scenario.name} 未命中预期门禁，exit=${result.status}\n${output}`);
    }
    console.log(`[ok] ${scenario.name}: validator exit=${result.status}`);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}
const digestAfter = formalTreeDigest(corpusDir);
if (digestAfter !== digestBefore) throw new Error(`mutation 前后正式树摘要变化:${digestBefore} -> ${digestAfter}`);
console.log(`[ok] ${scenarios.length} 类 mutation 均被拒绝`);
console.log(`[ok] 正式 questions+contexts+contracts+04 SHA-256 保持 ${digestAfter}`);
