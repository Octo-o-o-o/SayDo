// ===== 来源:4. 目标架构 / 4.12 控制面编译、数据面执行 =====
// 原文档行 25484-25515 (共 32 行)
interface SnapshotDigestEntry {
  readonly key: string;
  readonly identityDigest: string;
  readonly artifactOrReceiptDigest: string;
}

interface ActiveSupplySnapshotCore {
  readonly snapshotVersion: 1;
  readonly compilerVersion: string;
  readonly activationManifest: ReceiptRef;
  readonly revision: number;
  readonly hardStopGeneration: number;
  readonly bindings: readonly SnapshotDigestEntry[];
  readonly endpoints: readonly SnapshotDigestEntry[];
  readonly authStrategies: readonly SnapshotDigestEntry[];
  readonly policyPrograms: readonly SnapshotDigestEntry[];
  readonly authorizationFoldPrograms: readonly SnapshotDigestEntry[];
  readonly fallbackPlanTemplates: readonly SnapshotDigestEntry[];
  readonly adapterArtifacts: readonly SnapshotDigestEntry[];
}

interface ActiveSupplySnapshot {
  readonly core: ActiveSupplySnapshotCore;
  readonly bindings: ReadonlyMap<string, CompiledBinding>;
  readonly endpointHandles: ReadonlyMap<string, EndpointHandle>;
  readonly authHandles: ReadonlyMap<string, AuthHandle>;
  readonly policyPrograms: ReadonlyMap<string, CompiledPolicyProgram>;
  readonly authorizationFoldPrograms: ReadonlyMap<string, CompiledAuthorizationFoldProgram>;
  readonly fallbackPlanTemplates: ReadonlyMap<string, CompiledFallbackPlanTemplate>;
  readonly adapterArtifacts: ReadonlyMap<string, AdapterRuntimeHandle>;
  readonly digest: string; // 只等于 JCS(排序、无重复的 core)；不对 Map/opaque handle 直接取 digest
}
