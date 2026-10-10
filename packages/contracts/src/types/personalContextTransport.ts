// §19.2.1：固定有界握手形状；parse 成功不构成操作系统或业务授权证明。
import { z } from "zod";
import { jcsDigest } from "../jcs.js";
import { digestSchema } from "./common.js";
import { PERSONAL_CONTEXT_PROTOCOL, personalContextPeerIdentitySchema } from "./personalContext.js";

export const PERSONAL_CONTEXT_MAX_FRAME_BYTES = 65536;
export const PERSONAL_CONTEXT_MAX_HANDSHAKE_BYTES = 8192;
export const PERSONAL_CONTEXT_DIRECTION_FRAMES = 512;
const nonce = z.string().regex(/^[A-Za-z0-9_-]{43}$/u);
const processIdentity = z.strictObject({
  pid: z.number().int().positive().max(0xffffffff),
  birth: z.string().min(1).max(64).regex(/^[a-z0-9:.-]+$/u),
});
export const personalContextEndpointSchema = z.strictObject({
  platform: z.enum(["win32", "linux", "darwin"]),
  endpointDigest: digestSchema,
  owner: z.string().min(1).max(184).regex(/^[A-Za-z0-9:-]+$/u),
  saydo: processIdentity,
  anyvia: processIdentity,
});
export type PersonalContextEndpoint = z.infer<typeof personalContextEndpointSchema>;
export const personalContextTransportBindingSchema = z.strictObject({
  identity: personalContextPeerIdentitySchema,
  saydoKeyDigest: digestSchema,
  anyviaKeyDigest: digestSchema,
  endpoint: personalContextEndpointSchema,
});
export type PersonalContextTransportBinding = z.infer<typeof personalContextTransportBindingSchema>;
export const personalContextTransportRoleSchema = z.enum(["saydo", "anyvia"]);
export type PersonalContextTransportRole = z.infer<typeof personalContextTransportRoleSchema>;
export const personalContextTransportHelloSchema = z.strictObject({
  protocol: z.literal(PERSONAL_CONTEXT_PROTOCOL),
  schemaDigest: digestSchema,
  role: personalContextTransportRoleSchema,
  binding: personalContextTransportBindingSchema,
  bootEpoch: nonce,
  nonce,
  // 标准 X25519 SPKI DER 的固定44字节编码；另须回读算法和规范编码。
  ephemeralKey: z.string().regex(/^[A-Za-z0-9_-]{59}$/u),
});
export type PersonalContextTransportHello = z.infer<typeof personalContextTransportHelloSchema>;
export const personalContextTransportAssertionSchema = z.strictObject({
  role: personalContextTransportRoleSchema,
  transcriptDigest: digestSchema,
  signature: z.string().regex(/^[A-Za-z0-9_-]{86}$/u),
});
export type PersonalContextTransportAssertion = z.infer<typeof personalContextTransportAssertionSchema>;
export const PERSONAL_CONTEXT_TRANSPORT_SCHEMA_DIGEST = jcsDigest({
  protocol: PERSONAL_CONTEXT_PROTOCOL,
  revision: 1,
  hello: z.toJSONSchema(personalContextTransportHelloSchema),
  assertion: z.toJSONSchema(personalContextTransportAssertionSchema),
  framing: "uint32be-body-length,uint64be-direction-sequence,tag16,ciphertext",
  transcript: "JCS:{domain,anyvia,saydo};domain=personal-context-handshake/1",
  maxFrameBytes: PERSONAL_CONTEXT_MAX_FRAME_BYTES,
  maxHandshakeBytes: PERSONAL_CONTEXT_MAX_HANDSHAKE_BYTES,
  directionFrames: PERSONAL_CONTEXT_DIRECTION_FRAMES,
});
