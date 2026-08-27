#!/usr/bin/env node
// 四个生产 HTML 的 candidate→available 文案变换。无副作用,可被 validator import。

import { createHash } from "node:crypto";
import { gitBlobId } from "./git-blob-id.mjs";

export { gitBlobId };

export const AVAILABILITY_HTML_PATHS = Object.freeze([
  "deploy/saydo-octoooo-com/index.html",
  "deploy/saydo-octoooo-com/en/index.html",
  "deploy/saydo-octoooo-com/docs/index.html",
  "deploy/saydo-octoooo-com/en/docs/index.html"
]);

export const AVAILABILITY_TRANSITION_IDENTITY = Object.freeze({
  "deploy/saydo-octoooo-com/index.html": Object.freeze({
    mode: "100644",
    before: Object.freeze({
      bytes: 42476,
      sha256: "840352f77f4e49837bf5f9a690fd91723747ed93bad1118bb0f771a3a8a4b3e6",
      gitBlob: "f758298b7737a03391059d43b0c3dfc322f457b0"
    }),
    after: Object.freeze({
      bytes: 42496,
      sha256: "c229f60cad0196ce8945c99497802031857faa49181cf871317d22bd2b853c54",
      gitBlob: "4232071aed914b0e79c6dec24a3c6fe3edeae5f1"
    })
  }),
  "deploy/saydo-octoooo-com/en/index.html": Object.freeze({
    mode: "100644",
    before: Object.freeze({
      bytes: 43666,
      sha256: "918865f472212da8846619d429360d9e54d2c9e36dd9d9c9d8c82b2344ba100e",
      gitBlob: "cd1d954a8e2ff9906092e67cac9c5f8b7ffc8470"
    }),
    after: Object.freeze({
      bytes: 43665,
      sha256: "d1a1c3883447531937efb107488068b8237cc3df96da84d69cab13b02a49f5f9",
      gitBlob: "eb72abb5f4c3ef3cdff0ee22914b15d8701cbf36"
    })
  }),
  "deploy/saydo-octoooo-com/docs/index.html": Object.freeze({
    mode: "100644",
    before: Object.freeze({
      bytes: 125658,
      sha256: "49bb1d6e6838948957a71646a16e132b48fae0ce26f1a2308696892dabdfe967",
      gitBlob: "d0e11d762ac95f66b8fed2c054387e7d28275534"
    }),
    after: Object.freeze({
      bytes: 125694,
      sha256: "f6a0d21a63165cd2f8769c2d20ef32749bc9c7fc5a28efe3e463d5ff34af1a78",
      gitBlob: "3a1bb10cdb0d2b07fe1aaa468e1a5ab9be0f18ff"
    })
  }),
  "deploy/saydo-octoooo-com/en/docs/index.html": Object.freeze({
    mode: "100644",
    before: Object.freeze({
      bytes: 146749,
      sha256: "a7daad1aceee87b5d0885c86ce7d46dbda5a6f719aaa708cd5e0ac322e2e5004",
      gitBlob: "6757aa8de03f5d44672f22aade2795a14163e015"
    }),
    after: Object.freeze({
      bytes: 146735,
      sha256: "4783f7f29c48a405171c9017d5cc9baf2b166159dd2f6c1d2a5a18f87d7dad9b",
      gitBlob: "e3a00cebc2ce8c6a84a11411943bb2db4a138419"
    })
  })
});

export function availabilityContentIdentity(text) {
  const buf = Buffer.from(String(text), "utf8");
  return {
    bytes: buf.length,
    sha256: createHash("sha256").update(buf).digest("hex")
  };
}

function identityMatches(text, side, path) {
  const frozen = AVAILABILITY_TRANSITION_IDENTITY[path];
  if (!frozen) return false;
  const actual = availabilityContentIdentity(text);
  return actual.sha256 === frozen[side].sha256 && actual.bytes === frozen[side].bytes;
}

export function isCanonicalAvailabilityBefore(text, path) {
  return identityMatches(text, "before", path);
}

export function isCanonicalAvailabilityAfter(text, path) {
  return identityMatches(text, "after", path);
}

export const AVAILABILITY_REPLACEMENTS = Object.freeze([
  {
    path: "deploy/saydo-octoooo-com/docs/index.html",
    before:
      "<p><strong>推荐 · 不克隆源码:</strong>下面是 v0.1.0-rc.4 的发布候选固定 URL;仅当 GitHub Release 页面已经出现且发布检查全绿后才可用。尚未发布到 npm registry 或 Homebrew。</p>",
    after:
      "<p><strong>推荐 · 不克隆源码:</strong>v0.1.0-rc.4 固定 URL 已由不可变 GitHub Release 与 macOS、Windows、Linux 的一次运行 / 全局安装六项 smoke 验证,可直接使用。尚未发布到 npm registry 或 Homebrew。</p>"
  },
  {
    path: "deploy/saydo-octoooo-com/docs/index.html",
    before:
      "源码形态已经可运行;v0.1.0-rc.4 固定 URL 仅在 GitHub Release 出现且发布检查全绿后生效。npm registry / Homebrew",
    after:
      "源码形态已经可运行;v0.1.0-rc.4 固定 URL 已由不可变 GitHub Release 与六项跨平台安装 smoke 验证。npm registry / Homebrew"
  },
  {
    path: "deploy/saydo-octoooo-com/en/docs/index.html",
    before:
      "<p><strong>Recommended · no source checkout:</strong> this is the candidate fixed URL for v0.1.0-rc.4. Use it only after the GitHub Release page appears and all release checks are green. It is not published to the npm registry or Homebrew yet.</p>",
    after:
      "<p><strong>Recommended · no source checkout:</strong> the immutable v0.1.0-rc.4 GitHub Release has passed one-off and global-install smokes on macOS, Windows, and Linux. It is ready to use and is not published to the npm registry or Homebrew yet.</p>"
  },
  {
    path: "deploy/saydo-octoooo-com/en/docs/index.html",
    before:
      "The source form already runs; the v0.1.0-rc.4 fixed URL becomes active only after the GitHub Release appears and all release checks are green. npm registry / Homebrew",
    after:
      "The source form already runs; the immutable v0.1.0-rc.4 GitHub Release has passed all six cross-platform installation smokes. npm registry / Homebrew"
  },
  {
    path: "deploy/saydo-octoooo-com/index.html",
    before:
      "这是 v0.1.0-rc.4 发布候选固定 URL，仅在 GitHub Release 页面出现且发布检查全绿后可用；语音 pipeline 与系统常驻安装不包含在内。",
    after:
      "v0.1.0-rc.4 固定 URL 已由不可变 GitHub Release 与 macOS、Windows、Linux 的六项安装 smoke 验证，可直接使用；语音 pipeline 与系统常驻安装不包含在内。"
  },
  {
    path: "deploy/saydo-octoooo-com/en/index.html",
    before:
      "This is the candidate fixed URL for v0.1.0-rc.4 and works only after the GitHub Release page appears and all release checks are green; it does not include the voice pipeline or service installation.",
    after:
      "The immutable v0.1.0-rc.4 GitHub Release has passed all six installation smokes across macOS, Windows, and Linux and is ready to use; it does not include the voice pipeline or service installation."
  }
]);

export function applyAvailabilityReplacements(content, path) {
  let out = String(content);
  const rules = AVAILABILITY_REPLACEMENTS.filter((row) => row.path === path);
  if (rules.length === 0) {
    throw new Error("availability 路径未登记");
  }
  for (const rule of rules) {
    const beforeCount = out.split(rule.before).length - 1;
    if (beforeCount !== 1) {
      throw new Error("availability before 锚数量非法");
    }
    out = out.split(rule.before).join(rule.after);
  }
  return out;
}

export function isExactAvailabilityText(beforeText, afterText, path) {
  try {
    return applyAvailabilityReplacements(beforeText, path) === String(afterText);
  } catch {
    return false;
  }
}
