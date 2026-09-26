// vitest globalSetup:开跑前清扫上一轮(中断/崩溃)遗留的测试临时目录。
// 正常路径的回收由 test/setup.ts 的 TMPDIR 重定向与各 fixture 的 afterEach 负责。
// SC-57:不再按 mtime+宽前缀扫系统 tmp/HOME——未登记的 saydo-* 目录不能认定归
// 本任务所有;只清登记清单里死进程遗留且验证归属的根,损坏/越界一律报错。
import { assertExactTestRootsGone, beginExactRootsRun, listExactTestRootLeftovers, sweepStaleExactRoots } from "./exact-test-roots.js";

export function setup(): void {
  beginExactRootsRun();
  const leftovers = sweepStaleExactRoots();
  if (leftovers.length > 0) {
    throw new Error(`测试根登记异常:${leftovers.join(";")}`);
  }
}

export function teardown(): void {
  // worker afterAll 可能略晚于主进程 teardown；先等到 exact-set 清空或超时，再一次性断言。
  // 断言本身仍先记录泄漏再清扫，清扫成功不能把本次改成通过。
  // 15s 是等待迟到 worker 清理的容忍窗，不是 rmSync 最长耗时上界。
  // maxRetries:30 / retryDelay:100 使用线性退避，仅累计等待就可达 46.5s，
  // 还未计入文件系统操作时间。循环在清空后立即退出；超窗仍按残留报错。
  const started = performance.now();
  while (performance.now() - started < 15_000 && listExactTestRootLeftovers().length > 0) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
  }
  // 整文件 skip 的 worker afterAll 不执行,tinypool 的 SIGTERM 也不触发 'exit' 钩子,
  // 其 testRoot/tmpRoot 会残留——但都已在 setupFiles 登记进本 run 清单,
  // assertExactTestRootsGone 按登记+归属验证回收,不再需要额外的前缀兜底。
  assertExactTestRootsGone();
}
