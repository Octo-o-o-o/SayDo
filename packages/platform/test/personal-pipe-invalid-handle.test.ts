// 真实系统返回值诊断，不申请管理员权限或访问现有管道。
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";
test.skipIf(process.platform !== "win32")("UPGRADE.T08.099 缺失pipe的真实INVALID_HANDLE_VALUE按指针宽度解释", () => {
  const koffi = createRequire(import.meta.url)("koffi");
  const kernel = koffi.load("kernel32.dll");
  const open = kernel.func("void * __stdcall CreateFileW(str16, uint32, uint32, void *, uint32, uint32, void *)");
  const lastError = kernel.func("uint32 __stdcall GetLastError()");
  const result = open(`\\\\.\\pipe\\saydo-nonexistent-${randomUUID()}`, 0x80000000, 0, null, 3, 0, null);
  const error = lastError(); const address = BigInt(koffi.address(result));
  console.info(JSON.stringify({ diagnostic: "invalid_handle_native_pointer", address: address.toString(), error }));
  expect(error).toBe(2); expect(BigInt.asIntN(64, address)).toBe(-1n);
});
