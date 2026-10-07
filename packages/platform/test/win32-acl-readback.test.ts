// 注入生产回读入口 applyWin32OwnerOnlyAclReadback。不是 Windows native GetAce 验收。
import { afterEach, describe, expect, it } from "vitest";
import {
  ACCESS_ALLOWED_ACE_TYPE,
  FILE_ALL_ACCESS,
  INHERITED_ACE,
  OWNER_ONLY_DIR_FLAGS,
  OWNER_ONLY_FILE_MASK,
  SE_DACL_PRESENT,
  SE_DACL_PROTECTED,
  applyWin32OwnerOnlyAclReadback,
  canonicalizeWin32SidToken,
  decodeWin32AllowedAce,
  setWin32AclReadbackForTests,
  type Win32AclAceView,
  type Win32AclReadbackView
} from "../src/win32.js";

const OWNER = "S-1-5-21-100-200-300-1001";
const FOREIGN = "S-1-5-21-100-200-300-1002";
const PROTECTED = SE_DACL_PRESENT | SE_DACL_PROTECTED;
const PATH = "C:\\saydo-acl-fixture\\secret";

function allowAce(trusteeSid: string, kind: "file" | "dir"): Win32AclAceView {
  return {
    aceType: ACCESS_ALLOWED_ACE_TYPE,
    aceFlags: kind === "dir" ? OWNER_ONLY_DIR_FLAGS : 0,
    mask: kind === "dir" ? FILE_ALL_ACCESS : OWNER_ONLY_FILE_MASK,
    trusteeSid
  };
}

function view(partial: Partial<Win32AclReadbackView> & Pick<Win32AclReadbackView, "aces">): Win32AclReadbackView {
  return {
    ownerSid: OWNER,
    control: PROTECTED,
    ...partial
  };
}

function inject(next: Win32AclReadbackView): void {
  setWin32AclReadbackForTests(() => next);
}

afterEach(() => {
  setWin32AclReadbackForTests(null);
});

describe("applyWin32OwnerOnlyAclReadback 生产回读注入", () => {
  it("Owner 常规 SID + 正常 file 权限通过", () => {
    inject(view({ aces: [allowAce(OWNER, "file")] }));
    expect(() => applyWin32OwnerOnlyAclReadback(PATH, OWNER, "file")).not.toThrow();
  });

  it("Owner 常规 SID + 正常 dir 权限通过", () => {
    inject(view({ aces: [allowAce(OWNER, "dir")] }));
    expect(() => applyWin32OwnerOnlyAclReadback(PATH, OWNER, "dir")).not.toThrow();
  });

  it("Owner 本人的合法 SDDL 缩写与当前 SID 视为同一 trustee", () => {
    inject(
      view({
        ownerSid: "BA",
        aces: [allowAce("BA", "file")]
      })
    );
    expect(() => applyWin32OwnerOnlyAclReadback(PATH, "S-1-5-32-544", "file")).not.toThrow();
    expect(canonicalizeWin32SidToken("BA")).toBe("S-1-5-32-544");
  });

  it("Owner 正确但 DACL 无其授权则拒绝", () => {
    inject(view({ aces: [allowAce(FOREIGN, "file")] }));
    expect(() => applyWin32OwnerOnlyAclReadback(PATH, OWNER, "file")).toThrow(/extra trustee/u);
    inject(view({ aces: [] }));
    expect(() => applyWin32OwnerOnlyAclReadback(PATH, OWNER, "file")).toThrow(/no owner allow ACE/u);
  });

  it("额外非 Owner 用户则拒绝", () => {
    inject(view({ aces: [allowAce(OWNER, "file"), allowAce(FOREIGN, "file")] }));
    expect(() => applyWin32OwnerOnlyAclReadback(PATH, OWNER, "file")).toThrow(/extra trustee/u);
  });

  it("宽组 ACE 不是仅 Owner", () => {
    for (const trustee of ["WD", "BU", "AU", "BA", "S-1-1-0", "S-1-5-32-545", "S-1-5-11"]) {
      inject(view({ aces: [allowAce(trustee, "file")] }));
      expect(() => applyWin32OwnerOnlyAclReadback(PATH, OWNER, "file")).toThrow(/extra trustee/u);
    }
  });

  it("缺 protected 则拒绝", () => {
    inject(view({ control: SE_DACL_PRESENT, aces: [allowAce(OWNER, "file")] }));
    expect(() => applyWin32OwnerOnlyAclReadback(PATH, OWNER, "file")).toThrow(/not protected/u);
  });

  it("未知 SID 别名不能误放行", () => {
    inject(view({ aces: [allowAce("ZZ", "file")] }));
    expect(() => applyWin32OwnerOnlyAclReadback(PATH, OWNER, "file")).toThrow(/unknown trustee/u);
    expect(canonicalizeWin32SidToken("ZZ")).toBeNull();
    expect(canonicalizeWin32SidToken("DA")).toBeNull();
  });

  it("继承 ACE 或错误权限拒绝", () => {
    inject(view({ aces: [{ ...allowAce(OWNER, "file"), aceFlags: INHERITED_ACE }] }));
    expect(() => applyWin32OwnerOnlyAclReadback(PATH, OWNER, "file")).toThrow(/inherited ACE/u);
    inject(view({ aces: [{ ...allowAce(OWNER, "file"), mask: FILE_ALL_ACCESS }] }));
    expect(() => applyWin32OwnerOnlyAclReadback(PATH, OWNER, "file")).toThrow(/mask mismatch/u);
    inject(view({ aces: [{ ...allowAce(OWNER, "dir"), aceFlags: 0 }] }));
    expect(() => applyWin32OwnerOnlyAclReadback(PATH, OWNER, "dir")).toThrow(/flags mismatch/u);
  });
});


describe("native ACE 解码边界", () => {
  it("未知 ACE 类型只读类型头，不尝试固定偏移的 SID", () => {
    const reads: number[] = [];
    expect(() => decodeWin32AllowedAce((offset) => {
      reads.push(offset);
      if (offset !== 0) throw new Error("unexpected memory read");
      return 5; // ACCESS_ALLOWED_OBJECT_ACE 的 SID 位置取决于 flags。
    })).toThrow(/ACE type not allow/u);
    expect(reads).toEqual([0]);
  });

  it("短 ACE 在读取 SID subauthority count 前拒绝", () => {
    const reads: number[] = [];
    expect(() => decodeWin32AllowedAce((offset) => {
      reads.push(offset);
      if (offset === 0) return ACCESS_ALLOWED_ACE_TYPE;
      if (offset === 2) return 8;
      throw new Error("out of bounds read");
    })).toThrow(/ACE size invalid/u);
    expect(reads).toEqual([0, 2]);
  });

  it("SID 长度超出 ACE 时不读取 SID 正文", () => {
    const reads: number[] = [];
    expect(() => decodeWin32AllowedAce((offset) => {
      reads.push(offset);
      if (offset === 0) return ACCESS_ALLOWED_ACE_TYPE;
      if (offset === 2) return 16;
      if (offset === 9) return 2;
      throw new Error("out of bounds read");
    })).toThrow(/SID truncated/u);
    expect(reads).toEqual([0, 2, 9]);
  });

  it("合法 allow ACE 在边界内解码完整 SID 和权限", () => {
    const bytes = Buffer.alloc(20);
    bytes.writeUInt16LE(20, 2);
    bytes.writeUInt32LE(OWNER_ONLY_FILE_MASK, 4);
    bytes[8] = 1;
    bytes[9] = 1;
    bytes[15] = 5;
    bytes.writeUInt32LE(18, 16);
    const decoded = decodeWin32AllowedAce((offset, type) => type === "uint8" ? bytes.readUInt8(offset) : type === "uint16" ? bytes.readUInt16LE(offset) : bytes.readUInt32LE(offset));
    expect(decoded).toEqual({ aceType: 0, aceFlags: 0, mask: OWNER_ONLY_FILE_MASK, sidBuf: bytes.subarray(8) });
  });
});
