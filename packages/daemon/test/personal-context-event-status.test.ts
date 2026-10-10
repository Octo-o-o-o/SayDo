import {generateKeyPairSync,randomUUID,sign} from 'node:crypto';
import {test,expect} from 'vitest';
import {PERSONAL_CONTEXT_PROTOCOL,personalContextEffectDigest} from '@saydo/contracts';
import {openFocusFixture} from './helpers/focus-fixture.js';
import {createSqliteAuditSink} from '../src/storage/dao/misc.js';
import {createFocus,changeFocusLifecycle} from '../src/focus/registry.js';
import {startActivation} from '../src/focus/activation.js';
import {captureFocusAuthSnapshot} from '../src/focus/binding.js';
import {PersonalContextRegistry} from '../src/personalContext/registry.js';
import {PersonalContextEvents} from '../src/personalContext/events.js';
import {PersonalContextJournal} from '../src/personalContext/journal.js';
import {peerAssertionBytes} from '../src/personalContext/peerAuthentication.js';
test.each([false,true])('UPGRADE.T10.153 原终态事件状态仍核原证明且后续源推进不复活动作：%s',(advance)=>{
 const f=openFocusFixture();try{
 const audit=createSqliteAuditSink(f.db),pair=generateKeyPairSync('ed25519'),registry=new PersonalContextRegistry(f.db,audit),registered=registry.register({peerInstallationId:randomUUID(),nodeId:randomUUID(),publicKey:pair.publicKey.export({format:'pem',type:'spki'}).toString(),expiresAt:Date.now()+60000}),identity=registry.change({registrationId:registered.registrationId,expectedRevision:1,action:'enable'});
 const {focusId}=createFocus(f.db,{title:'public terminal event'});startActivation(f.db,{focusId,sessionId:f.sessionId,trigger:'user_explicit'});const source=captureFocusAuthSnapshot(f.db,f.sessionId)!;
 const boundary={installationId:identity.installationId,nodeId:identity.nodeId,connectionId:identity.connectionId,connectionEpoch:identity.connectionEpoch,authorityEpoch:1,vaultGeneration:1,restrictionSequence:0},link={spaceId:'unified',caseId:randomUUID(),caseRevision:1,controlGeneration:1,hardConstraintsRevision:1,focusId,focusRevision:source.focusRevision,focusAuthorityEpoch:source.authorityEpoch,focusAnchorRevision:source.focusAnchorRevision,sessionId:f.sessionId},expiresAt=Date.now()+30000;
 const permission=registry.grant({registrationId:identity.registrationId,expectedRegistrationRevision:identity.registrationRevision,method:'event/ingest',link,expiresAt});
 // 登记授权端口是显式软件夹具；源捕获、许可和账本均使用真实生产实现。
 const check=()=>registry.currentPeer(identity),events=new PersonalContextEvents(f.db,audit,{sharesDatabase:db=>db===f.db,assertOwnerRegistration:check,assertOwnerRevocation:check,assertReadCurrent:check});const id=randomUUID();events.register({id,boundary,link,permissionId:permission.permissionId,eventKinds:['lifecycle_changed'],allowFocusEvents:true,expiresAt});
 changeFocusLifecycle(f.db,focusId,{to:'abandoned',reason:'public test',actorKind:'user'});const row=events.page(id,0)[0]!;expect(row.link.focusRevision).toBeGreaterThan(link.focusRevision);
 const unsigned={protocol:PERSONAL_CONTEXT_PROTOCOL,operationId:randomUUID(),method:'event/ingest' as const,...row,expiresAt},effect={...unsigned,payloadDigest:personalContextEffectDigest(unsigned)};
 const challenge=registry.authentication.challenge(identity),handle=registry.authentication.authenticate({nonce:challenge.nonce,operationDigest:effect.payloadDigest,signature:sign(null,peerAssertionBytes(challenge,identity,effect.payloadDigest),pair.privateKey).toString('base64url')});
 const journal=new PersonalContextJournal(f.db,audit,{sharesDatabase:db=>db===f.db,assertEffectCurrent:e=>registry.assertLocalPermission(handle,permission.permissionId,e),assertStatusCurrent:check});expect(journal.admitOutbound(effect).admitted).toBe(true);
 if(advance) changeFocusLifecycle(f.db,focusId,{to:'dormant',reason:'后续真实源版本',actorKind:'user'});
 expect(registry.sessionStatus(identity,{protocol:PERSONAL_CONTEXT_PROTOCOL,method:'operation/status',operationId:effect.operationId,boundary,originalMethod:'event/ingest',payloadDigest:effect.payloadDigest}).state).toBe('unknown');
 expect(()=>f.db.prepare("UPDATE personal_context_operations SET event_source_json=NULL WHERE operation_id=?").run(effect.operationId)).toThrow('personal_context_operation_scope_immutable');
 registry.revokePermission({permissionId:permission.permissionId,expectedRevision:1});
 expect(()=>registry.sessionStatus(identity,{protocol:PERSONAL_CONTEXT_PROTOCOL,method:'operation/status',operationId:effect.operationId,boundary,originalMethod:'event/ingest',payloadDigest:effect.payloadDigest})).toThrow();
 }finally{f.close();}
});
