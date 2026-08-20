// vitest globalSetup:开跑前清扫上一轮(中断/崩溃)遗留的测试临时目录。
// 正常路径的回收由 test/setup.ts 的 TMPDIR 重定向与各 fixture 的 afterEach 负责,
// 这里只兜底超过 1 小时无更新的残留。
import { lstatSync, readdirSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const STALE_MS = 60 * 60 * 1000;

// $HOME 是持久区,住着 .saydo-focus-dev/.saydo-cmp2 等具名 dev 环境(2026-08-12
// 曾被宽前缀 ".saydo-" 清理误删)。这里只允许列出测试自建的 mkdtemp fixture 前缀,
// 禁止放宽到 ".saydo-";新增 $HOME fixture 前缀时必须同步登记。
const HOME_TEST_PREFIXES = [".saydo-anchor-test-", ".saydo-mig14-", ".saydo-live-"];
// TMPDIR 重定向 root 的前缀(setup.ts/cli setup.ts 创建)。
const RUN_ROOT_PREFIXES = ["saydo-vitest-state-", "saydo-t-", "saydo-cli-vitest-"];

function sweep(root: string, prefixes: string[], staleMs: number): void {
  const cutoff = Date.now() - staleMs;
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return;
  }
  for (const name of entries) {
    if (!prefixes.some((prefix) => name.startsWith(prefix))) continue;
    const path = join(root, name);
    try {
      if (lstatSync(path).mtimeMs >= cutoff) continue;
      rmSync(path, { recursive: true, force: true });
    } catch {
      // 并发运行中的目录或已被回收,跳过。
    }
  }
}

export function setup(): void {
  sweep(tmpdir(), ["saydo-"], STALE_MS);
  sweep(homedir(), HOME_TEST_PREFIXES, STALE_MS);
}

export function teardown(): void {
  // 整文件 skip 时该 worker 的 afterAll 不执行,且 tinypool 用 SIGTERM 终结 worker
  // 使 process 'exit' 钩子也不触发,其 root 会残留——run 结束后在主进程统一回收。
  // 前缀是测试专用且同机不支持并行 run,10 秒保护窗足够。
  sweep(tmpdir(), RUN_ROOT_PREFIXES, 10 * 1000);
}
