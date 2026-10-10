// 每项只创建随机测试前缀目标；不枚举或访问任何已有用户凭据。
import { createPublicKey, sign, verify } from "node:crypto";
import { expect, test } from "vitest";
import { createWin32PersonalSigningKey, loadWin32PersonalSigningKey, removeWin32PersonalSigningKey, Win32PersonalKeyCreationError } from "../src/win32PersonalKeys.js";
const windows = test.runIf(process.platform === "win32");

windows("UPGRADE.T08.109 真实Credential Manager新测试引用回读签名并精确删除", () => {
  const ref = createWin32PersonalSigningKey("test");
  try {
    expect(ref.reference).toMatch(/^saydo-personal-context-test\/1\//u);
    const key = loadWin32PersonalSigningKey(ref), message = Buffer.from("public-test-message");
    expect(verify(null, message, createPublicKey(ref.publicKey), sign(null, message, key))).toBe(true);
  } finally { expect(removeWin32PersonalSigningKey(ref)).toBe("removed"); }
  expect(removeWin32PersonalSigningKey(ref)).toBe("absent");
  expect(() => loadWin32PersonalSigningKey(ref)).toThrow("personal_key_reference_stale");
});

windows("UPGRADE.T08.110 不匹配的清理摘要拒绝删除本次测试凭据", () => {
  const ref = createWin32PersonalSigningKey("test");
  try {
    expect(() => removeWin32PersonalSigningKey({ ...ref, credentialDigest: `sha256:${"0".repeat(64)}` })).toThrow("personal_key_cleanup_mismatch_retained");
    expect(loadWin32PersonalSigningKey(ref).asymmetricKeyType).toBe("ed25519");
  } finally { expect(removeWin32PersonalSigningKey(ref)).toBe("removed"); }
});

windows("UPGRADE.T08.111 任意系统凭据名称在原生读取之前拒绝", () => {
  const invalid = { reference: "not-a-product-target", publicKey: "", publicKeyDigest: `sha256:${"0".repeat(64)}`, credentialDigest: `sha256:${"0".repeat(64)}` };
  expect(() => loadWin32PersonalSigningKey(invalid)).toThrow("personal_key_reference_rejected");
  expect(() => removeWin32PersonalSigningKey(invalid)).toThrow("personal_key_reference_rejected");
});

windows("UPGRADE.T08.112 耐久intent准备失败时尚未写入OS凭据", () => {
  let target: string | undefined;
  try {
    createWin32PersonalSigningKey("test", facts => { target = facts.reference; throw Error("sqlite rollback"); });
    throw Error("unexpected creation");
  } catch (error) {
    expect(error).toBeInstanceOf(Win32PersonalKeyCreationError);
    const failure = error as Win32PersonalKeyCreationError;
    expect(failure.reference).toBe(target);
    expect(failure.credentialMayExist).toBe(false);
    expect(removeWin32PersonalSigningKey({ reference: failure.reference, publicKey: "", publicKeyDigest: `sha256:${"0".repeat(64)}`, credentialDigest: `sha256:${"0".repeat(64)}` })).toBe("absent");
  }
});
