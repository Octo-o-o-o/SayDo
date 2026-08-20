import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { createConnection } from "node:net";
import { join } from "node:path";
import {
  desktopSummaryV1Schema,
  runtimeIdentitySchema,
  runtimeOwnershipPayload,
  runtimeOwnershipProofSchema,
  runtimeProtocolCompatible,
  type RuntimeIdentity
} from "@saydo/contracts";

export type DaemonProbe =
  | { kind: "available" }
  | {
      kind: "attached";
      pid: number;
      identity: RuntimeIdentity;
      stateRootDigest: string;
      summary: ReturnType<typeof desktopSummaryV1Schema.parse>;
    }
  | { kind: "conflict"; reason: string; pid?: number };

export function homeDigest(home: string): string {
  return createHash("sha256").update(home, "utf8").digest("hex");
}

function validOwnershipProof(
  raw: Record<string, unknown>,
  token: string,
  nonce: string,
  pid: number,
  port: number,
  startedAt: string,
  stateRootDigest: string,
  identity: RuntimeIdentity
): boolean {
  const proof = runtimeOwnershipProofSchema.safeParse(raw["ownershipProof"]);
  if (!proof.success || proof.data.nonce !== nonce) return false;
  const expected = createHmac("sha256", token)
    .update(runtimeOwnershipPayload({ nonce, pid, port, startedAt, stateRootDigest, identity }))
    .digest();
  const actual = Buffer.from(proof.data.mac, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function fetchJson(url: string, init?: RequestInit): Promise<{ response: Response; body: unknown }> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(1_500) });
  const body = await response.json().catch(() => null);
  return { response, body };
}

function portIsOccupied(port: number): Promise<boolean> {
  return new Promise((resolveOccupied) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    const finish = (occupied: boolean) => {
      socket.destroy();
      resolveOccupied(occupied);
    };
    socket.setTimeout(750, () => finish(true));
    socket.once("connect", () => finish(true));
    socket.once("error", (err: NodeJS.ErrnoException) => finish(err.code !== "ECONNREFUSED"));
  });
}

export async function probeDaemon(
  home: string,
  port: number,
  protocolVersion: string
): Promise<DaemonProbe> {
  if (!(await portIsOccupied(port))) return { kind: "available" };
  const nonce = randomBytes(24).toString("hex");
  let healthResponse: Response;
  let raw: unknown;
  try {
    const health = await fetchJson(`http://127.0.0.1:${port}/health?ownershipNonce=${nonce}`);
    healthResponse = health.response;
    raw = health.body;
  } catch {
    return { kind: "conflict", reason: "unknown_service" };
  }
  if (!healthResponse.ok || raw === null || typeof raw !== "object") {
    return { kind: "conflict", reason: "unknown_service" };
  }
  const health = raw as Record<string, unknown>;
  const pid = typeof health["pid"] === "number" && Number.isInteger(health["pid"]) && health["pid"] > 1
    ? health["pid"]
    : undefined;
  const identity = runtimeIdentitySchema.safeParse(health["identity"]);
  if (health["service"] !== "saydo-daemon" || !identity.success) {
    return { kind: "conflict", reason: "unknown_service", ...(pid ? { pid } : {}) };
  }
  // B9: bind 后、handler 齐备前的 starting 相位——调用方有界重试。
  if (health["phase"] === "starting") {
    return { kind: "conflict", reason: "ownership_unverified", ...(pid ? { pid } : {}) };
  }
  if (!runtimeProtocolCompatible(identity.data.protocolVersion, protocolVersion)) {
    return { kind: "conflict", reason: "protocol_mismatch", ...(pid ? { pid } : {}) };
  }
  if (health["stateRootDigest"] !== homeDigest(home)) {
    return { kind: "conflict", reason: "home_mismatch", ...(pid ? { pid } : {}) };
  }
  if (pid === undefined) return { kind: "conflict", reason: "ownership_unverified" };
  const startedAt = typeof health["startedAt"] === "string" && health["startedAt"] !== ""
    ? health["startedAt"]
    : undefined;
  if (startedAt === undefined) return { kind: "conflict", reason: "ownership_unverified", pid };
  let token: string;
  try {
    token = readFileSync(join(home, ".cap-token"), "utf8").trim();
  } catch {
    return { kind: "conflict", reason: "token_unavailable", ...(pid ? { pid } : {}) };
  }
  if (!validOwnershipProof(health, token, nonce, pid, port, startedAt, health["stateRootDigest"] as string, identity.data)) {
    return { kind: "conflict", reason: "ownership_unverified", pid };
  }
  try {
    const protectedProbe = await fetchJson(`http://127.0.0.1:${port}/api/desktop/summary`, {
      headers: { "x-saydo-token": token }
    });
    const summary = desktopSummaryV1Schema.safeParse(protectedProbe.body);
    if (!protectedProbe.response.ok || !summary.success) {
      return { kind: "conflict", reason: "ownership_unverified", ...(pid ? { pid } : {}) };
    }
    const confirmationNonce = randomBytes(24).toString("hex");
    const confirmation = await fetchJson(
      `http://127.0.0.1:${port}/health?ownershipNonce=${confirmationNonce}`
    );
    const confirmationBody = confirmation.body as Record<string, unknown> | null;
    if (
      !confirmation.response.ok ||
      confirmationBody === null ||
      typeof confirmationBody !== "object" ||
      confirmationBody["pid"] !== pid ||
      confirmationBody["startedAt"] !== startedAt ||
      !validOwnershipProof(
        confirmationBody,
        token,
        confirmationNonce,
        pid,
        port,
        startedAt,
        health["stateRootDigest"] as string,
        identity.data
      )
    ) {
      return { kind: "conflict", reason: "ownership_changed", pid };
    }
    return {
      kind: "attached",
      pid,
      identity: identity.data,
      stateRootDigest: health["stateRootDigest"] as string,
      summary: summary.data
    };
  } catch {
    return { kind: "conflict", reason: "ownership_unverified", ...(pid ? { pid } : {}) };
  }
}
