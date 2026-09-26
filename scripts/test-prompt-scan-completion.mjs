#!/usr/bin/env node
// Prompt 扫描完成条件回归:只注入生产边界,只用本脚本临时目录,不扫用户文件,不改宿主 cwd。
import {
  closeSync,
  constants,
  fstatSync,
  ftruncateSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  rmSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  privacyHits,
  promptTreeBound,
  promptTreeHandleBindingAvailable,
  scanRc4MobilePromptPrivacy,
  setPromptTreeBoundHooksForTests
} from "./pairing-url-fixtures.mjs";

const hostCwd = process.cwd();
const owned = [];
let pass = 0;
let fail = 0;

function createOwned(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  owned.push(dir);
  return dir;
}

function cleanupOwned() {
  setPromptTreeBoundHooksForTests(null);
  while (owned.length > 0) {
    const dir = owned.pop();
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // 只清本脚本 mkdtemp
    }
  }
}

function record(ok, label, detail = "") {
  if (ok) {
    process.stdout.write(`[ok] ${label}\n`);
    pass += 1;
  } else {
    process.stdout.write(`[fail] ${label}${detail ? `: ${detail}` : ""}\n`);
    fail += 1;
  }
}

function threwMessage(fn) {
  try {
    fn();
    return { threw: false, value: undefined, message: "" };
  } catch (error) {
    return { threw: true, value: undefined, message: error instanceof Error ? error.message : String(error) };
  }
}

function main() {
  let exitCode = 1;
  try {
    record(promptTreeHandleBindingAvailable(), "handle binding available");
    record(process.cwd() === hostCwd, "start cwd is host cwd");

    const dirty = Buffer.from(`${[10, 4, 5, 6].join(".")}:xx\n`);
    const clean = Buffer.from("cleanclean12");
    record(dirty.length === 12 && clean.length === 12, "fixture sizes are 12");
    record(privacyHits(dirty.toString("utf8")).includes("10/8"), "dirty 12-byte body would privacy-hit");
    record(privacyHits(clean.toString("utf8")).length === 0, "clean 12-byte body has no privacy hit");

    const eofRoot = createOwned("saydo-prompt-scan-eof-");
    const eofPath = join(eofRoot, "early-rc4-mobile.md");
    writeFileSync(eofPath, dirty);
    const eofFd = openSync(eofPath, constants.O_RDONLY);
    const eofWriteFd = openSync(eofPath, constants.O_RDWR);
    try {
      const before = fstatSync(eofFd);
      ftruncateSync(eofWriteFd, 0);
      const eof = threwMessage(() => promptTreeBound.readFile(eofFd, before));
      record(eof.threw, "truncate-to-empty during read fail-closed");
      record(eof.message === "prompt tree scan", "truncate uses scan failure");
    } finally {
      closeSync(eofWriteFd);
      closeSync(eofFd);
    }

    const injectRoot = createOwned("saydo-prompt-scan-inject-");
    writeFileSync(join(injectRoot, "short-rc4-mobile.md"), dirty);
    const injectFd = openSync(join(injectRoot, "short-rc4-mobile.md"), constants.O_RDONLY);
    try {
      const before = fstatSync(injectFd);
      setPromptTreeBoundHooksForTests({
        readSync() {
          return 0;
        }
      });
      const short = threwMessage(() => promptTreeBound.readFile(injectFd, before));
      record(short.threw, "injected early EOF fail-closed");
      record(short.message === "prompt tree scan", "injected early EOF uses scan failure");
    } finally {
      setPromptTreeBoundHooksForTests(null);
      closeSync(injectFd);
    }

    const sameRoot = createOwned("saydo-prompt-scan-same-");
    const samePath = join(sameRoot, "same-rc4-mobile.md");
    writeFileSync(samePath, dirty);
    const sameFd = openSync(samePath, constants.O_RDONLY);
    try {
      const before = fstatSync(sameFd);
      writeFileSync(samePath, clean);
      const same = threwMessage(() => promptTreeBound.readFile(sameFd, before));
      record(same.threw, "same-size rewrite fail-closed");
      record(same.message === "prompt tree scan", "same-size rewrite uses scan failure");
    } finally {
      closeSync(sameFd);
    }

    const bindRoot = createOwned("saydo-prompt-scan-bind-");
    const bindPath = join(bindRoot, "bound-rc4-mobile.md");
    writeFileSync(bindPath, dirty);
    const bindFd = openSync(bindPath, constants.O_RDONLY);
    try {
      const before = fstatSync(bindFd);
      unlinkSync(bindPath);
      writeFileSync(bindPath, clean);
      const text = promptTreeBound.readFile(bindFd, before);
      record(text === dirty.toString("utf8"), "path replace still reads bound inode");
      record(privacyHits(text).includes("10/8"), "bound inode keeps original hits");
    } finally {
      closeSync(bindFd);
    }

    const listRoot = createOwned("saydo-prompt-scan-list-");
    mkdirSync(join(listRoot, "nested"));
    writeFileSync(join(listRoot, "keep-rc4-mobile.md"), clean);
    const listFd = promptTreeBound.openRoot(listRoot);
    try {
      setPromptTreeBoundHooksForTests({
        closeSync(fd, real) {
          real(fd);
          throw new Error("injected close failure");
        }
      });
      const closeFail = threwMessage(() => promptTreeBound.list(listFd));
      record(closeFail.threw, "cwd close failure does not return success");
      record(closeFail.message === "prompt tree scan", "cwd close failure uses scan failure");
      record(process.cwd() === hostCwd, "cwd close failure restored host cwd");

      setPromptTreeBoundHooksForTests({
        closeSync(fd, real) {
          real(fd);
          throw new Error("injected close failure");
        }
      });
      const fileFd = openSync(join(listRoot, "keep-rc4-mobile.md"), constants.O_RDONLY);
      try {
        const both = threwMessage(() => promptTreeBound.list(fileFd));
        record(both.threw, "scan failure plus close failure still fails");
        record(both.message === "prompt tree scan", "original scan failure is preserved");
      } finally {
        closeSync(fileFd);
      }

      let fchdirCalls = 0;
      setPromptTreeBoundHooksForTests({
        fchdir(fd, real) {
          fchdirCalls += 1;
          const rc = real(fd);
          if (fchdirCalls === 2) return -1;
          return rc;
        }
      });
      const restoreFail = threwMessage(() => promptTreeBound.list(listFd));
      record(restoreFail.threw, "cwd restore failure does not return success");
      record(restoreFail.message === "prompt tree scan", "cwd restore failure uses scan failure");
      record(process.cwd() === hostCwd, "cwd restore failure restored host cwd");
    } finally {
      setPromptTreeBoundHooksForTests(null);
      promptTreeBound.close(listFd);
    }

    const scanRoot = createOwned("saydo-prompt-scan-ok-");
    writeFileSync(join(scanRoot, "ok-rc4-mobile.md"), clean);
    const rows = scanRc4MobilePromptPrivacy(scanRoot);
    record(
      rows.length === 1 && rows[0].name === "ok-rc4-mobile.md" && rows[0].hits.length === 0,
      "owned clean candidate still scans"
    );
    record(process.cwd() === hostCwd, "end cwd is host cwd");
    exitCode = fail === 0 ? 0 : 1;
  } catch (error) {
    process.stderr.write(`[fail] prompt-scan-completion crashed: ${error instanceof Error ? error.message : String(error)}\n`);
    exitCode = 1;
  } finally {
    cleanupOwned();
  }
  if (process.cwd() !== hostCwd) {
    process.stderr.write("[fail] host cwd changed after cleanup\n");
    exitCode = 1;
  }
  process.stdout.write(`prompt-scan-completion: pass=${pass} fail=${fail}\n`);
  process.exit(exitCode);
}

main();
