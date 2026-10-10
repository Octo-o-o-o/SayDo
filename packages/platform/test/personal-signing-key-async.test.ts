// 实际创建入口只查询本次新随机测试目标；准备阶段拒绝，因此不写任何凭据。
import { expect, test } from "vitest";
import { createWin32PersonalSigningKey, Win32PersonalKeyCreationError } from "../src/win32PersonalKeys.js";

test.runIf(process.platform === "win32")("UPGRADE.T08.113 异步准备拒绝被观察且不能成为进程未处理拒绝", async () => {
  let failure: unknown;
  try { createWin32PersonalSigningKey("test", async () => { throw Error("public-synthetic-preparation-failure"); }); }
  catch (error) { failure = error; }
  expect(failure).toBeInstanceOf(Win32PersonalKeyCreationError);
  expect((failure as Win32PersonalKeyCreationError).credentialMayExist).toBe(false);
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
});
