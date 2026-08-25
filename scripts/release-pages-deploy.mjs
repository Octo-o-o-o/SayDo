#!/usr/bin/env node

import { CLOUDFLARE_PAGES_PROJECTS } from "./release-cloudflare-pages.mjs";
import { defaultFsIo, replaceRegularFileInPlace } from "./release-file-transaction.mjs";
import { isIdentityDecimal, openatSupported, resolveAnchoredIo, viewAnchoredResult } from "./release-openat.mjs";

const RESERVED_EVIDENCE_KEYS = [
  "schemaVersion",
  "schema",
  "status",
  "sites",
  "completedSites",
  "failedStage",
  "error",
  "productionChecks"
];

export const PAGES_CANONICAL_HOSTS = Object.freeze({
  saydo: "saydo-3xb.pages.dev",
  "saydo-link": "saydo-link.pages.dev"
});

export const PAGES_OFFICIAL_HOSTS = Object.freeze({
  saydo: Object.freeze(["saydo.octoooo.com"]),
  "saydo-link": Object.freeze(["link.saydo.octoooo.com"])
});

// 当前真实 Pages 生产项目只读枚举：18/18 个 deployment id 均为 36 字符小写 UUID v4。
// 合同仅接受该形状；未来 Cloudflare 改合同必须显式升级 schema 与测试。
export const PAGES_DEPLOYMENT_ID_MAX_LENGTH = 36;
export const PAGES_DEPLOYMENT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const RECOVERABLE_STATUSES = new Set(["audit_pending", "audit_failed"]);
const DURABLE_STATUSES = new Set(["claimed", "started", "partial_failed", "audit_pending", "audit_failed", "completed"]);
const CLAIM_MARKER = '{"schemaVersion":1,"status":"claimed"}\n';
const SAFE_FAILURE = "部署失败";
const EVIDENCE_READ_FAILURE = "既有部署证据读取失败";
const EVIDENCE_NOT_REGULAR = "既有部署证据不是普通文件";
const EVIDENCE_ILLEGAL = "既有部署证据非法";
const DEPLOYMENT_ID_ILLEGAL = "deployment id 非法";
const DEPLOYMENT_READBACK_ILLEGAL = "deployment readback 非法";
const PROJECT_READBACK_ILLEGAL = "project readback 非法";
const PROJECT_DOMAIN_ILLEGAL = "project domain 非法";
const PROJECT_DOMAINS_ILLEGAL = "project domains 非法";
const CANONICAL_HOST_ILLEGAL = "canonical pages.dev host 非法";
const LEASE_REQUIRED = "缺少部署证据租约";
const LEASE_LOST = "部署证据租约已失效";
const EVIDENCE_SERIALIZE_FAILURE = "部署证据序列化失败";
const EVIDENCE_SECRET = "部署证据含不可信字段";
const HTTP_READBACK_FAILURE = "HTTP 回读失败";
const WRANGLER_URL_MISSING = "Wrangler 输出未包含 canonical host 的 hash URL";
const WRANGLER_URL_AMBIGUOUS = "Wrangler 输出含多个 canonical host hash URL";
const PAGES_URL_ILLEGAL = "Pages URL hostname 非法";
const MAX_PROJECT_DOMAINS = 32;

function invariant(value, message) {
  if (!value) throw trustedError(message);
}

const ownedRecords = new WeakMap();

function trustedError(message, meta = {}) {
  const rec = Object.freeze({
    message,
    persistFailed: meta.persistFailed === true,
    stage: typeof meta.stage === "string" ? meta.stage : null,
    lastDurableStatus: Object.prototype.hasOwnProperty.call(meta, "lastDurableStatus") ? meta.lastDurableStatus : null,
    emergencyPersisted: meta.emergencyPersisted === true ? true : meta.emergencyPersisted === false ? false : null
  });
  const err = Array.isArray(meta.aggregateErrors) ? new AggregateError(meta.aggregateErrors, message) : new Error(message);
  ownedRecords.set(err, rec);
  try {
    Object.defineProperty(err, "message", { value: message, writable: false, configurable: false, enumerable: false });
    Object.defineProperty(err, "persistFailed", { value: rec.persistFailed, writable: false, configurable: false, enumerable: true });
    Object.defineProperty(err, "stage", { value: rec.stage, writable: false, configurable: false, enumerable: true });
    Object.defineProperty(err, "lastDurableStatus", { value: rec.lastDurableStatus, writable: false, configurable: false, enumerable: true });
    if (rec.emergencyPersisted !== null) {
      Object.defineProperty(err, "emergencyPersisted", { value: rec.emergencyPersisted, writable: false, configurable: false, enumerable: true });
    }
  } catch {
    // best-effort immutability
  }
  return err;
}

function ownedRecord(value) {
  try {
    if (value === null || value === undefined) return undefined;
    const kind = typeof value;
    if (kind !== "object" && kind !== "function") return undefined;
    return ownedRecords.get(value);
  } catch {
    return undefined;
  }
}

function throwOwnedOrConstant(caught, fallback) {
  const rec = ownedRecord(caught);
  throw trustedError(rec?.message && rec.message.length > 0 ? rec.message : fallback);
}

function isArraySafe(value) {
  try {
    return Array.isArray(value);
  } catch {
    return false;
  }
}

export function sanitizeDeployError(error) {
  const rec = ownedRecord(error);
  if (!rec || typeof rec.message !== "string" || rec.message.length === 0) return SAFE_FAILURE;
  if (containsSentinel(rec.message)) return SAFE_FAILURE;
  return rec.message
    .replace(/\/Users\/[^\s]+/g, "[path]")
    .replace(/[A-Za-z]:\\[^\s]+/g, "[path]")
    .slice(0, 300);
}

function containsSentinel(text) {
  if (typeof text !== "string" || text.length === 0) return false;
  return (
    /Bearer/i.test(text) ||
    /ghp_[A-Za-z0-9]+/.test(text) ||
    /github_pat_[A-Za-z0-9_]+/.test(text) ||
    /CLOUDFLARE_API_TOKEN[=:]/i.test(text)
  );
}

export function isSafePagesDeploymentId(value) {
  return typeof value === "string" && value.length === PAGES_DEPLOYMENT_ID_MAX_LENGTH && PAGES_DEPLOYMENT_ID_PATTERN.test(value);
}

function isSafeHostname(value) {
  if (typeof value !== "string" || value.length < 1 || value.length > 253) return false;
  if (containsSentinel(value)) return false;
  if (/[\s\u0000-\u001f\u007f/:?#@\\]/.test(value)) return false;
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))+$/i.test(value);
}

function isCanonicalPagesDevHost(value) {
  return typeof value === "string" && /^[a-z0-9-]+\.pages\.dev$/.test(value);
}

function assertNoSecretText(text) {
  if (containsSentinel(text)) throw trustedError(EVIDENCE_SECRET);
}

function readOwnData(object, key, error = EVIDENCE_ILLEGAL) {
  try {
    if (object === null || object === undefined) return { missing: true };
    if (typeof object !== "object" && typeof object !== "function") return { missing: true };
    let desc;
    try {
      desc = Object.getOwnPropertyDescriptor(object, key);
    } catch {
      throw trustedError(error);
    }
    if (!desc) return { missing: true };
    if (typeof desc.get === "function" || typeof desc.set === "function") throw trustedError(error);
    if (!Object.prototype.hasOwnProperty.call(desc, "value")) throw trustedError(error);
    return { missing: false, value: desc.value };
  } catch (caught) {
    throwOwnedOrConstant(caught, error);
  }
}

function requireOwnData(object, key, error = EVIDENCE_ILLEGAL) {
  const got = readOwnData(object, key, error);
  if (got.missing) throw trustedError(error);
  return got.value;
}

function ownArrayItems(arr, maxLen, error = EVIDENCE_ILLEGAL) {
  try {
    if (!isArraySafe(arr)) throw trustedError(error);
  } catch (caught) {
    throwOwnedOrConstant(caught, error);
  }
  const lengthGot = readOwnData(arr, "length", error);
  if (
    lengthGot.missing ||
    typeof lengthGot.value !== "number" ||
    !Number.isInteger(lengthGot.value) ||
    lengthGot.value < 0 ||
    lengthGot.value > maxLen
  ) {
    throw trustedError(error);
  }
  const items = [];
  for (let index = 0; index < lengthGot.value; index += 1) {
    const item = readOwnData(arr, String(index), error);
    if (item.missing) throw trustedError(error);
    items.push(item.value);
  }
  return items;
}

function readOwnArray(object, key, maxLen, error = EVIDENCE_ILLEGAL) {
  const got = readOwnData(object, key, error);
  if (got.missing) return { missing: true };
  return { missing: false, value: ownArrayItems(got.value, maxLen, error) };
}

function requireOwnArray(object, key, maxLen, error = EVIDENCE_ILLEGAL) {
  const got = readOwnArray(object, key, maxLen, error);
  if (got.missing) throw trustedError(error);
  return got.value;
}

function assertRecordObject(value, error = EVIDENCE_ILLEGAL) {
  try {
    if (value === null || typeof value !== "object" || isArraySafe(value)) throw trustedError(error);
    Object.getOwnPropertyDescriptor(value, "__saydo_probe__");
  } catch (caught) {
    throwOwnedOrConstant(caught, error);
  }
}

function boundedString(value, max) {
  return typeof value === "string" && value.length > 0 && value.length <= max && !containsSentinel(value);
}

function isoTimestamp(value) {
  if (typeof value !== "string" || value.length < 20 || value.length > 40) return false;
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed);
}

function positiveInt(value, max) {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= max;
}

function nonNegativeInt(value, max) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= max;
}

function sha1(value) {
  return typeof value === "string" && /^[0-9a-f]{40}$/.test(value);
}

function sha256Hex(value) {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function httpsUrl(value, max = 512) {
  if (!boundedString(value, max) || !value.startsWith("https://")) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function optionalOwn(object, key) {
  return readOwnData(object, key);
}

function projectRelease(raw) {
  assertRecordObject(raw);
  const tag = requireOwnData(raw, "tag");
  if (!boundedString(tag, 64) || !/^v[0-9]/.test(tag)) throw trustedError(EVIDENCE_ILLEGAL);
  const out = { tag };
  const tagSha = optionalOwn(raw, "tagSha");
  if (!tagSha.missing) {
    if (!sha1(tagSha.value)) throw trustedError(EVIDENCE_ILLEGAL);
    out.tagSha = tagSha.value;
  }
  const releaseUrl = optionalOwn(raw, "releaseUrl");
  if (!releaseUrl.missing) {
    if (!httpsUrl(releaseUrl.value)) throw trustedError(EVIDENCE_ILLEGAL);
    out.releaseUrl = releaseUrl.value;
  }
  const publishedAt = optionalOwn(raw, "publishedAt");
  if (!publishedAt.missing) {
    if (!isoTimestamp(publishedAt.value)) throw trustedError(EVIDENCE_ILLEGAL);
    out.publishedAt = publishedAt.value;
  }
  const workflowRunId = optionalOwn(raw, "workflowRunId");
  if (!workflowRunId.missing) {
    if (!positiveInt(workflowRunId.value, Number.MAX_SAFE_INTEGER)) throw trustedError(EVIDENCE_ILLEGAL);
    out.workflowRunId = workflowRunId.value;
  }
  const workflowRunAttempt = optionalOwn(raw, "workflowRunAttempt");
  if (!workflowRunAttempt.missing) {
    if (workflowRunAttempt.value !== 1) throw trustedError(EVIDENCE_ILLEGAL);
    out.workflowRunAttempt = 1;
  }
  const workflowUrl = optionalOwn(raw, "workflowUrl");
  if (!workflowUrl.missing) {
    if (!httpsUrl(workflowUrl.value)) throw trustedError(EVIDENCE_ILLEGAL);
    out.workflowUrl = workflowUrl.value;
  }
  const requiredJobs = readOwnArray(raw, "requiredJobs", 64);
  if (!requiredJobs.missing) {
    if (requiredJobs.value.length === 0) throw trustedError(EVIDENCE_ILLEGAL);
    out.requiredJobs = requiredJobs.value.map((name) => {
      if (!boundedString(name, 200)) throw trustedError(EVIDENCE_ILLEGAL);
      return name;
    });
  }
  const assets = readOwnArray(raw, "assets", 16);
  if (!assets.missing) {
    if (assets.value.length === 0) throw trustedError(EVIDENCE_ILLEGAL);
    out.assets = assets.value.map((asset) => {
      assertRecordObject(asset);
      const name = requireOwnData(asset, "name");
      const size = requireOwnData(asset, "size");
      if (!boundedString(name, 200) || !nonNegativeInt(size, 1_000_000_000)) throw trustedError(EVIDENCE_ILLEGAL);
      return { name, size };
    });
  }
  const tarballSha256 = optionalOwn(raw, "tarballSha256");
  if (!tarballSha256.missing) {
    if (!sha256Hex(tarballSha256.value)) throw trustedError(EVIDENCE_ILLEGAL);
    out.tarballSha256 = tarballSha256.value;
  }
  const sourceRevision = optionalOwn(raw, "sourceRevision");
  if (!sourceRevision.missing) {
    if (!sha256Hex(sourceRevision.value) && !sha1(sourceRevision.value)) throw trustedError(EVIDENCE_ILLEGAL);
    out.sourceRevision = sourceRevision.value;
  }
  const buildId = optionalOwn(raw, "buildId");
  if (!buildId.missing) {
    if (!boundedString(buildId.value, 128)) throw trustedError(EVIDENCE_ILLEGAL);
    out.buildId = buildId.value;
  }
  const protocolVersion = optionalOwn(raw, "protocolVersion");
  if (!protocolVersion.missing) {
    if (!boundedString(protocolVersion.value, 32)) throw trustedError(EVIDENCE_ILLEGAL);
    out.protocolVersion = protocolVersion.value;
  }
  return out;
}

function projectPublicCi(raw) {
  assertRecordObject(raw);
  const workflowRunId = requireOwnData(raw, "workflowRunId");
  if (!positiveInt(workflowRunId, Number.MAX_SAFE_INTEGER)) throw trustedError(EVIDENCE_ILLEGAL);
  const out = { workflowRunId };
  const workflowUrl = optionalOwn(raw, "workflowUrl");
  if (!workflowUrl.missing) {
    if (!httpsUrl(workflowUrl.value)) throw trustedError(EVIDENCE_ILLEGAL);
    out.workflowUrl = workflowUrl.value;
  }
  const headSha = optionalOwn(raw, "headSha");
  if (!headSha.missing) {
    if (!sha1(headSha.value)) throw trustedError(EVIDENCE_ILLEGAL);
    out.headSha = headSha.value;
  }
  const nodeJob = optionalOwn(raw, "nodeJob");
  if (!nodeJob.missing) {
    if (!boundedString(nodeJob.value, 64)) throw trustedError(EVIDENCE_ILLEGAL);
    out.nodeJob = nodeJob.value;
  }
  return out;
}

function projectDeploymentIdentity(raw) {
  assertRecordObject(raw);
  const id = requireOwnData(raw, "id");
  if (!isSafePagesDeploymentId(id)) throw trustedError(DEPLOYMENT_ID_ILLEGAL);
  const projectName = requireOwnData(raw, "project_name");
  if (!CLOUDFLARE_PAGES_PROJECTS.includes(projectName)) throw trustedError(EVIDENCE_ILLEGAL);
  const environment = requireOwnData(raw, "environment");
  if (environment !== "preview" && environment !== "production") throw trustedError(EVIDENCE_ILLEGAL);
  const url = assertSafePagesUrl(requireOwnData(raw, "url"), canonicalPagesDevHost(projectName));
  const branch = requireOwnData(raw, "branch");
  if (!boundedString(branch, 128)) throw trustedError(EVIDENCE_ILLEGAL);
  const commitHash = requireOwnData(raw, "commit_hash");
  if (!sha1(commitHash)) throw trustedError(EVIDENCE_ILLEGAL);
  if (requireOwnData(raw, "commit_dirty") !== false) throw trustedError(EVIDENCE_ILLEGAL);
  if (requireOwnData(raw, "latest_stage_status") !== "success") throw trustedError(EVIDENCE_ILLEGAL);
  return {
    id,
    project_name: projectName,
    environment,
    url,
    branch,
    commit_hash: commitHash,
    commit_dirty: false,
    latest_stage_status: "success"
  };
}

function projectStage(raw, allowed) {
  assertRecordObject(raw);
  const status = requireOwnData(raw, "status");
  if (!allowed.includes(status)) throw trustedError(EVIDENCE_ILLEGAL);
  const out = { status };
  if (status === "planned" || status === "deploying") return out;
  const url = requireOwnData(raw, "url");
  if (!httpsUrl(url, 256)) throw trustedError(EVIDENCE_ILLEGAL);
  const httpStatus = requireOwnData(raw, "httpStatus");
  if (!positiveInt(httpStatus, 599) || httpStatus < 200) throw trustedError(EVIDENCE_ILLEGAL);
  out.url = url;
  out.httpStatus = httpStatus;
  out.deployment = projectDeploymentIdentity(requireOwnData(raw, "deployment"));
  return out;
}

function projectSite(raw) {
  assertRecordObject(raw);
  const project = requireOwnData(raw, "project");
  if (!CLOUDFLARE_PAGES_PROJECTS.includes(project)) throw trustedError(EVIDENCE_ILLEGAL);
  const directory = requireOwnData(raw, "directory");
  if (!boundedString(directory, 256) || directory.includes("..")) throw trustedError(EVIDENCE_ILLEGAL);
  const planned = requireOwnData(raw, "planned");
  assertRecordObject(planned);
  const previewBranch = requireOwnData(planned, "previewBranch");
  if (!boundedString(previewBranch, 128) || previewBranch === "main") throw trustedError(EVIDENCE_ILLEGAL);
  if (requireOwnData(planned, "productionBranch") !== "main") throw trustedError(EVIDENCE_ILLEGAL);
  const canonicalHost = canonicalPagesDevHost(project);
  if (requireOwnData(planned, "canonicalHost") !== canonicalHost) throw trustedError(CANONICAL_HOST_ILLEGAL);
  return {
    project,
    directory,
    planned: {
      previewBranch,
      productionBranch: "main",
      canonicalHost
    },
    preview: projectStage(requireOwnData(raw, "preview"), ["planned", "deploying", "verified"]),
    production: projectStage(requireOwnData(raw, "production"), ["planned", "deploying", "deployed"])
  };
}

function projectProductionCheck(raw) {
  assertRecordObject(raw);
  const url = requireOwnData(raw, "url");
  const httpStatus = requireOwnData(raw, "httpStatus");
  const bytes = requireOwnData(raw, "bytes");
  const marker = requireOwnData(raw, "marker");
  const project = requireOwnData(raw, "project");
  if (!httpsUrl(url, 256)) throw trustedError(EVIDENCE_ILLEGAL);
  if (!positiveInt(httpStatus, 599) || httpStatus < 200) throw trustedError(EVIDENCE_ILLEGAL);
  if (!nonNegativeInt(bytes, 50_000_000)) throw trustedError(EVIDENCE_ILLEGAL);
  if (!boundedString(marker, 300)) throw trustedError(EVIDENCE_ILLEGAL);
  if (!CLOUDFLARE_PAGES_PROJECTS.includes(project)) throw trustedError(EVIDENCE_ILLEGAL);
  return { url, httpStatus, bytes, marker, project };
}

function projectProductionProject(raw) {
  assertRecordObject(raw);
  const name = requireOwnData(raw, "name");
  if (!CLOUDFLARE_PAGES_PROJECTS.includes(name)) throw trustedError(EVIDENCE_ILLEGAL);
  const canonicalDeploymentId = requireOwnData(raw, "canonical_deployment_id");
  if (!isSafePagesDeploymentId(canonicalDeploymentId)) throw trustedError(DEPLOYMENT_ID_ILLEGAL);
  const domains = requireOwnArray(raw, "domains", MAX_PROJECT_DOMAINS, PROJECT_DOMAINS_ILLEGAL);
  if (domains.length === 0) throw trustedError(PROJECT_DOMAINS_ILLEGAL);
  const normalized = domains.map((host) => {
    if (!isSafeHostname(host)) throw trustedError(PROJECT_DOMAIN_ILLEGAL);
    return host.toLowerCase();
  });
  const expected = trustedExpectedHosts({
    officialHosts: PAGES_OFFICIAL_HOSTS[name],
    canonicalHost: canonicalPagesDevHost(name)
  });
  sameSet(normalized, expected, "project domains");
  return {
    name,
    canonical_deployment_id: canonicalDeploymentId,
    domains: expected
  };
}

function projectError(raw) {
  if (raw == null) return null;
  assertRecordObject(raw);
  const messageValue = requireOwnData(raw, "message");
  const message = typeof messageValue === "string" && containsSentinel(messageValue) ? SAFE_FAILURE : messageValue;
  if (!boundedString(message, 300)) throw trustedError(EVIDENCE_ILLEGAL);
  const out = { message };
  const externalOutcome = optionalOwn(raw, "externalOutcome");
  if (!externalOutcome.missing) {
    if (externalOutcome.value !== "maybe_applied") throw trustedError(EVIDENCE_ILLEGAL);
    out.externalOutcome = "maybe_applied";
  }
  return out;
}

export function projectDurableEvidence(evidence) {
  assertRecordObject(evidence);
  if (requireOwnData(evidence, "schemaVersion") !== 1) throw trustedError(EVIDENCE_ILLEGAL);
  const status = requireOwnData(evidence, "status");
  if (!DURABLE_STATUSES.has(status)) throw trustedError(EVIDENCE_ILLEGAL);
  const sites = requireOwnArray(evidence, "sites", 2).map((site) => projectSite(site));
  if (sites.length !== 2 || sites[0].project === sites[1].project) throw trustedError(EVIDENCE_ILLEGAL);
  const completedSites = requireOwnArray(evidence, "completedSites", 2).map((project) => {
    if (!CLOUDFLARE_PAGES_PROJECTS.includes(project)) throw trustedError(EVIDENCE_ILLEGAL);
    return project;
  });
  const failedStageGot = optionalOwn(evidence, "failedStage");
  const failedStage = failedStageGot.missing ? null : failedStageGot.value;
  if (failedStage != null && !boundedString(failedStage, 64)) throw trustedError(EVIDENCE_ILLEGAL);
  const publicMain = requireOwnData(evidence, "publicMain");
  if (!sha1(publicMain)) throw trustedError(EVIDENCE_ILLEGAL);
  const errorGot = optionalOwn(evidence, "error");
  const out = {
    schemaVersion: 1,
    status,
    release: projectRelease(requireOwnData(evidence, "release")),
    publicMain,
    publicCi: projectPublicCi(requireOwnData(evidence, "publicCi")),
    sites,
    completedSites,
    failedStage: failedStage ?? null,
    error: projectError(errorGot.missing ? null : errorGot.value)
  };
  const verifiedAt = optionalOwn(evidence, "verifiedAt");
  if (!verifiedAt.missing) {
    if (!isoTimestamp(verifiedAt.value)) throw trustedError(EVIDENCE_ILLEGAL);
    out.verifiedAt = verifiedAt.value;
  }
  const productionChecks = readOwnArray(evidence, "productionChecks", 16);
  if (!productionChecks.missing) {
    if (productionChecks.value.length === 0) throw trustedError(EVIDENCE_ILLEGAL);
    out.productionChecks = productionChecks.value.map((item) => projectProductionCheck(item));
  }
  const productionProjects = readOwnArray(evidence, "productionProjects", 2);
  if (!productionProjects.missing) {
    if (productionProjects.value.length !== 2) throw trustedError(EVIDENCE_ILLEGAL);
    out.productionProjects = productionProjects.value.map((item) => projectProductionProject(item));
  }
  return out;
}

function freezeEvidence(evidence) {
  const snapshot = projectDurableEvidence(evidence);
  let text;
  try {
    text = `${JSON.stringify(snapshot)}\n`;
  } catch {
    throw trustedError(EVIDENCE_SERIALIZE_FAILURE);
  }
  assertNoSecretText(text);
  return { snapshot, text };
}

export function parseWranglerDeploymentUrl(output, canonicalHost) {
  try {
    if (typeof canonicalHost !== "string" || !isCanonicalPagesDevHost(canonicalHost)) {
      throw trustedError(CANONICAL_HOST_ILLEGAL);
    }
    if (typeof output !== "string") {
      throw trustedError(WRANGLER_URL_MISSING);
    }
    const text = output;
    const escaped = canonicalHost.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matches = [...text.matchAll(new RegExp(`https://([0-9a-f]+)\\.${escaped}(?![A-Za-z0-9.-])`, "gi"))];
    if (matches.length < 1) throw trustedError(WRANGLER_URL_MISSING);
    const urls = [...new Set(matches.map((item) => `https://${item[1].toLowerCase()}.${canonicalHost}`))];
    if (urls.length !== 1) throw trustedError(WRANGLER_URL_AMBIGUOUS);
    const url = urls[0];
    if (new URL(url).hostname !== `${urls[0].slice("https://".length)}`) throw trustedError(PAGES_URL_ILLEGAL);
    return url;
  } catch (caught) {
    throwOwnedOrConstant(caught, WRANGLER_URL_MISSING);
  }
}

export function canonicalPagesDevHost(projectName) {
  const host = PAGES_CANONICAL_HOSTS[projectName];
  invariant(isCanonicalPagesDevHost(host), "project 缺唯一 canonical pages.dev host");
  return host;
}

function wrapError(error, extra = {}) {
  const rec = ownedRecord(error);
  if (rec && typeof rec.message === "string" && rec.message.length > 0 && !containsSentinel(rec.message)) {
    return trustedError(rec.message, { ...rec, ...extra });
  }
  return trustedError(SAFE_FAILURE, extra);
}

function isDeployEvidenceRecord(value) {
  try {
    return value !== null && typeof value === "object" && !isArraySafe(value);
  } catch {
    return false;
  }
}

function anchoredIo(io) {
  try {
    return resolveAnchoredIo(io);
  } catch {
    throw trustedError("部署证据路径非法");
  }
}

function requireOpenat() {
  if (!openatSupported()) throw trustedError("部署证据路径非法");
}

export function readDeployEvidenceFile(path, io) {
  if (typeof path !== "string" || path.length === 0) {
    throw trustedError("部署证据路径非法");
  }
  requireOpenat();
  let api;
  try {
    api = anchoredIo(io);
  } catch {
    throw trustedError("部署证据路径非法");
  }
  let result;
  try {
    result = api.read(path);
  } catch {
    throw trustedError(EVIDENCE_READ_FAILURE);
  }
  const view = viewAnchoredResult(result, "read");
  if (view.ok) {
    if (typeof view.text !== "string" || !isIdentityDecimal(view.dev) || !isIdentityDecimal(view.ino)) {
      throw trustedError(EVIDENCE_READ_FAILURE);
    }
    let parsed;
    try {
      parsed = JSON.parse(view.text);
    } catch {
      throw trustedError(EVIDENCE_ILLEGAL);
    }
    return { evidenceFileExists: true, existingEvidence: parsed, identity: { dev: view.dev, ino: view.ino } };
  }
  if (view.error === "部署证据路径非法" && view.code === "ENOENT") {
    return { evidenceFileExists: false, existingEvidence: undefined };
  }
  if (view.error === EVIDENCE_NOT_REGULAR) throw trustedError(EVIDENCE_NOT_REGULAR);
  if (view.error === "既有部署证据过大") throw trustedError("既有部署证据过大");
  throw trustedError(EVIDENCE_READ_FAILURE);
}

export function acquireDeployEvidenceLease(path, io) {
  if (typeof path !== "string" || path.length === 0) {
    throw trustedError("部署证据路径非法");
  }
  requireOpenat();
  let api;
  try {
    api = anchoredIo(io);
  } catch {
    throw trustedError("部署证据路径非法");
  }
  let result;
  try {
    result = api.claim(path, CLAIM_MARKER);
  } catch {
    throw trustedError("部署证据租约写入失败");
  }
  const view = viewAnchoredResult(result, "claim");
  if (view.ok) {
    if (!isIdentityDecimal(view.dev) || !isIdentityDecimal(view.ino)) {
      throw trustedError("部署证据租约写入失败");
    }
    return {
      kind: "fresh",
      path,
      dev: view.dev,
      ino: view.ino,
      evidenceFileExists: false,
      existingEvidence: undefined
    };
  }
  if (view.error === "部署证据路径非法" && view.code === "EEXIST") {
    return loadExistingLease(path, io);
  }
  if (view.error === EVIDENCE_NOT_REGULAR) return loadExistingLease(path, io);
  if (view.error === EVIDENCE_READ_FAILURE && view.code === "EACCES") return loadExistingLease(path, io);
  if (view.error === "部署证据路径非法") throw trustedError("部署证据路径非法");
  throw trustedError(view.error === "部署证据租约写入失败" ? "部署证据租约写入失败" : EVIDENCE_READ_FAILURE);
}

function loadExistingLease(path, io) {
  const loaded = readDeployEvidenceFile(path, io);
  if (loaded.evidenceFileExists !== true) {
    throw trustedError("部署证据状态未知");
  }
  return {
    kind: "existing",
    path,
    dev: loaded.identity?.dev,
    ino: loaded.identity?.ino,
    evidenceFileExists: true,
    existingEvidence: loaded.existingEvidence
  };
}

export function assertLeaseHeld(lease, io = defaultFsIo) {
  invariant(lease && (lease.kind === "fresh" || lease.kind === "existing") && typeof lease.path === "string", LEASE_REQUIRED);
  requireOpenat();
  let api;
  try {
    api = anchoredIo(io);
  } catch {
    throw trustedError("部署证据路径非法");
  }
  let result;
  try {
    result = api.lease(lease.path, { dev: lease.dev, ino: lease.ino });
  } catch {
    throw trustedError(LEASE_LOST);
  }
  const view = viewAnchoredResult(result, "lease");
  if (view.ok) return;
  if (view.error === EVIDENCE_NOT_REGULAR) throw trustedError(EVIDENCE_NOT_REGULAR);
  throw trustedError(LEASE_LOST);
}

export function persistClaimedDeployEvidence(lease, evidence, io = defaultFsIo) {
  assertLeaseHeld(lease, io);
  const frozen = freezeEvidence(evidence);
  replaceRegularFileInPlace(lease.path, Buffer.from(frozen.text), { dev: lease.dev, ino: lease.ino }, io);
  return frozen.snapshot;
}

function normalizeUrl(url) {
  return String(url ?? "").replace(/\/$/u, "");
}

function assertSafePagesUrl(url, canonicalHost) {
  invariant(typeof url === "string" && /^https:\/\/[0-9a-f]+\.[a-z0-9-]+\.pages\.dev$/i.test(normalizeUrl(url)), "deployment url 非法");
  const normalized = normalizeUrl(url);
  const hostname = new URL(normalized).hostname;
  invariant(hostname === normalized.slice("https://".length), PAGES_URL_ILLEGAL);
  if (canonicalHost) {
    invariant(
      isCanonicalPagesDevHost(canonicalHost) &&
        hostname === `${hostname.split(".")[0]}.${canonicalHost}` &&
        hostname.endsWith(`.${canonicalHost}`),
      "deployment URL 不属于 canonical host"
    );
  }
  return normalized;
}

export function projectPagesDeployment(raw, expected = {}) {
  assertRecordObject(raw, DEPLOYMENT_READBACK_ILLEGAL);
  const wranglerId = readOwnData(raw, "Id", DEPLOYMENT_READBACK_ILLEGAL);
  const idGot = readOwnData(raw, "id", DEPLOYMENT_ID_ILLEGAL);
  if (idGot.missing && !wranglerId.missing) {
    throw trustedError("Wrangler 展示 JSON 不能当作 Cloudflare API 原始对象");
  }
  const id = idGot.missing ? undefined : idGot.value;
  if (!isSafePagesDeploymentId(id)) throw trustedError(DEPLOYMENT_ID_ILLEGAL);
  const projectName = requireOwnData(raw, "project_name", DEPLOYMENT_READBACK_ILLEGAL);
  if (typeof projectName !== "string" || projectName.length === 0) {
    throw trustedError("deployment 缺 project_name");
  }
  if (expected.project) {
    invariant(projectName === expected.project, "deployment project_name 不是预期项目");
  } else {
    invariant(CLOUDFLARE_PAGES_PROJECTS.includes(projectName), "deployment project_name 不是预期项目");
  }
  const environment = requireOwnData(raw, "environment", DEPLOYMENT_READBACK_ILLEGAL);
  invariant(environment === "preview" || environment === "production", "deployment environment 非法");
  const url = assertSafePagesUrl(requireOwnData(raw, "url", DEPLOYMENT_READBACK_ILLEGAL), expected.canonicalHost);
  const trigger = requireOwnData(raw, "deployment_trigger", DEPLOYMENT_READBACK_ILLEGAL);
  assertRecordObject(trigger, DEPLOYMENT_READBACK_ILLEGAL);
  const meta = requireOwnData(trigger, "metadata", DEPLOYMENT_READBACK_ILLEGAL);
  assertRecordObject(meta, DEPLOYMENT_READBACK_ILLEGAL);
  const commitHash = requireOwnData(meta, "commit_hash", DEPLOYMENT_READBACK_ILLEGAL);
  invariant(/^[0-9a-f]{40}$/.test(commitHash ?? ""), "deployment commit_hash 非法");
  const branch = requireOwnData(meta, "branch", DEPLOYMENT_READBACK_ILLEGAL);
  invariant(typeof branch === "string" && branch.length > 0, "deployment 缺 branch");
  invariant(requireOwnData(meta, "commit_dirty", DEPLOYMENT_READBACK_ILLEGAL) === false, "deployment commit_dirty 不是 false");
  const latestStage = requireOwnData(raw, "latest_stage", DEPLOYMENT_READBACK_ILLEGAL);
  assertRecordObject(latestStage, DEPLOYMENT_READBACK_ILLEGAL);
  invariant(requireOwnData(latestStage, "status", DEPLOYMENT_READBACK_ILLEGAL) === "success", "deployment latest_stage 不是 success");
  return {
    id,
    project_name: expected.project ?? projectName,
    environment,
    url,
    branch,
    commit_hash: commitHash,
    commit_dirty: false,
    latest_stage_status: "success"
  };
}

export function selectUniquePagesDeployment(deployments, expected) {
  invariant(isArraySafe(deployments), "deployment list 不是数组");
  invariant(
    expected?.project && expected.environment && expected.url && expected.branch && expected.publicMain && expected.canonicalHost,
    "deployment 选择条件不完整"
  );
  const projected = [];
  const items = ownArrayItems(deployments, 2000, DEPLOYMENT_READBACK_ILLEGAL);
  for (const item of items) {
    try {
      projected.push(projectPagesDeployment(item, { project: expected.project, canonicalHost: expected.canonicalHost }));
    } catch {
      // 单条非法候选丢弃；不得把原始错误带出
    }
  }
  const matches = projected.filter(
    (item) =>
      item.project_name === expected.project &&
      item.environment === expected.environment &&
      item.url === normalizeUrl(expected.url) &&
      item.branch === expected.branch &&
      item.commit_hash === expected.publicMain &&
      item.commit_dirty === false &&
      item.latest_stage_status === "success"
  );
  invariant(matches.length === 1, "本次 deployment 不是唯一合格候选");
  return matches[0];
}

function projectDomainHosts(project) {
  assertRecordObject(project, PROJECT_READBACK_ILLEGAL);
  const domains = requireOwnArray(project, "domains", MAX_PROJECT_DOMAINS, PROJECT_DOMAINS_ILLEGAL);
  return domains.map((item) => {
    let name;
    if (typeof item === "string") name = item;
    else if (item && typeof item === "object" && !isArraySafe(item)) {
      name = requireOwnData(item, "name", PROJECT_DOMAIN_ILLEGAL);
    }
    if (!isSafeHostname(name)) throw trustedError(PROJECT_DOMAIN_ILLEGAL);
    return name.toLowerCase();
  });
}

function trustedExpectedHosts(expected) {
  invariant(isArraySafe(expected.officialHosts), "正式域名检查表为空");
  const canonicalHost = expected.canonicalHost;
  invariant(isCanonicalPagesDevHost(canonicalHost), CANONICAL_HOST_ILLEGAL);
  const hosts = [...new Set([...expected.officialHosts.map((item) => String(item).toLowerCase()), canonicalHost])];
  for (const host of hosts) {
    if (!isSafeHostname(host)) throw trustedError(PROJECT_DOMAIN_ILLEGAL);
  }
  return [...hosts].sort();
}

export function assertCurrentProductionDeployment(projectReadback, expected) {
  assertRecordObject(projectReadback, PROJECT_READBACK_ILLEGAL);
  const nameGot = readOwnData(projectReadback, "name", PROJECT_READBACK_ILLEGAL);
  const projectNameGot = readOwnData(projectReadback, "project_name", PROJECT_READBACK_ILLEGAL);
  const projectName = nameGot.missing ? projectNameGot.value : nameGot.value;
  invariant(projectName === expected.project, "project name 不一致");
  const canonical = readOwnData(projectReadback, "canonical_deployment", PROJECT_READBACK_ILLEGAL);
  if (canonical.missing || canonical.value == null) throw trustedError("project 缺 canonical_deployment.id");
  assertRecordObject(canonical.value, PROJECT_READBACK_ILLEGAL);
  const productionId = requireOwnData(canonical.value, "id", PROJECT_READBACK_ILLEGAL);
  if (typeof productionId !== "string") throw trustedError("project 缺 canonical_deployment.id");
  if (!isSafePagesDeploymentId(productionId)) throw trustedError(DEPLOYMENT_ID_ILLEGAL);
  if (!isSafePagesDeploymentId(expected.deploymentId)) throw trustedError(DEPLOYMENT_ID_ILLEGAL);
  invariant(productionId === expected.deploymentId, "canonical_deployment 与当前部署不一致");
  const actualHosts = projectDomainHosts(projectReadback);
  const expectedHosts = trustedExpectedHosts(expected);
  sameSet(actualHosts, expectedHosts, "project domains");
  return { name: expected.project, canonical_deployment_id: expected.deploymentId, domains: expectedHosts };
}

export function normalizeDeploySeed(evidenceSeed) {
  assertRecordObject(evidenceSeed, "部署证据缺 release/public readback");
  for (const key of RESERVED_EVIDENCE_KEYS) {
    if (!readOwnData(evidenceSeed, key).missing) throw trustedError("部署 seed 含保留字段");
  }
  const release = requireOwnData(evidenceSeed, "release");
  const publicMain = requireOwnData(evidenceSeed, "publicMain");
  const publicCi = requireOwnData(evidenceSeed, "publicCi");
  if (!sha1(publicMain)) throw trustedError("publicMain 非法");
  return {
    release: projectRelease(release),
    publicMain,
    publicCi: projectPublicCi(publicCi)
  };
}

export function normalizeDeploySites(sites) {
  invariant(isArraySafe(sites) && sites.length === 2, "部署状态机需要恰好两个站点");
  const projects = sites.map((site) => site.project);
  invariant(new Set(projects).size === projects.length, "部署站点 project 重复");
  for (const site of sites) {
    invariant(site.project && site.directory, "站点声明不完整");
    invariant(CLOUDFLARE_PAGES_PROJECTS.includes(site.project), "Pages project 不在允许集");
    invariant(site.previewBranch && site.previewBranch !== "main", "preview branch 不得为 production");
    invariant(site.productionBranch === "main", "production branch 必须是 main");
    invariant(site.previewBranch !== site.productionBranch, "preview/production branch 未分开");
  }
  return sites;
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sameSet(actual, expected, _label) {
  invariant(isArraySafe(actual) && isArraySafe(expected), "exact-set 不是数组");
  const left = [...actual].map((item) => String(item)).sort();
  const right = [...expected].map((item) => String(item)).sort();
  invariant(left.length === right.length && left.every((value, index) => value === right[index]), "exact-set 不一致");
}

function assertRecordedDeployment(recorded, expected) {
  invariant(recorded && typeof recorded === "object" && !isArraySafe(recorded), "既有证据缺 deployment identity");
  invariant(isSafePagesDeploymentId(recorded.id), DEPLOYMENT_ID_ILLEGAL);
  invariant(recorded.project_name === expected.project, "既有证据 project_name 漂移");
  invariant(recorded.environment === expected.environment, "既有证据 environment 漂移");
  invariant(typeof recorded.url === "string" && /^https:\/\/[0-9a-f]+\.[a-z0-9-]+\.pages\.dev$/i.test(normalizeUrl(recorded.url)), "既有证据 url 非法");
  invariant(recorded.branch === expected.branch, "既有证据 branch 漂移");
  invariant(recorded.commit_hash === expected.publicMain, "既有证据 commit 漂移");
  invariant(recorded.commit_dirty === false, "既有证据 commit_dirty 不是 false");
  invariant(recorded.latest_stage_status === "success", "既有证据 latest_stage 不是 success");
  return recorded;
}

export function assertAuditRecoveryEvidence(existing, seed, sites) {
  const projected = projectDurableEvidence(existing);
  invariant(RECOVERABLE_STATUSES.has(projected.status), "既有部署证据状态不可恢复");
  invariant(sameJson(projected.release, seed.release), "既有证据 release 与当前 seed 不一致");
  invariant(projected.publicMain === seed.publicMain, "既有证据 publicMain 与当前 seed 不一致");
  invariant(sameJson(projected.publicCi, seed.publicCi), "既有证据 publicCi 与当前 seed 不一致");
  existing = projected;
  invariant(isArraySafe(existing.sites) && existing.sites.length === sites.length, "既有证据站点集非法");
  sameSet(
    existing.sites.map((site) => site.project),
    sites.map((site) => site.project),
    "既有证据 project"
  );
  sameSet(existing.completedSites ?? [], sites.map((site) => site.project), "既有证据 completedSites");
  for (const spec of sites) {
    const site = existing.sites.find((item) => item.project === spec.project);
    invariant(site && site.directory === spec.directory, "既有证据 directory 漂移");
    invariant(site.planned?.previewBranch === spec.previewBranch, "既有证据 previewBranch 漂移");
    invariant(site.planned?.productionBranch === spec.productionBranch, "既有证据 productionBranch 漂移");
    const expectedCanonical = canonicalPagesDevHost(spec.project);
    invariant(site.planned?.canonicalHost === expectedCanonical, "既有证据 canonicalHost 漂移");
    invariant(site.preview?.status === "verified", "既有证据 preview 未 verified");
    invariant(site.production?.status === "deployed", "既有证据 production 未 deployed");
    const preview = assertRecordedDeployment(site.preview.deployment, {
      project: spec.project,
      environment: "preview",
      branch: spec.previewBranch,
      publicMain: seed.publicMain,
      stage: `preview:${spec.project}`
    });
    const production = assertRecordedDeployment(site.production.deployment, {
      project: spec.project,
      environment: "production",
      branch: spec.productionBranch,
      publicMain: seed.publicMain,
      stage: `production:${spec.project}`
    });
    invariant(normalizeUrl(site.preview.url) === normalizeUrl(preview.url), "既有证据 preview url 漂移");
    invariant(normalizeUrl(site.production.url) === normalizeUrl(production.url), "既有证据 production url 漂移");
  }
  return existing;
}

async function bindDeployment({ wranglerOutput, spec, stage, seed, listDeployments, canonicalHost }) {
  const environment = stage === "preview" ? "preview" : "production";
  const branch = stage === "preview" ? spec.previewBranch : spec.productionBranch;
  let wranglerText;
  try {
    wranglerText = typeof wranglerOutput === "string" ? wranglerOutput : String(wranglerOutput);
  } catch {
    throw trustedError(SAFE_FAILURE);
  }
  const url = parseWranglerDeploymentUrl(wranglerText, canonicalHost);
  let listed;
  try {
    listed = await listDeployments({ project: spec.project, environment });
  } catch {
    throw trustedError(SAFE_FAILURE);
  }
  return selectUniquePagesDeployment(listed, {
    project: spec.project,
    environment,
    url,
    branch,
    publicMain: seed.publicMain,
    canonicalHost
  });
}

function trustedProjectName(project) {
  assertRecordObject(project, PROJECT_READBACK_ILLEGAL);
  const nameGot = readOwnData(project, "name", PROJECT_READBACK_ILLEGAL);
  const projectNameGot = readOwnData(project, "project_name", PROJECT_READBACK_ILLEGAL);
  const name = nameGot.missing ? projectNameGot.value : nameGot.value;
  if (typeof name !== "string") throw trustedError("project name 非法");
  return name;
}

export async function runPagesDeployStateMachine({
  evidenceSeed,
  sites,
  wrangler,
  listDeployments,
  readProject,
  fetchHttp,
  persist,
  audit,
  officialPages,
  lease
}) {
  const seed = normalizeDeploySeed(evidenceSeed);
  const normalizedSites = normalizeDeploySites(sites);
  invariant(typeof wrangler === "function" && typeof fetchHttp === "function", "wrangler/fetch 必须可注入");
  invariant(typeof listDeployments === "function" && typeof readProject === "function", "Cloudflare readback 必须可注入");
  invariant(typeof persist === "function" && typeof audit === "function", "persist/audit 必须可注入");
  invariant(isArraySafe(officialPages) && officialPages.length > 0, "正式域名检查表为空");
  invariant(lease && (lease.kind === "fresh" || lease.kind === "existing") && typeof lease.path === "string" && lease.path.length > 0, LEASE_REQUIRED);
  assertLeaseHeld(lease);

  let recordedEvidence = null;
  if (lease.kind === "existing") {
    const existing = lease.existingEvidence;
    if (!isDeployEvidenceRecord(existing)) {
      throw trustedError(EVIDENCE_ILLEGAL);
    }
    if (!RECOVERABLE_STATUSES.has(existing.status)) {
      throw trustedError("既有部署证据状态不可恢复");
    }
    recordedEvidence = assertAuditRecoveryEvidence(existing, seed, normalizedSites);
    recordedEvidence = projectDurableEvidence(recordedEvidence);
  }

  let evidence = {
    release: seed.release,
    publicMain: seed.publicMain,
    publicCi: seed.publicCi,
    sites: normalizedSites.map((site) => ({
      project: site.project,
      directory: site.directory,
      planned: {
        previewBranch: site.previewBranch,
        productionBranch: site.productionBranch,
        canonicalHost: canonicalPagesDevHost(site.project)
      },
      preview: { status: "planned" },
      production: { status: "planned" }
    })),
    completedSites: [],
    failedStage: null,
    error: null,
    schemaVersion: 1,
    status: "started"
  };

  let lastDurable = null;
  async function callExternal(fn, fallback = SAFE_FAILURE) {
    try {
      return await fn();
    } catch {
      throw trustedError(fallback);
    }
  }

  const persistClone = async () => {
    assertLeaseHeld(lease);
    const frozen = freezeEvidence(evidence);
    await callExternal(() => persist(frozen.snapshot), SAFE_FAILURE);
    lastDurable = frozen.snapshot;
  };

  const persistDurable = async () => {
    try {
      await persistClone();
    } catch (caught) {
      const rec = ownedRecord(caught);
      throw trustedError(rec?.message ?? SAFE_FAILURE, {
        persistFailed: true,
        lastDurableStatus: lastDurable?.status ?? null,
        stage: rec?.stage ?? null
      });
    }
  };

  const persistAfterExternal = async (stage) => {
    try {
      await persistClone();
    } catch {
      evidence.status = "partial_failed";
      evidence.failedStage = stage;
      evidence.error = { message: SAFE_FAILURE, externalOutcome: "maybe_applied" };
      let emergencyFailed = false;
      try {
        await persistClone();
      } catch {
        emergencyFailed = true;
      }
      const errors = [trustedError(SAFE_FAILURE)];
      if (emergencyFailed) errors.push(trustedError(SAFE_FAILURE));
      throw trustedError("persist failed after external call", {
        persistFailed: true,
        stage,
        lastDurableStatus: lastDurable?.status ?? null,
        emergencyPersisted: !emergencyFailed,
        aggregateErrors: errors
      });
    }
  };

  async function httpReadback(url, marker) {
    const readback = await callExternal(() => fetchHttp(url), HTTP_READBACK_FAILURE);
    let ok;
    let status;
    let bodyText = "";
    try {
      if (readback === null || typeof readback !== "object") throw trustedError(HTTP_READBACK_FAILURE);
      const okDesc = Object.getOwnPropertyDescriptor(readback, "ok");
      if (!okDesc || typeof okDesc.get === "function") throw trustedError(HTTP_READBACK_FAILURE);
      ok = okDesc.value;
      const statusDesc = Object.getOwnPropertyDescriptor(readback, "status");
      if (statusDesc && typeof statusDesc.get !== "function") status = statusDesc.value;
      const bodyDesc = Object.getOwnPropertyDescriptor(readback, "body");
      if (bodyDesc && typeof bodyDesc.get !== "function" && typeof bodyDesc.value === "string") bodyText = bodyDesc.value;
    } catch (caught) {
      throwOwnedOrConstant(caught, HTTP_READBACK_FAILURE);
    }
    if (ok !== true) throw trustedError(HTTP_READBACK_FAILURE);
    if (marker && !bodyText.includes(marker)) throw trustedError(HTTP_READBACK_FAILURE);
    return { url, httpStatus: status, bytes: Buffer.byteLength(bodyText) };
  }

  async function runAuditAndComplete() {
    try {
      assertLeaseHeld(lease);
      await callExternal(() => audit(), SAFE_FAILURE);
    } catch {
      evidence.status = "audit_failed";
      evidence.error = { message: SAFE_FAILURE };
      try {
        await persistClone();
      } catch {
        let emergencyFailed = false;
        try {
          await persistClone();
        } catch {
          emergencyFailed = true;
        }
        if (emergencyFailed) {
          throw trustedError("audit_failed persist failed", {
            persistFailed: true,
            lastDurableStatus: lastDurable?.status ?? null,
            emergencyPersisted: false,
            aggregateErrors: [trustedError(SAFE_FAILURE), trustedError(SAFE_FAILURE), trustedError(SAFE_FAILURE)]
          });
        }
      }
      throw trustedError(SAFE_FAILURE);
    }
    evidence.status = "completed";
    await persistDurable();
    return lastDurable;
  }

  async function reverifyExistingDeployments(recorded) {
    const nextSites = [];
    const productionProjects = [];
    for (const spec of normalizedSites) {
      assertLeaseHeld(lease);
      const site = recorded.sites.find((item) => item.project === spec.project);
      const project = await callExternal(() => readProject({ project: spec.project }), SAFE_FAILURE);
      invariant(trustedProjectName(project) === spec.project, "project name 不是预期项目");
      const canonicalHost = canonicalPagesDevHost(spec.project);
      invariant(site.planned.canonicalHost === canonicalHost, "canonical host 漂移");
      const officialHosts = [...new Set(officialPages.filter((item) => item.project === spec.project).map((item) => item.host))];
      const previewIdentity = selectUniquePagesDeployment(await callExternal(() => listDeployments({ project: spec.project, environment: "preview" }), SAFE_FAILURE), {
        project: spec.project,
        environment: "preview",
        url: site.preview.url,
        branch: spec.previewBranch,
        publicMain: seed.publicMain,
        canonicalHost
      });
      invariant(previewIdentity.id === site.preview.deployment.id, "preview deployment id 漂移");
      invariant(previewIdentity.url === normalizeUrl(site.preview.url), "preview url 漂移");
      const productionIdentity = selectUniquePagesDeployment(
        await callExternal(() => listDeployments({ project: spec.project, environment: "production" }), SAFE_FAILURE),
        {
          project: spec.project,
          environment: "production",
          url: site.production.url,
          branch: spec.productionBranch,
          publicMain: seed.publicMain,
          canonicalHost
        }
      );
      invariant(productionIdentity.id === site.production.deployment.id, "production deployment id 漂移");
      invariant(productionIdentity.url === normalizeUrl(site.production.url), "production url 漂移");
      const previewHttp = await httpReadback(previewIdentity.url);
      const productionHttp = await httpReadback(productionIdentity.url);
      productionProjects.push(
        assertCurrentProductionDeployment(project, {
          project: spec.project,
          deploymentId: productionIdentity.id,
          officialHosts,
          canonicalHost
        })
      );
      nextSites.push({
        project: spec.project,
        directory: spec.directory,
        planned: {
          previewBranch: spec.previewBranch,
          productionBranch: spec.productionBranch,
          canonicalHost
        },
        preview: {
          status: "verified",
          url: previewIdentity.url,
          httpStatus: previewHttp.httpStatus,
          deployment: previewIdentity
        },
        production: {
          status: "deployed",
          url: productionIdentity.url,
          httpStatus: productionHttp.httpStatus,
          deployment: productionIdentity
        }
      });
    }
    const productionChecks = [];
    for (const item of officialPages) {
      productionChecks.push({ ...await httpReadback(item.url, item.marker), marker: item.marker, project: item.project });
    }
    return {
      release: seed.release,
      publicMain: seed.publicMain,
      publicCi: seed.publicCi,
      sites: nextSites,
      completedSites: normalizedSites.map((site) => site.project),
      failedStage: null,
      error: null,
      productionChecks,
      productionProjects,
      schemaVersion: 1,
      status: "audit_pending"
    };
  }

  if (recordedEvidence) {
    lastDurable = recordedEvidence;
    evidence = await reverifyExistingDeployments(recordedEvidence);
    await persistDurable();
    return runAuditAndComplete();
  }

  try {
    await persistDurable();
    for (const site of evidence.sites) {
      assertLeaseHeld(lease);
      const spec = normalizedSites.find((item) => item.project === site.project);
      const project = await callExternal(() => readProject({ project: spec.project }), SAFE_FAILURE);
      invariant(trustedProjectName(project) === spec.project, "project name 不是预期项目");
      const canonicalHost = canonicalPagesDevHost(spec.project);
      const officialHosts = [...new Set(officialPages.filter((item) => item.project === spec.project).map((item) => item.host))];
      sameSet(projectDomainHosts(project), trustedExpectedHosts({ officialHosts, canonicalHost }), "project domains");
      site.planned.canonicalHost = canonicalHost;
    }
    for (const site of evidence.sites) {
      const spec = normalizedSites.find((item) => item.project === site.project);
      site.preview = { status: "deploying" };
      await persistDurable();
      try {
        assertLeaseHeld(lease);
        const output = await callExternal(
          () =>
            wrangler({
              project: spec.project,
              directory: spec.directory,
              stage: "preview",
              branch: spec.previewBranch,
              commitHash: seed.publicMain
            }),
          SAFE_FAILURE
        );
        const identity = await bindDeployment({
          wranglerOutput: output,
          spec,
          stage: "preview",
          seed,
          listDeployments,
          canonicalHost: site.planned.canonicalHost
        });
        const http = await httpReadback(identity.url);
        site.preview = { status: "verified", url: identity.url, httpStatus: http.httpStatus, deployment: identity };
        await persistAfterExternal(`preview:${site.project}`);
      } catch (caught) {
        const rec = ownedRecord(caught);
        if (rec?.persistFailed) throw trustedError(rec.message, rec);
        throw trustedError(SAFE_FAILURE, { stage: `preview:${site.project}` });
      }
    }

    for (const site of evidence.sites) {
      const spec = normalizedSites.find((item) => item.project === site.project);
      site.production = { status: "deploying" };
      await persistDurable();
      try {
        assertLeaseHeld(lease);
        const output = await callExternal(
          () =>
            wrangler({
              project: spec.project,
              directory: spec.directory,
              stage: "production",
              branch: spec.productionBranch,
              commitHash: seed.publicMain
            }),
          SAFE_FAILURE
        );
        const identity = await bindDeployment({
          wranglerOutput: output,
          spec,
          stage: "production",
          seed,
          listDeployments,
          canonicalHost: site.planned.canonicalHost
        });
        const http = await httpReadback(identity.url);
        site.production = { status: "deployed", url: identity.url, httpStatus: http.httpStatus, deployment: identity };
        evidence.completedSites = [...evidence.completedSites, site.project];
        await persistAfterExternal(`production:${site.project}`);
      } catch (caught) {
        const rec = ownedRecord(caught);
        if (rec?.persistFailed) throw trustedError(rec.message, rec);
        throw trustedError(SAFE_FAILURE, { stage: `production:${site.project}` });
      }
    }

    try {
      const productionProjects = [];
      for (const site of evidence.sites) {
        assertLeaseHeld(lease);
        const spec = normalizedSites.find((item) => item.project === site.project);
        const project = await callExternal(() => readProject({ project: spec.project }), SAFE_FAILURE);
        const officialHosts = [...new Set(officialPages.filter((item) => item.project === spec.project).map((item) => item.host))];
        productionProjects.push(
          assertCurrentProductionDeployment(project, {
            project: spec.project,
            deploymentId: site.production.deployment.id,
            officialHosts,
            canonicalHost: site.planned.canonicalHost
          })
        );
      }
      const productionChecks = [];
      for (const item of officialPages) {
        productionChecks.push({ ...await httpReadback(item.url, item.marker), marker: item.marker, project: item.project });
      }
      evidence.productionChecks = productionChecks;
      evidence.productionProjects = productionProjects;
    } catch (caught) {
      const rec = ownedRecord(caught);
      throw trustedError(rec?.message ?? SAFE_FAILURE, { stage: rec?.stage ?? "production-domains" });
    }
    evidence.status = "audit_pending";
    await persistDurable();
  } catch (caught) {
    const rec = ownedRecord(caught);
    if (rec?.persistFailed) throw trustedError(rec.message, rec);
    evidence.status = "partial_failed";
    evidence.failedStage = rec?.stage ?? "unknown";
    evidence.error = { message: SAFE_FAILURE };
    try {
      await persistDurable();
    } catch {
      throw trustedError("partial_failed persist failed", {
        persistFailed: true,
        stage: rec?.stage ?? "unknown",
        lastDurableStatus: lastDurable?.status ?? null,
        aggregateErrors: [trustedError(SAFE_FAILURE), trustedError(SAFE_FAILURE)]
      });
    }
    throw trustedError(SAFE_FAILURE, { stage: rec?.stage ?? "unknown" });
  }

  return runAuditAndComplete();
}
