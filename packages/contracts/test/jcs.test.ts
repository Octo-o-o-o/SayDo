import { describe, expect, it } from "vitest";
import { jcsDigest, jcsSerialize, textDigest } from "../src/jcs.js";

describe("JCS (RFC 8785)", () => {
  it("对象键按 UTF-16 code unit 排序,与插入序无关", () => {
    expect(jcsSerialize({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(jcsSerialize({ a: 2, b: 1 })).toBe('{"a":2,"b":1}');
  });

  it("undefined 键省略;null 保留", () => {
    expect(jcsSerialize({ a: undefined, b: null })).toBe('{"b":null}');
  });

  it("嵌套数组/对象稳定序列化", () => {
    expect(jcsSerialize({ x: [1, { z: "s", y: true }] })).toBe('{"x":[1,{"y":true,"z":"s"}]}');
  });

  it("拒绝 NaN/Infinity", () => {
    expect(() => jcsSerialize({ a: Number.NaN })).toThrow();
    expect(() => jcsSerialize({ a: Number.POSITIVE_INFINITY })).toThrow();
  });

  it("中文与转义稳定", () => {
    expect(jcsSerialize({ 名: "值\n" })).toBe('{"名":"值\\n"}');
  });

  it("digest 形态 sha256:<hex> 且确定", () => {
    const d1 = jcsDigest({ a: 1, b: [2, 3] });
    const d2 = jcsDigest({ b: [2, 3], a: 1 });
    expect(d1).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(d1).toBe(d2);
  });

  it("文件类 digest 对 bytes 直接哈希(encoding=utf-8)", () => {
    // sha256("hello") 公知值
    expect(textDigest("hello")).toBe("sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });
});
