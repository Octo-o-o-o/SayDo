import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { assertLocalFixedNtfs, PlatformNativeError, setWin32NativeForTests } from "../src/win32.js";

// 注入 native 边界覆盖生产函数 assertLocalFixedNtfs。不是 Windows 真机。

afterEach(() => {
  setWin32NativeForTests(null);
});

const ABS = resolve("/saydo-test/state");
const DRIVE_FIXED = 3;

function writeUtf16z(buf: Buffer, text: string): void {
  buf.fill(0);
  Buffer.from(`${text}\0`, "utf16le").copy(buf);
}

function injectVolume(opts: {
  driveType?: number;
  query?: number | string;
  fs?: string;
  volumeOk?: number;
}): void {
  setWin32NativeForTests({
    GetDriveTypeW: () => opts.driveType ?? DRIVE_FIXED,
    QueryDosDeviceW: (_name, buf) => {
      if (typeof opts.query === "number") return opts.query;
      writeUtf16z(buf, opts.query ?? "\\Device\\HarddiskVolume2");
      return (opts.query ?? "\\Device\\HarddiskVolume2").length + 1;
    },
    GetVolumeInformationW: (_root, _vol, _volSize, _serial, _maxComp, _flags, fsName) => {
      if (opts.volumeOk === 0) return 0;
      writeUtf16z(fsName, opts.fs ?? "NTFS");
      return 1;
    }
  });
}

describe("assertLocalFixedNtfs 卷查询失败关闭(注入,非真机)", () => {
  it("正常物理 NTFS 成功", () => {
    injectVolume({ query: "\\Device\\HarddiskVolume2", fs: "NTFS" });
    expect(() => assertLocalFixedNtfs(ABS)).not.toThrow();
  });

  it("QueryDosDeviceW 返回 0 必须拒绝", () => {
    injectVolume({ query: 0 });
    expect(() => assertLocalFixedNtfs(ABS)).toThrow(PlatformNativeError);
    expect(() => assertLocalFixedNtfs(ABS)).toThrow(/QueryDosDeviceW failed/u);
  });

  it("QueryDosDeviceW 空有效结果必须拒绝", () => {
    injectVolume({ query: "" });
    expect(() => assertLocalFixedNtfs(ABS)).toThrow(/QueryDosDeviceW empty/u);
    injectVolume({ query: "   " });
    expect(() => assertLocalFixedNtfs(ABS)).toThrow(/QueryDosDeviceW empty/u);
  });

  it("subst 映射必须拒绝", () => {
    injectVolume({ query: "\\??\\D:\\mapped\\state" });
    expect(() => assertLocalFixedNtfs(ABS)).toThrow(/subst\/mapped/u);
  });

  it("非 NTFS 必须拒绝", () => {
    injectVolume({ fs: "ReFS" });
    expect(() => assertLocalFixedNtfs(ABS)).toThrow(/not NTFS/u);
  });

  it("非 DRIVE_FIXED 必须拒绝", () => {
    injectVolume({ driveType: 2 });
    expect(() => assertLocalFixedNtfs(ABS)).toThrow(/DRIVE_FIXED/u);
  });
});
