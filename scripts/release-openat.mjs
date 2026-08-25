#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { closeSync, constants as fsConstants, fstatSync, openSync, unlinkSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import path from "node:path";

export const OPENAT_HELPER_RELATIVE = "scripts/release-openat-posix.py";
export const MAX_OPENAT_STDIN_BYTES = 2 * 1024 * 1024;
export const MAX_OPENAT_STDOUT_BYTES = 2 * 1024 * 1024;
export const MAX_EVIDENCE_BYTES = 1_048_576;
export const MAX_IDENTITY_DIGITS = 39;

const HELPER = join(import.meta.dirname, "release-openat-posix.py");
const PATH_ILLEGAL = "部署证据路径非法";
const WRITE_FAILURE = "部署证据写入失败";
const CLAIM_FAILURE = "部署证据租约写入失败";
const LEASE_LOST = "部署证据租约已失效";
const NOT_REGULAR = "既有部署证据不是普通文件";
const READ_FAILURE = "既有部署证据读取失败";
const OVERSIZE = "既有部署证据过大";
const REFUSE_NON_REGULAR = "拒绝覆盖非普通文件";
const REQUEST_KEYS = {
  claim: new Set(["op", "path", "body", "failParentFsync"]),
  read: new Set(["op", "path"]),
  persist: new Set(["op", "path", "body", "dev", "ino"]),
  lease: new Set(["op", "path", "dev", "ino"])
};
const SUCCESS_KEYS = Object.freeze({
  claim: Object.freeze(["ok", "dev", "ino"]),
  read: Object.freeze(["ok", "dev", "ino", "text"]),
  persist: Object.freeze(["ok"]),
  lease: Object.freeze(["ok"])
});

function failureTuple(error, code) {
  return code == null ? Object.freeze({ error }) : Object.freeze({ error, code });
}

function failureTupleKey(error, code) {
  return code == null ? error : `${error}\0${code}`;
}

export const ANCHORED_FAILURE_TUPLES = Object.freeze({
  claim: Object.freeze([
    failureTuple(PATH_ILLEGAL),
    failureTuple(PATH_ILLEGAL, "OPENAT_UNSUPPORTED"),
    failureTuple(PATH_ILLEGAL, "ENOENT"),
    failureTuple(PATH_ILLEGAL, "EEXIST"),
    failureTuple(NOT_REGULAR, "ELOOP"),
    failureTuple(NOT_REGULAR, "ENOTDIR"),
    failureTuple(READ_FAILURE),
    failureTuple(READ_FAILURE, "EACCES"),
    failureTuple(CLAIM_FAILURE)
  ]),
  read: Object.freeze([
    failureTuple(PATH_ILLEGAL),
    failureTuple(PATH_ILLEGAL, "OPENAT_UNSUPPORTED"),
    failureTuple(PATH_ILLEGAL, "ENOENT"),
    failureTuple(NOT_REGULAR, "ELOOP"),
    failureTuple(NOT_REGULAR, "ENOTDIR"),
    failureTuple(NOT_REGULAR, "ENXIO"),
    failureTuple(READ_FAILURE),
    failureTuple(READ_FAILURE, "EACCES"),
    failureTuple(OVERSIZE)
  ]),
  persist: Object.freeze([
    failureTuple(PATH_ILLEGAL),
    failureTuple(PATH_ILLEGAL, "OPENAT_UNSUPPORTED"),
    failureTuple(PATH_ILLEGAL, "ENOENT"),
    failureTuple(NOT_REGULAR, "ELOOP"),
    failureTuple(NOT_REGULAR, "EISDIR"),
    failureTuple(NOT_REGULAR, "ENOTDIR"),
    failureTuple(NOT_REGULAR, "ENXIO"),
    failureTuple(READ_FAILURE),
    failureTuple(READ_FAILURE, "EACCES"),
    failureTuple(REFUSE_NON_REGULAR, "ELOOP"),
    failureTuple(LEASE_LOST),
    failureTuple(WRITE_FAILURE)
  ]),
  lease: Object.freeze([
    failureTuple(PATH_ILLEGAL),
    failureTuple(PATH_ILLEGAL, "OPENAT_UNSUPPORTED"),
    failureTuple(PATH_ILLEGAL, "ENOENT"),
    failureTuple(NOT_REGULAR, "ELOOP"),
    failureTuple(NOT_REGULAR, "ENOTDIR"),
    failureTuple(NOT_REGULAR, "ENXIO"),
    failureTuple(READ_FAILURE),
    failureTuple(READ_FAILURE, "EACCES"),
    failureTuple(LEASE_LOST)
  ])
});

const FAILURE_TUPLE_KEYS = Object.freeze(
  Object.fromEntries(
    Object.entries(ANCHORED_FAILURE_TUPLES).map(([op, tuples]) => [
      op,
      new Set(tuples.map((item) => failureTupleKey(item.error, item.code)))
    ])
  )
);

export const ANCHORED_FAILURE_ERROR_UNIVERSE = Object.freeze([
  PATH_ILLEGAL,
  NOT_REGULAR,
  READ_FAILURE,
  WRITE_FAILURE,
  LEASE_LOST,
  CLAIM_FAILURE,
  OVERSIZE,
  REFUSE_NON_REGULAR
]);
export const ANCHORED_FAILURE_CODE_UNIVERSE = Object.freeze([
  "OPENAT_UNSUPPORTED",
  "ENOENT",
  "EEXIST",
  "ELOOP",
  "EISDIR",
  "ENOTDIR",
  "ENXIO",
  "EACCES",
  "EIO"
]);

export function isAllowedAnchoredFailure(op, error, code) {
  const allowed = FAILURE_TUPLE_KEYS[op];
  if (!allowed) return false;
  if (typeof error !== "string" || error.length === 0) return false;
  if (code != null && (typeof code !== "string" || code.length === 0)) return false;
  return allowed.has(failureTupleKey(error, code == null ? undefined : code));
}

export function openatSupported(platform = process.platform) {
  return platform !== "win32";
}

export function isIdentityDecimal(value) {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= MAX_IDENTITY_DIGITS &&
    /^[0-9]+$/.test(value) &&
    (value === "0" || value[0] !== "0")
  );
}

export function splitAnchoredPath(filePath, pathApi = path) {
  if (typeof filePath !== "string" || filePath.length === 0 || filePath.includes("\0")) {
    throw new Error(PATH_ILLEGAL);
  }
  const absolute = pathApi.resolve(filePath);
  const parsed = pathApi.parse(absolute);
  const root = parsed.root;
  if (typeof root !== "string" || root.length === 0) throw new Error(PATH_ILLEGAL);
  if (root.startsWith("\\\\") && /^\\\\[A-Za-z]:/.test(root)) throw new Error(PATH_ILLEGAL);
  if (/^\\[A-Za-z]:/.test(root)) throw new Error(PATH_ILLEGAL);
  const rel = absolute.slice(root.length);
  const parts = rel.split(/[\\/]/).filter(Boolean);
  if (parts.length === 0 || parts.some((part) => part === "." || part === ".." || part.includes("\0"))) {
    throw new Error(PATH_ILLEGAL);
  }
  return { root, parts, absolute };
}

function ownData(object, key) {
  try {
    if (object === null || object === undefined) return undefined;
    const kind = typeof object;
    if (kind !== "object" && kind !== "function") return undefined;
    const desc = Object.getOwnPropertyDescriptor(object, key);
    if (!desc || typeof desc.get === "function" || typeof desc.set === "function" || !Object.prototype.hasOwnProperty.call(desc, "value")) {
      return undefined;
    }
    return desc.value;
  } catch {
    throw new Error(PATH_ILLEGAL);
  }
}

function sameKeySet(names, expected) {
  if (!Array.isArray(names) || names.length !== expected.length) return false;
  const allowed = new Set(expected);
  return names.every((key) => allowed.has(key));
}

function failView() {
  return { ok: false, error: PATH_ILLEGAL };
}

export function encodeEvidenceBody(body) {
  try {
    if (Buffer.isBuffer(body)) {
      const text = body.toString("utf8");
      const roundtrip = Buffer.from(text, "utf8");
      if (roundtrip.length !== body.length || !roundtrip.equals(body)) {
        return { invalid: true };
      }
      if (body.length > MAX_EVIDENCE_BYTES) {
        return { invalid: true, oversize: true };
      }
      return { invalid: false, text, bytes: body.length };
    }
    if (typeof body !== "string") return { invalid: true };
    const bytes = Buffer.byteLength(body, "utf8");
    if (bytes > MAX_EVIDENCE_BYTES) return { invalid: true, oversize: true };
    return { invalid: false, text: body, bytes };
  } catch {
    return { invalid: true };
  }
}

function ownMethod(object, key) {
  let desc;
  try {
    desc = Object.getOwnPropertyDescriptor(object, key);
  } catch {
    throw new Error(PATH_ILLEGAL);
  }
  if (!desc) return undefined;
  if (typeof desc.get === "function" || typeof desc.set === "function") {
    throw new Error(PATH_ILLEGAL);
  }
  if (!Object.prototype.hasOwnProperty.call(desc, "value") || typeof desc.value !== "function") {
    throw new Error(PATH_ILLEGAL);
  }
  return desc.value;
}

export function viewAnchoredResult(result, op) {
  try {
    const expectedSuccess = SUCCESS_KEYS[op];
    if (!expectedSuccess) return failView();
    if (result === null || result === undefined || typeof result !== "object") {
      return failView();
    }
    let names;
    let symbols;
    try {
      names = Object.getOwnPropertyNames(result);
      symbols = Object.getOwnPropertySymbols(result);
    } catch {
      return failView();
    }
    if (!Array.isArray(names) || !Array.isArray(symbols) || symbols.length > 0) {
      return failView();
    }
    const values = {};
    for (const key of names) {
      let desc;
      try {
        desc = Object.getOwnPropertyDescriptor(result, key);
      } catch {
        return failView();
      }
      if (!desc || typeof desc.get === "function" || typeof desc.set === "function") {
        return failView();
      }
      if (!Object.prototype.hasOwnProperty.call(desc, "value")) return failView();
      values[key] = desc.value;
    }
    if (values.ok === true) {
      if (!sameKeySet(names, expectedSuccess)) return failView();
      if (op === "persist" || op === "lease") {
        return { ok: true };
      }
      if (!isIdentityDecimal(values.dev) || !isIdentityDecimal(values.ino)) return failView();
      if (op === "claim") {
        return { ok: true, dev: values.dev, ino: values.ino };
      }
      if (typeof values.text !== "string") return failView();
      if (Buffer.byteLength(values.text, "utf8") > MAX_EVIDENCE_BYTES) return failView();
      return { ok: true, dev: values.dev, ino: values.ino, text: values.text };
    }
    if (values.ok === false) {
      if (names.includes("dev") || names.includes("ino") || names.includes("text")) return failView();
      const hasCode = names.includes("code");
      if (hasCode) {
        if (!sameKeySet(names, ["ok", "error", "code"])) return failView();
        if (typeof values.error !== "string" || typeof values.code !== "string") return failView();
        if (!isAllowedAnchoredFailure(op, values.error, values.code)) return failView();
        return { ok: false, error: values.error, code: values.code };
      }
      if (!sameKeySet(names, ["ok", "error"])) return failView();
      if (typeof values.error !== "string") return failView();
      if (!isAllowedAnchoredFailure(op, values.error)) return failView();
      return { ok: false, error: values.error };
    }
    return failView();
  } catch {
    return failView();
  }
}

function readIdentity(identity) {
  try {
    if (identity === null || identity === undefined) return { invalid: true };
    if (typeof identity !== "object" && typeof identity !== "function") return { invalid: true };
    const dev = ownData(identity, "dev");
    const ino = ownData(identity, "ino");
    if (!isIdentityDecimal(dev) || !isIdentityDecimal(ino)) return { invalid: true };
    return { invalid: false, dev, ino };
  } catch {
    return { invalid: true };
  }
}

export function resolveAnchoredIo(io) {
  try {
    if (io === undefined || io === null) return defaultAnchoredIo;
    if (typeof io !== "object" && typeof io !== "function") {
      throw new Error(PATH_ILLEGAL);
    }
    let anchoredDesc;
    try {
      anchoredDesc = Object.getOwnPropertyDescriptor(io, "anchored");
    } catch {
      throw new Error(PATH_ILLEGAL);
    }
    if (!anchoredDesc) return defaultAnchoredIo;
    if (typeof anchoredDesc.get === "function" || typeof anchoredDesc.set === "function") {
      throw new Error(PATH_ILLEGAL);
    }
    const anchored = Object.prototype.hasOwnProperty.call(anchoredDesc, "value") ? anchoredDesc.value : undefined;
    if (anchored === undefined || anchored === null) return defaultAnchoredIo;
    if (typeof anchored !== "object" && typeof anchored !== "function") {
      throw new Error(PATH_ILLEGAL);
    }
    const claim = ownMethod(anchored, "claim");
    const read = ownMethod(anchored, "read");
    const persist = ownMethod(anchored, "persist");
    const lease = ownMethod(anchored, "lease");
    return {
      claim: claim ? claim.bind(anchored) : defaultAnchoredIo.claim.bind(defaultAnchoredIo),
      read: read ? read.bind(anchored) : defaultAnchoredIo.read.bind(defaultAnchoredIo),
      persist: persist ? persist.bind(anchored) : defaultAnchoredIo.persist.bind(defaultAnchoredIo),
      lease: lease ? lease.bind(anchored) : defaultAnchoredIo.lease.bind(defaultAnchoredIo)
    };
  } catch {
    throw new Error(PATH_ILLEGAL);
  }
}

export function selectAnchoredMethod(io, name) {
  const resolved = resolveAnchoredIo(io);
  const method = resolved[name];
  if (typeof method !== "function") throw new Error(PATH_ILLEGAL);
  return method;
}

export const HELPER_STDIN_OPEN_MODE = 0o600;

export function helperStdinOpenFlags() {
  const nofollow = fsConstants.O_NOFOLLOW;
  if (!nofollow || !fsConstants.O_CREAT || !fsConstants.O_EXCL || !fsConstants.O_RDWR) return null;
  return fsConstants.O_RDWR | fsConstants.O_CREAT | fsConstants.O_EXCL | nofollow;
}

function closeQuietFd(io, fd) {
  if (fd == null) return;
  try {
    if (io && typeof io.close === "function") io.close(fd);
    else closeSync(fd);
  } catch {
    // ignore
  }
}

function closeFdOnce(io, fd) {
  if (fd == null) return { attempted: false, ok: true };
  try {
    if (io && typeof io.close === "function") io.close(fd);
    else closeSync(fd);
    return { attempted: true, ok: true };
  } catch {
    return { attempted: true, ok: false };
  }
}

function isOwnerOnlyRegular(stat, expectedNlink) {
  try {
    if (!stat || typeof stat.isFile !== "function" || stat.isFile() !== true) return false;
    if (typeof stat.isSymbolicLink === "function" && stat.isSymbolicLink() === true) return false;
    if (stat.nlink !== expectedNlink) return false;
    if ((stat.mode & 0o777) !== HELPER_STDIN_OPEN_MODE) return false;
    if (typeof process.getuid === "function" && stat.uid !== process.getuid()) return false;
    return true;
  } catch {
    return false;
  }
}

function sameFdIdentity(left, right) {
  return Boolean(
    left &&
      right &&
      String(left.dev) === String(right.dev) &&
      String(left.ino) === String(right.ino)
  );
}

export const defaultHelperStdinIo = Object.freeze({
  openExclusive(filePath, flags, mode) {
    return openSync(filePath, flags, mode);
  },
  fstat(fd) {
    return fstatSync(fd);
  },
  writeAt(fd, bytes, offset, length, position) {
    return writeSync(fd, bytes, offset, length, position);
  },
  unlink(filePath) {
    unlinkSync(filePath);
  },
  close(fd) {
    closeSync(fd);
  }
});

function writeFullyAt(io, fd, bytes) {
  let position = 0;
  while (position < bytes.length) {
    const wrote = io.writeAt(fd, bytes, position, bytes.length - position, position);
    if (!Number.isInteger(wrote) || wrote <= 0 || wrote > bytes.length - position) {
      throw new Error("short");
    }
    position += wrote;
  }
}

export function bindHelperStdinFd(bytes, io = defaultHelperStdinIo) {
  let fd;
  let filePath;
  let unlinked = false;
  const stdinIo = io && typeof io === "object" ? io : defaultHelperStdinIo;
  try {
    if (!Buffer.isBuffer(bytes) || bytes.length > MAX_OPENAT_STDIN_BYTES) return { ok: false };
    const flags = helperStdinOpenFlags();
    if (flags == null || !openatSupported()) return { ok: false };
    if (
      typeof stdinIo.openExclusive !== "function" ||
      typeof stdinIo.fstat !== "function" ||
      typeof stdinIo.writeAt !== "function" ||
      typeof stdinIo.unlink !== "function"
    ) {
      return { ok: false };
    }
    filePath = join(tmpdir(), `saydo-openat-${randomBytes(16).toString("hex")}`);
    fd = stdinIo.openExclusive(filePath, flags, HELPER_STDIN_OPEN_MODE);
    const created = stdinIo.fstat(fd);
    if (!isOwnerOnlyRegular(created, 1) || created.size !== 0) throw new Error("stat");
    if (typeof stdinIo.afterCreate === "function") stdinIo.afterCreate(fd, filePath);
    try {
      stdinIo.unlink(filePath);
    } catch {
      throw new Error("unlink");
    }
    unlinked = true;
    const anonymous = stdinIo.fstat(fd);
    if (!isOwnerOnlyRegular(anonymous, 0) || !sameFdIdentity(created, anonymous) || anonymous.size !== 0) {
      throw new Error("stat");
    }
    writeFullyAt(stdinIo, fd, bytes);
    if (typeof stdinIo.afterWrite === "function") stdinIo.afterWrite(fd);
    const written = stdinIo.fstat(fd);
    if (!isOwnerOnlyRegular(written, 0) || !sameFdIdentity(created, written) || written.size !== bytes.length) {
      throw new Error("stat");
    }
    const bound = { ok: true, fd };
    fd = undefined;
    return bound;
  } catch {
    closeQuietFd(stdinIo, fd);
    if (!unlinked && filePath) {
      try {
        stdinIo.unlink(filePath);
      } catch {
        try {
          unlinkSync(filePath);
        } catch {
          // ignore
        }
      }
    }
    return { ok: false };
  }
}

export function runOpenatHelper(request, options) {
  try {
    if (request === null || typeof request !== "object") {
      return failView();
    }
    const op = ownData(request, "op");
    const allowed = REQUEST_KEYS[op];
    if (!allowed) return failView();
    if (!openatSupported()) {
      return viewAnchoredResult({ ok: false, code: "OPENAT_UNSUPPORTED", error: PATH_ILLEGAL }, op);
    }
    let names;
    try {
      names = Object.getOwnPropertyNames(request);
    } catch {
      return failView();
    }
    if (!Array.isArray(names) || names.some((key) => !allowed.has(key))) {
      return failView();
    }
    const payload = { op };
    for (const key of allowed) {
      if (key === "op") continue;
      if (!names.includes(key)) continue;
      payload[key] = ownData(request, key);
    }
    if (op === "claim" || op === "persist") {
      const encoded = encodeEvidenceBody(payload.body);
      if (encoded.invalid) {
        if (encoded.oversize) {
          return viewAnchoredResult({ ok: false, error: op === "claim" ? CLAIM_FAILURE : WRITE_FAILURE }, op);
        }
        return failView();
      }
      payload.body = encoded.text;
    }
    let input;
    try {
      input = JSON.stringify(payload);
    } catch {
      return failView();
    }
    if (Buffer.byteLength(input) > MAX_OPENAT_STDIN_BYTES) {
      return failView();
    }
    const stdinIo = options && typeof options === "object" ? options.stdinIo : undefined;
    const bound = bindHelperStdinFd(Buffer.from(input, "utf8"), stdinIo ?? defaultHelperStdinIo);
    if (!bound.ok) return failView();
    const closeIo = stdinIo ?? defaultHelperStdinIo;
    let spawned;
    try {
      const spawnImpl = options && typeof options.spawnSyncImpl === "function" ? options.spawnSyncImpl : spawnSync;
      spawned = spawnImpl("python3", ["-B", HELPER], {
        stdio: [bound.fd, "pipe", "pipe"],
        encoding: "utf8",
        timeout: 30000,
        maxBuffer: MAX_OPENAT_STDOUT_BYTES,
        windowsHide: true,
        killSignal: "SIGKILL",
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1", PYTHONUNBUFFERED: "1", PYTHONIOENCODING: "utf-8" }
      });
    } catch {
      closeFdOnce(closeIo, bound.fd);
      return failView();
    }
    const closed = closeFdOnce(closeIo, bound.fd);
    if (!closed.ok) return failView();
    if (!spawned || spawned.error || spawned.signal || spawned.status !== 0) {
      return failView();
    }
    if (typeof spawned.stdout !== "string" || spawned.stdout.length === 0) {
      return failView();
    }
    if (Buffer.byteLength(spawned.stdout) > MAX_OPENAT_STDOUT_BYTES) {
      return failView();
    }
    if (!spawned.stdout.endsWith("\n") || spawned.stdout.slice(0, -1).includes("\n")) {
      return failView();
    }
    let parsed;
    try {
      parsed = JSON.parse(spawned.stdout.slice(0, -1));
    } catch {
      return failView();
    }
    return viewAnchoredResult(parsed, op);
  } catch {
    return failView();
  }
}

export const defaultAnchoredIo = {
  claim(filePath, body) {
    const encoded = encodeEvidenceBody(body);
    if (encoded.invalid) {
      return viewAnchoredResult({ ok: false, error: CLAIM_FAILURE }, "claim");
    }
    return runOpenatHelper({ op: "claim", path: filePath, body: encoded.text });
  },
  read(filePath) {
    return runOpenatHelper({ op: "read", path: filePath });
  },
  persist(filePath, body, identity) {
    const encoded = encodeEvidenceBody(body);
    if (encoded.invalid) {
      return viewAnchoredResult({ ok: false, error: WRITE_FAILURE }, "persist");
    }
    const parsed = readIdentity(identity);
    if (parsed.invalid) return viewAnchoredResult({ ok: false, error: LEASE_LOST }, "persist");
    return runOpenatHelper({
      op: "persist",
      path: filePath,
      body: encoded.text,
      dev: parsed.dev,
      ino: parsed.ino
    });
  },
  lease(filePath, identity) {
    const parsed = readIdentity(identity);
    if (parsed.invalid) return viewAnchoredResult({ ok: false, error: LEASE_LOST }, "lease");
    return runOpenatHelper({ op: "lease", path: filePath, dev: parsed.dev, ino: parsed.ino });
  }
};

export { WRITE_FAILURE, CLAIM_FAILURE };
