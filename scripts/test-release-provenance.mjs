#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import {
  closeSync,
  constants as fsConstants,
  existsSync,
  fstatSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
  writeSync
} from "node:fs";
import { tmpdir } from "node:os";
import path, { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertAssetsMatchTrackedManifest,
  buildTrackedReleaseAssetManifest,
  parseTrackedReleaseAssetManifest,
  serializeReleaseAssetManifest
} from "./release-asset-manifest.mjs";
import {
  WEEK_AUDIT_WRITE_OUTPUTS,
  assertSafeDirMemberName,
  defaultFsIo,
  replaceRegularFileInPlace,
  runMutationsWithRollback,
  writeDirAtomic,
  writeFdFully,
  writeFileAtomic,
  writeWeekAuditOutputs
} from "./release-file-transaction.mjs";
import { applyAvailabilityReplacementsFromSnapshot } from "./release-availability.mjs";
import {
  assertCloudflareApiEnvelope,
  cloudflareV4Get,
  getPagesProject,
  listPagesDeployments,
  redactSecrets,
  requireCloudflareCredentials,
  safeErrorText
} from "./release-cloudflare-pages.mjs";
import {
  PAGES_CANONICAL_HOSTS,
  PAGES_DEPLOYMENT_ID_MAX_LENGTH,
  acquireDeployEvidenceLease,
  assertAuditRecoveryEvidence,
  assertCurrentProductionDeployment,
  assertLeaseHeld,
  isSafePagesDeploymentId,
  parseWranglerDeploymentUrl,
  persistClaimedDeployEvidence,
  projectDurableEvidence,
  projectPagesDeployment,
  readDeployEvidenceFile,
  runPagesDeployStateMachine,
  selectUniquePagesDeployment
} from "./release-pages-deploy.mjs";
import {
  TRACKED_ASSET_MANIFEST_RELATIVE_PATH,
  WINDOWS_VERIFIER_RELATIVE_PATH,
  WINDOWS_WRAPPER_RELATIVE_PATH,
  assertClosureFingerprints,
  assertPhysicalToolFingerprints,
  assertSafeRemoteVerifierPath,
  hashClosureFiles,
  materializeClosure,
  physicalToolClosure,
  probeVerifierModuleLoad,
  walkJsClosure,
  windowsRemoteRootName,
  windowsVerifierClosure
} from "./release-physical-closure.mjs";
import {
  collectPushRuns,
  createGhWorkflowRunPageFetcher,
  evaluateActiveTagRuleset,
  evaluateTagWorkflowHistory,
  githubRefPatternMatches
} from "./release-tag-guard.mjs";
import { assertPublicationExactSet, privateExcludedIdentity } from "./week-audit-publication.mjs";
import {
  ANCHORED_FAILURE_TUPLES,
  HELPER_STDIN_OPEN_MODE,
  MAX_EVIDENCE_BYTES,
  MAX_IDENTITY_DIGITS,
  bindHelperStdinFd,
  defaultAnchoredIo,
  defaultHelperStdinIo,
  helperStdinOpenFlags,
  isAllowedAnchoredFailure,
  isIdentityDecimal,
  openatSupported,
  runOpenatHelper,
  splitAnchoredPath,
  viewAnchoredResult
} from "./release-openat.mjs";

const scripts = dirname(fileURLToPath(import.meta.url));
const repo = dirname(scripts);

function expectThrow(name, fn) {
  let thrown = false;
  try {
    fn();
  } catch {
    thrown = true;
  }
  if (!thrown) throw new Error(`反例未拒绝:${name}`);
}

async function expectThrowAsync(name, fn) {
  let thrown = false;
  let error;
  try {
    await fn();
  } catch (caught) {
    thrown = true;
    error = caught;
  }
  if (!thrown) throw new Error(`反例未拒绝:${name}`);
  return error;
}

function revokedProxy(target = { marker: true }) {
  const rec = Proxy.revocable(target, {});
  rec.revoke();
  return rec.proxy;
}

function expectStableReject(name, fn, expected, attackText, source) {
  let error;
  try {
    fn();
  } catch (caught) {
    error = caught;
  }
  if (!error) throw new Error(`反例未拒绝:${name}`);
  if (source && error === source) throw new Error(`${name} 对象身份逸出`);
  let message;
  try {
    message = error.message;
  } catch {
    throw new Error(`${name} 错误 message 不可读`);
  }
  if (message !== expected) throw new Error(`${name} 错误不是常量:${message}`);
  const text = `${String(message)}\n${error.stack ?? ""}`;
  if (attackText && text.includes(attackText)) throw new Error(`${name} 攻击文本逸出`);
  if (/revoked|IsArray|HasInstance|Cannot perform|toPrimitive|Bearer/i.test(text)) {
    throw new Error(`${name} 透传引擎或攻击文本:${message}`);
  }
  return error;
}

function sha(fill) {
  return fill.repeat(64);
}

const PAGES_IDS = Object.freeze({
  saydoPreview: "11111111-1111-4111-8111-111111111111",
  saydoProduction: "22222222-2222-4222-8222-222222222222",
  saydoLinkPreview: "33333333-3333-4333-8333-333333333333",
  saydoLinkProduction: "44444444-4444-4444-8444-444444444444",
  stale: "55555555-5555-4555-8555-555555555555",
  other: "66666666-6666-4666-8666-666666666666",
  wranglerFixture: "d16c9509-695d-4b81-975e-d6480aa57f99"
});

function deploymentId(project, environment) {
  if (project === "saydo") return environment === "preview" ? PAGES_IDS.saydoPreview : PAGES_IDS.saydoProduction;
  return environment === "preview" ? PAGES_IDS.saydoLinkPreview : PAGES_IDS.saydoLinkProduction;
}

function sampleManifest(overrides = {}) {
  return buildTrackedReleaseAssetManifest({
    tag: "v0.1.0-rc.4",
    packageName: "@saydo/cli",
    version: "0.1.0-rc.4",
    sourceRevision: sha("a"),
    buildId: `0.1.0-rc.4+${"a".repeat(12)}.test`,
    protocolVersion: "1.0.0",
    assets: [
      {
        filename: "saydo-cli-0.1.0-rc.4.tgz",
        bytes: 12,
        sha256: sha("b"),
        npmIntegrity: "sha512-abc",
        entryCount: 4
      },
      { filename: "SHA256SUMS", bytes: 80, sha256: sha("c") },
      { filename: "release-metadata.json", bytes: 40, sha256: sha("d") }
    ],
    ...overrides
  });
}

function run(headBranch, headSha, extra = {}) {
  return {
    id: extra.id ?? 1,
    head_branch: headBranch,
    head_sha: headSha,
    run_attempt: extra.run_attempt ?? 1,
    status: extra.status ?? "completed",
    conclusion: extra.conclusion ?? "success"
  };
}

function pagesFetcher(pages) {
  const calls = [];
  const fetchPage = async (page, perPage) => {
    calls.push({ page, perPage });
    if (perPage !== 100) throw new Error(`分页 perPage 不是 100:${perPage}`);
    return pages[page - 1] ?? [];
  };
  return { fetchPage, calls };
}

async function testAssetManifest() {
  const manifest = sampleManifest();
  parseTrackedReleaseAssetManifest(serializeReleaseAssetManifest(manifest));
  assertAssetsMatchTrackedManifest(manifest.assets, manifest);
  const drifted = structuredClone(manifest.assets);
  drifted[0] = { ...drifted[0], bytes: drifted[0].bytes + 1 };
  expectThrow("asset bytes mismatch", () => assertAssetsMatchTrackedManifest(drifted, manifest));
  const extra = JSON.parse(serializeReleaseAssetManifest(manifest));
  extra.note = "nope";
  expectThrow("tracked extra field", () => parseTrackedReleaseAssetManifest(JSON.stringify(extra)));
  const noIntegrity = JSON.parse(serializeReleaseAssetManifest(manifest));
  delete noIntegrity.assets[0].npmIntegrity;
  expectThrow("tgz missing npmIntegrity", () => parseTrackedReleaseAssetManifest(JSON.stringify(noIntegrity)));
  const usage = spawnSync(process.execPath, [join(scripts, "build-release-artifacts.mjs")], { encoding: "utf8" });
  if (usage.status !== 2 || !usage.stderr.includes("--freeze") || !usage.stderr.includes("--check") || !usage.stderr.includes("--write")) {
    throw new Error(`build-release-artifacts 用法未包含三模式:${JSON.stringify({ status: usage.status, stderr: usage.stderr })}`);
  }
}

async function testUniqueness() {
  const tag = "v0.1.0-rc.4";
  const page1 = Array.from({ length: 100 }, (_, index) => run("v0.1.0-rc.3", sha("1"), { id: index + 1 }));
  const page2 = [
    run("v0.0.9", sha("2"), { id: 201 }),
    run(tag, sha("e"), { id: 202 }),
    run("v0.0.8", sha("3"), { id: 203 })
  ];
  const paged = pagesFetcher([page1, page2]);
  const collected = await collectPushRuns(paged.fetchPage);
  if (paged.calls.length !== 2 || paged.calls.some((item) => item.perPage !== 100)) {
    throw new Error(`分页未按每页 100 读到短页:${JSON.stringify(paged.calls)}`);
  }
  evaluateTagWorkflowHistory({
    ...collected,
    tag,
    requirement: { mode: "exactly-one", headSha: sha("e"), runId: 202, requireCompleted: true }
  });

  const zero = await collectPushRuns(pagesFetcher([page1, [run("other", sha("9"), { id: 999 })]]).fetchPage);
  evaluateTagWorkflowHistory({ ...zero, tag, requirement: { mode: "zero" } });
  await expectThrowAsync("zero history with a run", async () =>
    evaluateTagWorkflowHistory({ ...collected, tag, requirement: { mode: "zero" } })
  );

  const twoShas = await collectPushRuns(
    pagesFetcher([[run(tag, sha("e"), { id: 1 }), run(tag, sha("f"), { id: 2 })]]).fetchPage
  );
  await expectThrowAsync("same tag two SHAs", async () =>
    evaluateTagWorkflowHistory({ ...twoShas, tag, requirement: { mode: "exactly-one", headSha: sha("e") } })
  );

  const rerun = await collectPushRuns(pagesFetcher([[run(tag, sha("e"), { id: 7, run_attempt: 2 })]]).fetchPage);
  await expectThrowAsync("attempt=2", async () =>
    evaluateTagWorkflowHistory({ ...rerun, tag, requirement: { mode: "exactly-one", headSha: sha("e"), runId: 7 } })
  );

  const dupPage1 = Array.from({ length: 100 }, (_, index) => run("other", sha("0"), { id: index + 1 }));
  dupPage1[41] = run(tag, sha("e"), { id: 42 });
  const dupPages = pagesFetcher([dupPage1, [run(tag, sha("e"), { id: 42 }), run("other", sha("0"), { id: 201 })]]);
  const duplicated = await collectPushRuns(dupPages.fetchPage);
  await expectThrowAsync("cross-page duplicate", async () =>
    evaluateTagWorkflowHistory({ ...duplicated, tag, requirement: { mode: "exactly-one", headSha: sha("e") } })
  );

  const seen = [];
  const fetchPage = createGhWorkflowRunPageFetcher({
    repo: "Octo-o-o-o/SayDo",
    execText: (_file, args) => {
      seen.push(args.at(-1));
      return JSON.stringify({ workflow_runs: [] });
    }
  });
  await fetchPage(3, 100);
  if (!seen[0].includes("per_page=100&page=3") || seen[0].includes("head_sha=") || seen[0].includes("branch=")) {
    throw new Error(`fetcher URL 非法:${seen[0]}`);
  }
  await expectThrowAsync("perPage 50", async () => fetchPage(1, 50));
}

function qualifyingRuleset(overrides = {}) {
  return {
    id: 11,
    target: "tag",
    enforcement: "active",
    bypass_actors: [],
    conditions: { ref_name: { include: ["refs/tags/v*"], exclude: [] } },
    rules: [{ type: "deletion" }, { type: "update" }],
    ...overrides
  };
}

function testRuleset() {
  const tag = "v0.1.0-rc.4";
  evaluateActiveTagRuleset([qualifyingRuleset()], tag);
  evaluateActiveTagRuleset([qualifyingRuleset({ conditions: { ref_name: { include: ["refs/tags/v0.1.0-rc.4"], exclude: [] } } })], tag);
  if (!githubRefPatternMatches("refs/tags/v*", "refs/tags/v0.1.0-rc.4")) throw new Error("v* 应覆盖 rc.4");
  expectThrow("missing deletion", () => evaluateActiveTagRuleset([qualifyingRuleset({ rules: [{ type: "update" }] })], tag));
  expectThrow("missing update", () => evaluateActiveTagRuleset([qualifyingRuleset({ rules: [{ type: "deletion" }] })], tag));
  expectThrow("bypass", () => evaluateActiveTagRuleset([qualifyingRuleset({ bypass_actors: [{ actor_id: 1, actor_type: "OrganizationAdmin" }] })], tag));
  expectThrow("branch target", () => evaluateActiveTagRuleset([qualifyingRuleset({ target: "branch" })], tag));
  expectThrow("evaluate mode", () => evaluateActiveTagRuleset([qualifyingRuleset({ enforcement: "evaluate" })], tag));
  expectThrow("exclude tag", () =>
    evaluateActiveTagRuleset(
      [qualifyingRuleset({ conditions: { ref_name: { include: ["refs/tags/v*"], exclude: ["refs/tags/v0.1.0-rc.4"] } } })],
      tag
    )
  );
  expectThrow("include too narrow", () =>
    evaluateActiveTagRuleset(
      [qualifyingRuleset({ conditions: { ref_name: { include: ["refs/tags/v0.2*"], exclude: [] } } })],
      tag
    )
  );
  expectThrow("~ALL unsupported", () => githubRefPatternMatches("~ALL", "refs/tags/v0.1.0-rc.4"));
  expectThrow("character class unsupported", () => githubRefPatternMatches("refs/tags/v[0-9]*", "refs/tags/v0.1.0-rc.4"));
  expectThrow("double star unsupported", () => githubRefPatternMatches("refs/tags/**", "refs/tags/v0.1.0-rc.4"));
  expectThrow("~ALL ruleset", () =>
    evaluateActiveTagRuleset([qualifyingRuleset({ conditions: { ref_name: { include: ["~ALL"], exclude: [] } } })], tag)
  );
}

function assertExactOriginals(originals, evidencePath, physicalDir, label) {
  for (const [path, bytes] of Object.entries(originals)) {
    if (!readFileSync(path).equals(bytes)) throw new Error(`rollback 字节不一致:${label}:${path}`);
  }
  if (existsSync(evidencePath)) throw new Error(`rollback 未删除新证据:${label}`);
  if (existsSync(physicalDir)) throw new Error(`rollback 未删除新物理目录:${label}`);
}

async function testAvailabilityRollback() {
  const root = mkdtempSync(join(tmpdir(), "saydo-avail-"));
  try {
    const copyPaths = Array.from({ length: 7 }, (_, index) => join(root, `copy-${index}.txt`));
    const originals = {};
    for (const [index, path] of copyPaths.entries()) {
      originals[path] = Buffer.from(`before-${index}\n`);
      writeFileSync(path, originals[path]);
    }
    const evidencePath = join(root, "evidence.json");
    const auditPath = join(root, "audit.md");
    const physicalDir = join(root, "physical");
    originals[auditPath] = Buffer.from("old-audit\n");
    writeFileSync(auditPath, originals[auditPath]);
    const snapshotPaths = [...copyPaths, evidencePath, physicalDir, auditPath];
    const runMutate = async (io, afterWrites) =>
      runMutationsWithRollback({
        snapshotPaths,
        io,
        mutate: async ({ writeAtomic, writeDirAtomic }) => {
          writeDirAtomic(physicalDir, [{ name: "mac.json", content: '{"ok":true}\n' }]);
          for (const [index, path] of copyPaths.entries()) writeAtomic(path, Buffer.from(`after-${index}\n`));
          writeAtomic(evidencePath, Buffer.from('{"ok":true}\n'));
          writeAtomic(auditPath, Buffer.from("new-audit\n"));
          if (afterWrites) afterWrites();
        }
      });
    const cases = [
      { name: "rename-first", failRename: 1 },
      { name: "rename-middle", failRename: 5 },
      { name: "physical-dir", failTo: physicalDir },
      { name: "evidence", failTo: evidencePath },
      { name: "audit-last", failTo: auditPath }
    ];
    for (const testCase of cases) {
      for (const [path, bytes] of Object.entries(originals)) writeFileSync(path, bytes);
      rmSync(evidencePath, { force: true });
      rmSync(physicalDir, { recursive: true, force: true });
      let renameCount = 0;
      const io = {
        ...defaultFsIo,
        rename(from, to) {
          renameCount += 1;
          if (testCase.failRename === renameCount || testCase.failTo === to) throw new Error(`injected ${testCase.name}`);
          return defaultFsIo.rename(from, to);
        }
      };
      const error = await expectThrowAsync(testCase.name, async () => runMutate(io));
      if (!String(error.message).includes("injected") && !String(error.errors?.[0]?.message ?? "").includes("injected")) {
        throw new Error(`rollback 抛出非注入错误:${testCase.name}:${error.message}`);
      }
      if (renameCount < 1) throw new Error(`未发生真实 rename:${testCase.name}`);
      assertExactOriginals(originals, evidencePath, physicalDir, testCase.name);
    }
    for (const [path, bytes] of Object.entries(originals)) writeFileSync(path, bytes);
    rmSync(evidencePath, { force: true });
    rmSync(physicalDir, { recursive: true, force: true });
    let finishedWrites = false;
    const auditCheckError = await expectThrowAsync("audit-check", async () =>
      runMutate(defaultFsIo, () => {
        finishedWrites = true;
        throw new Error("injected audit-check");
      })
    );
    if (!finishedWrites) throw new Error("audit-check 未在全部写完后失败");
    if (!String(auditCheckError.message).includes("injected audit-check")) throw new Error("audit-check 未保留原错");
    assertExactOriginals(originals, evidencePath, physicalDir, "audit-check");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

async function testSnapshotSafety() {
  const root = mkdtempSync(join(tmpdir(), "saydo-snap-"));
  try {
    const filePath = join(root, "plain.txt");
    writeFileSync(filePath, "plain\n");
    const linkPath = join(root, "link.txt");
    symlinkSync("/etc/passwd", linkPath);
    let mutations = 0;
    await expectThrowAsync("top-level symlink", async () =>
      runMutationsWithRollback({
        snapshotPaths: [linkPath],
        mutate: async () => {
          mutations += 1;
        }
      })
    );
    if (mutations !== 0) throw new Error("顶层 symlink 仍发生 mutation");

    const nested = join(root, "tree");
    mkdirSync(nested);
    writeFileSync(join(nested, "ok.txt"), "ok\n");
    symlinkSync("/etc/passwd", join(nested, "nested-link"));
    mutations = 0;
    await expectThrowAsync("nested symlink", async () =>
      runMutationsWithRollback({
        snapshotPaths: [nested],
        mutate: async () => {
          mutations += 1;
        }
      })
    );
    if (mutations !== 0) throw new Error("嵌套 symlink 仍发生 mutation");

    mutations = 0;
    await expectThrowAsync("overlap snapshot", async () =>
      runMutationsWithRollback({
        snapshotPaths: [root, filePath],
        mutate: async () => {
          mutations += 1;
        }
      })
    );
    if (mutations !== 0) throw new Error("重叠 snapshot 仍发生 mutation");

    await runMutationsWithRollback({
      snapshotPaths: [filePath],
      mutate: async ({ writeAtomic }) => {
        rmSync(filePath);
        mkdirSync(filePath);
        writeFileSync(join(filePath, "inside.txt"), "x\n");
        throw new Error("injected file-to-dir");
      }
    }).then(
      () => {
        throw new Error("file→dir 未抛出");
      },
      (error) => {
        if (!String(error.message).includes("injected file-to-dir")) throw error;
      }
    );
    if (lstatSync(filePath).isDirectory() || readFileSync(filePath, "utf8") !== "plain\n") {
      throw new Error("file→dir 未精确回滚");
    }

    const dirPath = join(root, "dir-target");
    mkdirSync(dirPath);
    writeFileSync(join(dirPath, "child.txt"), "child\n");
    await runMutationsWithRollback({
      snapshotPaths: [dirPath],
      mutate: async () => {
        rmSync(dirPath, { recursive: true, force: true });
        writeFileSync(dirPath, "now-file\n");
        throw new Error("injected dir-to-file");
      }
    }).then(
      () => {
        throw new Error("dir→file 未抛出");
      },
      (error) => {
        if (!String(error.message).includes("injected dir-to-file")) throw error;
      }
    );
    if (!lstatSync(dirPath).isDirectory() || readFileSync(join(dirPath, "child.txt"), "utf8") !== "child\n") {
      throw new Error("dir→file 未精确回滚");
    }

    const a = join(root, "a.txt");
    const b = join(root, "b.txt");
    writeFileSync(a, "A\n");
    writeFileSync(b, "B\n");
    const restoreAttempts = [];
    let restoring = false;
    const restoreError = await expectThrowAsync("two restore failures", async () =>
      runMutationsWithRollback({
        snapshotPaths: [a, b],
        io: {
          ...defaultFsIo,
          rename(from, to) {
            if (restoring && (to === a || to === b)) {
              restoreAttempts.push(to);
              throw new Error(`restore-rename ${to}`);
            }
            return defaultFsIo.rename(from, to);
          }
        },
        mutate: async ({ writeAtomic }) => {
          writeAtomic(a, Buffer.from("A2\n"));
          writeAtomic(b, Buffer.from("B2\n"));
          restoring = true;
          throw new Error("injected dual");
        }
      })
    );
    if (!(restoreError instanceof AggregateError)) throw new Error("双 restore 失败未聚合");
    if (!String(restoreError.errors[0].message).includes("injected dual")) throw new Error("双 restore 失败掩盖了 mutation error");
    if (restoreAttempts.length < 2) throw new Error(`双 restore 未全部尝试:${JSON.stringify(restoreAttempts)}`);

    const tempRmError = await expectThrowAsync("temp rm fail", async () => {
      writeFileAtomic(join(root, "atomic.txt"), "x\n", {
        ...defaultFsIo,
        rename() {
          throw new Error("injected rename");
        },
        rm(path) {
          if (String(path).includes(".tmp") || String(path).includes(".partial-")) throw new Error("injected temp rm");
          return defaultFsIo.rm(path);
        }
      });
    });
    if (!(tempRmError instanceof AggregateError)) throw new Error("temp cleanup 失败未聚合");
    const danglingAtomic = join(root, "dangling-atomic.json");
    symlinkSync(join(root, "missing-atomic.json"), danglingAtomic);
    expectThrow("atomic refuses dangling", () => writeFileAtomic(danglingAtomic, "x\n"));
    if (!lstatSync(danglingAtomic).isSymbolicLink()) throw new Error("writeFileAtomic 覆盖了 dangling symlink");
    const dirAtomic = join(root, "dir-atomic.json");
    mkdirSync(dirAtomic);
    expectThrow("atomic refuses dir", () => writeFileAtomic(dirAtomic, "x\n"));
    if (!lstatSync(dirAtomic).isDirectory()) throw new Error("writeFileAtomic 覆盖了目录");

    const expectedBytes = Buffer.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ01234567");
    if (expectedBytes.length !== 34) throw new Error("短写夹具长度不是 34");
    let shortCalls = 0;
    const shortChunks = [];
    writeFdFully(
      {
        write(_fd, chunk) {
          shortCalls += 1;
          const take = Math.min(17, chunk.length);
          shortChunks.push(Buffer.from(chunk.subarray(0, take)));
          return take;
        }
      },
      1,
      expectedBytes
    );
    if (!Buffer.concat(shortChunks).equals(expectedBytes)) throw new Error("多次短写后字节不完整");
    if (shortCalls < 2) throw new Error("短写未循环到完整长度");
    writeFdFully(
      {
        write(_fd, chunk) {
          return Math.min(8, chunk.length);
        }
      },
      1,
      Buffer.alloc(24, 65)
    );

    expectThrow("write returns 0", () =>
      writeFdFully(
        {
          write() {
            return 0;
          }
        },
        1,
        expectedBytes
      )
    );
    expectThrow("write returns illegal count", () =>
      writeFdFully(
        {
          write() {
            return 99;
          }
        },
        1,
        expectedBytes
      )
    );
    expectThrow("write throws", () =>
      writeFdFully(
        {
          write() {
            throw new Error("injected write");
          }
        },
        1,
        expectedBytes
      )
    );

    const closeOkPath = join(root, "close-ok.json");
    writeFileSync(closeOkPath, "before\n");
    const closeOkStat = lstatSync(closeOkPath);
    replaceRegularFileInPlace(closeOkPath, Buffer.from("after\n"), {
      dev: String(closeOkStat.dev),
      ino: String(closeOkStat.ino)
    });
    if (readFileSync(closeOkPath, "utf8") !== "after\n") throw new Error("成功关闭路径未写入完整内容");

    const closeFailPath = join(root, "close-fail.json");
    writeFileSync(closeFailPath, "before\n");
    const closeFailStat = lstatSync(closeFailPath);
    expectThrow("persist close fail-closed", () =>
      replaceRegularFileInPlace(closeFailPath, Buffer.from("after\n"), { dev: closeFailStat.dev, ino: closeFailStat.ino }, {
        ...defaultFsIo,
        anchored: {
          persist() {
            return { ok: false, error: "部署证据写入失败" };
          }
        }
      })
    );

    expectThrow("dir member backslash", () => assertSafeDirMemberName("a\\b.json"));
    expectThrow("dir member parent", () => assertSafeDirMemberName(".."));
    expectThrow("dir member absolute", () => writeDirAtomic(join(root, "nope-dir"), [{ name: "/tmp/x", content: "x" }]));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

async function testAvailabilitySnapshotRace() {
  const root = mkdtempSync(join(tmpdir(), "saydo-avail-race-"));
  try {
    const file = join(root, "page.txt");
    const candidate = "intro CANDIDATE_MARK end\n";
    const available = "intro AVAILABLE_MARK end\n";
    const changed = "CHANGED-B\n";
    const replacements = [{ path: "page.txt", before: "CANDIDATE_MARK", after: "AVAILABLE_MARK" }];
    writeFileSync(file, candidate);
    let mutations = 0;
    const raceError = await expectThrowAsync("precheck A-to-B", async () =>
      runMutationsWithRollback({
        snapshotPaths: [file],
        preflight: ({ snapshot }) => {
          applyAvailabilityReplacementsFromSnapshot(snapshot, replacements, root);
        },
        afterPreflight: () => {
          writeFileSync(file, changed);
        },
        mutate: async ({ snapshot, writeAtomic }) => {
          mutations += 1;
          const { writes } = applyAvailabilityReplacementsFromSnapshot(snapshot, replacements, root);
          writeAtomic(writes[0].path, writes[0].content);
        }
      })
    );
    if (mutations !== 0) throw new Error("A→B 竞态后仍发生 mutation");
    if (readFileSync(file, "utf8") !== changed) throw new Error("A→B 竞态用旧 A 覆盖了 B");
    if (readFileSync(file, "utf8").includes("AVAILABLE_MARK")) throw new Error("A→B 竞态写入了旧 replacement");
    if (!String(raceError.message).includes("第一次 mutation 前工作树已偏离 snapshot")) {
      throw new Error(`A→B 竞态错误不符:${raceError.message}`);
    }
    writeFileSync(file, candidate);
    await runMutationsWithRollback({
      snapshotPaths: [file],
      mutate: async ({ snapshot, writeAtomic }) => {
        if (Buffer.from(snapshot[0].bytes).toString("utf8") !== candidate) throw new Error("成功路径 snapshot 不是当前 candidate bytes");
        const { writes } = applyAvailabilityReplacementsFromSnapshot(snapshot, replacements, root);
        if (writes.length !== 1 || writes[0].content !== available) throw new Error("replacement 不是从 snapshot bytes 派生");
        writeAtomic(writes[0].path, writes[0].content);
      }
    });
    if (readFileSync(file, "utf8") !== available) throw new Error("成功路径未写入 snapshot 派生 replacement");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function canonicalHost(project) {
  return PAGES_CANONICAL_HOSTS[project];
}

function makeFreshLease() {
  const dir = mkdtempSync(join(tmpdir(), "saydo-lease-"));
  const path = join(dir, "evidence.json");
  return { dir, path, lease: acquireDeployEvidenceLease(path) };
}

function makeExistingLease(existing) {
  const dir = mkdtempSync(join(tmpdir(), "saydo-lease-"));
  const path = join(dir, "evidence.json");
  const text = typeof existing === "string" ? existing : `${JSON.stringify(existing)}\n`;
  writeFileSync(path, text);
  return { dir, path, lease: acquireDeployEvidenceLease(path) };
}

function cleanupLease(handle) {
  if (handle?.dir) rmSync(handle.dir, { recursive: true, force: true });
}

function previewUrl(project) {
  return `https://abc123.${canonicalHost(project)}`;
}

function projectReadback(project, extras = {}) {
  return {
    name: extras.name ?? project,
    canonical_deployment: extras.canonical_deployment ?? { id: deploymentId(project, "production"), url: previewUrl(project) },
    domains: extras.domains ?? [canonicalHost(project), project === "saydo" ? "saydo.octoooo.com" : "link.saydo.octoooo.com"]
  };
}

function deploymentRecord({ project, environment, branch, publicMain, url, extras = {} }) {
  return {
    id: extras.id ?? deploymentId(project, environment),
    project_name: extras.project_name ?? project,
    environment: extras.environment ?? environment,
    url: extras.url ?? url,
    latest_stage: { name: "deploy", status: extras.stageStatus ?? "success" },
    deployment_trigger: {
      metadata: {
        branch: extras.branch ?? branch,
        commit_hash: extras.commit_hash ?? publicMain,
        commit_dirty: extras.commit_dirty ?? false
      }
    }
  };
}

function currentAvailabilityBody() {
  return "v0.1.0-rc.4 固定 URL 已由不可变 GitHub Release immutable v0.1.0-rc.4 GitHub Release https://saydo.octoooo.com";
}

const officialPagesFixture = [
  { project: "saydo", host: "saydo.octoooo.com", url: "https://saydo.octoooo.com/", marker: "v0.1.0-rc.4 固定 URL 已由不可变 GitHub Release" },
  { project: "saydo-link", host: "link.saydo.octoooo.com", url: "https://link.saydo.octoooo.com/", marker: "https://saydo.octoooo.com" }
];


async function testDeployStateMachine() {
  const sites = [
    { project: "saydo", directory: "deploy/saydo-octoooo-com", previewBranch: "preview-v0.1.0-rc.4", productionBranch: "main" },
    { project: "saydo-link", directory: "deploy/link-saydo-octoooo-com", previewBranch: "preview-v0.1.0-rc.4", productionBranch: "main" }
  ];
  const seed = { release: { tag: "v0.1.0-rc.4" }, publicMain: sha("1").slice(0, 40), publicCi: { workflowRunId: 9 } };

  async function runCase(name, fail) {
    const handle = makeFreshLease();
    const calls = [];
    const persisted = [];
    const durable = [];
    const durableAtAudit = [];
    try {
      const error = await (async () => {
        try {
          const evidence = await runPagesDeployStateMachine({
            evidenceSeed: seed,
            sites,
            wrangler: async (req) => {
              calls.push(["wrangler", req.stage, req.project, req.branch]);
              if (fail === "preview-first" && req.stage === "preview" && req.project === "saydo") throw new Error("preview 1");
              if (fail === "preview-second" && req.stage === "preview" && req.project === "saydo-link") throw new Error("preview 2");
              if (fail === "production-first" && req.stage === "production" && req.project === "saydo") throw new Error("production 1");
              if (fail === "production-second" && req.stage === "production" && req.project === "saydo-link") throw new Error("production 2");
              return `Deployed to ${previewUrl(req.project)}`;
            },
            listDeployments: async ({ project, environment }) => {
              calls.push(["listDeployments", project, environment]);
              const branch = environment === "preview" ? "preview-v0.1.0-rc.4" : "main";
              return [
                deploymentRecord({
                  project,
                  environment,
                  branch,
                  publicMain: seed.publicMain,
                  url: previewUrl(project)
                })
              ];
            },
            readProject: async ({ project }) => {
              calls.push(["readProject", project]);
              return projectReadback(project);
            },
            fetchHttp: async (url) => {
              calls.push(["fetch", url]);
              if (fail === "domains" && url.includes("saydo.octoooo.com")) {
                return { ok: true, status: 200, url, body: "old candidate fixed URL" };
              }
              return { ok: true, status: 200, url, body: currentAvailabilityBody() };
            },
            officialPages: officialPagesFixture,
            persist: async (evidence) => {
              persisted.push(structuredClone(evidence));
              calls.push(["persist", evidence.status, evidence.failedStage ?? null, evidence.sites?.[0]?.preview?.status, evidence.sites?.[0]?.production?.status]);
              if (fail === "persist-first" && persisted.length === 1) throw new Error("persist started");
              if (fail === "preview-persist-after-success" && evidence.sites?.[0]?.preview?.status === "verified" && evidence.status === "started") {
                throw new Error("persist after preview");
              }
              if (fail === "production-persist-after-success" && evidence.sites?.[0]?.production?.status === "deployed" && evidence.status === "started") {
                throw new Error("persist after production");
              }
              if (fail === "persist-continuous") {
                if (evidence.sites?.[0]?.preview?.status === "verified" || evidence.status === "partial_failed") {
                  throw new Error("persist continuous");
                }
              }
              if (fail === "audit-pending-persist" && evidence.status === "audit_pending") {
                throw new Error("persist audit_pending");
              }
              if (fail === "completed-persist" && evidence.status === "completed") {
                throw new Error("persist completed");
              }
              if (fail === "audit-failed-persist-retry" && evidence.status === "audit_failed") {
                const attempts = persisted.filter((item) => item.status === "audit_failed").length;
                if (attempts === 1) throw new Error("audit_failed persist first");
              }
              if (fail === "audit-failed-persist-continuous" && evidence.status === "audit_failed") {
                throw new Error("持续 audit persist failure");
              }
              durable.push(structuredClone(evidence));
            },
            audit: async () => {
              durableAtAudit.push(...durable.map((item) => item.status));
              calls.push(["audit"]);
              if (durableAtAudit.includes("completed")) {
                throw new Error("audit 调用前的耐久快照绝无 completed");
              }
              if (fail === "audit" || fail === "audit-failed-persist-retry" || fail === "audit-failed-persist-continuous") {
                throw new Error("audit failed");
              }
            },
            lease: handle.lease
          });
          return { evidence, error: null };
        } catch (caught) {
          return { evidence: persisted.at(-1) ?? null, error: caught };
        }
      })();
      return { name, fail, calls, persisted, durable, durableAtAudit, ...error };
    } finally {
      cleanupLease(handle);
    }
  }

  const previewFirst = await runCase("preview-first", "preview-first");
  if (!previewFirst.error) throw new Error("首个 preview 失败应收口");
  if (previewFirst.persisted[0]?.status !== "started") throw new Error("首个 preview 前未写 started");
  if (previewFirst.calls.some((item) => item[0] === "wrangler" && item[1] === "production")) {
    throw new Error("首个 preview 失败后仍有 production");
  }
  if (previewFirst.persisted.at(-1)?.status !== "partial_failed" || previewFirst.persisted.at(-1)?.failedStage !== "preview:saydo") {
    throw new Error(`首个 preview 失败状态不符:${JSON.stringify(previewFirst.persisted.at(-1))}`);
  }

  const previewSecond = await runCase("preview-second", "preview-second");
  const previewWranglers = previewSecond.calls.filter((item) => item[0] === "wrangler");
  if (previewWranglers.length !== 2 || previewWranglers.some((item) => item[1] === "production")) {
    throw new Error(`第二 preview 失败仍出现 production:${JSON.stringify(previewWranglers)}`);
  }
  if (previewSecond.persisted.at(-1)?.failedStage !== "preview:saydo-link") throw new Error("第二 preview failedStage 不符");

  const productionFirst = await runCase("production-first", "production-first");
  if (productionFirst.persisted.at(-1)?.failedStage !== "production:saydo") throw new Error("第一 production failedStage 不符");
  if (productionFirst.calls.filter((item) => item[0] === "wrangler" && item[1] === "production").length !== 1) {
    throw new Error("第一 production 失败后仍继续第二站");
  }

  const productionSecond = await runCase("production-second", "production-second");
  if (productionSecond.persisted.at(-1)?.failedStage !== "production:saydo-link") throw new Error("第二 production failedStage 不符");
  if (!productionSecond.persisted.at(-1)?.completedSites?.includes("saydo")) throw new Error("第二 production 失败未保留已完成站点");

  const domains = await runCase("domains", "domains");
  if (domains.persisted.at(-1)?.status !== "partial_failed" || domains.persisted.at(-1)?.failedStage !== "production-domains") {
    throw new Error("正式域名失败状态不符");
  }

  const persistFirst = await runCase("persist-first", "persist-first");
  if (!persistFirst.error?.persistFailed) throw new Error("evidence 持久化失败未标记 persistFailed");
  if (persistFirst.calls.some((item) => item[0] === "wrangler")) throw new Error("started 持久化失败后仍调用 Wrangler");

  const audit = await runCase("audit", "audit");
  if (!audit.error || audit.persisted.at(-1)?.status !== "audit_failed") throw new Error("audit 失败未写 audit_failed");
  if (audit.persisted.at(-1)?.sites?.some((site) => site.production.status !== "deployed")) {
    throw new Error("audit 失败覆盖了真实部署结果");
  }
  if (!audit.durable.some((item) => item.status === "audit_pending")) throw new Error("audit 失败前未耐久化 audit_pending");
  if (audit.durable.some((item) => item.status === "completed") || audit.durableAtAudit.includes("completed")) {
    throw new Error("audit 失败路径出现 completed");
  }

  const success = await runCase("success", null);
  if (success.error) throw new Error(`全成功路径失败:${success.error.message}`);
  const wranglerOrder = success.calls.filter((item) => item[0] === "wrangler").map((item) => `${item[1]}:${item[2]}:${item[3]}`);
  if (
    JSON.stringify(wranglerOrder) !==
    JSON.stringify([
      "preview:saydo:preview-v0.1.0-rc.4",
      "preview:saydo-link:preview-v0.1.0-rc.4",
      "production:saydo:main",
      "production:saydo-link:main"
    ])
  ) {
    throw new Error(`全成功外部调用顺序不符:${JSON.stringify(wranglerOrder)}`);
  }
  if (success.persisted[0]?.status !== "started" || success.evidence.status !== "completed") {
    throw new Error("全成功路径未从 started 到 completed");
  }
  if (!success.calls.some((item) => item[0] === "audit") || !success.calls.some((item) => item[0] === "readProject")) {
    throw new Error("全成功路径缺 audit 或 project production readback");
  }
  if (success.calls.filter((item) => item[0] === "listDeployments").length !== 4) {
    throw new Error("全成功路径未对每次部署做 deployment list readback");
  }
  const auditCallAt = success.calls.findIndex((item) => item[0] === "audit");
  const persistBeforeAudit = success.calls.slice(0, auditCallAt).filter((item) => item[0] === "persist");
  const persistAfterAudit = success.calls.slice(auditCallAt).filter((item) => item[0] === "persist");
  if (auditCallAt < 0 || persistBeforeAudit.at(-1)?.[1] !== "audit_pending") {
    throw new Error("audit_pending 正常落盘顺序失败: audit 前最后耐久态不是 audit_pending");
  }
  if (persistBeforeAudit.some((item) => item[1] === "completed") || success.durableAtAudit.includes("completed")) {
    throw new Error("audit 调用前的耐久快照绝无 completed");
  }
  if (persistAfterAudit[0]?.[1] !== "completed" || success.durable.at(-1)?.status !== "completed") {
    throw new Error("audit 成功后未把 completed 落盘");
  }

  const pendingPersist = await runCase("audit-pending-persist", "audit-pending-persist");
  if (!pendingPersist.error?.persistFailed) throw new Error("audit_pending persist 失败未标记 persistFailed");
  if (pendingPersist.calls.some((item) => item[0] === "audit")) throw new Error("audit_pending persist 失败后仍运行 audit");
  if (pendingPersist.error.lastDurableStatus === "completed" || pendingPersist.durable.some((item) => item.status === "completed")) {
    throw new Error("audit_pending persist 失败后出现 completed");
  }
  if (pendingPersist.durable.some((item) => item.status === "audit_pending")) {
    throw new Error("audit_pending persist 失败仍被记为耐久成功");
  }

  const auditFailedRetry = await runCase("audit-failed-persist-retry", "audit-failed-persist-retry");
  if (!auditFailedRetry.error || auditFailedRetry.error.persistFailed) {
    throw new Error("audit 抛错且 audit_failed 首次 persist 失败后 retry 成功 不应标记 persistFailed");
  }
  if (auditFailedRetry.error.message !== "部署失败") throw new Error("retry 成功后未抛出受控常量错误");
  if (auditFailedRetry.durable.at(-1)?.status !== "audit_failed") throw new Error("audit_failed 首次 persist 失败后 retry 未落盘");
  if (auditFailedRetry.durable.some((item) => item.status === "completed") || auditFailedRetry.durableAtAudit.includes("completed")) {
    throw new Error("audit_failed retry 路径出现 completed");
  }
  if (auditFailedRetry.persisted.filter((item) => item.status === "audit_failed").length < 2) {
    throw new Error("audit_failed 未做 emergency retry");
  }

  const auditFailedContinuous = await runCase("audit-failed-persist-continuous", "audit-failed-persist-continuous");
  if (!(auditFailedContinuous.error instanceof AggregateError) || !auditFailedContinuous.error.persistFailed) {
    throw new Error("持续 audit persist failure 未聚合 persistFailed");
  }
  if (auditFailedContinuous.error.lastDurableStatus !== "audit_pending") {
    throw new Error(`持续 audit persist failure 最后耐久态不是 audit_pending:${String(auditFailedContinuous.error.lastDurableStatus)}`);
  }
  const aggregated = auditFailedContinuous.error.errors.map((item) => String(item?.message ?? item));
  if (aggregated.some((message) => message.includes("audit failed") || message.includes("持续 audit persist failure"))) {
    throw new Error("持续 audit persist failure 泄漏了未拥有错误原文");
  }
  if (!aggregated.every((message) => message === "部署失败")) {
    throw new Error("持续 audit persist failure 未收敛为受控常量");
  }
  if (auditFailedContinuous.durable.at(-1)?.status !== "audit_pending" || auditFailedContinuous.durable.some((item) => item.status === "completed")) {
    throw new Error("持续 audit persist failure 耐久态被推进到成功终态");
  }

  const completedPersist = await runCase("completed-persist", "completed-persist");
  if (!completedPersist.error?.persistFailed) throw new Error("audit 成功但 completed persist 失败 未标记 persistFailed");
  if (completedPersist.error.lastDurableStatus !== "audit_pending") {
    throw new Error(`completed persist 失败后最后耐久态不是 audit_pending:${String(completedPersist.error.lastDurableStatus)}`);
  }
  if (!completedPersist.calls.some((item) => item[0] === "audit")) throw new Error("completed persist 失败路径未调用 audit");
  if (completedPersist.durable.some((item) => item.status === "completed") || completedPersist.durableAtAudit.includes("completed")) {
    throw new Error("completed persist 失败仍把 completed 记为耐久成功");
  }

  function recoverySnapshot(status, patch = {}) {
    const sitesEvidence = sites.map((site) => ({
      project: site.project,
      directory: site.directory,
      planned: {
        previewBranch: site.previewBranch,
        productionBranch: site.productionBranch,
        canonicalHost: canonicalHost(site.project)
      },
      preview: {
        status: "verified",
        url: previewUrl(site.project),
        httpStatus: 200,
        deployment: {
          id: deploymentId(site.project, "preview"),
          project_name: site.project,
          environment: "preview",
          url: previewUrl(site.project),
          branch: site.previewBranch,
          commit_hash: seed.publicMain,
          commit_dirty: false,
          latest_stage_status: "success"
        }
      },
      production: {
        status: "deployed",
        url: previewUrl(site.project),
        httpStatus: 200,
        deployment: {
          id: deploymentId(site.project, "production"),
          project_name: site.project,
          environment: "production",
          url: previewUrl(site.project),
          branch: site.productionBranch,
          commit_hash: seed.publicMain,
          commit_dirty: false,
          latest_stage_status: "success"
        }
      }
    }));
    return {
      schemaVersion: 1,
      status,
      release: seed.release,
      publicMain: seed.publicMain,
      publicCi: seed.publicCi,
      completedSites: sites.map((site) => site.project),
      failedStage: null,
      error: status === "audit_failed" ? { message: "audit failed" } : null,
      sites: sitesEvidence,
      ...patch
    };
  }

  async function runRecovery(name, existing, overrides = {}) {
    const handle = makeExistingLease(existing);
    const calls = [];
    const persisted = [];
    const durable = [];
    try {
      const { lease: _ignoredLease, ...restOverrides } = overrides;
      const error = await (async () => {
        try {
          const evidence = await runPagesDeployStateMachine({
            evidenceSeed: seed,
            sites,
            wrangler: async (req) => {
              calls.push(["wrangler", req.stage, req.project]);
              throw new Error("不应调用 wrangler");
            },
            listDeployments: async ({ project, environment }) => {
              calls.push(["listDeployments", project, environment]);
              const branch = environment === "preview" ? "preview-v0.1.0-rc.4" : "main";
              return [
                deploymentRecord({
                  project,
                  environment,
                  branch,
                  publicMain: seed.publicMain,
                  url: previewUrl(project)
                })
              ];
            },
            readProject: async ({ project }) => {
              calls.push(["readProject", project]);
              return projectReadback(project);
            },
            fetchHttp: async (url) => {
              calls.push(["fetch", url]);
              return { ok: true, status: 200, url, body: currentAvailabilityBody() };
            },
            officialPages: officialPagesFixture,
            persist: async (snapshot) => {
              persisted.push(structuredClone(snapshot));
              calls.push(["persist", snapshot.status]);
              durable.push(structuredClone(snapshot));
            },
            audit: async () => {
              calls.push(["audit"]);
            },
            ...restOverrides,
            lease: handle.lease
          });
          return { evidence, error: null };
        } catch (caught) {
          return { evidence: persisted.at(-1) ?? null, error: caught };
        }
      })();
      return { name, calls, persisted, durable, ...error };
    } finally {
      cleanupLease(handle);
    }
  }

  function assertZeroRedeploy(result, label) {
    if (result.calls.some((item) => item[0] === "wrangler")) throw new Error(`${label} 恢复路径调用了 wrangler`);
  }

  const recoverPending = await runRecovery("既有 audit_pending", recoverySnapshot("audit_pending"));
  if (recoverPending.error) throw new Error(`既有 audit_pending 恢复失败:${recoverPending.error.message}`);
  assertZeroRedeploy(recoverPending, "既有 audit_pending");
  if (!recoverPending.calls.some((item) => item[0] === "audit")) throw new Error("既有 audit_pending 恢复未跑 audit");
  if (recoverPending.calls.filter((item) => item[0] === "listDeployments").length !== 4) {
    throw new Error("既有 audit_pending 恢复未重列 preview/production");
  }
  if (recoverPending.calls.filter((item) => item[0] === "readProject").length !== 2) {
    throw new Error("既有 audit_pending 恢复未重读 project");
  }
  if (recoverPending.evidence.status !== "completed" || recoverPending.durable.at(-1)?.status !== "completed") {
    throw new Error("既有 audit_pending 恢复未到达 completed");
  }

  const recoverFailed = await runRecovery("既有 audit_failed", recoverySnapshot("audit_failed"));
  if (recoverFailed.error) throw new Error(`既有 audit_failed 恢复失败:${recoverFailed.error.message}`);
  assertZeroRedeploy(recoverFailed, "既有 audit_failed");
  if (recoverFailed.evidence.status !== "completed") throw new Error("既有 audit_failed 恢复未到达 completed");

  const leftoverPending = completedPersist.durable.at(-1);
  if (leftoverPending?.status !== "audit_pending") throw new Error("completed persist 失败未留下 audit_pending");
  const recoverAfterCompletedPersist = await runRecovery("completed persist failed 后的 audit_pending", leftoverPending);
  if (recoverAfterCompletedPersist.error) {
    throw new Error(`completed persist failed 后的 audit_pending 恢复失败:${recoverAfterCompletedPersist.error.message}`);
  }
  assertZeroRedeploy(recoverAfterCompletedPersist, "completed persist failed 后的 audit_pending");
  if (recoverAfterCompletedPersist.evidence.status !== "completed") {
    throw new Error("completed persist failed 后的 audit_pending 恢复未到达 completed");
  }

  async function assertRejectedRecovery(name, existing, overrides = {}) {
    const result = await runRecovery(name, existing, overrides);
    if (!result.error) throw new Error(`反例未拒绝:${name}`);
    assertZeroRedeploy(result, name);
    if (result.calls.some((item) => item[0] === "audit")) throw new Error(`${name} 漂移仍调用了 audit`);
    if (result.persisted.length !== 0) throw new Error(`${name} 覆盖了既有 evidence`);
    return result;
  }

  await assertRejectedRecovery("seed publicMain 漂移", recoverySnapshot("audit_pending"), {
    evidenceSeed: { ...seed, publicMain: sha("2").slice(0, 40) }
  });
  await assertRejectedRecovery("site directory 漂移", recoverySnapshot("audit_pending"), {
    sites: [
      { ...sites[0], directory: "deploy/other" },
      sites[1]
    ]
  });
  await assertRejectedRecovery("deployment id 漂移", recoverySnapshot("audit_pending"), {
    listDeployments: async ({ project, environment }) => {
      const branch = environment === "preview" ? "preview-v0.1.0-rc.4" : "main";
      return [
        deploymentRecord({
          project,
          environment,
          branch,
          publicMain: seed.publicMain,
          url: previewUrl(project),
          extras: { id: PAGES_IDS.other }
        })
      ];
    }
  });
  await assertRejectedRecovery("域名漂移", recoverySnapshot("audit_pending"), {
    readProject: async ({ project }) => projectReadback(project, { domains: [canonicalHost(project)] })
  });
  await assertRejectedRecovery("HTTP marker 漂移", recoverySnapshot("audit_pending"), {
    fetchHttp: async (url) => ({ ok: true, status: 200, url, body: "old candidate fixed URL" })
  });
  await assertRejectedRecovery("既有 completed", recoverySnapshot("completed"));
  await assertRejectedRecovery("既有 started", recoverySnapshot("started"));
  assertAuditRecoveryEvidence(recoverySnapshot("audit_pending"), seed, sites);

  const gateSource = readFileSync(join(scripts, "post-release-gate.mjs"), "utf8");
  if (!gateSource.includes("acquireDeployEvidenceLease") || !gateSource.includes("lease")) {
    throw new Error("post-release-gate 未在外部动作前取得部署证据租约");
  }
  if (/existingEvidence\s*=\s*existsSync/.test(gateSource) || /if\s*\(\s*existingEvidence\s*\)/.test(gateSource)) {
    throw new Error("post-release-gate 仍用 JSON truthiness 推断证据是否存在");
  }

  const evidenceDir = mkdtempSync(join(tmpdir(), "saydo-deploy-evidence-"));
  try {
    const malformedRoots = [
      ["null", "null"],
      ["zero", "0"],
      ["false", "false"],
      ["empty-string", '""'],
      ["array", "[]"]
    ];
    for (const [name, raw] of malformedRoots) {
      const path = join(evidenceDir, `${name}.json`);
      writeFileSync(path, `${raw}\n`);
      const loaded = readDeployEvidenceFile(path);
      if (loaded.evidenceFileExists !== true) {
        throw new Error(`畸形证据未识别为文件存在:${name}`);
      }
      let result;
      try {
        result = await runRecovery(`畸形证据 ${name}`, loaded.existingEvidence);
      } catch (error) {
        result = { error, calls: [] };
      }
      if (!result.error) throw new Error(`畸形证据未拒绝:${name}`);
      const wranglerCalls = result.calls.filter((item) => item[0] === "wrangler").length;
      const persistCalls = result.calls.filter((item) => item[0] === "persist").length;
      const auditCalls = result.calls.filter((item) => item[0] === "audit").length;
      if (wranglerCalls !== 0 || persistCalls !== 0 || auditCalls !== 0) {
        throw new Error(
          `畸形证据 ${name} 发生 mutation: wrangler=${wranglerCalls} persist=${persistCalls} audit=${auditCalls}`
        );
      }
    }
    const missing = readDeployEvidenceFile(join(evidenceDir, "missing.json"));
    if (missing.evidenceFileExists !== false) throw new Error("缺文件未声明 evidenceFileExists=false");

    const pagesDeploySource = readFileSync(join(scripts, "release-pages-deploy.mjs"), "utf8");
    const openatSource = readFileSync(join(scripts, "release-openat.mjs"), "utf8");
    const posixHelper = readFileSync(join(scripts, "release-openat-posix.py"), "utf8");
    if (pagesDeploySource.includes("existsSync")) throw new Error("部署证据读取仍使用 existsSync");
    if (!pagesDeploySource.includes("resolveAnchoredIo") || !openatSource.includes("release-openat-posix.py")) {
      throw new Error("部署证据未接线 directory-handle helper");
    }
    if (!posixHelper.includes("O_NOFOLLOW") || !posixHelper.includes("O_EXCL") || !posixHelper.includes("dir_fd")) {
      throw new Error("POSIX helper 未使用 O_NOFOLLOW/O_EXCL/dir_fd");
    }

    function assertNoMutationCalls(result, label) {
      const wranglerCalls = result.calls.filter((item) => item[0] === "wrangler").length;
      const persistCalls = result.calls.filter((item) => item[0] === "persist").length;
      const auditCalls = result.calls.filter((item) => item[0] === "audit").length;
      if (wranglerCalls !== 0 || persistCalls !== 0 || auditCalls !== 0) {
        throw new Error(`${label} 发生 mutation: wrangler=${wranglerCalls} persist=${persistCalls} audit=${auditCalls}`);
      }
    }

    async function runLoadedStateMachine(evidencePath) {
      const calls = [];
      const persisted = [];
      let lease;
      try {
        lease = acquireDeployEvidenceLease(evidencePath);
      } catch (error) {
        return { loadError: error, error: null, calls, persisted };
      }
      try {
        await runPagesDeployStateMachine({
          evidenceSeed: seed,
          sites,
          wrangler: async (req) => {
            calls.push(["wrangler", req.stage, req.project]);
            return `Deployed to ${previewUrl(req.project)}`;
          },
          listDeployments: async ({ project, environment }) => {
            calls.push(["listDeployments", project, environment]);
            const branch = environment === "preview" ? "preview-v0.1.0-rc.4" : "main";
            return [
              deploymentRecord({
                project,
                environment,
                branch,
                publicMain: seed.publicMain,
                url: previewUrl(project)
              })
            ];
          },
          readProject: async ({ project }) => {
            calls.push(["readProject", project]);
            return projectReadback(project);
          },
          fetchHttp: async (url) => {
            calls.push(["fetch", url]);
            return { ok: true, status: 200, url, body: currentAvailabilityBody() };
          },
          officialPages: officialPagesFixture,
          persist: async (snapshot) => {
            calls.push(["persist", snapshot.status]);
            persisted.push(structuredClone(snapshot));
            persistClaimedDeployEvidence(lease, snapshot);
          },
          audit: async () => {
            calls.push(["audit"]);
          },
          lease
        });
        return { loadError: null, error: null, calls, persisted, lease };
      } catch (error) {
        return { loadError: null, error, calls, persisted, lease };
      }
    }

    const danglingPath = join(evidenceDir, "dangling.json");
    symlinkSync(join(evidenceDir, "missing-target.json"), danglingPath);
    const dangling = await runLoadedStateMachine(danglingPath);
    if (!dangling.loadError) throw new Error("dangling symlink 未在状态机入口拒绝");
    assertNoMutationCalls(dangling, "dangling symlink");
    if (!lstatSync(danglingPath).isSymbolicLink()) throw new Error("dangling symlink 被替换");
    expectThrow("atomic overwrite dangling", () => writeFileAtomic(danglingPath, "x\n"));
    if (!lstatSync(danglingPath).isSymbolicLink()) throw new Error("atomic write 覆盖了 dangling symlink");

    const dirPath = join(evidenceDir, "dir-evidence.json");
    mkdirSync(dirPath);
    const dirEvidence = await runLoadedStateMachine(dirPath);
    if (!dirEvidence.loadError) throw new Error("目录证据未拒绝");
    assertNoMutationCalls(dirEvidence, "目录证据");
    if (!lstatSync(dirPath).isDirectory()) throw new Error("目录证据被替换");
    expectThrow("atomic overwrite dir", () => writeFileAtomic(dirPath, "x\n"));
    if (!lstatSync(dirPath).isDirectory()) throw new Error("atomic write 覆盖了目录");

    const realTarget = join(evidenceDir, "real-target.json");
    writeFileSync(realTarget, `${JSON.stringify(recoverySnapshot("audit_pending"), null, 2)}\n`);
    const validLink = join(evidenceDir, "valid-link.json");
    symlinkSync(realTarget, validLink);
    const linked = await runLoadedStateMachine(validLink);
    if (!linked.loadError) throw new Error("有效 symlink 未拒绝");
    assertNoMutationCalls(linked, "有效 symlink");
    if (!lstatSync(validLink).isSymbolicLink()) throw new Error("有效 symlink 被替换");
    if (readFileSync(realTarget, "utf8") !== `${JSON.stringify(recoverySnapshot("audit_pending"), null, 2)}\n`) {
      throw new Error("有效 symlink 目标被改写");
    }

    const fifoPath = join(evidenceDir, "fifo.json");
    const fifoMade = spawnSync("mkfifo", [fifoPath], { encoding: "utf8" });
    if (fifoMade.status !== 0) throw new Error(`mkfifo 失败:${fifoMade.stderr}`);
    const fifoEvidence = await runLoadedStateMachine(fifoPath);
    if (!fifoEvidence.loadError) throw new Error("FIFO 证据未拒绝");
    assertNoMutationCalls(fifoEvidence, "FIFO 证据");
    if (!lstatSync(fifoPath).isFIFO()) throw new Error("FIFO 证据被替换");
    expectThrow("atomic overwrite fifo", () => writeFileAtomic(fifoPath, "x\n"));
    if (!lstatSync(fifoPath).isFIFO()) throw new Error("atomic write 覆盖了 FIFO");

    const swapSecret = join(evidenceDir, "swap-secret.json");
    const swapFragment = "UNIQUE_SWAP_TARGET_BODY_4d8e1c";
    writeFileSync(swapSecret, `secret ${swapFragment}\n`);
    const swapReadPath = join(evidenceDir, "swap-read.json");
    writeFileSync(swapReadPath, `${JSON.stringify(recoverySnapshot("audit_pending"))}\n`);
    try {
      readDeployEvidenceFile(swapReadPath, {
        anchored: {
          read(target) {
            if (target === swapReadPath) {
              rmSync(swapReadPath);
              symlinkSync(swapSecret, swapReadPath);
            }
            return defaultAnchoredIo.read(target);
          }
        }
      });
      throw new Error("lstat→read 交错 symlink 未拒绝");
    } catch (error) {
      if (error.message === "lstat→read 交错 symlink 未拒绝") throw error;
      if (String(error.message).includes(swapFragment) || /Bearer/i.test(String(error.message))) {
        throw new Error("lstat→read 交错读取了 symlink target");
      }
      if (error.message !== "既有部署证据不是普通文件") throw new Error(`lstat→read 交错错误不符:${error.message}`);
    }
    if (!lstatSync(swapReadPath).isSymbolicLink()) throw new Error("lstat→read 交错覆盖了 symlink");
    if (readFileSync(swapSecret, "utf8") !== `secret ${swapFragment}\n`) {
      throw new Error("lstat→read 交错改写了 symlink target");
    }

    const swapWriteHandle = makeFreshLease();
    const swapWritePath = swapWriteHandle.path;
    const swapWriteSecret = join(swapWriteHandle.dir, "write-secret.json");
    writeFileSync(swapWriteSecret, `write-secret ${swapFragment}\n`);
    try {
      expectThrow("lstat→rename 交错 symlink", () =>
        replaceRegularFileInPlace(
          swapWritePath,
          Buffer.from('{"schemaVersion":1,"status":"started"}\n'),
          { dev: swapWriteHandle.lease.dev, ino: swapWriteHandle.lease.ino },
          {
            ...defaultFsIo,
            anchored: {
              persist(target, body, identity) {
                if (target === swapWritePath) {
                  rmSync(swapWritePath);
                  symlinkSync(swapWriteSecret, swapWritePath);
                }
                return defaultAnchoredIo.persist(target, body, identity);
              }
            }
          }
        )
      );
      if (!lstatSync(swapWritePath).isSymbolicLink()) throw new Error("lstat→rename 交错覆盖了 symlink");
      if (readFileSync(swapWriteSecret, "utf8") !== `write-secret ${swapFragment}\n`) {
        throw new Error("lstat→rename 交错写入了 symlink target");
      }
    } finally {
      cleanupLease(swapWriteHandle);
    }

    const ioToken = "t".repeat(40);
    try {
      readDeployEvidenceFile(join(evidenceDir, "io.json"), {
        anchored: {
          read() {
            const error = new Error(`Bearer ${ioToken}`);
            error.code = "EACCES";
            throw error;
          }
        }
      });
      throw new Error("非 ENOENT I/O 未拒绝");
    } catch (error) {
      if (error.message === "非 ENOENT I/O 未拒绝") throw error;
      if (String(error.message).includes(ioToken) || /Bearer/i.test(String(error.message))) {
        throw new Error("非 ENOENT I/O 泄漏 token");
      }
      if (error.message !== "既有部署证据读取失败") throw new Error(`非 ENOENT I/O 错误不符:${error.message}`);
    }

    const cfToken = "t".repeat(40);
    const cfFragment = "UNIQUE_CF_RESULT_ID_9c2e7b1a";
    const maliciousCanonicalId = `Bearer ${cfToken} ${cfFragment}`;
    function assertNoResultLeak(parts, label, extraFragments = []) {
      const text = parts
        .map((item) => {
          try {
            return typeof item === "string" ? item : JSON.stringify(item);
          } catch {
            return "";
          }
        })
        .join("\n");
      const fragments = [cfToken, cfFragment, maliciousCanonicalId, ...extraFragments];
      if (/Bearer/i.test(text) || fragments.some((fragment) => fragment && text.includes(fragment))) {
        throw new Error(`${label} 泄漏 Cloudflare result 字段`);
      }
    }

    const recoverMalicious = await runRecovery("recovery malicious canonical id", recoverySnapshot("audit_pending"), {
      readProject: async ({ project }) =>
        projectReadback(project, { canonical_deployment: { id: maliciousCanonicalId, url: previewUrl(project) } })
    });
    if (!recoverMalicious.error) throw new Error("恢复路径恶意 canonical id 未拒绝");
    assertZeroRedeploy(recoverMalicious, "recovery malicious canonical id");
    if (recoverMalicious.calls.some((item) => item[0] === "audit")) {
      throw new Error("恢复路径恶意 canonical id 仍调用了 audit");
    }
    if (recoverMalicious.persisted.length !== 0) throw new Error("恢复路径恶意 canonical id 覆盖了既有 evidence");
    assertNoResultLeak(
      [recoverMalicious.error.message, recoverMalicious.error.stack, ...recoverMalicious.persisted],
      "恢复路径恶意 canonical id"
    );

    const freshHandle = makeFreshLease();
    const freshPersisted = [];
    let freshError;
    try {
      freshError = await expectThrowAsync("fresh malicious canonical id", async () =>
        runPagesDeployStateMachine({
          evidenceSeed: seed,
          sites,
          wrangler: async (req) => `Deployed to ${previewUrl(req.project)}`,
          listDeployments: async ({ project, environment }) => {
            const branch = environment === "preview" ? "preview-v0.1.0-rc.4" : "main";
            return [
              deploymentRecord({
                project,
                environment,
                branch,
                publicMain: seed.publicMain,
                url: previewUrl(project)
              })
            ];
          },
          readProject: async ({ project }) =>
            projectReadback(project, { canonical_deployment: { id: maliciousCanonicalId, url: previewUrl(project) } }),
          fetchHttp: async (url) => ({ ok: true, status: 200, url, body: currentAvailabilityBody() }),
          persist: async (snapshot) => {
            freshPersisted.push(structuredClone(snapshot));
          },
          audit: async () => {
            throw new Error("不应 audit");
          },
          officialPages: officialPagesFixture,
          lease: freshHandle.lease
        })
      );
    } finally {
      cleanupLease(freshHandle);
    }
    const freshFailed = freshPersisted.filter((item) => item.status === "partial_failed");
    if (freshFailed.length === 0) throw new Error("fresh 恶意 canonical id 未写入 partial_failed");
    assertNoResultLeak(
      [freshError.message, freshError.stack, ...freshPersisted, ...freshFailed.map((item) => item.error)],
      "fresh 恶意 canonical id"
    );

    const selectedToken = "s".repeat(40);
    const selectedFragment = "UNIQUE_SELECTED_DEPLOY_ID_b71e4a";
    const selectedMaliciousId = `Bearer ${selectedToken} ${selectedFragment}`;
    const domainFragment = "unique-extra-domain-9f2c.evil.test";
    const domainToken = "d".repeat(40);
    const maliciousDomain = `Bearer ${domainToken}.${domainFragment}`;
    const bodyFragment = "UNIQUE_CF_BODY_FRAGMENT_deploy_c3a91";

    function leakBlobs(error, persisted, extra = []) {
      return [error?.message, error?.stack, ...persisted, ...extra];
    }

    async function runFreshAttack(name, overrides) {
      const handle = makeFreshLease();
      const persisted = [];
      const calls = [];
      try {
        let thrown = null;
        let evidence = null;
        try {
          evidence = await runPagesDeployStateMachine({
            evidenceSeed: seed,
            sites,
            wrangler: async (req) => {
              calls.push(["wrangler", req.stage, req.project]);
              return `Deployed to ${previewUrl(req.project)}`;
            },
            listDeployments: async ({ project, environment }) => {
              calls.push(["listDeployments"]);
              const branch = environment === "preview" ? "preview-v0.1.0-rc.4" : "main";
              return [
                deploymentRecord({
                  project,
                  environment,
                  branch,
                  publicMain: seed.publicMain,
                  url: previewUrl(project)
                })
              ];
            },
            readProject: async ({ project }) => projectReadback(project),
            fetchHttp: async (url) => ({ ok: true, status: 200, url, body: currentAvailabilityBody() }),
            persist: async (snapshot) => {
              calls.push(["persist", snapshot.status]);
              persisted.push(structuredClone(snapshot));
            },
            audit: async () => {
              calls.push(["audit"]);
            },
            officialPages: officialPagesFixture,
            lease: handle.lease,
            ...overrides
          });
        } catch (error) {
          thrown = error;
        }
        return { name, error: thrown, evidence, persisted, calls, stdout: JSON.stringify(persisted) };
      } finally {
        cleanupLease(handle);
      }
    }

    const selectedAttack = await runFreshAttack("fresh selected Bearer id", {
      listDeployments: async ({ project, environment }) => {
        const branch = environment === "preview" ? "preview-v0.1.0-rc.4" : "main";
        const rec = deploymentRecord({
          project,
          environment,
          branch,
          publicMain: seed.publicMain,
          url: previewUrl(project)
        });
        return [
          new Proxy(rec, {
            get(target, property, receiver) {
              if (property === "id") return selectedMaliciousId;
              if (property === "toJSON") {
                return () => ({ ...target, id: selectedMaliciousId });
              }
              return Reflect.get(target, property, receiver);
            }
          })
        ];
      },
      audit: async () => {
        throw new Error(`audit ${bodyFragment}`);
      }
    });
    if (!selectedAttack.error) throw new Error("selected Bearer id 未拒绝");
    if (selectedAttack.calls.some((item) => item[0] === "audit")) throw new Error("selected Bearer id 仍调用了 audit");
    assertNoResultLeak(
      leakBlobs(selectedAttack.error, selectedAttack.persisted, [selectedAttack.stdout, selectedAttack.evidence]),
      "fresh selected Bearer id",
      [selectedToken, selectedFragment, selectedMaliciousId]
    );
    if (
      JSON.stringify(selectedAttack.persisted).includes(selectedToken) ||
      JSON.stringify(selectedAttack.persisted).includes(selectedFragment)
    ) {
      throw new Error("selected Bearer id 写入了耐久 evidence");
    }

    const extraDomainAttack = await runFreshAttack("fresh extra malicious domain", {
      readProject: async ({ project }) =>
        projectReadback(project, {
          domains: [canonicalHost(project), project === "saydo" ? "saydo.octoooo.com" : "link.saydo.octoooo.com", maliciousDomain, domainFragment]
        }),
      audit: async () => {
        throw new Error("audit failed");
      }
    });
    if (!extraDomainAttack.error) throw new Error("extra domain 未拒绝");
    if (extraDomainAttack.calls.some((item) => item[0] === "wrangler")) throw new Error("extra domain 仍调用了 Wrangler");
    assertNoResultLeak(leakBlobs(extraDomainAttack.error, extraDomainAttack.persisted), "fresh extra malicious domain", [
      domainFragment,
      maliciousDomain,
      domainToken
    ]);
    for (const item of extraDomainAttack.persisted) {
      const dumped = JSON.stringify(item);
      if (dumped.includes(domainFragment) || dumped.includes(maliciousDomain) || dumped.includes(domainToken)) {
        throw new Error("raw extra domain 被持久化");
      }
      for (const project of item.productionProjects ?? []) {
        const expected = [canonicalHost(project.name), project.name === "saydo" ? "saydo.octoooo.com" : "link.saydo.octoooo.com"].sort();
        const actual = [...(project.domains ?? [])].sort();
        if (JSON.stringify(actual) !== JSON.stringify(expected) && (project.domains ?? []).length) {
          throw new Error(`productionProjects.domains 不是本地 expected exact-set:${JSON.stringify(project.domains)}`);
        }
      }
    }

    const recoverDomain = await runRecovery("recovery extra domain", recoverySnapshot("audit_pending"), {
      readProject: async ({ project }) =>
        projectReadback(project, {
          domains: [canonicalHost(project), project === "saydo" ? "saydo.octoooo.com" : "link.saydo.octoooo.com", domainFragment]
        })
    });
    if (!recoverDomain.error) throw new Error("恢复路径 extra domain 未拒绝");
    assertZeroRedeploy(recoverDomain, "recovery extra domain");
    if (recoverDomain.persisted.length !== 0) throw new Error("恢复路径 extra domain 覆盖了既有 evidence");
    assertNoResultLeak(leakBlobs(recoverDomain.error, recoverDomain.persisted), "recovery extra domain", [domainFragment, maliciousDomain]);

    const recoverSelected = await runRecovery("recovery selected Bearer id", recoverySnapshot("audit_pending"), {
      listDeployments: async ({ project, environment }) => {
        const branch = environment === "preview" ? "preview-v0.1.0-rc.4" : "main";
        const rec = deploymentRecord({
          project,
          environment,
          branch,
          publicMain: seed.publicMain,
          url: previewUrl(project)
        });
        return [{ ...rec, id: selectedMaliciousId }];
      }
    });
    if (!recoverSelected.error) throw new Error("恢复路径 selected Bearer id 未拒绝");
    assertZeroRedeploy(recoverSelected, "recovery selected Bearer id");
    if (recoverSelected.calls.some((item) => item[0] === "audit")) throw new Error("恢复路径 selected Bearer id 仍调用了 audit");
    assertNoResultLeak(leakBlobs(recoverSelected.error, recoverSelected.persisted), "recovery selected Bearer id", [
      selectedToken,
      selectedFragment,
      selectedMaliciousId
    ]);

    const concurrentDir = mkdtempSync(join(tmpdir(), "saydo-claim-race-"));
    const concurrentPath = join(concurrentDir, "evidence.json");
    try {
      const countersA = { wrangler: 0, persist: 0, audit: 0 };
      const countersB = { wrangler: 0, persist: 0, audit: 0 };
      async function concurrentCaller(counters) {
        const calls = [];
        let lease;
        try {
          lease = acquireDeployEvidenceLease(concurrentPath);
        } catch (error) {
          return { error, calls, kind: null };
        }
        try {
          const evidence = await runPagesDeployStateMachine({
            evidenceSeed: seed,
            sites,
            wrangler: async (req) => {
              calls.push(["wrangler"]);
              counters.wrangler += 1;
              return `Deployed to ${previewUrl(req.project)}`;
            },
            listDeployments: async ({ project, environment }) => {
              const branch = environment === "preview" ? "preview-v0.1.0-rc.4" : "main";
              return [
                deploymentRecord({
                  project,
                  environment,
                  branch,
                  publicMain: seed.publicMain,
                  url: previewUrl(project)
                })
              ];
            },
            readProject: async ({ project }) => projectReadback(project),
            fetchHttp: async (url) => ({ ok: true, status: 200, url, body: currentAvailabilityBody() }),
            persist: async (snapshot) => {
              calls.push(["persist", snapshot.status]);
              counters.persist += 1;
              persistClaimedDeployEvidence(lease, snapshot);
            },
            audit: async () => {
              calls.push(["audit"]);
              counters.audit += 1;
            },
            officialPages: officialPagesFixture,
            lease
          });
          return { error: null, calls, kind: lease.kind, evidence };
        } catch (error) {
          return { error, calls, kind: lease.kind };
        }
      }
      const [first, second] = await Promise.race([
        Promise.all([concurrentCaller(countersA), concurrentCaller(countersB)]),
        new Promise((_, reject) => setTimeout(() => reject(new Error("并发 caller 超时")), 3000))
      ]);
      const kinds = [first.kind, second.kind].sort();
      if (first.kind === "fresh" && second.kind === "fresh") throw new Error("并发两个 caller 都取得了 fresh claim");
      if (!kinds.includes("fresh") || !kinds.includes("existing")) {
        throw new Error(`并发 claim 结果不符:${JSON.stringify({ first: first.kind, second: second.kind, a: first.error?.message, b: second.error?.message })}`);
      }
      const winner = first.kind === "fresh" ? first : second;
      const loser = first.kind === "fresh" ? second : first;
      const winnerCounters = first.kind === "fresh" ? countersA : countersB;
      const loserCounters = first.kind === "fresh" ? countersB : countersA;
      if (winner.error) throw new Error(`并发 winner 失败:${winner.error.message}`);
      if (!loser.error) throw new Error("并发 loser 未失败");
      if (winnerCounters.wrangler !== 4) throw new Error(`并发 winner Wrangler 次数不符:${winnerCounters.wrangler}`);
      if (loserCounters.wrangler !== 0 || loserCounters.persist !== 0 || loserCounters.audit !== 0) {
        throw new Error(
          `并发 loser 发生外部动作: wrangler=${loserCounters.wrangler} persist=${loserCounters.persist} audit=${loserCounters.audit}`
        );
      }
      if (winnerCounters.wrangler + loserCounters.wrangler !== 4) {
        throw new Error(`并发总 Wrangler 超过一次完整发布:${winnerCounters.wrangler + loserCounters.wrangler}`);
      }

      const startGate = join(concurrentDir, "start");
      const workerSrc = join(concurrentDir, "claim-worker.mjs");
      writeFileSync(
        workerSrc,
        `import { existsSync } from "node:fs";
import { acquireDeployEvidenceLease } from ${JSON.stringify(join(scripts, "release-pages-deploy.mjs"))};
const evidencePath = process.argv[2];
const startPath = process.argv[3];
const deadline = Date.now() + 5000;
while (!existsSync(startPath)) {
  if (Date.now() > deadline) {
    process.stdout.write(JSON.stringify({ ok: false, message: "start gate timeout" }));
    process.exit(0);
  }
}
try {
  const lease = acquireDeployEvidenceLease(evidencePath);
  process.stdout.write(JSON.stringify({ ok: true, kind: lease.kind }));
} catch (error) {
  process.stdout.write(JSON.stringify({ ok: false, message: String(error?.message ?? error) }));
}
`
      );
      const childPath = join(concurrentDir, "proc-evidence.json");
      const children = [0, 1].map(() =>
        spawn(process.execPath, [workerSrc, childPath, startGate], { encoding: "utf8" })
      );
      await new Promise((resolve) => setTimeout(resolve, 200));
      writeFileSync(startGate, "go\n");
      const childResults = await Promise.all(
        children.map(
          (child) =>
            new Promise((resolve, reject) => {
              let stdout = "";
              let stderr = "";
              child.stdout.on("data", (chunk) => {
                stdout += chunk;
              });
              child.stderr.on("data", (chunk) => {
                stderr += chunk;
              });
              child.on("error", reject);
              child.on("close", (code) => resolve({ code, stdout, stderr }));
            })
        )
      );
      const parsedChildren = childResults.map((item) => {
        try {
          return JSON.parse(item.stdout);
        } catch {
          throw new Error(`进程租约输出非法:${JSON.stringify(item)}`);
        }
      });
      const freshChildren = parsedChildren.filter((item) => item.ok && item.kind === "fresh");
      if (freshChildren.length !== 1) {
        throw new Error(`进程并发 fresh claim 数量不是 1:${JSON.stringify(parsedChildren)}`);
      }
    } finally {
      rmSync(concurrentDir, { recursive: true, force: true });
    }
  } finally {
    rmSync(evidenceDir, { recursive: true, force: true });
  }

  const blockedCloudflare = {
    listDeployments: async () => {
      throw new Error("不应 listDeployments");
    },
    readProject: async () => {
      throw new Error("不应 readProject");
    },
    officialPages: officialPagesFixture
  };
  async function runBlocked(name, args) {
    const handle = args.existing
      ? makeExistingLease(args.existing)
      : makeFreshLease();
    try {
      return await expectThrowAsync(name, async () =>
        runPagesDeployStateMachine({
          evidenceSeed: seed,
          sites,
          wrangler: async () => {
            throw new Error("不应调用 wrangler");
          },
          fetchHttp: async () => ({ ok: true, status: 200 }),
          persist: async () => {},
          audit: async () => {},
          ...blockedCloudflare,
          ...args,
          lease: handle.lease
        })
      );
    } finally {
      cleanupLease(handle);
    }
  }

  await runBlocked("existing evidence", { existing: { status: "partial_failed" } });
  await runBlocked("seed status override", { evidenceSeed: { ...seed, status: "completed" } });
  await runBlocked("seed schema override", { evidenceSeed: { ...seed, schemaVersion: 9 } });
  await runBlocked("duplicate sites", { sites: [sites[0], { ...sites[1], project: "saydo" }] });
  await runBlocked("illegal publicMain", { evidenceSeed: { ...seed, publicMain: "not-a-sha" } });

  const previewPersist = await runCase("preview-persist-after-success", "preview-persist-after-success");
  if (!previewPersist.error?.persistFailed) throw new Error("preview 成功后 persist 失败未聚合");
  if (previewPersist.calls.filter((item) => item[0] === "wrangler").length !== 1) {
    throw new Error("preview persist 失败后继续了外部调用");
  }
  if (previewPersist.persisted.at(-1)?.status === "completed") throw new Error("preview persist 失败后状态倒退/伪装 completed");
  if (previewPersist.persisted.some((item) => item.status === "completed")) throw new Error("seed/persist 出现 completed 伪装");

  const productionPersist = await runCase("production-persist-after-success", "production-persist-after-success");
  if (!productionPersist.error?.persistFailed) throw new Error("production 成功后 persist 失败未聚合");
  if (productionPersist.calls.filter((item) => item[0] === "wrangler" && item[1] === "production").length !== 1) {
    throw new Error("production persist 失败后继续了第二站");
  }

  const continuous = await runCase("persist-continuous", "persist-continuous");
  if (!continuous.error?.persistFailed) throw new Error("持续 persist 失败未聚合");
  if (continuous.calls.filter((item) => item[0] === "wrangler").length !== 1) throw new Error("持续 persist 失败后仍继续外部调用");
  if (continuous.persisted.at(-1)?.status === "completed") throw new Error("持续 persist 失败不应 completed");

  const extraLeak = "UNIQUE_EVIDENCE_EXTRA_FIELD_7c1e9a";
  const extraSeedHandle = makeFreshLease();
  const extraPersisted = [];
  try {
    const extraReturned = await runPagesDeployStateMachine({
      evidenceSeed: {
        release: { tag: "v0.1.0-rc.4", unknownRelease: extraLeak },
        publicMain: seed.publicMain,
        publicCi: { workflowRunId: 9, unknownCi: extraLeak }
      },
      sites,
      wrangler: async (req) => `Deployed to ${previewUrl(req.project)}`,
      listDeployments: async ({ project, environment }) => {
        const branch = environment === "preview" ? "preview-v0.1.0-rc.4" : "main";
        return [
          deploymentRecord({
            project,
            environment,
            branch,
            publicMain: seed.publicMain,
            url: previewUrl(project)
          })
        ];
      },
      readProject: async ({ project }) => projectReadback(project),
      fetchHttp: async (url) => ({ ok: true, status: 200, url, body: currentAvailabilityBody() }),
      persist: async (snapshot) => {
        extraPersisted.push(structuredClone(snapshot));
      },
      audit: async () => {},
      officialPages: officialPagesFixture,
      lease: extraSeedHandle.lease
    });
    const blobs = [extraReturned, ...extraPersisted, readFileSync(extraSeedHandle.path, "utf8")];
    for (const blob of blobs) {
      const text = typeof blob === "string" ? blob : JSON.stringify(blob);
      if (text.includes("unknownRelease") || text.includes("unknownCi") || text.includes(extraLeak) || text.includes("extraRoot")) {
        throw new Error("未知字段出现在 returned/persisted evidence");
      }
      if (blob && typeof blob === "object") {
        if ("extraRoot" in blob || (blob.release && "unknownRelease" in blob.release) || (blob.publicCi && "unknownCi" in blob.publicCi)) {
          throw new Error("未知字段仍在 evidence 对象上");
        }
      }
    }
  } finally {
    cleanupLease(extraSeedHandle);
  }

  const extraRootHandle = makeFreshLease();
  try {
    const projected = persistClaimedDeployEvidence(extraRootHandle.lease, {
      schemaVersion: 1,
      status: "started",
      release: { tag: "v0.1.0-rc.4", unknownRelease: extraLeak },
      publicMain: seed.publicMain,
      publicCi: { workflowRunId: 9, unknownCi: extraLeak },
      extraRoot: extraLeak,
      nested: { token: extraLeak },
      sites: sites.map((site) => ({
        project: site.project,
        directory: site.directory,
        planned: {
          previewBranch: site.previewBranch,
          productionBranch: site.productionBranch,
          canonicalHost: canonicalHost(site.project)
        },
        preview: { status: "planned" },
        production: { status: "planned" }
      })),
      completedSites: [],
      failedStage: null,
      error: null
    });
    const persistedText = readFileSync(extraRootHandle.path, "utf8");
    if ("extraRoot" in projected || "nested" in projected || (projected.release && "unknownRelease" in projected.release) || (projected.publicCi && "unknownCi" in projected.publicCi)) {
      throw new Error("projectDurableEvidence 保留了未知字段");
    }
    if (persistedText.includes("extraRoot") || persistedText.includes("unknownRelease") || persistedText.includes("unknownCi") || persistedText.includes(extraLeak)) {
      throw new Error("未知字段写入了落盘 JSON");
    }
    projectDurableEvidence(projected);
  } finally {
    cleanupLease(extraRootHandle);
  }

  if (isSafePagesDeploymentId("saydo-production-id") || isSafePagesDeploymentId("unique-fragment-id")) {
    throw new Error("任意安全字符片段仍被当成 Pages deployment id");
  }

  const getterToken = `Bearer ${"g".repeat(40)}`;
  const getterFragment = "UNIQUE_UNKNOWN_GETTER_FRAGMENT_e4b1";
  const counters = { rootGetter: 0, releaseGetter: 0, siteGetter: 0, unknownToJsonCalls: 0 };
  const getterEvidence = {
    schemaVersion: 1,
    status: "started",
    release: { tag: "v0.1.0-rc.4" },
    publicMain: seed.publicMain,
    publicCi: { workflowRunId: 9 },
    sites: sites.map((site) => ({
      project: site.project,
      directory: site.directory,
      planned: {
        previewBranch: site.previewBranch,
        productionBranch: site.productionBranch,
        canonicalHost: canonicalHost(site.project)
      },
      preview: { status: "planned" },
      production: { status: "planned" }
    })),
    completedSites: [],
    failedStage: null,
    error: null
  };
  Object.defineProperty(getterEvidence, "unknownRoot", {
    enumerable: true,
    configurable: true,
    get() {
      counters.rootGetter += 1;
      throw new Error(`${getterToken} ${getterFragment}`);
    }
  });
  Object.defineProperty(getterEvidence.release, "unknownRelease", {
    enumerable: true,
    configurable: true,
    get() {
      counters.releaseGetter += 1;
      throw new Error(`${getterToken} ${getterFragment}`);
    }
  });
  for (const site of getterEvidence.sites) {
    Object.defineProperty(site, "unknownSite", {
      enumerable: true,
      configurable: true,
      get() {
        counters.siteGetter += 1;
        throw new Error(`${getterToken} ${getterFragment}`);
      }
    });
  }
  getterEvidence.unknownToJson = {
    toJSON() {
      counters.unknownToJsonCalls += 1;
      return getterFragment;
    }
  };
  getterEvidence.toJSON = function toJSON() {
    counters.unknownToJsonCalls += 1;
    return { ...this, leak: getterFragment };
  };
  let projectedGetters;
  try {
    projectedGetters = projectDurableEvidence(getterEvidence);
  } catch (error) {
    const text = `${error.message}\n${error.stack ?? ""}`;
    if (text.includes(getterToken) || text.includes(getterFragment) || /Bearer/i.test(text)) {
      throw new Error("未知 getter 投影泄漏了攻击文本");
    }
    throw error;
  }
  if (counters.rootGetter !== 0 || counters.releaseGetter !== 0 || counters.siteGetter !== 0 || counters.unknownToJsonCalls !== 0) {
    throw new Error(`未知 getter/toJSON 被调用:${JSON.stringify(counters)}`);
  }
  if ("unknownRoot" in projectedGetters || "unknownToJson" in projectedGetters || "unknownRelease" in projectedGetters.release) {
    throw new Error("投影结果含未知字段");
  }

  const accessorEvidence = {
    schemaVersion: 1,
    status: "started",
    publicMain: seed.publicMain,
    publicCi: { workflowRunId: 9 },
    sites: getterEvidence.sites,
    completedSites: [],
    failedStage: null,
    error: null
  };
  Object.defineProperty(accessorEvidence, "release", {
    enumerable: true,
    configurable: true,
    get() {
      throw new Error(getterToken);
    }
  });
  let accessorError;
  try {
    projectDurableEvidence(accessorEvidence);
  } catch (error) {
    accessorError = error;
  }
  if (!accessorError) throw new Error("允许字段 accessor 未拒绝");
  if (accessorError.message !== "既有部署证据非法") throw new Error(`允许字段 accessor 错误不是常量:${accessorError.message}`);
  if (String(accessorError.message).includes(getterToken) || /Bearer/i.test(String(accessorError.message))) {
    throw new Error("允许字段 accessor 泄漏了攻击文本");
  }

  const proxyFragment = "UNIQUE_PROXY_OWNKEYS_FRAGMENT_aa19";
  const proxyEvidence = new Proxy(
    {
      schemaVersion: 1,
      status: "started",
      release: { tag: "v0.1.0-rc.4" },
      publicMain: seed.publicMain,
      publicCi: { workflowRunId: 9 },
      sites: getterEvidence.sites,
      completedSites: [],
      failedStage: null,
      error: null
    },
    {
      get(target, property, receiver) {
        if (property === "unknownRoot") throw new Error(`${getterToken} ${proxyFragment}`);
        return Reflect.get(target, property, receiver);
      },
      ownKeys() {
        throw new Error(`${getterToken} ${proxyFragment}`);
      }
    }
  );
  let proxyProjected;
  try {
    proxyProjected = projectDurableEvidence(proxyEvidence);
  } catch (error) {
    const text = `${error.message}\n${error.stack ?? ""}`;
    if (text.includes(getterToken) || text.includes(proxyFragment) || /Bearer/i.test(text)) {
      throw new Error("Proxy 投影泄漏了攻击文本");
    }
    throw error;
  }
  if ("unknownRoot" in proxyProjected) throw new Error("Proxy 投影保留了未知字段");

  const cleanSites = sites.map((site) => ({
    project: site.project,
    directory: site.directory,
    planned: {
      previewBranch: site.previewBranch,
      productionBranch: site.productionBranch,
      canonicalHost: canonicalHost(site.project)
    },
    preview: { status: "planned" },
    production: { status: "planned" }
  }));
  const started = {
    schemaVersion: 1,
    status: "started",
    release: { tag: "v0.1.0-rc.4" },
    publicMain: seed.publicMain,
    publicCi: { workflowRunId: 9 },
    sites: cleanSites,
    completedSites: [],
    failedStage: null,
    error: null
  };
  const illegal = "既有部署证据非法";
  expectStableReject("revoked root", () => projectDurableEvidence(revokedProxy(started)), illegal);
  expectStableReject("revoked release", () => projectDurableEvidence({ ...started, release: revokedProxy({ tag: "v0.1.0-rc.4" }) }), illegal);
  expectStableReject("revoked publicCi", () => projectDurableEvidence({ ...started, publicCi: revokedProxy({ workflowRunId: 9 }) }), illegal);
  expectStableReject("revoked site", () => projectDurableEvidence({ ...started, sites: [revokedProxy(started.sites[0]), started.sites[1]] }), illegal);
  expectStableReject(
    "revoked planned",
    () =>
      projectDurableEvidence({
        ...started,
        sites: [{ ...started.sites[0], planned: revokedProxy(started.sites[0].planned) }, started.sites[1]]
      }),
    illegal
  );
  expectStableReject(
    "revoked stage",
    () =>
      projectDurableEvidence({
        ...started,
        sites: [{ ...started.sites[0], preview: revokedProxy({ status: "planned" }) }, started.sites[1]]
      }),
    illegal
  );
  const verifiedStage = {
    status: "verified",
    url: previewUrl("saydo"),
    httpStatus: 200,
    deployment: {
      id: PAGES_IDS.saydoPreview,
      project_name: "saydo",
      environment: "preview",
      url: previewUrl("saydo"),
      branch: "preview-v0.1.0-rc.4",
      commit_hash: seed.publicMain,
      commit_dirty: false,
      latest_stage_status: "success"
    }
  };
  expectStableReject(
    "revoked deployment",
    () =>
      projectDurableEvidence({
        ...started,
        sites: [{ ...started.sites[0], preview: { ...verifiedStage, deployment: revokedProxy(verifiedStage.deployment) } }, started.sites[1]]
      }),
    illegal
  );
  expectStableReject(
    "revoked assets",
    () => projectDurableEvidence({ ...started, release: { tag: "v0.1.0-rc.4", assets: [revokedProxy({ name: "x", size: 1 })] } }),
    illegal
  );
  expectStableReject(
    "revoked productionChecks",
    () =>
      projectDurableEvidence({
        ...started,
        productionChecks: [revokedProxy({ url: "https://saydo.octoooo.com/", httpStatus: 200, bytes: 1, marker: "x", project: "saydo" })]
      }),
    illegal
  );
  expectStableReject(
    "revoked productionProjects",
    () =>
      projectDurableEvidence({
        ...started,
        productionProjects: [
          revokedProxy({ name: "saydo", canonical_deployment_id: PAGES_IDS.saydoProduction, domains: ["saydo.octoooo.com", canonicalHost("saydo")] }),
          { name: "saydo-link", canonical_deployment_id: PAGES_IDS.saydoLinkProduction, domains: ["link.saydo.octoooo.com", canonicalHost("saydo-link")] }
        ]
      }),
    illegal
  );
  expectStableReject("revoked error", () => projectDurableEvidence({ ...started, error: revokedProxy({ message: "部署失败" }) }), illegal);

  const poison = {};
  Object.defineProperty(poison, "message", {
    enumerable: true,
    get() {
      throw new Error(`${getterToken} ${getterFragment}`);
    }
  });
  expectStableReject(
    "descriptor throws poison",
    () =>
      projectDurableEvidence(
        new Proxy(started, {
          getOwnPropertyDescriptor() {
            throw poison;
          }
        })
      ),
    illegal
  );
  expectStableReject(
    "descriptor throws revoked",
    () =>
      projectDurableEvidence(
        new Proxy(started, {
          getOwnPropertyDescriptor() {
            throw revokedProxy();
          }
        })
      ),
    illegal
  );

  expectStableReject("revoked pages deployment", () => projectPagesDeployment(revokedProxy()), "deployment readback 非法");
  expectStableReject(
    "revoked production project",
    () =>
      assertCurrentProductionDeployment(revokedProxy(), {
        project: "saydo",
        deploymentId: PAGES_IDS.saydoProduction,
        officialHosts: ["saydo.octoooo.com"],
        canonicalHost: canonicalHost("saydo")
      }),
    "project readback 非法"
  );
  expectStableReject("revoked deployment list", () => selectUniquePagesDeployment(revokedProxy([]), {
    project: "saydo",
    environment: "production",
    url: previewUrl("saydo"),
    branch: "main",
    publicMain: seed.publicMain,
    canonicalHost: canonicalHost("saydo")
  }), "deployment list 不是数组");
}

async function testCloudflareBinding() {
  const sites = [
    { project: "saydo", directory: "deploy/saydo-octoooo-com", previewBranch: "preview-v0.1.0-rc.4", productionBranch: "main" },
    { project: "saydo-link", directory: "deploy/link-saydo-octoooo-com", previewBranch: "preview-v0.1.0-rc.4", productionBranch: "main" }
  ];
  const seed = { release: { tag: "v0.1.0-rc.4" }, publicMain: sha("1").slice(0, 40), publicCi: { workflowRunId: 9 } };
  if (!isSafePagesDeploymentId(PAGES_IDS.wranglerFixture)) {
    throw new Error("合法 Pages UUID fixture 被拒绝");
  }
  if (!isSafePagesDeploymentId(PAGES_IDS.saydoProduction)) throw new Error("确定性 UUID v4 fixture 被拒绝");
  const malformedIds = [
    "",
    " ",
    "abc def",
    "abc\n",
    "https://evil.example/id",
    "Bearer token",
    "saydo-production-id",
    "f64788e46a4d42858e22b1c74fcc2d4d",
    PAGES_IDS.wranglerFixture.toUpperCase(),
    "11111111-1111-1111-8111-111111111111",
    "11111111-1111-4111-1111-111111111111",
    "a".repeat(PAGES_DEPLOYMENT_ID_MAX_LENGTH + 1),
    "\u0000id"
  ];
  for (const id of malformedIds) {
    if (isSafePagesDeploymentId(id)) throw new Error(`畸形 deployment id 被接受:${JSON.stringify(id)}`);
    try {
      projectPagesDeployment({
        id,
        project_name: "saydo",
        environment: "production",
        url: previewUrl("saydo"),
        latest_stage: { status: "success" },
        deployment_trigger: { metadata: { branch: "main", commit_hash: seed.publicMain, commit_dirty: false } }
      }, { project: "saydo", canonicalHost: canonicalHost("saydo") });
      throw new Error(`畸形 id 投影未拒绝:${JSON.stringify(id)}`);
    } catch (error) {
      if (error.message === `畸形 id 投影未拒绝:${JSON.stringify(id)}`) throw error;
      if (error.message !== "deployment id 非法") throw new Error(`畸形 id 错误不是常量:${error.message}`);
      if (id.length > 3 && String(error.message).includes(String(id))) {
        throw new Error("畸形 id 错误回显了输入");
      }
    }
  }
  expectThrow("wrong project URL", () => parseWranglerDeploymentUrl("Deployed to https://abc123.other.pages.dev", canonicalHost("saydo")));
  expectThrow("assumed project host", () => parseWranglerDeploymentUrl("Deployed to https://abc123.saydo.pages.dev", canonicalHost("saydo")));
  parseWranglerDeploymentUrl(`Deployed to ${previewUrl("saydo")}`, canonicalHost("saydo"));
  expectThrow("wrangler display JSON", () =>
    projectPagesDeployment(
      {
        Id: "d16c9509-695d-4b81-975e-d6480aa57f99",
        Environment: "Production",
        Branch: "main",
        Source: "6d98a6e",
        Deployment: "https://d16c9509.saydo-3xb.pages.dev"
      },
      { project: "saydo", canonicalHost: canonicalHost("saydo") }
    )
  );

  async function runFail(name, overrides) {
    const handle = makeFreshLease();
    const persisted = [];
    try {
      const error = await expectThrowAsync(name, async () =>
        runPagesDeployStateMachine({
          evidenceSeed: seed,
          sites,
          wrangler: async (req) => `Deployed to ${previewUrl(req.project)}`,
          listDeployments: async ({ project, environment }) => {
            const branch = environment === "preview" ? "preview-v0.1.0-rc.4" : "main";
            return [
              deploymentRecord({
                project,
                environment,
                branch,
                publicMain: seed.publicMain,
                url: previewUrl(project)
              })
            ];
          },
          readProject: async ({ project }) => projectReadback(project),
          fetchHttp: async (url) => ({ ok: true, status: 200, url, body: currentAvailabilityBody() }),
          persist: async (evidence) => {
            persisted.push(structuredClone(evidence));
          },
          audit: async () => {},
          officialPages: officialPagesFixture,
          ...overrides,
          lease: handle.lease
        })
      );
      if (persisted.some((item) => item.status === "completed")) throw new Error(`${name} 到达 completed`);
      return error;
    } finally {
      cleanupLease(handle);
    }
  }

  await runFail("wrong project URL in wrangler", {
    wrangler: async () => "Deployed to https://abc123.other.pages.dev"
  });
  await runFail("wrong project_name", {
    listDeployments: async ({ project, environment }) => [
      deploymentRecord({
        project,
        environment,
        branch: environment === "preview" ? "preview-v0.1.0-rc.4" : "main",
        publicMain: seed.publicMain,
        url: previewUrl(project),
        extras: { project_name: "other" }
      })
    ]
  });
  await runFail("old commit", {
    listDeployments: async ({ project, environment }) => [
      deploymentRecord({
        project,
        environment,
        branch: environment === "preview" ? "preview-v0.1.0-rc.4" : "main",
        publicMain: seed.publicMain,
        url: previewUrl(project),
        extras: { commit_hash: "0".repeat(40) }
      })
    ]
  });
  await runFail("wrong branch", {
    listDeployments: async ({ project, environment }) => [
      deploymentRecord({
        project,
        environment,
        branch: environment === "preview" ? "preview-v0.1.0-rc.4" : "main",
        publicMain: seed.publicMain,
        url: previewUrl(project),
        extras: { branch: "wrong" }
      })
    ]
  });
  await runFail("wrong environment", {
    listDeployments: async ({ project, environment }) => [
      deploymentRecord({
        project,
        environment,
        branch: environment === "preview" ? "preview-v0.1.0-rc.4" : "main",
        publicMain: seed.publicMain,
        url: previewUrl(project),
        extras: { environment: environment === "preview" ? "production" : "preview" }
      })
    ]
  });
  await runFail("dirty commit", {
    listDeployments: async ({ project, environment }) => [
      deploymentRecord({
        project,
        environment,
        branch: environment === "preview" ? "preview-v0.1.0-rc.4" : "main",
        publicMain: seed.publicMain,
        url: previewUrl(project),
        extras: { commit_dirty: true }
      })
    ]
  });
  await runFail("failed stage", {
    listDeployments: async ({ project, environment }) => [
      deploymentRecord({
        project,
        environment,
        branch: environment === "preview" ? "preview-v0.1.0-rc.4" : "main",
        publicMain: seed.publicMain,
        url: previewUrl(project),
        extras: { stageStatus: "failure" }
      })
    ]
  });
  await runFail("multiple candidates", {
    listDeployments: async ({ project, environment }) => {
      const rec = deploymentRecord({
        project,
        environment,
        branch: environment === "preview" ? "preview-v0.1.0-rc.4" : "main",
        publicMain: seed.publicMain,
        url: previewUrl(project)
      });
      return [rec, { ...rec, id: PAGES_IDS.other }];
    }
  });
  await runFail("stale production id", {
    readProject: async ({ project }) =>
      projectReadback(project, { canonical_deployment: { id: PAGES_IDS.stale, url: previewUrl(project) } })
  });
  await runFail("wrong canonical host", {
    wrangler: async () => "Deployed to https://abc123.saydo.pages.dev"
  });
  await runFail("old official marker", {
    fetchHttp: async (url) => ({
      ok: true,
      status: 200,
      url,
      body: url.includes("octoooo.com") ? "candidate only" : currentAvailabilityBody()
    })
  });
  expectThrow("select old commit", () =>
    selectUniquePagesDeployment(
      [
        deploymentRecord({
          project: "saydo",
          environment: "production",
          branch: "main",
          publicMain: seed.publicMain,
          url: previewUrl("saydo"),
          extras: { commit_hash: "f".repeat(40) }
        })
      ],
      {
        project: "saydo",
        environment: "production",
        url: previewUrl("saydo"),
        branch: "main",
        publicMain: seed.publicMain,
        canonicalHost: canonicalHost("saydo")
      }
    )
  );
  expectThrow("stale production assert", () =>
    assertCurrentProductionDeployment(
      { name: "saydo", canonical_deployment: { id: PAGES_IDS.stale }, domains: ["saydo.octoooo.com", canonicalHost("saydo")] },
      { project: "saydo", deploymentId: PAGES_IDS.saydoProduction, officialHosts: ["saydo.octoooo.com"], canonicalHost: canonicalHost("saydo") }
    )
  );
}

async function testCloudflareRestClient() {
  const accountId = "a".repeat(32);
  const apiToken = "t".repeat(40);
  const seed = sha("1").slice(0, 40);
  expectThrow("missing token", () => requireCloudflareCredentials({ CLOUDFLARE_ACCOUNT_ID: accountId }));
  const creds = requireCloudflareCredentials({ CLOUDFLARE_ACCOUNT_ID: accountId, CLOUDFLARE_API_TOKEN: apiToken });
  if (JSON.stringify(creds).includes("Bearer ")) throw new Error("凭证对象不应展开 Authorization");
  const jsonResponse = (status, payload) => ({
    status,
    text: async () => JSON.stringify(payload)
  });
  const envelope = (result, extras = {}) => ({ success: true, errors: [], result, ...extras });
  await expectThrowAsync("API error", async () =>
    getPagesProject({
      accountId,
      apiToken,
      project: "saydo",
      fetchImpl: async () => jsonResponse(403, { success: false, errors: [{ message: `Bearer ${apiToken}` }], result: null })
    })
  ).then((error) => {
    if (String(error.message).includes(apiToken) || String(error.message).includes("Bearer tttt")) {
      throw new Error("API error 泄露 token");
    }
  });
  const pages = [];
  const listed = await listPagesDeployments({
    accountId,
    apiToken,
    project: "saydo",
    environment: "production",
    fetchImpl: async (url) => {
      const page = Number(new URL(url).searchParams.get("page"));
      pages.push(page);
      const batch = page === 1 ? Array.from({ length: 25 }, (_, index) => ({ id: `p1-${index}` })) : [{ id: "p2-0" }, { id: "p2-1" }];
      return jsonResponse(200, envelope(batch));
    }
  });
  if (pages.join(",") !== "1,2" || listed.length !== 27) throw new Error(`deployment 分页未读到短页:${pages}:${listed.length}`);
  await expectThrowAsync("wrong project name", async () =>
    getPagesProject({
      accountId,
      apiToken,
      project: "saydo",
      fetchImpl: async () => jsonResponse(200, envelope({ name: "other", domains: ["saydo-3xb.pages.dev"] }))
    })
  );
  const error = new Error(`upstream Bearer ${apiToken} failed`);
  if (redactSecrets(error.message, [apiToken]).includes(apiToken)) throw new Error("redactSecrets 未去掉 token");

  const restPath = `/accounts/${accountId}/pages/projects/saydo`;
  const assertNoSecret = (caught, label) => {
    const blobs = [caught?.message, caught?.stack, caught?.cause, caught?.cause?.message].map((item) => String(item ?? ""));
    for (const blob of blobs) {
      if (blob.includes(apiToken) || /Bearer\s+(?!\[redacted\])\S+/i.test(blob) || /CLOUDFLARE_API_TOKEN[=:](?!\[redacted\])\S+/i.test(blob)) {
        throw new Error(`${label} 泄露 token`);
      }
    }
    if (blobs[0].includes("{") && blobs[0].includes("result") && blobs[0].length > 400) {
      throw new Error(`${label} 写入了完整响应 body`);
    }
  };
  await expectThrowAsync("fetchImpl 抛 token", async () =>
    cloudflareV4Get({
      accountId,
      apiToken,
      path: restPath,
      fetchImpl: async () => {
        throw new Error(`upstream ${apiToken} failed`);
      }
    })
  ).then((caught) => assertNoSecret(caught, "fetchImpl 抛 token"));
  await expectThrowAsync("fetchImpl 抛 Bearer token", async () =>
    cloudflareV4Get({
      accountId,
      apiToken,
      path: restPath,
      fetchImpl: async () => {
        throw new Error(`Authorization Bearer ${apiToken}`);
      }
    })
  ).then((caught) => assertNoSecret(caught, "fetchImpl 抛 Bearer token"));
  await expectThrowAsync("response.text() 抛 token", async () =>
    cloudflareV4Get({
      accountId,
      apiToken,
      path: restPath,
      fetchImpl: async () => ({
        status: 200,
        text: async () => {
          throw new Error(apiToken);
        }
      })
    })
  ).then((caught) => assertNoSecret(caught, "response.text() 抛 token"));
  await expectThrowAsync("response.text() 抛 Bearer token", async () =>
    cloudflareV4Get({
      accountId,
      apiToken,
      path: restPath,
      fetchImpl: async () => ({
        status: 200,
        text: async () => {
          throw new Error(`Bearer ${apiToken}`);
        }
      })
    })
  ).then((caught) => assertNoSecret(caught, "response.text() 抛 Bearer token"));
  const leakyJson = `{"success":true,"errors":[],"result":{"name":"saydo","token":"${apiToken}"`;
  await expectThrowAsync("畸形 JSON 含 token", async () =>
    cloudflareV4Get({
      accountId,
      apiToken,
      path: restPath,
      fetchImpl: async () => ({ status: 200, text: async () => leakyJson })
    })
  ).then((caught) => {
    assertNoSecret(caught, "畸形 JSON");
    if (String(caught.message).includes(leakyJson)) throw new Error("畸形 JSON 错误写入完整响应 body");
  });
  await expectThrowAsync("API error message 含 token", async () =>
    cloudflareV4Get({
      accountId,
      apiToken,
      path: restPath,
      fetchImpl: async () =>
        jsonResponse(200, { success: true, errors: [{ message: `CLOUDFLARE_API_TOKEN=${apiToken}` }], result: { name: "saydo" } })
    })
  ).then((caught) => assertNoSecret(caught, "API error message 含 token"));

  const objectResult = { name: "saydo", domains: ["saydo-3xb.pages.dev"] };
  assertCloudflareApiEnvelope({ success: true, errors: [], result: objectResult }, { httpStatus: 200, expectArray: false });
  assertCloudflareApiEnvelope({ success: true, errors: [], result: [{ id: "1" }] }, { httpStatus: 200, expectArray: true });
  expectThrow("payload 是数组", () =>
    assertCloudflareApiEnvelope([{ success: true, errors: [], result: objectResult }], { httpStatus: 200, expectArray: false })
  );
  expectThrow("HTTP 非 200", () =>
    assertCloudflareApiEnvelope({ success: true, errors: [], result: objectResult }, { httpStatus: 201, expectArray: false })
  );
  expectThrow("success 非 true", () =>
    assertCloudflareApiEnvelope({ success: "true", errors: [], result: objectResult }, { httpStatus: 200, expectArray: false })
  );
  expectThrow("errors 缺失", () =>
    assertCloudflareApiEnvelope({ success: true, result: objectResult }, { httpStatus: 200, expectArray: false })
  );
  expectThrow("errors 为对象", () =>
    assertCloudflareApiEnvelope(
      { success: true, errors: { message: "hidden" }, result: objectResult },
      { httpStatus: 200, expectArray: false }
    )
  );
  expectThrow("errors 为字符串", () =>
    assertCloudflareApiEnvelope({ success: true, errors: "none", result: objectResult }, { httpStatus: 200, expectArray: false })
  );
  expectThrow("errors 非空", () =>
    assertCloudflareApiEnvelope(
      { success: true, errors: [{ message: "nope" }], result: objectResult },
      { httpStatus: 200, expectArray: false }
    )
  );
  expectThrow("result 应为对象", () =>
    assertCloudflareApiEnvelope({ success: true, errors: [], result: [{ id: "1" }] }, { httpStatus: 200, expectArray: false })
  );
  expectThrow("result 应为数组", () =>
    assertCloudflareApiEnvelope({ success: true, errors: [], result: objectResult }, { httpStatus: 200, expectArray: true })
  );

  const uniqueBodyFragment = "UNIQUE_CF_BODY_FRAGMENT_7f3a9c2e1b";
  const leakFlags = (caught, fragments = []) => {
    if (!(caught instanceof Error)) {
      return { notError: true, leakedExactToken: false, leakedBearer: false, leakedBody: false, leakedFragment: false };
    }
    const parts = [];
    try {
      if (typeof caught.message === "string") parts.push(caught.message);
    } catch {
      parts.push("message-getter-threw");
    }
    try {
      if (typeof caught.stack === "string") parts.push(caught.stack);
    } catch {
      parts.push("stack-getter-threw");
    }
    try {
      if (caught.cause != null) parts.push(String(caught.cause));
    } catch {
      parts.push("cause-threw");
    }
    const text = parts.join("\n");
    return {
      notError: false,
      text,
      leakedExactToken: text.includes(apiToken),
      leakedBearer: /Bearer/i.test(text),
      leakedBody: typeof leakyJson === "string" && text.includes(leakyJson),
      leakedFragment: fragments.some((fragment) => typeof fragment === "string" && fragment.length > 0 && text.includes(fragment))
    };
  };
  const assertSafeFailure = (caught, label, fragments = []) => {
    if (!(caught instanceof Error)) throw new Error(`${label} 不是稳定 Error`);
    if (typeof caught.message !== "string" || caught.message.length === 0) {
      throw new Error(`${label} 错误对象不可捕获或缺少常量 message`);
    }
    assertNoSecret(caught, label);
    const flags = leakFlags(caught, fragments);
    if (flags.leakedExactToken || flags.leakedBearer || flags.leakedBody || flags.leakedFragment) {
      throw new Error(`${label} 逃逸脱敏:${JSON.stringify({ ...flags, text: flags.text })}`);
    }
  };

  await expectThrowAsync("query getter/Proxy", async () =>
    cloudflareV4Get({
      accountId,
      apiToken,
      path: restPath,
      query: new Proxy(
        {},
        {
          ownKeys() {
            throw new Error(`Bearer ${apiToken}`);
          },
          getOwnPropertyDescriptor() {
            return { enumerable: true, configurable: true };
          }
        }
      ),
      fetchImpl: async () => {
        throw new Error("不应 fetch");
      }
    })
  ).then((caught) => assertSafeFailure(caught, "query getter/Proxy"));
  await expectThrowAsync("参数对象 query getter", async () =>
    cloudflareV4Get(
      new Proxy(
        {
          accountId,
          apiToken,
          path: restPath,
          fetchImpl: async () => {
            throw new Error("不应 fetch");
          }
        },
        {
          get(target, property, receiver) {
            if (property === "query") throw new Error(`Bearer ${apiToken}`);
            return Reflect.get(target, property, receiver);
          }
        }
      )
    )
  ).then((caught) => assertSafeFailure(caught, "参数对象 query getter"));
  await expectThrowAsync("envelope options Proxy getter", () =>
    assertCloudflareApiEnvelope(
      { success: true, errors: [], result: objectResult },
      new Proxy(
        {},
        {
          get() {
            throw new Error(`Bearer ${apiToken}`);
          }
        }
      )
    )
  ).then((caught) => assertSafeFailure(caught, "envelope options Proxy getter"));
  const errorsLengthProxy = () =>
    new Proxy([], {
      get(target, property, receiver) {
        if (property === "length") throw new Error(`Bearer ${apiToken}`);
        return Reflect.get(target, property, receiver);
      }
    });
  await expectThrowAsync("errors length getter", () =>
    assertCloudflareApiEnvelope(
      { success: true, errors: errorsLengthProxy(), result: objectResult },
      { httpStatus: 200, expectArray: false }
    )
  ).then((caught) => assertSafeFailure(caught, "errors length getter"));
  await expectThrowAsync("response.text() 抛 body fragment", async () =>
    cloudflareV4Get({
      accountId,
      apiToken,
      path: restPath,
      fetchImpl: async () => ({
        status: 200,
        text: async () => {
          throw new Error(uniqueBodyFragment);
        }
      })
    })
  ).then((caught) => assertSafeFailure(caught, "response.text() 抛 body fragment", [uniqueBodyFragment]));
  await expectThrowAsync("query 字段 getter", async () =>
    cloudflareV4Get({
      accountId,
      apiToken,
      path: restPath,
      query: {
        get env() {
          throw new Error(apiToken);
        }
      },
      fetchImpl: async () => {
        throw new Error("不应 fetch");
      }
    })
  ).then((caught) => assertSafeFailure(caught, "query 字段 getter"));
  await expectThrowAsync("URL value toString", async () =>
    cloudflareV4Get({
      accountId,
      apiToken,
      path: restPath,
      query: {
        env: {
          toString() {
            throw new Error(`Bearer ${apiToken}`);
          }
        }
      },
      fetchImpl: async () => {
        throw new Error("不应 fetch");
      }
    })
  ).then((caught) => assertSafeFailure(caught, "URL value toString"));
  await expectThrowAsync("fetch 非 Error", async () =>
    cloudflareV4Get({
      accountId,
      apiToken,
      path: restPath,
      fetchImpl: async () => {
        throw {
          toString() {
            throw new Error(`Bearer ${apiToken}`);
          },
          valueOf() {
            throw new Error(apiToken);
          },
          [Symbol.toPrimitive]() {
            throw new Error(`Bearer ${apiToken}`);
          }
        };
      }
    })
  ).then((caught) => assertSafeFailure(caught, "fetch 非 Error"));
  await expectThrowAsync("message getter", async () =>
    cloudflareV4Get({
      accountId,
      apiToken,
      path: restPath,
      fetchImpl: async () => {
        throw {
          get message() {
            throw new Error(`Bearer ${apiToken}`);
          }
        };
      }
    })
  ).then((caught) => assertSafeFailure(caught, "message getter"));
  await expectThrowAsync("恶意 toString", async () =>
    cloudflareV4Get({
      accountId,
      apiToken,
      path: restPath,
      fetchImpl: async () => {
        const evil = {
          message: `Bearer ${apiToken}`,
          toString() {
            throw new Error(`Bearer ${apiToken}`);
          }
        };
        throw evil;
      }
    })
  ).then((caught) => assertSafeFailure(caught, "恶意 toString"));
  await expectThrowAsync("JSON/envelope errors Bearer", async () =>
    cloudflareV4Get({
      accountId,
      apiToken,
      path: restPath,
      fetchImpl: async () =>
        jsonResponse(200, { success: true, errors: [{ message: `Bearer ${apiToken}` }], result: objectResult })
    })
  ).then((caught) => assertSafeFailure(caught, "JSON/envelope errors Bearer"));
  const envelopeBearer = await expectThrowAsync("envelope errors Bearer 导出 helper", () =>
    assertCloudflareApiEnvelope(
      { success: true, errors: [{ message: `Bearer ${apiToken}` }], result: objectResult },
      { httpStatus: 200, expectArray: false }
    )
  );
  assertSafeFailure(envelopeBearer, "envelope errors Bearer 导出 helper");
  const envelopeProxy = await expectThrowAsync("envelope Proxy", () =>
    assertCloudflareApiEnvelope(
      new Proxy(
        { success: true, errors: [], result: objectResult },
        {
          get() {
            throw new Error(`Bearer ${apiToken}`);
          }
        }
      ),
      { httpStatus: 200, expectArray: false }
    )
  );
  assertSafeFailure(envelopeProxy, "envelope Proxy");
  if (redactSecrets({ toString: () => apiToken }, [apiToken]) === apiToken) {
    throw new Error("redactSecrets 对不可信对象调用了 String()");
  }
  if (safeErrorText({
    get message() {
      throw new Error(`Bearer ${apiToken}`);
    }
  }).includes(apiToken)) {
    throw new Error("safeErrorText 解释了二次抛错对象");
  }

  await expectThrowAsync("getPagesProject 参数 Proxy", async () =>
    getPagesProject(
      new Proxy(
        {
          accountId,
          apiToken,
          fetchImpl: async () => {
            throw new Error("不应 fetch");
          }
        },
        {
          get(target, property, receiver) {
            if (property === "project") throw new Error(`Bearer ${apiToken}`);
            return Reflect.get(target, property, receiver);
          }
        }
      )
    )
  ).then((caught) => assertSafeFailure(caught, "getPagesProject 参数 Proxy"));
  await expectThrowAsync("listPagesDeployments 参数 Proxy", async () =>
    listPagesDeployments(
      new Proxy(
        {
          accountId,
          apiToken,
          project: "saydo",
          fetchImpl: async () => {
            throw new Error("不应 fetch");
          }
        },
        {
          get(target, property, receiver) {
            if (property === "environment") throw new Error(`Bearer ${apiToken}`);
            return Reflect.get(target, property, receiver);
          }
        }
      )
    )
  ).then((caught) => assertSafeFailure(caught, "listPagesDeployments 参数 Proxy"));
  const credsProxy = await expectThrowAsync("credential options Proxy", () =>
    requireCloudflareCredentials(
      new Proxy(
        { CLOUDFLARE_ACCOUNT_ID: accountId },
        {
          get(target, property, receiver) {
            if (property === "CLOUDFLARE_API_TOKEN") throw new Error(`Bearer ${apiToken}`);
            return Reflect.get(target, property, receiver);
          }
        }
      )
    )
  );
  assertSafeFailure(credsProxy, "credential options Proxy");
  let resultToJsonCalls = 0;
  const toJsonObject = {
    name: "saydo",
    domains: ["saydo-3xb.pages.dev"],
    toJSON() {
      resultToJsonCalls += 1;
      return [`Bearer ${apiToken}`, uniqueBodyFragment];
    }
  };
  const toJsonEnvelope = assertCloudflareApiEnvelope(
    { success: true, errors: [], result: toJsonObject },
    { httpStatus: 200, expectArray: false }
  );
  if (resultToJsonCalls !== 0) throw new Error("envelope 调用了 result.toJSON");
  if (toJsonEnvelope !== toJsonObject) throw new Error("envelope 不应整对象克隆 result");
  resultToJsonCalls = 0;
  const toJsonArray = Object.assign(["keep-array"], {
    toJSON() {
      resultToJsonCalls += 1;
      return { name: "saydo", token: `Bearer ${apiToken}` };
    }
  });
  const toJsonArrayEnvelope = assertCloudflareApiEnvelope(
    { success: true, errors: [], result: toJsonArray },
    { httpStatus: 200, expectArray: true }
  );
  if (resultToJsonCalls !== 0) throw new Error("envelope 调用了 array result.toJSON");
  if (toJsonArrayEnvelope !== toJsonArray) throw new Error("envelope 不应整对象克隆 array result");
  let nameGetterCalls = 0;
  const getterResult = {
    get name() {
      nameGetterCalls += 1;
      throw new Error(`Bearer ${apiToken}`);
    },
    toJSON() {
      resultToJsonCalls += 1;
      throw new Error(`Bearer ${apiToken} ${uniqueBodyFragment}`);
    }
  };
  assertCloudflareApiEnvelope({ success: true, errors: [], result: getterResult }, { httpStatus: 200, expectArray: false });
  if (nameGetterCalls !== 0 || resultToJsonCalls !== 0) {
    throw new Error("envelope 读取了 result getter/toJSON");
  }
  expectStableReject("revoked envelope payload", () => assertCloudflareApiEnvelope(revokedProxy({ success: true, errors: [], result: {} }), { httpStatus: 200 }), "Cloudflare API 响应不是对象");
  expectStableReject(
    "revoked envelope result",
    () =>
      assertCloudflareApiEnvelope({ success: true, errors: [], result: revokedProxy({ name: "saydo" }) }, { httpStatus: 200, expectArray: false }),
    "Cloudflare API result 不是对象"
  );
}

function parseGithubWorkflowYaml(text) {
  const parsed = spawnSync(
    "python3",
    ["-c", "import json,sys,yaml; json.dump(yaml.load(sys.stdin, Loader=yaml.BaseLoader), sys.stdout)"],
    { input: text, encoding: "utf8" }
  );
  if (parsed.status !== 0) throw new Error(`workflow YAML 解析失败:${parsed.stderr}`);
  return JSON.parse(parsed.stdout);
}

function jobSteps(doc, jobName) {
  const job = doc.jobs?.[jobName];
  if (!job || !Array.isArray(job.steps)) throw new Error(`workflow job 不存在或无 steps:${jobName}`);
  return job.steps.map((step) => ({
    name: step.name ?? "",
    run: typeof step.run === "string" ? step.run : "",
    uses: step.uses ?? ""
  }));
}

function testWorkflowWiring() {
  const text = readFileSync(join(repo, ".github/workflows/release.yml"), "utf8");
  const doc = parseGithubWorkflowYaml(text);
  if (doc.concurrency?.group !== "release-${{ github.ref_name }}") throw new Error("YAML concurrency.group 未按 tag 分组");
  if (doc.concurrency?.["cancel-in-progress"] !== "false") throw new Error("YAML cancel-in-progress 不是 false");
  if (doc.permissions?.actions !== "read" || doc.permissions?.contents !== "read") {
    throw new Error("YAML 顶层 permissions 未显式包含 actions:read");
  }
  const shaJobs = ["snapshot", "publish", "mark-release-available"];
  for (const jobName of shaJobs) {
    const steps = jobSteps(doc, jobName);
    if (!steps.some((step) => step.run.includes("git ls-remote --exit-code origin \"refs/tags/${GITHUB_REF_NAME}\""))) {
      throw new Error(`YAML job ${jobName} 未接线远端 tag SHA readback`);
    }
    if (!steps.some((step) => step.run.includes("scripts/release-tag-guard.mjs uniqueness --require-current"))) {
      throw new Error(`YAML job ${jobName} 未接线分页唯一性`);
    }
  }
  const publishRuns = jobSteps(doc, "publish").map((step) => step.run);
  const writeIndex = publishRuns.findIndex((run) => run.includes("scripts/build-release-artifacts.mjs --write"));
  const checkIndex = publishRuns.findIndex((run) => run.includes("scripts/build-release-artifacts.mjs --check"));
  if (writeIndex < 0 || checkIndex <= writeIndex) throw new Error("YAML publish 未在 --write 之后 --check");
  if (!publishRuns.some((run) => run.includes("scripts/release-asset-manifest.mjs --check-dir") && run.includes("--check-release-json"))) {
    throw new Error("YAML publish 未接线 exact manifest 门");
  }
  if (doc.jobs.publish.permissions?.actions !== "read" || doc.jobs.publish.permissions?.contents !== "write") {
    throw new Error("YAML publish job 权限未同时包含 contents:write 与 actions:read");
  }
}

function testWeekAuditAtomicWriter() {
  const weekAudit = readFileSync(join(scripts, "week-audit.mjs"), "utf8");
  const imports = walkJsClosure(repo, ["scripts/week-audit.mjs"]);
  if (!imports.includes("scripts/release-file-transaction.mjs")) throw new Error("week-audit 未相对导入 atomic writer 模块");
  if (!/\bwriteWeekAuditOutputs\s*\(/.test(weekAudit.split("if (mode === \"--write\")")[1] ?? "")) {
    throw new Error("week-audit --write 未调用 writeWeekAuditOutputs");
  }
  const root = mkdtempSync(join(tmpdir(), "saydo-audit-write-"));
  try {
    const files = WEEK_AUDIT_WRITE_OUTPUTS.map((relative, index) => [join(root, relative), `out-${index}\n`]);
    for (const [path] of files) mkdirSync(dirname(path), { recursive: true });
    let renames = 0;
    writeWeekAuditOutputs(files, (path, content) => {
      writeFileAtomic(path, content, {
        ...defaultFsIo,
        rename(from, to) {
          renames += 1;
          return defaultFsIo.rename(from, to);
        }
      });
    });
    if (renames !== 7) throw new Error(`week-audit writer 未对 7 个输出做 atomic rename:${renames}`);
    for (const [path, content] of files) {
      if (readFileSync(path, "utf8") !== content) throw new Error(`week-audit writer 字节不符:${path}`);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function testPhysicalClosureAndWindowsProbe() {
  const js = walkJsClosure(repo, ["scripts/post-release-gate.mjs", "scripts/verify-release-url.mjs", "scripts/week-audit.mjs"]);
  const closure = physicalToolClosure(repo);
  if (!js.includes("scripts/release-asset-manifest.mjs") || !js.includes("scripts/release-file-transaction.mjs")) {
    throw new Error("实体门 JS 闭包漏了 verifier/post-gate 传递依赖");
  }
  if (!closure.includes(TRACKED_ASSET_MANIFEST_RELATIVE_PATH) || !closure.includes(WINDOWS_WRAPPER_RELATIVE_PATH)) {
    throw new Error("实体门闭包漏了 PowerShell/data 根");
  }
  const extraJs = js.filter((path) => !closure.includes(path));
  if (extraJs.length) throw new Error(`walk 出未登记相对 import:${extraJs.join(",")}`);
  expectThrow("unsafe verifier path", () => assertSafeRemoteVerifierPath("verify-release-url.mjs"));
  expectThrow("parent verifier path", () => assertSafeRemoteVerifierPath("../scripts/verify-release-url.mjs"));
  assertSafeRemoteVerifierPath(WINDOWS_VERIFIER_RELATIVE_PATH);
  const files = windowsVerifierClosure(repo);
  if (!files.includes("scripts/release-asset-manifest.mjs") || !files.includes(TRACKED_ASSET_MANIFEST_RELATIVE_PATH)) {
    throw new Error("Windows verifier 闭包不是完整相对 import/data 集");
  }
  const parent = mkdtempSync(join(tmpdir(), "saydo-win-closure-"));
  try {
    const incomplete = join(parent, "incomplete");
    materializeClosure(repo, [WINDOWS_VERIFIER_RELATIVE_PATH, WINDOWS_WRAPPER_RELATIVE_PATH], incomplete);
    const missing = probeVerifierModuleLoad(process.execPath, incomplete);
    if (missing.status === 0 || !String(missing.stderr).includes("ERR_MODULE_NOT_FOUND")) {
      throw new Error(`旧两文件闭包应在 import 阶段失败:${JSON.stringify({ status: missing.status, stderr: missing.stderr })}`);
    }
    const complete = join(parent, "complete");
    materializeClosure(repo, files, complete);
    const loaded = probeVerifierModuleLoad(process.execPath, complete);
    if (loaded.status !== 2 || !String(loaded.stderr).includes("用法:node scripts/verify-release-url.mjs")) {
      throw new Error(`完整闭包未到达 usage 门:${JSON.stringify({ status: loaded.status, stderr: loaded.stderr })}`);
    }
    if (String(loaded.stderr).includes("ERR_MODULE_NOT_FOUND") || String(loaded.stderr).includes("缺少 tracked asset manifest")) {
      throw new Error("完整闭包误报 import/manifest 错误");
    }
    const drifted = join(parent, "drift");
    materializeClosure(repo, files, drifted);
    writeFileSync(join(drifted, "scripts/release-asset-manifest.mjs"), `${readFileSync(join(drifted, "scripts/release-asset-manifest.mjs"), "utf8")}\n`);
    expectThrow("helper digest drift", () =>
      assertClosureFingerprints(hashClosureFiles(drifted, files), hashClosureFiles(repo, files), "windows helper")
    );
    const manifestDrift = join(parent, "manifest-drift");
    materializeClosure(repo, files, manifestDrift);
    writeFileSync(join(manifestDrift, TRACKED_ASSET_MANIFEST_RELATIVE_PATH), "{}\n");
    expectThrow("manifest digest drift", () =>
      assertClosureFingerprints(hashClosureFiles(manifestDrift, files), hashClosureFiles(repo, files), "windows manifest")
    );
    expectThrow("materialize exists", () => materializeClosure(repo, files, complete, { failIfExists: true }));
    windowsRemoteRootName("11111111-1111-4111-8111-111111111111");
    const publicationEntries = closure.map((path) => ({ path, kind: "file", sha256: hashClosureFiles(repo, [path])[path] }));
    assertPhysicalToolFingerprints({
      files: closure,
      worktreeHashes: hashClosureFiles(repo, closure),
      tagHashes: hashClosureFiles(repo, closure),
      publicationEntries
    });
    expectThrow("missing publication entry", () =>
      assertPhysicalToolFingerprints({
        files: closure,
        worktreeHashes: hashClosureFiles(repo, closure),
        tagHashes: hashClosureFiles(repo, closure),
        publicationEntries: publicationEntries.slice(1)
      })
    );
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
}

async function testFinalIndependentReviewRegressions() {
  const publicMain = sha("1").slice(0, 40);
  const durable = {
    schemaVersion: 1,
    status: "started",
    release: { tag: "v0.1.0-rc.4" },
    publicMain,
    publicCi: { workflowRunId: 9 },
    sites: [
      {
        project: "saydo",
        directory: "deploy/saydo-octoooo-com",
        planned: {
          previewBranch: "preview-v0.1.0-rc.4",
          productionBranch: "main",
          canonicalHost: canonicalHost("saydo")
        },
        preview: { status: "planned" },
        production: { status: "planned" }
      },
      {
        project: "saydo-link",
        directory: "deploy/link-saydo-octoooo-com",
        planned: {
          previewBranch: "preview-v0.1.0-rc.4",
          productionBranch: "main",
          canonicalHost: canonicalHost("saydo-link")
        },
        preview: { status: "planned" },
        production: { status: "planned" }
      }
    ],
    completedSites: [],
    failedStage: null,
    error: null
  };

  if (!openatSupported()) throw new Error("本机缺少 POSIX openat helper");
  const win = splitAnchoredPath("C:\\Users\\a\\evidence.json", path.win32);
  if (win.root !== "C:\\") throw new Error("Windows drive root 构造错误");
  if (win.root.startsWith("\\\\") || win.parts.some((part) => part.includes(":"))) {
    throw new Error("Windows drive root 生成了非法前缀");
  }

  const claimDir = mkdtempSync(join(tmpdir(), "saydo-claim-close-"));
  try {
    const claimPath = join(claimDir, "evidence.json");
    let claimError;
    let claimLease;
    try {
      claimLease = acquireDeployEvidenceLease(claimPath, {
        anchored: {
          claim(target, body) {
            const created = defaultAnchoredIo.claim(target, body);
            if (created.ok) return { ok: false, error: "部署证据租约写入失败" };
            return created;
          }
        }
      });
    } catch (caught) {
      claimError = caught;
    }
    if (claimLease && claimLease.kind === "fresh") throw new Error("claim close 失败仍返回 fresh lease");
    if (!claimError) throw new Error("claim close 失败未拒绝");
    if (claimError.message !== "部署证据租约写入失败") throw new Error("claim close 错误不是常量");
    if (!existsSync(claimPath)) throw new Error("claim close 失败后租约文件被删除");
    const recovered = acquireDeployEvidenceLease(claimPath);
    if (recovered.kind === "fresh") throw new Error("claim close 失败后仍取得第二把 fresh lease");
  } finally {
    rmSync(claimDir, { recursive: true, force: true });
  }

  const readDir = mkdtempSync(join(tmpdir(), "saydo-read-close-"));
  try {
    const readPath = join(readDir, "evidence.json");
    writeFileSync(readPath, '{"schemaVersion":1,"status":"claimed"}\n');
    let readError;
    let readResult;
    try {
      readResult = readDeployEvidenceFile(readPath, {
        anchored: {
          read(target) {
            const loaded = defaultAnchoredIo.read(target);
            if (loaded.ok) return { ok: false, error: "既有部署证据读取失败" };
            return loaded;
          }
        }
      });
    } catch (caught) {
      readError = caught;
    }
    if (readResult) throw new Error("read close 失败仍返回证据");
    if (!readError) throw new Error("read close 失败未拒绝");
    if (readError.message !== "既有部署证据读取失败") throw new Error("read close 错误不是常量");
  } finally {
    rmSync(readDir, { recursive: true, force: true });
  }

  const leaseHandle = makeFreshLease();
  try {
    let leaseError;
    try {
      assertLeaseHeld(leaseHandle.lease, {
        ...defaultFsIo,
        anchored: {
          lease() {
            return { ok: false, error: "部署证据租约已失效" };
          }
        }
      });
    } catch (caught) {
      leaseError = caught;
    }
    if (!leaseError) throw new Error("lease close 失败仍判定租约有效");
    if (leaseError.message !== "部署证据租约已失效") throw new Error("lease close 错误不是常量");

    let persistError;
    try {
      persistClaimedDeployEvidence(leaseHandle.lease, durable, {
        ...defaultFsIo,
        anchored: {
          lease: defaultAnchoredIo.lease.bind(defaultAnchoredIo),
          persist() {
            return { ok: false, error: "部署证据写入失败" };
          }
        }
      });
    } catch (caught) {
      persistError = caught;
    }
    if (!persistError) throw new Error("persist close 失败仍成功");
    if (persistError.message !== "部署证据写入失败") throw new Error("persist close 错误不是常量");
  } finally {
    cleanupLease(leaseHandle);
  }

  expectStableReject(
    "revoked open code",
    () => {
      const dir = mkdtempSync(join(tmpdir(), "saydo-revoked-open-"));
      try {
        readDeployEvidenceFile(join(dir, "missing.json"), {
          anchored: {
            read() {
              throw revokedProxy();
            }
          }
        });
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    "既有部署证据读取失败"
  );

  const forgedDurable = new Proxy(
    {},
    {
      getOwnPropertyDescriptor() {
        return { configurable: true, enumerable: false, writable: false, value: true };
      },
      get(_target, property) {
        if (property === "message") return "既有部署证据非法";
        return true;
      }
    }
  );
  let durableCaught;
  try {
    projectDurableEvidence(
      new Proxy(durable, {
        getOwnPropertyDescriptor() {
          throw forgedDurable;
        }
      })
    );
  } catch (caught) {
    durableCaught = caught;
  }
  if (!durableCaught) throw new Error("伪造 durable projection error 未拒绝");
  if (durableCaught === forgedDurable) throw new Error("伪造 durable projection error 对象身份逸出");
  if (durableCaught.message !== "既有部署证据非法") throw new Error("伪造 durable projection error 未替换为受控常量");

  const parentRoot = mkdtempSync(join(tmpdir(), "saydo-parent-link-"));
  try {
    const inside = join(parentRoot, "inside");
    const outside = join(parentRoot, "outside");
    mkdirSync(inside);
    mkdirSync(outside);
    const redirect = join(inside, "redirect");
    symlinkSync(outside, redirect);
    const claimPath = join(redirect, "evidence.json");
    expectThrow("parent dir symlink claim", () => acquireDeployEvidenceLease(claimPath));
    if (existsSync(join(outside, "evidence.json"))) throw new Error("父目录 symlink 在树外创建了文件");
    const realRedirect = join(inside, "real");
    mkdirSync(realRedirect);
    const swapClaim = join(realRedirect, "evidence.json");
    let swapError;
    try {
      acquireDeployEvidenceLease(swapClaim, {
        anchored: {
          claim(target, body) {
            rmSync(realRedirect, { recursive: true, force: true });
            symlinkSync(outside, realRedirect);
            return defaultAnchoredIo.claim(target, body);
          }
        }
      });
    } catch (caught) {
      swapError = caught;
    }
    if (!swapError) throw new Error("open 边界父目录换 symlink 仍取得租约");
    if (existsSync(join(outside, "evidence.json"))) throw new Error("open 边界换 symlink 后树外出现 claim");
  } finally {
    rmSync(parentRoot, { recursive: true, force: true });
  }

  const fingerprint = () => ({ kind: "file", mode: 0o644, bytes: 1, sha256: "a".repeat(64) });
  const generatedOutputs = new Set(["research/week-audit/2026-08-22-bundle-integrity.json"]);
  const publicPath = "README.md";
  const emptyIdentity = privateExcludedIdentity([publicPath], fingerprint);
  assertPublicationExactSet({
    livePaths: { tracked: [publicPath], others: [] },
    entryPaths: [publicPath],
    generatedOutputs,
    privateExcludedCount: emptyIdentity.count,
    privateExcludedDigest: emptyIdentity.digest,
    fingerprint
  });
  const injectedPrefix = "artifacts/release/copyright/";
  const injectedName = `${injectedPrefix}injected`;
  try {
    assertPublicationExactSet({
      livePaths: { tracked: [publicPath, injectedName], others: [] },
      entryPaths: [publicPath],
      generatedOutputs,
      privateExcludedCount: emptyIdentity.count,
      privateExcludedDigest: emptyIdentity.digest,
      fingerprint
    });
    throw new Error("私有路径注入未拒绝");
  } catch (error) {
    if (error.message === "私有路径注入未拒绝") throw error;
    if (error.message !== "公开发布树仍含私有排除路径") throw new Error("私有路径注入错误不是常量");
    if (String(error.message).includes(injectedPrefix) || String(error.stack ?? "").includes(injectedPrefix)) {
      throw new Error("私有路径注入错误含私有路径");
    }
  }
  assertPublicationExactSet({
    livePaths: { tracked: [publicPath], others: ["prompts/extra-untracked.md"] },
    entryPaths: [publicPath],
    generatedOutputs,
    privateExcludedCount: emptyIdentity.count,
    privateExcludedDigest: emptyIdentity.digest,
    fingerprint
  });
  try {
    assertPublicationExactSet({
      livePaths: { tracked: [publicPath], others: ["scripts/new-helper.mjs"] },
      entryPaths: [publicPath],
      generatedOutputs,
      privateExcludedCount: emptyIdentity.count,
      privateExcludedDigest: emptyIdentity.digest,
      fingerprint
    });
    throw new Error("未入 index 的应发布源未拒绝");
  } catch (error) {
    if (error.message === "未入 index 的应发布源未拒绝") throw error;
    if (error.message !== "应发布源文件未入 index") throw new Error("未入 index 源文件错误不是常量");
  }

  const accountId = "a".repeat(32);
  const apiToken = "t".repeat(40);
  const forgedPublic = new Proxy(
    {},
    {
      getOwnPropertyDescriptor(_target, property) {
        if (property === "name") return { configurable: true, value: "CloudflarePublicError" };
        if (property === "message") return { configurable: true, value: "forged-public" };
        return { configurable: true, value: true };
      },
      get(_target, property) {
        if (property === "name") return "CloudflarePublicError";
        if (property === "message") return "forged-public";
        return true;
      }
    }
  );
  const publicCaught = await expectThrowAsync("forged cloudflare public", async () =>
    cloudflareV4Get({
      accountId,
      apiToken,
      path: `/accounts/${accountId}/pages/projects/saydo`,
      fetchImpl: async () => {
        throw forgedPublic;
      }
    })
  );
  if (publicCaught === forgedPublic) throw new Error("伪造 Cloudflare public error 对象身份逸出");
  if (publicCaught.message !== "Cloudflare API 失败") throw new Error("伪造 Cloudflare public error 未替换为受控常量");
  if (String(publicCaught.message).includes("forged-public") || String(publicCaught.stack ?? "").includes("forged-public")) {
    throw new Error("伪造 Cloudflare public error 攻击文本逸出");
  }

  let envelopeCaught;
  try {
    assertCloudflareApiEnvelope(forgedPublic, { httpStatus: 200 });
  } catch (caught) {
    envelopeCaught = caught;
  }
  if (!envelopeCaught) throw new Error("envelope 伪造 public error 未拒绝");
  if (envelopeCaught === forgedPublic) throw new Error("envelope 伪造错误对象身份逸出");
  if (String(envelopeCaught.message).includes("forged-public") || String(envelopeCaught.stack ?? "").includes("forged-public")) {
    throw new Error("envelope 伪造错误攻击文本逸出");
  }

  let genuinePublic;
  try {
    assertCloudflareApiEnvelope(null, { httpStatus: 200 });
  } catch (caught) {
    genuinePublic = caught;
  }
  try {
    genuinePublic.message = "UNIQUE_REPLAY_TEXT";
  } catch {
    // frozen
  }
  const replayedPublic = await expectThrowAsync("owned error replay", async () =>
    cloudflareV4Get({
      accountId,
      apiToken,
      path: `/accounts/${accountId}/pages/projects/saydo`,
      fetchImpl: async () => {
        throw genuinePublic;
      }
    })
  );
  if (replayedPublic === genuinePublic) throw new Error("owned error replay 对象身份逸出");
  if (String(replayedPublic.message).includes("UNIQUE_REPLAY_TEXT") || String(replayedPublic.stack ?? "").includes("UNIQUE_REPLAY_TEXT")) {
    throw new Error("owned error replay 泄漏改写文本");
  }

  const smSites = [
    { project: "saydo", directory: "deploy/saydo-octoooo-com", previewBranch: "preview-v0.1.0-rc.4", productionBranch: "main" },
    { project: "saydo-link", directory: "deploy/link-saydo-octoooo-com", previewBranch: "preview-v0.1.0-rc.4", productionBranch: "main" }
  ];
  const smSeed = { release: { tag: "v0.1.0-rc.4" }, publicMain, publicCi: { workflowRunId: 9 } };
  const attackMark = "UNIQUE_ATTACK_TEXT";
  const persistFailedProxy = new Proxy(new Error(attackMark), {
    get(target, property) {
      if (property === "persistFailed") return true;
      if (property === "message") return attackMark;
      if (property === "stage") return "attacker-stage";
      return Reflect.get(target, property);
    }
  });
  const proxyHandle = makeFreshLease();
  const proxyPersisted = [];
  let proxyCaught;
  try {
    await runPagesDeployStateMachine({
      evidenceSeed: smSeed,
      sites: smSites,
      wrangler: async () => {
        throw persistFailedProxy;
      },
      listDeployments: async () => [],
      readProject: async ({ project }) => projectReadback(project),
      fetchHttp: async (url) => ({ ok: true, status: 200, url, body: currentAvailabilityBody() }),
      persist: async (snapshot) => {
        proxyPersisted.push(snapshot);
      },
      audit: async () => {},
      officialPages: officialPagesFixture,
      lease: proxyHandle.lease
    });
  } catch (caught) {
    proxyCaught = caught;
  } finally {
    cleanupLease(proxyHandle);
  }
  if (!proxyCaught) throw new Error("forged persistFailed 未拒绝");
  if (proxyCaught === persistFailedProxy) throw new Error("forged persistFailed sameObject");
  const proxyText = `${proxyCaught.message}\n${proxyCaught.stack ?? ""}\n${JSON.stringify(proxyPersisted)}`;
  if (proxyText.includes(attackMark) || proxyText.includes("attacker-stage")) {
    throw new Error("forged persistFailed 攻击文本逸出");
  }
  if (proxyPersisted.some((item) => item?.error?.message?.includes(attackMark))) {
    throw new Error("forged persistFailed 写入 evidence");
  }

  const revokedHandle = makeFreshLease();
  const revokedPersisted = [];
  let revokedCaught;
  try {
    await runPagesDeployStateMachine({
      evidenceSeed: smSeed,
      sites: smSites,
      wrangler: async () => "Deployed",
      listDeployments: async () => [],
      readProject: async () => {
        throw revokedProxy();
      },
      fetchHttp: async () => ({ ok: true, status: 200, body: currentAvailabilityBody() }),
      persist: async (snapshot) => {
        revokedPersisted.push(snapshot);
      },
      audit: async () => {},
      officialPages: officialPagesFixture,
      lease: revokedHandle.lease
    });
  } catch (caught) {
    revokedCaught = caught;
  } finally {
    cleanupLease(revokedHandle);
  }
  if (!revokedCaught) throw new Error("revoked readProject 未拒绝");
  const revokedText = `${revokedCaught.message}\n${revokedCaught.stack ?? ""}`;
  if (/revoked|IsArray|HasInstance|Cannot perform/i.test(revokedText)) {
    throw new Error("revoked readProject 引擎文本逸出");
  }
  if (revokedPersisted.at(-1)?.error?.message && revokedPersisted.at(-1).error.message !== "部署失败") {
    throw new Error("revoked readProject evidence 不是受控常量");
  }

  const auditHandle = makeFreshLease();
  const auditPersisted = [];
  try {
    await runPagesDeployStateMachine({
      evidenceSeed: smSeed,
      sites: smSites,
      wrangler: async (req) => `Deployed to ${previewUrl(req.project)}`,
      listDeployments: async ({ project, environment }) => [
        deploymentRecord({
          project,
          environment,
          branch: environment === "preview" ? "preview-v0.1.0-rc.4" : "main",
          publicMain,
          url: previewUrl(project)
        })
      ],
      readProject: async ({ project }) => projectReadback(project),
      fetchHttp: async (url) => ({ ok: true, status: 200, url, body: currentAvailabilityBody() }),
      persist: async (snapshot) => {
        auditPersisted.push(snapshot);
      },
      audit: async () => {
        throw new Proxy(
          {},
          {
            get(_t, property) {
              if (property === "message") return attackMark;
              return undefined;
            }
          }
        );
      },
      officialPages: officialPagesFixture,
      lease: auditHandle.lease
    });
  } catch {
    // expected
  } finally {
    cleanupLease(auditHandle);
  }
  if (auditPersisted.some((item) => item?.error?.message?.includes(attackMark))) {
    throw new Error("audit Proxy 攻击文本写入 evidence");
  }

  const posixHelper = readFileSync(join(scripts, "release-openat-posix.py"), "utf8");
  const openatSource = readFileSync(join(scripts, "release-openat.mjs"), "utf8");
  const pagesDeploySource = readFileSync(join(scripts, "release-pages-deploy.mjs"), "utf8");
  const fileTxSource = readFileSync(join(scripts, "release-file-transaction.mjs"), "utf8");
  if (!posixHelper.includes(`MAX_EVIDENCE_BYTES = ${MAX_EVIDENCE_BYTES}`)) {
    throw new Error("Python/Node MAX_EVIDENCE_BYTES 合同不一致");
  }
  if (!posixHelper.includes(`MAX_IDENTITY_DIGITS = ${MAX_IDENTITY_DIGITS}`)) {
    throw new Error("Python/Node MAX_IDENTITY_DIGITS 合同不一致");
  }
  if (!posixHelper.includes("st.st_nlink == 1") || !posixHelper.includes("os.fsync(parent_fd)")) {
    throw new Error("POSIX helper 缺少 nlink 或 parent dir fsync");
  }
  if (fileTxSource.includes("io?.anchored?.persist") || pagesDeploySource.includes("...io.anchored") || openatSource.includes("...anchored")) {
    throw new Error("公共入口仍 spread 或可选链读取不可信 anchored");
  }
  if (/String\(\s*output\s*\)/.test(pagesDeploySource)) {
    throw new Error("parseWranglerDeploymentUrl 仍 String(output)");
  }
  if (!isIdentityDecimal("9007199254740993") || isIdentityDecimal(9007199254740993) || isIdentityDecimal("1e2") || isIdentityDecimal("-1") || isIdentityDecimal("01") || isIdentityDecimal("+1")) {
    throw new Error("identity decimal 校验不正确");
  }

  const tmpRoot = mkdtempSync(join(tmpdir(), "saydo-openat-root-"));
  try {
    const okPath = join(tmpRoot, "ok.json");
    const okLease = acquireDeployEvidenceLease(okPath);
    if (okLease.kind !== "fresh" || !isIdentityDecimal(okLease.dev) || !isIdentityDecimal(okLease.ino)) {
      throw new Error("真实 temp root claim 失败");
    }
    if (typeof okLease.dev !== "string" || typeof okLease.ino !== "string") {
      throw new Error("真实 temp root identity 不是字符串");
    }

    const outside = join(tmpRoot, "outside");
    mkdirSync(outside);
    const sentinel = join(outside, "sentinel.txt");
    const sentinelBytes = "SENTINEL_UNCHANGED\n";
    writeFileSync(sentinel, sentinelBytes);
    const planted = join(tmpRoot, "planted.json");
    linkSync(sentinel, planted);
    if (lstatSync(planted).nlink < 2) throw new Error("hardlink 未建立");
    const plantedIdentity = { dev: String(lstatSync(planted).dev), ino: String(lstatSync(planted).ino) };
    let plantedPersistError;
    try {
      replaceRegularFileInPlace(planted, Buffer.from("after\n"), plantedIdentity);
    } catch (caught) {
      plantedPersistError = caught;
    }
    if (!plantedPersistError) throw new Error("hardlink 原 evidence persist 未拒绝");
    if (readFileSync(sentinel, "utf8") !== sentinelBytes) throw new Error("hardlink persist 改写了外部 sentinel");
    let plantedClaimedError;
    try {
      persistClaimedDeployEvidence({ kind: "existing", path: planted, dev: plantedIdentity.dev, ino: plantedIdentity.ino }, durable);
    } catch (caught) {
      plantedClaimedError = caught;
    }
    if (!plantedClaimedError) throw new Error("hardlink persistClaimed 未拒绝");
    if (readFileSync(sentinel, "utf8") !== sentinelBytes) throw new Error("hardlink persistClaimed 改写了外部 sentinel");
    expectThrow("hardlink planted read", () => readDeployEvidenceFile(planted));
    if (readFileSync(sentinel, "utf8") !== sentinelBytes) throw new Error("hardlink read 改写了外部 sentinel");
    expectThrow("hardlink planted lease", () =>
      assertLeaseHeld({ kind: "existing", path: planted, dev: plantedIdentity.dev, ino: plantedIdentity.ino })
    );
    if (readFileSync(sentinel, "utf8") !== sentinelBytes) throw new Error("hardlink lease 改写了外部 sentinel");

    const linked = join(tmpRoot, "linked.json");
    const linkedLease = acquireDeployEvidenceLease(linked);
    linkSync(linked, join(outside, "alias.json"));
    const linkedBefore = readFileSync(linked);
    let hardlinkError;
    try {
      persistClaimedDeployEvidence(linkedLease, durable);
    } catch (caught) {
      hardlinkError = caught;
    }
    if (!hardlinkError) throw new Error("lease 后 hardlink persist 未拒绝");
    if (readFileSync(sentinel, "utf8") !== sentinelBytes) throw new Error("lease 后 hardlink persist 改写了外部 sentinel");
    if (!readFileSync(linked).equals(linkedBefore) || !readFileSync(join(outside, "alias.json")).equals(linkedBefore)) {
      throw new Error("lease 后 hardlink persist 覆盖了共享 inode");
    }
    expectThrow("hardlink read", () => readDeployEvidenceFile(linked));
    expectThrow("hardlink lease", () => assertLeaseHeld(linkedLease));
    if (readFileSync(sentinel, "utf8") !== sentinelBytes) throw new Error("hardlink 后续路径改写了 sentinel");
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }

  const realDir = mkdtempSync(join("/tmp", "saydo-second-real-"));
  const outsideDir = mkdtempSync(join("/tmp", "saydo-second-out-"));
  const outsideMarker = join(outsideDir, "outside-marker.txt");
  writeFileSync(outsideMarker, "OUTSIDE_UNTOUCHED\n");
  const linkDir = join("/tmp", `saydo-second-sym-${Date.now()}`);
  try {
    symlinkSync(outsideDir, linkDir);
    const secondPath = join(linkDir, "evidence.json");
    let secondError;
    try {
      acquireDeployEvidenceLease(secondPath);
    } catch (caught) {
      secondError = caught;
    }
    if (!secondError) throw new Error("第二个 parent symlink 未拒绝");
    if (existsSync(join(outsideDir, "evidence.json")) || existsSync(join(realDir, "evidence.json"))) {
      throw new Error("第二个 parent symlink 在树外创建了文件");
    }
    if (readFileSync(outsideMarker, "utf8") !== "OUTSIDE_UNTOUCHED\n") {
      throw new Error("第二个 parent symlink 改写了 outside");
    }
    expectThrow("second parent read", () => readDeployEvidenceFile(secondPath));
    expectThrow("second parent persist", () =>
      replaceRegularFileInPlace(secondPath, Buffer.from("x\n"), { dev: "1", ino: "1" })
    );
    if (existsSync(join(outsideDir, "evidence.json"))) throw new Error("第二个 parent symlink 后续入口在 outside 创建了文件");
    if (readFileSync(outsideMarker, "utf8") !== "OUTSIDE_UNTOUCHED\n") throw new Error("第二个 parent symlink 后续入口改写了 outside");
  } finally {
    rmSync(linkDir, { recursive: true, force: true });
    rmSync(realDir, { recursive: true, force: true });
    rmSync(outsideDir, { recursive: true, force: true });
  }

  const oversizeDir = mkdtempSync(join(tmpdir(), "saydo-oversize-"));
  try {
    const oversizePath = join(oversizeDir, "big.json");
    writeFileSync(oversizePath, `${"a".repeat(MAX_EVIDENCE_BYTES + 1)}\n`);
    expectStableReject("oversize read", () => readDeployEvidenceFile(oversizePath), "既有部署证据过大");
  } finally {
    rmSync(oversizeDir, { recursive: true, force: true });
  }

  const idDir = mkdtempSync(join(tmpdir(), "saydo-id-"));
  try {
    const idPath = join(idDir, "id.json");
    writeFileSync(idPath, '{"schemaVersion":1,"status":"claimed"}\n');
    const before = readFileSync(idPath);
    const huge = String(Number.MAX_SAFE_INTEGER + 2);
    expectThrow("numeric identity", () =>
      replaceRegularFileInPlace(idPath, Buffer.from("after\n"), { dev: Number.MAX_SAFE_INTEGER + 2, ino: 1 })
    );
    expectThrow("exponent identity", () => replaceRegularFileInPlace(idPath, Buffer.from("after\n"), { dev: "1e2", ino: "1" }));
    expectThrow("signed identity", () => replaceRegularFileInPlace(idPath, Buffer.from("after\n"), { dev: "-1", ino: "1" }));
    expectThrow("bool identity", () => replaceRegularFileInPlace(idPath, Buffer.from("after\n"), { dev: true, ino: "1" }));
    expectThrow("leading zero identity", () => replaceRegularFileInPlace(idPath, Buffer.from("after\n"), { dev: "01", ino: "1" }));
    expectThrow("huge unmatched identity", () => replaceRegularFileInPlace(idPath, Buffer.from("after\n"), { dev: huge, ino: "1" }));
    if (!readFileSync(idPath).equals(before)) throw new Error("非法 identity 仍发生了 mutation");
    let hugeClaim;
    try {
      hugeClaim = acquireDeployEvidenceLease(join(idDir, "huge.json"), {
        anchored: {
          claim() {
            return { ok: true, dev: huge, ino: "1" };
          }
        }
      });
    } catch {
      hugeClaim = null;
    }
    if (!hugeClaim || hugeClaim.kind !== "fresh") throw new Error("大整数 identity 字符串模拟结果未接受");
    if (hugeClaim.dev !== huge || typeof hugeClaim.dev !== "string") {
      throw new Error("大整数 identity 被 Number 折叠");
    }
    let numericClaim;
    try {
      numericClaim = acquireDeployEvidenceLease(join(idDir, "numeric.json"), {
        anchored: {
          claim() {
            return { ok: true, dev: Number.MAX_SAFE_INTEGER + 2, ino: 1 };
          }
        }
      });
    } catch {
      numericClaim = null;
    }
    if (numericClaim && numericClaim.kind === "fresh") throw new Error("JSON number identity 模拟结果被当成 fresh lease");
  } finally {
    rmSync(idDir, { recursive: true, force: true });
  }

  const fsyncDir = mkdtempSync(join(tmpdir(), "saydo-parent-fsync-"));
  try {
    const fsyncPath = join(fsyncDir, "claim.json");
    let fsyncLease;
    let fsyncError;
    try {
      fsyncLease = acquireDeployEvidenceLease(fsyncPath, {
        anchored: {
          claim(target, body) {
            return runOpenatHelper({ op: "claim", path: target, body, failParentFsync: true });
          }
        }
      });
    } catch (caught) {
      fsyncError = caught;
    }
    if (fsyncLease && fsyncLease.kind === "fresh") throw new Error("parent fsync 失败仍返回 fresh");
    if (!fsyncError) throw new Error("parent fsync 失败未拒绝");
    if (!existsSync(fsyncPath)) throw new Error("parent fsync 失败后 claim 被危险删除");
    const recovered = acquireDeployEvidenceLease(fsyncPath);
    if (recovered.kind === "fresh") throw new Error("parent fsync 失败后危险删除并重新 claim");
  } finally {
    rmSync(fsyncDir, { recursive: true, force: true });
  }

  const hostileDir = mkdtempSync(join(tmpdir(), "saydo-hostile-api-"));
  try {
    const hostilePath = join(hostileDir, "h.json");
    writeFileSync(hostilePath, '{"schemaVersion":1,"status":"claimed"}\n');
    const beforeHostile = readFileSync(hostilePath);
    const stat = lstatSync(hostilePath);
    const identity = { dev: String(stat.dev), ino: String(stat.ino) };
    const attack = "UNIQUE_HOSTILE_API";
    const getterIo = {
      get anchored() {
        throw new Error(attack);
      }
    };
    expectStableReject(
      "getter persist",
      () => replaceRegularFileInPlace(hostilePath, Buffer.from("x\n"), identity, getterIo),
      "部署证据写入失败",
      attack,
      getterIo
    );
    if (!readFileSync(hostilePath).equals(beforeHostile)) throw new Error("getter persist 仍 mutation");
    const persistGetterIo = {
      anchored: {
        get persist() {
          throw new Error(attack);
        }
      }
    };
    expectStableReject(
      "getter persist method",
      () => replaceRegularFileInPlace(hostilePath, Buffer.from("x\n"), identity, persistGetterIo),
      "部署证据写入失败",
      attack,
      persistGetterIo
    );
    if (!readFileSync(hostilePath).equals(beforeHostile)) throw new Error("getter persist method 仍 mutation");
    const ownKeysProxy = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error(attack);
        },
        getOwnPropertyDescriptor() {
          return undefined;
        }
      }
    );
    const ownKeysIo = { anchored: ownKeysProxy };
    replaceRegularFileInPlace(hostilePath, Buffer.from("after-ownkeys\n"), identity, ownKeysIo);
    if (readFileSync(hostilePath, "utf8") !== "after-ownkeys\n") throw new Error("ownKeys Proxy 阻止了 default persist");
    const revokedAnchored = revokedProxy();
    expectStableReject(
      "revoked persist",
      () => replaceRegularFileInPlace(hostilePath, Buffer.from("x\n"), identity, { anchored: revokedAnchored }),
      "部署证据写入失败",
      undefined,
      revokedAnchored
    );
    const primitive = {
      [Symbol.toPrimitive]() {
        throw new Error(attack);
      },
      toString() {
        throw new Error(attack);
      },
      valueOf() {
        throw new Error(attack);
      }
    };
    expectStableReject(
      "toPrimitive wrangler",
      () => parseWranglerDeploymentUrl(primitive, canonicalHost("saydo")),
      "Wrangler 输出未包含 canonical host 的 hash URL",
      attack,
      primitive
    );
    const revokedOutput = revokedProxy({ marker: attack });
    expectStableReject(
      "revoked wrangler",
      () => parseWranglerDeploymentUrl(revokedOutput, canonicalHost("saydo")),
      "Wrangler 输出未包含 canonical host 的 hash URL",
      attack,
      revokedOutput
    );
    expectStableReject("getter claim io", () => acquireDeployEvidenceLease(join(hostileDir, "g.json"), getterIo), "部署证据路径非法", attack, getterIo);
    const ownKeysClaim = acquireDeployEvidenceLease(join(hostileDir, "ownkeys-claim.json"), ownKeysIo);
    if (ownKeysClaim.kind !== "fresh") throw new Error("ownKeys claim 未回落到 default");
  } finally {
    rmSync(hostileDir, { recursive: true, force: true });
  }

  const asciiMax = "a".repeat(MAX_EVIDENCE_BYTES);
  const asciiOver = "a".repeat(MAX_EVIDENCE_BYTES + 1);
  const unicodeMax = `${"a".repeat(MAX_EVIDENCE_BYTES - 3)}\u4f60`;
  const unicodeOver = `${"a".repeat(MAX_EVIDENCE_BYTES - 2)}\u4f60`;
  if (Buffer.byteLength(asciiMax) !== MAX_EVIDENCE_BYTES || Buffer.byteLength(asciiOver) !== MAX_EVIDENCE_BYTES + 1) {
    throw new Error("ASCII 证据字节边界夹具不正确");
  }
  if (Buffer.byteLength(unicodeMax, "utf8") !== MAX_EVIDENCE_BYTES || Buffer.byteLength(unicodeOver, "utf8") !== MAX_EVIDENCE_BYTES + 1) {
    throw new Error("多字节证据字节边界夹具不正确");
  }

  const boundDir = mkdtempSync(join(tmpdir(), "saydo-bound-write-"));
  try {
    for (const [label, maxBody, overBody] of [
      ["ascii", asciiMax, asciiOver],
      ["unicode", unicodeMax, unicodeOver]
    ]) {
      const claimMaxPath = join(boundDir, `${label}-claim-max.json`);
      const claimMaxHelper = runOpenatHelper({ op: "claim", path: claimMaxPath, body: maxBody });
      if (!claimMaxHelper.ok || !isIdentityDecimal(claimMaxHelper.dev) || !isIdentityDecimal(claimMaxHelper.ino)) {
        throw new Error(`${label} helper claim MAX 未接受:${claimMaxHelper.error ?? "ok"}:${claimMaxHelper.code ?? ""}`);
      }
      if (lstatSync(claimMaxPath).size !== MAX_EVIDENCE_BYTES) throw new Error(`${label} helper claim MAX 大小不符`);

      const claimOverPath = join(boundDir, `${label}-claim-over.json`);
      const claimOverHelper = runOpenatHelper({ op: "claim", path: claimOverPath, body: overBody });
      if (claimOverHelper.ok || claimOverHelper.error !== "部署证据租约写入失败") {
        throw new Error(`${label} helper claim MAX+1 未受控拒绝`);
      }
      if (existsSync(claimOverPath)) throw new Error(`${label} helper claim MAX+1 仍创建了路径`);

      const claimOverDefaultPath = join(boundDir, `${label}-claim-default-over.json`);
      const claimOverDefault = defaultAnchoredIo.claim(claimOverDefaultPath, overBody);
      if (claimOverDefault.ok || existsSync(claimOverDefaultPath)) {
        throw new Error(`${label} default claim MAX+1 仍成功或创建了路径`);
      }

      const persistSeed = join(boundDir, `${label}-persist.json`);
      const seedLease = acquireDeployEvidenceLease(persistSeed);
      const beforeBytes = readFileSync(persistSeed);
      const beforeStat = lstatSync(persistSeed);
      const identity = { dev: String(beforeStat.dev), ino: String(beforeStat.ino) };
      const persistOverHelper = runOpenatHelper({
        op: "persist",
        path: persistSeed,
        body: overBody,
        dev: identity.dev,
        ino: identity.ino
      });
      if (persistOverHelper.ok || persistOverHelper.error !== "部署证据写入失败") {
        throw new Error(`${label} helper persist MAX+1 未受控拒绝`);
      }
      if (!readFileSync(persistSeed).equals(beforeBytes) || lstatSync(persistSeed).size !== beforeBytes.length) {
        throw new Error(`${label} helper persist MAX+1 改写了原 inode`);
      }
      if (String(lstatSync(persistSeed).dev) !== identity.dev || String(lstatSync(persistSeed).ino) !== identity.ino) {
        throw new Error(`${label} helper persist MAX+1 改变了 identity`);
      }

      const persistOverDefault = defaultAnchoredIo.persist(persistSeed, overBody, identity);
      if (persistOverDefault.ok || !readFileSync(persistSeed).equals(beforeBytes)) {
        throw new Error(`${label} default persist MAX+1 仍成功或改写了文件`);
      }

      let customCalls = 0;
      let customError;
      try {
        replaceRegularFileInPlace(persistSeed, overBody, identity, {
          anchored: {
            persist() {
              customCalls += 1;
              return { ok: true };
            }
          }
        });
      } catch (caught) {
        customError = caught;
      }
      if (!customError || customError.message !== "部署证据写入失败") {
        throw new Error(`${label} custom persist MAX+1 错误不是写入失败常量`);
      }
      if (customCalls !== 0) throw new Error(`${label} custom persist MAX+1 仍调用了注入 persist`);
      if (!readFileSync(persistSeed).equals(beforeBytes)) throw new Error(`${label} custom persist MAX+1 改写了文件`);
      const loaded = readDeployEvidenceFile(persistSeed);
      if (loaded.evidenceFileExists !== true) throw new Error(`${label} 越界 persist 后无法 read`);
      assertLeaseHeld({ kind: "existing", path: persistSeed, dev: identity.dev, ino: identity.ino });

      const claimMaxDefaultPath = join(boundDir, `${label}-claim-default-max.json`);
      const claimMaxDefault = defaultAnchoredIo.claim(claimMaxDefaultPath, maxBody);
      if (
        !claimMaxDefault.ok ||
        !existsSync(claimMaxDefaultPath) ||
        lstatSync(claimMaxDefaultPath).size !== MAX_EVIDENCE_BYTES
      ) {
        throw new Error(
          `${label} default claim MAX 未接受:${claimMaxDefault.error ?? "ok"}:${existsSync(claimMaxDefaultPath) ? String(lstatSync(claimMaxDefaultPath).size) : "missing"}`
        );
      }

      replaceRegularFileInPlace(persistSeed, maxBody, identity);
      if (lstatSync(persistSeed).size !== MAX_EVIDENCE_BYTES) throw new Error(`${label} persist MAX 大小不符`);
      const maxRead = defaultAnchoredIo.read(persistSeed);
      if (!maxRead.ok || Buffer.byteLength(maxRead.text, "utf8") !== MAX_EVIDENCE_BYTES) {
        throw new Error(`${label} persist MAX 后 helper read 失败`);
      }
      assertLeaseHeld({ kind: "existing", path: persistSeed, dev: identity.dev, ino: identity.ino });

      const retryPath = join(boundDir, `${label}-retry.json`);
      const retryOver = defaultAnchoredIo.claim(retryPath, overBody);
      if (retryOver.ok || existsSync(retryPath)) throw new Error(`${label} 越界后路径被创建`);
      const retryOk = acquireDeployEvidenceLease(retryPath);
      if (retryOk.kind !== "fresh" || !existsSync(retryPath)) throw new Error(`${label} 越界失败后无法 retry claim`);
    }

    const coercePath = join(boundDir, "coerce.json");
    writeFileSync(coercePath, '{"schemaVersion":1,"status":"claimed"}\n');
    const coerceStat = lstatSync(coercePath);
    const coerceIdentity = { dev: String(coerceStat.dev), ino: String(coerceStat.ino) };
    const coerceBefore = readFileSync(coercePath);
    const attack = "UNIQUE_BOUND_COERCE";
    const hostileBody = {
      [Symbol.toPrimitive]() {
        throw new Error(attack);
      },
      toString() {
        throw new Error(attack);
      },
      valueOf() {
        throw new Error(attack);
      }
    };
    expectStableReject(
      "hostile persist body",
      () => replaceRegularFileInPlace(coercePath, hostileBody, coerceIdentity),
      "部署证据写入失败",
      attack,
      hostileBody
    );
    if (!readFileSync(coercePath).equals(coerceBefore)) throw new Error("hostile persist body 仍 mutation");
    const hostileClaimPath = join(boundDir, "hostile-claim.json");
    const hostileClaim = defaultAnchoredIo.claim(hostileClaimPath, hostileBody);
    if (hostileClaim.ok || existsSync(hostileClaimPath)) throw new Error("hostile claim body 仍创建路径");
  } finally {
    rmSync(boundDir, { recursive: true, force: true });
  }

  const hugeDev = String(Number.MAX_SAFE_INTEGER + 2);
  const legalClaim = viewAnchoredResult({ ok: true, dev: hugeDev, ino: "1" }, "claim");
  if (!legalClaim.ok || legalClaim.dev !== hugeDev || typeof legalClaim.dev !== "string") {
    throw new Error("合法 claim envelope 未保持大整数十进制字符串");
  }
  const legalRead = viewAnchoredResult({ ok: true, dev: "1", ino: "2", text: "{}\n" }, "read");
  if (!legalRead.ok || legalRead.text !== "{}\n") throw new Error("合法 read envelope 未通过");
  const legalPersist = viewAnchoredResult({ ok: true }, "persist");
  const legalLease = viewAnchoredResult({ ok: true }, "lease");
  if (!legalPersist.ok || !legalLease.ok) throw new Error("合法 persist/lease envelope 未通过");
  const legalFail = viewAnchoredResult({ ok: false, error: "部署证据路径非法" }, "claim");
  const legalFailCode = viewAnchoredResult({ ok: false, error: "部署证据路径非法", code: "ENOENT" }, "read");
  if (legalFail.ok || legalFail.error !== "部署证据路径非法" || legalFailCode.ok || legalFailCode.code !== "ENOENT") {
    throw new Error("合法 failure envelope 未通过");
  }

  const envelopeCases = [
    ["ok true with error", { ok: true, error: "x" }, "claim"],
    ["ok true with code", { ok: true, code: "EEXIST" }, "claim"],
    ["persist with text", { ok: true, text: "x" }, "persist"],
    ["claim missing identity", { ok: true }, "claim"],
    ["read missing identity", { ok: true }, "read"],
    ["fail with success payload", { ok: false, error: "部署证据路径非法", dev: "1", ino: "1" }, "claim"],
    ["fail missing error", { ok: false }, "persist"],
    ["ok string true", { ok: "true" }, "lease"],
    ["uncontrolled fail error", { ok: false, error: "x" }, "claim"],
    ["extra own field", { ok: true, extra: 1 }, "persist"]
  ];
  let envelopeRejects = 0;
  for (const [name, envelope, op] of envelopeCases) {
    const viewed = viewAnchoredResult(envelope, op);
    if (viewed.ok) throw new Error(`非法 envelope 被 view 放行:${name}`);
    envelopeRejects += 1;
  }
  const accessor = {};
  Object.defineProperty(accessor, "ok", {
    get() {
      throw new Error("UNIQUE_ENVELOPE_GETTER");
    },
    enumerable: true
  });
  if (viewAnchoredResult(accessor, "persist").ok) throw new Error("accessor envelope 被放行");
  envelopeRejects += 1;
  const revokedEnvelope = revokedProxy({ ok: true });
  const revokedView = viewAnchoredResult(revokedEnvelope, "persist");
  if (revokedView.ok || /revoked|Cannot perform/i.test(`${revokedView.error}\n`)) {
    throw new Error("revoked envelope 未安全拒绝");
  }
  envelopeRejects += 1;
  const throwingDesc = new Proxy(
    { ok: true },
    {
      getOwnPropertyDescriptor() {
        throw new Error("UNIQUE_ENVELOPE_DESC");
      }
    }
  );
  if (viewAnchoredResult(throwingDesc, "persist").ok) throw new Error("throwing descriptor envelope 被放行");
  envelopeRejects += 1;

  const envelopeDir = mkdtempSync(join(tmpdir(), "saydo-envelope-"));
  try {
    const claimPath = join(envelopeDir, "claim.json");
    let contradictionClaim;
    try {
      acquireDeployEvidenceLease(claimPath, {
        anchored: {
          claim() {
            return { ok: true, error: "contradiction", dev: "1", ino: "1" };
          }
        }
      });
    } catch (caught) {
      contradictionClaim = caught;
    }
    if (!contradictionClaim) throw new Error("矛盾 claim envelope 未拒绝");
    if (contradictionClaim.message.includes("contradiction") || contradictionClaim === contradictionClaim.message) {
      throw new Error("矛盾 claim envelope 泄漏攻击文本");
    }
    if (existsSync(claimPath)) throw new Error("矛盾 claim envelope 创建了路径");

    const persistPath = join(envelopeDir, "persist.json");
    writeFileSync(persistPath, '{"schemaVersion":1,"status":"claimed"}\n');
    const persistBefore = readFileSync(persistPath);
    const persistIdentity = { dev: String(lstatSync(persistPath).dev), ino: String(lstatSync(persistPath).ino) };
    let persistCalls = 0;
    let contradictionPersist;
    try {
      replaceRegularFileInPlace(persistPath, Buffer.from("after\n"), persistIdentity, {
        anchored: {
          persist() {
            persistCalls += 1;
            return { ok: true, error: "contradiction" };
          }
        }
      });
    } catch (caught) {
      contradictionPersist = caught;
    }
    if (!contradictionPersist || contradictionPersist.message !== "部署证据写入失败") {
      throw new Error("矛盾 persist envelope 未受控拒绝");
    }
    if (persistCalls !== 1) throw new Error("矛盾 persist envelope 未到达注入 persist");
    if (!readFileSync(persistPath).equals(persistBefore)) throw new Error("矛盾 persist envelope 发生 mutation");

    let persistText;
    try {
      replaceRegularFileInPlace(persistPath, Buffer.from("after\n"), persistIdentity, {
        anchored: {
          persist() {
            return { ok: true, text: "x" };
          }
        }
      });
    } catch (caught) {
      persistText = caught;
    }
    if (!persistText || persistText.message !== "部署证据写入失败") throw new Error("persist text envelope 未拒绝");
    if (!readFileSync(persistPath).equals(persistBefore)) throw new Error("persist text envelope 发生 mutation");

    const readPath = join(envelopeDir, "read.json");
    writeFileSync(readPath, '{"schemaVersion":1,"status":"claimed"}\n');
    expectStableReject(
      "contradiction read",
      () =>
        readDeployEvidenceFile(readPath, {
          anchored: {
            read() {
              return { ok: true };
            }
          }
        }),
      "既有部署证据读取失败"
    );
    expectStableReject(
      "contradiction lease",
      () =>
        assertLeaseHeld(
          { kind: "existing", path: readPath, dev: persistIdentity.dev, ino: persistIdentity.ino },
          {
            anchored: {
              lease() {
                return { ok: false, error: "x", dev: "1", ino: "1" };
              }
            }
          }
        ),
      "部署证据租约已失效"
    );
  } finally {
    rmSync(envelopeDir, { recursive: true, force: true });
  }
  if (envelopeRejects < 12) throw new Error(`envelope 反例覆盖不足:${envelopeRejects}`);

  function failureEnvelope(tuple) {
    return tuple.code == null ? { ok: false, error: tuple.error } : { ok: false, error: tuple.error, code: tuple.code };
  }
  function fixtureTupleKey(tuple) {
    return tuple.code == null ? tuple.error : `${tuple.error}\0${tuple.code}`;
  }
  const PATH_ILLEGAL = "部署证据路径非法";
  const NOT_REGULAR = "既有部署证据不是普通文件";
  const READ_FAILURE = "既有部署证据读取失败";
  const WRITE_FAILURE = "部署证据写入失败";
  const LEASE_LOST = "部署证据租约已失效";
  const CLAIM_FAILURE = "部署证据租约写入失败";
  const OVERSIZE = "既有部署证据过大";
  const REFUSE_NON_REGULAR = "拒绝覆盖非普通文件";
  const EXPECTED_FAILURE_MATRIX = {
    claim: [
      { error: PATH_ILLEGAL },
      { error: PATH_ILLEGAL, code: "OPENAT_UNSUPPORTED" },
      { error: PATH_ILLEGAL, code: "ENOENT" },
      { error: PATH_ILLEGAL, code: "EEXIST" },
      { error: NOT_REGULAR, code: "ELOOP" },
      { error: NOT_REGULAR, code: "ENOTDIR" },
      { error: READ_FAILURE },
      { error: READ_FAILURE, code: "EACCES" },
      { error: CLAIM_FAILURE }
    ],
    read: [
      { error: PATH_ILLEGAL },
      { error: PATH_ILLEGAL, code: "OPENAT_UNSUPPORTED" },
      { error: PATH_ILLEGAL, code: "ENOENT" },
      { error: NOT_REGULAR, code: "ELOOP" },
      { error: NOT_REGULAR, code: "ENOTDIR" },
      { error: NOT_REGULAR, code: "ENXIO" },
      { error: READ_FAILURE },
      { error: READ_FAILURE, code: "EACCES" },
      { error: OVERSIZE }
    ],
    persist: [
      { error: PATH_ILLEGAL },
      { error: PATH_ILLEGAL, code: "OPENAT_UNSUPPORTED" },
      { error: PATH_ILLEGAL, code: "ENOENT" },
      { error: NOT_REGULAR, code: "ELOOP" },
      { error: NOT_REGULAR, code: "EISDIR" },
      { error: NOT_REGULAR, code: "ENOTDIR" },
      { error: NOT_REGULAR, code: "ENXIO" },
      { error: READ_FAILURE },
      { error: READ_FAILURE, code: "EACCES" },
      { error: REFUSE_NON_REGULAR, code: "ELOOP" },
      { error: LEASE_LOST },
      { error: WRITE_FAILURE }
    ],
    lease: [
      { error: PATH_ILLEGAL },
      { error: PATH_ILLEGAL, code: "OPENAT_UNSUPPORTED" },
      { error: PATH_ILLEGAL, code: "ENOENT" },
      { error: NOT_REGULAR, code: "ELOOP" },
      { error: NOT_REGULAR, code: "ENOTDIR" },
      { error: NOT_REGULAR, code: "ENXIO" },
      { error: READ_FAILURE },
      { error: READ_FAILURE, code: "EACCES" },
      { error: LEASE_LOST }
    ]
  };
  const EXPECTED_ERROR_UNIVERSE = [
    PATH_ILLEGAL,
    NOT_REGULAR,
    READ_FAILURE,
    WRITE_FAILURE,
    LEASE_LOST,
    CLAIM_FAILURE,
    OVERSIZE,
    REFUSE_NON_REGULAR
  ];
  const EXPECTED_CODE_UNIVERSE = [
    "OPENAT_UNSUPPORTED",
    "ENOENT",
    "EEXIST",
    "ELOOP",
    "EISDIR",
    "ENOTDIR",
    "ENXIO",
    "EACCES",
    "EIO"
  ];
  const ops = ["claim", "read", "persist", "lease"];
  const legalCounts = { claim: 0, read: 0, persist: 0, lease: 0 };
  for (const op of ops) {
    const expected = EXPECTED_FAILURE_MATRIX[op];
    const produced = ANCHORED_FAILURE_TUPLES[op];
    const expectedKeys = new Set(expected.map(fixtureTupleKey));
    const producedKeys = new Set(produced.map(fixtureTupleKey));
    if (expectedKeys.size !== producedKeys.size || [...expectedKeys].some((key) => !producedKeys.has(key))) {
      throw new Error(`${op} 失败元组矩阵与独立 fixture 不一致`);
    }
    if (expected.some((tuple) => tuple.code === "EIO") || produced.some((tuple) => tuple.code === "EIO")) {
      throw new Error("EIO 出现在合法失败表");
    }
    for (const tuple of expected) {
      const viewed = viewAnchoredResult(failureEnvelope(tuple), op);
      if (viewed.ok || viewed.error !== tuple.error || (tuple.code == null ? viewed.code !== undefined : viewed.code !== tuple.code)) {
        throw new Error(`${op} 合法失败元组未接受`);
      }
      legalCounts[op] += 1;
    }
  }
  let crossExclusiveReject = 0;
  let crossShared = 0;
  for (const op of ops) {
    for (const tuple of EXPECTED_FAILURE_MATRIX[op]) {
      for (const other of ops) {
        if (other === op) continue;
        if (isAllowedAnchoredFailure(other, tuple.error, tuple.code)) {
          crossShared += 1;
          continue;
        }
        const viewed = viewAnchoredResult(failureEnvelope(tuple), other);
        if (viewed.ok || (viewed.error === tuple.error && viewed.code === tuple.code)) {
          throw new Error("跨 op 失败元组被放行");
        }
        crossExclusiveReject += 1;
      }
    }
  }
  let cartesianRejects = 0;
  for (const op of ops) {
    for (const error of EXPECTED_ERROR_UNIVERSE) {
      for (const code of [undefined, ...EXPECTED_CODE_UNIVERSE]) {
        if (isAllowedAnchoredFailure(op, error, code)) continue;
        const envelope = code == null ? { ok: false, error } : { ok: false, error, code };
        const viewed = viewAnchoredResult(envelope, op);
        if (viewed.ok || (viewed.error === error && viewed.code === code)) {
          throw new Error("未登记失败组合被放行");
        }
        cartesianRejects += 1;
      }
    }
  }
  if (
    legalCounts.claim !== 9 ||
    legalCounts.read !== 9 ||
    legalCounts.persist !== 12 ||
    legalCounts.lease !== 9 ||
    crossExclusiveReject !== 25 ||
    crossShared !== 92 ||
    cartesianRejects !== 281
  ) {
    throw new Error("失败元组计数不是规定矩阵");
  }

  const tupleDir = mkdtempSync(join(tmpdir(), "saydo-failure-tuple-"));
  let tupleMutations = 0;
  try {
    const absentPath = join(tupleDir, "absent.json");
    const missing = readDeployEvidenceFile(absentPath);
    if (missing.evidenceFileExists !== false) throw new Error("合法 PATH_ILLEGAL+ENOENT 未返回不存在");
    expectStableReject(
      "read lease-lost enoent",
      () =>
        readDeployEvidenceFile(absentPath, {
          anchored: {
            read() {
              return { ok: false, error: "部署证据租约已失效", code: "ENOENT" };
            }
          }
        }),
      "既有部署证据读取失败"
    );
    const injectedMissing = readDeployEvidenceFile(absentPath, {
      anchored: {
        read() {
          return { ok: false, error: "部署证据路径非法", code: "ENOENT" };
        }
      }
    });
    if (injectedMissing.evidenceFileExists !== false) throw new Error("注入 PATH_ILLEGAL+ENOENT 未返回不存在");
    if (existsSync(absentPath)) tupleMutations += 1;

    const claimPath = join(tupleDir, "claim-cross.json");
    let claimCalls = 0;
    expectStableReject(
      "claim write-failure tuple",
      () =>
        acquireDeployEvidenceLease(claimPath, {
          anchored: {
            claim() {
              claimCalls += 1;
              return { ok: false, error: "部署证据写入失败" };
            }
          }
        }),
      "部署证据路径非法"
    );
    if (claimCalls !== 1) throw new Error("claim 交叉失败元组未到达注入 claim");
    if (existsSync(claimPath)) tupleMutations += 1;

    const persistPath = join(tupleDir, "persist-cross.json");
    writeFileSync(persistPath, '{"schemaVersion":1,"status":"claimed"}\n');
    const persistBefore = readFileSync(persistPath);
    const persistIdentity = { dev: String(lstatSync(persistPath).dev), ino: String(lstatSync(persistPath).ino) };
    let persistCalls = 0;
    expectStableReject(
      "persist exist tuple",
      () =>
        replaceRegularFileInPlace(persistPath, Buffer.from("after\n"), persistIdentity, {
          anchored: {
            persist() {
              persistCalls += 1;
              return { ok: false, error: "部署证据路径非法", code: "EEXIST" };
            }
          }
        }),
      "部署证据写入失败"
    );
    if (persistCalls !== 1) throw new Error("persist 交叉失败元组未到达注入 persist");
    if (!readFileSync(persistPath).equals(persistBefore)) tupleMutations += 1;
  } finally {
    rmSync(tupleDir, { recursive: true, force: true });
  }
  if (tupleMutations !== 0) throw new Error("失败元组公共入口发生 mutation");
  console.log(
    `[ok] failure-tuples claim=${legalCounts.claim} read=${legalCounts.read} persist=${legalCounts.persist} lease=${legalCounts.lease} cross-exclusive-reject=${crossExclusiveReject} cross-shared=${crossShared} cartesian-reject=${cartesianRejects} mutations=${tupleMutations}`
  );
}

function readFdExact(fd, size, position) {
  const buf = Buffer.alloc(size);
  const got = readSync(fd, buf, 0, size, position);
  if (got !== size) throw new Error("stdin fd 读取长度不符");
  return buf;
}

function testHelperStdinSingleFd() {
  const flags = helperStdinOpenFlags();
  if (flags == null) throw new Error("stdin 打开 flags 不可用");
  if (!(flags & fsConstants.O_RDWR) || !(flags & fsConstants.O_CREAT) || !(flags & fsConstants.O_EXCL) || !(flags & fsConstants.O_NOFOLLOW)) {
    throw new Error("stdin 打开 flags 缺少 exclusive/readwrite/nofollow");
  }
  if (fsConstants.O_CLOEXEC && flags & fsConstants.O_CLOEXEC) throw new Error("stdin fd 不得带 CLOEXEC");
  if (HELPER_STDIN_OPEN_MODE !== 0o600) throw new Error("stdin mode 不是 owner-only");
  const openatSource = readFileSync(join(scripts, "release-openat.mjs"), "utf8");
  if (openatSource.includes('openSync(tmpPath, "r")') || /writeFileSync\(tmpPath[\s\S]{0,80}openSync\(tmpPath/.test(openatSource)) {
    throw new Error("helper stdin 仍按路径 reopen");
  }

  const payload = Buffer.from('{"op":"read","path":"/stdin-bind-probe"}');
  const attacker = Buffer.from("ATTACK_STDIN_REPLACEMENT\n");
  let seenFlags;
  let seenMode;
  let writeCalls = 0;
  let positioned = true;
  let spawnCalls = 0;
  let delivered;
  let sidecar;

  const replacementIo = {
    ...defaultHelperStdinIo,
    openExclusive(filePath, openFlags, mode) {
      seenFlags = openFlags;
      seenMode = mode;
      return defaultHelperStdinIo.openExclusive(filePath, openFlags, mode);
    },
    afterCreate(_fd, filePath) {
      sidecar = `${filePath}.orig`;
      renameSync(filePath, sidecar);
      writeFileSync(filePath, attacker, { flag: "wx", mode: 0o600 });
    },
    writeAt() {
      writeCalls += 1;
      throw new Error("replacement 后不应写入 payload");
    }
  };
  let replacementSpawn = 0;
  const replacementResult = runOpenatHelper(
    { op: "read", path: "/stdin-bind-probe" },
    {
      stdinIo: replacementIo,
      spawnSyncImpl() {
        replacementSpawn += 1;
        return { status: 0, stdout: '{"ok":false,"error":"部署证据路径非法"}\n' };
      }
    }
  );
  if (replacementResult.ok) throw new Error("rename/replacement 仍被接受");
  if (replacementSpawn !== 0) throw new Error("rename/replacement 后仍 spawn");
  if (!sidecar || !existsSync(sidecar)) throw new Error("sidecar 在断言前被删除");
  if (writeCalls !== 0) throw new Error("unlink 未证明原 inode 前写入了 payload");
  unlinkSync(sidecar);

  writeCalls = 0;
  const shortWriteIo = {
    ...defaultHelperStdinIo,
    openExclusive(filePath, openFlags, mode) {
      seenFlags = openFlags;
      seenMode = mode;
      return defaultHelperStdinIo.openExclusive(filePath, openFlags, mode);
    },
    writeAt(fd, bytes, offset, length, position) {
      writeCalls += 1;
      if (position !== offset) positioned = false;
      const chunk = Math.min(2, length);
      return defaultHelperStdinIo.writeAt(fd, bytes, offset, chunk, position);
    }
  };
  const bound = bindHelperStdinFd(payload, shortWriteIo);
  try {
    if (!bound.ok) throw new Error("匿名 inode 绑定失败");
    if (seenFlags !== flags || seenMode !== HELPER_STDIN_OPEN_MODE) throw new Error("stdin 打开 flags/mode 不是合同值");
    if (!positioned || writeCalls < Math.ceil(payload.length / 2)) throw new Error("stdin 未做定位短写循环");
    const st = fstatSync(bound.fd);
    if (st.nlink !== 0) throw new Error("交付 fd 的 nlink 不是 0");
    const atZero = readFdExact(bound.fd, payload.length, 0);
    const atCursor = readFdExact(bound.fd, payload.length, null);
    if (!atZero.equals(payload) || !atCursor.equals(payload)) throw new Error("匿名 fd 不是从 byte 0 读到 exact JSON");
  } finally {
    if (bound.ok) closeSync(bound.fd);
  }

  let wroteBeforeUnlink = 0;
  const unlinkFailIo = {
    ...defaultHelperStdinIo,
    unlink() {
      throw new Error("unlink");
    },
    writeAt(fd, bytes, offset, length, position) {
      wroteBeforeUnlink += 1;
      return defaultHelperStdinIo.writeAt(fd, bytes, offset, length, position);
    }
  };
  const unlinkFail = bindHelperStdinFd(payload, unlinkFailIo);
  if (unlinkFail.ok) throw new Error("unlink 失败仍交付 fd");
  if (wroteBeforeUnlink !== 0) throw new Error("unlink 失败后仍写入 payload");

  let fstatCalls = 0;
  const driftIo = {
    ...defaultHelperStdinIo,
    fstat(fd) {
      fstatCalls += 1;
      const stat = defaultHelperStdinIo.fstat(fd);
      if (fstatCalls === 3) {
        return Object.defineProperties(Object.create(Object.getPrototypeOf(stat)), {
          isFile: { value: () => true },
          isSymbolicLink: { value: () => false },
          nlink: { value: 0 },
          mode: { value: stat.mode },
          uid: { value: stat.uid },
          size: { value: stat.size },
          dev: { value: stat.dev },
          ino: { value: typeof stat.ino === "bigint" ? stat.ino + 1n : stat.ino + 1 }
        });
      }
      return stat;
    }
  };
  const drift = bindHelperStdinFd(payload, driftIo);
  if (drift.ok) throw new Error("identity 漂移仍交付 fd");

  const nlinkIo = {
    ...defaultHelperStdinIo,
    fstat(fd) {
      const stat = defaultHelperStdinIo.fstat(fd);
      if (stat.nlink === 0) {
        return Object.defineProperties(Object.create(Object.getPrototypeOf(stat)), {
          isFile: { value: () => true },
          isSymbolicLink: { value: () => false },
          nlink: { value: 1 },
          mode: { value: stat.mode },
          uid: { value: stat.uid },
          size: { value: stat.size },
          dev: { value: stat.dev },
          ino: { value: stat.ino }
        });
      }
      return stat;
    }
  };
  const nlink = bindHelperStdinFd(payload, nlinkIo);
  if (nlink.ok) throw new Error("nlink!=0 仍交付匿名 fd");

  const json = '{"op":"read","path":"/stdin-bind-probe"}';
  const result = runOpenatHelper(
    { op: "read", path: "/stdin-bind-probe" },
    {
      stdinIo: {
        ...defaultHelperStdinIo,
        afterWrite(fd) {
          const st = fstatSync(fd);
          if (st.nlink !== 0) throw new Error("写后 nlink 不是 0");
          delivered = { zero: readFdExact(fd, Buffer.byteLength(json), 0) };
        }
      },
      spawnSyncImpl(_cmd, _args, spawnOpts) {
        spawnCalls += 1;
        const fd = spawnOpts.stdio[0];
        if (typeof fd !== "number") throw new Error("spawn 未接收创建时 fd");
        const st = fstatSync(fd);
        if (st.nlink !== 0) throw new Error("spawn 时 nlink 不是 0");
        const fromSpawn = readFdExact(fd, Buffer.byteLength(json), 0);
        delivered = { ...delivered, fromSpawn, fd };
        return { status: 0, signal: null, error: undefined, stdout: '{"ok":false,"error":"部署证据路径非法"}\n', stderr: "" };
      }
    }
  );
  if (spawnCalls !== 1) throw new Error("spawn 未使用已绑定 fd");
  if (!delivered?.fromSpawn?.equals(delivered.zero)) throw new Error("spawn 收到的 fd 不是创建时对象");
  if (result.ok || result.error !== "部署证据路径非法") throw new Error("注入 spawn 结果未按信封解析");

  let spawnAfterUnlinkFail = 0;
  runOpenatHelper(
    { op: "read", path: "/stdin-bind-probe" },
    {
      stdinIo: {
        ...defaultHelperStdinIo,
        unlink() {
          throw new Error("unlink");
        }
      },
      spawnSyncImpl() {
        spawnAfterUnlinkFail += 1;
        return { status: 0, stdout: '{"ok":false,"error":"部署证据路径非法"}\n' };
      }
    }
  );
  if (spawnAfterUnlinkFail !== 0) throw new Error("unlink 失败后仍 spawn");

  function closeThrowIo() {
    let closes = 0;
    return {
      io: {
        ...defaultHelperStdinIo,
        close(fd) {
          closes += 1;
          closeSync(fd);
          throw new Error("UNIQUE_CLOSE_FAIL");
        }
      },
      closes: () => closes
    };
  }
  function successSpawn(stdout) {
    return () => ({ status: 0, signal: null, error: undefined, stdout, stderr: "" });
  }
  const closeClaim = closeThrowIo();
  const closedClaim = runOpenatHelper(
    { op: "claim", path: "/stdin-bind-probe", body: "{}" },
    {
      stdinIo: closeClaim.io,
      spawnSyncImpl: successSpawn('{"ok":true,"dev":"1","ino":"1"}\n')
    }
  );
  if (closeClaim.closes() !== 1) throw new Error("claim close 不是恰好一次");
  if (closedClaim.ok || closedClaim.error !== "部署证据路径非法") throw new Error("claim close 失败仍接受 helper 成功");
  if (`${closedClaim.error}\n${closedClaim.stack ?? ""}`.includes("UNIQUE_CLOSE_FAIL")) throw new Error("close 错误文本逸出");

  const closeDir = mkdtempSync(join(tmpdir(), "saydo-close-fail-"));
  try {
    const evidencePath = join(closeDir, "evidence.json");
    writeFileSync(evidencePath, '{"schemaVersion":1,"status":"claimed"}\n');
    const before = readFileSync(evidencePath);
    const identity = { dev: String(lstatSync(evidencePath).dev), ino: String(lstatSync(evidencePath).ino) };
    const claimClose = closeThrowIo();
    const readClose = closeThrowIo();
    const persistClose = closeThrowIo();
    const leaseClose = closeThrowIo();
    const ops = [
      [
        "claim",
        "部署证据路径非法",
        claimClose,
        () =>
          acquireDeployEvidenceLease(join(closeDir, "claim.json"), {
            anchored: {
              claim(target, body) {
                return runOpenatHelper(
                  { op: "claim", path: target, body },
                  { stdinIo: claimClose.io, spawnSyncImpl: successSpawn('{"ok":true,"dev":"1","ino":"1"}\n') }
                );
              }
            }
          })
      ],
      [
        "read",
        "既有部署证据读取失败",
        readClose,
        () =>
          readDeployEvidenceFile(evidencePath, {
            anchored: {
              read(target) {
                return runOpenatHelper(
                  { op: "read", path: target },
                  {
                    stdinIo: readClose.io,
                    spawnSyncImpl: successSpawn('{"ok":true,"dev":"1","ino":"1","text":"{\\"schemaVersion\\":1}"}\n')
                  }
                );
              }
            }
          })
      ],
      [
        "persist",
        "部署证据写入失败",
        persistClose,
        () =>
          replaceRegularFileInPlace(evidencePath, Buffer.from("after\n"), identity, {
            anchored: {
              persist(target, body, lease) {
                return runOpenatHelper(
                  { op: "persist", path: target, body: Buffer.from(body).toString("utf8"), dev: lease.dev, ino: lease.ino },
                  { stdinIo: persistClose.io, spawnSyncImpl: successSpawn('{"ok":true}\n') }
                );
              }
            }
          })
      ],
      [
        "lease",
        "部署证据租约已失效",
        leaseClose,
        () =>
          assertLeaseHeld(
            { kind: "existing", path: evidencePath, dev: identity.dev, ino: identity.ino },
            {
              anchored: {
                lease(target, lease) {
                  return runOpenatHelper(
                    { op: "lease", path: target, dev: lease.dev, ino: lease.ino },
                    { stdinIo: leaseClose.io, spawnSyncImpl: successSpawn('{"ok":true}\n') }
                  );
                }
              }
            }
          )
      ]
    ];
    for (const [name, expected, closeIo, fn] of ops) {
      let thrown;
      try {
        fn();
      } catch (caught) {
        thrown = caught;
      }
      if (!thrown) throw new Error(`${name} close 失败未拒绝`);
      if (thrown.message !== expected) throw new Error(`${name} close 错误不是常量:${thrown.message}`);
      if (closeIo.closes() !== 1) throw new Error(`${name} close 不是恰好一次`);
      if (`${thrown.message}\n${thrown.stack ?? ""}`.includes("UNIQUE_CLOSE_FAIL")) throw new Error(`${name} close 文本逸出`);
    }
    if (!readFileSync(evidencePath).equals(before)) throw new Error("close 失败路径发生 mutation");
    if (existsSync(join(closeDir, "claim.json"))) throw new Error("close 失败 claim 创建了文件");
  } finally {
    rmSync(closeDir, { recursive: true, force: true });
  }

  const spawnThrowSentinel = "UNIQUE_SPAWN_FAIL";
  let spawnThrowCloses = 0;
  const spawnThrowResult = runOpenatHelper(
    { op: "read", path: "/stdin-bind-probe" },
    {
      stdinIo: {
        ...defaultHelperStdinIo,
        close(fd) {
          spawnThrowCloses += 1;
          closeSync(fd);
        }
      },
      spawnSyncImpl() {
        throw new Error(spawnThrowSentinel);
      }
    }
  );
  if (spawnThrowResult.ok !== false) throw new Error("spawn 抛错仍接受 helper 成功");
  if (spawnThrowResult.error !== "部署证据路径非法") throw new Error(`spawn 抛错错误不是常量:${spawnThrowResult.error}`);
  if (spawnThrowCloses !== 1) throw new Error("spawn 抛错时 close 不是恰好一次");
  if (`${spawnThrowResult.message}\n${spawnThrowResult.stack ?? ""}`.includes(spawnThrowSentinel)) {
    throw new Error("spawn 错误文本逸出");
  }
}

function testPublishSnapshotGuard() {
  const source = readFileSync(join(scripts, "publish-public-snapshot.sh"), "utf8");
  const atomicIndex = source.indexOf('git push --atomic "$PUBLIC_REMOTE"');
  if (atomicIndex < 0) throw new Error("publish-public-snapshot.sh 缺 atomic push");
  const prefix = source.slice(0, atomicIndex);
  if (!prefix.includes("uniqueness --require-zero") || !prefix.includes("release-tag-guard.mjs ruleset")) {
    throw new Error("atomic push 前未调用零次 run 与 ruleset 预检");
  }
  const privacyIndex = source.indexOf("scripts/check-public-tree-privacy.mjs --ref");
  const treeIndex = source.indexOf("GIT_INDEX_FILE=\"$tmpindex\" git write-tree");
  if (privacyIndex < 0 || treeIndex < 0 || privacyIndex > treeIndex) {
    throw new Error("publish-public-snapshot.sh 未在生成公开树之前调用隐私硬门");
  }
  if (!source.includes('--ref "$EXPECTED_INTERNAL_SHA"') || !source.includes("--require-private-probes")) {
    throw new Error("隐私硬门未传入 expected internal SHA 或未要求私有探针");
  }
  const usage = spawnSync(process.execPath, [join(scripts, "release-tag-guard.mjs")], { encoding: "utf8" });
  if (usage.status !== 2) throw new Error(`release-tag-guard 无参退出码:${usage.status}`);
}

await testAssetManifest();
await testUniqueness();
testRuleset();
await testAvailabilityRollback();
await testAvailabilitySnapshotRace();
await testSnapshotSafety();
await testDeployStateMachine();
await testCloudflareBinding();
await testCloudflareRestClient();
testWorkflowWiring();
testWeekAuditAtomicWriter();
testPhysicalClosureAndWindowsProbe();
testPublishSnapshotGuard();
testHelperStdinSingleFd();
await testFinalIndependentReviewRegressions();
console.log("[ok] release provenance and state self-test");
