import { createHmac } from "node:crypto";
import {
  runtimeOwnershipPayload,
  type RuntimeIdentity,
  type RuntimeOwnershipProof
} from "@saydo/contracts";

const OWNERSHIP_NONCE = /^[0-9a-f]{32,128}$/;

export function runtimeOwnershipProof(input: {
  nonce: string | null;
  token: string;
  pid: number;
  port: number;
  startedAt: string;
  stateRootDigest: string;
  identity: RuntimeIdentity;
}): RuntimeOwnershipProof | undefined {
  if (!input.nonce || !OWNERSHIP_NONCE.test(input.nonce) || input.token === "") return undefined;
  const payload = runtimeOwnershipPayload({
    nonce: input.nonce,
    pid: input.pid,
    port: input.port,
    startedAt: input.startedAt,
    stateRootDigest: input.stateRootDigest,
    identity: input.identity
  });
  return {
    version: 1,
    nonce: input.nonce,
    mac: createHmac("sha256", input.token).update(payload).digest("hex")
  };
}
