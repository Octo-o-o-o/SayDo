// 本次独立进程只使用公开合成事件和软件密钥仓；用于实际 kill 后的SQLite耐久性。
import {generateKeyPairSync,randomUUID,createHash} from "node:crypto";
import {jcsDigest} from "@saydo/contracts";
import {openFocusFixture} from "../helpers/focus-fixture.js";
import {createSqliteAuditSink} from "../../src/storage/dao/misc.js";
import {createFocus,changeFocusLifecycle} from "../../src/focus/registry.js";
import {startActivation} from "../../src/focus/activation.js";
import {captureFocusAuthSnapshot} from "../../src/focus/binding.js";
import {PersonalContextRegistry} from "../../src/personalContext/registry.js";
import {PersonalContextEventDelivery} from "../../src/personalContext/eventDelivery.js";
import {PersonalContextKeyCustody} from "../../src/personalContext/keyCustody.js";
function fixture(peerPublicKey?: string) {
  const f = openFocusFixture();
  try {
    const audit = createSqliteAuditSink(f.db), local = generateKeyPairSync("ed25519"), localPublicKey = local.publicKey.export({ format: "pem", type: "spki" }).toString();
    const descriptor = { reference: `saydo-personal-context-test/1/${randomUUID()}`, publicKey: localPublicKey, publicKeyDigest: `sha256:${createHash("sha256").update(local.publicKey.export({format:"der",type:"spki"})).digest("hex")}`, credentialDigest: jcsDigest({ public: "software-key-fixture" }) };
    const keys = new PersonalContextKeyCustody(f.db, audit, { available: true, create(beforeWrite) { beforeWrite(descriptor); return descriptor; }, load() { return local.privateKey; } });
    const registry = new PersonalContextRegistry(f.db, audit, Date.now, keys);
    const pair = generateKeyPairSync("ed25519");
    const registered = registry.register({ peerInstallationId: randomUUID(), nodeId: randomUUID(), publicKey: peerPublicKey ?? pair.publicKey.export({ format: "pem", type: "spki" }).toString(), expiresAt: Date.now() + 60000 });
    keys.provision({operationId:randomUUID(),registrationId:registered.registrationId,expectedRegistrationRevision:1});
    const identity = registry.change({ registrationId: registered.registrationId, expectedRevision: 1, action: "enable" });
    const { focusId } = createFocus(f.db, { title: "公开事件夹具" }); startActivation(f.db, { focusId, sessionId: f.sessionId, trigger: "user_explicit" });
    const source = captureFocusAuthSnapshot(f.db, f.sessionId)!;
    const boundary = { installationId: identity.installationId, nodeId: identity.nodeId, connectionId: identity.connectionId, connectionEpoch: identity.connectionEpoch, authorityEpoch: 1, vaultGeneration: 1, restrictionSequence: 0 };
    const link = { spaceId: "unified", caseId: randomUUID(), caseRevision: 1, controlGeneration: 1, hardConstraintsRevision: 1, focusId, focusRevision: source.focusRevision, focusAuthorityEpoch: source.authorityEpoch, focusAnchorRevision: source.focusAnchorRevision, sessionId: f.sessionId };
    const expiresAt = Date.now() + 30000;
    const permission = registry.grant({ registrationId: identity.registrationId, expectedRegistrationRevision: identity.registrationRevision, method: "event/ingest", link, expiresAt });
    const delivery = new PersonalContextEventDelivery(f.db, audit, registry), mappingId = randomUUID();
    const mapping = { id: mappingId, boundary, link, permissionId: permission.permissionId, expiresAt, eventKinds: ["lifecycle_changed"], allowFocusEvents: true };
    const description = delivery.register({ identity, mapping });
    const query = { method: "event/poll", mappingId, mappingRevision: description.mappingRevision, streamEpoch: description.streamEpoch };
    const event = (to: "abandoned" | "dormant") => changeFocusLifecycle(f.db, focusId, { to, reason: "公开事件", actorKind: "user" });
    const poll = () => delivery.poll(identity, query);
    return { ...f, audit, keys, localPublicKey, registry, identity, permission, delivery, mapping, query, event, poll };
  } catch (error) { f.close(); throw error; }
}

const f=fixture();f.event("abandoned");const result=f.poll();
if(result.kind!=="effect"||result.effect.method!=="event/ingest")throw Error("public_expected_effect");
const ack={...f.query,method:"event/ack",commitSequence:result.effect.payload.commitSequence,operationId:result.effect.operationId,payloadDigest:result.effect.payloadDigest,sourceReceiptDigest:jcsDigest({public:"software-receiver"})};
if(process.argv.includes("--acknowledged"))f.delivery.ack(f.identity,ack);
process.send!({type:"prepared",dbPath:f.dbPath,home:f.home,identity:f.identity,query:f.query,operationId:result.effect.operationId,ack});
// 留住真实数据库写者，父进程明确杀死本次PID；不走正常dispose代替中断。
setInterval(()=>undefined,1000);
