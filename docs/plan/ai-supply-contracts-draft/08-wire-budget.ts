// ===== 来源:4. 目标架构 / 4.16.3 Wire、归档与宿主总预算 =====
// 原文档行 27514-40143 (共 12630 行)
interface TypeContractCompileBudgetV1 {
  readonly profile: "type-contract-compile-budget-v1";
  readonly nodeMajorVersion: 22;
  readonly nodeProcessArgvPrefix: readonly ["node", "--max-old-space-size=2048"];
  readonly nodeMaxOldSpaceSizeMiB: 2_048;
  readonly nodeMaxOldSpaceSizeFlagMustAppearExactlyOnceBeforeCompilerEntrypoint: true;
  readonly compilerPackage: "typescript";
  readonly compilerVersion: "5.9.3";
  readonly target: "ES2023";
  readonly moduleAndResolution: "NodeNext";
  readonly strict: true;
  readonly exactOptionalPropertyTypes: true;
  readonly noUncheckedIndexedAccess: true;
  readonly skipLibCheck: true;
  readonly maxDiagnostics: 0;
  readonly maxExternalOrInternalAnyStubCount: 0;
  readonly measurementProtocol: "five-isolated-cold-processes-median-wall-max-rss-v1";
  readonly measurementSampleCount: 5;
  readonly maxIntraSampleWallSpreadPermilleOfMedian: 200;
  readonly maxHandwrittenSchemaSourceBytes: 1_048_576;
  readonly maxHandwrittenSchemaSourceLines: 20_000;
  readonly maxContractSourceBytes: 4_194_304;
  readonly maxContractSourceLines: 80_000;
  readonly minimumRemainingSourceCapacityPermille: 300;
  readonly maxTypeInstantiations: 900_000;
  readonly maxResidentSetBytes: 2_684_354_560;
  readonly maxCompileWallMillis: 60_000;
  readonly maxRegressionResidentSetPermilleOfSignedBaseline: 1_150;
  readonly maxRegressionTypeInstantiationsPermilleOfSignedBaseline: 1_150;
  readonly maxRegressionCompileWallPermilleOfSignedBaseline: 1_200;
  readonly maxRegressionContractSourceBytesPermilleOfSignedBaseline: 1_150;
  readonly bothAbsoluteAndSignedBaselineRegressionLimitsMustPass: true;
}

const TYPE_CONTRACT_COMPILE_BUDGET_V1 = {
  profile: "type-contract-compile-budget-v1",
  nodeMajorVersion: 22,
  nodeProcessArgvPrefix: ["node", "--max-old-space-size=2048"],
  nodeMaxOldSpaceSizeMiB: 2_048,
  nodeMaxOldSpaceSizeFlagMustAppearExactlyOnceBeforeCompilerEntrypoint: true,
  compilerPackage: "typescript",
  compilerVersion: "5.9.3",
  target: "ES2023",
  moduleAndResolution: "NodeNext",
  strict: true,
  exactOptionalPropertyTypes: true,
  noUncheckedIndexedAccess: true,
  skipLibCheck: true,
  maxDiagnostics: 0,
  maxExternalOrInternalAnyStubCount: 0,
  measurementProtocol: "five-isolated-cold-processes-median-wall-max-rss-v1",
  measurementSampleCount: 5,
  maxIntraSampleWallSpreadPermilleOfMedian: 200,
  maxHandwrittenSchemaSourceBytes: 1_048_576,
  maxHandwrittenSchemaSourceLines: 20_000,
  maxContractSourceBytes: 4_194_304,
  maxContractSourceLines: 80_000,
  minimumRemainingSourceCapacityPermille: 300,
  maxTypeInstantiations: 900_000,
  maxResidentSetBytes: 2_684_354_560,
  maxCompileWallMillis: 60_000,
  maxRegressionResidentSetPermilleOfSignedBaseline: 1_150,
  maxRegressionTypeInstantiationsPermilleOfSignedBaseline: 1_150,
  maxRegressionCompileWallPermilleOfSignedBaseline: 1_200,
  maxRegressionContractSourceBytesPermilleOfSignedBaseline: 1_150,
  bothAbsoluteAndSignedBaselineRegressionLimitsMustPass: true,
} as const satisfies TypeContractCompileBudgetV1;

declare const typeContractCompileBaselineBrandV10: unique symbol;

interface TypeContractCompileBaselineReceiptV1 extends ReceiptRef<
  "receipt:type-contract-compile-baseline@10",
  readonly [string, string, string]
> {
  readonly [typeContractCompileBaselineBrandV10]: never;
  readonly schemaVersion: "saydo.dev/type-contract-compile-baseline/v1";
  readonly budgetProfile: typeof TYPE_CONTRACT_COMPILE_BUDGET_V1;
  readonly baselineCommitDigest: string;
  readonly contractSourceDigest: string;
  readonly canonicalHandwrittenSchemaSourceDigest: string;
  readonly generatedContractSourceDigest: string;
  readonly compilerPackageLockDigest: string;
  readonly strictCompilerArgvDigest: string;
  readonly runnerImageDigest: string;
  readonly runnerHardwareProfileDigest: string;
  readonly contractSourceBytes: number;
  readonly contractSourceLines: number;
  readonly handwrittenSchemaSourceBytes: number;
  readonly handwrittenSchemaSourceLines: number;
  readonly typeInstantiations: number;
  readonly residentSetBytes: number;
  readonly compileWallMillis: number;
  readonly compileWallSampleMillis: readonly [number, number, number, number, number];
  readonly residentSetSampleBytes: readonly [number, number, number, number, number];
  readonly compileWallMillisIsMedianOfFiveIsolatedColdProcesses: true;
  readonly residentSetBytesIsMaximumOfFiveIsolatedColdProcesses: true;
  readonly intraSampleWallSpreadWithinBudget: true;
  readonly diagnostics: 0;
  readonly externalOrInternalAnyStubCount: 0;
  readonly verifierPolicy: TufTargetAuthorizationReceipt<
    TufRepositoryIdentityReceipt<"policy">,
    `delegated:${string}`,
    `policies/type-contract-baselines/${string}`
  >;
  readonly exactTufTargetLengthAndDigestEqualTheCanonicalBaselineBytes: true;
  readonly replacementWasCommittedOnlyAfterPredecessorGatePassedAndOwnerApproved: true;
}

declare function commitTypeContractCompileBaselineV10(input: {
  readonly canonicalBaselineBytes: ImportedOpaqueEvidenceLeafReceipt;
  readonly verifierPolicy: TufTargetAuthorizationReceipt<
    TufRepositoryIdentityReceipt<"policy">,
    `delegated:${string}`,
    `policies/type-contract-baselines/${string}`
  >;
  readonly predecessorBaseline?: TypeContractCompileBaselineReceiptV1;
  readonly predecessorCompileGate?: TypeContractCompileGateReceiptV1;
  readonly ownerReplacementDecision?: GaOwnerDecisionAttestationReceipt & { readonly decision: "approve" };
  readonly exactCompilerInvocationEvidence: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<TypeContractCompileBaselineReceiptV1>;

declare const typeContractCompileGateBrandV1: unique symbol;
declare const typeContractEnvironmentRelationBrandV9: unique symbol;

type TypeContractCompileEnvironmentRelationReceiptV9<B extends TypeContractCompileBaselineReceiptV1 = TypeContractCompileBaselineReceiptV1> =
  ReceiptRef<"receipt:type-contract-compile-environment-relation@9", B> & {
    readonly [typeContractEnvironmentRelationBrandV9]: never;
    readonly signedBaseline: B;
    readonly currentCompilerVersion: typeof TYPE_CONTRACT_COMPILE_BUDGET_V1.compilerVersion;
    readonly currentCompilerPackageLockDigest: string;
    readonly currentStrictCompilerArgvDigest: string;
    readonly currentRunnerImageDigest: string;
    readonly currentRunnerHardwareProfileDigest: string;
  } & (
    | { readonly relation: "exact_same_environment"; readonly compilerLockArgvRunnerAndHardwareMismatchCount: 0 }
    | {
        readonly relation: "signed_calibrated_replacement";
        readonly ownerReplacementDecision: GaOwnerDecisionAttestationReceipt & { readonly decision: "approve" };
        readonly predecessorBaseline: B;
        readonly oldAndNewEnvironmentOverlapSamples: readonly [ImportedOpaqueEvidenceLeafReceipt, ImportedOpaqueEvidenceLeafReceipt];
        readonly signedConservativeConversionBound: ImportedOpaqueEvidenceLeafReceipt;
        readonly fasterEnvironmentCannotReduceNormalizedRegressionPermille: true;
      }
  );

declare function commitTypeContractCompileEnvironmentRelationV9<
  const B extends TypeContractCompileBaselineReceiptV1,
>(input: {
  readonly signedBaseline: B;
  readonly currentCompilerPackageLockDigest: string; readonly currentStrictCompilerArgvDigest: string;
  readonly currentRunnerImageDigest: string; readonly currentRunnerHardwareProfileDigest: string;
  readonly calibration?: { readonly ownerDecision: GaOwnerDecisionAttestationReceipt & { readonly decision: "approve" }; readonly overlapSamples: readonly [ImportedOpaqueEvidenceLeafReceipt, ImportedOpaqueEvidenceLeafReceipt]; readonly signedConversionBound: ImportedOpaqueEvidenceLeafReceipt };
}): DeepFrozenCommittedReceiptV1<TypeContractCompileEnvironmentRelationReceiptV9<B>>;

type TypeContractCompileGateReceiptV1 = ReceiptRef<"receipt:type-contract-compile-gate@1"> & {
  readonly schemaVersion: "saydo.dev/type-contract-compile-gate/v1";
  readonly budgetProfile: typeof TYPE_CONTRACT_COMPILE_BUDGET_V1;
  readonly signedBaseline: TypeContractCompileBaselineReceiptV1;
  readonly currentContractSourceDigest: string;
  readonly currentCompilerPackageLockDigest: string;
  readonly currentStrictCompilerArgvDigest: string;
  readonly currentRunnerImageDigest: string;
  readonly currentRunnerHardwareProfileDigest: string;
  readonly currentContractSourceBytes: number;
  readonly currentContractSourceLines: number;
  readonly currentTypeInstantiations: number;
  readonly currentResidentSetBytes: number;
  readonly currentCompileWallMillis: number;
  readonly currentCompileWallSampleMillis: readonly [number, number, number, number, number];
  readonly currentResidentSetSampleBytes: readonly [number, number, number, number, number];
  readonly currentCompileWallMillisIsMedianOfFiveIsolatedColdProcesses: true;
  readonly currentResidentSetBytesIsMaximumOfFiveIsolatedColdProcesses: true;
  readonly currentIntraSampleWallSpreadWithinBudget: true;
  readonly currentDiagnostics: 0;
  readonly currentExternalOrInternalAnyStubCount: 0;
  readonly environmentComparability: TypeContractCompileEnvironmentRelationReceiptV9;
  readonly absoluteLimitOutcome: "pass";
  readonly signedBaselineRegressionOutcome: "pass";
  readonly outputExtendedDiagnosticsDigest: string;
  readonly outputResourceUsageDigest: string;
  readonly outputDiagnosticsDigest: string;
  readonly provesEveryMetricWasParsedFromThisExactInvocationAndBothLimitFamiliesPass: true;
  readonly [typeContractCompileGateBrandV1]: "type_contract_compile_gate_runner";
};

declare function commitTypeContractCompileGateV1(input: {
  readonly budgetProfile: typeof TYPE_CONTRACT_COMPILE_BUDGET_V1;
  readonly signedBaseline: TypeContractCompileBaselineReceiptV1;
  readonly contractSourceDigest: string;
  readonly compilerPackageLockDigest: string;
  readonly runnerImageDigest: string;
  readonly runnerHardwareProfileDigest: string;
  readonly strictCompilerArgv: readonly string[];
  readonly environmentComparability: TypeContractCompileEnvironmentRelationReceiptV9;
  readonly extendedDiagnosticsOutput: ImportedOpaqueEvidenceLeafReceipt;
  readonly resourceUsageOutput: ImportedOpaqueEvidenceLeafReceipt;
  readonly diagnosticsOutput: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<TypeContractCompileGateReceiptV1>;

interface WireBudgetProfileV1 {
  readonly profile: "wire-budget-v1";
  readonly maxInlineFrameBytes: 1_048_576;
  readonly maxContentHandleBytes: 33_554_432;
  readonly maxContentChunkBytes: 262_144;
  readonly maxDecodedRequestBytes: 33_554_432;
  readonly maxResponseHeaderBytes: 65_536;
  readonly maxDecodedEventBytes: 2_097_152;
  readonly maxUnfinishedToolArgumentBytes: 4_194_304;
  readonly maxMetadataAndOpaqueExtensionBytes: 1_048_576;
  readonly maxDecodedResponseBytes: 67_108_864;
  readonly maxCompressionExpansionRatio: 20;
  readonly maxUnconsumedStreamBufferBytes: 524_288;
  readonly maxCumulativeStreamBytes: 67_108_864;
  readonly maxJsonDepth: 64;
  readonly maxJsonNodes: 200_000;
  readonly maxObjectProperties: 50_000;
  readonly maxArrayElements: 100_000;
  readonly maxSchemaNodes: 100_000;
  readonly maxSchemaDepth: 32;
  readonly maxSchemaProperties: 50_000;
  readonly maxSchemaRefs: 512;
  readonly maxEventsPerResponse: 100_000;
  readonly maxOccurrencesPerDirection: 8_192;
  readonly maxRegexUtf8Bytes: 4_096;
  readonly maxRegexSteps: 1_000_000;
  readonly maxSynchronousCpuMillis: 4;
  readonly forceWorkerAtEventBytes: 262_144;
  readonly maxCpuMillisPerMessage: 250;
  readonly maxCpuMillisPerStream: 2_000;
  readonly maxWallMillisPerStream: 120_000;
}

interface HostWorkerBudgetProfileV1 {
  readonly profile: "host-worker-budget-v1";
  readonly maxParserWorkers: 4;
  readonly coreDetectorReservedWorkerSlots: 2;
  readonly pluginDispatchPoolWorkerSlots: 2;
  readonly coreDetectorReservedQueuePermille: 500;
  readonly pluginCannotBorrowCoreReservedCapacity: true;
  readonly maxActiveCodePlugins: 4;
  readonly maxPluginProcessTreeMembers: 8;
  readonly maxQueuedJobs: 128;
  readonly maxAggregateRssBytes: 805_306_368;
  readonly maxAggregateCpuLogicalCores: 2;
  readonly maxAggregateQueueBytes: 33_554_432;
  readonly maxPreparedAttempts: 32;
  readonly maxOpenContentHandles: 64;
  readonly maxContentHandlesPerPublisher: 16;
  readonly maxContentHandlesPerSession: 16;
  readonly maxContentHandlesPerAttempt: 4;
  readonly maxAggregateContentHandleBytes: 268_435_456;
  readonly maxAggregateResidentContentBytes: 67_108_864;
  readonly maxAggregateSpooledContentBytes: 268_435_456;
  readonly maxContentSpoolTemporaryBytes: 268_435_456;
  readonly maxContentHandleLifetimeMillis: 120_000;
  readonly maxOrphanHandleCleanupMillisAfterRecovery: 30_000;
  readonly maxActivePluginsPerPublisher: 2;
  readonly maxQueuedJobsPerPublisher: 64;
  readonly maxQueuedBytesPerPublisher: 16_777_216;
  readonly maxPreparedAttemptsPerPublisher: 16;
  readonly maxRssBytesPerPublisher: 402_653_184;
  readonly maxCpuLogicalCoresPerPublisher: 1;
  readonly maxProcessTreeMembersPerPublisher: 4;
  readonly maxWorkerSlotsPerPublisher: 2;
  readonly dedicatedWorkerSlotsPerPublisher: 0;
  readonly maximumReferenceGuaranteedEligibleDebtGroups: 4;
  readonly minimumContinuouslyEligibleDebtGroupLongRunSharePermilleOfPluginPool: 250;
  readonly publisherFairScheduler: "bounded-service-deficit-round-robin-v2";
  readonly publisherFairSchedulingProfile: PublisherFairSchedulingProfileV1;
  readonly publisherFairSchedulingConformance: PublisherFairSchedulerConformanceReceiptV1;
  readonly overloadBackoffProfileDigest: string;
  readonly unhealthyPublisherPreemptionPolicyDigest: string;
  readonly healthyRunningPluginPreemptionForbidden: true;
  readonly publisherQuotaStatePersistsAcrossDaemonRestart: true;
}

interface VerifiedPublisherSignerChainReceipt extends ReceiptRef {
  readonly registrySourceDigest: string;
  readonly publisherArtifactDigest: string;
  readonly orderedSignerCertificateOrKeyEvidence: NonEmptyReadonly<ImportedOpaqueEvidenceLeafReceipt>;
  readonly canonicalSignerRealmDigest: string;
  readonly chainTrustRootDigest: string;
  readonly verifiesArtifactToCanonicalSignerRealm: true;
}

declare const publisherFairIdentityNormalizationBrand: unique symbol;

interface PublisherFairIdentityNormalizationReceipt extends ReceiptRef {
  readonly registrySourceDigest: string;
  readonly verifiedSignerChain: VerifiedPublisherSignerChainReceipt;
  readonly canonicalSigningRealmDigest: string;
  readonly signerRealmAdmissionAndDebtGroupDigest: string;
  readonly normalizationAlgorithm: "registry-source-plus-canonical-verified-signer-realm-v1";
  readonly normalizationAlgorithmArtifactDigest: string;
  readonly provesGroupDigestIsUniqueFunctionOfRegistrySourceAndCanonicalSignerRealm: true;
  readonly [publisherFairIdentityNormalizationBrand]: "independent_identity_normalizer";
}

interface PublisherFairIdentityV1<
  N extends PublisherFairIdentityNormalizationReceipt = PublisherFairIdentityNormalizationReceipt,
> extends ReceiptRef<"receipt:publisher-fair-identity@1", N> {
  readonly normalization: N;
  readonly registrySourceDigest: string;
  readonly signingRealmDigest: N["canonicalSigningRealmDigest"];
  readonly publisherId: string;
  readonly stablePublisherIdentityDigest: string;
  readonly signerRealmAdmissionAndDebtGroupDigest: N["signerRealmAdmissionAndDebtGroupDigest"];
  readonly publisherIdIsAnAliasWithinSignerRealmAdmissionAndDebtGroup: true;
}

declare function normalizePublisherFairIdentityV1<
  const C extends VerifiedPublisherSignerChainReceipt,
>(input: {
  readonly registrySourceDigest: string;
  readonly verifiedSignerChain: C;
  readonly publisherId: string;
}): PublisherFairIdentityV1<
  PublisherFairIdentityNormalizationReceipt & {
    readonly verifiedSignerChain: C;
    readonly canonicalSigningRealmDigest: C["canonicalSignerRealmDigest"];
  }
>;

interface PublisherFairServiceCurveArithmeticV1 {
  readonly arithmetic: "signed-integer-twelfths-of-worker-millisecond-v1";
  readonly debtScaleTwelfthsPerWorkerMillis: 12;
  readonly idealShareUnitsByEligibleCount: readonly [
    { readonly eligibleCount: 1; readonly idealAccrualTwelfthsPerPoolWorkerMillis: 12 },
    { readonly eligibleCount: 2; readonly idealAccrualTwelfthsPerPoolWorkerMillis: 6 },
    { readonly eligibleCount: 3; readonly idealAccrualTwelfthsPerPoolWorkerMillis: 4 },
    { readonly eligibleCount: 4; readonly idealAccrualTwelfthsPerPoolWorkerMillis: 3 }
  ];
  readonly intervalPoolServiceDefinition:
    "sum-of-actual-occupied-plugin-slot-monotonic-milliseconds-within-half-open-interval";
  readonly debtGroupActualServiceDefinition:
    "sum-of-all-aliases-in-that-signer-realm-debt-group-actual-occupied-plugin-slot-monotonic-milliseconds-within-same-interval";
  readonly rawDebtRecurrence:
    "priorDebtTwelfths+poolServiceWorkerMillis*idealShareUnits-currentPublisherServiceWorkerMillis*12";
  readonly resultDebtRecurrence:
    "clamp(rawDebtTwelfths,-2880120,2880120)";
  readonly minimumDebtTwelfths: -2_880_120;
  readonly maximumDebtTwelfths: 2_880_120;
  readonly normalizedDebtRounding: "signed-truncate-toward-zero-v1";
  readonly normalizedDebtFormula: "sign(x)*floor(abs(x)/12)";
  readonly normalizedDebtGoldenVectors: readonly [
    { readonly inputTwelfths: -13; readonly outputWorkerMillis: -1 },
    { readonly inputTwelfths: -12; readonly outputWorkerMillis: -1 },
    { readonly inputTwelfths: -11; readonly outputWorkerMillis: 0 },
    { readonly inputTwelfths: -10; readonly outputWorkerMillis: 0 },
    { readonly inputTwelfths: -9; readonly outputWorkerMillis: 0 },
    { readonly inputTwelfths: -8; readonly outputWorkerMillis: 0 },
    { readonly inputTwelfths: -7; readonly outputWorkerMillis: 0 },
    { readonly inputTwelfths: -6; readonly outputWorkerMillis: 0 },
    { readonly inputTwelfths: -5; readonly outputWorkerMillis: 0 },
    { readonly inputTwelfths: -4; readonly outputWorkerMillis: 0 },
    { readonly inputTwelfths: -3; readonly outputWorkerMillis: 0 },
    { readonly inputTwelfths: -2; readonly outputWorkerMillis: 0 },
    { readonly inputTwelfths: -1; readonly outputWorkerMillis: 0 },
    { readonly inputTwelfths: 0; readonly outputWorkerMillis: 0 },
    { readonly inputTwelfths: 1; readonly outputWorkerMillis: 0 },
    { readonly inputTwelfths: 2; readonly outputWorkerMillis: 0 },
    { readonly inputTwelfths: 3; readonly outputWorkerMillis: 0 },
    { readonly inputTwelfths: 4; readonly outputWorkerMillis: 0 },
    { readonly inputTwelfths: 5; readonly outputWorkerMillis: 0 },
    { readonly inputTwelfths: 6; readonly outputWorkerMillis: 0 },
    { readonly inputTwelfths: 7; readonly outputWorkerMillis: 0 },
    { readonly inputTwelfths: 8; readonly outputWorkerMillis: 0 },
    { readonly inputTwelfths: 9; readonly outputWorkerMillis: 0 },
    { readonly inputTwelfths: 10; readonly outputWorkerMillis: 0 },
    { readonly inputTwelfths: 11; readonly outputWorkerMillis: 0 },
    { readonly inputTwelfths: 12; readonly outputWorkerMillis: 1 },
    { readonly inputTwelfths: 13; readonly outputWorkerMillis: 1 }
  ];
  readonly idlePoolServiceProducesZeroIdealAccrual: true;
  readonly eligibilityChangesSplitAccountingIntervalBeforeRecurrence: true;
  readonly completedActualServiceNeverUsesDispatchCountOrEstimatedDuration: true;
}

interface PublisherFairDebtGroupStateV2 {
  readonly signerRealmAdmissionAndDebtGroupDigest: string;
  readonly orderedActivePublisherAliasIdentityDigests: readonly string[];
  readonly orderedWaitingPublisherAliasIdentityDigests: readonly string[];
  readonly eligibilityEpoch: number;
  readonly eligibilityBeganAtMonotonicMillis: number;
  readonly cohortState: "reference_active" | "overload_active" | "overload_waiting" | "not_eligible";
  readonly cohortAdmissionOrdinal: number | null;
  readonly accumulatedActualServiceWorkerMillis: number;
  readonly serviceDebtTwelfths: number;
  readonly outstandingDispatchReservationTwelfths: number;
  readonly lastDispatchStartedAtMonotonicMillis: number | null;
  readonly lastTerminalAtMonotonicMillis: number | null;
  readonly stableGroupStateDigest: string;
  readonly provesAllAliasesShareOneAdmissionDebtReservationAndEligibilityEpoch: true;
}

interface PublisherFairPublisherStateV1 {
  readonly identity: PublisherFairIdentityV1;
  readonly continuouslyEligible: boolean;
  readonly debtGroupStateDigest: string;
  readonly aliasesCannotOwnIndependentCreditDebtReservationOrAdmissionOrdinal: true;
  readonly stableStateDigest: string;
}

type PublisherFairSchedulerStateReceiptV1 = ReceiptRef & {
  readonly schemaVersion: "saydo.dev/publisher-fair-scheduler-state/v1";
  readonly profileDigest: string;
  readonly stateRevision: number;
  readonly monotonicClockBootIdDigest: string;
  readonly accountedThroughMonotonicMillis: number;
  readonly pluginPoolSlotCount: 2;
  readonly orderedPublisherStates: readonly PublisherFairPublisherStateV1[];
  readonly orderedDebtGroupStates: readonly PublisherFairDebtGroupStateV2[];
  readonly orderedUniqueStablePublisherIdentityDigests: readonly string[];
  readonly orderedUniqueSignerRealmAdmissionAndDebtGroupDigests: readonly string[];
  readonly activeCohortIdentityDigests: readonly string[];
  readonly overloadWaitingIdentityDigests: readonly string[];
  readonly lastCohortRotationAtMonotonicMillis: number | null;
  readonly nextCohortAdmissionOrdinal: number;
  readonly persistedStateDigest: string;
  readonly provesAliasAndGroupOrderUniquenessCohortPartitionSingleDebtOwnershipAndDebtBounds: true;
} &
  (
    | {
        readonly stateCause: "initialized";
        readonly predecessorState?: never;
        readonly appliedTransitionDigest?: never;
        readonly stateRevision: 0;
      }
    | {
        readonly stateCause: "accounting" | "dispatch" | "eligibility" | "cohort_rotation" | "restart_restore";
        readonly predecessorState: PublisherFairSchedulerStateReceiptV1;
        readonly appliedTransitionDigest: string;
        readonly provesRevisionIncrementsExactlyOnceAndStateDigestMatchesTransitionOutput: true;
      }
  );

type PublisherFairCohortCountTupleV1 =
  | {
      readonly trackedEligibleGroupCountForWholeInterval: 0;
      readonly activeReferenceCohortGroupCountForWholeInterval: 0;
      readonly overloadWaitingGroupCountForWholeInterval: 0;
    }
  | {
      readonly trackedEligibleGroupCountForWholeInterval: 1;
      readonly activeReferenceCohortGroupCountForWholeInterval: 1;
      readonly overloadWaitingGroupCountForWholeInterval: 0;
    }
  | {
      readonly trackedEligibleGroupCountForWholeInterval: 2;
      readonly activeReferenceCohortGroupCountForWholeInterval: 2;
      readonly overloadWaitingGroupCountForWholeInterval: 0;
    }
  | {
      readonly trackedEligibleGroupCountForWholeInterval: 3;
      readonly activeReferenceCohortGroupCountForWholeInterval: 3;
      readonly overloadWaitingGroupCountForWholeInterval: 0;
    }
  | {
      readonly trackedEligibleGroupCountForWholeInterval: 4;
      readonly activeReferenceCohortGroupCountForWholeInterval: 4;
      readonly overloadWaitingGroupCountForWholeInterval: 0;
    }
  | {
      readonly trackedEligibleGroupCountForWholeInterval: 5;
      readonly activeReferenceCohortGroupCountForWholeInterval: 4;
      readonly overloadWaitingGroupCountForWholeInterval: 1;
    }
  | {
      readonly trackedEligibleGroupCountForWholeInterval: 6;
      readonly activeReferenceCohortGroupCountForWholeInterval: 4;
      readonly overloadWaitingGroupCountForWholeInterval: 2;
    }
  | {
      readonly trackedEligibleGroupCountForWholeInterval: 7;
      readonly activeReferenceCohortGroupCountForWholeInterval: 4;
      readonly overloadWaitingGroupCountForWholeInterval: 3;
    }
  | {
      readonly trackedEligibleGroupCountForWholeInterval: 8;
      readonly activeReferenceCohortGroupCountForWholeInterval: 4;
      readonly overloadWaitingGroupCountForWholeInterval: 4;
    };

type PublisherFairNonEmptyCohortCountTupleV1 = Exclude<
  PublisherFairCohortCountTupleV1,
  { readonly trackedEligibleGroupCountForWholeInterval: 0 }
>;

type PublisherFairActiveShareUnitsForTupleV1<C extends PublisherFairNonEmptyCohortCountTupleV1> =
  C["activeReferenceCohortGroupCountForWholeInterval"] extends 1
    ? 12
    : C["activeReferenceCohortGroupCountForWholeInterval"] extends 2
      ? 6
      : C["activeReferenceCohortGroupCountForWholeInterval"] extends 3
        ? 4
        : 3;

type PublisherFairAccountingLineV1<
  C extends PublisherFairNonEmptyCohortCountTupleV1 = PublisherFairNonEmptyCohortCountTupleV1,
> = C extends PublisherFairNonEmptyCohortCountTupleV1
  ? C & {
  readonly signerRealmAdmissionAndDebtGroupDigest: string;
  readonly orderedPublisherAliasIdentityDigests: NonEmptyReadonly<string>;
  readonly wasContinuouslyEligibleForWholeInterval: true;
  readonly priorDebtTwelfths: number;
  readonly intervalPoolServiceWorkerMillis: number;
  readonly rawResultDebtTwelfths: number;
  readonly clampedResultDebtTwelfths: number;
  readonly provesTrackedCountEqualsActivePlusWaitingAndAllCountsMatchExactStateSets: true;
  readonly overloadWaitingGroupsAccrueZeroIdealShareUntilActiveCohortAdmission: true;
  readonly provesIdealAccrualActualDebitRawRecurrenceAndClampRecomputeExactly: true;
} &
      (
        | {
            readonly groupCohortStateForWholeInterval: "active";
            readonly idealShareUnits: PublisherFairActiveShareUnitsForTupleV1<C>;
            readonly idealAccrualTwelfths: number;
            readonly actualServiceWorkerMillis: number;
            readonly actualServiceDebitTwelfths: number;
          }
        | (C extends { readonly overloadWaitingGroupCountForWholeInterval: 0 }
            ? never
            : {
                readonly groupCohortStateForWholeInterval: "waiting";
                readonly idealShareUnits: 0;
                readonly idealAccrualTwelfths: 0;
                readonly actualServiceWorkerMillis: 0;
                readonly actualServiceDebitTwelfths: 0;
              })
      )
  : never;

type PublisherFairAccountingStepReceiptV1<
  C extends PublisherFairCohortCountTupleV1 = PublisherFairCohortCountTupleV1,
> = C extends PublisherFairCohortCountTupleV1
  ? ReceiptRef & C & {
  readonly schemaVersion: "saydo.dev/publisher-fair-accounting-step/v1";
  readonly profileDigest: string;
  readonly predecessorState: PublisherFairSchedulerStateReceiptV1;
  readonly intervalStartedAtMonotonicMillis: number;
  readonly intervalEndedAtMonotonicMillis: number;
  readonly completeOccupiedOccurrenceSetDigest: string;
  readonly completeEligibilityEventSetDigest: string;
  readonly intervalPoolServiceWorkerMillis: number;
  readonly orderedAccountingLines: C extends { readonly trackedEligibleGroupCountForWholeInterval: 0 }
    ? readonly []
    : NonEmptyReadonly<PublisherFairAccountingLineV1<Extract<C, PublisherFairNonEmptyCohortCountTupleV1>>>;
  readonly resultingState: PublisherFairSchedulerStateReceiptV1;
  readonly deterministicEvaluatorTranscriptDigest: string;
  readonly provesIntervalWasSplitAtEveryEligibilityBoundary: true;
  readonly provesLinesExactlyCoverPredecessorDebtGroupsAndAllArithmeticReplays: true;
  readonly provesTrackedCountEqualsActivePlusWaitingAndAllCountsMatchExactStateSets: true;
  readonly provesIdealShareUsesOnlyActiveReferenceCohortCountAndWaitingGroupsAccrueZero: true;
  readonly provesResultingStateChangesOnlyAccountedServiceAndDebt: true;
}
  : never;

interface PublisherFairDispatchCandidateV1 {
  readonly signerRealmAdmissionAndDebtGroupDigest: string;
  readonly orderedEligiblePublisherAliasIdentities: NonEmptyReadonly<PublisherFairIdentityV1>;
  readonly oldestRunnablePublisherAliasIdentity: PublisherFairIdentityV1;
  readonly continuouslyEligibleDebtGroup: true;
  readonly atLeastOneRunnableBackloggedAlias: true;
  readonly withinAllQuotas: true;
  readonly activeCohortMember: true;
  readonly groupServiceDebtTwelfths: number;
  readonly groupOutstandingDispatchReservationTwelfths: number;
  readonly selectionScoreTwelfths: number;
  readonly groupEligibilityEpoch: number;
  readonly stableDebtGroupIdentityDigest: string;
  readonly provesCandidateSetHasExactlyOneCandidatePerDebtGroupAndAliasesHaveNoIndependentScore: true;
  readonly provesOldestRunnableAliasIsSelectedByQueueOrdinalThenStablePublisherIdentity: true;
  readonly provesSelectionScoreEqualsGroupDebtMinusGroupOutstandingReservation: true;
}

interface PublisherFairDispatchDecisionReceiptV1 extends ReceiptRef {
  readonly schemaVersion: "saydo.dev/publisher-fair-dispatch-decision/v1";
  readonly profileDigest: string;
  readonly predecessorState: PublisherFairSchedulerStateReceiptV1;
  readonly decisionAtMonotonicMillis: number;
  readonly idlePluginSlotId: "plugin-slot-0" | "plugin-slot-1";
  readonly completeOrderedCandidateSet: NonEmptyReadonly<PublisherFairDispatchCandidateV1>;
  readonly selectedCandidate: PublisherFairDispatchCandidateV1;
  readonly selectedJobDigest: string;
  readonly selectedJobQueueOrdinal: number;
  readonly estimatedCostMillis: 10 | 250 | 2_000 | 120_000;
  readonly resultingReservationTwelfths: number;
  readonly resultingState: PublisherFairSchedulerStateReceiptV1;
  readonly provesCandidateOrderIsScoreDescendingThenGroupEligibilityEpochAscendingThenStableGroupIdentityAscending: true;
  readonly provesSelectedCandidateIsFirstAndJobIsOldestRunnableAcrossEveryAliasInTheSelectedDebtGroup: true;
  readonly provesReservationAddsEstimateTimesTwelveExactlyOnce: true;
}

interface PublisherFairJobTerminalAccountingReceiptV1 extends ReceiptRef {
  readonly dispatchDecision: PublisherFairDispatchDecisionReceiptV1;
  readonly actualOccupiedWorkerMillis: number;
  readonly completeAccountingSteps: NonEmptyReadonly<PublisherFairAccountingStepReceiptV1>;
  readonly terminalAtMonotonicMillis: number;
  readonly resultingState: PublisherFairSchedulerStateReceiptV1;
  readonly provesEstimateReservationIsRemovedExactlyOnceAndActualServiceWasChargedOnlyByAccountingSteps: true;
}

interface PublisherFairOverloadAdmissionLineV1 {
  readonly signerRealmAdmissionAndDebtGroupDigest: string;
  readonly orderedPublisherAliasIdentities: NonEmptyReadonly<PublisherFairIdentityV1>;
  readonly waitingBeganAtMonotonicMillis: number;
  readonly admittedToActiveCohortAtMonotonicMillis: number;
  readonly admissionWaitMillis: number;
  readonly admissionWaitAtMost600000Millis: true;
  readonly provesWaitEqualsAdmissionTimeMinusWaitingTime: true;
  readonly provesAdmissionOccursOncePerDebtGroupRegardlessOfAliasCount: true;
}

interface PublisherFairCohortRotationReceiptV1 extends ReceiptRef {
  readonly schemaVersion: "saydo.dev/publisher-fair-cohort-rotation/v1";
  readonly profileDigest: string;
  readonly predecessorState: PublisherFairSchedulerStateReceiptV1;
  readonly triggeringJobTerminal: PublisherFairJobTerminalAccountingReceiptV1;
  readonly rotationAtMonotonicMillis: number;
  readonly completeEligibleDebtGroupIdentityRingBeforeRotation: NonEmptyReadonly<string>;
  readonly priorRingHeadOrdinal: number;
  readonly nextRingHeadOrdinal: number;
  readonly resultingActiveCohortIdentityDigests: NonEmptyReadonly<string>;
  readonly resultingWaitingIdentityDigests: readonly string[];
  readonly admittedWaitingDebtGroups: readonly PublisherFairOverloadAdmissionLineV1[];
  readonly resultingState: PublisherFairSchedulerStateReceiptV1;
  readonly provesRingIsOrderedByAdmissionOrdinalThenStableDebtGroupIdentityAndHeadAdvancesOneCohort: true;
  readonly provesRotationOccursAtJobTerminalAndOnlyAfterRotationInterval: true;
  readonly provesNoRunningHealthyJobWasPreempted: true;
}

interface PublisherFairCapacityUnavailableReceiptV1 extends ReceiptRef {
  readonly schemaVersion: "saydo.dev/publisher-fair-capacity-unavailable/v1";
  readonly profileDigest: string;
  readonly schedulerState: PublisherFairSchedulerStateReceiptV1;
  readonly rejectedSignerRealmAdmissionAndDebtGroupDigest: string;
  readonly orderedRejectedPublisherAliasIdentities: NonEmptyReadonly<PublisherFairIdentityV1>;
  readonly eligibleTrackedDebtGroupCountBeforeAdmission: 8;
  readonly disposition: "immediate_capacity_unavailable";
  readonly enteredWaitingCohort: false;
  readonly referenceShareOrDispatchPromiseIssued: false;
  readonly provesCompleteTrackedIdentitySetHasEightUniqueAdmissionAndDebtGroups: true;
  readonly provesAddingAnAliasToAnExistingDebtGroupDoesNotConsumeANinthGroupAdmission: true;
}

type PublisherFairReferenceShareTupleV1 =
  | { readonly continuouslyEligibleDebtGroupCount: 1; readonly idealShareUnits: 12 }
  | { readonly continuouslyEligibleDebtGroupCount: 2; readonly idealShareUnits: 6 }
  | { readonly continuouslyEligibleDebtGroupCount: 3; readonly idealShareUnits: 4 }
  | { readonly continuouslyEligibleDebtGroupCount: 4; readonly idealShareUnits: 3 };

type PublisherFairServiceCurveWindowReceiptV1 = ReceiptRef &
  PublisherFairReferenceShareTupleV1 & {
  readonly schemaVersion: "saydo.dev/publisher-fair-service-curve-window/v1";
  readonly profileDigest: string;
  readonly signerRealmAdmissionAndDebtGroupDigest: string;
  readonly orderedPublisherAliasIdentityDigests: NonEmptyReadonly<string>;
  readonly windowStartedAtMonotonicMillis: number;
  readonly windowEndedAtMonotonicMillis: number;
  readonly completeAccountingSteps: NonEmptyReadonly<PublisherFairAccountingStepReceiptV1>;
  readonly poolServiceWorkerMillis: number;
  readonly debtGroupActualServiceWorkerMillis: number;
  readonly scaledIdealServiceTwelfths: number;
  readonly scaledActualServiceTwelfths: number;
  readonly permittedBoundaryDebtTwelfths: 2_880_120;
  readonly dispatchStartLagMillis: number;
  readonly serviceCurveInequalitySatisfied: true;
  readonly dispatchStartLagAtMost240000Millis: true;
  readonly provesWindowContainsNoEligibilityBoundaryAndMetricsReplayFromSteps: true;
  readonly provesWindowServiceAndDispatchLagAggregateEveryAliasExactlyOnceAtDebtGroupScope: true;
};

interface PublisherFairSchedulerRestartRestoreReceiptV1 extends ReceiptRef {
  readonly schemaVersion: "saydo.dev/publisher-fair-scheduler-restart-restore/v1";
  readonly persistedPreRestartState: PublisherFairSchedulerStateReceiptV1;
  readonly persistedStateDigest: string;
  readonly daemonRestartReceiptDigest: string;
  readonly restoredMonotonicClockMappingDigest: string;
  readonly restoredState: PublisherFairSchedulerStateReceiptV1;
  readonly provesIdentityEligibilityEpochDebtReservationCohortAndAdmissionOrdinalArePreserved: true;
  readonly provesDowntimeCreatesNoServiceCreditAndNoBudgetReset: true;
}

interface PublisherFairSchedulerConformanceReceiptV1 extends ReceiptRef {
  readonly schemaVersion: "saydo.dev/publisher-fair-scheduler-conformance/v1";
  readonly profileDigest: string;
  readonly schedulerImplementationArtifactDigest: string;
  readonly deterministicReferenceEvaluatorArtifactDigest: string;
  readonly deterministicTraceCorpusDigest: string;
  readonly verifiedIdentityNormalizations: NonEmptyReadonly<PublisherFairIdentityNormalizationReceipt>;
  readonly accountingSteps: NonEmptyReadonly<PublisherFairAccountingStepReceiptV1>;
  readonly dispatchDecisions: NonEmptyReadonly<PublisherFairDispatchDecisionReceiptV1>;
  readonly serviceCurveWindows: NonEmptyReadonly<PublisherFairServiceCurveWindowReceiptV1>;
  readonly cohortRotations: NonEmptyReadonly<PublisherFairCohortRotationReceiptV1>;
  readonly overloadAdmissionLines: NonEmptyReadonly<PublisherFairOverloadAdmissionLineV1>;
  readonly capacityUnavailableReceipts: NonEmptyReadonly<PublisherFairCapacityUnavailableReceiptV1>;
  readonly restartRestores: NonEmptyReadonly<PublisherFairSchedulerRestartRestoreReceiptV1>;
  readonly requiredMutationFixtureKinds: readonly [
    "idle_credit_injection",
    "dispatch_count_instead_of_worker_time",
    "rounding_drift",
    "fifth_debt_group_claims_reference_share",
    "rotation_without_terminal",
    "healthy_job_preemption",
    "restart_debt_reset",
    "signer_realm_identity_churn",
    "same_signer_realm_dual_alias_double_candidate_or_credit",
    "unverified_signer_chain_or_cross_registry_realm_alias",
    "publisher_display_id_churn_changes_debt_group",
    "same_display_id_under_different_verified_signer_realms_merged",
    "fifth_to_eighth_debt_group_full_accounting_trace",
    "candidate_omission",
    "tie_break_nondeterminism"
  ];
  readonly executedMutationFixtureKinds: readonly [
    "idle_credit_injection",
    "dispatch_count_instead_of_worker_time",
    "rounding_drift",
    "fifth_debt_group_claims_reference_share",
    "rotation_without_terminal",
    "healthy_job_preemption",
    "restart_debt_reset",
    "signer_realm_identity_churn",
    "same_signer_realm_dual_alias_double_candidate_or_credit",
    "unverified_signer_chain_or_cross_registry_realm_alias",
    "publisher_display_id_churn_changes_debt_group",
    "same_display_id_under_different_verified_signer_realms_merged",
    "fifth_to_eighth_debt_group_full_accounting_trace",
    "candidate_omission",
    "tie_break_nondeterminism"
  ];
  readonly deterministicReplayTranscriptDigest: string;
  readonly deterministicReplayExitCode: 0;
  readonly everyRequiredMutationWasRejected: true;
  readonly implementationAndReferenceEvaluatorStateAndDecisionDigestsExactlyEqual: true;
  readonly provesEveryCandidateDebtReservationCohortAndServiceLineUsesTheExactVerifiedNormalizationGroup: true;
  readonly provesEveryOverloadAdmissionLineReplaysFromCohortRotationsAndEveryNinthDebtGroupAdmissionIsImmediatelyRejected: true;
}

interface PublisherFairSchedulingProfileV1 {
  readonly profile: "publisher-fair-scheduling-v1";
  readonly capacityDomain: "plugin-dispatch-pool-only";
  readonly chargedServiceUnit: "occupied-worker-millisecond";
  readonly dispatchCostEstimateClampedMillis: 10 | 250 | 2_000 | 120_000;
  readonly continuouslyEligiblePredicate:
    "healthy-and-runnable-and-backlogged-and-within-all-quotas-for-entire-measurement-interval";
  readonly schedulerDecisionPoint:
    "plugin-worker-became-idle-or-job-terminal-or-eligibility-changed";
  readonly maximumNonPreemptibleJobMillis: 120_000;
  readonly accountingQuantumMillis: 10;
  readonly maximumReferenceGuaranteedEligibleDebtGroups: 4;
  readonly minimumLongRunSharePermilleForFourEligibleDebtGroups: 250;
  readonly maximumDispatchStartLagMillisForReferenceGuaranteedSet: 240_000;
  readonly maximumNormalizedServiceDebtWorkerMillis: 240_010;
  readonly serviceCurveArithmetic: PublisherFairServiceCurveArithmeticV1;
  readonly serviceCurveWindowEvidence: "publisher-fair-service-curve-window-v1";
  readonly boundaryDebtUpperBoundWorkerMillis: 240_010;
  readonly idlePublisherAccruesPositiveCredit: false;
  readonly newlyEligibleInitialCreditWorkerMillis: 10;
  readonly completedJobActualServiceClearsSelectionReservationAndAccountingUsesOnlyActualOccupiedTime: true;
  readonly dispatchSelectionScore: "service-debt-twelfths-minus-outstanding-reservation-twelfths";
  readonly deterministicTieBreak: readonly [
    "selection-score-descending",
    "eligibility-epoch-ascending",
    "stable-debt-group-identity-ascending"
  ];
  readonly fairnessIdentity:
    "signer-realm-admission-and-debt-group-authoritative-publisher-id-alias-only";
  readonly identityChurnSharesExactlyOneSignerRealmAdmissionDebtReservationAndEligibilityEpoch: true;
  readonly debtAndEligibilityEpochPersistAcrossDaemonRestart: true;
  readonly runningHealthyJobIsNeverPreempted: true;
  readonly overloadPolicy: "bounded-cohort-rotation-v1";
  readonly overloadStartsAtEligibleDebtGroupCount: 5;
  readonly overloadCohortSize: 4;
  readonly overloadMaximumTrackedEligibleDebtGroups: 8;
  readonly debtGroupsBeyondTrackedLimitDisposition: "immediate-capacity-unavailable-no-wait-or-share-promise";
  readonly overloadCohortRotationMillis: 480_000;
  readonly overloadMaximumAdmissionWaitMillis: 600_000;
  readonly overloadAdmissionWaitMeansEntryIntoActiveCohortNotDispatchStart: true;
  readonly overloadWaitingDebtGroupAccruesReferenceShareBeforeAdmission: false;
  readonly overloadBackoffMillis: readonly [1_000, 2_000, 4_000, 8_000, 16_000, 30_000];
  readonly overloadRotationOccursOnlyAtJobTerminal: true;
  readonly overloadDoesNotPromiseReferenceSharePermille: true;
  readonly referenceEvaluatorArtifactDigest: string;
  readonly requiredConformanceSchema: "saydo.dev/publisher-fair-scheduler-conformance/v1";
}

interface PluginWorkerBudgetProfileV1 {
  readonly profile: "plugin-worker-budget-v1";
  readonly maxInlineFrameBytes: 1_048_576;
  readonly maxInboundQueuedBytes: 4_194_304;
  readonly maxOutboundQueuedBytes: 4_194_304;
  readonly maxRssBytes: 268_435_456;
  readonly maxSustainedCpuLogicalCores: 1;
  readonly maxCpuBurstMillis: 2_000;
  readonly maxProcessTreeMembers: 2;
  readonly maxConcurrentPreparedAttempts: 16;
  readonly restartSlidingWindowMillis: 3_600_000;
  readonly maxAutomaticRestartsPerSlidingWindow: 3;
  readonly publisherAggregateRestartWindowSharedAcrossInstances: true;
}

interface RegistryArtifactBudgetProfileV1 {
  readonly profile: "registry-artifact-budget-v1";
  readonly maxCompressedBytes: 16_777_216;
  readonly maxExpandedBytes: 67_108_864;
  readonly maxFiles: 1_024;
  readonly maxSingleFileBytes: 8_388_608;
  readonly maxPathDepth: 16;
  readonly maxExpansionRatio: 100;
  readonly maxMetadataRoles: 256;
  readonly maxDelegations: 128;
  readonly maxTargets: 50_000;
  readonly maxParsedNodes: 1_000_000;
  readonly maxCpuMillis: 5_000;
  readonly maxWallMillis: 15_000;
  readonly maxTemporaryBytes: 134_217_728;
}

interface EvidenceStoreBudgetProfileV1 {
  readonly profile: "evidence-store-budget-v1";
  readonly maxConcurrentIngests: 4;
  readonly maxQueuedIngests: 32;
  readonly maxAggregateRawArtifactBytes: 536_870_912;
  readonly maxAggregateNormalizedProjectionBytes: 67_108_864;
  readonly maxAggregateTemporaryBytes: 134_217_728;
  readonly maxPotentialOrphanBytesAtAdmission: 134_217_728;
  readonly maxCombinedTemporaryAndPotentialOrphanBytes: 134_217_728;
  readonly maxSingleRawArtifactBytes: 67_108_864;
  readonly maxCanonicalizationCpuMillisPerArtifact: 5_000;
  readonly maxCanonicalizationWallMillisPerArtifact: 15_000;
  readonly maxRecoveryOrphanBytes: 134_217_728;
  readonly maxRecoveryCleanupMillis: 30_000;
}

interface ContentHandleDescriptor {
  readonly handleId: string;
  readonly totalBytes: number;
  readonly maxChunkBytes: 262_144;
  readonly contentDigest: string;
  readonly consumerIdentityDigest: string;
  readonly singleReadCapabilityDigest: string;
  readonly backpressureCreditProfileDigest: string;
  readonly expiresAt: string;
  readonly singleRead: true;
}

type PassiveProbeCapabilityId = `probe:${string}@${number}`;

interface ReleaseBundledPassiveProbeCapabilityCore {
  readonly id: PassiveProbeCapabilityId;
  readonly literalLoopbackAddress: CanonicalLoopbackIpV1;
  readonly port: number;
  readonly method: "GET" | "HEAD";
  readonly canonicalPath: string;
  readonly requestHeaderSetDigest: string;
  readonly maxRequestBytes: number;
  readonly maxResponseBytes: number;
  readonly timeoutMillis: number;
  readonly parserProfileDigest: string;
  readonly expectedLocalPeerPolicyDigest: string;
  readonly zeroCostMetadataPolicyDigest: string;
}

interface PassiveLoopbackPeerAdmissionReceipt extends ReceiptRef {
  readonly capabilityId: PassiveProbeCapabilityId;
  readonly literalLoopbackAddress: CanonicalLoopbackIpV1;
  readonly port: number;
  readonly listenerSocketIdentityDigest: string;
  readonly observedListenerOwnerIdentityDigest: string;
  readonly connectedSocketIdentityDigest: string;
  readonly connectedPeerSocketOwnerIdentityDigest: string;
  readonly connectedPeerPidStartIdentityDigest: string;
  readonly binaryArtifactDigest: string;
  readonly binaryFileIdentityDigest: string;
  readonly publisherIdentityDigest?: string;
  readonly expectedLocalPeerPolicyDigest: string;
  readonly observationGeneration: number;
  readonly connectedSocketHeldUntilProbeSend: true;
  readonly applicationBytesSentAtAdmission: 0;
  readonly expiresAt: string;
}

interface ZeroCostMetadataProbePolicyReceipt extends ReceiptRef {
  readonly providerProductId: string;
  readonly endpointIdentityDigest: string;
  readonly authKind: "none";
  readonly exactMethod: "GET" | "HEAD";
  readonly exactCanonicalPath: string;
  readonly exactPublicHeaderSetDigest: string;
  readonly responseParserProfileDigest: string;
  readonly vendorOrOwnerNoChargeEvidenceDigest: string;
  readonly provesNoGeneration: true;
  readonly provesNoPerRequestOrUsageCharge: true;
  readonly provesNoAutomaticOverage: true;
  readonly maxResponseBytes: number;
  readonly hardStopGeneration: number;
  readonly expiresAt: string;
}

type MetadataProbeAdmissionReceipt = ReceiptRef & {
  readonly endpointIdentityDigest: string;
  readonly exactMethodPathHeaderDigest: string;
  readonly writerLease: ReferenceMonitorWriterLeaseReceipt;
  readonly writerEpoch: number;
  readonly exactCredentialEgressDecisions: readonly EndpointCredentialEgressReceipt[];
  readonly exactBrokerAclDigests: readonly string[];
  readonly exactDataProcessorAndRegionSetDigest: string;
  readonly notAfter: string;
  readonly singleUse: true;
} &
  (
    | {
        readonly kind: "automatic_zero_cost_loopback";
        readonly peerAdmission: PassiveLoopbackPeerAdmissionReceipt;
        readonly zeroCostPolicy: ZeroCostMetadataProbePolicyReceipt;
        readonly authKind: "none";
        readonly billingLedgerEntries: readonly [];
      }
    | {
        readonly kind: "user_initiated_established_binding_metadata";
        readonly runtimeFundingDecision: InferenceFundingDecisionReceipt;
        readonly credentialState: InferenceCredentialStateReceipt;
        readonly reservationLedgerEntries: NonEmptyReadonly<ReceiptRef>;
      }
    | {
        readonly kind: "user_initiated_bootstrap_metadata_priced";
        readonly productEligibility: ProductEligibilityReceipt;
        readonly candidateRights: CandidateRightsGrantReceipt;
        readonly candidateBilling: Extract<CandidateBillingReceipt, { readonly kind: "priced_candidate" }>;
        readonly candidateDataBoundary: CandidateDataBoundaryReceipt;
        readonly bootstrapAuthorizationProposal: Extract<
          AuthorizationProposalReceipt,
          { readonly proposalKind: "bootstrap_metadata_priced" }
        >;
        readonly bootstrapAuthorizationDisclosure: Extract<
          AuthorizationDisclosureReceipt,
          { readonly disclosureKind: "bootstrap_metadata_priced" }
        >;
        readonly userDecision: AcceptedUserDecisionReceipt;
        readonly userDecisionConsumptionCommit: UserDecisionConsumptionCommitReceipt;
        readonly reservationLedgerEntries: NonEmptyReadonly<ReceiptRef>;
        readonly generationEndpointsForbidden: true;
      }
    | {
        readonly kind: "user_initiated_bootstrap_metadata_externally_metered_unknown_custom";
        readonly productEligibility: ProductEligibilityReceipt;
        readonly candidateRights: UserAdminAttestedCustomRightsReceipt;
        readonly candidateBilling: Extract<CandidateBillingReceipt, { readonly kind: "externally_metered_unknown_custom" }>;
        readonly candidateDataBoundary: CandidateDataBoundaryReceipt;
        readonly bootstrapAuthorizationProposal: Extract<
          AuthorizationProposalReceipt,
          { readonly proposalKind: "bootstrap_metadata_externally_metered_unknown_custom" }
        >;
        readonly bootstrapAuthorizationDisclosure: Extract<
          AuthorizationDisclosureReceipt,
          { readonly disclosureKind: "bootstrap_metadata_externally_metered_unknown_custom" }
        >;
        readonly userDecision: AcceptedUserDecisionReceipt;
        readonly userDecisionConsumptionCommit: UserDecisionConsumptionCommitReceipt;
        readonly reservationLedgerEntries: NonEmptyReadonly<ReceiptRef>;
        readonly generationEndpointsForbidden: true;
      }
    | {
        readonly kind: "user_initiated_bootstrap_metadata_externally_metered_unknown_official";
        readonly productEligibility: ProductEligibilityReceipt;
        readonly candidateRights: OfficialEnterpriseUnknownMeteringRightsReceipt;
        readonly candidateBilling: Extract<CandidateBillingReceipt, { readonly kind: "externally_metered_unknown_official" }>;
        readonly candidateDataBoundary: CandidateDataBoundaryReceipt;
        readonly bootstrapAuthorizationProposal: Extract<
          AuthorizationProposalReceipt,
          { readonly proposalKind: "bootstrap_metadata_externally_metered_unknown_official" }
        >;
        readonly bootstrapAuthorizationDisclosure: Extract<
          AuthorizationDisclosureReceipt,
          { readonly disclosureKind: "bootstrap_metadata_externally_metered_unknown_official" }
        >;
        readonly userDecision: AcceptedUserDecisionReceipt;
        readonly userDecisionConsumptionCommit: UserDecisionConsumptionCommitReceipt;
        readonly reservationLedgerEntries: NonEmptyReadonly<ReceiptRef>;
        readonly generationEndpointsForbidden: true;
      }
  );

type AutomaticMetadataProbeAdmissionReceipt = Extract<
  MetadataProbeAdmissionReceipt,
  { readonly kind: "automatic_zero_cost_loopback" }
>;

type UserInitiatedMetadataProbeAdmissionReceipt = Exclude<
  MetadataProbeAdmissionReceipt,
  { readonly kind: "automatic_zero_cost_loopback" }
>;

interface MetadataProbeCursorBase extends ReceiptRef {
  readonly writerLease: ReferenceMonitorWriterLeaseReceipt;
  readonly writerEpoch: number;
  readonly admission: MetadataProbeAdmissionReceipt;
  readonly predecessorCursor?: MetadataProbeCursorReceipt;
  readonly expectedRevision: number;
  readonly revision: number;
}

interface MetadataProbeReadyCursorReceipt extends MetadataProbeCursorBase {
  readonly state: "ready";
  readonly predecessorCursor?: never;
  readonly lastPhysicalLease?: never;
  readonly lastTerminal?: never;
}

interface MetadataProbeRequestInFlightCursorReceipt extends MetadataProbeCursorBase {
  readonly state: "request_in_flight";
  readonly predecessorCursor: MetadataProbeReadyCursorReceipt;
  readonly lastPhysicalLease: MetadataProbePhysicalLeaseReceipt;
  readonly lastTerminal?: never;
}

interface MetadataProbeTerminalCursorReceipt extends MetadataProbeCursorBase {
  readonly state: "terminal";
  readonly predecessorCursor: MetadataProbeRequestInFlightCursorReceipt;
  readonly lastPhysicalLease: MetadataProbePhysicalLeaseReceipt;
  readonly lastTerminal: MetadataProbeTerminalReceipt;
  readonly provesPredecessorLeaseTerminalAndRevisionEqual: true;
}

type MetadataProbeCursorReceipt =
  | MetadataProbeReadyCursorReceipt
  | MetadataProbeRequestInFlightCursorReceipt
  | MetadataProbeTerminalCursorReceipt;

interface MetadataProbePhysicalLeaseBase extends ReceiptRef {
  readonly writerLease: ReferenceMonitorWriterLeaseReceipt;
  readonly writerEpoch: number;
  readonly predecessorCursor: MetadataProbeReadyCursorReceipt;
  readonly expectedCursorRevision: number;
  readonly resultingCursorRevision: number;
  readonly resultingCursorState: "request_in_flight";
  readonly physicalAttemptId: string;
  readonly exactEndpointMethodPathHeaderDigest: string;
  readonly preparedRequestDigest: string;
  readonly credentialEgressDecisions: readonly EndpointCredentialEgressReceipt[];
  readonly enforcementDecision: PhysicalEnforcementDecisionReceipt;
  readonly commitTokenDigest: string;
  readonly persistedBeforeAnyNetworkByte: true;
  readonly grantsNoSendAuthority: true;
  readonly notAfter: string;
  readonly singleUse: true;
}

type MetadataProbePhysicalLeaseReceipt = AuthorityInventoryBearingLease &
  MetadataProbePhysicalLeaseBase &
  (
    | {
        readonly accountingClass: "automatic_zero_cost";
        readonly admission: AutomaticMetadataProbeAdmissionReceipt;
        readonly reservationLedgerEntries: readonly [];
      }
    | {
        readonly accountingClass: "user_initiated_credentialed_or_potentially_metered";
        readonly admission: UserInitiatedMetadataProbeAdmissionReceipt;
        readonly reservationLedgerEntries: NonEmptyReadonly<ReceiptRef>;
      }
  );

interface MetadataProbeSendIntentReceipt extends ReceiptRef {
  readonly writerLease: ReferenceMonitorWriterLeaseReceipt;
  readonly writerEpoch: number;
  readonly physicalLease: MetadataProbePhysicalLeaseReceipt;
  readonly predecessorCursor: MetadataProbeRequestInFlightCursorReceipt;
  readonly expectedCursorRevision: number;
  readonly commitTokenDigest: string;
  readonly persistedBeforeAnyNetworkByte: true;
  readonly provesPredecessorLastPhysicalLeaseEqualsPhysicalLease: true;
  readonly notAfter: string;
  readonly singleUse: true;
}

interface MetadataProbeTerminalBase {
  readonly writerLease: ReferenceMonitorWriterLeaseReceipt;
  readonly writerEpoch: number;
  readonly predecessorCursor: MetadataProbeRequestInFlightCursorReceipt;
  readonly expectedCursorRevision: number;
  readonly resultingCursorRevision: number;
  readonly resultingCursorState: "terminal";
  readonly terminalEvidenceDigest: string;
}

type MetadataProbeTerminalReceipt = ReceiptRef &
  MetadataProbeTerminalBase &
  (
    | {
        readonly intentState: "present";
        readonly sendIntent: MetadataProbeSendIntentReceipt;
        readonly preIntentClosure?: never;
        readonly provesSendIntentPhysicalLeaseAndPredecessorLastPhysicalLeaseEqual: true;
      }
    | {
        readonly intentState: "absent";
        readonly sendIntent?: never;
        readonly preIntentClosure: PreIntentLeaseClosureReceipt<MetadataProbePhysicalLeaseReceipt>;
        readonly provesNoSendIntentOrNetworkByteExistsForMetadataPhysicalLease: true;
      }
  ) &
  (
    | ({
        readonly accountingClass: "automatic_zero_cost";
        readonly physicalLease: Extract<MetadataProbePhysicalLeaseReceipt, { readonly accountingClass: "automatic_zero_cost" }>;
        readonly ledgerTerminalRefs: readonly [];
        readonly authoritativeLedgerRangeForbidden: true;
      } &
        (
          | { readonly intentState: "present"; readonly outcome: "succeeded"; readonly delivery: "confirmed_sent" }
          | {
              readonly intentState: "present";
              readonly outcome: "failed_before_send" | "cancelled_before_send" | "hard_stopped_before_send" | "deadline_before_send";
              readonly delivery: "not_sent";
            }
          | {
              readonly intentState: "absent";
              readonly outcome:
                | "failed_before_intent"
                | "cancelled_before_intent"
                | "hard_stopped_before_intent"
                | "deadline_before_intent"
                | "lease_expired_before_intent";
              readonly delivery: "not_sent";
            }
          | { readonly intentState: "present"; readonly outcome: "failed_after_send" | "deadline_after_send"; readonly delivery: "confirmed_sent" }
          | { readonly intentState: "present"; readonly outcome: "delivery_unknown"; readonly delivery: "possibly_sent"; readonly automaticRetryForbidden: true }
        ))
    | ({
        readonly accountingClass: "user_initiated_credentialed_or_potentially_metered";
        readonly physicalLease: Extract<
          MetadataProbePhysicalLeaseReceipt,
          { readonly accountingClass: "user_initiated_credentialed_or_potentially_metered" }
        >;
        readonly ledgerTerminalRefs: NonEmptyReadonly<ReceiptRef>;
        readonly authoritativeLedgerRangeRequired: true;
      } &
        (
          | { readonly intentState: "present"; readonly outcome: "succeeded"; readonly delivery: "confirmed_sent"; readonly accountingDisposition: "settled_or_hold_retained" }
          | {
              readonly intentState: "present";
              readonly outcome: "failed_before_send" | "cancelled_before_send" | "hard_stopped_before_send" | "deadline_before_send";
              readonly delivery: "not_sent";
              readonly accountingDisposition: "reservation_released";
            }
          | {
              readonly intentState: "absent";
              readonly outcome:
                | "failed_before_intent"
                | "cancelled_before_intent"
                | "hard_stopped_before_intent"
                | "deadline_before_intent"
                | "lease_expired_before_intent";
              readonly delivery: "not_sent";
              readonly accountingDisposition: "reservation_released";
            }
          | {
              readonly intentState: "present";
              readonly outcome: "failed_after_send" | "deadline_after_send";
              readonly delivery: "confirmed_sent";
              readonly accountingDisposition: "settled_or_charge_unknown_hold_retained";
            }
          | {
              readonly intentState: "present";
              readonly outcome: "delivery_unknown";
              readonly delivery: "possibly_sent";
              readonly accountingDisposition: "charge_unknown_hold_retained";
              readonly automaticRetryForbidden: true;
            }
        ))
  );

type MetadataProbeFailureOutcome =
  | "failed_before_intent"
  | "cancelled_before_intent"
  | "hard_stopped_before_intent"
  | "deadline_before_intent"
  | "lease_expired_before_intent"
  | "failed_before_send"
  | "cancelled_before_send"
  | "hard_stopped_before_send"
  | "deadline_before_send"
  | "failed_after_send"
  | "deadline_after_send"
  | "delivery_unknown";

type MetadataProbeResultReceipt = ReceiptRef &
  (
    | {
        readonly accountingClass: "automatic_zero_cost";
        readonly resultKind: "succeeded";
        readonly admission: AutomaticMetadataProbeAdmissionReceipt;
        readonly terminal: Extract<MetadataProbeTerminalReceipt, { readonly accountingClass: "automatic_zero_cost" }> & {
          readonly outcome: "succeeded";
          readonly delivery: "confirmed_sent";
        };
        readonly authoritativeLedgerRange?: never;
        readonly responseEvidenceDigest: string;
        readonly parsedMetadataDigest: string;
        readonly provesAdmissionPhysicalLeaseSendIntentAndTerminalEqual: true;
        readonly provesCursorTerminal: true;
      }
    | {
        readonly accountingClass: "automatic_zero_cost";
        readonly resultKind: "not_succeeded";
        readonly admission: AutomaticMetadataProbeAdmissionReceipt;
        readonly terminal: Extract<MetadataProbeTerminalReceipt, { readonly accountingClass: "automatic_zero_cost" }> & {
          readonly outcome: MetadataProbeFailureOutcome;
        };
        readonly authoritativeLedgerRange?: never;
        readonly responseEvidenceDigest?: never;
        readonly parsedMetadataDigest?: never;
        readonly provesAdmissionPhysicalLeaseSendIntentAndTerminalEqual: true;
        readonly provesCursorTerminal: true;
      }
    | {
        readonly accountingClass: "user_initiated_credentialed_or_potentially_metered";
        readonly resultKind: "succeeded";
        readonly admission: UserInitiatedMetadataProbeAdmissionReceipt;
        readonly terminal: Extract<
          MetadataProbeTerminalReceipt,
          { readonly accountingClass: "user_initiated_credentialed_or_potentially_metered" }
        > & { readonly outcome: "succeeded"; readonly delivery: "confirmed_sent" };
        readonly authoritativeLedgerRange: AuthoritativeLedgerRangeReceipt;
        readonly responseEvidenceDigest: string;
        readonly parsedMetadataDigest: string;
        readonly provesAdmissionPhysicalLeaseSendIntentAndTerminalEqual: true;
        readonly provesReservationTerminalAndRangeCoverageExactlyOnce: true;
        readonly provesCursorTerminal: true;
      }
    | {
        readonly accountingClass: "user_initiated_credentialed_or_potentially_metered";
        readonly resultKind: "not_succeeded";
        readonly admission: UserInitiatedMetadataProbeAdmissionReceipt;
        readonly terminal: Extract<
          MetadataProbeTerminalReceipt,
          { readonly accountingClass: "user_initiated_credentialed_or_potentially_metered" }
        > & { readonly outcome: MetadataProbeFailureOutcome };
        readonly authoritativeLedgerRange: AuthoritativeLedgerRangeReceipt;
        readonly responseEvidenceDigest?: never;
        readonly parsedMetadataDigest?: never;
        readonly provesAdmissionPhysicalLeaseSendIntentAndTerminalEqual: true;
        readonly provesReservationTerminalAndRangeCoverageExactlyOnce: true;
        readonly provesCursorTerminal: true;
      }
  );

type ConnectorReleaseMaturity =
  | "builtin_stable"
  | "builtin_beta"
  | "community_verified"
  | "community_unverified"
  | "inventory";
type PublicApiStability = "experimental" | "beta" | "stable" | "deprecated";
type ConnectionReadiness = "connected_verified" | "action_required" | "blocked";
type SolutionReadiness = "conversation_ready" | "review_ready" | "blocked";

type GaFundingTier = "owned_capacity" | "subscription" | "payg" | "externally_metered_unknown";
type GaDeploymentClass =
  | "official_cloud"
  | "third_party_gateway"
  | "local_runtime"
  | "execution_surface"
  | "control_plane";

interface GaJourneySubjectTemplateV1 {
  readonly entryKey: string;
  readonly entryId: string;
  readonly productId: string;
  readonly providerRealmDigest: string;
  readonly regionScopeDigest: string;
  readonly surfaceId: string;
  readonly deploymentClass: GaDeploymentClass;
  readonly protocolProfileDigest: string;
  readonly authKind: AuthSource["kind"];
  readonly authProfileDigest: string;
  readonly fundingTier: GaFundingTier;
  readonly journeyKey: string;
  readonly journeyId: string;
}

type GaJourneyExecutionModeV5 =
  | "deterministic_fixture"
  | "live_provider_qualification";

type ProviderTestAccountPrincipalClassV5 =
  | "individual_account"
  | "organization_member"
  | "organization_administrator"
  | "cloud_service_principal"
  | "cloud_managed_identity";

type ProviderTestAccountMfaModeV5 =
  | "not_required"
  | "totp_brokered"
  | "hardware_key_attended"
  | "provider_push_attended"
  | "recovery_flow_fixture_only";

declare const providerTestAccountMfaAttendanceBrandV5: unique symbol;

type ProviderTestAccountMfaAttendanceReceiptV5 = ReceiptRef<
  "receipt:provider-test-account-mfa-attendance@5"
> & {
  readonly [providerTestAccountMfaAttendanceBrandV5]: never;
  readonly attendanceMode:
    | "totp_brokered"
    | "hardware_key_attended"
    | "provider_push_attended";
  readonly attendedByApprovedOperatorIdentityDigest: string;
  readonly qualificationRunId: string;
  readonly expiresAtMonotonicDigest: string;
  readonly mfaSecretOrRecoveryMaterial?: never;
};

type ProviderLiveStartingAuthFlowClassV6 =
  | "account_creation_then_authentication"
  | "existing_account_interactive_login"
  | "device_authorization"
  | "browser_pkce_or_key_exchange"
  | "service_principal_or_workload_identity"
  | "already_authenticated_session";

type ProviderLiveAdminConsentModeV6 =
  | "not_applicable"
  | "preapproved"
  | "interactive_administrator_required";

interface ProviderTestAccountAssetIdentityReceiptV6 extends ReceiptRef {
  readonly schemaVersion: "saydo.dev/provider-test-account-asset-identity/v6";
  readonly assetId: string;
  readonly productId: string;
  readonly providerRealmDigest: string;
  readonly accountPrincipalDigest: string;
  readonly principalClass: ProviderTestAccountPrincipalClassV5;
  readonly authProfileDigest: string;
  readonly wireAuthKind: WireAuthSchemeV5["kind"];
  readonly supportedStartingAuthFlowClasses: NonEmptyReadonly<ProviderLiveStartingAuthFlowClassV6>;
  readonly mfaMode: ProviderTestAccountMfaModeV5;
  readonly adminConsentMode: ProviderLiveAdminConsentModeV6;
  readonly subscriptionOrBillingProfileDigest: string;
  readonly credentialBrokerHandleSetDigest: string;
  readonly resetBaselineDigest: string;
  readonly allowedPurpose: "release-qualification-only";
  readonly rawSecretMaterial?: never;
  readonly personalMaintainerAccountForbidden: true;
}

type ProviderTestAccountAssetLifecycleStateV6 =
  | "available"
  | "lease_in_flight"
  | "leased"
  | "cleanup_in_flight"
  | "cleanup_verified"
  | "quarantined"
  | "retired";

interface ProviderTestAccountGenesisAvailabilityReceiptV7 extends ReceiptRef<"receipt:provider-test-account-genesis-availability@7"> {
  readonly assetIdentity: ProviderTestAccountAssetIdentityReceiptV6;
  readonly poolId: string;
  readonly initialWriterEpoch: number;
  readonly initialPoolRevision: number;
  readonly initialAssetRevision: number;
  readonly importedBaselineDigest: string;
  readonly noPredecessorLeaseExists: true;
  readonly privatePoolBootstrapProducerCommitted: true;
}

type ProviderTestAccountAssetCursorReceiptV6 = ReceiptRef<
  "receipt:provider-test-account-asset-cursor@6"
> & {
  readonly assetIdentity: ProviderTestAccountAssetIdentityReceiptV6;
  readonly poolId: string;
  readonly writerEpoch: number;
  readonly poolRevision: number;
  readonly assetRevision: number;
  readonly lifecycleState: ProviderTestAccountAssetLifecycleStateV6;
  readonly predecessorCursor?: ProviderTestAccountAssetCursorReceiptV6;
  readonly lastLeaseId: string | "none";
  readonly lastQualificationRunId: string | "none";
  readonly lastTransitionReceipt:
    | ProviderTestAccountGenesisAvailabilityReceiptV7
    | ProviderTestAccountAssetLeaseIntentReceiptV6
    | ProviderTestAccountLeaseInFlightRecoveryReceiptV9
    | ProviderTestAccountLeaseCommitReceiptV6
    | ProviderTestAccountCleanupStartReceiptV6
    | ProviderTestAccountCleanupTerminalReceiptV6
    | ProviderTestAccountAuthorityReleaseBarrierReceiptV7;
  readonly subjectScopedSingleSuccessorCasCommitted: true;
  readonly transitionReceiptNeverOwnsOrEmbedsThisSuccessorCursor: true;
};

type AvailableProviderTestAccountCursorV6<
  B extends ProviderTestAccountAuthorityReleaseBarrierReceiptV7 | null = ProviderTestAccountAuthorityReleaseBarrierReceiptV7 | null,
> = ProviderTestAccountAssetCursorReceiptV6 & {
  readonly lifecycleState: "available";
} & (
  | {
      readonly availabilityKind: "genesis";
      readonly predecessorCursor?: never;
      readonly lastLeaseId: "none";
      readonly lastQualificationRunId: "none";
      readonly lastTransitionReceipt: ProviderTestAccountGenesisAvailabilityReceiptV7;
    }
  | (B extends ProviderTestAccountAuthorityReleaseBarrierReceiptV7
    ? {
      readonly availabilityKind: "recycled_after_release_barrier";
      readonly predecessorCursor: B["predecessorCleanupVerifiedCursor"];
      readonly lastLeaseId: string;
      readonly lastQualificationRunId: string;
      readonly lastTransitionReceipt: B;
    }
    : never)
  | {
      readonly availabilityKind: "recovered_uncommitted_lease_intent";
      readonly predecessorCursor: LeaseInFlightProviderTestAccountCursorV9;
      readonly lastLeaseId: string;
      readonly lastQualificationRunId: string;
      readonly lastTransitionReceipt: Extract<
        ProviderTestAccountLeaseInFlightRecoveryReceiptV9,
        { readonly outcome: "authoritatively_no_lease_commit" }
      >;
    }
);
type LeasedProviderTestAccountCursorV6<
  L extends ProviderTestAccountAssetLeaseReceiptV6 = ProviderTestAccountAssetLeaseReceiptV6,
> = ProviderTestAccountAssetCursorReceiptV6 & {
  readonly lifecycleState: "leased";
  readonly lastLeaseId: L["leaseId"];
  readonly lastQualificationRunId: L["qualificationRunId"];
  readonly lastTransitionReceipt: ProviderTestAccountLeaseCommitReceiptV6<L>;
};
type CleanupInFlightProviderTestAccountCursorV6<
  X extends ProviderTestAccountCleanupStartReceiptV6 | ProviderTestAccountCleanupPendingTerminalReceiptV7 =
    | ProviderTestAccountCleanupStartReceiptV6
    | ProviderTestAccountCleanupPendingTerminalReceiptV7,
> = ProviderTestAccountAssetCursorReceiptV6 & {
  readonly lifecycleState: "cleanup_in_flight";
  readonly lastLeaseId: X["lease"]["leaseId"];
  readonly lastQualificationRunId: X["lease"]["qualificationRunId"];
  readonly lastTransitionReceipt: X;
};
type CleanupVerifiedProviderTestAccountCursorV7<
  T extends ProviderTestAccountCleanupVerifiedTerminalReceiptV7 = ProviderTestAccountCleanupVerifiedTerminalReceiptV7,
> = ProviderTestAccountAssetCursorReceiptV6 & {
  readonly lifecycleState: "cleanup_verified";
  readonly lastLeaseId: T["lease"]["leaseId"];
  readonly lastQualificationRunId: T["lease"]["qualificationRunId"];
  readonly lastTransitionReceipt: T;
};

type QuarantinedProviderTestAccountCursorV8<
  T extends Extract<ProviderTestAccountCleanupTerminalReceiptV6, { readonly outcome: "cleanup_quarantined" }> = Extract<
    ProviderTestAccountCleanupTerminalReceiptV6,
    { readonly outcome: "cleanup_quarantined" }
  >,
> = ProviderTestAccountAssetCursorReceiptV6 & {
  readonly lifecycleState: T["resultingAssetState"];
  readonly lastLeaseId: T["lease"]["leaseId"];
  readonly lastQualificationRunId: T["lease"]["qualificationRunId"];
  readonly lastTransitionReceipt: T;
};

type ProviderTestAccountMfaAdmissionV6 =
  | {
      readonly mode: "not_required" | "recovery_flow_fixture_only";
      readonly attendanceReceipt?: never;
    }
  | {
      readonly mode: "totp_brokered" | "hardware_key_attended" | "provider_push_attended";
      readonly attendanceReceipt: ProviderTestAccountMfaAttendanceReceiptV5;
    };

interface ProviderTestAccountAssetLeaseIntentReceiptV6 extends ReceiptRef {
  readonly availableCursor: AvailableProviderTestAccountCursorV6;
  readonly expectedWriterEpoch: number;
  readonly expectedPoolRevision: number;
  readonly expectedAssetRevision: number;
  readonly resultingPoolRevision: number;
  readonly resultingAssetRevision: number;
  readonly leaseId: string;
  readonly qualificationRunId: string;
  readonly leasedByWorkflowIdentityDigest: string;
  readonly requestedStartingAuthFlowClass: ProviderLiveStartingAuthFlowClassV6;
  readonly requestedPrincipalClass: ProviderTestAccountPrincipalClassV5;
  readonly requestedMfaMode: ProviderTestAccountMfaModeV5;
  readonly requestedAdminConsentMode: ProviderLiveAdminConsentModeV6;
  readonly maximumPhysicalRequestCount: number;
  readonly maximumSpendByNativeUnitDigest: string;
  readonly mfaAdmission: ProviderTestAccountMfaAdmissionV6;
  readonly availableToLeaseInFlightCasCommitted: true;
  readonly successorLeaseInFlightCursor?: never;
}

type LeaseInFlightProviderTestAccountCursorV9<
  I extends ProviderTestAccountAssetLeaseIntentReceiptV6 = ProviderTestAccountAssetLeaseIntentReceiptV6,
> = ProviderTestAccountAssetCursorReceiptV6 & {
  readonly lifecycleState: "lease_in_flight";
  readonly predecessorCursor: I["availableCursor"];
  readonly lastLeaseId: I["leaseId"];
  readonly lastQualificationRunId: I["qualificationRunId"];
  readonly lastTransitionReceipt: I;
  readonly leaseIntent: I;
  readonly leaseCommit?: never;
  readonly leaseIntentExpiresAtMonotonicDigest: string;
  readonly noProviderProcessNetworkCredentialOrBillingEffectHasStarted: true;
};

interface ProviderTestAccountLeaseBeginCommitReceiptV9<
  I extends ProviderTestAccountAssetLeaseIntentReceiptV6 = ProviderTestAccountAssetLeaseIntentReceiptV6,
> extends ReceiptRef<"receipt:provider-test-account-lease-begin-commit@9", I> {
  readonly leaseIntent: I;
  readonly resultingLeaseInFlightCursor: LeaseInFlightProviderTestAccountCursorV9<I>;
  readonly availableCursor: I["availableCursor"];
  readonly expectedWriterEpoch: I["expectedWriterEpoch"];
  readonly expectedPoolRevision: I["expectedPoolRevision"];
  readonly expectedAssetRevision: I["expectedAssetRevision"];
  readonly availableToLeaseInFlightCursorAndIntentCommittedAtomically: true;
  readonly losingSiblingProviderProcessNetworkCredentialAndBillingEffectCount: 0;
}

declare function beginProviderTestAccountAssetLeaseV9(input: {
  readonly availableCursor: AvailableProviderTestAccountCursorV6;
  readonly qualificationRunId: string;
  readonly workflowIdentityDigest: string;
  readonly requestedStartingAuthFlowClass: ProviderLiveStartingAuthFlowClassV6;
  readonly requestedPrincipalClass: ProviderTestAccountPrincipalClassV5;
  readonly requestedMfaMode: ProviderTestAccountMfaModeV5;
  readonly requestedAdminConsentMode: ProviderLiveAdminConsentModeV6;
  readonly requestedPhysicalRequestCount: number;
  readonly requestedSpendByNativeUnitDigest: string;
  readonly mfaAdmission: ProviderTestAccountMfaAdmissionV6;
  readonly leaseIntentExpiresAtMonotonicDigest: string;
}): DeepFrozenCommittedReceiptV1<ProviderTestAccountLeaseBeginCommitReceiptV9>;

declare const providerTestAccountLeaseBrandV6: unique symbol;

interface ProviderTestAccountAssetLeaseReceiptV6 extends AuthorityInventoryBearingLease {
  readonly schemaVersion: "saydo.dev/provider-test-account-asset-lease/v6";
  readonly leaseIntent: ProviderTestAccountAssetLeaseIntentReceiptV6;
  readonly predecessorLeaseInFlightCursor: LeaseInFlightProviderTestAccountCursorV9;
  readonly assetIdentity: ProviderTestAccountAssetIdentityReceiptV6;
  readonly leaseId: ProviderTestAccountAssetLeaseIntentReceiptV6["leaseId"];
  readonly qualificationRunId: ProviderTestAccountAssetLeaseIntentReceiptV6["qualificationRunId"];
  readonly writerEpoch: number;
  readonly predecessorPoolRevision: number;
  readonly predecessorAssetRevision: number;
  readonly leasedPoolRevision: number;
  readonly leasedAssetRevision: number;
  readonly leasedAtMonotonicDigest: string;
  readonly expiresAtMonotonicDigest: string;
  readonly startingResetBaselineDigest: string;
  readonly selectedStartingAuthFlowClass: ProviderLiveStartingAuthFlowClassV6;
  readonly selectedPrincipalClass: ProviderTestAccountPrincipalClassV5;
  readonly selectedMfaMode: ProviderTestAccountMfaModeV5;
  readonly selectedAdminConsentMode: ProviderLiveAdminConsentModeV6;
  readonly maximumPhysicalRequestCount: number;
  readonly maximumSpendByNativeUnitDigest: string;
  readonly mfaAdmission: ProviderTestAccountMfaAdmissionV6;
  readonly credentialBrokerHandleSetDigest: string;
  readonly rawSecretMaterial?: never;
  readonly leaseInFlightToLeasedCasCommitted: true;
  readonly provesAssetIdentityFlowPrincipalMfaAdminConsentBudgetAndCredentialSetEqualLeaseIntent: true;
  readonly [providerTestAccountLeaseBrandV6]: "provider_test_account_pool_allocator";
}

interface ProviderTestAccountLeaseCommitReceiptV6<
  L extends ProviderTestAccountAssetLeaseReceiptV6 = ProviderTestAccountAssetLeaseReceiptV6,
> extends ReceiptRef<"receipt:provider-test-account-lease-commit@8", L> {
  readonly lease: L;
  readonly predecessorLeaseInFlightCursor: L["predecessorLeaseInFlightCursor"];
  readonly resultingPoolRevision: L["leasedPoolRevision"];
  readonly resultingAssetRevision: L["leasedAssetRevision"];
  readonly successorCursor?: never;
  readonly provesLeasePoolAssetWriterRunRevisionAndLastLeaseExactEqualityWithoutEmbeddingItsSuccessor: true;
}

declare const providerTestAccountLeaseInFlightRecoveryBrandV9: unique symbol;

type ProviderTestAccountLeaseInFlightRecoveryReceiptV9<
  I extends ProviderTestAccountAssetLeaseIntentReceiptV6 = ProviderTestAccountAssetLeaseIntentReceiptV6,
  C extends LeaseInFlightProviderTestAccountCursorV9<I> = LeaseInFlightProviderTestAccountCursorV9<I>,
> = ReceiptRef<"receipt:provider-test-account-lease-in-flight-recovery@9", readonly [I, C]> & {
  readonly [providerTestAccountLeaseInFlightRecoveryBrandV9]: never;
  readonly leaseIntent: I;
  readonly leaseInFlightCursor: C;
  readonly currentWriterLease: ReferenceMonitorWriterLeaseReceipt;
  readonly exactPoolJournalAuthorityInventoryAndEffectObservation: ImportedOpaqueEvidenceLeafReceipt;
  readonly recoveryNeverStartsASecondLeaseOrProviderAction: true;
} & (
  | {
      readonly outcome: "committed_lease_recovered";
      readonly recoveredLeaseCommit: ProviderTestAccountLeaseCommitReceiptV6 & {
        readonly predecessorLeaseInFlightCursor: C;
      };
      readonly authorityAbsenceProof?: never;
      readonly quarantineEvidence?: never;
      readonly resultingLifecycleState: "leased";
    }
  | {
      readonly outcome: "authoritatively_no_lease_commit";
      readonly recoveredLeaseCommit?: never;
      readonly authorityAbsenceProof: ImportedOpaqueEvidenceLeafReceipt;
      readonly quarantineEvidence?: never;
      readonly resultingLifecycleState: "available";
      readonly providerProcessNetworkCredentialBillingAndLeaseAuthorityEffectCount: 0;
    }
  | {
      readonly outcome: "quarantined";
      readonly recoveredLeaseCommit?: never;
      readonly authorityAbsenceProof?: never;
      readonly quarantineEvidence: ImportedOpaqueEvidenceLeafReceipt;
      readonly resultingLifecycleState: "quarantined";
    }
);

declare function reconcileProviderTestAccountLeaseInFlightV9<
  const I extends ProviderTestAccountAssetLeaseIntentReceiptV6,
  const C extends LeaseInFlightProviderTestAccountCursorV9<I>,
>(input: {
  readonly leaseIntent: I;
  readonly leaseInFlightCursor: C;
  readonly currentWriterLease: ReferenceMonitorWriterLeaseReceipt;
  readonly exactPoolJournalAuthorityInventoryAndEffectObservation: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<ProviderTestAccountLeaseInFlightRecoveryReceiptV9<I, C>>;

type ProviderTestAccountLeaseInFlightRecoverySuccessorCursorV9<
  R extends ProviderTestAccountLeaseInFlightRecoveryReceiptV9,
> = R extends Extract<ProviderTestAccountLeaseInFlightRecoveryReceiptV9, { readonly outcome: "committed_lease_recovered" }>
  ? LeasedProviderTestAccountCursorV6<R["recoveredLeaseCommit"]["lease"]> & {
      readonly predecessorCursor: R["leaseInFlightCursor"];
      readonly lastTransitionReceipt: R["recoveredLeaseCommit"];
    }
  : R extends Extract<ProviderTestAccountLeaseInFlightRecoveryReceiptV9, { readonly outcome: "authoritatively_no_lease_commit" }>
    ? AvailableProviderTestAccountCursorV6<null> & {
        readonly availabilityKind: "recovered_uncommitted_lease_intent";
        readonly predecessorCursor: R["leaseInFlightCursor"];
        readonly lastLeaseId: R["leaseIntent"]["leaseId"];
        readonly lastQualificationRunId: R["leaseIntent"]["qualificationRunId"];
        readonly lastTransitionReceipt: R;
      }
    : R extends Extract<ProviderTestAccountLeaseInFlightRecoveryReceiptV9, { readonly outcome: "quarantined" }>
      ? ProviderTestAccountAssetCursorReceiptV6 & {
          readonly lifecycleState: "quarantined";
          readonly predecessorCursor: R["leaseInFlightCursor"];
          readonly lastLeaseId: R["leaseIntent"]["leaseId"];
          readonly lastQualificationRunId: R["leaseIntent"]["qualificationRunId"];
          readonly lastTransitionReceipt: R;
        }
      : never;

declare function commitProviderTestAccountLeaseInFlightRecoverySuccessorCursorV9<
  const R extends ProviderTestAccountLeaseInFlightRecoveryReceiptV9,
>(recovery: DeepFrozenCommittedReceiptV1<R>): DeepFrozenCommittedReceiptV1<
  ProviderTestAccountLeaseInFlightRecoverySuccessorCursorV9<R>
>;

declare function leaseProviderTestAccountAssetV6(input: {
  readonly leaseBeginCommit: DeepFrozenCommittedReceiptV1<ProviderTestAccountLeaseBeginCommitReceiptV9>;
  readonly leaseIntent: ProviderTestAccountLeaseBeginCommitReceiptV9["leaseIntent"];
  readonly leaseInFlightCursor: ProviderTestAccountLeaseBeginCommitReceiptV9["resultingLeaseInFlightCursor"];
  readonly currentWriterLease: ReferenceMonitorWriterLeaseReceipt;
}): DeepFrozenCommittedReceiptV1<ProviderTestAccountLeaseCommitReceiptV6>;

declare function commitProviderTestAccountLeasedSuccessorCursorV8<
  const L extends ProviderTestAccountAssetLeaseReceiptV6,
>(leaseCommit: DeepFrozenCommittedReceiptV1<ProviderTestAccountLeaseCommitReceiptV6<L>>): DeepFrozenCommittedReceiptV1<
  LeasedProviderTestAccountCursorV6<L> & {
    readonly predecessorCursor: L["predecessorLeaseInFlightCursor"];
    readonly lastTransitionReceipt: ProviderTestAccountLeaseCommitReceiptV6<L>;
  }
>;

interface ProviderTestAccountInitialCleanupStartReceiptV6 extends ReceiptRef {
  readonly attemptKind: "initial";
  readonly lease: ProviderTestAccountAssetLeaseReceiptV6;
  readonly predecessorCursor: LeasedProviderTestAccountCursorV6;
  readonly expectedWriterEpoch: number;
  readonly expectedPoolRevision: number;
  readonly expectedAssetRevision: number;
  readonly resultingPoolRevision: number;
  readonly resultingAssetRevision: number;
  readonly cleanupAttemptOrdinal: number;
  readonly cleanupWorkerIdentityDigest: string;
  readonly successorCleanupInFlightCursor?: never;
  readonly leasedToCleanupInFlightCasCommitted: true;
  readonly provesLeaseCursorLastLeaseRunAssetAndRevisionsExactEqualityWithoutEmbeddingItsSuccessor: true;
}

declare const providerTestAccountCleanupRetryAuthorityBrandV7: unique symbol;

interface ProviderTestAccountCleanupRetryAuthorityReceiptV6<
  T extends ProviderTestAccountCleanupPendingTerminalReceiptV7 = ProviderTestAccountCleanupPendingTerminalReceiptV7,
  C extends CleanupInFlightProviderTestAccountCursorV6<T> = CleanupInFlightProviderTestAccountCursorV6<T>,
> extends ReceiptRef<
  "receipt:provider-test-account-cleanup-retry-authority@7",
  readonly [T, C]
> {
  readonly [providerTestAccountCleanupRetryAuthorityBrandV7]: never;
  readonly lease: T["lease"];
  readonly cleanupInFlightCursor: C;
  readonly predecessorCleanupTerminal: T;
  readonly previousCleanupAttemptOrdinal: number;
  readonly nextCleanupAttemptOrdinal: number;
  readonly retryNotBeforeMonotonicDigest: string;
  readonly assetReleaseAndNewLeaseForbidden: true;
  readonly issuedOnlyAfterTheImmutablePendingTerminalWasCommitted: true;
}

declare function issueProviderTestAccountCleanupRetryAuthorityV7<
  const T extends ProviderTestAccountCleanupPendingTerminalReceiptV7,
  const C extends CleanupInFlightProviderTestAccountCursorV6<T>,
>(input: {
  readonly predecessorCleanupTerminal: DeepFrozenCommittedReceiptV1<T>;
  readonly currentCleanupInFlightCursor: C;
  readonly retryNotBeforeMonotonicAuthority: TimeAuthorityReceipt;
}): DeepFrozenCommittedReceiptV1<ProviderTestAccountCleanupRetryAuthorityReceiptV6<T, C>>;

interface ProviderTestAccountRetryCleanupStartReceiptV6 extends ReceiptRef {
  readonly attemptKind: "retry";
  readonly lease: ProviderTestAccountAssetLeaseReceiptV6;
  readonly predecessorCursor: CleanupInFlightProviderTestAccountCursorV6;
  readonly predecessorCleanupTerminal: ProviderTestAccountCleanupPendingTerminalReceiptV7;
  readonly retryAuthority: ProviderTestAccountCleanupRetryAuthorityReceiptV6;
  readonly expectedWriterEpoch: number;
  readonly expectedPoolRevision: number;
  readonly expectedAssetRevision: number;
  readonly resultingPoolRevision: number;
  readonly resultingAssetRevision: number;
  readonly cleanupAttemptOrdinal: number;
  readonly cleanupWorkerIdentityDigest: string;
  readonly successorCleanupInFlightCursor?: never;
  readonly retryDeadlineSatisfied: true;
  readonly cleanupInFlightRetryCasCommitted: true;
  readonly provesRetryAuthorityLeaseRunCursorPreviousTerminalOrdinalAndRevisionsExactEqualityWithoutEmbeddingItsSuccessor: true;
}

type ProviderTestAccountCleanupStartReceiptV6 =
  | ProviderTestAccountInitialCleanupStartReceiptV6
  | ProviderTestAccountRetryCleanupStartReceiptV6;

declare function startProviderTestAccountCleanupV6(input: {
  readonly lease: ProviderTestAccountAssetLeaseReceiptV6;
  readonly leasedCursor: LeasedProviderTestAccountCursorV6;
  readonly cleanupWorkerIdentityDigest: string;
}): DeepFrozenCommittedReceiptV1<ProviderTestAccountInitialCleanupStartReceiptV6>;

declare function retryProviderTestAccountCleanupV6(input: {
  readonly lease: ProviderTestAccountAssetLeaseReceiptV6;
  readonly cleanupInFlightCursor: CleanupInFlightProviderTestAccountCursorV6;
  readonly predecessorCleanupTerminal: DeepFrozenCommittedReceiptV1<ProviderTestAccountCleanupPendingTerminalReceiptV7>;
  readonly retryAuthority: ProviderTestAccountCleanupRetryAuthorityReceiptV6;
  readonly cleanupWorkerIdentityDigest: string;
}): DeepFrozenCommittedReceiptV1<ProviderTestAccountRetryCleanupStartReceiptV6>;

declare function commitProviderTestAccountCleanupStartSuccessorCursorV8<
  const S extends ProviderTestAccountCleanupStartReceiptV6,
>(cleanupStart: DeepFrozenCommittedReceiptV1<S>): DeepFrozenCommittedReceiptV1<
  CleanupInFlightProviderTestAccountCursorV6<S> & {
    readonly predecessorCursor: S["predecessorCursor"];
    readonly lastTransitionReceipt: S;
  }
>;

type ProviderCleanupPhysicalOperationKindV9 =
  | "delete_provider_resources"
  | "revoke_provider_sessions"
  | "revoke_credential_versions"
  | "reconcile_billing_and_usage"
  | "reset_account_baseline";

declare const providerCleanupPhysicalOperationLeaseBrandV9: unique symbol;
declare const providerCleanupPhysicalOperationSendIntentBrandV9: unique symbol;
declare const providerCleanupPhysicalOperationTerminalBrandV9: unique symbol;
declare const providerCleanupPhysicalOperationReconciliationBrandV9: unique symbol;
declare const providerCleanupPhysicalOperationSetBrandV9: unique symbol;

interface ProviderCleanupPhysicalOperationLeaseV9<
  O extends ProviderCleanupPhysicalOperationKindV9 = ProviderCleanupPhysicalOperationKindV9,
  S extends ProviderTestAccountCleanupStartReceiptV6 = ProviderTestAccountCleanupStartReceiptV6,
> extends AuthorityInventoryBearingLease<
  NonEmptyLeaseAuthorityInventoryTuple<readonly [
    "network_admission",
    "external_effect",
    "budget_reservation",
    "broker_handle",
    "credential_or_signing",
  ]>
> {
  readonly [providerCleanupPhysicalOperationLeaseBrandV9]: never;
  readonly cleanupStart: S;
  readonly cleanupInFlightCursor: CleanupInFlightProviderTestAccountCursorV6<S>;
  readonly accountLease: S["lease"];
  readonly operationKind: O;
  readonly operationOrdinal: number;
  readonly physicalOperationId: string;
  readonly exactProviderRealmAccountAndPrincipalDigest: string;
  readonly exactMethodOriginPathQueryHeaderAndBodyDigest: string;
  readonly endpointIdentityDigest: string;
  readonly credentialRecipientEndpointDigest: string;
  readonly credentialEgressDecision: EndpointCredentialEgressReceipt;
  readonly brokerAcl: ReceiptRef;
  readonly budgetAndWorstCaseHoldReceipt: ReceiptRef;
  readonly beforeByteDeadlineMonotonicDigest: string;
  readonly hardStopGeneration: number;
  readonly notAfter: string;
  readonly singleUse: true;
  readonly grantsNoNetworkOrProviderEffectAuthorityUntilDurableSendIntent: true;
  readonly provesNetworkEffectBudgetCredentialRecipientAccountRealmAndCleanupAttemptExact: true;
}

declare function commitProviderCleanupPhysicalOperationLeaseV9<
  const O extends ProviderCleanupPhysicalOperationKindV9,
  const S extends ProviderTestAccountCleanupStartReceiptV6,
>(input: {
  readonly cleanupStart: S;
  readonly cleanupInFlightCursor: CleanupInFlightProviderTestAccountCursorV6<S>;
  readonly operationKind: O;
  readonly operationOrdinal: number;
  readonly exactProviderOperation: ImportedOpaqueEvidenceLeafReceipt;
  readonly endpointAndCredentialRecipientBinding: ImportedOpaqueEvidenceLeafReceipt;
  readonly credentialEgressDecision: EndpointCredentialEgressReceipt;
  readonly brokerAcl: ReceiptRef;
  readonly budgetAndWorstCaseHoldReceipt: ReceiptRef;
  readonly authorityInventory: NonEmptyLeaseAuthorityInventoryTuple<
    readonly [
      "network_admission",
      "external_effect",
      "budget_reservation",
      "broker_handle",
      "credential_or_signing",
    ]
  >;
}): DeepFrozenCommittedReceiptV1<ProviderCleanupPhysicalOperationLeaseV9<O, S>>;

interface ProviderCleanupPhysicalOperationSendIntentV9<
  L extends ProviderCleanupPhysicalOperationLeaseV9 = ProviderCleanupPhysicalOperationLeaseV9,
> extends ReceiptRef<"receipt:provider-cleanup-physical-operation-send-intent@9", L> {
  readonly [providerCleanupPhysicalOperationSendIntentBrandV9]: never;
  readonly operationLease: L;
  readonly cleanupStart: L["cleanupStart"];
  readonly operationKind: L["operationKind"];
  readonly physicalOperationId: L["physicalOperationId"];
  readonly exactMethodOriginPathQueryHeaderAndBodyDigest: L["exactMethodOriginPathQueryHeaderAndBodyDigest"];
  readonly endpointIdentityDigest: L["endpointIdentityDigest"];
  readonly credentialRecipientEndpointDigest: L["credentialRecipientEndpointDigest"];
  readonly commitTokenDigest: string;
  readonly persistedBeforeCredentialMaterializationAndAnyNetworkOrProviderEffectByte: true;
  readonly consumesExactLeaseNetworkEffectAndBudgetAuthorityOnce: true;
  readonly singleUse: true;
}

declare function commitProviderCleanupPhysicalOperationSendIntentV9<
  const L extends ProviderCleanupPhysicalOperationLeaseV9,
>(input: {
  readonly operationLease: L;
  readonly exactCredentializedRequestAndRecipientValidation: ImportedOpaqueEvidenceLeafReceipt;
  readonly currentGenerationExpiryAndBudgetValidation: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<ProviderCleanupPhysicalOperationSendIntentV9<L>>;

type ProviderCleanupPhysicalOperationTerminalForLeaseV9<
  L extends ProviderCleanupPhysicalOperationLeaseV9,
> = ReceiptRef<"receipt:provider-cleanup-physical-operation-terminal@9", L> & {
  readonly [providerCleanupPhysicalOperationTerminalBrandV9]: never;
  readonly operationLease: L;
  readonly cleanupStart: L["cleanupStart"];
  readonly operationKind: L["operationKind"];
  readonly physicalOperationId: L["physicalOperationId"];
  readonly endpointIdentityDigest: L["endpointIdentityDigest"];
  readonly credentialRecipientEndpointDigest: L["credentialRecipientEndpointDigest"];
  readonly exactProviderResponseOrAbsenceEvidence: ImportedOpaqueEvidenceLeafReceipt;
} & (
  | {
      readonly outcome: "failed_before_send";
      readonly sendIntent?: never;
      readonly preIntentAuthorityClosure: PreIntentLeaseClosureReceipt<L>;
      readonly resultingOperationState: "retry_ready";
      readonly networkCredentialProviderEffectAndBillableRequestCount: 0;
    }
  | {
      readonly outcome: "succeeded" | "authoritatively_already_absent";
      readonly sendIntent: ProviderCleanupPhysicalOperationSendIntentV9<L>;
      readonly preIntentAuthorityClosure?: never;
      readonly resultingOperationState: "verified_closed";
      readonly exactAuthorityAndWorstCaseHoldSettlement: ReceiptRef;
    }
  | {
      readonly outcome: "failed_after_send" | "delivery_unknown";
      readonly sendIntent: ProviderCleanupPhysicalOperationSendIntentV9<L>;
      readonly preIntentAuthorityClosure?: never;
      readonly resultingOperationState: "reconciliation_required";
      readonly conservativeAuthorityAndBillingHold: ReceiptRef;
      readonly automaticBlindRetryForbidden: true;
    }
);

type ProviderCleanupPhysicalOperationTerminalV9<
  S extends ProviderTestAccountCleanupStartReceiptV6 = ProviderTestAccountCleanupStartReceiptV6,
> = {
  readonly [O in ProviderCleanupPhysicalOperationKindV9]: ProviderCleanupPhysicalOperationTerminalForLeaseV9<
    ProviderCleanupPhysicalOperationLeaseV9<O, S>
  >;
}[ProviderCleanupPhysicalOperationKindV9];

declare function commitProviderCleanupPhysicalOperationTerminalV9<
  const L extends ProviderCleanupPhysicalOperationLeaseV9,
>(input: {
  readonly operationLease: L;
  readonly sendIntent?: ProviderCleanupPhysicalOperationSendIntentV9<L>;
  readonly exactProviderResponseOrAbsenceEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly transportAndPublicationObservation: ImportedOpaqueEvidenceLeafReceipt;
  readonly exactAuthorityAndBillingDisposition: ReceiptRef;
}): DeepFrozenCommittedReceiptV1<ProviderCleanupPhysicalOperationTerminalForLeaseV9<L>>;

type ProviderCleanupPhysicalOperationReconciliationReceiptV9<
  T extends Extract<
    ProviderCleanupPhysicalOperationTerminalV9,
    { readonly resultingOperationState: "reconciliation_required" }
  > = Extract<
    ProviderCleanupPhysicalOperationTerminalV9,
    { readonly resultingOperationState: "reconciliation_required" }
  >,
> = ReceiptRef<"receipt:provider-cleanup-physical-operation-reconciliation@9", T> & {
  readonly [providerCleanupPhysicalOperationReconciliationBrandV9]: never;
  readonly unknownTerminal: T;
  readonly operationLease: T["operationLease"];
  readonly exactIndependentProviderOperationStatusQuery: ImportedOpaqueEvidenceLeafReceipt;
  readonly originalDestructiveOperationWasNotBlindlyReplayed: true;
} & (
  | {
      readonly outcome: "effect_committed_or_resource_absent";
      readonly resultingOperationState: "verified_closed";
      readonly conservativeHoldSettlement: ReceiptRef;
    }
  | {
      readonly outcome: "effect_authoritatively_not_committed";
      readonly resultingOperationState: "retry_ready";
      readonly freshPhysicalOperationLeaseRequiredForRetry: true;
    }
  | {
      readonly outcome: "still_unknown";
      readonly resultingOperationState: "reconciliation_required";
      readonly conservativeHoldRetained: ReceiptRef;
    }
  | {
      readonly outcome: "quarantined";
      readonly resultingOperationState: "quarantined";
      readonly conservativeHoldRetained: ReceiptRef;
      readonly operatorIncidentReceipt: ReceiptRef<"receipt:provider-account-cleanup-incident@6">;
    }
);

declare function reconcileProviderCleanupPhysicalOperationV9<
  const T extends Extract<
    ProviderCleanupPhysicalOperationTerminalV9,
    { readonly resultingOperationState: "reconciliation_required" }
  >,
>(input: {
  readonly unknownTerminal: T;
  readonly independentProviderOperationStatusQueryLeaseIntentAndTerminal: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<ProviderCleanupPhysicalOperationReconciliationReceiptV9<T>>;

type ProviderCleanupVerifiedPhysicalOperationReceiptV9<
  O extends ProviderCleanupPhysicalOperationKindV9,
  S extends ProviderTestAccountCleanupStartReceiptV6 = ProviderTestAccountCleanupStartReceiptV6,
> =
  | Extract<
      ProviderCleanupPhysicalOperationTerminalV9<S>,
      { readonly operationKind: O; readonly resultingOperationState: "verified_closed" }
    >
  | (Extract<
      ProviderCleanupPhysicalOperationReconciliationReceiptV9,
      { readonly outcome: "effect_committed_or_resource_absent" }
    > & {
      readonly operationLease: ProviderCleanupPhysicalOperationLeaseV9<O, S>;
    });

interface ProviderCleanupVerifiedPhysicalOperationSetReceiptV9<
  S extends ProviderTestAccountCleanupStartReceiptV6 = ProviderTestAccountCleanupStartReceiptV6,
> extends ReceiptRef<"receipt:provider-cleanup-verified-physical-operation-set@9", S> {
  readonly [providerCleanupPhysicalOperationSetBrandV9]: never;
  readonly cleanupStart: S;
  readonly orderedVerifiedOperations: readonly [
    ProviderCleanupVerifiedPhysicalOperationReceiptV9<"delete_provider_resources", S>,
    ProviderCleanupVerifiedPhysicalOperationReceiptV9<"revoke_provider_sessions", S>,
    ProviderCleanupVerifiedPhysicalOperationReceiptV9<"revoke_credential_versions", S>,
    ProviderCleanupVerifiedPhysicalOperationReceiptV9<"reconcile_billing_and_usage", S>,
    ProviderCleanupVerifiedPhysicalOperationReceiptV9<"reset_account_baseline", S>,
  ];
  readonly expectedOperationKinds: readonly [
    "delete_provider_resources",
    "revoke_provider_sessions",
    "revoke_credential_versions",
    "reconcile_billing_and_usage",
    "reset_account_baseline",
  ];
  readonly actualOperationKinds: ProviderCleanupVerifiedPhysicalOperationSetReceiptV9<S>["expectedOperationKinds"];
  readonly missingDuplicateExtraUnknownOrCrossAccountOperationCount: 0;
  readonly allNetworkEffectBudgetCredentialAndAuthorityTerminalsAreClosed: true;
}

declare function commitProviderCleanupVerifiedPhysicalOperationSetV9<
  const S extends ProviderTestAccountCleanupStartReceiptV6,
>(input: {
  readonly cleanupStart: S;
  readonly orderedVerifiedOperations: ProviderCleanupVerifiedPhysicalOperationSetReceiptV9<S>["orderedVerifiedOperations"];
}): DeepFrozenCommittedReceiptV1<ProviderCleanupVerifiedPhysicalOperationSetReceiptV9<S>>;

type ProviderCleanupEvidenceBaseV6<
  K extends `receipt:provider-cleanup-${string}@6`,
  O extends ProviderCleanupPhysicalOperationKindV9,
  L extends ProviderTestAccountAssetLeaseReceiptV6 = ProviderTestAccountAssetLeaseReceiptV6,
> = ReceiptRef<K, readonly [L, string]> & {
  readonly lease: L;
  readonly qualificationRunId: L["qualificationRunId"];
  readonly leaseId: L["leaseId"];
  readonly assetId: string;
  readonly providerRealmDigest: string;
  readonly principalDigest: string;
  readonly authoritativeProviderOperationAndObservationDigest: string;
  readonly observedAtMonotonicDigest: string;
  readonly physicalOperationDisposition:
    | (Extract<ProviderCleanupPhysicalOperationTerminalV9, { readonly operationKind: O }> & {
        readonly operationLease: { readonly accountLease: L };
      })
    | (ProviderCleanupPhysicalOperationReconciliationReceiptV9 & {
        readonly operationLease: ProviderCleanupPhysicalOperationLeaseV9<O> & {
          readonly accountLease: L;
        };
      });

};

type ProviderResourcesDeletedEvidenceV6<
  L extends ProviderTestAccountAssetLeaseReceiptV6 = ProviderTestAccountAssetLeaseReceiptV6,
> = ProviderCleanupEvidenceBaseV6<
  "receipt:provider-cleanup-resources@6", "delete_provider_resources", L
> & { readonly residualResourceCount: number | "unknown" };
type ProviderSessionsRevokedEvidenceV6<
  L extends ProviderTestAccountAssetLeaseReceiptV6 = ProviderTestAccountAssetLeaseReceiptV6,
> = ProviderCleanupEvidenceBaseV6<
  "receipt:provider-cleanup-sessions@6", "revoke_provider_sessions", L
> & { readonly residualActiveSessionCount: number | "unknown" };
type ProviderCredentialVersionsRevokedEvidenceV6<
  L extends ProviderTestAccountAssetLeaseReceiptV6 = ProviderTestAccountAssetLeaseReceiptV6,
> = ProviderCleanupEvidenceBaseV6<
  "receipt:provider-cleanup-credentials@6", "revoke_credential_versions", L
> & { readonly residualActiveCredentialCount: number | "unknown" };
type ProviderBillingAndUsageReconciledEvidenceV6<
  L extends ProviderTestAccountAssetLeaseReceiptV6 = ProviderTestAccountAssetLeaseReceiptV6,
> = ProviderCleanupEvidenceBaseV6<
  "receipt:provider-cleanup-billing@6", "reconcile_billing_and_usage", L
> & { readonly residualUnreconciledBillingHoldCount: number | "unknown"; readonly authoritativeLedgerRangeDigest: string };
type ProviderAccountBaselineResetEvidenceV6<
  L extends ProviderTestAccountAssetLeaseReceiptV6 = ProviderTestAccountAssetLeaseReceiptV6,
> = ProviderCleanupEvidenceBaseV6<
  "receipt:provider-cleanup-baseline@6", "reset_account_baseline", L
> & { readonly resultingBaselineDigest: string; readonly baselineEqual: boolean };

interface ProviderCleanupUnresolvedPhysicalOperationSetReceiptV9<
  S extends ProviderTestAccountCleanupStartReceiptV6 = ProviderTestAccountCleanupStartReceiptV6,
> extends ReceiptRef<"receipt:provider-cleanup-unresolved-physical-operation-set@9", S> {
  readonly [providerCleanupPhysicalOperationSetBrandV9]: never;
  readonly cleanupStart: S;
  readonly currentOperationDispositions: NonEmptyReadonly<
    | ProviderCleanupPhysicalOperationTerminalV9<S>
    | ProviderCleanupPhysicalOperationReconciliationReceiptV9
  >;
  readonly unresolvedOperationKinds: NonEmptyReadonly<ProviderCleanupPhysicalOperationKindV9>;
  readonly exactOperationDispositionSetDigest: string;
  readonly missingDuplicateExtraOrCrossAccountOperationCount: 0;
  readonly blindDestructiveRetryCount: 0;
  readonly conservativeAuthorityAndBillingHoldsRetained: true;
  readonly resultingSetState: "pending" | "quarantined";
}

declare function commitProviderCleanupUnresolvedPhysicalOperationSetV9<
  const S extends ProviderTestAccountCleanupStartReceiptV6,
>(input: {
  readonly cleanupStart: S;
  readonly currentOperationDispositions: NonEmptyReadonly<
    | ProviderCleanupPhysicalOperationTerminalV9<S>
    | ProviderCleanupPhysicalOperationReconciliationReceiptV9
  >;
  readonly expectedOperationKinds: readonly [
    "delete_provider_resources",
    "revoke_provider_sessions",
    "revoke_credential_versions",
    "reconcile_billing_and_usage",
    "reset_account_baseline",
  ];
  readonly resultingSetState: "pending" | "quarantined";
}): DeepFrozenCommittedReceiptV1<ProviderCleanupUnresolvedPhysicalOperationSetReceiptV9<S>>;

type ProviderTestAccountCleanupTerminalBaseV7<
  S extends ProviderTestAccountCleanupStartReceiptV6,
> = ReceiptRef<"receipt:provider-test-account-cleanup-terminal@7", readonly [S, S["lease"]]> & {
  readonly cleanupStart: S;
  readonly cleanupInFlightCursor: CleanupInFlightProviderTestAccountCursorV6<S>;
  readonly lease: S["lease"];
  readonly qualificationRunId: S["lease"]["qualificationRunId"];
  readonly evidenceKindsAndReceiptIdsArePairwiseDistinct: true;
  readonly cleanupAttemptTerminalOrdinal: number;
  readonly successorCursor?: never;
  readonly terminalCommitsBeforeAnySuccessorCursorAndNeverEmbedsIt: true;
};

type ProviderTestAccountCleanupTerminalReceiptV6<
  S extends ProviderTestAccountCleanupStartReceiptV6 = ProviderTestAccountCleanupStartReceiptV6,
> =
  | (ProviderTestAccountCleanupTerminalBaseV7<S> & {
      readonly outcome: "cleanup_succeeded";
      readonly physicalOperationSet: ProviderCleanupVerifiedPhysicalOperationSetReceiptV9<S>;
      readonly providerResources: ProviderResourcesDeletedEvidenceV6<S["lease"]> & { readonly residualResourceCount: 0 };
      readonly providerSessions: ProviderSessionsRevokedEvidenceV6<S["lease"]> & { readonly residualActiveSessionCount: 0 };
      readonly credentialVersions: ProviderCredentialVersionsRevokedEvidenceV6<S["lease"]> & { readonly residualActiveCredentialCount: 0 };
      readonly billingAndUsage: ProviderBillingAndUsageReconciledEvidenceV6<S["lease"]> & { readonly residualUnreconciledBillingHoldCount: 0 };
      readonly baselineReset: ProviderAccountBaselineResetEvidenceV6<S["lease"]> & {
        readonly resultingBaselineDigest: S["lease"]["startingResetBaselineDigest"];
        readonly baselineEqual: true;
      };
      readonly resultingAssetState: "cleanup_verified";
      readonly retryNotBefore?: never;
      readonly cleanupInFlightToCleanupVerifiedCasCommitted: true;
      readonly assetReleaseAndNewLeaseForbiddenUntilExactAuthorityReleaseBarrier: true;
      readonly provesEveryEvidenceReceiptProjectsItsExactVerifiedPhysicalOperationAndNoOperationIsMissingOrDuplicated: true;
    })
  | (ProviderTestAccountCleanupTerminalBaseV7<S> & {
      readonly outcome: "cleanup_pending";
      readonly physicalOperationSet: ProviderCleanupUnresolvedPhysicalOperationSetReceiptV9<S> & {
        readonly resultingSetState: "pending";
      };
      readonly providerResources: ProviderResourcesDeletedEvidenceV6<S["lease"]>;
      readonly providerSessions: ProviderSessionsRevokedEvidenceV6<S["lease"]>;
      readonly credentialVersions: ProviderCredentialVersionsRevokedEvidenceV6<S["lease"]>;
      readonly billingAndUsage: ProviderBillingAndUsageReconciledEvidenceV6<S["lease"]>;
      readonly baselineReset: ProviderAccountBaselineResetEvidenceV6<S["lease"]>;
      readonly resultingAssetState: "cleanup_in_flight";
      readonly retryNotBefore: string;
      readonly nextCleanupAttemptOrdinal: number;
      readonly retryAuthority?: never;
      readonly assetReleaseAndNewLeaseForbidden: true;
      readonly immutablePendingTerminalMustCommitBeforeRetryAuthority: true;
      readonly noUnknownOrAfterSendDestructiveOperationWasBlindlyRetried: true;
    })
  | (ProviderTestAccountCleanupTerminalBaseV7<S> & {
      readonly outcome: "cleanup_quarantined";
      readonly physicalOperationSet: ProviderCleanupUnresolvedPhysicalOperationSetReceiptV9<S> & {
        readonly resultingSetState: "quarantined";
      };
      readonly providerResources: ProviderResourcesDeletedEvidenceV6<S["lease"]>;
      readonly providerSessions: ProviderSessionsRevokedEvidenceV6<S["lease"]>;
      readonly credentialVersions: ProviderCredentialVersionsRevokedEvidenceV6<S["lease"]>;
      readonly billingAndUsage: ProviderBillingAndUsageReconciledEvidenceV6<S["lease"]>;
      readonly baselineReset: ProviderAccountBaselineResetEvidenceV6<S["lease"]>;
      readonly resultingAssetState: "quarantined" | "retired";
      readonly assetReleaseAndNewLeaseForbidden: true;
      readonly operatorIncidentReceipt: ReceiptRef<"receipt:provider-account-cleanup-incident@6">;
    });

type ProviderTestAccountCleanupPendingTerminalReceiptV7 = Extract<
  ProviderTestAccountCleanupTerminalReceiptV6,
  { readonly outcome: "cleanup_pending" }
>;

type ProviderTestAccountCleanupVerifiedTerminalReceiptV7 = Extract<
  ProviderTestAccountCleanupTerminalReceiptV6,
  { readonly outcome: "cleanup_succeeded" }
>;

type ProviderTestAccountCleanupVerifiedTerminalForLeaseV7<
  L extends ProviderTestAccountAssetLeaseReceiptV6,
> = ProviderTestAccountCleanupVerifiedTerminalReceiptV7 & {
  readonly lease: L;
  readonly cleanupStart: ProviderTestAccountCleanupStartReceiptV6 & { readonly lease: L };
  readonly providerResources: ProviderResourcesDeletedEvidenceV6<L> & { readonly residualResourceCount: 0 };
  readonly providerSessions: ProviderSessionsRevokedEvidenceV6<L> & { readonly residualActiveSessionCount: 0 };
  readonly credentialVersions: ProviderCredentialVersionsRevokedEvidenceV6<L> & { readonly residualActiveCredentialCount: 0 };
  readonly billingAndUsage: ProviderBillingAndUsageReconciledEvidenceV6<L> & { readonly residualUnreconciledBillingHoldCount: 0 };
  readonly baselineReset: ProviderAccountBaselineResetEvidenceV6<L> & {
    readonly resultingBaselineDigest: L["startingResetBaselineDigest"];
    readonly baselineEqual: true;
  };
};

declare function commitProviderTestAccountCleanupV6<
  const S extends ProviderTestAccountCleanupStartReceiptV6,
>(input: {
  readonly cleanupStart: S;
  readonly cleanupInFlightCursor: CleanupInFlightProviderTestAccountCursorV6<S>;
  readonly physicalOperationSet:
    | ProviderCleanupVerifiedPhysicalOperationSetReceiptV9<S>
    | ProviderCleanupUnresolvedPhysicalOperationSetReceiptV9<S>;
  readonly providerResources: ProviderResourcesDeletedEvidenceV6<S["lease"]>;
  readonly providerSessions: ProviderSessionsRevokedEvidenceV6<S["lease"]>;
  readonly credentialVersions: ProviderCredentialVersionsRevokedEvidenceV6<S["lease"]>;
  readonly billingAndUsage: ProviderBillingAndUsageReconciledEvidenceV6<S["lease"]>;
  readonly baselineReset: ProviderAccountBaselineResetEvidenceV6<S["lease"]>;
}): DeepFrozenCommittedReceiptV1<ProviderTestAccountCleanupTerminalReceiptV6<S>>;

type ProviderTestAccountCleanupSuccessorCursorForTerminalV8<
  T extends ProviderTestAccountCleanupTerminalReceiptV6,
> = T extends ProviderTestAccountCleanupVerifiedTerminalReceiptV7
  ? CleanupVerifiedProviderTestAccountCursorV7<T> & {
      readonly predecessorCursor: T["cleanupInFlightCursor"];
      readonly lastTransitionReceipt: T;
    }
  : T extends ProviderTestAccountCleanupPendingTerminalReceiptV7
    ? CleanupInFlightProviderTestAccountCursorV6<T> & {
        readonly predecessorCursor: T["cleanupInFlightCursor"];
        readonly lastTransitionReceipt: T;
      }
    : T extends Extract<ProviderTestAccountCleanupTerminalReceiptV6, { readonly outcome: "cleanup_quarantined" }>
      ? QuarantinedProviderTestAccountCursorV8<T> & {
          readonly predecessorCursor: T["cleanupInFlightCursor"];
          readonly lastTransitionReceipt: T;
        }
      : never;

declare function commitProviderTestAccountCleanupSuccessorCursorV8<
  const T extends ProviderTestAccountCleanupTerminalReceiptV6,
>(cleanupTerminal: DeepFrozenCommittedReceiptV1<T>): DeepFrozenCommittedReceiptV1<
  ProviderTestAccountCleanupSuccessorCursorForTerminalV8<T>
>;

type ProviderTestAccountAuthorityRegistryEntryV7 = Extract<
  AuthorityLeaseRegistryRowV6,
  { readonly constituentKey: "ProviderTestAccountAssetLeaseReceiptV6" }
>;

declare const providerTestAccountAuthorityReleaseBarrierBrandV7: unique symbol;

interface ProviderTestAccountAuthorityReleaseBarrierReceiptV7<
  L extends ProviderTestAccountAssetLeaseReceiptV6 = ProviderTestAccountAssetLeaseReceiptV6,
  T extends ProviderTestAccountCleanupVerifiedTerminalForLeaseV7<L> = ProviderTestAccountCleanupVerifiedTerminalForLeaseV7<L>,
  C extends CleanupVerifiedProviderTestAccountCursorV7<T> = CleanupVerifiedProviderTestAccountCursorV7<T>,
> extends ReceiptRef<
  "receipt:provider-test-account-authority-release-barrier@7",
  readonly ["ProviderTestAccountAssetLeaseReceiptV6", L, T, C]
> {
  readonly [providerTestAccountAuthorityReleaseBarrierBrandV7]: never;
  readonly registryEntry: ProviderTestAccountAuthorityRegistryEntryV7;
  readonly registryLease: RegistryLeaseOf<ProviderTestAccountAuthorityRegistryEntryV7> & { readonly exactSourceLease: L };
  readonly sourceLease: L;
  readonly cleanupVerifiedTerminal: T;
  readonly physicalOperationSet: T["physicalOperationSet"] & ProviderCleanupVerifiedPhysicalOperationSetReceiptV9;
  readonly registeredAfterIntentTerminal: RegisteredAfterIntentDomainTerminalReceiptV5<ProviderTestAccountAuthorityRegistryEntryV7> & {
    readonly exactDomainSpecificTerminal: RegistryAfterIntentDomainTerminalOf<ProviderTestAccountAuthorityRegistryEntryV7> & {
      readonly exactSourceBusinessTerminal: T;
    };
  };
  readonly authorityReconciliationTerminal: AuthorityAfterIntentDomainReconciliationTerminalReceiptV4<ProviderTestAccountAuthorityRegistryEntryV7>;
  readonly exactAuthorityReleaseTuple: ExactLeaseAuthorityReleaseTuple<RegistryLeaseOf<ProviderTestAccountAuthorityRegistryEntryV7>>;
  readonly predecessorCleanupVerifiedCursor: C;
  readonly expectedWriterEpoch: number;
  readonly expectedPoolRevision: number;
  readonly expectedAssetRevision: number;
  readonly resultingAvailableCursor?: never;
  readonly cleanupVerifiedToAvailableSingleSuccessorCasCommitted: true;
  readonly provesRegistryAndSourceLeaseCleanupRunAssetTerminalReleaseTupleReconciliationAndPredecessorCursorExactWithoutEmbeddingItsSuccessor: true;
  readonly provesAllResourceBudgetBrokerCredentialSigningAndExclusiveCursorAuthorityActiveCountsAreZero: true;
  readonly provesEveryCleanupNetworkEffectBudgetAuthorityAndUnknownReconciliationIsTerminalBeforeLeaseRelease: true;
}

declare function commitProviderTestAccountAuthorityReleaseBarrierV7<
  const L extends ProviderTestAccountAssetLeaseReceiptV6,
  const T extends ProviderTestAccountCleanupVerifiedTerminalForLeaseV7<L>,
  const C extends CleanupVerifiedProviderTestAccountCursorV7<T>,
>(input: {
  readonly registryEntry: ProviderTestAccountAuthorityRegistryEntryV7;
  readonly registryLease: RegistryLeaseOf<ProviderTestAccountAuthorityRegistryEntryV7> & { readonly exactSourceLease: L };
  readonly cleanupVerifiedTerminal: T;
  readonly physicalOperationSet: T["physicalOperationSet"] & ProviderCleanupVerifiedPhysicalOperationSetReceiptV9;
  readonly registeredAfterIntentTerminal: ProviderTestAccountAuthorityReleaseBarrierReceiptV7<L, T, C>["registeredAfterIntentTerminal"];
  readonly authorityReconciliationTerminal: AuthorityAfterIntentDomainReconciliationTerminalReceiptV4<ProviderTestAccountAuthorityRegistryEntryV7>;
  readonly exactAuthorityReleaseTuple: ExactLeaseAuthorityReleaseTuple<RegistryLeaseOf<ProviderTestAccountAuthorityRegistryEntryV7>>;
  readonly predecessorCleanupVerifiedCursor: C;
}): DeepFrozenCommittedReceiptV1<ProviderTestAccountAuthorityReleaseBarrierReceiptV7<L, T, C>>;

type RecycledAvailableProviderTestAccountCursorV8<
  B extends ProviderTestAccountAuthorityReleaseBarrierReceiptV7,
> = AvailableProviderTestAccountCursorV6<B> & {
  readonly availabilityKind: "recycled_after_release_barrier";
  readonly predecessorCursor: B["predecessorCleanupVerifiedCursor"];
  readonly lastTransitionReceipt: B;
};

declare function commitProviderTestAccountAvailableSuccessorCursorV8<
  const B extends ProviderTestAccountAuthorityReleaseBarrierReceiptV7,
>(authorityReleaseBarrier: DeepFrozenCommittedReceiptV1<B>): DeepFrozenCommittedReceiptV1<
  RecycledAvailableProviderTestAccountCursorV8<B>
>;

interface GaDeterministicJourneyExecutionReceiptV5 extends ReceiptRef {
  readonly executionMode: "deterministic_fixture";
  readonly exactRunSubjectDigest: string;
  readonly hermeticProviderSimulatorArtifactDigest: string;
  readonly signedFixtureCorpusDigest: string;
  readonly actualExternalAccountLeaseCount: 0;
  readonly actualInternetRequestCount: 0;
  readonly actualProviderSideEffectCount: 0;
  readonly provesFixtureEventsPreserveTheExactUserGraphMetricsAndExpectedWireWithoutExternalEffects: true;
}

interface GaLiveQualificationCoverageUnitV6<K extends string = string> {
  readonly requirementKey: K;
  readonly productId: string;
  readonly providerRealmDigest: string;
  readonly authProfileDigest: string;
  readonly wireAuthKind: WireAuthSchemeV5["kind"];
  readonly protocolProfile: ReferenceProtocolProfileV3;
  readonly fundingTier: GaFundingTier;
  readonly fundingVariantId: string;
  readonly startingAuthFlowClass: ProviderLiveStartingAuthFlowClassV6;
  readonly principalClass: ProviderTestAccountPrincipalClassV5;
  readonly mfaMode: ProviderTestAccountMfaModeV5;
  readonly adminConsentMode: ProviderLiveAdminConsentModeV6;
  readonly platformProfile: ReferencePlatformProfileV4 | "platform_independent";
  readonly platformSpecificBehaviorEvidenceDigest?: string;
}

declare const gaLiveQualificationPlanBrandV6: unique symbol;

type GaLiveQualificationCoveragePlanReceiptV6 = ReceiptRef & {
  readonly schemaVersion: "saydo.dev/ga-live-qualification-coverage-plan/v6";
  readonly releaseCandidateDistributionDigest: string;
  readonly referenceRequirementsDigest: string;
  readonly deterministicFullCartesianRunSubjectSetDigest: string;
  readonly requiredRemoteCoverageUnits: NonEmptyReadonly<GaLiveQualificationCoverageUnitV6>;
  readonly selectedLiveCoverageUnits: NonEmptyReadonly<GaLiveQualificationCoverageUnitV6>;
  readonly selectedLiveRunSubjectDigests: NonEmptyReadonly<string>;
  readonly accountAssetPoolCapacityReservation: ReceiptRef<
    "receipt:provider-test-account-pool-capacity-reservation@5"
  >;
  readonly coverageAlgorithm:
    "minimum-deterministic-set-cover-by-requirement-product-realm-auth-protocol-funding-flow-principal-mfa-admin-plus-dependent-platform-v6";
  readonly maximumConcurrentLeasesPerProviderRealm: 2;
  readonly maximumTotalLiveRunsPerQualificationCycle: 192;
  readonly computedMinimumSetCoverCardinality: number;
  readonly fullPlatformLocaleAnchorAccountStateCartesianLiveExecutionForbidden: true;
  readonly provesComputedMinimumSetCoverCardinalityDoesNotExceedSignedMaximumAndPoolCapacityCoversEveryConcurrentLease: true;
  readonly provesEveryRequiredRemoteCoverageUnitHasAtLeastOneSelectedLiveRunAndNoSelectedRunExistsOnlyForLocaleOrAnchorDuplication: true;
  readonly provesSelectedRunAssetAndAttendanceMatchFlowPrincipalMfaAndAdminConsentDimensions: true;
  readonly [gaLiveQualificationPlanBrandV6]: "release_qualification_plan_generator";
};

declare function deriveGaLiveQualificationCoveragePlanV6(input: {
  readonly releaseCandidateDistributionDigest: string;
  readonly requirements: typeof REFERENCE_REQUIREMENTS_V3;
  readonly deterministicRunSubjects: typeof REFERENCE_RUN_SUBJECTS_V4;
  readonly platformSpecificBehaviorEvidence: readonly ReceiptRef[];
  readonly accountAssetPoolCapacityReservation: ReceiptRef<
    "receipt:provider-test-account-pool-capacity-reservation@5"
  >;
  readonly signedMaximumTotalLiveRunsPerCycle: 192;
}): DeepFrozenCommittedReceiptV1<GaLiveQualificationCoveragePlanReceiptV6>;

interface GaLiveQualificationCycleIdentityReceiptV7<
  O extends 1 | 2 = 1 | 2,
  D extends string = string,
> extends ReceiptRef<"receipt:ga-live-qualification-cycle-identity@7", readonly [O, D]> {
  readonly cycleOrdinal: O;
  readonly releaseCandidateDistributionDigest: D;
  readonly cycleNonceDigest: string;
  readonly trustedWindowStart: TimeAuthorityReceipt;
  readonly trustedWindowEnd: TimeAuthorityReceipt;
  readonly accountPoolWriterEpoch: number;
  readonly noReceiptLeaseCursorProviderRequestOrRawEvidenceOccurrenceMayBelongToAnotherCycle: true;
}

type ProviderTestAccountReleasedPostRunClosureV7<
  L extends ProviderTestAccountAssetLeaseReceiptV6 = ProviderTestAccountAssetLeaseReceiptV6,
  T extends ProviderTestAccountCleanupVerifiedTerminalForLeaseV7<L> = ProviderTestAccountCleanupVerifiedTerminalForLeaseV7<L>,
  C extends CleanupVerifiedProviderTestAccountCursorV7<T> = CleanupVerifiedProviderTestAccountCursorV7<T>,
  B extends ProviderTestAccountAuthorityReleaseBarrierReceiptV7<L, T, C> = ProviderTestAccountAuthorityReleaseBarrierReceiptV7<L, T, C>,
  A extends RecycledAvailableProviderTestAccountCursorV8<B> = RecycledAvailableProviderTestAccountCursorV8<B>,
> = ReceiptRef<"receipt:provider-test-account-released-post-run-closure@8", readonly [L, T, C, B, A]> & {
  readonly lease: L;
  readonly cleanupVerifiedTerminal: T;
  readonly cleanupVerifiedCursor: C;
  readonly authorityReleaseBarrier: B;
  readonly terminalAvailableCursor: A;
  readonly provesCleanupEvidenceBaselineTerminalCursorAuthorityReleaseBarrierAndSeparateAvailableSuccessorAreOneExactAcyclicChain: true;
};

type ProviderTestAccountQuarantinedPostRunClosureV7<
  L extends ProviderTestAccountAssetLeaseReceiptV6 = ProviderTestAccountAssetLeaseReceiptV6,
  T extends Extract<
    ProviderTestAccountCleanupTerminalReceiptV6,
    { readonly outcome: "cleanup_quarantined" }
  > & { readonly lease: L } = Extract<
    ProviderTestAccountCleanupTerminalReceiptV6,
    { readonly outcome: "cleanup_quarantined" }
  > & { readonly lease: L },
  C extends QuarantinedProviderTestAccountCursorV8<T> = QuarantinedProviderTestAccountCursorV8<T>,
> = ReceiptRef<"receipt:provider-test-account-quarantined-post-run-closure@8", readonly [L, T, C]> & {
  readonly lease: L;
  readonly cleanupQuarantinedTerminal: T;
  readonly terminalQuarantinedOrRetiredCursor: C;
  readonly newLeaseAndAuthorityReleaseAsReusableAssetForbidden: true;
};

type GaLiveProviderQualificationTerminalBaseV7<
  C extends GaLiveQualificationCycleIdentityReceiptV7,
  L extends ProviderTestAccountAssetLeaseReceiptV6,
> = ReceiptRef<"receipt:ga-live-provider-qualification-terminal@7", readonly [C, L]> & {
  readonly executionMode: "live_provider_qualification";
  readonly cycleIdentity: C;
  readonly runOccurrenceId: string;
  readonly coveragePlan: GaLiveQualificationCoveragePlanReceiptV6;
  readonly selectedCoverageUnit: GaLiveQualificationCoverageUnitV6;
  readonly exactSelectedRunSubjectDigest: string;
  readonly testedDistributionArtifactDigest: string;
  readonly accountAssetLease: L;
  readonly observedMfaMode: ProviderTestAccountMfaModeV5;
  readonly observedStartingAuthFlowClass: ProviderLiveStartingAuthFlowClassV6;
  readonly observedPrincipalClass: ProviderTestAccountPrincipalClassV5;
  readonly observedAdminConsentMode: ProviderLiveAdminConsentModeV6;
  readonly authoritativeEntitlementAndBillingEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly exactWireAndTerminalEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly providerUsageAndSpendReconciliationEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly providerPhysicalRequestOccurrenceSetDigest: string;
  readonly rawEvidenceOccurrenceSetDigest: string;
  readonly cursorRevisionOccurrenceSetDigest: string;
  readonly provesCycleLeaseBudgetPrincipalRealmAuthProtocolFundingFlowMfaAdminDistributionWireEvidenceAndOccurrencesAllBindThisRun: true;
};

type GaLiveProviderQualificationTerminalReceiptV6<
  C extends GaLiveQualificationCycleIdentityReceiptV7 = GaLiveQualificationCycleIdentityReceiptV7,
  L extends ProviderTestAccountAssetLeaseReceiptV6 = ProviderTestAccountAssetLeaseReceiptV6,
> =
    | (GaLiveProviderQualificationTerminalBaseV7<C, L> & {
        readonly outcome: "completed_pass";
        readonly failureKind?: never;
        readonly postRunClosure: ProviderTestAccountReleasedPostRunClosureV7<L>;
      })
    | (GaLiveProviderQualificationTerminalBaseV7<C, L> & {
        readonly outcome: "not_passed";
        readonly failureKind:
          | "assertion_failed"
          | "provider_rejected"
          | "timeout"
          | "cancelled"
          | "worker_crashed"
          | "cleanup_quarantined_asset";
        readonly postRunClosure:
          | ProviderTestAccountReleasedPostRunClosureV7<L>
          | ProviderTestAccountQuarantinedPostRunClosureV7<L>;
      });

type GaLiveProviderQualificationRunReceiptV6 = Extract<
  GaLiveProviderQualificationTerminalReceiptV6,
  { readonly outcome: "completed_pass" }
> & { readonly postRunClosure: ProviderTestAccountReleasedPostRunClosureV7 };

interface GaLiveQualificationCycleReceiptV6<
  O extends 1 | 2 = 1 | 2,
  D extends string = string,
> extends ReceiptRef<"receipt:ga-live-qualification-cycle@7", GaLiveQualificationCycleIdentityReceiptV7<O, D>> {
  readonly schemaVersion: "saydo.dev/ga-live-qualification-cycle/v7";
  readonly cycleIdentity: GaLiveQualificationCycleIdentityReceiptV7<O, D>;
  readonly cycleOrdinal: O;
  readonly releaseCandidateDistributionDigest: D;
  readonly coveragePlan: GaLiveQualificationCoveragePlanReceiptV6;
  readonly allTerminalRuns: NonEmptyReadonly<GaLiveProviderQualificationTerminalReceiptV6 & {
    readonly cycleIdentity: GaLiveQualificationCycleIdentityReceiptV7<O, D>;
    readonly testedDistributionArtifactDigest: D;
  }>;
  readonly completedRuns: NonEmptyReadonly<GaLiveProviderQualificationRunReceiptV6 & {
    readonly cycleIdentity: GaLiveQualificationCycleIdentityReceiptV7<O, D>;
    readonly testedDistributionArtifactDigest: D;
  }>;
  readonly completedCoverageUnitSetDigest: string;
  readonly accountPoolBeginningCursorSet: NonEmptyReadonly<ProviderTestAccountAssetCursorReceiptV6>;
  readonly accountPoolTerminalCursorSet: NonEmptyReadonly<ProviderTestAccountAssetCursorReceiptV6>;
  readonly exactPoolAndPerAssetRevisionTransitionChainDigest: string;
  readonly staleLeaseCleanupDoubleCleanupLateCleanupAndCrossRunMutationCount: 0;
  readonly cleanupPendingAssetIds: readonly [];
  readonly quarantinedAssetIds: readonly [];
  readonly runOccurrenceIdSetDigest: string;
  readonly accountLeaseReceiptIdSetDigest: string;
  readonly accountCursorRevisionOccurrenceSetDigest: string;
  readonly providerPhysicalRequestOccurrenceSetDigest: string;
  readonly rawEvidenceOccurrenceSetDigest: string;
  readonly everyCompletedRunHasAProviderTestAccountReleasedPostRunClosure: true;
  readonly provesCompletedRunsExactlyCoverThePlanAndEveryLeaseHasOneTerminalCleanup: true;
  readonly provesAllFailedTimeoutCancelledAndCrashedRunsAlsoCompletedCleanupBeforeTheCycleCouldPass: true;
  readonly provesEveryAssetRevisionChainIsContinuousSingleSuccessorAndLastLeaseEqual: true;
}

declare function commitGaLiveQualificationCycleV7<
  const O extends 1 | 2,
  const D extends string,
>(input: {
  readonly cycleIdentity: GaLiveQualificationCycleIdentityReceiptV7<O, D>;
  readonly coveragePlan: GaLiveQualificationCoveragePlanReceiptV6 & { readonly releaseCandidateDistributionDigest: D };
  readonly allTerminalRuns: GaLiveQualificationCycleReceiptV6<O, D>["allTerminalRuns"];
  readonly accountPoolBeginningCursorSet: NonEmptyReadonly<ProviderTestAccountAssetCursorReceiptV6>;
  readonly accountPoolTerminalCursorSet: NonEmptyReadonly<ProviderTestAccountAssetCursorReceiptV6>;
}): DeepFrozenCommittedReceiptV1<GaLiveQualificationCycleReceiptV6<O, D>>;

declare const gaTwoCycleEvidenceDisjointnessBrandV7: unique symbol;

interface GaTwoCycleEvidenceDisjointnessReceiptV7<D extends string = string>
  extends ReceiptRef<"receipt:ga-two-cycle-evidence-disjointness@7", D> {
  readonly [gaTwoCycleEvidenceDisjointnessBrandV7]: never;
  readonly cycleOne: GaLiveQualificationCycleReceiptV6<1, D>;
  readonly cycleTwo: GaLiveQualificationCycleReceiptV6<2, D>;
  readonly runOccurrenceIdIntersectionCount: 0;
  readonly accountLeaseReceiptIdIntersectionCount: 0;
  readonly accountCursorRevisionOccurrenceIntersectionCount: 0;
  readonly providerPhysicalRequestOccurrenceIntersectionCount: 0;
  readonly rawEvidenceOccurrenceIntersectionCount: 0;
  readonly cycleNonceAndTrustedMeasurementWindowsAreDistinctAndNonOverlapping: true;
  readonly allFiveIdentitySetIntersectionsWereRecomputedFromCanonicalReceipts: true;
}

declare function commitGaTwoCycleEvidenceDisjointnessV7<const D extends string>(input: {
  readonly cycleOne: GaLiveQualificationCycleReceiptV6<1, D>;
  readonly cycleTwo: GaLiveQualificationCycleReceiptV6<2, D>;
  readonly independentSetEvaluatorArtifact: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<GaTwoCycleEvidenceDisjointnessReceiptV7<D>>;

interface GaQualificationOccurrenceIdentityV7 {
  readonly occurrenceId: string;
  readonly cycleOrdinal: 1 | 2;
  readonly distributionArtifactDigest: string;
  readonly leaseOrProcessOccurrenceSetDigest: string;
  readonly physicalRequestOccurrenceSetDigest: string;
  readonly rawEvidenceOccurrenceSetDigest: string;
  readonly trustedWindowDigest: string;
}

declare const gaQualificationOccurrenceDisjointnessBrandV7: unique symbol;

interface GaQualificationOccurrenceDisjointnessReceiptV7<
  A extends GaQualificationOccurrenceIdentityV7 = GaQualificationOccurrenceIdentityV7,
  B extends GaQualificationOccurrenceIdentityV7 = GaQualificationOccurrenceIdentityV7,
> extends ReceiptRef<"receipt:ga-qualification-occurrence-disjointness@7", readonly [A, B]> {
  readonly [gaQualificationOccurrenceDisjointnessBrandV7]: never;
  readonly cycleOneOccurrence: A & { readonly cycleOrdinal: 1 };
  readonly cycleTwoOccurrence: B & { readonly cycleOrdinal: 2 };
  readonly occurrenceIdIntersectionCount: 0;
  readonly leaseOrProcessOccurrenceIntersectionCount: 0;
  readonly physicalRequestOccurrenceIntersectionCount: 0;
  readonly rawEvidenceOccurrenceIntersectionCount: 0;
  readonly trustedWindowsAreDistinctAndNonOverlapping: true;
}

interface GaRemoteBackedSurfaceQualificationRunReceiptV7<
  R extends ReferenceRequirementRowV3 = ReferenceRequirementRowV3,
  O extends 1 | 2 = 1 | 2,
  D extends string = string,
  L extends ProviderTestAccountAssetLeaseReceiptV6 = ProviderTestAccountAssetLeaseReceiptV6,
> extends ReceiptRef<"receipt:ga-remote-backed-surface-qualification-run@7", readonly [R, O, D, L]> {
  readonly referenceRequirement: R & {
    readonly liveDependencyClass: "remote_backed_execution_or_bridge";
    readonly liveQualificationMode: "required_remote_upstream_surface";
  };
  readonly cycleIdentity: GaLiveQualificationCycleIdentityReceiptV7<O, D>;
  readonly occurrenceIdentity: GaQualificationOccurrenceIdentityV7 & {
    readonly cycleOrdinal: O;
    readonly distributionArtifactDigest: D;
  };
  readonly testedDistributionArtifactDigest: D;
  readonly accountAssetLease: L;
  readonly managedNonPersonalAccountAndEntitlementEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly observedMfaSubscriptionQuotaExtraUsageAndBillingPolicyEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly exactInstalledSurfaceBinaryServerOrBridgeArtifactEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly actualSessionStartAndAtLeastOneTurnOrBridgePhysicalRequestTerminal: ImportedOpaqueEvidenceLeafReceipt;
  readonly exactProtocolWirePeerAndUpstreamRouteEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly authoritativeUsageAndSpendReconciliationEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly postRunClosure: ProviderTestAccountReleasedPostRunClosureV7<L>;
  readonly outcome: "completed_pass";
  readonly provesRealSurfaceUpstreamAccountEntitlementWireBillingDistributionAndCleanupReleaseClosureExact: true;
}

interface GaLocalProductQualificationRunReceiptV7<
  R extends ReferenceRequirementRowV3 = ReferenceRequirementRowV3,
  O extends 1 | 2 = 1 | 2,
  D extends string = string,
> extends ReceiptRef<"receipt:ga-local-product-qualification-run@7", readonly [R, O, D]> {
  readonly referenceRequirement: R & {
    readonly liveDependencyClass: "pure_local_runtime";
    readonly liveQualificationMode: "required_local_product";
  };
  readonly cycleIdentity: GaLiveQualificationCycleIdentityReceiptV7<O, D>;
  readonly occurrenceIdentity: GaQualificationOccurrenceIdentityV7 & {
    readonly cycleOrdinal: O;
    readonly distributionArtifactDigest: D;
  };
  readonly signedInstalledProductArtifactAndVersionEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly exactLoopbackPeerProcessOpenApiAndModelIdentityEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly coldAndWarmStagedLiveProtocolTerminalEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly externalProviderAccountLeaseCount: 0;
  readonly nonLoopbackNetworkRequestCount: 0;
  readonly paidBillingComponentCount: 0;
  readonly outcome: "completed_pass";
  readonly provesCurrentDistributionRealLocalProductPeerModelProtocolAndRecoveryExact: true;
}

type RequiredRemoteQualificationRequirementKeyV6 = {
  [K in ReferenceRequirementKeyV3]: ReferenceRowByKeyV3<K>["liveQualificationMode"] extends "required_remote_provider"
    ? K
    : never;
}[ReferenceRequirementKeyV3];

type RequiredExistingConnectionMigrationQualificationRequirementKeyV8 = {
  [K in ReferenceRequirementKeyV3]: ReferenceRowByKeyV3<K>["liveQualificationMode"] extends "required_remote_existing_connection_migration"
    ? K
    : never;
}[ReferenceRequirementKeyV3];

type RequiredRemoteUpstreamSurfaceRequirementKeyV7 = {
  [K in ReferenceRequirementKeyV3]: ReferenceRowByKeyV3<K>["liveQualificationMode"] extends "required_remote_upstream_surface" ? K : never;
}[ReferenceRequirementKeyV3];

type RequiredLocalProductQualificationRequirementKeyV7 = {
  [K in ReferenceRequirementKeyV3]: ReferenceRowByKeyV3<K>["liveQualificationMode"] extends "required_local_product" ? K : never;
}[ReferenceRequirementKeyV3];

type RequiredPlatformControlQualificationRequirementKeyV7 = {
  [K in ReferenceRequirementKeyV3]: ReferenceRowByKeyV3<K>["liveQualificationMode"] extends "required_platform_control" ? K : never;
}[ReferenceRequirementKeyV3];

type NonRemoteQualificationRequirementKeyV6 = {
  [K in ReferenceRequirementKeyV3]: ReferenceRowByKeyV3<K>["liveQualificationMode"] extends "not_applicable_user_or_admin_supplied_endpoint" ? K : never;
}[ReferenceRequirementKeyV3];

interface GaRemoteExistingConnectionMigrationQualificationRunReceiptV8<
  R extends ReferenceRequirementRowV3 = ReferenceRequirementRowV3,
  O extends 1 | 2 = 1 | 2,
  D extends string = string,
  L extends ProviderTestAccountAssetLeaseReceiptV6 = ProviderTestAccountAssetLeaseReceiptV6,
> extends ReceiptRef<"receipt:ga-existing-connection-migration-qualification-run@8", readonly [R, O, D, L]> {
  readonly referenceRequirement: R & {
    readonly requirementKey: "hunyuan.cn";
    readonly onboardingAvailability: "existing_connection_migration_only";
    readonly liveDependencyClass: "remote_existing_connection_migration";
    readonly liveQualificationMode: "required_remote_existing_connection_migration";
  };
  readonly cycleIdentity: GaLiveQualificationCycleIdentityReceiptV7<O, D>;
  readonly testedDistributionArtifactDigest: D;
  readonly managedExistingLegacyConnectionAsset: L & {
    readonly selectedStartingAuthFlowClass: "already_authenticated_session";
  };
  readonly readOnlyLegacyConnectionMetadataAndBrokerHandleEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly existingConnectionValidationTerminal: ImportedOpaqueEvidenceLeafReceipt;
  readonly tokenHubMigrationDestinationQualificationOrReadOnlyRetentionTerminal: ImportedOpaqueEvidenceLeafReceipt;
  readonly freshAccountCreationBillingActivationCredentialCreationAndPickerActionCount: 0;
  readonly noExistingConnectionDispositionFixture: GaReferenceMigrationOnlyAbsenceRunSubjectV8;
  readonly postRunClosure: ProviderTestAccountReleasedPostRunClosureV7<L>;
  readonly outcome: "completed_pass";
  readonly provesOnlyAnExistingManagedLegacyConnectionWasValidatedAndNoFreshOnboardingPathRan: true;
}

type GaLiveQualificationDispositionForRequirementV6<
  R extends ReferenceRequirementRowV3,
  D extends string,
> = R["liveQualificationMode"] extends "required_remote_existing_connection_migration"
  ? {
      readonly mode: "required_remote_existing_connection_migration";
      readonly referenceRequirement: R;
      readonly testedDistributionArtifactDigest: D;
      readonly cycleOneRun: GaRemoteExistingConnectionMigrationQualificationRunReceiptV8<R, 1, D>;
      readonly cycleTwoRun: GaRemoteExistingConnectionMigrationQualificationRunReceiptV8<R, 2, D>;
      readonly noExistingConnectionDisposition: "not_applicable_no_existing_connection";
      readonly positiveFreshOnboardingRunCount: 0;
      readonly provesBothCyclesUseManagedExistingLegacyConnectionsAndAbsenceNeverEntersTheMigrationGraph: true;
      readonly notApplicableReason?: never;
    }
  : R["liveQualificationMode"] extends "required_remote_provider"
  ? {
      readonly mode: "required_remote_provider";
      readonly referenceRequirement: R;
      readonly testedDistributionArtifactDigest: D;
      readonly coveragePlan: GaLiveQualificationCoveragePlanReceiptV6;
      readonly selectedCoverageUnitsForRequirement: NonEmptyReadonly<
        GaLiveQualificationCoverageUnitV6<R["requirementKey"]>
      >;
      readonly cycleOne: GaLiveQualificationCycleReceiptV6<1, D>;
      readonly cycleTwo: GaLiveQualificationCycleReceiptV6<2, D>;
      readonly twoCycleEvidenceDisjointness: GaTwoCycleEvidenceDisjointnessReceiptV7<D>;
      readonly cycleOneCompletedRunReceiptIdsForRequirement: NonEmptyReadonly<string>;
      readonly cycleTwoCompletedRunReceiptIdsForRequirement: NonEmptyReadonly<string>;
      readonly exactWireAuthFundingFlowPrincipalMfaAdminAndDependentPlatformCoverageDigest: string;
      readonly providerAccountAssetsCleanedAndReusableOrQuarantinedBeforeEitherCyclePassed: true;
      readonly provesBothCyclesCoverEverySelectedUnitForThisExactRequirementAndDistribution: true;
      readonly notApplicableReason?: never;
    }
  : R["liveQualificationMode"] extends "required_remote_upstream_surface"
    ? {
      readonly mode: "required_remote_upstream_surface";
      readonly referenceRequirement: R;
      readonly testedDistributionArtifactDigest: D;
      readonly cycleOneRun: GaRemoteBackedSurfaceQualificationRunReceiptV7<R, 1, D>;
      readonly cycleTwoRun: GaRemoteBackedSurfaceQualificationRunReceiptV7<R, 2, D>;
      readonly twoCycleOccurrenceDisjointness: GaQualificationOccurrenceDisjointnessReceiptV7<
        GaRemoteBackedSurfaceQualificationRunReceiptV7<R, 1, D>["occurrenceIdentity"],
        GaRemoteBackedSurfaceQualificationRunReceiptV7<R, 2, D>["occurrenceIdentity"]
      >;
      readonly provesActualManagedAccountEntitlementSessionOrBridgeWireBillingAndCleanupPassedTwice: true;
      readonly notApplicableReason?: never;
    }
    : R["liveQualificationMode"] extends "required_local_product"
      ? {
        readonly mode: "required_local_product";
        readonly referenceRequirement: R;
        readonly testedDistributionArtifactDigest: D;
        readonly cycleOneRun: GaLocalProductQualificationRunReceiptV7<R, 1, D>;
        readonly cycleTwoRun: GaLocalProductQualificationRunReceiptV7<R, 2, D>;
        readonly twoCycleOccurrenceDisjointness: GaQualificationOccurrenceDisjointnessReceiptV7<
          GaLocalProductQualificationRunReceiptV7<R, 1, D>["occurrenceIdentity"],
          GaLocalProductQualificationRunReceiptV7<R, 2, D>["occurrenceIdentity"]
        >;
        readonly provesRealInstalledLocalProductColdWarmPeerModelProtocolAndRecoveryPassedTwice: true;
        readonly notApplicableReason?: never;
      }
      : R["liveQualificationMode"] extends "required_platform_control"
        ? {
          readonly mode: "required_platform_control";
          readonly referenceRequirement: R;
          readonly testedDistributionArtifactDigest: D;
          readonly platformSecurityProductionClosure: PlatformSecurityProductionClosureV6<D>;
          readonly provesAllPlatformControlProductionQualificationsBindThisDistribution: true;
          readonly notApplicableReason?: never;
        }
        : {
          readonly mode: "not_applicable_user_or_admin_supplied_endpoint";
          readonly referenceRequirement: R;
          readonly testedDistributionArtifactDigest: D;
          readonly notApplicableReason: "not_applicable_user_or_admin_supplied_endpoint";
          readonly provesOnlyUserOrAdminSuppliedCustomEndpointsAreNotPartOfManagedLiveQualification: true;
        };

type GaLiveQualificationDispositionMapV6<D extends string> = {
  readonly [K in ReferenceRequirementKeyV3]: GaLiveQualificationDispositionForRequirementV6<
    ReferenceRowByKeyV3<K>,
    D
  >;
};

declare const gaLiveQualificationReleaseClosureBrandV6: unique symbol;

interface GaLiveQualificationReleaseClosureV6<D extends string = string>
  extends ReceiptRef<"receipt:ga-live-qualification-release-closure@6", D> {
  readonly [gaLiveQualificationReleaseClosureBrandV6]: never;
  readonly testedDistributionArtifactDigest: D;
  readonly referenceRequirementsDigest: string;
  readonly expectedRequirementKeys: NonEmptyReadonly<ReferenceRequirementKeyV3>;
  readonly actualDispositionKeys: NonEmptyReadonly<ReferenceRequirementKeyV3>;
  readonly expectedRequiredRemoteRequirementKeys: NonEmptyReadonly<
    RequiredRemoteQualificationRequirementKeyV6
  >;
  readonly actualTwoCycleQualifiedRemoteRequirementKeys: NonEmptyReadonly<
    RequiredRemoteQualificationRequirementKeyV6
  >;
  readonly expectedExistingConnectionMigrationRequirementKeys: readonly [
    RequiredExistingConnectionMigrationQualificationRequirementKeyV8
  ];
  readonly actualTwoCycleQualifiedExistingConnectionMigrationRequirementKeys: readonly [
    RequiredExistingConnectionMigrationQualificationRequirementKeyV8
  ];
  readonly expectedRequiredRemoteUpstreamSurfaceRequirementKeys: NonEmptyReadonly<RequiredRemoteUpstreamSurfaceRequirementKeyV7>;
  readonly actualTwoCycleQualifiedRemoteUpstreamSurfaceRequirementKeys: NonEmptyReadonly<RequiredRemoteUpstreamSurfaceRequirementKeyV7>;
  readonly expectedRequiredLocalProductRequirementKeys: NonEmptyReadonly<RequiredLocalProductQualificationRequirementKeyV7>;
  readonly actualTwoCycleQualifiedLocalProductRequirementKeys: NonEmptyReadonly<RequiredLocalProductQualificationRequirementKeyV7>;
  readonly expectedRequiredPlatformControlRequirementKeys: NonEmptyReadonly<RequiredPlatformControlQualificationRequirementKeyV7>;
  readonly actualProductionQualifiedPlatformControlRequirementKeys: NonEmptyReadonly<RequiredPlatformControlQualificationRequirementKeyV7>;
  readonly expectedNonRemoteRequirementKeys: NonEmptyReadonly<NonRemoteQualificationRequirementKeyV6>;
  readonly actualCompilerDerivedNotApplicableRequirementKeys: NonEmptyReadonly<
    NonRemoteQualificationRequirementKeyV6
  >;
  readonly dispositions: GaLiveQualificationDispositionMapV6<D>;
  readonly sharedCoveragePlan: GaLiveQualificationCoveragePlanReceiptV6;
  readonly cycleOne: GaLiveQualificationCycleReceiptV6<1, D>;
  readonly cycleTwo: GaLiveQualificationCycleReceiptV6<2, D>;
  readonly twoCycleEvidenceDisjointness: GaTwoCycleEvidenceDisjointnessReceiptV7<D>;
  readonly missingDuplicateOrExtraDispositionCount: 0;
  readonly missingFirstOrSecondCycleRemoteRequirementCount: 0;
  readonly releaseSelectedNotApplicableReasonCount: 0;
  readonly crossDistributionPlanCycleOrRunCount: 0;
  readonly accountLeaseCleanupOrCoverageMismatchCount: 0;
  readonly externalDependencyClassifiedNotApplicableCount: 0;
  readonly migrationOnlyFreshPositiveRunCount: 0;
  readonly reusedRunLeaseCursorPhysicalRequestOrRawEvidenceOccurrenceCount: 0;
  readonly provesEveryRequirementHasExactlyOneDependencyDerivedDispositionAndEveryManagedRemoteLocalAndControlRowPassedItsExactQualification: true;
}

declare function commitGaLiveQualificationReleaseClosureV6<const D extends string>(input: {
  readonly testedDistributionArtifactDigest: D;
  readonly requirements: typeof REFERENCE_REQUIREMENTS_V3;
  readonly requirementsDigest: string;
  readonly sharedCoveragePlan: GaLiveQualificationCoveragePlanReceiptV6;
  readonly cycleOne: GaLiveQualificationCycleReceiptV6<1, D>;
  readonly cycleTwo: GaLiveQualificationCycleReceiptV6<2, D>;
  readonly twoCycleEvidenceDisjointness: GaTwoCycleEvidenceDisjointnessReceiptV7<D>;
  readonly dispositions: GaLiveQualificationDispositionMapV6<D>;
}): DeepFrozenCommittedReceiptV1<GaLiveQualificationReleaseClosureV6<D>>;

interface GaUxPlannedMetricsV2 {
  readonly startingAccountState:
    | "no_account"
    | "account_exists_signed_out"
    | "signed_in_no_billing"
    | "signed_in_ready"
    | "enterprise_admin_required"
    | "local_service_ready"
    | "local_service_installed"
    | "local_service_not_running"
    | "existing_connection_present"
    | "externally_managed_service_ready";
  readonly maximumSaydoPrimaryActions: number;
  readonly maximumExternalTasks: number;
  readonly maximumExternalTasksByClass: {
    readonly accountCreation: number;
    readonly login: number;
    readonly mfa: number;
    readonly billingActivation: number;
    readonly organizationProjectOrTenantSelection: number;
    readonly administratorApproval: number;
    readonly providerCredentialCreation: number;
    readonly enterpriseProxyOrCertificateSetup: number;
    readonly localRuntimeRecovery: number;
  };
  readonly maximumManualFieldsByClass: {
    readonly secret: number;
    readonly credentialHandle: number;
    readonly accountOrPrincipal: number;
    readonly regionOrLocation: number;
    readonly baseUrl: number;
    readonly protocol: number;
    readonly modelOrDeployment: number;
    readonly customHeaderName: number;
  };
  readonly maximumProviderPageSteps: number;
  readonly maximumAdministratorWaitEvents: number;
  readonly maximumCopyPasteCount: number;
  readonly maximumLeaveAndReturnCount: number;
  readonly maximumErrorLoops: number;
  readonly maximumRecoveryActions: number;
  readonly maximumAppElapsedMillis: number;
  readonly maximumRawElapsedMillis: number;
}

interface GaUxActualMetricsV2 {
  readonly startingAccountState: GaUxPlannedMetricsV2["startingAccountState"];
  readonly saydoPrimaryActionCount: number;
  readonly externalTaskCount: number;
  readonly externalTasksByClass: GaUxPlannedMetricsV2["maximumExternalTasksByClass"];
  readonly manualFieldsByClass: GaUxPlannedMetricsV2["maximumManualFieldsByClass"];
  readonly manualFieldCount: number;
  readonly providerPageStepCount: number;
  readonly administratorWaitEventCount: number;
  readonly administratorWaitMillis: number;
  readonly copyPasteCount: number;
  readonly leaveAndReturnCount: number;
  readonly errorLoopCount: number;
  readonly recoveryActionCount: number;
  readonly appElapsedMillis: number;
  readonly rawElapsedMillis: number;
  readonly derivedFromCompleteTypedActionEventLog: true;
  readonly typedActionEventInventoryDigest: string;
  readonly metricReducerReceiptDigest: string;
  readonly provesExternalTaskClassCountsSumToExternalTaskCount: true;
  readonly provesManualFieldClassCountsSumToManualFieldCount: true;
  readonly provesNoUnclassifiedManualFieldProviderStepAdminWaitErrorOrRecoveryEvent: true;
}

type GaReferenceUxClassLimitV3 =
  | {
      readonly limitClass: "zero_config_or_local_ready";
      readonly maximumExternalTasksByClass: { readonly accountCreation: 0; readonly login: 0; readonly mfa: 0; readonly billingActivation: 0; readonly organizationProjectOrTenantSelection: 0; readonly administratorApproval: 0; readonly providerCredentialCreation: 0; readonly enterpriseProxyOrCertificateSetup: 0; readonly localRuntimeRecovery: 0 };
      readonly maximumManualFieldsByClass: { readonly secret: 0; readonly credentialHandle: 0; readonly accountOrPrincipal: 0; readonly regionOrLocation: 0; readonly baseUrl: 0; readonly protocol: 0; readonly modelOrDeployment: 0; readonly customHeaderName: 0 };
    }
  | {
      readonly limitClass: "guided_key";
      readonly maximumExternalTasksByClass: { readonly accountCreation: 1; readonly login: 1; readonly mfa: 3; readonly billingActivation: 1; readonly organizationProjectOrTenantSelection: 1; readonly administratorApproval: 0; readonly providerCredentialCreation: 1; readonly enterpriseProxyOrCertificateSetup: 0; readonly localRuntimeRecovery: 0 };
      readonly maximumManualFieldsByClass: { readonly secret: 1; readonly credentialHandle: 0; readonly accountOrPrincipal: 1; readonly regionOrLocation: 1; readonly baseUrl: 0; readonly protocol: 0; readonly modelOrDeployment: 1; readonly customHeaderName: 0 };
    }
  | {
      readonly limitClass: "guided_oauth_or_subscription";
      readonly maximumExternalTasksByClass: { readonly accountCreation: 1; readonly login: 1; readonly mfa: 3; readonly billingActivation: 1; readonly organizationProjectOrTenantSelection: 1; readonly administratorApproval: 1; readonly providerCredentialCreation: 1; readonly enterpriseProxyOrCertificateSetup: 0; readonly localRuntimeRecovery: 0 };
      readonly maximumManualFieldsByClass: { readonly secret: 0; readonly credentialHandle: 0; readonly accountOrPrincipal: 1; readonly regionOrLocation: 1; readonly baseUrl: 0; readonly protocol: 0; readonly modelOrDeployment: 1; readonly customHeaderName: 0 };
    }
  | {
      readonly limitClass: "enterprise_cloud_or_execution";
      readonly maximumExternalTasksByClass: { readonly accountCreation: 1; readonly login: 1; readonly mfa: 5; readonly billingActivation: 1; readonly organizationProjectOrTenantSelection: 2; readonly administratorApproval: 2; readonly providerCredentialCreation: 1; readonly enterpriseProxyOrCertificateSetup: 1; readonly localRuntimeRecovery: 0 };
      readonly maximumManualFieldsByClass: { readonly secret: 1; readonly credentialHandle: 2; readonly accountOrPrincipal: 1; readonly regionOrLocation: 1; readonly baseUrl: 1; readonly protocol: 1; readonly modelOrDeployment: 1; readonly customHeaderName: 0 };
    }
  | {
      readonly limitClass: "custom_endpoint";
      readonly maximumExternalTasksByClass: { readonly accountCreation: 1; readonly login: 1; readonly mfa: 4; readonly billingActivation: 1; readonly organizationProjectOrTenantSelection: 1; readonly administratorApproval: 1; readonly providerCredentialCreation: 1; readonly enterpriseProxyOrCertificateSetup: 1; readonly localRuntimeRecovery: 0 };
      readonly maximumManualFieldsByClass: { readonly secret: 2; readonly credentialHandle: 2; readonly accountOrPrincipal: 1; readonly regionOrLocation: 1; readonly baseUrl: 1; readonly protocol: 1; readonly modelOrDeployment: 1; readonly customHeaderName: 1 };
    }
  | {
      readonly limitClass: "anchor_control";
      readonly maximumExternalTasksByClass: { readonly accountCreation: 0; readonly login: 0; readonly mfa: 0; readonly billingActivation: 0; readonly organizationProjectOrTenantSelection: 0; readonly administratorApproval: 0; readonly providerCredentialCreation: 0; readonly enterpriseProxyOrCertificateSetup: 1; readonly localRuntimeRecovery: 0 };
      readonly maximumManualFieldsByClass: { readonly secret: 0; readonly credentialHandle: 0; readonly accountOrPrincipal: 0; readonly regionOrLocation: 0; readonly baseUrl: 0; readonly protocol: 0; readonly modelOrDeployment: 0; readonly customHeaderName: 0 };
    };

interface GaReturnFocusEvidenceReceipt extends ReceiptRef {
  readonly policy: ReturnFocusPolicyV1;
  readonly actionNonceDigest: string;
  readonly windowIdBeforeLeave: string;
  readonly routeIdBeforeLeave: string;
  readonly sourceCardId: string;
  readonly controlIdBeforeLeave: string;
  readonly activeElementBeforeLeaveDigest: string;
  readonly accessibilityTreeBeforeLeaveDigest: string;
  readonly returnDestinationKind: "same_control" | "source_card_primary_action" | "source_card_heading" | "supply_page_heading";
  readonly windowIdAfterReturn: string;
  readonly routeIdAfterReturn: string;
  readonly activeElementAfterReturnDigest: string;
  readonly accessibilityTreeAfterReturnDigest: string;
  readonly liveRegionAnnouncementDigest: string;
  readonly restoredOnlyAfterTargetVisibilityEnabledStateAndActionNonceVerified: true;
  readonly provesWindowRouteCardControlAndActionNonceBeforeAfterEquality: true;
  readonly passiveRefreshNeverMovedFocus: true;
}

type GaConditionalRequirementObservationReceiptV1 = ReceiptRef & {
  readonly runId: string;
  readonly journeyGraphId: ReferenceJourneyGraphV3["graphId"];
  readonly journeyStepId: string;
  readonly externalTaskProfileDigest: string;
  readonly parentExternalTaskNonceDigest: string;
  readonly conditionalVariantId: string;
  readonly observedAtMonotonicDigest: string;
} &
  (
    | {
        readonly requirementState: "required";
        readonly authoritativeChallengeEvidence: ImportedOpaqueEvidenceLeafReceipt;
        readonly authoritativeNegativeEvidence?: never;
      }
    | {
        readonly requirementState: "not_required";
        readonly authoritativeChallengeEvidence?: never;
        readonly authoritativeNegativeEvidence: ImportedOpaqueEvidenceLeafReceipt;
      }
  );

type GaEntitlementObservationReceiptV4 = ReceiptRef & {
  readonly runId: string;
  readonly exactRunSubject: GaJourneyRunSubjectV2;
  readonly journeyGraphId: ReferenceJourneyGraphV3["graphId"];
  readonly journeyStepId: string;
  readonly observationProfileDigest: string;
  readonly currentPrincipalDigest: string;
  readonly currentProviderRealmDigest: string;
  readonly exactBillingSubscriptionOrExecutionEntitlementEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly observedAtMonotonicDigest: string;
} &
  (
    | {
        readonly entitlementOutcome: "ready";
        readonly nextStepOrdinalKind: "ready_next_step";
      }
    | {
        readonly entitlementOutcome: "missing";
        readonly nextStepOrdinalKind: "missing_next_step";
      }
  );

type ReferenceConditionalRecipeFieldBindingForRequirementV7<R> = R extends {
  readonly requirementKey: infer K extends ReferenceRequirementKeyV3;
  readonly onboardingRecipe: {
    readonly journeyGraph: infer G extends ReferenceJourneyGraphV3;
    readonly fields: readonly (infer F)[];
  };
}
  ? F extends {
      readonly fieldId: infer I extends ReferenceRecipeFieldV1["fieldId"];
      readonly uxMetricClass: infer M extends keyof GaUxPlannedMetricsV2["maximumManualFieldsByClass"];
      readonly requiredWhen: {
        readonly observationStepId: infer O extends string;
        readonly discriminator: infer D extends `${string}_required`;
        readonly otherwiseFieldMustBeAbsent: true;
      };
    }
    ? {
        readonly requirementKey: K;
        readonly journeyGraphId: G["graphId"];
        readonly fieldId: I;
        readonly manualFieldClass: M;
        readonly observationStepId: O;
        readonly discriminator: D;
      }
    : never
  : never;

type ReferenceConditionalRecipeFieldBindingV7 = ReferenceConditionalRecipeFieldBindingForRequirementV7<
  (typeof REFERENCE_REQUIREMENT_INPUTS_V3)[number]
>;

type ReferenceConditionalNegativeStateV7<D extends `${string}_required`> =
  D extends `${infer Stem}_required` ? `no_${Stem}_required` : never;

type GaConditionalRecipeFieldObservationReceiptV1<
  B extends ReferenceConditionalRecipeFieldBindingV7 = ReferenceConditionalRecipeFieldBindingV7,
> = B extends ReferenceConditionalRecipeFieldBindingV7
  ? ReceiptRef<
      "receipt:conditional-recipe-field-observation@7",
      readonly [B["requirementKey"], B["observationStepId"], B["fieldId"], B["discriminator"]]
    > & {
      readonly runId: string;
      readonly exactRunSubject: GaJourneyRunSubjectV2 & {
        readonly requirementKey: B["requirementKey"];
        readonly referenceRequirement: ReferenceRowByKeyV3<B["requirementKey"]>;
      };
      readonly requirementKey: B["requirementKey"];
      readonly journeyGraphId: B["journeyGraphId"];
      readonly journeyStepId: B["observationStepId"];
      readonly conditionalFieldId: B["fieldId"];
      readonly discriminator: B["discriminator"];
      readonly authoritativeObservationEvidence: ImportedOpaqueEvidenceLeafReceipt;
      readonly observedAtMonotonicDigest: string;
    } &
      (
        | {
            readonly requirementState: B["discriminator"];
            readonly fieldMustBeCommittedBeforeValidation: true;
            readonly fieldMustBeAbsent?: never;
          }
        | {
            readonly requirementState: ReferenceConditionalNegativeStateV7<B["discriminator"]>;
            readonly fieldMustBeCommittedBeforeValidation?: never;
            readonly fieldMustBeAbsent: true;
          }
      )
  : never;

type ReferenceConditionalRecipeFieldBindingKeyV7<
  B extends ReferenceConditionalRecipeFieldBindingV7,
> = B extends ReferenceConditionalRecipeFieldBindingV7
  ? `${B["requirementKey"]}|${B["journeyGraphId"]}|${B["observationStepId"]}|${B["fieldId"]}|${B["manualFieldClass"]}|${B["discriminator"]}|${ReferenceConditionalNegativeStateV7<B["discriminator"]>}`
  : never;

type ReferenceConditionalRecipeFieldBindingKeySetV7 = ReferenceConditionalRecipeFieldBindingKeyV7<
  ReferenceConditionalRecipeFieldBindingV7
>;

type ReferenceConditionalRecipeExpectedBindingKeySetV7 =
  | `opencode.server.http|${typeof JOURNEY_GRAPH_EXECUTION_HTTP_V3.graphId}|observe-server-auth-challenge|server_username|accountOrPrincipal|password_required|no_password_required`
  | `opencode.server.http|${typeof JOURNEY_GRAPH_EXECUTION_HTTP_V3.graphId}|observe-server-auth-challenge|server_password|secret|password_required|no_password_required`
  | `lmstudio.chat|${typeof JOURNEY_GRAPH_LOCAL_OPTIONAL_BEARER_V6.graphId}|observe-local-auth-challenge|api_key|secret|bearer_required|no_bearer_required`
  | `lmstudio.responses|${typeof JOURNEY_GRAPH_LOCAL_OPTIONAL_BEARER_V6.graphId}|observe-local-auth-challenge|api_key|secret|bearer_required|no_bearer_required`
  | `lmstudio.messages|${typeof JOURNEY_GRAPH_LOCAL_OPTIONAL_ANTHROPIC_AUTH_V9.graphId}|observe-local-auth-challenge|api_key|secret|secret_required|no_secret_required`
  | `litellm.bridge.openai|${typeof JOURNEY_GRAPH_BRIDGE_OPENAI_V4.graphId}|observe-bridge-auth-challenge|api_key|secret|secret_required|no_secret_required`
  | `litellm.bridge.responses|${typeof JOURNEY_GRAPH_BRIDGE_OPENAI_V4.graphId}|observe-bridge-auth-challenge|api_key|secret|secret_required|no_secret_required`
  | `litellm.bridge.messages|${typeof JOURNEY_GRAPH_BRIDGE_OPENAI_V4.graphId}|observe-bridge-auth-challenge|api_key|secret|secret_required|no_secret_required`;

type _ReferenceConditionalRecipeFieldBindingsAreExactV7 = ReferenceInvariantTrueV3<
  ReferenceInvariantEqualV3<
    ReferenceConditionalRecipeFieldBindingKeySetV7,
    ReferenceConditionalRecipeExpectedBindingKeySetV7
  >
>;

declare const referenceConditionalRecipeFieldCompilerBrandV7: unique symbol;

interface ReferenceConditionalRecipeFieldCompilerReceiptV7 extends ReceiptRef<
  "receipt:reference-conditional-recipe-field-compiler@7",
  typeof REFERENCE_REQUIREMENT_INPUTS_V3
> {
  readonly [referenceConditionalRecipeFieldCompilerBrandV7]: never;
  readonly compilerArtifact: ReceiptRef<"receipt:reference-conditional-recipe-field-compiler-artifact@7">;
  readonly exactRequirementInputs: typeof REFERENCE_REQUIREMENT_INPUTS_V3;
  readonly expectedBindingKeys: readonly ReferenceConditionalRecipeExpectedBindingKeySetV7[];
  readonly actualBindingKeys: readonly ReferenceConditionalRecipeFieldBindingKeySetV7[];
  readonly conditionalFieldOccurrenceCount: 8;
  readonly positiveGoldenFixtureCount: 8;
  readonly negativeGoldenFixtureCount: 8;
  readonly requiredMutationKinds: readonly [
    "missing_field",
    "duplicate_field",
    "wrong_field_id",
    "wrong_metric_class",
    "wrong_requirement_or_journey",
    "wrong_observation_step",
    "wrong_discriminator",
    "positive_negative_polarity_swap",
    "cross_run_receipt_swap",
  ];
  readonly missingDuplicateExtraOrUnrepresentableBindingCount: 0;
  readonly survivingMutationCount: 0;
  readonly provesRecipeGraphObservationEventReducerAndGoldenCorpusShareTheSameGeneratedBindingSet: true;
}

declare function compileReferenceConditionalRecipeFieldsV7(input: {
  readonly requirementInputs: typeof REFERENCE_REQUIREMENT_INPUTS_V3;
  readonly compilerArtifact: ReceiptRef<"receipt:reference-conditional-recipe-field-compiler-artifact@7">;
  readonly positiveAndNegativeGoldenCorpus: NonEmptyReadonly<ImportedOpaqueEvidenceLeafReceipt>;
  readonly mutationCorpus: NonEmptyReadonly<ImportedOpaqueEvidenceLeafReceipt>;
}): DeepFrozenCommittedReceiptV1<ReferenceConditionalRecipeFieldCompilerReceiptV7>;

type GaConditionalManualFieldCommittedEventV7<
  B extends ReferenceConditionalRecipeFieldBindingV7 = ReferenceConditionalRecipeFieldBindingV7,
> = B extends ReferenceConditionalRecipeFieldBindingV7
  ? {
      readonly eventKind: "manual_field_committed";
      readonly fieldId: B["fieldId"];
      readonly manualFieldClass: B["manualFieldClass"];
      readonly provesFieldIdAndMetricClassEqualExactRunRecipeField: true;
      readonly fieldRequirement: "conditional";
      readonly conditionalFieldObservation: Extract<
        GaConditionalRecipeFieldObservationReceiptV1<B>,
        { readonly requirementState: B["discriminator"] }
      >;
    }
  : never;

type GaUxActionEventV3 = ReceiptRef & {
  readonly runId: string;
  readonly eventOrdinal: number;
  readonly actionNonceDigest: string;
  readonly sourceCardId: string;
  readonly occurredAtMonotonicDigest: string;
  readonly occurredAtMonotonicMillis: number;
  readonly monotonicClockBootIdDigest: string;
  readonly provesTimestampIsSafeNonNegativeIntegerAndOrdinalStrictlyIncreases: true;
} &
  (
    | {
        readonly eventKind: "run_started";
        readonly runStartNonceDigest: string;
        readonly initialVisibility: "foreground" | "background";
      }
    | { readonly eventKind: "run_terminal"; readonly runStartNonceDigest: string; readonly terminalKind: "completed" | "failed" | "cancelled" }
    | {
        readonly eventKind: "saydo_primary_action";
        readonly journeyStepId: string;
        readonly actionId: string;
        readonly provesStepWasVisitedUserTriggeredAndActionIdEqualsExactPrimaryActionId: true;
      }
    | ({ readonly eventKind: "external_task_started"; readonly externalTaskNonceDigest: string; readonly externalTaskClass: keyof GaUxPlannedMetricsV2["maximumExternalTasksByClass"] } &
        (
          | {
              readonly externalTaskScope: "graph_step";
              readonly journeyGraphId: ReferenceJourneyGraphV3["graphId"];
              readonly journeyStepId: string;
              readonly externalTaskProfileDigest: string;
              readonly parentExternalTaskNonceDigest?: never;
              readonly conditionalVariantId?: never;
              readonly conditionalRequirementObservation?: never;
            }
          | {
              readonly externalTaskScope: "conditional_nested";
              readonly journeyGraphId: ReferenceJourneyGraphV3["graphId"];
              readonly journeyStepId: string;
              readonly externalTaskProfileDigest: string;
              readonly parentExternalTaskNonceDigest: string;
              readonly conditionalVariantId: string;
              readonly conditionalRequirementObservation: GaConditionalRequirementObservationReceiptV1 & {
                readonly requirementState: "required";
              };
            }
        ))
    | { readonly eventKind: "external_task_terminal"; readonly externalTaskNonceDigest: string; readonly terminalKind: "completed" | "failed" | "cancelled" }
    | { readonly eventKind: "administrator_wait_started"; readonly administratorWaitNonceDigest: string }
    | { readonly eventKind: "administrator_wait_terminal"; readonly administratorWaitNonceDigest: string; readonly terminalKind: "approved" | "rejected" | "cancelled" }
    | { readonly eventKind: "copy_or_paste"; readonly operation: "copy" | "paste"; readonly transferNonceDigest: string }
    | {
        readonly eventKind: "conditional_requirement_observed";
        readonly observation: GaConditionalRequirementObservationReceiptV1;
      }
    | {
        readonly eventKind: "entitlement_observed";
        readonly observation: GaEntitlementObservationReceiptV4;
      }
    | {
        readonly eventKind: "app_visibility_changed";
        readonly visibility: "foreground" | "background";
        readonly visibilityIntervalNonceDigest: string;
      }
    | {
        readonly eventKind: "manual_field_committed";
        readonly fieldId: ReferenceRecipeFieldV1["fieldId"];
        readonly manualFieldClass: keyof GaUxPlannedMetricsV2["maximumManualFieldsByClass"];
        readonly provesFieldIdAndMetricClassEqualExactRunRecipeField: true;
        readonly fieldRequirement: "unconditional";
        readonly conditionalFieldObservation?: never;
      }
    | GaConditionalManualFieldCommittedEventV7
    | {
        readonly eventKind: "conditional_recipe_field_observed";
        readonly observation: GaConditionalRecipeFieldObservationReceiptV1;
      }
    | { readonly eventKind: "provider_page_step"; readonly providerStepId: string }
    | { readonly eventKind: "leave_application"; readonly controlIdBeforeLeave: string }
    | { readonly eventKind: "return_focus_restored"; readonly returnFocusEvidence: GaReturnFocusEvidenceReceipt }
    | { readonly eventKind: "error_loop"; readonly errorClass: string }
    | { readonly eventKind: "recovery_action"; readonly recoveryActionId: string }
  );

interface GaUxMetricReducerBaseV4 extends ReceiptRef {
  readonly schemaVersion: "saydo.dev/ga-ux-metric-reducer/v4";
  readonly runSubject: GaJourneyRunSubjectV2;
  readonly orderedTypedActionEvents: NonEmptyReadonly<GaUxActionEventV3>;
  readonly typedActionEventInventoryDigest: string;
  readonly reducerAlgorithm: "ux-event-total-function-monotonic-interval-fold-v4";
  readonly exactExternalTaskPairSetDigest: string;
  readonly exactAdministratorWaitPairSetDigest: string;
  readonly exactCopyPasteOccurrenceSetDigest: string;
  readonly exactAppVisibilityIntervalSetDigest: string;
  readonly exactLeaveReturnFocusPairSetDigest: string;
  readonly exactManualRecipeFieldOccurrenceSetDigest: string;
  readonly exactVisitedJourneyStepSetDigest: string;
  readonly runIntervalDigest: string;
  readonly outputMetrics: GaUxActualMetricsV2;
  readonly exactlyOneRunStartedAndOneLaterRunTerminalEventExistForTheSameRunStartNonce: true;
  readonly everyEventRunIdActionNonceSourceCardAndClockBootBelongToTheExactRunSubjectAndInventory: true;
  readonly everyStartHasExactlyOneSameNonceTerminalAfterItAndNoTerminalIsReused: true;
  readonly rawElapsedEqualsRunTerminalMinusRunStartOnOneMonotonicClock: true;
  readonly appElapsedEqualsUnionOfForegroundIntervalsClippedToRunInterval: true;
  readonly initialVisibilityComesOnlyFromRunStartedEvent: true;
  readonly visibilityChangesStrictlyAlternateAndNeverRestateCurrentVisibility: true;
  readonly finalVisibilityIntervalClosesAtRunTerminal: true;
  readonly intervalsAreHalfOpenAndEqualTimestampEventsUseEventOrdinalOrder: true;
  readonly administratorWaitMillisEqualsSumOfDisjointPairedWaitIntervals: true;
  readonly copyPasteCountEqualsExactCopyAndPasteEventCount: true;
  readonly manualFieldCountsAndClassesDeriveFromExactRecipeFieldIdsWithoutTrustingUiCounters: true;
  readonly everyConditionalNestedExternalTaskBindsAnExactGraphVariantParentNonceAndSignedClassLimit: true;
  readonly everyVisitedEntitlementObservationStepHasExactlyOneCurrentPrincipalEvidenceAndExactSelectedSuccessor: true;
  readonly everyConditionalRecipeFieldHasExactlyOneAuthoritativeObservation: true;
  readonly requiredChallengeObservationHasExactlyOneMatchingCommittedFieldAndNegativeObservationHasNone: true;
  readonly everyVisitedUserTriggeredStepHasExactlyOneMatchingPrimaryActionEventAndEveryAutomaticStepHasNone: true;
  readonly allScalarAndPerClassMetricsAreTotalFunctionsOfTheOrderedEventUnion: true;
  readonly missingTerminalClockMismatchOverlapCompressionOrUnclassifiedEventIsRejected: true;
  readonly reducerExitCode: 0;
}

type GaJourneyFoldFailureReasonV1 =
  | "run_failed"
  | "run_cancelled"
  | "external_task_failed"
  | "external_task_cancelled"
  | "administrator_rejected"
  | "administrator_cancelled"
  | "required_conditional_task_missing_or_failed"
  | "graph_successor_not_reached";

type GaUxMetricReducerReceiptV4 = GaUxMetricReducerBaseV4 &
  (
    | {
        readonly foldOutcome: "success";
        readonly runTerminalKind: "completed";
        readonly failureReasons: readonly [];
        readonly allExternalTaskTerminalsCompleted: true;
        readonly allAdministratorWaitTerminalsApproved: true;
        readonly everyRequiredConditionalVariantHasExactlyOneCompletedNestedTask: true;
        readonly everyNotRequiredConditionalVariantHasNoNestedTask: true;
        readonly exactGraphTerminalReachedFromVisitedSuccessors: true;
      }
    | {
        readonly foldOutcome: "failed";
        readonly runTerminalKind: "failed" | "cancelled" | "completed";
        readonly failureReasons: NonEmptyReadonly<GaJourneyFoldFailureReasonV1>;
        readonly passReceiptForbidden: true;
      }
  );

interface GaUxMetricReductionRejectionReceiptV4 extends ReceiptRef {
  readonly orderedTypedActionEvents: readonly GaUxActionEventV3[];
  readonly rejectionKind:
    | "run_terminal_missing"
    | "nonce_pairing_invalid"
    | "clock_boot_or_order_invalid"
    | "visibility_interval_invalid"
    | "conditional_observation_or_task_invalid"
    | "unclassified_event";
  readonly foldOutcome: "incomplete";
  readonly completedPassForbidden: true;
}

type GaUxScalarMetricKeyV3 =
  | "saydoPrimaryActionCount"
  | "externalTaskCount"
  | "manualFieldCount"
  | "providerPageStepCount"
  | "administratorWaitEventCount"
  | "administratorWaitMillis"
  | "copyPasteCount"
  | "leaveAndReturnCount"
  | "errorLoopCount"
  | "recoveryActionCount"
  | "appElapsedMillis"
  | "rawElapsedMillis";

interface GaUxScalarComparisonReceiptV3<K extends GaUxScalarMetricKeyV3 = GaUxScalarMetricKeyV3>
  extends ReceiptRef {
  readonly metricKey: K;
  readonly actualValue: GaUxActualMetricsV2[K];
  readonly signedLimitField: keyof GaReferenceUxLimitV2;
  readonly signedLimitValue: number;
  readonly outcome: "within_limit" | "exceeded";
  readonly provesActualAndLimitWereReadFromExactMetricAndSignedLimitObjects: true;
}

type GaUxScalarComparisonTupleV3 = readonly [
  GaUxScalarComparisonReceiptV3<"saydoPrimaryActionCount">,
  GaUxScalarComparisonReceiptV3<"externalTaskCount">,
  GaUxScalarComparisonReceiptV3<"manualFieldCount">,
  GaUxScalarComparisonReceiptV3<"providerPageStepCount">,
  GaUxScalarComparisonReceiptV3<"administratorWaitEventCount">,
  GaUxScalarComparisonReceiptV3<"administratorWaitMillis">,
  GaUxScalarComparisonReceiptV3<"copyPasteCount">,
  GaUxScalarComparisonReceiptV3<"leaveAndReturnCount">,
  GaUxScalarComparisonReceiptV3<"errorLoopCount">,
  GaUxScalarComparisonReceiptV3<"recoveryActionCount">,
  GaUxScalarComparisonReceiptV3<"appElapsedMillis">,
  GaUxScalarComparisonReceiptV3<"rawElapsedMillis">,
];

declare const gaUxPassGateBrand: unique symbol;

interface GaUxPerClassGateReceipt extends ReceiptRef {
  readonly referenceScalarLimits: GaReferenceUxLimitV2;
  readonly referenceClassLimits: GaReferenceUxClassLimitV3;
  readonly actualMetrics: GaUxActualMetricsV2;
  readonly metricReducer: Extract<GaUxMetricReducerReceiptV4, { readonly foldOutcome: "success" }>;
  readonly actualMetricsExactlyEqualMetricReducerOutput: true;
  readonly scalarLimitClassEqualsClassLimitClass: true;
  readonly everyExternalTaskClassActualAtOrBelowReferenceMaximum: true;
  readonly everyManualFieldClassActualAtOrBelowReferenceMaximum: true;
  readonly externalTaskClassSumEqualsActualTotalAndActualTotalAtOrBelowScalarMaximum: true;
  readonly manualFieldClassSumEqualsActualTotalAndActualTotalAtOrBelowScalarMaximum: true;
  readonly administratorWaitEventAndMillisAtOrBelowSignedScalarMaximum: true;
  readonly scalarComparisons: GaUxScalarComparisonTupleV3;
  readonly scalarViolationKeys: readonly [];
  readonly everyScalarMetricHasExactlyOneComparisonAndEveryComparisonIsWithinLimit: true;
  readonly noWiderJourneyDeclaredClassLimitCanSubstituteForSignedReferenceLimit: true;
  readonly computedOutcome: "completed_pass";
  readonly [gaUxPassGateBrand]: "total_comparison_function_private_constructor";
}

declare function computeGaUxPerClassPassGateV3(input: {
  readonly referenceScalarLimits: GaReferenceUxLimitV2;
  readonly referenceClassLimits: GaReferenceUxClassLimitV3;
  readonly metricReducer: Extract<GaUxMetricReducerReceiptV4, { readonly foldOutcome: "success" }>;
}): GaUxPerClassGateReceipt;

interface GaUxEventMetricVectorV2 {
  readonly saydoPrimaryActionCount: number;
  readonly externalTaskCount: number;
  readonly manualFieldCount: number;
  readonly providerPageStepCount: number;
  readonly administratorWaitEventCount: number;
  readonly administratorWaitMillis: number;
  readonly copyPasteCount: number;
  readonly leaveAndReturnCount: number;
  readonly errorLoopCount: number;
  readonly recoveryActionCount: number;
  readonly appElapsedMillis: number;
  readonly rawElapsedMillis: number;
}

interface GaZeroUxEventMetricVectorV2 extends GaUxEventMetricVectorV2 {
  readonly saydoPrimaryActionCount: 0;
  readonly externalTaskCount: 0;
  readonly manualFieldCount: 0;
  readonly providerPageStepCount: 0;
  readonly administratorWaitEventCount: 0;
  readonly administratorWaitMillis: 0;
  readonly copyPasteCount: 0;
  readonly leaveAndReturnCount: 0;
  readonly errorLoopCount: 0;
  readonly recoveryActionCount: 0;
  readonly appElapsedMillis: 0;
  readonly rawElapsedMillis: 0;
}

type GaReferenceUxLimitV2 =
  | {
      readonly limitClass: "zero_config_or_local_ready";
      readonly maximumMainJourneySaydoPrimaryActions: 1;
      readonly maximumAnchorPrerequisiteSaydoPrimaryActions: 2;
      readonly maximumSaydoPrimaryActions: 3;
      readonly maximumExternalTasks: 0;
      readonly maximumAdministratorWaitEvents: 0;
      readonly maximumAdministratorWaitMillis: 0;
      readonly maximumManualFields: 0;
      readonly maximumProviderPageSteps: 0;
      readonly maximumCopyPasteCount: 0;
      readonly maximumLeaveAndReturnCount: 0;
      readonly maximumErrorLoops: 0;
      readonly maximumRecoveryActions: 1;
      readonly maximumMainJourneyAppElapsedMillis: 60_000;
      readonly maximumAnchorPrerequisiteAppElapsedMillis: 180_000;
      readonly maximumAppElapsedMillis: 240_000;
      readonly maximumMainJourneyRawElapsedMillis: 180_000;
      readonly maximumAnchorPrerequisiteRawElapsedMillis: 900_000;
      readonly maximumRawElapsedMillis: 1_080_000;
      readonly provesCombinedActionAndElapsedLimitsEqualMainPlusAnchorPrerequisiteLimits: true;
    }
  | {
      readonly limitClass: "guided_key";
      readonly maximumMainJourneySaydoPrimaryActions: 4;
      readonly maximumAnchorPrerequisiteSaydoPrimaryActions: 2;
      readonly maximumSaydoPrimaryActions: 6;
      readonly maximumExternalTasks: 7;
      readonly maximumAdministratorWaitEvents: 1;
      readonly maximumAdministratorWaitMillis: 900_000;
      readonly maximumManualFields: 2;
      readonly maximumProviderPageSteps: 6;
      readonly maximumCopyPasteCount: 2;
      readonly maximumLeaveAndReturnCount: 3;
      readonly maximumErrorLoops: 2;
      readonly maximumRecoveryActions: 3;
      readonly maximumMainJourneyAppElapsedMillis: 300_000;
      readonly maximumAnchorPrerequisiteAppElapsedMillis: 180_000;
      readonly maximumAppElapsedMillis: 480_000;
      readonly maximumMainJourneyRawElapsedMillis: 900_000;
      readonly maximumAnchorPrerequisiteRawElapsedMillis: 900_000;
      readonly maximumRawElapsedMillis: 1_800_000;
      readonly provesCombinedActionAndElapsedLimitsEqualMainPlusAnchorPrerequisiteLimits: true;
    }
  | {
      readonly limitClass: "guided_oauth_or_subscription";
      readonly maximumMainJourneySaydoPrimaryActions: 3;
      readonly maximumAnchorPrerequisiteSaydoPrimaryActions: 2;
      readonly maximumSaydoPrimaryActions: 5;
      readonly maximumExternalTasks: 7;
      readonly maximumAdministratorWaitEvents: 1;
      readonly maximumAdministratorWaitMillis: 1_200_000;
      readonly maximumManualFields: 1;
      readonly maximumProviderPageSteps: 10;
      readonly maximumCopyPasteCount: 0;
      readonly maximumLeaveAndReturnCount: 3;
      readonly maximumErrorLoops: 2;
      readonly maximumRecoveryActions: 4;
      readonly maximumMainJourneyAppElapsedMillis: 300_000;
      readonly maximumAnchorPrerequisiteAppElapsedMillis: 180_000;
      readonly maximumAppElapsedMillis: 480_000;
      readonly maximumMainJourneyRawElapsedMillis: 1_200_000;
      readonly maximumAnchorPrerequisiteRawElapsedMillis: 900_000;
      readonly maximumRawElapsedMillis: 2_100_000;
      readonly provesCombinedActionAndElapsedLimitsEqualMainPlusAnchorPrerequisiteLimits: true;
    }
  | {
      readonly limitClass: "enterprise_cloud_or_execution";
      readonly maximumMainJourneySaydoPrimaryActions: 4;
      readonly maximumAnchorPrerequisiteSaydoPrimaryActions: 2;
      readonly maximumSaydoPrimaryActions: 6;
      readonly maximumExternalTasks: 10;
      readonly maximumAdministratorWaitEvents: 2;
      readonly maximumAdministratorWaitMillis: 86_400_000;
      readonly maximumManualFields: 4;
      readonly maximumProviderPageSteps: 12;
      readonly maximumCopyPasteCount: 2;
      readonly maximumLeaveAndReturnCount: 4;
      readonly maximumErrorLoops: 2;
      readonly maximumRecoveryActions: 4;
      readonly maximumMainJourneyAppElapsedMillis: 600_000;
      readonly maximumAnchorPrerequisiteAppElapsedMillis: 180_000;
      readonly maximumAppElapsedMillis: 780_000;
      readonly maximumMainJourneyRawElapsedMillis: 1_800_000;
      readonly maximumAnchorPrerequisiteRawElapsedMillis: 900_000;
      readonly maximumRawElapsedMillis: 2_700_000;
      readonly provesCombinedActionAndElapsedLimitsEqualMainPlusAnchorPrerequisiteLimits: true;
    }
  | {
      readonly limitClass: "custom_endpoint";
      readonly maximumMainJourneySaydoPrimaryActions: 5;
      readonly maximumAnchorPrerequisiteSaydoPrimaryActions: 2;
      readonly maximumSaydoPrimaryActions: 7;
      readonly maximumExternalTasks: 8;
      readonly maximumAdministratorWaitEvents: 1;
      readonly maximumAdministratorWaitMillis: 3_600_000;
      readonly maximumManualFields: 6;
      readonly maximumProviderPageSteps: 10;
      readonly maximumCopyPasteCount: 2;
      readonly maximumLeaveAndReturnCount: 3;
      readonly maximumErrorLoops: 2;
      readonly maximumRecoveryActions: 4;
      readonly maximumMainJourneyAppElapsedMillis: 600_000;
      readonly maximumAnchorPrerequisiteAppElapsedMillis: 180_000;
      readonly maximumAppElapsedMillis: 780_000;
      readonly maximumMainJourneyRawElapsedMillis: 1_800_000;
      readonly maximumAnchorPrerequisiteRawElapsedMillis: 900_000;
      readonly maximumRawElapsedMillis: 2_700_000;
      readonly provesCombinedActionAndElapsedLimitsEqualMainPlusAnchorPrerequisiteLimits: true;
    }
  | {
      readonly limitClass: "anchor_control";
      readonly maximumMainJourneySaydoPrimaryActions: 2;
      readonly maximumAnchorPrerequisiteSaydoPrimaryActions: 0;
      readonly maximumSaydoPrimaryActions: 2;
      readonly maximumExternalTasks: 1;
      readonly maximumAdministratorWaitEvents: 0;
      readonly maximumAdministratorWaitMillis: 0;
      readonly maximumManualFields: 0;
      readonly maximumProviderPageSteps: 0;
      readonly maximumCopyPasteCount: 0;
      readonly maximumLeaveAndReturnCount: 1;
      readonly maximumErrorLoops: 1;
      readonly maximumRecoveryActions: 2;
      readonly maximumMainJourneyAppElapsedMillis: 180_000;
      readonly maximumAnchorPrerequisiteAppElapsedMillis: 0;
      readonly maximumAppElapsedMillis: 180_000;
      readonly maximumMainJourneyRawElapsedMillis: 900_000;
      readonly maximumAnchorPrerequisiteRawElapsedMillis: 0;
      readonly maximumRawElapsedMillis: 900_000;
      readonly provesCombinedActionAndElapsedLimitsEqualMainPlusAnchorPrerequisiteLimits: true;
    };

interface GaJourneyStepUxCostProfileV9 {
  readonly stepOrdinal: number;
  readonly stepKind: ReferenceJourneyStepV3["stepKind"];
  readonly transitionTrigger: ReferenceJourneyStepV3["transitionTrigger"];
  readonly baseMetrics: GaUxEventMetricVectorV2;
  readonly externalTaskClassOccurrences: Readonly<GaUxPlannedMetricsV2["maximumExternalTasksByClass"]>;
  readonly manualFieldClassOccurrences: Readonly<GaUxPlannedMetricsV2["maximumManualFieldsByClass"]>;
  readonly conditionalExpansions: readonly {
    readonly predicate: "challenge_present" | "challenge_absent" | "entitlement_missing" | "entitlement_ready";
    readonly branchNextStepOrdinal: number;
    readonly additionalMetrics: GaUxEventMetricVectorV2;
    readonly nestedExternalTaskClassOccurrences: Readonly<GaUxPlannedMetricsV2["maximumExternalTasksByClass"]>;
  }[];
}

interface GaAnchorPrerequisiteUxCostProfileV9 {
  readonly startingAnchorState: "ready" | "not_enrolled";
  readonly compositionMode: "already_ready_zero_cost" | "fresh_enrollment_composed" | "journey_is_anchor_control";
  readonly exactOrderedStepProfiles: readonly GaJourneyStepUxCostProfileV9[];
  readonly aggregateMetrics: GaUxEventMetricVectorV2;
}

interface GaVersionedJourneyGraphUxBudgetInputV5 {
  readonly requirementKey: ReferenceRequirementKeyV3;
  readonly journeyGraph: ReferenceJourneyGraphV3;
  readonly startingAccountState: ReferenceStartingAccountStateV3;
  readonly exactEntryStepOrdinal: number;
  readonly exactOrderedStepCostProfiles: NonEmptyReadonly<GaJourneyStepUxCostProfileV9>;
  readonly anchorPrerequisiteProfile: GaAnchorPrerequisiteUxCostProfileV9;
  readonly terminalSuccessState: ReferenceJourneyGraphV3["terminalState"];
  readonly provesStepProfilesAreAnExactOrdinalKindTriggerAndBranchBijectionWithTheGraph: true;
}

interface GaDerivedJourneyUxLimitLineV5 {
  readonly input: GaVersionedJourneyGraphUxBudgetInputV5;
  readonly exactWorstForwardPathStepOrdinals: NonEmptyReadonly<number>;
  readonly exactWorstForwardPathDigest: string;
  readonly typedInputAndConditionalExpansionDigest: string;
  readonly derivedScalarLimits: GaReferenceUxLimitV2;
  readonly derivedClassLimits: GaReferenceUxClassLimitV3;
  readonly provesEveryCountAndDurationIsAProjectionOfTypedVisitedStepsConditionalBranchesAndAnchorComposition: true;
}

declare const gaDerivedUxLimitBrandV5: unique symbol;

type GaDerivedJourneyUxLimitSetReceiptV5 = ReceiptRef & {
  readonly schemaVersion: "saydo.dev/ga-derived-journey-ux-limit-set/v5";
  readonly versionedJourneyGraphSetDigest: string;
  readonly derivationAlgorithm: "total-worst-forward-path-fold-over-versioned-journey-graph-v5";
  readonly derivedLines: NonEmptyReadonly<GaDerivedJourneyUxLimitLineV5>;
  readonly duplicateRequirementAndStartingStateCount: 0;
  readonly missingRequirementAndStartingStateCount: 0;
  readonly unreachableOrNonterminalPathCount: 0;
  readonly guidedKeyNoAccountMainJourneyMaximumSaydoPrimaryActions: 4;
  readonly handMaintainedReleaseScalarOverrideCount: 0;
  readonly provesEveryReferenceRequirementStartingStateHasExactlyOneDerivedLineAndEveryReleaseGateConsumesIt: true;
  readonly [gaDerivedUxLimitBrandV5]: "versioned_journey_graph_limit_generator";
};

declare function deriveGaJourneyUxLimitsFromVersionedGraphsV5(input: {
  readonly requirements: typeof REFERENCE_REQUIREMENTS_V3;
  readonly exactRequirementStartingStateInputs: NonEmptyReadonly<GaVersionedJourneyGraphUxBudgetInputV5>;
  readonly independentTotalPathFoldProfile: ReceiptRef<"receipt:ga-ux-total-path-fold-profile@9">;
}): DeepFrozenCommittedReceiptV1<GaDerivedJourneyUxLimitSetReceiptV5>;

type GaAnchorPrerequisiteClosureReceipt = ReceiptRef &
  (
    | {
        readonly startingAnchorState: "ready";
        readonly prerequisiteMode: "already_ready";
        readonly startingAnchor: SecurityMonotonicAnchorReceipt;
        readonly enrollmentJourney?: never;
        readonly prerequisiteActionEvents: readonly [];
        readonly prerequisiteActionEventSetDigest: "sha256-empty-set";
        readonly prerequisiteUxMetrics: GaZeroUxEventMetricVectorV2;
        readonly automaticallyResumedMainJourneyWithoutAdditionalUserAction: true;
      }
    | {
        readonly startingAnchorState: "not_enrolled";
        readonly prerequisiteMode: "fresh_enrollment_composed";
        readonly startingAnchor?: never;
        readonly enrollmentJourney: AnchorBootstrapEnrollmentCommitReceipt;
        readonly resultingAnchor: SecurityMonotonicAnchorReceipt;
        readonly prerequisiteActionEvents: NonEmptyReadonly<ReceiptRef>;
        readonly prerequisiteActionEventSetDigest: string;
        readonly prerequisiteActionEventCount: number;
        readonly prerequisiteUxMetrics: GaUxEventMetricVectorV2;
        readonly automaticallyResumedMainJourneyWithoutAdditionalUserAction: true;
        readonly provesPrerequisiteActionEventCountPositiveAndEqualsExactEventSet: true;
        readonly provesEnrollmentActionsExternalTasksCopyPasteLeaveReturnAndElapsedTimeAreIncludedInUnifiedRunInventory: true;
      }
    | {
        readonly startingAnchorState: "not_enrolled" | "ready";
        readonly prerequisiteMode: "journey_is_anchor_control";
        readonly anchorControlJourneyEvidence: ReceiptRef;
        readonly prerequisiteActionEvents: readonly [];
        readonly prerequisiteActionEventSetDigest: "sha256-empty-set";
        readonly prerequisiteUxMetrics: GaZeroUxEventMetricVectorV2;
        readonly automaticallyResumedMainJourneyWithoutAdditionalUserAction: true;
      }
  );

interface GaJourneyDefinitionBaseV2 {
  readonly subject: GaJourneySubjectTemplateV1;
  readonly expectedFixtureSetDigest: string;
  readonly runnerProfileDigest: string;
  readonly requiredPlatformProfileDigests: NonEmptyReadonly<string>;
  readonly requiredUserLocales: readonly ["zh-CN", "en-US", "ar-SA"];
  readonly requiredPseudoLocaleSuites: readonly ["en-XA"];
  readonly requiredAnchorStartStates: readonly ["not_enrolled", "ready"];
  readonly requiredStartingAccountStates: NonEmptyReadonly<ReferenceStartingAccountStateV3>;
  readonly journeyGraph: ReferenceJourneyGraphV3;
  readonly requiredUserRunSubjectDigests: NonEmptyReadonly<string>;
  readonly requiredPseudoLocaleRunSubjectDigests: NonEmptyReadonly<string>;
  readonly referenceRunSubjectDerivation: ReferenceRunSubjectDerivationReceiptV4;
  readonly derivedUxLimitSet: GaDerivedJourneyUxLimitSetReceiptV5;
  readonly runSubjectDerivationAlgorithm: ReferenceRunSubjectDerivationReceiptV4["derivationAlgorithm"];
  readonly provesRequiredAccountStatesAndJourneyGraphEqualExactReferenceRequirementProjection: true;
  readonly provesUserAndPseudoRunsEqualExactTypedDerivationWithoutGenericSignedInSubstitution: true;
  readonly referenceUxLimitDigest: string;
  readonly referenceUxClassLimitDigest: string;
  readonly selfDeclaredWiderUxPlanIgnoredByReleaseGate: true;
  readonly provesReferenceUxLimitDigestEqualsExactProfileLimitForJourneyClassAndTier: true;
  readonly provesReferenceUxLimitsAreTheExactDerivedLineForEveryRequiredStartingAccountStateWithoutManualScalarOverride: true;
  readonly typedActionEventSchemaDigest: string;
  readonly recoveryScenarioSetDigest: string;
}

type GaSupplyJourneyUxBindingV2 =
  | {
      readonly journeyTier: "zero_config";
      readonly referenceUxLimits: Extract<
        GaReferenceUxLimitV2,
        { readonly limitClass: "zero_config_or_local_ready" }
      >;
      readonly referenceUxClassLimits: Extract<
        GaReferenceUxClassLimitV3,
        { readonly limitClass: "zero_config_or_local_ready" }
      >;
    }
  | {
      readonly journeyTier: "guided_key";
      readonly referenceUxLimits: Extract<GaReferenceUxLimitV2, { readonly limitClass: "guided_key" }>;
      readonly referenceUxClassLimits: Extract<GaReferenceUxClassLimitV3, { readonly limitClass: "guided_key" }>;
    }
  | {
      readonly journeyTier: "guided_oauth";
      readonly referenceUxLimits: Extract<
        GaReferenceUxLimitV2,
        { readonly limitClass: "guided_oauth_or_subscription" }
      >;
      readonly referenceUxClassLimits: Extract<
        GaReferenceUxClassLimitV3,
        { readonly limitClass: "guided_oauth_or_subscription" }
      >;
    }
  | {
      readonly journeyTier: "enterprise_managed";
      readonly referenceUxLimits: Extract<
        GaReferenceUxLimitV2,
        { readonly limitClass: "enterprise_cloud_or_execution" }
      >;
      readonly referenceUxClassLimits: Extract<
        GaReferenceUxClassLimitV3,
        { readonly limitClass: "enterprise_cloud_or_execution" }
      >;
    }
  | {
      readonly journeyTier: "custom_endpoint";
      readonly referenceUxLimits: Extract<GaReferenceUxLimitV2, { readonly limitClass: "custom_endpoint" }>;
      readonly referenceUxClassLimits: Extract<
        GaReferenceUxClassLimitV3,
        { readonly limitClass: "custom_endpoint" }
      >;
    }
  | {
      readonly journeyTier: "migration_only";
      readonly referenceUxLimits: Extract<
        GaReferenceUxLimitV2,
        { readonly limitClass: "zero_config_or_local_ready" }
      >;
      readonly referenceUxClassLimits: Extract<
        GaReferenceUxClassLimitV3,
        { readonly limitClass: "zero_config_or_local_ready" }
      >;
    };

type GaExecutionJourneyUxBindingV3 =
  | {
      readonly journeyTier: "zero_config";
      readonly referenceUxLimits: Extract<GaReferenceUxLimitV2, { readonly limitClass: "zero_config_or_local_ready" }>;
      readonly referenceUxClassLimits: Extract<GaReferenceUxClassLimitV3, { readonly limitClass: "zero_config_or_local_ready" }>;
    }
  | {
      readonly journeyTier: "guided_key";
      readonly referenceUxLimits: Extract<GaReferenceUxLimitV2, { readonly limitClass: "guided_key" }>;
      readonly referenceUxClassLimits: Extract<GaReferenceUxClassLimitV3, { readonly limitClass: "guided_key" }>;
    }
  | {
      readonly journeyTier: "guided_oauth";
      readonly referenceUxLimits: Extract<GaReferenceUxLimitV2, { readonly limitClass: "guided_oauth_or_subscription" }>;
      readonly referenceUxClassLimits: Extract<GaReferenceUxClassLimitV3, { readonly limitClass: "guided_oauth_or_subscription" }>;
    }
  | {
      readonly journeyTier: "enterprise_managed";
      readonly referenceUxLimits: Extract<GaReferenceUxLimitV2, { readonly limitClass: "enterprise_cloud_or_execution" }>;
      readonly referenceUxClassLimits: Extract<GaReferenceUxClassLimitV3, { readonly limitClass: "enterprise_cloud_or_execution" }>;
    };

type GaJourneyDefinitionV2 = GaJourneyDefinitionBaseV2 &
  (
    | (Exclude<GaSupplyJourneyUxBindingV2, { readonly journeyTier: "migration_only" }> & {
        readonly journeyClass: "supply";
        readonly expectedConnectionReadiness: "connected_verified";
        readonly expectedSolutionReadiness: "conversation_ready";
        readonly expectedExecutionReadiness?: never;
        readonly expectedControlReadiness?: never;
        readonly prerequisiteMode: "requires_anchor";
      })
    | (Extract<GaSupplyJourneyUxBindingV2, { readonly journeyTier: "migration_only" }> & {
        readonly journeyClass: "supply";
        readonly expectedConnectionReadiness?: never;
        readonly expectedSolutionReadiness?: never;
        readonly expectedExecutionReadiness?: never;
        readonly expectedControlReadiness?: never;
        readonly expectedMigrationReadiness: "migration_disposition_committed";
        readonly prerequisiteMode: "requires_anchor";
      })
    | (GaExecutionJourneyUxBindingV3 & {
        readonly journeyClass: "execution";
        readonly expectedConnectionReadiness: "connected_verified";
        readonly expectedSolutionReadiness?: never;
        readonly expectedExecutionReadiness: "execution_ready";
        readonly expectedControlReadiness?: never;
        readonly prerequisiteMode: "requires_anchor";
      })
    | {
        readonly journeyClass: "control_plane";
        readonly journeyTier: "zero_config";
        readonly referenceUxLimits: Extract<GaReferenceUxLimitV2, { readonly limitClass: "anchor_control" }>;
        readonly referenceUxClassLimits: Extract<
          GaReferenceUxClassLimitV3,
          { readonly limitClass: "anchor_control" }
        >;
        readonly expectedConnectionReadiness?: never;
        readonly expectedSolutionReadiness?: never;
        readonly expectedExecutionReadiness?: never;
        readonly expectedControlReadiness: "control_ready";
        readonly prerequisiteMode: "journey_is_anchor_control";
      }
  );

interface GaNegativeJourneyFixtureDefinitionV2 {
  readonly subject: GaJourneySubjectTemplateV1;
  readonly fixtureKind: "action_required" | "blocked" | "advanced_configuration" | "ux_limit_violation";
  readonly expectedConnectionReadiness: "action_required" | "blocked";
  readonly expectedSolutionReadiness: "blocked";
  readonly releaseGateEligible: false;
  readonly mutationFixtureDigest: string;
}

type GaRequiredReleaseMaturity = "builtin_stable" | "builtin_beta" | "community_verified";
type GaRequiredEcosystemTier = "L0" | "L1" | "L2";

interface GaEcosystemMatrixEntryBaseV2 {
  readonly entryKey: string;
  readonly entryId: string;
  readonly productId: string;
  readonly providerRealmDigest: string;
  readonly regionScopeDigest: string;
  readonly surfaceId: string;
  readonly deploymentClass: GaDeploymentClass;
  readonly ecosystemTier: "L0" | "L1" | "L2" | "inventory";
  readonly releaseMaturity: ConnectorReleaseMaturity;
  readonly publicApiStability: PublicApiStability;
  readonly categoryKeys: NonEmptyReadonly<string>;
  readonly fundingTiers: NonEmptyReadonly<GaFundingTier>;
  readonly journeys: NonEmptyReadonly<GaJourneyDefinitionV2>;
  readonly implementationPhase: 1 | "1A" | 2 | 3 | 4 | 5 | 6 | 7 | 8;
}

type GaEcosystemMatrixEntryV2 = GaEcosystemMatrixEntryBaseV2 &
  (
    | {
        readonly requiredForGa: true;
        readonly ecosystemTier: GaRequiredEcosystemTier;
        readonly releaseMaturity: GaRequiredReleaseMaturity;
        readonly provesMaturityAndTierEligibleUnderReferenceGradeProfile: true;
      }
    | {
        readonly requiredForGa: false;
        readonly ecosystemTier: "L1" | "L2" | "inventory";
        readonly releaseMaturity: ConnectorReleaseMaturity;
        readonly l0EntryForbiddenInNonRequiredBranch: true;
        readonly cannotSatisfyFixedNamedEntryOrCategoryMinimum: true;
      }
  );

interface GaEcosystemMatrixCoreV2 {
  readonly schemaVersion: "saydo.dev/ga-ecosystem-matrix/v2";
  readonly migrationInputOnly: true;
  readonly gaEligible: false;
  readonly mandatoryBaselineDigest: string;
  readonly entries: NonEmptyReadonly<GaEcosystemMatrixEntryV2>;
}

interface GaMandatoryBaselineV2 {
  readonly schemaVersion: "saydo.dev/ga-mandatory-baseline/v2";
  readonly migrationInputOnly: true;
  readonly gaEligible: false;
  readonly referenceGradeProfileDigest: string;
  readonly requiredEntryKeys: NonEmptyReadonly<string>;
  readonly allMatrixL0EntryKeys: NonEmptyReadonly<string>;
  readonly fixedNamedReferenceEntryKeys: NonEmptyReadonly<string>;
  readonly additionalOwnerRequiredEntryKeys: readonly string[];
  readonly requiredEntryKeyDerivation:
    "sorted_unique_union_of_all_matrix_l0_fixed_named_reference_and_owner_additions";
  readonly provesRequiredEntryKeysEqualDerivedUnionAndOwnerCanOnlyAdd: true;
  readonly requiredCategoryKeys: NonEmptyReadonly<string>;
  readonly requiredJourneyKeys: NonEmptyReadonly<string>;
  readonly requiredJourneySubjects: NonEmptyReadonly<{
    readonly subject: GaJourneySubjectTemplateV1;
    readonly expectedFixtureSetDigest: string;
    readonly runnerProfileDigest: string;
    readonly requiredPlatformProfileDigests: NonEmptyReadonly<string>;
    readonly requiredUserLocales: readonly ["zh-CN", "en-US", "ar-SA"];
    readonly requiredPseudoLocaleSuites: readonly ["en-XA"];
    readonly requiredUserRunSubjectDigests: NonEmptyReadonly<string>;
    readonly requiredPseudoLocaleRunSubjectDigests: NonEmptyReadonly<string>;
    readonly referenceUxLimitDigest: string;
    readonly requiredAnchorStartStates: readonly ["not_enrolled", "ready"];
    readonly prerequisiteCompositionProfileDigest: string;
    readonly requiredStateSetDigest: string;
  }>;
  readonly requiredUserRunSubjectDigests: NonEmptyReadonly<string>;
  readonly requiredPseudoLocaleRunSubjectDigests: NonEmptyReadonly<string>;
  readonly provesRequiredRunSubjectsEqualCanonicalCartesianExpansionWithoutOmissionDuplicationOrExtra: true;
  readonly requiredCategoryMinimums: NonEmptyReadonly<{
    readonly categoryKey: string;
    readonly minimumCompletedEntries: number;
    readonly requiredFundingTiers: readonly GaFundingTier[];
    readonly requiredJourneySubjectDigests: NonEmptyReadonly<string>;
  }>;
  readonly provesEveryRequiredAuthPathIsAnIndependentJourneySubjectNotAnOrAlternative: true;
}

interface ReferenceGradeProfileV2 {
  readonly schemaVersion: "saydo.dev/reference-grade-profile/v2";
  readonly profileId: "saydo-reference-grade-2026-v2";
  readonly migrationInputOnly: true;
  readonly referenceGradeOrGaEligible: false;
  readonly allowedRequiredForGaReleaseMaturities: readonly [
    "builtin_stable",
    "builtin_beta",
    "community_verified"
  ];
  readonly allowedRequiredForGaEcosystemTiers: readonly ["L0", "L1", "L2"];
  readonly inventoryAndCommunityUnverifiedNeverSatisfyRequiredGaEntry: true;
  readonly everyL0MatrixEntryMustBeRequiredForGa: true;
  readonly nonRequiredEntryBranchExcludesL0: true;
  readonly referenceUxLimits: readonly [
    Extract<GaReferenceUxLimitV2, { readonly limitClass: "zero_config_or_local_ready" }>,
    Extract<GaReferenceUxLimitV2, { readonly limitClass: "guided_key" }>,
    Extract<GaReferenceUxLimitV2, { readonly limitClass: "guided_oauth_or_subscription" }>,
    Extract<GaReferenceUxLimitV2, { readonly limitClass: "enterprise_cloud_or_execution" }>,
    Extract<GaReferenceUxLimitV2, { readonly limitClass: "anchor_control" }>,
  ];
  readonly requiredJourneyAnchorStartStates: readonly ["not_enrolled", "ready"];
  readonly freshEnrollmentPrerequisiteMustShareUnifiedActionAndTimeInventory: true;
  readonly automaticResumeAfterPrerequisiteAddsNoPrimaryAction: true;
  readonly requiredNamedEntryKeys: readonly [
    "global.openai.responses.api-key",
    "global.anthropic.messages.api-key",
    "global.google.genai.api-key",
    "global.google.vertex.adc",
    "global.google.vertex.workload-identity-federation",
    "global.azure-openai.api-key",
    "global.azure-openai.entra-user",
    "global.azure-openai.service-principal",
    "global.azure-openai.managed-identity",
    "global.aws-bedrock.api-key",
    "global.aws-bedrock.static-profile",
    "global.aws-bedrock.role-profile",
    "global.aws-bedrock.sso",
    "global.openrouter.credits-key",
    "global.openrouter.api-key-pkce",
    "global.opencode.zen-payg",
    "global.opencode.go-subscription",
    "cn.zhipu.bigmodel-api",
    "global.z-ai.api",
    "cn.kimi.api",
    "cn.kimi.coding-plan",
    "cn.deepseek.api",
    "cn.minimax.api",
    "global.minimax.api",
    "cn.minimax.token-plan",
    "global.minimax.token-plan",
    "cn.dashscope.beijing",
    "global.dashscope.international",
    "cn.volcengine-ark.api",
    "cn.tencent-tokenhub.guangzhou",
    "global.tencent-tokenhub.singapore",
    "cn.baidu-qianfan.api-v2",
    "cn.baidu-token-benefit-pack",
    "cn.siliconflow.api",
    "global.siliconflow.api",
    "local.ollama",
    "local.lm-studio",
    "local.omlx",
    "local.docker-model-runner",
    "local.podman-ai-lab",
    "execution.codex-app-server",
    "execution.kimi-code-server-acp",
    "execution.opencode-server",
    "bridge.cc-switch",
    "control.anchor-witness",
    "custom.openai-chat",
    "custom.openai-responses",
    "custom.anthropic-messages",
    "custom.mtls-only-private-gateway"
  ];
  readonly conditionalRightsGatedEntryKeys: readonly ["execution.claude-code"];
  readonly claudeCodeRequiresTypedAnthropicThirdPartyApprovalAndIsNeverFixedReferenceMinimum: true;
  readonly requiredProtocolFamilies: readonly [
    "openai_chat_completions",
    "openai_responses",
    "anthropic_messages",
    "google_genai"
  ];
  readonly requiredRealmClasses: readonly ["china_mainland", "global", "local"];
  readonly requiredFundingTiers: readonly ["owned_capacity", "subscription", "payg", "externally_metered_unknown"];
  readonly requiredCustomEndpointJourneys: readonly [
    "custom-openai-chat",
    "custom-openai-responses",
    "custom-anthropic-messages",
    "custom-secret-header",
    "custom-mtls-only-private-gateway"
  ];
  readonly requiredNamedLocalJourneyKeys: readonly [
    "ollama-text-only-plain-dialog",
    "omlx-text-only-plain-dialog",
    "docker-model-runner-ready-and-stopped",
    "podman-ai-lab-ready-api-disabled-no-model-stopped-and-port-conflict"
  ];
  readonly requiredNamedEnterpriseAuthJourneyKeys: readonly [
    "azure-openai-api-key",
    "azure-openai-entra-user",
    "azure-openai-service-principal",
    "azure-openai-managed-identity",
    "aws-bedrock-api-key",
    "aws-bedrock-named-static-profile",
    "aws-bedrock-role-profile",
    "aws-bedrock-sso",
    "google-vertex-adc-file",
    "google-vertex-workload-identity-federation"
  ];
  readonly requiredPlatformControlJourneyKeys: readonly [
    "anchor-witness-enrollment-macos-arm64-zh-cn",
    "anchor-witness-enrollment-macos-arm64-en-us",
    "anchor-witness-enrollment-linux-x64-zh-cn",
    "anchor-witness-enrollment-linux-x64-en-us",
    "anchor-witness-enrollment-windows-x64-zh-cn",
    "anchor-witness-enrollment-windows-x64-en-us",
    "anchor-witness-offline-proxy-threshold-rotation-and-continuity-recovery"
  ];
  readonly requiredMutationFixtureKinds: readonly [
    "blocked_readiness_pass_injection",
    "action_required_readiness_pass_injection",
    "advanced_definition_in_required_journey",
    "self_declared_wider_ux_limits",
    "wrong_reference_limit_class_for_journey_tier",
    "omit_not_enrolled_anchor_run",
    "omit_ready_anchor_run",
    "omit_required_starting_account_state_run",
    "omit_or_reorder_required_journey_graph_step",
    "runtime_state_without_unique_recipe_compatible_producer",
    "exclude_prerequisite_events_or_elapsed_time_from_unified_metrics",
    "delete_external_task_terminal_or_administrator_wait_terminal",
    "compress_wait_or_relabel_raw_elapsed_as_app_elapsed",
    "omit_copy_or_visibility_event",
    "return_focus_to_wrong_window_or_route",
    "mark_l0_entry_non_required",
    "substitute_conditional_rights_entry_for_fixed_minimum"
  ];
  readonly requiredCategoryMinimums: readonly [
    {
      readonly categoryKey: "global_official_api";
      readonly minimumCompletedEntries: 8;
      readonly requiredFundingTiers: readonly ["payg", "externally_metered_unknown"];
    },
    {
      readonly categoryKey: "china_mainland_official_api";
      readonly minimumCompletedEntries: 5;
      readonly requiredFundingTiers: readonly ["payg"];
    },
    {
      readonly categoryKey: "local_runtime";
      readonly minimumCompletedEntries: 3;
      readonly requiredFundingTiers: readonly ["owned_capacity"];
    },
    {
      readonly categoryKey: "execution_subscription_surface";
      readonly minimumCompletedEntries: 3;
      readonly requiredFundingTiers: readonly ["subscription"];
    },
    {
      readonly categoryKey: "bridge_and_router";
      readonly minimumCompletedEntries: 1;
      readonly requiredFundingTiers: readonly ["subscription", "externally_metered_unknown"];
    },
    {
      readonly categoryKey: "custom_endpoint";
      readonly minimumCompletedEntries: 4;
      readonly requiredFundingTiers: readonly ["payg", "externally_metered_unknown"];
    },
    {
      readonly categoryKey: "platform_anchor_control_plane";
      readonly minimumCompletedEntries: 1;
      readonly requiredFundingTiers: readonly [];
    }
  ];
  readonly requiredEntryCategoryMappings: NonEmptyReadonly<{
    readonly entryKey: string;
    readonly categoryKeys: NonEmptyReadonly<
      | "global_official_api"
      | "china_mainland_official_api"
      | "local_runtime"
      | "execution_subscription_surface"
      | "bridge_and_router"
      | "custom_endpoint"
      | "platform_anchor_control_plane"
    >;
  }>;
  readonly requiredJourneyRequirements: NonEmptyReadonly<{
    readonly entryKey: string;
    readonly journeyKey: string;
    readonly authKind: AuthSource["kind"];
    readonly authProfileDigest: string;
    readonly requiredStateSetDigest: string;
    readonly expectedFixtureSetDigest: string;
    readonly requiredUserRunSubjectDigests: NonEmptyReadonly<string>;
    readonly requiredPseudoLocaleRunSubjectDigests: NonEmptyReadonly<string>;
    readonly referenceUxLimitDigest: string;
    readonly requiredAnchorStartStates: readonly ["not_enrolled", "ready"];
    readonly prerequisiteCompositionProfileDigest: string;
  }>;
  readonly allowedReplacementSlots: readonly [
    {
      readonly slotKey: "additional_china_official_api";
      readonly minimumEntries: 1;
      readonly allowedRealmClass: "china_mainland";
      readonly requiredProtocolFamilySetDigest: string;
      readonly requiredAuthAndFundingSetDigest: string;
      readonly replacementCannotSatisfyAnyFixedNamedEntry: true;
    },
    {
      readonly slotKey: "additional_global_gateway";
      readonly minimumEntries: 1;
      readonly allowedRealmClass: "global";
      readonly requiredProtocolFamilySetDigest: string;
      readonly requiredAuthAndFundingSetDigest: string;
      readonly replacementCannotSatisfyAnyFixedNamedEntry: true;
    }
  ];
  readonly requiredEntryKeySetDigest: string;
  readonly requiredJourneyRequirementSetDigest: string;
  readonly requiredStateAndFixtureSetDigest: string;
  readonly requiredCategoryAndReplacementConstraintSetDigest: string;
  readonly authPathComposition: "independent_only_no_or_alternative";
  readonly baselineMayOnlyAddRequirementsOrFillExplicitReplacementSlots: true;
  readonly v1ProfilesAreNotReferenceGradeOrGaEligible: true;
  readonly downgradeChangesDesignationAndForbidsReferenceGradeOrGaBadge: true;
}

type ReferenceCategoryKeyV3 =
  | "global_official_api"
  | "china_mainland_official_api"
  | "global_gateway_and_subscription"
  | "local_runtime"
  | "execution_subscription_surface"
  | "bridge_and_router"
  | "custom_endpoint"
  | "platform_anchor_control_plane";

type ReferencePlatformScopeV3 =
  | "all_desktop"
  | "macos_arm64"
  | "linux_x64"
  | "windows_x64"
  | "azure_hosted_runtime";
type ReferenceSurfaceKindV3 = "inference" | "execution" | "bridge" | "control_plane";
type ReferenceProtocolProfileV3 =
  | InferenceProtocolId
  | ExecutionWireProtocolId
  | BridgeControlProtocolId
  | "control_plane";
type ReferenceJourneyTierV3 =
  | "zero_config"
  | "guided_key"
  | "guided_oauth"
  | "enterprise_managed"
  | "migration_only"
  | "custom_endpoint";

type ReferenceStartingAccountStateV3 =
  | "no_account"
  | "account_exists_signed_out"
  | "signed_in_no_billing"
  | "signed_in_ready"
  | "enterprise_admin_required"
  | "local_service_ready"
  | "local_service_installed"
  | "local_service_not_running"
  | "existing_connection_present"
  | "externally_managed_service_ready";

type ReferencePassiveInputV1 =
  | "release_pinned_official_preset"
  | "public_cli_config_metadata"
  | "signed_binary_and_version"
  | "known_loopback_listener_metadata"
  | "legacy_connection_metadata_and_broker_handle"
  | "os_identity_metadata"
  | "none";

type ReferenceActiveValidationStepV1 =
  | "credential_free_metadata_if_supported"
  | "peer_identity_challenge"
  | "current_rights_and_funding_check"
  | "staged_conformance"
  | "safe_restart_or_rebind"
  | "live_conformance"
  | "legacy_connection_read_only_validation"
  | "migration_destination_qualification"
  | "legacy_connection_retirement_or_read_only_retention"
  | "capability_and_readiness_projection";

type ReferenceRecoveryStateV1 =
  | "not_installed"
  | "not_running"
  | "auth_missing"
  | "auth_expired_or_revoked"
  | "rights_or_quota_blocked"
  | "network_or_proxy_blocked"
  | "model_missing_or_cold"
  | "endpoint_or_protocol_mismatch"
  | "leave_and_return"
  | "delivery_unknown"
  | "configuration_drift";

type ReferenceRuntimeStateV3 =
  | "api_disabled"
  | "api_off"
  | "authoritative_funding_mode_observed"
  | "auth_optional"
  | "beijing_realm_verified"
  | "benefit_balance_verified"
  | "browser_login"
  | "browser_return"
  | "certificate_selected"
  | "china_realm_verified"
  | "cold"
  | "continuity_lost"
  | "credits_verified"
  | "deployment_selected"
  | "disabled"
  | "endpoint_model_verified"
  | "enrolling"
  | "enterprise_plan_edition_verified"
  | "extra_usage_state_verified"
  | "failover_opaque"
  | "failover_unknown"
  | "global_realm_verified"
  | "header_policy_verified"
  | "identity_ready"
  | "international_realm_verified"
  | "key_committed"
  | "leave_and_return"
  | "manual_config"
  | "membership_tier_verified"
  | "model_catalog_verified"
  | "model_eligibility_verified"
  | "model_protocol_assignment_verified"
  | "model_service_enabled"
  | "no_model"
  | "not_enrolled"
  | "not_installed"
  | "not_running"
  | "offline"
  | "overage_disabled"
  | "overage_policy_verified"
  | "overage_zen_balance_enabled"
  | "password_optional"
  | "port_conflict"
  | "private_key_handle_ready"
  | "profile_selected"
  | "proxy_blocked"
  | "ready"
  | "real_user_agent_preserved"
  | "region_selected"
  | "region_verified"
  | "renewal"
  | "role_assumed"
  | "rotation"
  | "route_drift"
  | "route_opaque"
  | "route_ready"
  | "secret_optional"
  | "secret_broker_handle_ready"
  | "session_recovery"
  | "signed_out"
  | "signing_identity_ready"
  | "singapore_realm_verified"
  | "stopped"
  | "subscription_verified"
  | "subscription_pool_verified"
  | "text_only"
  | "threshold_partial"
  | "tools_by_model"
  | "unsupported_version"
  | "verified"
  | "warm";

type ReferenceJourneyStepV3 = {
  readonly stepId: string;
  readonly ordinal: number;
  readonly nextStepOrdinals: readonly number[];
  readonly recoveryStepOrdinal: number | null;
  readonly focusReturnRequired: boolean;
} &
  (
    | {
        readonly transitionTrigger: "user_primary_action";
        readonly primaryActionId: string;
      }
    | {
        readonly transitionTrigger: "automatic_after_predecessor_success";
        readonly primaryActionId?: never;
      }
  ) &
  (
    | { readonly stepKind: "saydo_action"; readonly actionId: string }
    | {
        readonly stepKind: "external_task";
        readonly externalTaskClass: keyof GaUxPlannedMetricsV2["maximumExternalTasksByClass"];
        readonly externalTaskProfileDigest: string;
        readonly authoritativeChallengeOrNegativeEvidenceRequired?: true;
        readonly conditionalNestedExternalTasks?: readonly {
          readonly variantId: string;
          readonly externalTaskClass: keyof GaUxPlannedMetricsV2["maximumExternalTasksByClass"];
          readonly maximumOccurrences: number;
          readonly sharesParentLeaveAndReturnInterval: boolean;
          readonly requiredPositiveAndNegativeFixture: true;
        }[];
      }
    | {
        readonly stepKind: "manual_field";
        readonly fieldId: ReferenceRecipeFieldV1["fieldId"];
      }
    | {
        readonly stepKind: "recipe_field_group";
        readonly fieldSelector:
          | "all_required_recipe_fields_not_committed_by_prior_steps"
          | "opencode_basic_username_and_password_when_challenge_requires_basic";
      }
    | {
        readonly stepKind: "passive_evidence";
        readonly passiveInput: ReferencePassiveInputV1;
      }
    | {
        readonly stepKind: "active_validation";
        readonly validationStep: ReferenceActiveValidationStepV1;
      }
    | {
        readonly stepKind: "entitlement_observation";
        readonly observationProfileDigest: string;
        readonly readyNextStepOrdinal: number;
        readonly missingNextStepOrdinal: number;
        readonly observationOutcomeMustBeBackedByCurrentPrincipalBillingOrSubscriptionEvidence: true;
      }
    | {
        readonly stepKind: "auth_challenge_observation";
        readonly observationProfileDigest: string;
        readonly challengeDiscriminator: "password_required" | "secret_required" | "bearer_required" | "x_api_key_required";
        readonly noChallengeNextStepOrdinal: number;
        readonly challengeRequiredNextStepOrdinal: number;
        readonly authoritativeChallengeOrNegativeEvidenceRequired: true;
      }
  );

interface ReferenceJourneyGraphV3 {
  readonly graphId: `journey-graph:${string}@${3 | 6}`;
  readonly requiredStartingAccountStates: NonEmptyReadonly<ReferenceStartingAccountStateV3>;
  readonly startStateEntrySteps: NonEmptyReadonly<{
    readonly startingAccountState: ReferenceStartingAccountStateV3;
    readonly firstStepOrdinal: number;
  }>;
  readonly steps: NonEmptyReadonly<ReferenceJourneyStepV3>;
  readonly terminalStepOrdinal: number;
  readonly postGraphSuccessChain:
    | readonly [
        "live_conformance",
        "capability_and_readiness_projection",
        "activation_manifest_commit",
        "active_pointer_commit",
      ]
    | readonly [
        "legacy_connection_validation_commit",
        "migration_destination_or_read_only_disposition_commit",
        "legacy_credential_retirement_or_retention_commit",
        "migration_state_publication_commit",
      ];
  readonly terminalState: "live_activation_committed" | "migration_disposition_committed";
  readonly everyPostGraphPhaseIsAutomaticAfterPriorSuccessAndProducesTypedTerminalEvidence: true;
  readonly everyStartStateHasExactlyOneEntryAndAtLeastOnePathToTerminal: true;
  readonly ordinalsAreUniqueContiguousAndEveryEdgeTargetsAnExistingLaterOrRecoveryStep: true;
  readonly everyUserTriggeredStateHasExactlyOnePrimaryActionAndEveryAutomaticStateHasNone: true;
  readonly everyUserTriggeredVisitedStateProducesExactlyOneMatchingSaydoPrimaryActionEvent: true;
  readonly everyExternalTaskUsesExactReturnFocus: true;
  readonly everyConditionalNestedExternalTaskVariantHasTypedEventsSignedLimitsAndPositiveNegativeFixtures: true;
}

interface ReferenceRuntimeRecoveryScenarioV4 {
  readonly runtimeState: ReferenceRuntimeStateV3;
  readonly recoveryGraph: ReferenceJourneyGraphV3;
  readonly firstRecoveryStepOrdinal: number;
  readonly initialConnectionReadiness: "action_required";
  readonly zeroConfigPassClaimForbiddenBeforeRecoveryTerminal: true;
  readonly successfulRecoveryStillRequiresTheFullPostGraphSuccessChain: true;
  readonly recoveryUxContract: {
    readonly maximumSaydoPrimaryActions: 3;
    readonly maximumExternalTasks: 3;
    readonly maximumManualFields: 1;
    readonly maximumLeaveAndReturnCount: 3;
    readonly maximumRecoveryLoops: 2;
    readonly maximumAppElapsedMillis: 600_000;
    readonly maximumRawElapsedMillis: 2_700_000;
  };
}

type ReferenceRuntimeStateProducerV3 =
  | { readonly producerKind: "trusted_default"; readonly producerProfileDigest: string }
  | { readonly producerKind: "passive_discovery"; readonly evidenceProfileDigest: string }
  | {
      readonly producerKind: "authoritative_precondition_observation";
      readonly observationProfileDigest: string;
    }
  | { readonly producerKind: "journey_action"; readonly journeyStepId: string }
  | { readonly producerKind: "manual_field"; readonly fieldId: ReferenceRecipeFieldV1["fieldId"] }
  | {
      readonly producerKind: "external_task";
      readonly journeyStepId: string;
    }
  | {
      readonly producerKind: "active_validation";
      readonly validationStep: ReferenceActiveValidationStepV1;
    }
  | { readonly producerKind: "recovery_action"; readonly recoveryState: ReferenceRecoveryStateV1 }
  | {
      readonly producerKind: "authoritative_runtime_terminal";
      readonly terminalProfileDigest: string;
    }
  | {
      readonly producerKind: "auth_challenge_observation";
      readonly journeyStepId: string;
      readonly challengeDiscriminator: "password_required" | "secret_required" | "bearer_required" | "x_api_key_required";
    };

type ReferenceRuntimeStateAssertionModeV4 =
  | "observes_precondition"
  | "causes_transition"
  | "proves_postcondition";

interface ReferenceRuntimeStateMachineArtifactV4 extends ReceiptRef {
  readonly schemaVersion: "saydo.dev/reference-runtime-state-machine/v4";
  readonly stateSetDigest: string;
  readonly assertionModeMapDigest: string;
  readonly sourceDeclarationMapDigest: string;
  readonly transitionPredicateArtifactDigest: string;
  readonly rejectsCallerSuppliedPolarityAndUnregisteredStateTransitions: true;
}

type ReferenceRuntimeStateAssertionSubjectV4<
  R extends ReferenceRequirementV3,
  S extends R["requiredRuntimeStates"][number],
> = {
  readonly requirement: R;
  readonly requirementKey: R["requirementKey"];
  readonly journeyKey: R["journeyKey"];
  readonly exactRunSubjectDigest: string;
  readonly state: S;
};

declare const referenceRuntimeStateAssertionBrandV4: unique symbol;

type ReferenceRuntimeStateAssertionReceiptV4<
  R extends ReferenceRequirementV3,
  S extends R["requiredRuntimeStates"][number],
  M extends ReferenceRuntimeStateAssertionModeV4,
> = ReceiptRef<"receipt:reference-runtime-state-assertion@4", readonly [R, S, M]> & {
  readonly [referenceRuntimeStateAssertionBrandV4]: never;
  readonly stateMachineArtifact: ReferenceRuntimeStateMachineArtifactV4;
  readonly subject: ReferenceRuntimeStateAssertionSubjectV4<R, S>;
  readonly assertionMode: M;
  readonly sourceDeclarationDigest: string;
  readonly orderedEvidenceOrdinal: number;
  readonly observedAtMonotonicMillis: number;
  readonly exactRawEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly exactRawEvidenceDigest: string;
} & ReferenceRuntimeStateAssertionModeFieldsV10<R, S, M>;

type ReferenceRuntimeStateAssertionModeFieldsV10<
  R extends ReferenceRequirementV3,
  S extends R["requiredRuntimeStates"][number],
  M extends ReferenceRuntimeStateAssertionModeV4,
> = M extends "observes_precondition"
  ? {
      readonly provesEvidencePrecedesAnyRecoveryAction: true;
      readonly exactTransitionTerminal?: never;
      readonly predecessorStateDigest?: never;
      readonly successorStateDigest?: never;
      readonly exactValidationTerminal?: never;
      readonly provesCurrentSubjectStateAfterAllRequiredActions?: never;
    }
  : M extends "causes_transition"
    ? {
        readonly provesEvidencePrecedesAnyRecoveryAction?: never;
        readonly exactTransitionTerminal: ReceiptRef<
          "receipt:reference-runtime-transition-terminal@10",
          ReferenceRuntimeStateAssertionSubjectV4<R, S>
        >;
        readonly predecessorStateDigest: string;
        readonly successorStateDigest: string;
        readonly exactValidationTerminal?: never;
        readonly provesCurrentSubjectStateAfterAllRequiredActions?: never;
      }
    : {
        readonly provesEvidencePrecedesAnyRecoveryAction?: never;
        readonly exactTransitionTerminal?: never;
        readonly predecessorStateDigest?: never;
        readonly successorStateDigest?: never;
        readonly exactValidationTerminal: ReceiptRef<
          "receipt:reference-runtime-validation-terminal@10",
          ReferenceRuntimeStateAssertionSubjectV4<R, S>
        >;
        readonly provesCurrentSubjectStateAfterAllRequiredActions: true;
      };

type ReferenceRuntimeStateAssertionInputV10<
  R extends ReferenceRequirementV3,
  S extends R["requiredRuntimeStates"][number],
> = {
  readonly [M in ReferenceRuntimeStateAssertionModeV4]: {
    readonly stateMachineArtifact: ReferenceRuntimeStateMachineArtifactV4;
    readonly subject: ReferenceRuntimeStateAssertionSubjectV4<R, S>;
    readonly canonicalAssertionMode: M;
    readonly canonicalSourceDeclaration: ReferenceRuntimeStateProducerV3;
    readonly exactRawEvidence: ImportedOpaqueEvidenceLeafReceipt;
  } & ReferenceRuntimeStateAssertionModeFieldsV10<R, S, M>;
}[ReferenceRuntimeStateAssertionModeV4];

declare function commitReferenceRuntimeStateAssertionV4<
  const R extends ReferenceRequirementV3,
  const S extends R["requiredRuntimeStates"][number],
  const I extends ReferenceRuntimeStateAssertionInputV10<NoInfer<R>, NoInfer<S>>,
>(input: I & { readonly subject: ReferenceRuntimeStateAssertionSubjectV4<R, S> }): DeepFrozenCommittedReceiptV1<
  ReferenceRuntimeStateAssertionReceiptV4<R, S, I["canonicalAssertionMode"]>
>;

const REFERENCE_AUTH_CHALLENGE_VARIANTS_V9 = [
  {
    variantId: "challenge_present_mfa_or_sca",
    externalTaskClass: "mfa",
    maximumOccurrences: 1,
    sharesParentLeaveAndReturnInterval: true,
    requiredPositiveAndNegativeFixture: true,
  },
  {
    variantId: "challenge_authoritatively_absent",
    externalTaskClass: "mfa",
    maximumOccurrences: 0,
    sharesParentLeaveAndReturnInterval: true,
    requiredPositiveAndNegativeFixture: true,
  },
] as const;

const JOURNEY_GRAPH_GUIDED_KEY_V3 = {
  graphId: "journey-graph:guided-key@3",
  requiredStartingAccountStates: ["no_account", "account_exists_signed_out", "signed_in_no_billing", "signed_in_ready"],
  startStateEntrySteps: [
    { startingAccountState: "no_account", firstStepOrdinal: 0 },
    { startingAccountState: "account_exists_signed_out", firstStepOrdinal: 1 },
    { startingAccountState: "signed_in_no_billing", firstStepOrdinal: 2 },
    { startingAccountState: "signed_in_ready", firstStepOrdinal: 2 },
  ],
  steps: [
    { stepId: "create-account", ordinal: 0, stepKind: "external_task", externalTaskClass: "accountCreation", externalTaskProfileDigest: "profile:provider-account-creation-and-authenticated-return", conditionalNestedExternalTasks: REFERENCE_AUTH_CHALLENGE_VARIANTS_V9, authoritativeChallengeOrNegativeEvidenceRequired: true, transitionTrigger: "user_primary_action", primaryActionId: "open-provider-account", nextStepOrdinals: [2], recoveryStepOrdinal: 0, focusReturnRequired: true },
    { stepId: "login", ordinal: 1, stepKind: "external_task", externalTaskClass: "login", externalTaskProfileDigest: "profile:provider-login-mfa", conditionalNestedExternalTasks: REFERENCE_AUTH_CHALLENGE_VARIANTS_V9, authoritativeChallengeOrNegativeEvidenceRequired: true, transitionTrigger: "user_primary_action", primaryActionId: "sign-in", nextStepOrdinals: [2], recoveryStepOrdinal: 1, focusReturnRequired: true },
    { stepId: "observe-entitlement", ordinal: 2, stepKind: "entitlement_observation", observationProfileDigest: "profile:principal-current-billing-subscription-or-api-entitlement", transitionTrigger: "automatic_after_predecessor_success", readyNextStepOrdinal: 4, missingNextStepOrdinal: 3, nextStepOrdinals: [3, 4], recoveryStepOrdinal: 2, focusReturnRequired: false, observationOutcomeMustBeBackedByCurrentPrincipalBillingOrSubscriptionEvidence: true },
    { stepId: "activate-billing-if-required", ordinal: 3, stepKind: "external_task", externalTaskClass: "billingActivation", externalTaskProfileDigest: "profile:provider-billing-activation", conditionalNestedExternalTasks: REFERENCE_AUTH_CHALLENGE_VARIANTS_V9, authoritativeChallengeOrNegativeEvidenceRequired: true, transitionTrigger: "user_primary_action", primaryActionId: "review-billing", nextStepOrdinals: [4], recoveryStepOrdinal: 3, focusReturnRequired: true },
    { stepId: "create-provider-credential", ordinal: 4, stepKind: "external_task", externalTaskClass: "providerCredentialCreation", externalTaskProfileDigest: "profile:provider-api-credential-create-copy-return", conditionalNestedExternalTasks: REFERENCE_AUTH_CHALLENGE_VARIANTS_V9, authoritativeChallengeOrNegativeEvidenceRequired: true, transitionTrigger: "user_primary_action", primaryActionId: "create-api-credential", nextStepOrdinals: [5], recoveryStepOrdinal: 4, focusReturnRequired: true },
    { stepId: "commit-required-fields", ordinal: 5, stepKind: "recipe_field_group", fieldSelector: "all_required_recipe_fields_not_committed_by_prior_steps", transitionTrigger: "user_primary_action", primaryActionId: "save-required-fields", nextStepOrdinals: [6], recoveryStepOrdinal: 5, focusReturnRequired: false },
    { stepId: "validate", ordinal: 6, stepKind: "active_validation", validationStep: "staged_conformance", transitionTrigger: "automatic_after_predecessor_success", nextStepOrdinals: [], recoveryStepOrdinal: 6, focusReturnRequired: false },
  ],
  terminalStepOrdinal: 6,
  postGraphSuccessChain: ["live_conformance", "capability_and_readiness_projection", "activation_manifest_commit", "active_pointer_commit"],
  terminalState: "live_activation_committed",
  everyPostGraphPhaseIsAutomaticAfterPriorSuccessAndProducesTypedTerminalEvidence: true,
  everyStartStateHasExactlyOneEntryAndAtLeastOnePathToTerminal: true,
  ordinalsAreUniqueContiguousAndEveryEdgeTargetsAnExistingLaterOrRecoveryStep: true,
  everyUserTriggeredStateHasExactlyOnePrimaryActionAndEveryAutomaticStateHasNone: true,
  everyUserTriggeredVisitedStateProducesExactlyOneMatchingSaydoPrimaryActionEvent: true,
  everyExternalTaskUsesExactReturnFocus: true,
  everyConditionalNestedExternalTaskVariantHasTypedEventsSignedLimitsAndPositiveNegativeFixtures: true,
} as const satisfies ReferenceJourneyGraphV3;

const JOURNEY_GRAPH_EXISTING_CONNECTION_MIGRATION_ONLY_V8 = {
  graphId: "journey-graph:existing-connection-migration-only@6",
  requiredStartingAccountStates: ["existing_connection_present"],
  startStateEntrySteps: [
    { startingAccountState: "existing_connection_present", firstStepOrdinal: 0 },
  ],
  steps: [
    { stepId: "inspect-existing-legacy-connection", ordinal: 0, stepKind: "passive_evidence", passiveInput: "legacy_connection_metadata_and_broker_handle", transitionTrigger: "automatic_after_predecessor_success", nextStepOrdinals: [1], recoveryStepOrdinal: 0, focusReturnRequired: false },
    { stepId: "validate-existing-legacy-connection-read-only", ordinal: 1, stepKind: "active_validation", validationStep: "legacy_connection_read_only_validation", transitionTrigger: "automatic_after_predecessor_success", nextStepOrdinals: [2], recoveryStepOrdinal: 1, focusReturnRequired: false },
    { stepId: "choose-tokenhub-migration-or-retain-read-only", ordinal: 2, stepKind: "saydo_action", actionId: "choose-tokenhub-migration-or-retain-read-only", transitionTrigger: "user_primary_action", primaryActionId: "review-existing-connection-migration", nextStepOrdinals: [3], recoveryStepOrdinal: 2, focusReturnRequired: false },
    { stepId: "qualify-selected-migration-destination", ordinal: 3, stepKind: "active_validation", validationStep: "migration_destination_qualification", transitionTrigger: "automatic_after_predecessor_success", nextStepOrdinals: [4], recoveryStepOrdinal: 3, focusReturnRequired: false },
    { stepId: "commit-retirement-or-read-only-retention", ordinal: 4, stepKind: "active_validation", validationStep: "legacy_connection_retirement_or_read_only_retention", transitionTrigger: "automatic_after_predecessor_success", nextStepOrdinals: [], recoveryStepOrdinal: 4, focusReturnRequired: false },
  ],
  terminalStepOrdinal: 4,
  postGraphSuccessChain: [
    "legacy_connection_validation_commit",
    "migration_destination_or_read_only_disposition_commit",
    "legacy_credential_retirement_or_retention_commit",
    "migration_state_publication_commit",
  ],
  terminalState: "migration_disposition_committed",
  everyPostGraphPhaseIsAutomaticAfterPriorSuccessAndProducesTypedTerminalEvidence: true,
  everyStartStateHasExactlyOneEntryAndAtLeastOnePathToTerminal: true,
  ordinalsAreUniqueContiguousAndEveryEdgeTargetsAnExistingLaterOrRecoveryStep: true,
  everyUserTriggeredStateHasExactlyOnePrimaryActionAndEveryAutomaticStateHasNone: true,
  everyUserTriggeredVisitedStateProducesExactlyOneMatchingSaydoPrimaryActionEvent: true,
  everyExternalTaskUsesExactReturnFocus: true,
  everyConditionalNestedExternalTaskVariantHasTypedEventsSignedLimitsAndPositiveNegativeFixtures: true,
} as const satisfies ReferenceJourneyGraphV3;

const JOURNEY_GRAPH_OAUTH_V3 = {
  graphId: "journey-graph:browser-oauth@3",
  requiredStartingAccountStates: ["no_account", "account_exists_signed_out", "signed_in_no_billing", "signed_in_ready"],
  startStateEntrySteps: [
    { startingAccountState: "no_account", firstStepOrdinal: 0 },
    { startingAccountState: "account_exists_signed_out", firstStepOrdinal: 1 },
    { startingAccountState: "signed_in_no_billing", firstStepOrdinal: 1 },
    { startingAccountState: "signed_in_ready", firstStepOrdinal: 1 },
  ],
  steps: [
    { ...JOURNEY_GRAPH_GUIDED_KEY_V3.steps[0], nextStepOrdinals: [1] },
    { stepId: "login", ordinal: 1, stepKind: "external_task", externalTaskClass: "login", externalTaskProfileDigest: "profile:browser-oauth-pkce", conditionalNestedExternalTasks: REFERENCE_AUTH_CHALLENGE_VARIANTS_V9, authoritativeChallengeOrNegativeEvidenceRequired: true, transitionTrigger: "user_primary_action", primaryActionId: "continue-in-browser", nextStepOrdinals: [2], recoveryStepOrdinal: 1, focusReturnRequired: true },
    { stepId: "observe-entitlement", ordinal: 2, stepKind: "entitlement_observation", observationProfileDigest: "profile:principal-current-billing-subscription-or-execution-entitlement", transitionTrigger: "automatic_after_predecessor_success", readyNextStepOrdinal: 4, missingNextStepOrdinal: 3, nextStepOrdinals: [3, 4], recoveryStepOrdinal: 2, focusReturnRequired: false, observationOutcomeMustBeBackedByCurrentPrincipalBillingOrSubscriptionEvidence: true },
    { ...JOURNEY_GRAPH_GUIDED_KEY_V3.steps[3], ordinal: 3, nextStepOrdinals: [4], recoveryStepOrdinal: 3 },
    { stepId: "validate", ordinal: 4, stepKind: "active_validation", validationStep: "staged_conformance", transitionTrigger: "automatic_after_predecessor_success", nextStepOrdinals: [], recoveryStepOrdinal: 4, focusReturnRequired: false },
  ],
  terminalStepOrdinal: 4,
  postGraphSuccessChain: ["live_conformance", "capability_and_readiness_projection", "activation_manifest_commit", "active_pointer_commit"],
  terminalState: "live_activation_committed",
  everyPostGraphPhaseIsAutomaticAfterPriorSuccessAndProducesTypedTerminalEvidence: true,
  everyStartStateHasExactlyOneEntryAndAtLeastOnePathToTerminal: true,
  ordinalsAreUniqueContiguousAndEveryEdgeTargetsAnExistingLaterOrRecoveryStep: true,
  everyUserTriggeredStateHasExactlyOnePrimaryActionAndEveryAutomaticStateHasNone: true,
  everyUserTriggeredVisitedStateProducesExactlyOneMatchingSaydoPrimaryActionEvent: true,
  everyExternalTaskUsesExactReturnFocus: true,
  everyConditionalNestedExternalTaskVariantHasTypedEventsSignedLimitsAndPositiveNegativeFixtures: true,
} as const satisfies ReferenceJourneyGraphV3;

const JOURNEY_GRAPH_BROWSER_KEY_V3 = {
  ...JOURNEY_GRAPH_OAUTH_V3,
  graphId: "journey-graph:browser-key-exchange@3",
  steps: [
    JOURNEY_GRAPH_OAUTH_V3.steps[0],
    { stepId: "browser-key-exchange", ordinal: 1, stepKind: "external_task", externalTaskClass: "providerCredentialCreation", externalTaskProfileDigest: "profile:browser-key-pkce", conditionalNestedExternalTasks: REFERENCE_AUTH_CHALLENGE_VARIANTS_V9, authoritativeChallengeOrNegativeEvidenceRequired: true, transitionTrigger: "user_primary_action", primaryActionId: "create-key-in-browser", nextStepOrdinals: [2], recoveryStepOrdinal: 1, focusReturnRequired: true },
    JOURNEY_GRAPH_OAUTH_V3.steps[2],
    JOURNEY_GRAPH_OAUTH_V3.steps[3],
    JOURNEY_GRAPH_OAUTH_V3.steps[4],
  ],
} as const satisfies ReferenceJourneyGraphV3;

const JOURNEY_GRAPH_ENTERPRISE_V3 = {
  graphId: "journey-graph:enterprise-managed@3",
  requiredStartingAccountStates: ["enterprise_admin_required", "account_exists_signed_out", "signed_in_ready"],
  startStateEntrySteps: [
    { startingAccountState: "enterprise_admin_required", firstStepOrdinal: 0 },
    { startingAccountState: "account_exists_signed_out", firstStepOrdinal: 1 },
    { startingAccountState: "signed_in_ready", firstStepOrdinal: 2 },
  ],
  steps: [
    { stepId: "administrator-approval", ordinal: 0, stepKind: "external_task", externalTaskClass: "administratorApproval", externalTaskProfileDigest: "profile:enterprise-admin-approval", conditionalNestedExternalTasks: REFERENCE_AUTH_CHALLENGE_VARIANTS_V9, authoritativeChallengeOrNegativeEvidenceRequired: true, transitionTrigger: "user_primary_action", primaryActionId: "request-administrator-access", nextStepOrdinals: [1], recoveryStepOrdinal: 0, focusReturnRequired: true },
    { stepId: "login", ordinal: 1, stepKind: "external_task", externalTaskClass: "login", externalTaskProfileDigest: "profile:enterprise-browser-oauth", conditionalNestedExternalTasks: REFERENCE_AUTH_CHALLENGE_VARIANTS_V9, authoritativeChallengeOrNegativeEvidenceRequired: true, transitionTrigger: "user_primary_action", primaryActionId: "continue-in-browser", nextStepOrdinals: [2], recoveryStepOrdinal: 1, focusReturnRequired: true },
    { stepId: "commit-required-enterprise-fields", ordinal: 2, stepKind: "recipe_field_group", fieldSelector: "all_required_recipe_fields_not_committed_by_prior_steps", transitionTrigger: "user_primary_action", primaryActionId: "select-required-enterprise-fields", nextStepOrdinals: [3], recoveryStepOrdinal: 2, focusReturnRequired: false },
    { stepId: "validate", ordinal: 3, stepKind: "active_validation", validationStep: "staged_conformance", transitionTrigger: "automatic_after_predecessor_success", nextStepOrdinals: [], recoveryStepOrdinal: 3, focusReturnRequired: false },
  ],
  terminalStepOrdinal: 3,
  postGraphSuccessChain: ["live_conformance", "capability_and_readiness_projection", "activation_manifest_commit", "active_pointer_commit"],
  terminalState: "live_activation_committed",
  everyPostGraphPhaseIsAutomaticAfterPriorSuccessAndProducesTypedTerminalEvidence: true,
  everyStartStateHasExactlyOneEntryAndAtLeastOnePathToTerminal: true,
  ordinalsAreUniqueContiguousAndEveryEdgeTargetsAnExistingLaterOrRecoveryStep: true,
  everyUserTriggeredStateHasExactlyOnePrimaryActionAndEveryAutomaticStateHasNone: true,
  everyUserTriggeredVisitedStateProducesExactlyOneMatchingSaydoPrimaryActionEvent: true,
  everyExternalTaskUsesExactReturnFocus: true,
  everyConditionalNestedExternalTaskVariantHasTypedEventsSignedLimitsAndPositiveNegativeFixtures: true,
} as const satisfies ReferenceJourneyGraphV3;

const JOURNEY_GRAPH_ENTERPRISE_WORKLOAD_V3 = {
  graphId: "journey-graph:enterprise-workload-identity@3",
  requiredStartingAccountStates: ["enterprise_admin_required", "signed_in_ready"],
  startStateEntrySteps: [
    { startingAccountState: "enterprise_admin_required", firstStepOrdinal: 0 },
    { startingAccountState: "signed_in_ready", firstStepOrdinal: 1 },
  ],
  steps: [
    { stepId: "administrator-approval", ordinal: 0, stepKind: "external_task", externalTaskClass: "administratorApproval", externalTaskProfileDigest: "profile:enterprise-workload-admin-approval", conditionalNestedExternalTasks: REFERENCE_AUTH_CHALLENGE_VARIANTS_V9, authoritativeChallengeOrNegativeEvidenceRequired: true, transitionTrigger: "user_primary_action", primaryActionId: "request-administrator-access", nextStepOrdinals: [1], recoveryStepOrdinal: 0, focusReturnRequired: true },
    { stepId: "commit-required-workload-fields", ordinal: 1, stepKind: "recipe_field_group", fieldSelector: "all_required_recipe_fields_not_committed_by_prior_steps", transitionTrigger: "user_primary_action", primaryActionId: "select-workload-identity", nextStepOrdinals: [2], recoveryStepOrdinal: 1, focusReturnRequired: false },
    { stepId: "validate", ordinal: 2, stepKind: "active_validation", validationStep: "staged_conformance", transitionTrigger: "automatic_after_predecessor_success", nextStepOrdinals: [], recoveryStepOrdinal: 2, focusReturnRequired: false },
  ],
  terminalStepOrdinal: 2,
  postGraphSuccessChain: ["live_conformance", "capability_and_readiness_projection", "activation_manifest_commit", "active_pointer_commit"],
  terminalState: "live_activation_committed",
  everyPostGraphPhaseIsAutomaticAfterPriorSuccessAndProducesTypedTerminalEvidence: true,
  everyStartStateHasExactlyOneEntryAndAtLeastOnePathToTerminal: true,
  ordinalsAreUniqueContiguousAndEveryEdgeTargetsAnExistingLaterOrRecoveryStep: true,
  everyUserTriggeredStateHasExactlyOnePrimaryActionAndEveryAutomaticStateHasNone: true,
  everyUserTriggeredVisitedStateProducesExactlyOneMatchingSaydoPrimaryActionEvent: true,
  everyExternalTaskUsesExactReturnFocus: true,
  everyConditionalNestedExternalTaskVariantHasTypedEventsSignedLimitsAndPositiveNegativeFixtures: true,
} as const satisfies ReferenceJourneyGraphV3;

const JOURNEY_GRAPH_ENTERPRISE_PROFILE_V3 = {
  graphId: "journey-graph:enterprise-existing-profile@3",
  requiredStartingAccountStates: ["externally_managed_service_ready"],
  startStateEntrySteps: [
    { startingAccountState: "externally_managed_service_ready", firstStepOrdinal: 0 },
  ],
  steps: [
    { stepId: "commit-required-profile-fields", ordinal: 0, stepKind: "recipe_field_group", fieldSelector: "all_required_recipe_fields_not_committed_by_prior_steps", transitionTrigger: "user_primary_action", primaryActionId: "select-existing-profile", nextStepOrdinals: [1], recoveryStepOrdinal: 0, focusReturnRequired: false },
    { stepId: "validate", ordinal: 1, stepKind: "active_validation", validationStep: "staged_conformance", transitionTrigger: "automatic_after_predecessor_success", nextStepOrdinals: [], recoveryStepOrdinal: 1, focusReturnRequired: false },
  ],
  terminalStepOrdinal: 1,
  postGraphSuccessChain: ["live_conformance", "capability_and_readiness_projection", "activation_manifest_commit", "active_pointer_commit"],
  terminalState: "live_activation_committed",
  everyPostGraphPhaseIsAutomaticAfterPriorSuccessAndProducesTypedTerminalEvidence: true,
  everyStartStateHasExactlyOneEntryAndAtLeastOnePathToTerminal: true,
  ordinalsAreUniqueContiguousAndEveryEdgeTargetsAnExistingLaterOrRecoveryStep: true,
  everyUserTriggeredStateHasExactlyOnePrimaryActionAndEveryAutomaticStateHasNone: true,
  everyUserTriggeredVisitedStateProducesExactlyOneMatchingSaydoPrimaryActionEvent: true,
  everyExternalTaskUsesExactReturnFocus: true,
  everyConditionalNestedExternalTaskVariantHasTypedEventsSignedLimitsAndPositiveNegativeFixtures: true,
} as const satisfies ReferenceJourneyGraphV3;

const JOURNEY_GRAPH_LOCAL_V3 = {
  ...JOURNEY_GRAPH_GUIDED_KEY_V3,
  graphId: "journey-graph:local-runtime-ready@3",
  requiredStartingAccountStates: ["local_service_ready"],
  startStateEntrySteps: [
    { startingAccountState: "local_service_ready", firstStepOrdinal: 0 },
  ],
  steps: [
    { stepId: "passive-peer-evidence", ordinal: 0, stepKind: "passive_evidence", passiveInput: "known_loopback_listener_metadata", transitionTrigger: "automatic_after_predecessor_success", nextStepOrdinals: [1], recoveryStepOrdinal: 0, focusReturnRequired: false },
    { stepId: "validate", ordinal: 1, stepKind: "active_validation", validationStep: "peer_identity_challenge", transitionTrigger: "automatic_after_predecessor_success", nextStepOrdinals: [], recoveryStepOrdinal: 1, focusReturnRequired: false },
  ],
  terminalStepOrdinal: 1,
} as const satisfies ReferenceJourneyGraphV3;

const JOURNEY_GRAPH_LOCAL_UNMANAGED_RECOVERY_V4 = {
  ...JOURNEY_GRAPH_LOCAL_V3,
  graphId: "journey-graph:local-runtime-unmanaged-recovery@3",
  requiredStartingAccountStates: ["local_service_not_running"],
  startStateEntrySteps: [
    { startingAccountState: "local_service_not_running", firstStepOrdinal: 0 },
  ],
  steps: [
    { stepId: "install-local-runtime", ordinal: 0, stepKind: "external_task", externalTaskClass: "localRuntimeRecovery", externalTaskProfileDigest: "profile:official-runtime-install-with-return", transitionTrigger: "user_primary_action", primaryActionId: "open-official-install-guide", nextStepOrdinals: [1], recoveryStepOrdinal: 0, focusReturnRequired: true },
    { stepId: "start-local-runtime", ordinal: 1, stepKind: "external_task", externalTaskClass: "localRuntimeRecovery", externalTaskProfileDigest: "profile:local-runtime-start-with-return", transitionTrigger: "user_primary_action", primaryActionId: "open-runtime-start-guide", nextStepOrdinals: [2], recoveryStepOrdinal: 1, focusReturnRequired: true },
    { stepId: "load-or-select-model", ordinal: 2, stepKind: "external_task", externalTaskClass: "localRuntimeRecovery", externalTaskProfileDigest: "profile:local-model-load-or-select-with-return", transitionTrigger: "user_primary_action", primaryActionId: "open-model-manager", nextStepOrdinals: [3], recoveryStepOrdinal: 2, focusReturnRequired: true },
    { stepId: "passive-peer-evidence", ordinal: 3, stepKind: "passive_evidence", passiveInput: "known_loopback_listener_metadata", transitionTrigger: "automatic_after_predecessor_success", nextStepOrdinals: [4], recoveryStepOrdinal: 1, focusReturnRequired: false },
    { stepId: "validate", ordinal: 4, stepKind: "active_validation", validationStep: "peer_identity_challenge", transitionTrigger: "automatic_after_predecessor_success", nextStepOrdinals: [], recoveryStepOrdinal: 1, focusReturnRequired: false },
  ],
  terminalStepOrdinal: 4,
} as const satisfies ReferenceJourneyGraphV3;

const JOURNEY_GRAPH_LOCAL_MANAGED_RECOVERY_V4 = {
  ...JOURNEY_GRAPH_LOCAL_V3,
  graphId: "journey-graph:local-runtime-managed-recovery@3",
  requiredStartingAccountStates: ["local_service_not_running"],
  startStateEntrySteps: [
    { startingAccountState: "local_service_not_running", firstStepOrdinal: 0 },
  ],
  steps: [
    { stepId: "enable-or-start-managed-runtime", ordinal: 0, stepKind: "saydo_action", actionId: "enable-or-start-runtime-with-gated-consent", transitionTrigger: "user_primary_action", primaryActionId: "start-local-service", nextStepOrdinals: [1], recoveryStepOrdinal: 0, focusReturnRequired: false },
    { stepId: "resolve-port-or-api-state", ordinal: 1, stepKind: "saydo_action", actionId: "repair-local-api-state-with-gated-consent", transitionTrigger: "user_primary_action", primaryActionId: "repair-api-state", nextStepOrdinals: [2], recoveryStepOrdinal: 1, focusReturnRequired: false },
    { stepId: "load-or-select-model", ordinal: 2, stepKind: "saydo_action", actionId: "load-or-select-local-model-with-gated-consent", transitionTrigger: "user_primary_action", primaryActionId: "load-local-model", nextStepOrdinals: [3], recoveryStepOrdinal: 2, focusReturnRequired: false },
    { stepId: "passive-peer-evidence", ordinal: 3, stepKind: "passive_evidence", passiveInput: "known_loopback_listener_metadata", transitionTrigger: "automatic_after_predecessor_success", nextStepOrdinals: [4], recoveryStepOrdinal: 0, focusReturnRequired: false },
    { stepId: "validate", ordinal: 4, stepKind: "active_validation", validationStep: "peer_identity_challenge", transitionTrigger: "automatic_after_predecessor_success", nextStepOrdinals: [], recoveryStepOrdinal: 0, focusReturnRequired: false },
  ],
  terminalStepOrdinal: 4,
} as const satisfies ReferenceJourneyGraphV3;

const JOURNEY_GRAPH_EXECUTION_V3 = {
  ...JOURNEY_GRAPH_OAUTH_V3,
  graphId: "journey-graph:execution-surface@3",
} as const satisfies ReferenceJourneyGraphV3;

const JOURNEY_GRAPH_EXECUTION_LOCAL_V3 = {
  ...JOURNEY_GRAPH_LOCAL_V3,
  graphId: "journey-graph:execution-local-surface@3",
} as const satisfies ReferenceJourneyGraphV3;

const JOURNEY_GRAPH_EXECUTION_HTTP_V3 = {
  ...JOURNEY_GRAPH_LOCAL_V3,
  graphId: "journey-graph:execution-loopback-http@3",
  steps: [
    { stepId: "passive-peer-evidence", ordinal: 0, stepKind: "passive_evidence", passiveInput: "known_loopback_listener_metadata", transitionTrigger: "automatic_after_predecessor_success", nextStepOrdinals: [1], recoveryStepOrdinal: 0, focusReturnRequired: false },
    { stepId: "observe-server-auth-challenge", ordinal: 1, stepKind: "auth_challenge_observation", observationProfileDigest: "profile:opencode-loopback-http-auth-challenge-v1", challengeDiscriminator: "password_required", transitionTrigger: "automatic_after_predecessor_success", noChallengeNextStepOrdinal: 3, challengeRequiredNextStepOrdinal: 2, authoritativeChallengeOrNegativeEvidenceRequired: true, nextStepOrdinals: [2, 3], recoveryStepOrdinal: 1, focusReturnRequired: false },
    { stepId: "server-basic-credential", ordinal: 2, stepKind: "recipe_field_group", fieldSelector: "opencode_basic_username_and_password_when_challenge_requires_basic", transitionTrigger: "user_primary_action", primaryActionId: "enter-server-credential", nextStepOrdinals: [3], recoveryStepOrdinal: 2, focusReturnRequired: false },
    { stepId: "validate", ordinal: 3, stepKind: "active_validation", validationStep: "staged_conformance", transitionTrigger: "automatic_after_predecessor_success", nextStepOrdinals: [], recoveryStepOrdinal: 3, focusReturnRequired: false },
  ],
  terminalStepOrdinal: 3,
} as const satisfies ReferenceJourneyGraphV3;

const JOURNEY_GRAPH_CLI_STDIO_READY_V4 = {
  ...JOURNEY_GRAPH_LOCAL_V3,
  graphId: "journey-graph:cli-stdio-ready@3",
  requiredStartingAccountStates: ["externally_managed_service_ready"],
  startStateEntrySteps: [
    { startingAccountState: "externally_managed_service_ready", firstStepOrdinal: 0 },
  ],
  steps: [
    { stepId: "passive-signed-cli-evidence", ordinal: 0, stepKind: "passive_evidence", passiveInput: "signed_binary_and_version", transitionTrigger: "automatic_after_predecessor_success", nextStepOrdinals: [1], recoveryStepOrdinal: 0, focusReturnRequired: false },
    { stepId: "validate-stdio-handshake", ordinal: 1, stepKind: "active_validation", validationStep: "staged_conformance", transitionTrigger: "automatic_after_predecessor_success", nextStepOrdinals: [], recoveryStepOrdinal: 1, focusReturnRequired: false },
  ],
  terminalStepOrdinal: 1,
} as const satisfies ReferenceJourneyGraphV3;

const JOURNEY_GRAPH_BRIDGE_OPENAI_V4 = {
  ...JOURNEY_GRAPH_LOCAL_V3,
  graphId: "journey-graph:bridge-openai-loopback@3",
  steps: [
    { stepId: "passive-peer-evidence", ordinal: 0, stepKind: "passive_evidence", passiveInput: "known_loopback_listener_metadata", transitionTrigger: "automatic_after_predecessor_success", nextStepOrdinals: [1], recoveryStepOrdinal: 0, focusReturnRequired: false },
    { stepId: "observe-bridge-auth-challenge", ordinal: 1, stepKind: "auth_challenge_observation", observationProfileDigest: "profile:openai-compatible-bridge-auth-challenge-v1", challengeDiscriminator: "secret_required", transitionTrigger: "automatic_after_predecessor_success", noChallengeNextStepOrdinal: 3, challengeRequiredNextStepOrdinal: 2, authoritativeChallengeOrNegativeEvidenceRequired: true, nextStepOrdinals: [2, 3], recoveryStepOrdinal: 1, focusReturnRequired: false },
    { stepId: "bridge-api-key", ordinal: 2, stepKind: "manual_field", fieldId: "api_key", transitionTrigger: "user_primary_action", primaryActionId: "enter-bridge-api-key", nextStepOrdinals: [3], recoveryStepOrdinal: 2, focusReturnRequired: false },
    { stepId: "validate", ordinal: 3, stepKind: "active_validation", validationStep: "staged_conformance", transitionTrigger: "automatic_after_predecessor_success", nextStepOrdinals: [], recoveryStepOrdinal: 3, focusReturnRequired: false },
  ],
  terminalStepOrdinal: 3,
} as const satisfies ReferenceJourneyGraphV3;

const JOURNEY_GRAPH_LOCAL_OPTIONAL_BEARER_V6 = {
  ...JOURNEY_GRAPH_LOCAL_V3,
  graphId: "journey-graph:local-optional-bearer@6",
  steps: [
    { stepId: "passive-peer-evidence", ordinal: 0, stepKind: "passive_evidence", passiveInput: "known_loopback_listener_metadata", transitionTrigger: "automatic_after_predecessor_success", nextStepOrdinals: [1], recoveryStepOrdinal: 0, focusReturnRequired: false },
    { stepId: "observe-local-auth-challenge", ordinal: 1, stepKind: "auth_challenge_observation", observationProfileDigest: "profile:local-server-optional-bearer-authoritative-challenge-v6", challengeDiscriminator: "bearer_required", transitionTrigger: "automatic_after_predecessor_success", noChallengeNextStepOrdinal: 3, challengeRequiredNextStepOrdinal: 2, authoritativeChallengeOrNegativeEvidenceRequired: true, nextStepOrdinals: [2, 3], recoveryStepOrdinal: 1, focusReturnRequired: false },
    { stepId: "local-api-token", ordinal: 2, stepKind: "manual_field", fieldId: "api_key", transitionTrigger: "user_primary_action", primaryActionId: "enter-local-api-token", nextStepOrdinals: [3], recoveryStepOrdinal: 2, focusReturnRequired: false },
    { stepId: "validate", ordinal: 3, stepKind: "active_validation", validationStep: "staged_conformance", transitionTrigger: "automatic_after_predecessor_success", nextStepOrdinals: [], recoveryStepOrdinal: 3, focusReturnRequired: false },
  ],
  terminalStepOrdinal: 3,
} as const satisfies ReferenceJourneyGraphV3;

const JOURNEY_GRAPH_LOCAL_OPTIONAL_ANTHROPIC_AUTH_V9 = {
  ...JOURNEY_GRAPH_LOCAL_V3,
  graphId: "journey-graph:local-optional-anthropic-auth@6",
  steps: [
    { stepId: "passive-peer-evidence", ordinal: 0, stepKind: "passive_evidence", passiveInput: "known_loopback_listener_metadata", transitionTrigger: "automatic_after_predecessor_success", nextStepOrdinals: [1], recoveryStepOrdinal: 0, focusReturnRequired: false },
    { stepId: "observe-local-auth-challenge", ordinal: 1, stepKind: "auth_challenge_observation", observationProfileDigest: "profile:lm-studio-messages-optional-anthropic-auth-authoritative-challenge-v9", challengeDiscriminator: "secret_required", transitionTrigger: "automatic_after_predecessor_success", noChallengeNextStepOrdinal: 3, challengeRequiredNextStepOrdinal: 2, authoritativeChallengeOrNegativeEvidenceRequired: true, nextStepOrdinals: [2, 3], recoveryStepOrdinal: 1, focusReturnRequired: false },
    { stepId: "local-api-token", ordinal: 2, stepKind: "manual_field", fieldId: "api_key", transitionTrigger: "user_primary_action", primaryActionId: "enter-local-api-token", nextStepOrdinals: [3], recoveryStepOrdinal: 2, focusReturnRequired: false },
    { stepId: "validate", ordinal: 3, stepKind: "active_validation", validationStep: "staged_conformance", transitionTrigger: "automatic_after_predecessor_success", nextStepOrdinals: [], recoveryStepOrdinal: 3, focusReturnRequired: false },
  ],
  terminalStepOrdinal: 3,
} as const satisfies ReferenceJourneyGraphV3;

const JOURNEY_GRAPH_CC_SWITCH_PROXY_V6 = {
  ...JOURNEY_GRAPH_LOCAL_V3,
  graphId: "journey-graph:cc-switch-public-proxy@6",
  requiredStartingAccountStates: ["local_service_ready"],
  startStateEntrySteps: [{ startingAccountState: "local_service_ready", firstStepOrdinal: 0 }],
  steps: [
    { stepId: "passive-peer-evidence", ordinal: 0, stepKind: "passive_evidence", passiveInput: "known_loopback_listener_metadata", transitionTrigger: "automatic_after_predecessor_success", nextStepOrdinals: [1], recoveryStepOrdinal: 0, focusReturnRequired: false },
    { stepId: "observe-public-proxy-profile", ordinal: 1, stepKind: "passive_evidence", passiveInput: "public_cli_config_metadata", transitionTrigger: "automatic_after_predecessor_success", nextStepOrdinals: [2], recoveryStepOrdinal: 1, focusReturnRequired: false },
    { stepId: "acknowledge-opaque-route-and-funding", ordinal: 2, stepKind: "saydo_action", actionId: "acknowledge-cc-switch-external-route-control", transitionTrigger: "user_primary_action", primaryActionId: "review-external-routing", nextStepOrdinals: [3], recoveryStepOrdinal: 2, focusReturnRequired: false },
    { stepId: "validate-public-proxy", ordinal: 3, stepKind: "active_validation", validationStep: "staged_conformance", transitionTrigger: "automatic_after_predecessor_success", nextStepOrdinals: [], recoveryStepOrdinal: 3, focusReturnRequired: false },
  ],
  terminalStepOrdinal: 3,
} as const satisfies ReferenceJourneyGraphV3;

const JOURNEY_GRAPH_EXECUTION_INSTALL_RECOVERY_V6 = {
  ...JOURNEY_GRAPH_CLI_STDIO_READY_V4,
  graphId: "journey-graph:execution-install-recovery@6",
  steps: [
    { stepId: "install-exact-execution-surface", ordinal: 0, stepKind: "external_task", externalTaskClass: "localRuntimeRecovery", externalTaskProfileDigest: "profile:exact-signed-execution-surface-install-and-return-v6", transitionTrigger: "user_primary_action", primaryActionId: "open-exact-official-execution-install", nextStepOrdinals: [1], recoveryStepOrdinal: 0, focusReturnRequired: true },
    { stepId: "passive-signed-cli-evidence", ordinal: 1, stepKind: "passive_evidence", passiveInput: "signed_binary_and_version", transitionTrigger: "automatic_after_predecessor_success", nextStepOrdinals: [2], recoveryStepOrdinal: 0, focusReturnRequired: false },
    { stepId: "validate-exact-execution-handshake", ordinal: 2, stepKind: "active_validation", validationStep: "staged_conformance", transitionTrigger: "automatic_after_predecessor_success", nextStepOrdinals: [], recoveryStepOrdinal: 0, focusReturnRequired: false },
  ],
  terminalStepOrdinal: 2,
} as const satisfies ReferenceJourneyGraphV3;

const JOURNEY_GRAPH_EXECUTION_SESSION_RECOVERY_V6 = {
  ...JOURNEY_GRAPH_EXECUTION_V3,
  graphId: "journey-graph:execution-session-recovery@6",
  steps: [
    { stepId: "reconcile-exact-execution-session", ordinal: 0, stepKind: "saydo_action", actionId: "reconcile-execution-session-and-delivery", transitionTrigger: "user_primary_action", primaryActionId: "recover-execution-session", nextStepOrdinals: [1], recoveryStepOrdinal: 0, focusReturnRequired: false },
    { stepId: "validate-fresh-session-and-completed-turn", ordinal: 1, stepKind: "active_validation", validationStep: "live_conformance", transitionTrigger: "automatic_after_predecessor_success", nextStepOrdinals: [], recoveryStepOrdinal: 0, focusReturnRequired: false },
  ],
  terminalStepOrdinal: 1,
} as const satisfies ReferenceJourneyGraphV3;

const JOURNEY_GRAPH_BRIDGE_SERVICE_RECOVERY_V6 = {
  ...JOURNEY_GRAPH_BRIDGE_OPENAI_V4,
  graphId: "journey-graph:bridge-service-recovery@6",
  steps: [
    { stepId: "start-exact-bridge-service", ordinal: 0, stepKind: "external_task", externalTaskClass: "localRuntimeRecovery", externalTaskProfileDigest: "profile:exact-bridge-service-start-and-return-v6", transitionTrigger: "user_primary_action", primaryActionId: "open-exact-bridge-service", nextStepOrdinals: [1], recoveryStepOrdinal: 0, focusReturnRequired: true },
    { stepId: "passive-peer-evidence", ordinal: 1, stepKind: "passive_evidence", passiveInput: "known_loopback_listener_metadata", transitionTrigger: "automatic_after_predecessor_success", nextStepOrdinals: [2], recoveryStepOrdinal: 0, focusReturnRequired: false },
    { stepId: "validate-exact-bridge-route-policy", ordinal: 2, stepKind: "active_validation", validationStep: "staged_conformance", transitionTrigger: "automatic_after_predecessor_success", nextStepOrdinals: [], recoveryStepOrdinal: 0, focusReturnRequired: false },
  ],
  terminalStepOrdinal: 2,
} as const satisfies ReferenceJourneyGraphV3;

const JOURNEY_GRAPH_CUSTOM_V3 = {
  ...JOURNEY_GRAPH_GUIDED_KEY_V3,
  graphId: "journey-graph:custom-endpoint@3",
  requiredStartingAccountStates: ["externally_managed_service_ready"],
  startStateEntrySteps: [{ startingAccountState: "externally_managed_service_ready", firstStepOrdinal: 0 }],
  steps: [
    { stepId: "base-url", ordinal: 0, stepKind: "manual_field", fieldId: "base_url", transitionTrigger: "user_primary_action", primaryActionId: "enter-base-url", nextStepOrdinals: [1], recoveryStepOrdinal: 0, focusReturnRequired: false },
    { stepId: "protocol", ordinal: 1, stepKind: "manual_field", fieldId: "protocol", transitionTrigger: "user_primary_action", primaryActionId: "choose-protocol", nextStepOrdinals: [2], recoveryStepOrdinal: 1, focusReturnRequired: false },
    { stepId: "model", ordinal: 2, stepKind: "manual_field", fieldId: "model_or_deployment", transitionTrigger: "user_primary_action", primaryActionId: "choose-model", nextStepOrdinals: [3], recoveryStepOrdinal: 2, focusReturnRequired: false },
    { stepId: "credential", ordinal: 3, stepKind: "recipe_field_group", fieldSelector: "all_required_recipe_fields_not_committed_by_prior_steps", transitionTrigger: "user_primary_action", primaryActionId: "save-credential", nextStepOrdinals: [4], recoveryStepOrdinal: 3, focusReturnRequired: false },
    { stepId: "validate", ordinal: 4, stepKind: "active_validation", validationStep: "staged_conformance", transitionTrigger: "automatic_after_predecessor_success", nextStepOrdinals: [], recoveryStepOrdinal: 4, focusReturnRequired: false },
  ],
  terminalStepOrdinal: 4,
} as const satisfies ReferenceJourneyGraphV3;

const JOURNEY_GRAPH_ANCHOR_V3 = {
  ...JOURNEY_GRAPH_GUIDED_KEY_V3,
  graphId: "journey-graph:anchor-control@3",
  requiredStartingAccountStates: ["signed_in_ready"],
  startStateEntrySteps: [{ startingAccountState: "signed_in_ready", firstStepOrdinal: 0 }],
  steps: [
    { stepId: "enroll-anchor", ordinal: 0, stepKind: "saydo_action", actionId: "enroll-local-anchor", transitionTrigger: "user_primary_action", primaryActionId: "enroll-security-anchor", nextStepOrdinals: [1], recoveryStepOrdinal: 0, focusReturnRequired: false },
    { stepId: "validate-anchor", ordinal: 1, stepKind: "active_validation", validationStep: "staged_conformance", transitionTrigger: "automatic_after_predecessor_success", nextStepOrdinals: [], recoveryStepOrdinal: 1, focusReturnRequired: false },
  ],
  terminalStepOrdinal: 1,
} as const satisfies ReferenceJourneyGraphV3;

const LOCAL_RUNTIME_RECOVERY_UX_CONTRACT_V4 = {
  maximumSaydoPrimaryActions: 3,
  maximumExternalTasks: 3,
  maximumManualFields: 1,
  maximumLeaveAndReturnCount: 3,
  maximumRecoveryLoops: 2,
  maximumAppElapsedMillis: 600_000,
  maximumRawElapsedMillis: 2_700_000,
} as const;

const LOCAL_UNMANAGED_RUNTIME_RECOVERY_SCENARIOS_V4 = [
  { runtimeState: "not_installed", recoveryGraph: JOURNEY_GRAPH_LOCAL_UNMANAGED_RECOVERY_V4, firstRecoveryStepOrdinal: 0 },
  { runtimeState: "not_running", recoveryGraph: JOURNEY_GRAPH_LOCAL_UNMANAGED_RECOVERY_V4, firstRecoveryStepOrdinal: 1 },
  { runtimeState: "cold", recoveryGraph: JOURNEY_GRAPH_LOCAL_UNMANAGED_RECOVERY_V4, firstRecoveryStepOrdinal: 2 },
  { runtimeState: "no_model", recoveryGraph: JOURNEY_GRAPH_LOCAL_UNMANAGED_RECOVERY_V4, firstRecoveryStepOrdinal: 2 },
] as const satisfies readonly Pick<
  ReferenceRuntimeRecoveryScenarioV4,
  "runtimeState" | "recoveryGraph" | "firstRecoveryStepOrdinal"
>[];

const LOCAL_MANAGED_RUNTIME_RECOVERY_SCENARIOS_V4 = [
  { runtimeState: "disabled", recoveryGraph: JOURNEY_GRAPH_LOCAL_MANAGED_RECOVERY_V4, firstRecoveryStepOrdinal: 0 },
  { runtimeState: "api_disabled", recoveryGraph: JOURNEY_GRAPH_LOCAL_MANAGED_RECOVERY_V4, firstRecoveryStepOrdinal: 0 },
  { runtimeState: "api_off", recoveryGraph: JOURNEY_GRAPH_LOCAL_MANAGED_RECOVERY_V4, firstRecoveryStepOrdinal: 0 },
  { runtimeState: "stopped", recoveryGraph: JOURNEY_GRAPH_LOCAL_MANAGED_RECOVERY_V4, firstRecoveryStepOrdinal: 0 },
  { runtimeState: "not_running", recoveryGraph: JOURNEY_GRAPH_LOCAL_MANAGED_RECOVERY_V4, firstRecoveryStepOrdinal: 0 },
  { runtimeState: "port_conflict", recoveryGraph: JOURNEY_GRAPH_LOCAL_MANAGED_RECOVERY_V4, firstRecoveryStepOrdinal: 1 },
  { runtimeState: "no_model", recoveryGraph: JOURNEY_GRAPH_LOCAL_MANAGED_RECOVERY_V4, firstRecoveryStepOrdinal: 2 },
  { runtimeState: "cold", recoveryGraph: JOURNEY_GRAPH_LOCAL_MANAGED_RECOVERY_V4, firstRecoveryStepOrdinal: 2 },
  { runtimeState: "unsupported_version", recoveryGraph: JOURNEY_GRAPH_LOCAL_UNMANAGED_RECOVERY_V4, firstRecoveryStepOrdinal: 0 },
] as const satisfies readonly Pick<
  ReferenceRuntimeRecoveryScenarioV4,
  "runtimeState" | "recoveryGraph" | "firstRecoveryStepOrdinal"
>[];

type CompleteReferenceRuntimeRecoveryScenarioV4<
  S extends Pick<
    ReferenceRuntimeRecoveryScenarioV4,
    "runtimeState" | "recoveryGraph" | "firstRecoveryStepOrdinal"
  >,
> = S & {
  readonly initialConnectionReadiness: "action_required";
  readonly zeroConfigPassClaimForbiddenBeforeRecoveryTerminal: true;
  readonly successfulRecoveryStillRequiresTheFullPostGraphSuccessChain: true;
  readonly recoveryUxContract: typeof LOCAL_RUNTIME_RECOVERY_UX_CONTRACT_V4;
};

declare function completeReferenceRuntimeRecoveryScenariosV4<
  const S extends readonly Pick<
    ReferenceRuntimeRecoveryScenarioV4,
    "runtimeState" | "recoveryGraph" | "firstRecoveryStepOrdinal"
  >[],
>(scenarios: S): { readonly [I in keyof S]: CompleteReferenceRuntimeRecoveryScenarioV4<S[I]> };

const COMPLETE_LOCAL_UNMANAGED_RUNTIME_RECOVERY_SCENARIOS_V4 =
  completeReferenceRuntimeRecoveryScenariosV4(LOCAL_UNMANAGED_RUNTIME_RECOVERY_SCENARIOS_V4);
const COMPLETE_LOCAL_MANAGED_RUNTIME_RECOVERY_SCENARIOS_V4 =
  completeReferenceRuntimeRecoveryScenariosV4(LOCAL_MANAGED_RUNTIME_RECOVERY_SCENARIOS_V4);

interface ReferenceRecipeFieldBaseV1 {
  readonly fieldId:
    | "api_key"
    | "base_url"
    | "protocol"
    | "model_or_deployment"
    | "region"
    | "account_or_principal"
    | "profile"
    | "server_username"
    | "server_password"
    | "client_certificate"
    | "client_private_key_handle"
    | "custom_secret_header_name"
    | "custom_secret_header_value";
  readonly classification: "secret" | "public_configuration" | "credential_handle";
  readonly source:
    | "passive_discovery"
    | "trusted_product_default"
    | "explicit_user_selection"
    | "manual_secret_broker_entry"
    | "os_credential_or_identity_broker";
  readonly persistedAs: "none" | "public_profile" | "secret_broker_handle" | "identity_broker_handle";
  readonly uxMetricClass: keyof GaUxPlannedMetricsV2["maximumManualFieldsByClass"];
  readonly trustedPublicDefault?: "opencode";
}

type ReferenceRecipeFieldV1 = ReferenceRecipeFieldBaseV1 &
  (
    | { readonly required: true; readonly requiredWhen?: never }
    | { readonly required: false; readonly requiredWhen?: never }
    | {
        readonly required: false;
        readonly requiredWhen: {
          readonly observationStepId: string;
          readonly discriminator: "password_required" | "secret_required" | "bearer_required" | "x_api_key_required";
          readonly otherwiseFieldMustBeAbsent: true;
        };
      }
  );

interface ReferenceOnboardingRecipeV1 {
  readonly recipeClass:
    | "guided_static_key"
    | "browser_key_exchange"
    | "browser_oauth"
    | "workload_identity"
    | "aws_named_profile"
    | "aws_sso"
    | "local_zero_config"
    | "local_optional_bearer"
    | "local_optional_anthropic_auth"
    | "existing_connection_migration_only"
    | "local_managed_service"
    | "execution_stdio"
    | "execution_loopback_http"
    | "bridge_loopback_control"
    | "cc_switch_public_proxy"
    | "custom_endpoint"
    | "custom_mtls"
    | "anchor_control";
  readonly passiveInputs: readonly (
    | "release_pinned_official_preset"
    | "public_cli_config_metadata"
    | "signed_binary_and_version"
    | "known_loopback_listener_metadata"
    | "legacy_connection_metadata_and_broker_handle"
    | "os_identity_metadata"
    | "none"
  )[];
  readonly fields: readonly ReferenceRecipeFieldV1[];
  readonly activeValidationSequence: readonly (
    | "credential_free_metadata_if_supported"
    | "peer_identity_challenge"
    | "current_rights_and_funding_check"
    | "staged_conformance"
    | "safe_restart_or_rebind"
    | "live_conformance"
    | "legacy_connection_read_only_validation"
    | "migration_destination_qualification"
    | "legacy_connection_retirement_or_read_only_retention"
    | "capability_and_readiness_projection"
  )[];
  readonly recoveryStates: readonly (
    | "not_installed"
    | "not_running"
    | "auth_missing"
    | "auth_expired_or_revoked"
    | "rights_or_quota_blocked"
    | "network_or_proxy_blocked"
    | "model_missing_or_cold"
    | "endpoint_or_protocol_mismatch"
    | "leave_and_return"
    | "delivery_unknown"
    | "configuration_drift"
  )[];
  readonly journeyGraph: ReferenceJourneyGraphV3;
  readonly requiredStartingAccountStates: NonEmptyReadonly<ReferenceStartingAccountStateV3>;
  readonly returnFocusPolicy: "resume_exact_source_card_v1";
  readonly onePrimaryActionPerUserTriggeredStateAndNoneForAutomaticState: true;
  readonly neverReadsThirdPartySecretStore: true;
  readonly accountCreationBillingActivationCredentialCreationAndFreshPickerActionCount?: 0;
  readonly acceptsOnlyExistingLegacyConnectionMetadataAndExistingBrokerHandle?: true;
}

type CredentialCustodyProfileV5 =
  | { readonly kind: "none"; readonly secretBrokerReadCount: 0 }
  | {
      readonly kind: "manual_secret_broker";
      readonly importPolicy: "explicit_user_entry_only";
      readonly keyLifecycle: "provider_managed_create_rotate_revoke";
    }
  | {
      readonly kind: "os_identity_broker";
      readonly tokenLifecycle: "short_lived_refresh_or_reissue";
    }
  | {
      readonly kind: "official_sdk_signer";
      readonly credentialDiscovery: "explicit_profile_or_bound_workload_identity_only";
    }
  | {
      readonly kind: "upstream_application";
      readonly saydoCredentialReadForbidden: true;
    };

type WireAuthSchemeV5 =
  | { readonly kind: "none" }
  | { readonly kind: "authorization_bearer"; readonly headerName: "Authorization"; readonly prefix: "Bearer " }
  | { readonly kind: "anthropic_x_api_key"; readonly headerName: "x-api-key"; readonly prefix: "" }
  | { readonly kind: "google_api_key"; readonly headerName: "x-goog-api-key"; readonly prefix: "" }
  | { readonly kind: "azure_api_key"; readonly headerName: "api-key"; readonly prefix: "" }
  | { readonly kind: "http_basic"; readonly headerName: "Authorization"; readonly prefix: "Basic " }
  | { readonly kind: "aws_sigv4"; readonly signedAuthorizationHeader: true }
  | { readonly kind: "declarative_signature"; readonly signingProfileDigest: string }
  | { readonly kind: "mutual_tls"; readonly clientCertificateRequired: true }
  | { readonly kind: "configured_secret_header"; readonly reservedHeaderCollisionForbidden: true };

type AuthChallengeModeV5 =
  | { readonly kind: "none" }
  | { readonly kind: "browser_pkce"; readonly returnMode: "loopback_or_claimed_https" }
  | { readonly kind: "device_authorization"; readonly pollingIsHostOwned: true }
  | { readonly kind: "workload_identity"; readonly interactiveBrowserForbidden: true }
  | {
      readonly kind: "optional_server_challenge";
      readonly acceptedWireSchemes: readonly WireAuthSchemeV5[];
      readonly authoritativeChallengeAndNegativeEvidenceRequired: true;
    };

interface ReferenceAuthProfileV5 {
  readonly profileId: `auth-profile:${string}@5`;
  readonly custody: CredentialCustodyProfileV5;
  readonly wire: WireAuthSchemeV5;
  readonly challenge: AuthChallengeModeV5;
  readonly principalBindingClass:
    | "none"
    | "provider_account"
    | "provider_project_and_key"
    | "cloud_resource_and_principal"
    | "upstream_application_session"
    | "custom_endpoint_subject";
  readonly credentialVersionAndPrincipalEnterEndpointIdentityWhenSayDoOwnsCredential: true;
  readonly passiveDiscoveryNeverReadsCredentialBytes: true;
}

type DefaultReferenceAuthProfileForKindV5<K extends AuthSource["kind"]> =
  ReferenceAuthProfileV5 &
    (K extends "none"
      ? {
          readonly profileId: "auth-profile:no-application-credential@5";
          readonly custody: Extract<CredentialCustodyProfileV5, { readonly kind: "none" }>;
          readonly wire: Extract<WireAuthSchemeV5, { readonly kind: "none" }>;
          readonly challenge: { readonly kind: "none" };
          readonly principalBindingClass: "none";
        }
      : K extends "bearer"
        ? {
            readonly profileId: "auth-profile:manual-authorization-bearer@5";
            readonly custody: Extract<CredentialCustodyProfileV5, { readonly kind: "manual_secret_broker" }>;
            readonly wire: Extract<WireAuthSchemeV5, { readonly kind: "authorization_bearer" }>;
            readonly challenge: { readonly kind: "none" };
            readonly principalBindingClass: "provider_account";
          }
        : K extends "x_api_key"
          ? {
              readonly profileId: "auth-profile:manual-x-api-key@5";
              readonly custody: Extract<CredentialCustodyProfileV5, { readonly kind: "manual_secret_broker" }>;
              readonly wire: Extract<WireAuthSchemeV5, { readonly kind: "anthropic_x_api_key" }>;
              readonly challenge: { readonly kind: "none" };
              readonly principalBindingClass: "provider_account";
            }
          : K extends "basic"
            ? {
                readonly profileId: "auth-profile:manual-http-basic@5";
                readonly custody: Extract<CredentialCustodyProfileV5, { readonly kind: "manual_secret_broker" }>;
                readonly wire: Extract<WireAuthSchemeV5, { readonly kind: "http_basic" }>;
                readonly challenge: { readonly kind: "none" };
                readonly principalBindingClass: "custom_endpoint_subject";
              }
            : K extends "oauth_pkce" | "api_key_pkce_exchange"
              ? {
                  readonly profileId: "auth-profile:browser-pkce-brokered-result@5";
                  readonly custody: Extract<CredentialCustodyProfileV5, { readonly kind: "os_identity_broker" }>;
                  readonly wire: Extract<WireAuthSchemeV5, { readonly kind: "authorization_bearer" }>;
                  readonly challenge: Extract<AuthChallengeModeV5, { readonly kind: "browser_pkce" }>;
                  readonly principalBindingClass: "provider_account";
                }
              : K extends "oauth_device"
                ? {
                    readonly profileId: "auth-profile:device-oauth-bearer@5";
                    readonly custody: Extract<CredentialCustodyProfileV5, { readonly kind: "os_identity_broker" }>;
                    readonly wire: Extract<WireAuthSchemeV5, { readonly kind: "authorization_bearer" }>;
                    readonly challenge: Extract<AuthChallengeModeV5, { readonly kind: "device_authorization" }>;
                    readonly principalBindingClass: "provider_account";
                  }
                : K extends "workload_identity"
                  ? {
                      readonly profileId: "auth-profile:workload-identity-bearer@5";
                      readonly custody: Extract<CredentialCustodyProfileV5, { readonly kind: "os_identity_broker" }>;
                      readonly wire: Extract<WireAuthSchemeV5, { readonly kind: "authorization_bearer" }>;
                      readonly challenge: Extract<AuthChallengeModeV5, { readonly kind: "workload_identity" }>;
                      readonly principalBindingClass: "cloud_resource_and_principal";
                    }
                  : K extends "aws_static_profile_sigv4"
                    ? {
                        readonly profileId: "auth-profile:aws-explicit-profile-sigv4@5";
                        readonly custody: Extract<CredentialCustodyProfileV5, { readonly kind: "official_sdk_signer" }>;
                        readonly wire: Extract<WireAuthSchemeV5, { readonly kind: "aws_sigv4" }>;
                        readonly challenge: { readonly kind: "none" };
                        readonly principalBindingClass: "cloud_resource_and_principal";
                      }
                    : K extends "declarative_signature"
                      ? {
                          readonly profileId: "auth-profile:trusted-declarative-signature@5";
                          readonly custody: Extract<CredentialCustodyProfileV5, { readonly kind: "official_sdk_signer" }>;
                          readonly wire: Extract<WireAuthSchemeV5, { readonly kind: "declarative_signature" }>;
                          readonly challenge: { readonly kind: "none" };
                          readonly principalBindingClass: "cloud_resource_and_principal";
                        }
                      : K extends "transport_mtls_only"
                        ? {
                            readonly profileId: "auth-profile:transport-mtls-only@5";
                            readonly custody: Extract<CredentialCustodyProfileV5, { readonly kind: "os_identity_broker" }>;
                            readonly wire: Extract<WireAuthSchemeV5, { readonly kind: "mutual_tls" }>;
                            readonly challenge: { readonly kind: "none" };
                            readonly principalBindingClass: "custom_endpoint_subject";
                          }
                        : K extends "custom_secret_header" | "registry_header"
                          ? {
                              readonly profileId: "auth-profile:registry-or-custom-secret-header@5";
                              readonly custody: Extract<CredentialCustodyProfileV5, { readonly kind: "manual_secret_broker" }>;
                              readonly wire: Extract<WireAuthSchemeV5, { readonly kind: "configured_secret_header" }>;
                              readonly challenge: { readonly kind: "none" };
                              readonly principalBindingClass: "custom_endpoint_subject";
                            }
                          : {
                              readonly profileId: "auth-profile:upstream-application-owned@5";
                              readonly custody: Extract<CredentialCustodyProfileV5, { readonly kind: "upstream_application" }>;
                              readonly wire: Extract<WireAuthSchemeV5, { readonly kind: "none" }>;
                              readonly challenge: { readonly kind: "none" };
                              readonly principalBindingClass: "upstream_application_session";
                            });

type ReferenceAuthProfileForRequirementV5<R extends {
  readonly requirementKey: string;
  readonly authKind: AuthSource["kind"];
}> = R["requirementKey"] extends "google.genai.key"
  ? ReferenceAuthProfileV5 & {
      readonly profileId: "auth-profile:google-gemini-x-goog-api-key@5";
      readonly custody: Extract<CredentialCustodyProfileV5, { readonly kind: "manual_secret_broker" }>;
      readonly wire: Extract<WireAuthSchemeV5, { readonly kind: "google_api_key" }>;
      readonly challenge: { readonly kind: "none" };
      readonly principalBindingClass: "provider_project_and_key";
      readonly googleCloudProjectIdentityDigestRequired: true;
      readonly apiKeyProjectRestrictionAndRotationEvidenceRequired: true;
    }
  : R["requirementKey"] extends "azure.key" | "azure.chat.key"
    ? ReferenceAuthProfileV5 & {
        readonly profileId: "auth-profile:azure-openai-api-key-header@5";
        readonly custody: Extract<CredentialCustodyProfileV5, { readonly kind: "manual_secret_broker" }>;
        readonly wire: Extract<WireAuthSchemeV5, { readonly kind: "azure_api_key" }>;
        readonly challenge: { readonly kind: "none" };
        readonly principalBindingClass: "cloud_resource_and_principal";
        readonly azureResourceDeploymentAndKeyVersionRequired: true;
      }
    : R["requirementKey"] extends "bigmodel.chat"
      ? ReferenceAuthProfileV5 & {
          readonly profileId: "auth-profile:zhipu-chat-authorization-bearer@5";
          readonly custody: Extract<CredentialCustodyProfileV5, { readonly kind: "manual_secret_broker" }>;
          readonly wire: Extract<WireAuthSchemeV5, { readonly kind: "authorization_bearer" }>;
          readonly challenge: { readonly kind: "none" };
          readonly principalBindingClass: "provider_account";
          readonly ordinaryPlatformApiKeyNamespaceAndVersionRequired: true;
          readonly codingPlanKeyCannotSubstituteOrdinaryPlatformKey: true;
        }
    : R["requirementKey"] extends
          | "azure.entra-user"
          | "azure.service-principal"
          | "azure.managed-identity"
          | "azure.chat.entra-user"
          | "azure.chat.service-principal"
          | "azure.chat.managed-identity"
      ? ReferenceAuthProfileV5 & {
          readonly profileId: "auth-profile:azure-entra-bearer@5";
          readonly wire: Extract<WireAuthSchemeV5, { readonly kind: "authorization_bearer" }>;
          readonly principalBindingClass: "cloud_resource_and_principal";
          readonly azureTenantPrincipalResourceAndTokenAudienceRequired: true;
        }
      : R["requirementKey"] extends "bigmodel.messages"
        ? ReferenceAuthProfileV5 & {
            readonly profileId: "auth-profile:zhipu-messages-x-api-key@5";
            readonly custody: Extract<CredentialCustodyProfileV5, { readonly kind: "manual_secret_broker" }>;
            readonly wire: Extract<WireAuthSchemeV5, { readonly kind: "anthropic_x_api_key" }>;
            readonly challenge: { readonly kind: "none" };
            readonly principalBindingClass: "provider_account";
            readonly ordinaryPlatformApiKeyNamespaceAndVersionRequired: true;
            readonly codingPlanKeyCannotSubstituteOrdinaryPlatformKey: true;
          }
        : R["requirementKey"] extends "kimi.platform.chat"
          ? ReferenceAuthProfileV5 & {
              readonly profileId: "auth-profile:kimi-platform-chat-authorization-bearer@5";
              readonly custody: Extract<CredentialCustodyProfileV5, { readonly kind: "manual_secret_broker" }>;
              readonly wire: Extract<WireAuthSchemeV5, { readonly kind: "authorization_bearer" }>;
              readonly challenge: { readonly kind: "none" };
              readonly principalBindingClass: "provider_account";
              readonly platformPaygKeyNamespaceAndVersionRequired: true;
              readonly kimiCodeMembershipKeyCannotSubstitutePlatformKey: true;
            }
          : R["requirementKey"] extends "kimi.code.chat"
            ? ReferenceAuthProfileV5 & {
                readonly profileId: "auth-profile:kimi-code-chat-authorization-bearer@5";
                readonly custody: Extract<CredentialCustodyProfileV5, { readonly kind: "manual_secret_broker" }>;
                readonly wire: Extract<WireAuthSchemeV5, { readonly kind: "authorization_bearer" }>;
                readonly challenge: { readonly kind: "none" };
                readonly principalBindingClass: "provider_account";
                readonly membershipPrincipalKeyVersionAndEntitlementRequired: true;
                readonly platformPaygKeyCannotSubstituteMembershipKey: true;
              }
            : R["requirementKey"] extends "kimi.code.messages"
              ? ReferenceAuthProfileV5 & {
                  readonly profileId: "auth-profile:kimi-code-messages-x-api-key@5";
                  readonly custody: Extract<CredentialCustodyProfileV5, { readonly kind: "manual_secret_broker" }>;
                  readonly wire: Extract<WireAuthSchemeV5, { readonly kind: "anthropic_x_api_key" }>;
                  readonly challenge: { readonly kind: "none" };
                  readonly principalBindingClass: "provider_account";
                  readonly membershipPrincipalKeyVersionAndEntitlementRequired: true;
                  readonly platformPaygKeyCannotSubstituteMembershipKey: true;
                }
        : R["requirementKey"] extends
              | "tokenhub.gz.chat"
              | "tokenhub.gz.responses"
              | "tokenhub.sg.chat"
              | "tokenhub.sg.responses"
          ? ReferenceAuthProfileV5 & {
              readonly profileId: R["requirementKey"] extends `tokenhub.gz.${string}`
                ? "auth-profile:tencent-tokenhub-guangzhou-openai-bearer@5"
                : "auth-profile:tencent-tokenhub-singapore-openai-bearer@5";
              readonly custody: Extract<CredentialCustodyProfileV5, { readonly kind: "manual_secret_broker" }>;
              readonly wire: Extract<WireAuthSchemeV5, { readonly kind: "authorization_bearer" }>;
              readonly challenge: { readonly kind: "none" };
              readonly principalBindingClass: "provider_account";
              readonly siteRealmKeyVersionServiceActivationAndRotationEvidenceRequired: true;
            }
          : R["requirementKey"] extends "tokenhub.gz.messages" | "tokenhub.sg.messages"
            ? ReferenceAuthProfileV5 & {
                readonly profileId: R["requirementKey"] extends "tokenhub.gz.messages"
                  ? "auth-profile:tencent-tokenhub-guangzhou-messages-x-api-key@5"
                  : "auth-profile:tencent-tokenhub-singapore-messages-x-api-key@5";
                readonly custody: Extract<CredentialCustodyProfileV5, { readonly kind: "manual_secret_broker" }>;
                readonly wire: Extract<WireAuthSchemeV5, { readonly kind: "anthropic_x_api_key" }>;
                readonly challenge: { readonly kind: "none" };
                readonly principalBindingClass: "provider_account";
                readonly siteRealmKeyVersionServiceActivationAndRotationEvidenceRequired: true;
              }
        : R["requirementKey"] extends "opencode.server.http"
          ? ReferenceAuthProfileV5 & {
              readonly profileId: "auth-profile:opencode-server-optional-basic@5";
              readonly custody: Extract<CredentialCustodyProfileV5, { readonly kind: "manual_secret_broker" }>;
              readonly wire: { readonly kind: "none" };
              readonly challenge: {
                readonly kind: "optional_server_challenge";
                readonly acceptedWireSchemes: readonly [
                  Extract<WireAuthSchemeV5, { readonly kind: "none" }>,
                  Extract<WireAuthSchemeV5, { readonly kind: "http_basic" }>,
                ];
                readonly authoritativeChallengeAndNegativeEvidenceRequired: true;
              };
              readonly principalBindingClass: "custom_endpoint_subject";
            }
          : R["requirementKey"] extends "lmstudio.chat" | "lmstudio.responses"
            ? ReferenceAuthProfileV5 & {
                readonly profileId: "auth-profile:lm-studio-optional-bearer@5";
                readonly custody: Extract<CredentialCustodyProfileV5, { readonly kind: "manual_secret_broker" }>;
                readonly wire: { readonly kind: "none" };
                readonly challenge: {
                  readonly kind: "optional_server_challenge";
                  readonly acceptedWireSchemes: readonly [
                    Extract<WireAuthSchemeV5, { readonly kind: "none" }>,
                    Extract<WireAuthSchemeV5, { readonly kind: "authorization_bearer" }>,
                  ];
                  readonly authoritativeChallengeAndNegativeEvidenceRequired: true;
                };
                readonly principalBindingClass: "custom_endpoint_subject";
              }
            : R["requirementKey"] extends "lmstudio.messages"
              ? ReferenceAuthProfileV5 & {
                  readonly profileId: "auth-profile:lm-studio-messages-optional-anthropic-auth@9";
                  readonly custody: Extract<CredentialCustodyProfileV5, { readonly kind: "manual_secret_broker" }>;
                  readonly wire: { readonly kind: "none" };
                  readonly challenge: {
                    readonly kind: "optional_server_challenge";
                    readonly acceptedWireSchemes: readonly [
                      Extract<WireAuthSchemeV5, { readonly kind: "none" }>,
                      Extract<WireAuthSchemeV5, { readonly kind: "anthropic_x_api_key" }>,
                      Extract<WireAuthSchemeV5, { readonly kind: "authorization_bearer" }>,
                    ];
                    readonly authoritativeChallengeAndNegativeEvidenceRequired: true;
                  };
                  readonly principalBindingClass: "custom_endpoint_subject";
                }
            : R["requirementKey"] extends
                  | "litellm.bridge.openai"
                  | "litellm.bridge.responses"
                  | "litellm.bridge.messages"
              ? ReferenceAuthProfileV5 & {
                  readonly profileId: "auth-profile:litellm-proxy-optional-bearer@5";
                  readonly custody: Extract<CredentialCustodyProfileV5, { readonly kind: "manual_secret_broker" }>;
                  readonly wire: { readonly kind: "none" };
                  readonly challenge: {
                    readonly kind: "optional_server_challenge";
                    readonly acceptedWireSchemes: readonly [
                      Extract<WireAuthSchemeV5, { readonly kind: "none" }>,
                      Extract<WireAuthSchemeV5, { readonly kind: "authorization_bearer" }>,
                    ];
                    readonly authoritativeChallengeAndNegativeEvidenceRequired: true;
                  };
                  readonly principalBindingClass: "upstream_application_session";
                }
              : DefaultReferenceAuthProfileForKindV5<R["authKind"]>;

type OptionalServerAuthRequirementKeyV6 =
  | "opencode.server.http"
  | "lmstudio.chat"
  | "lmstudio.responses"
  | "lmstudio.messages"
  | "litellm.bridge.openai"
  | "litellm.bridge.responses"
  | "litellm.bridge.messages";

type ReferenceOptionalAuthPolicyForRequirementV6<R extends { readonly requirementKey: string }> =
  R["requirementKey"] extends "opencode.server.http"
    ? {
        readonly applicability: "optional_server_auth";
        readonly challengeProfileId: "challenge-profile:opencode-server-basic@6";
        readonly acceptedSchemes: readonly ["none", "http_basic"];
        readonly conditionalFieldIds: readonly ["server_username", "server_password"];
        readonly defaultUsername: "opencode";
      }
    : R["requirementKey"] extends "lmstudio.chat" | "lmstudio.responses"
      ? {
          readonly applicability: "optional_server_auth";
          readonly challengeProfileId: "challenge-profile:lm-studio-bearer@6";
          readonly acceptedSchemes: readonly ["none", "authorization_bearer"];
          readonly conditionalFieldIds: readonly ["api_key"];
          readonly defaultUsername?: never;
        }
      : R["requirementKey"] extends "lmstudio.messages"
        ? {
            readonly applicability: "optional_server_auth";
            readonly challengeProfileId: "challenge-profile:lm-studio-messages-anthropic-auth@9";
            readonly acceptedSchemes: readonly ["none", "anthropic_x_api_key", "authorization_bearer"];
            readonly deterministicPreferenceOrder: readonly ["anthropic_x_api_key", "authorization_bearer"];
            readonly conditionalFieldIds: readonly ["api_key"];
            readonly defaultUsername?: never;
          }
      : R["requirementKey"] extends
            | "litellm.bridge.openai"
            | "litellm.bridge.responses"
            | "litellm.bridge.messages"
        ? {
            readonly applicability: "optional_server_auth";
            readonly challengeProfileId: "challenge-profile:litellm-proxy-bearer@6";
            readonly acceptedSchemes: readonly ["none", "authorization_bearer"];
            readonly conditionalFieldIds: readonly ["api_key"];
            readonly defaultUsername?: never;
          }
        : {
            readonly applicability: "not_optional_server_auth";
            readonly challengeProfileId?: never;
            readonly acceptedSchemes?: never;
            readonly conditionalFieldIds?: never;
            readonly defaultUsername?: never;
          };

declare const optionalServerAuthChallengeBrandV6: unique symbol;
declare const optionalServerCredentialSubjectBrandV8: unique symbol;

type OptionalServerObservedSchemeForRequirementV8<K extends OptionalServerAuthRequirementKeyV6> =
  K extends "opencode.server.http"
    ? "none" | "http_basic"
    : K extends "lmstudio.messages"
      ? "none" | "anthropic_x_api_key" | "authorization_bearer"
      : "none" | "authorization_bearer";

type OptionalServerObservedSchemeV8 =
  | "none"
  | "http_basic"
  | "anthropic_x_api_key"
  | "authorization_bearer";

type OptionalServerAuthChallengeEvidenceV6<
  K extends OptionalServerAuthRequirementKeyV6,
  S extends OptionalServerObservedSchemeV8 = OptionalServerObservedSchemeForRequirementV8<K>,
> = S extends OptionalServerObservedSchemeForRequirementV8<K>
  ? ReceiptRef<"receipt:optional-server-auth-challenge-evidence@8", readonly [K, S]> & {
    readonly [optionalServerAuthChallengeBrandV6]: K;
    readonly requirementKey: K;
    readonly exactReferenceRequirement: ReferenceRowByKeyV3<K>;
    readonly journeyGraphId: ReferenceRowByKeyV3<K>["journeyGraph"]["graphId"];
    readonly observationStepId: K extends "opencode.server.http"
      ? "observe-server-auth-challenge"
      : K extends `litellm.${string}`
        ? "observe-bridge-auth-challenge"
        : "observe-local-auth-challenge";
    readonly endpointIdentityDigest: string;
    readonly processIdentityAndGenerationDigest: string;
    readonly observedScheme: S;
    readonly authoritativeAcceptedSchemeSet: S extends "none"
      ? readonly ["none"]
      : K extends "lmstudio.messages"
        ? readonly ["anthropic_x_api_key", "authorization_bearer"]
        : readonly [S];
    readonly selectedSchemeFromAuthoritativeSet: S;
    readonly simultaneousCredentialHeaderCount: S extends "none" ? 0 : 1;
    readonly authoritativePositiveOrNegativeProbeTranscriptDigest: string;
    readonly probeWasCredentialFreeAndSentNoApplicationSecret: true;
    readonly checkedAtMonotonicDigest: string;
    readonly expiresAtMonotonicDigest: string;
  }
  : never;

type RequiredOptionalServerConditionalFieldEventV8<
  B extends ReferenceConditionalRecipeFieldBindingV7,
> = GaConditionalRecipeFieldObservationReceiptV1<B> & {
  readonly requirementState: B["discriminator"];
  readonly fieldMustBeCommittedBeforeValidation: true;
};

type RequiredOptionalServerConditionalFieldEventForV8<
  K extends OptionalServerAuthRequirementKeyV6,
  I extends ReferenceRecipeFieldV1["fieldId"],
> = RequiredOptionalServerConditionalFieldEventV8<
  Extract<
    ReferenceConditionalRecipeFieldBindingV7,
    { readonly requirementKey: K; readonly fieldId: I }
  >
>;

interface ExactOptionalServerConditionalFieldEventTupleMapV8 {
  readonly "opencode.server.http": {
    readonly none: readonly [];
    readonly http_basic: readonly [
      RequiredOptionalServerConditionalFieldEventForV8<"opencode.server.http", "server_username">,
      RequiredOptionalServerConditionalFieldEventForV8<"opencode.server.http", "server_password">,
    ];
  };
  readonly "lmstudio.chat": {
    readonly none: readonly [];
    readonly authorization_bearer: readonly [
      RequiredOptionalServerConditionalFieldEventForV8<"lmstudio.chat", "api_key">,
    ];
  };
  readonly "lmstudio.responses": {
    readonly none: readonly [];
    readonly authorization_bearer: readonly [
      RequiredOptionalServerConditionalFieldEventForV8<"lmstudio.responses", "api_key">,
    ];
  };
  readonly "lmstudio.messages": {
    readonly none: readonly [];
    readonly anthropic_x_api_key: readonly [
      RequiredOptionalServerConditionalFieldEventForV8<"lmstudio.messages", "api_key">,
    ];
    readonly authorization_bearer: readonly [
      RequiredOptionalServerConditionalFieldEventForV8<"lmstudio.messages", "api_key">,
    ];
  };
  readonly "litellm.bridge.openai": {
    readonly none: readonly [];
    readonly authorization_bearer: readonly [
      RequiredOptionalServerConditionalFieldEventForV8<"litellm.bridge.openai", "api_key">,
    ];
  };
  readonly "litellm.bridge.responses": {
    readonly none: readonly [];
    readonly authorization_bearer: readonly [
      RequiredOptionalServerConditionalFieldEventForV8<"litellm.bridge.responses", "api_key">,
    ];
  };
  readonly "litellm.bridge.messages": {
    readonly none: readonly [];
    readonly authorization_bearer: readonly [
      RequiredOptionalServerConditionalFieldEventForV8<"litellm.bridge.messages", "api_key">,
    ];
  };
}

type ExactOptionalServerConditionalFieldEventTupleV8<
  K extends OptionalServerAuthRequirementKeyV6,
  S extends OptionalServerObservedSchemeV8,
> = S extends keyof ExactOptionalServerConditionalFieldEventTupleMapV8[K]
  ? ExactOptionalServerConditionalFieldEventTupleMapV8[K][S]
  : never;

type _OptionalServerConditionalFieldMapKeysAreExactV8 = ReferenceInvariantTrueV3<
  ReferenceInvariantEqualV3<
    keyof ExactOptionalServerConditionalFieldEventTupleMapV8,
    OptionalServerAuthRequirementKeyV6
  >
>;

type _OptionalServerConditionalSchemeKeysAreExactV8 = ReferenceInvariantTrueV3<
  ReferenceInvariantEqualV3<
    readonly [
      keyof ExactOptionalServerConditionalFieldEventTupleMapV8["opencode.server.http"],
      keyof ExactOptionalServerConditionalFieldEventTupleMapV8["lmstudio.chat"],
      keyof ExactOptionalServerConditionalFieldEventTupleMapV8["lmstudio.responses"],
      keyof ExactOptionalServerConditionalFieldEventTupleMapV8["lmstudio.messages"],
      keyof ExactOptionalServerConditionalFieldEventTupleMapV8["litellm.bridge.openai"],
      keyof ExactOptionalServerConditionalFieldEventTupleMapV8["litellm.bridge.responses"],
      keyof ExactOptionalServerConditionalFieldEventTupleMapV8["litellm.bridge.messages"],
    ],
    readonly [
      OptionalServerObservedSchemeForRequirementV8<"opencode.server.http">,
      OptionalServerObservedSchemeForRequirementV8<"lmstudio.chat">,
      OptionalServerObservedSchemeForRequirementV8<"lmstudio.responses">,
      OptionalServerObservedSchemeForRequirementV8<"lmstudio.messages">,
      OptionalServerObservedSchemeForRequirementV8<"litellm.bridge.openai">,
      OptionalServerObservedSchemeForRequirementV8<"litellm.bridge.responses">,
      OptionalServerObservedSchemeForRequirementV8<"litellm.bridge.messages">,
    ]
  >
>;

type OptionalServerCredentialSubjectReceiptV8<
  K extends OptionalServerAuthRequirementKeyV6,
  E extends OptionalServerAuthChallengeEvidenceV6<K>,
  B extends ExactOptionalServerConditionalFieldEventTupleV8<K, E["observedScheme"]>,
> = ReceiptRef<"receipt:optional-server-credential-subject@8", readonly [K, E, B]> & {
  readonly [optionalServerCredentialSubjectBrandV8]: never;
  readonly requirementKey: K;
  readonly challengeEvidence: E;
  readonly conditionalFieldEvents: B;
  readonly endpointIdentityDigest: E["endpointIdentityDigest"];
  readonly processIdentityAndGenerationDigest: E["processIdentityAndGenerationDigest"];
  readonly credentialPrincipalAndVersionDigest: string;
  readonly secretBrokerHandle: ReceiptRef<
    "receipt:secret-broker-handle@8",
    readonly [K, E["endpointIdentityDigest"], E["processIdentityAndGenerationDigest"], string]
  >;
  readonly createdOnlyByTheConditionalFieldCompilerAndCredentialBrokerForTheExactChallenge: true;
};

type ResolvedOptionalServerAuthReceiptV6<
  K extends OptionalServerAuthRequirementKeyV6,
  E extends OptionalServerAuthChallengeEvidenceV6<K> = OptionalServerAuthChallengeEvidenceV6<K>,
> = ReceiptRef<"receipt:resolved-optional-server-auth@8", readonly [K, E]> & {
    readonly requirementKey: K;
    readonly policy: ReferenceOptionalAuthPolicyForRequirementV6<{ readonly requirementKey: K }>;
    readonly challengeEvidence: E;
    readonly selectedScheme: E["observedScheme"];
    readonly endpointIdentityDigest: E["endpointIdentityDigest"];
    readonly processIdentityAndGenerationDigest: E["processIdentityAndGenerationDigest"];
  } & (E extends OptionalServerAuthChallengeEvidenceV6<K, "none">
    ? {
        readonly conditionalFieldEvents: readonly [];
        readonly custody: Extract<CredentialCustodyProfileV5, { readonly kind: "none" }>;
        readonly selectedWire: Extract<WireAuthSchemeV5, { readonly kind: "none" }>;
        readonly username?: never;
        readonly credentialPrincipalAndVersionDigest?: never;
        readonly secretBrokerHandle?: never;
        readonly finalAuthorizationHeaderComponent?: never;
        readonly provesNegativeChallengeEvidenceAndZeroCredentialOrAuthorizationBytes: true;
      }
    : E extends OptionalServerAuthChallengeEvidenceV6<K, "http_basic">
      ? K extends "opencode.server.http"
        ? {
            readonly conditionalFieldEvents: ExactOptionalServerConditionalFieldEventTupleV8<K, "http_basic">;
            readonly custody: Extract<CredentialCustodyProfileV5, { readonly kind: "manual_secret_broker" }>;
            readonly selectedWire: Extract<WireAuthSchemeV5, { readonly kind: "http_basic" }>;
            readonly username:
              | { readonly source: "trusted_default"; readonly value: "opencode" }
              | { readonly source: "explicit_override"; readonly value: string };
            readonly credentialSubject: OptionalServerCredentialSubjectReceiptV8<
              K,
              E,
              ExactOptionalServerConditionalFieldEventTupleV8<K, "http_basic">
            >;
            readonly finalAuthorizationHeaderComponent: ReceiptRef<
              "receipt:byte-exact-http-basic-component@8",
              readonly [K, E, OptionalServerCredentialSubjectReceiptV8<K, E, ExactOptionalServerConditionalFieldEventTupleV8<K, "http_basic">>]
            >;
            readonly provesChallengeFieldsCredentialPrincipalVersionEndpointGenerationAndByteExactBasicValueEqual: true;
          }
        : never
      : E extends OptionalServerAuthChallengeEvidenceV6<K, "anthropic_x_api_key">
        ? K extends "lmstudio.messages"
          ? {
            readonly conditionalFieldEvents: ExactOptionalServerConditionalFieldEventTupleV8<K, "anthropic_x_api_key">;
            readonly custody: Extract<CredentialCustodyProfileV5, { readonly kind: "manual_secret_broker" }>;
            readonly selectedWire: Extract<WireAuthSchemeV5, { readonly kind: "anthropic_x_api_key" }>;
            readonly username?: never;
            readonly credentialSubject: OptionalServerCredentialSubjectReceiptV8<
              K,
              E,
              ExactOptionalServerConditionalFieldEventTupleV8<K, "anthropic_x_api_key">
            >;
            readonly finalAuthorizationHeaderComponent: ReceiptRef<
              "receipt:byte-exact-x-api-key-component@8",
              readonly [K, E, OptionalServerCredentialSubjectReceiptV8<K, E, ExactOptionalServerConditionalFieldEventTupleV8<K, "anthropic_x_api_key">>]
            >;
            readonly authorizationHeaderComponent?: never;
            readonly provesChallengeFieldCredentialPrincipalVersionEndpointGenerationAndByteExactXApiKeyValueEqual: true;
          }
          : never
        : E extends OptionalServerAuthChallengeEvidenceV6<K, "authorization_bearer">
          ? K extends Exclude<OptionalServerAuthRequirementKeyV6, "opencode.server.http">
        ? {
            readonly conditionalFieldEvents: ExactOptionalServerConditionalFieldEventTupleV8<K, "authorization_bearer">;
            readonly custody: Extract<CredentialCustodyProfileV5, { readonly kind: "manual_secret_broker" }>;
            readonly selectedWire: Extract<WireAuthSchemeV5, { readonly kind: "authorization_bearer" }>;
            readonly username?: never;
            readonly credentialSubject: OptionalServerCredentialSubjectReceiptV8<
              K,
              E,
              ExactOptionalServerConditionalFieldEventTupleV8<K, "authorization_bearer">
            >;
            readonly finalAuthorizationHeaderComponent: ReceiptRef<
              "receipt:byte-exact-bearer-component@8",
              readonly [K, E, OptionalServerCredentialSubjectReceiptV8<K, E, ExactOptionalServerConditionalFieldEventTupleV8<K, "authorization_bearer">>]
            >;
            readonly provesChallengeFieldCredentialPrincipalVersionEndpointGenerationAndByteExactBearerValueEqual: true;
          }
        : never
      : never
  );

type ResolveOptionalServerAuthInputV8<
  K extends OptionalServerAuthRequirementKeyV6,
  E extends OptionalServerAuthChallengeEvidenceV6<K>,
> = {
  readonly requirementKey: K;
  readonly policy: ReferenceOptionalAuthPolicyForRequirementV6<{ readonly requirementKey: K }>;
  readonly challengeEvidence: E;
} & (E extends OptionalServerAuthChallengeEvidenceV6<K, "none">
  ? {
      readonly conditionalFieldEvents: readonly [];
      readonly credentialSubject?: never;
    }
  : E extends OptionalServerAuthChallengeEvidenceV6<
      K,
      Exclude<OptionalServerObservedSchemeForRequirementV8<K>, "none">
    >
    ? {
        readonly conditionalFieldEvents: ExactOptionalServerConditionalFieldEventTupleV8<K, E["observedScheme"]>;
        readonly credentialSubject: OptionalServerCredentialSubjectReceiptV8<
          K,
          E,
          ExactOptionalServerConditionalFieldEventTupleV8<K, E["observedScheme"]>
        >;
      }
    : never);

declare function resolveOptionalServerAuthV8<
  const K extends OptionalServerAuthRequirementKeyV6,
  const E extends OptionalServerAuthChallengeEvidenceV6<K>,
>(input: ResolveOptionalServerAuthInputV8<K, E>): DeepFrozenCommittedReceiptV1<
  ResolvedOptionalServerAuthReceiptV6<K, E>
>;

declare const optionalServerAuthEndpointBindingBrandV9: unique symbol;
declare const inferenceActivationEndpointClosureBrandV9: unique symbol;
declare const optionalServerAuthPreparedSendClosureBrandV9: unique symbol;

interface ResolvedOptionalServerAuthProjectionV9
  extends ReceiptRef<"receipt:resolved-optional-server-auth@8"> {
  readonly requirementKey: OptionalServerAuthRequirementKeyV6;
  readonly challengeEvidence: ReceiptRef & {
    readonly endpointIdentityDigest: string;
    readonly processIdentityAndGenerationDigest: string;
    readonly checkedAtMonotonicDigest: string;
    readonly expiresAtMonotonicDigest: string;
  };
  readonly selectedScheme: OptionalServerObservedSchemeV8;
  readonly endpointIdentityDigest: string;
  readonly processIdentityAndGenerationDigest: string;
  readonly credentialSubject?: ReceiptRef;
  readonly finalAuthorizationHeaderComponent?: ReceiptRef;
}

type FrozenResolvedOptionalServerAuthMemberV9 = DeepFrozenCommittedReceiptV1<
  ResolvedOptionalServerAuthProjectionV9
>;

type OptionalServerAuthResolvedEndpointBindingReceiptV9<
  R extends FrozenResolvedOptionalServerAuthMemberV9 = FrozenResolvedOptionalServerAuthMemberV9,
> = R extends FrozenResolvedOptionalServerAuthMemberV9
  ? ReceiptRef<
      "receipt:optional-server-auth-endpoint-binding@9",
      readonly [R["id"], R["generation"], R["digest"]]
    > & {
      readonly [optionalServerAuthEndpointBindingBrandV9]: never;
      readonly applicability: "optional_server_auth";
      readonly requirementKey: R["requirementKey"];
      readonly exactReferenceRequirementDigest: string;
      readonly resolution: R;
      readonly challengeEvidence: R["challengeEvidence"];
      readonly selectedScheme: R["selectedScheme"];
      readonly endpointIdentityDigest: R["endpointIdentityDigest"];
      readonly processIdentityAndGenerationDigest: R["processIdentityAndGenerationDigest"];
      readonly checkedAtMonotonicDigest: R["challengeEvidence"]["checkedAtMonotonicDigest"];
      readonly expiresAtMonotonicDigest: R["challengeEvidence"]["expiresAtMonotonicDigest"];
      readonly provesReferenceRequirementChallengeResolutionEndpointProcessGenerationAndSchemeExact: true;
    }
  : never;

type NonOptionalServerAuthEndpointBindingReceiptV9 = ReceiptRef<
  "receipt:non-optional-server-auth-endpoint-binding@9"
> & {
  readonly [optionalServerAuthEndpointBindingBrandV9]: never;
  readonly applicability: "not_optional_server_auth";
  readonly requirementKey: Exclude<ReferenceRequirementKeyV3, OptionalServerAuthRequirementKeyV6>;
  readonly exactReferenceRequirementDigest: string;
  readonly endpointIdentityDigest: string;
  readonly processIdentityAndGenerationDigest: string;
  readonly resolution?: never;
  readonly challengeEvidence?: never;
  readonly selectedScheme?: never;
  readonly checkedAtMonotonicDigest: string;
  readonly expiresAtMonotonicDigest: string;
  readonly provesRequirementIsOutsideTheOptionalServerAuthSetAndEndpointGenerationIsCurrent: true;
};

type OptionalServerAuthEndpointBindingReceiptV9 =
  | OptionalServerAuthResolvedEndpointBindingReceiptV9
  | NonOptionalServerAuthEndpointBindingReceiptV9;

declare function commitOptionalServerAuthResolvedEndpointBindingV9<
  const K extends OptionalServerAuthRequirementKeyV6,
  const E extends OptionalServerAuthChallengeEvidenceV6<K>,
>(input: {
  readonly resolution: DeepFrozenCommittedReceiptV1<ResolvedOptionalServerAuthReceiptV6<K, E>>;
  readonly exactReferenceRequirement: ReferenceRowByKeyV3<K>;
  readonly currentEndpointIdentityDigest: E["endpointIdentityDigest"];
  readonly currentProcessIdentityAndGenerationDigest: E["processIdentityAndGenerationDigest"];
  readonly monotonicExpiryValidation: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<
  OptionalServerAuthResolvedEndpointBindingReceiptV9<
    DeepFrozenCommittedReceiptV1<ResolvedOptionalServerAuthReceiptV6<K, E>>
  >
>;

declare function commitNonOptionalServerAuthEndpointBindingV9<
  const R extends Exclude<
    ReferenceRequirementRowV3,
    { readonly requirementKey: OptionalServerAuthRequirementKeyV6 }
  >,
>(input: {
  readonly exactReferenceRequirement: R;
  readonly endpointIdentityDigest: string;
  readonly processIdentityAndGenerationDigest: string;
  readonly checkedAtMonotonicDigest: string;
  readonly expiresAtMonotonicDigest: string;
}): DeepFrozenCommittedReceiptV1<
  NonOptionalServerAuthEndpointBindingReceiptV9 & {
    readonly requirementKey: R["requirementKey"];
  }
>;

type InferenceActivationEndpointClosureReceiptV9<
  B extends OptionalServerAuthEndpointBindingReceiptV9 = OptionalServerAuthEndpointBindingReceiptV9,
> = ReceiptRef<
  "receipt:inference-activation-endpoint-closure@9",
  readonly [B["id"], B["generation"], B["digest"]]
> & {
  readonly [inferenceActivationEndpointClosureBrandV9]: never;
  readonly endpointIdentityReceipt: ReceiptRef<
    "receipt:inference-endpoint-identity@9",
    readonly [B["endpointIdentityDigest"], B["processIdentityAndGenerationDigest"]]
  >;
  readonly requestProfileDigest: string;
  readonly optionalServerAuthEndpointBinding: B;
  readonly requirementKey: B["requirementKey"];
  readonly endpointIdentityDigest: B["endpointIdentityDigest"];
  readonly processIdentityAndGenerationDigest: B["processIdentityAndGenerationDigest"];
  readonly exactRequestProfileAndOptionalServerAuthBindingDigest: string;
  readonly provesEndpointRequestProfileRequirementAndOptionalServerAuthBindingExact: true;
};

type InferenceActivationEndpointClosureReferenceV9<
  B extends OptionalServerAuthEndpointBindingReceiptV9,
> = ReceiptRef<
  "receipt:inference-activation-endpoint-closure@9",
  readonly [B["id"], B["generation"], B["digest"]]
> & {
  readonly [inferenceActivationEndpointClosureBrandV9]: never;
  readonly optionalServerAuthEndpointBinding: B;
  readonly requirementKey: B["requirementKey"];
  readonly endpointIdentityDigest: B["endpointIdentityDigest"];
  readonly processIdentityAndGenerationDigest: B["processIdentityAndGenerationDigest"];
};

declare function commitInferenceActivationEndpointClosureV9<
  const B extends OptionalServerAuthEndpointBindingReceiptV9,
>(input: {
  readonly endpointIdentity: InferenceEndpointIdentity & {
    readonly endpointIdentityDigest: B["endpointIdentityDigest"];
    readonly processIdentityAndGenerationDigest: B["processIdentityAndGenerationDigest"];
    readonly optionalServerAuthEndpointBinding: B;
  };
  readonly requestProfile: RequestProfile;
  readonly optionalServerAuthEndpointBinding: B;
}): DeepFrozenCommittedReceiptV1<InferenceActivationEndpointClosureReceiptV9<B>>;

type OptionalServerAuthPreparedSendClosureForBindingV9<
  B extends OptionalServerAuthEndpointBindingReceiptV9,
> = ReceiptRef<
  "receipt:optional-server-auth-prepared-send-closure@9",
  readonly [B["id"], B["generation"], B["digest"]]
> & {
  readonly [optionalServerAuthPreparedSendClosureBrandV9]: never;
  readonly activationEndpointClosure: InferenceActivationEndpointClosureReferenceV9<B>;
  readonly optionalServerAuthEndpointBinding: B;
  readonly requirementKey: B["requirementKey"];
  readonly endpointIdentityDigest: B["endpointIdentityDigest"];
  readonly processIdentityAndGenerationDigest: B["processIdentityAndGenerationDigest"];
  readonly checkedAtMonotonicDigest: string;
  readonly expiresAtMonotonicDigest: B["expiresAtMonotonicDigest"];
  readonly checkedAfterAttemptIntentAndImmediatelyBeforeCredentialReadAndFinalLease: true;
  readonly currentEndpointProcessGenerationAndExpiryMatchActivation: true;
} & (B extends OptionalServerAuthResolvedEndpointBindingReceiptV9<infer R>
  ? {
      readonly applicability: "optional_server_auth";
      readonly resolution: R;
      readonly selectedScheme: R["selectedScheme"];
    } & (R extends { readonly selectedScheme: "none" }
      ? {
          readonly finalAuthorizationHeaderComponent?: never;
          readonly optionalCredentialSubject?: never;
          readonly provesCurrentNegativeChallengeRequiresZeroOptionalCredentialAndAuthorizationBytes: true;
        }
      : R extends {
            readonly finalAuthorizationHeaderComponent: infer H extends ReceiptRef;
            readonly credentialSubject: infer C extends ReceiptRef;
          }
        ? {
            readonly finalAuthorizationHeaderComponent: H;
            readonly optionalCredentialSubject: C;
            readonly provesHeaderBytesCredentialVersionChallengeSchemeEndpointAndProcessGenerationExact: true;
          }
        : never)
  : {
      readonly applicability: "not_optional_server_auth";
      readonly resolution?: never;
      readonly selectedScheme?: never;
      readonly finalAuthorizationHeaderComponent?: never;
      readonly optionalCredentialSubject?: never;
      readonly provesNoOptionalServerAuthResolverOrHeaderIsApplicable: true;
    });

type FrozenNegativeOptionalServerAuthResolutionV9 = FrozenResolvedOptionalServerAuthMemberV9 & {
  readonly selectedScheme: "none";
  readonly credentialSubject?: never;
  readonly finalAuthorizationHeaderComponent?: never;
};

type FrozenCredentialedOptionalServerAuthResolutionV9 = FrozenResolvedOptionalServerAuthMemberV9 & {
  readonly selectedScheme: Exclude<OptionalServerObservedSchemeV8, "none">;
  readonly credentialSubject: ReceiptRef;
  readonly finalAuthorizationHeaderComponent: ReceiptRef;
};

type OptionalServerAuthPreparedSendClosureForResolutionV9<
  R extends FrozenNegativeOptionalServerAuthResolutionV9 | FrozenCredentialedOptionalServerAuthResolutionV9,
> = ReceiptRef<
  "receipt:optional-server-auth-prepared-send-closure@9",
  readonly [R["id"], R["generation"], R["digest"]]
> & {
  readonly [optionalServerAuthPreparedSendClosureBrandV9]: never;
  readonly applicability: "optional_server_auth";
  readonly activationEndpointClosure: InferenceActivationEndpointClosureReferenceV9<
    OptionalServerAuthResolvedEndpointBindingReceiptV9<R>
  >;
  readonly optionalServerAuthEndpointBinding: OptionalServerAuthResolvedEndpointBindingReceiptV9<R>;
  readonly resolution: R;
  readonly requirementKey: R["requirementKey"];
  readonly selectedScheme: R["selectedScheme"];
  readonly endpointIdentityDigest: R["endpointIdentityDigest"];
  readonly processIdentityAndGenerationDigest: R["processIdentityAndGenerationDigest"];
  readonly checkedAtMonotonicDigest: string;
  readonly expiresAtMonotonicDigest: R["challengeEvidence"]["expiresAtMonotonicDigest"];
  readonly checkedAfterAttemptIntentAndImmediatelyBeforeCredentialReadAndFinalLease: true;
  readonly currentEndpointProcessGenerationAndExpiryMatchActivation: true;
} & (R extends FrozenNegativeOptionalServerAuthResolutionV9
  ? {
      readonly finalAuthorizationHeaderComponent?: never;
      readonly optionalCredentialSubject?: never;
      readonly provesCurrentNegativeChallengeRequiresZeroOptionalCredentialAndAuthorizationBytes: true;
    }
  : R extends FrozenCredentialedOptionalServerAuthResolutionV9
    ? {
        readonly finalAuthorizationHeaderComponent: R["finalAuthorizationHeaderComponent"];
        readonly optionalCredentialSubject: R["credentialSubject"];
        readonly provesHeaderBytesCredentialVersionChallengeSchemeEndpointAndProcessGenerationExact: true;
      }
    : never);

type OptionalServerAuthPreparedSendClosureReceiptV9 =
  | OptionalServerAuthPreparedSendClosureForBindingV9<NonOptionalServerAuthEndpointBindingReceiptV9>
  | OptionalServerAuthPreparedSendClosureForResolutionV9<FrozenNegativeOptionalServerAuthResolutionV9>
  | OptionalServerAuthPreparedSendClosureForResolutionV9<FrozenCredentialedOptionalServerAuthResolutionV9>;

type CommitOptionalServerAuthPreparedSendClosureInputV9<
  B extends OptionalServerAuthEndpointBindingReceiptV9,
> = {
  readonly activationEndpointClosure: InferenceActivationEndpointClosureReceiptV9<B>;
  readonly optionalServerAuthEndpointBinding: B;
  readonly currentEndpointIdentityDigest: B["endpointIdentityDigest"];
  readonly currentProcessIdentityAndGenerationDigest: B["processIdentityAndGenerationDigest"];
  readonly monotonicExpiryValidation: ImportedOpaqueEvidenceLeafReceipt;
} & (B extends OptionalServerAuthResolvedEndpointBindingReceiptV9<infer R>
  ? R extends { readonly selectedScheme: "none" }
    ? {
        readonly resolution: R;
        readonly finalAuthorizationHeaderComponent?: never;
      }
    : R extends { readonly finalAuthorizationHeaderComponent: infer H extends ReceiptRef }
      ? {
          readonly resolution: R;
          readonly finalAuthorizationHeaderComponent: H;
        }
      : never
  : {
      readonly resolution?: never;
      readonly finalAuthorizationHeaderComponent?: never;
    });

declare function commitOptionalServerAuthPreparedSendClosureV9<
  const B extends OptionalServerAuthEndpointBindingReceiptV9,
>(input: CommitOptionalServerAuthPreparedSendClosureInputV9<B>): DeepFrozenCommittedReceiptV1<
  OptionalServerAuthPreparedSendClosureForBindingV9<B>
>;

interface ReferenceProviderWireProfileV5 {
  readonly profileId: `wire-profile:${string}@5`;
  readonly endpointOrigin: string;
  readonly operationPath: string;
  readonly modelsPath: string | "not_supported";
  readonly realmIsolation: "site_key_and_endpoint_must_match" | "provider_defined";
  readonly streamingTerminalPolicy:
    | "http_status_before_stream_then_protocol_terminal"
    | "http_status_or_typed_sse_error_terminal";
  readonly retryPolicy: "host_owned_no_hidden_retry";
}

type TokenHubRequirementKeyV5 =
  | "tokenhub.gz.chat"
  | "tokenhub.gz.responses"
  | "tokenhub.gz.messages"
  | "tokenhub.sg.chat"
  | "tokenhub.sg.responses"
  | "tokenhub.sg.messages";

type TencentEnterpriseTokenPlanRequirementKeyV20 =
  | "tencent-enterprise-plan.gz.chat"
  | "tencent-enterprise-plan.gz.messages"
  | "tencent-enterprise-plan.sg.chat"
  | "tencent-enterprise-plan.sg.messages";

type TokenHubFundingObservationReceiptV5 = ReceiptRef<
  "receipt:tencent-tokenhub-funding-observation@5"
> & {
  readonly siteRealm: "guangzhou" | "singapore";
  readonly principalAndCloudAccountDigest: string;
  readonly apiKeyVersionDigest: string;
  readonly modelServiceActivationSetDigest: string;
  readonly authoritativeUsageAndBillingObservationDigest: string;
  readonly checkedAt: string;
  readonly expiresAt: string;
  readonly apiKeyOrSiteNameAloneNeverDeterminesFundingMode: true;
} &
  (
    | {
        readonly fundingMode: "payg_postpaid";
        readonly fundingTierProjection: "payg";
        readonly planEntitlement?: never;
        readonly overagePolicy: "normal_postpaid_billing";
      }
    | {
        readonly fundingMode: "tpm_reserved";
        readonly fundingTierProjection: "subscription";
        readonly planEntitlement: ReceiptRef<"receipt:tokenhub-tpm-reserved-entitlement@9">;
        readonly overagePolicy: "authoritatively_observed_for_exact_order_region_and_model";
      }
    | {
        readonly fundingMode: "dedicated_model_unit";
        readonly fundingTierProjection: "subscription";
        readonly planEntitlement: ReceiptRef<"receipt:tokenhub-dedicated-model-unit-entitlement@9">;
        readonly overagePolicy: "authoritatively_observed_for_exact_order_region_and_model";
      }
  );

type ReferenceProviderWireProfileForRequirementV5<R extends {
  readonly requirementKey: string;
  readonly protocolProfile: ReferenceProtocolProfileV3;
}> = R["requirementKey"] extends TokenHubRequirementKeyV5
  ? ReferenceProviderWireProfileV5 & {
      readonly profileId: R["requirementKey"] extends `tokenhub.gz.${string}`
        ? "wire-profile:tencent-tokenhub-guangzhou@5"
        : "wire-profile:tencent-tokenhub-singapore@5";
      readonly endpointOrigin: R["requirementKey"] extends `tokenhub.gz.${string}`
        ? "https://tokenhub.tencentmaas.com"
        : "https://tokenhub-intl.tencentmaas.com";
      readonly officialFallbackOrigin: R["requirementKey"] extends `tokenhub.gz.${string}`
        ? "https://tokenhub.tencentmaas.cn"
        : "https://tokenhub-intl.tencentmaas.cn";
      readonly operationPath: R["protocolProfile"] extends "openai_chat_completions"
        ? "/v1/chat/completions"
        : R["protocolProfile"] extends "openai_responses"
          ? "/v1/responses"
          : "/v1/messages";
      readonly modelsPath: "/v1/models";
      readonly modelsWireAuth: Extract<WireAuthSchemeV5, { readonly kind: "authorization_bearer" }>;
      readonly realmIsolation: "site_key_and_endpoint_must_match";
      readonly streamingTerminalPolicy: "http_status_or_typed_sse_error_terminal";
      readonly retryPolicy: "host_owned_no_hidden_retry";
      readonly recognizedHttpAndProviderTerminalClasses: readonly [
        "401_or_401002_invalid_site_key",
        "402_model_service_not_enabled_or_quota_insufficient",
        "429_rate_limited",
        "sse_error_after_stream_started",
      ];
      readonly modelCatalogStatusPolicy: "only_online_is_newly_selectable_and_pre_offline_is_migration_required";
      readonly primaryToFallbackOriginRequiresFreshEndpointIdentityRouteFenceAndDataBoundaryVerification: true;
      readonly baselineFundingMode: "payg_postpaid";
      readonly optionalFundingModesAreObservedSeparately:
        readonly ["tpm_reserved", "dedicated_model_unit"];
      readonly tokenPlanOrAnotherProviderSubscriptionCannotSubstituteTokenHubEntitlement: true;
    }
  : R["requirementKey"] extends TencentEnterpriseTokenPlanRequirementKeyV20
    ? ReferenceProviderWireProfileV5 & {
        readonly profileId: R["requirementKey"] extends `tencent-enterprise-plan.gz.${string}`
          ? "wire-profile:tencent-enterprise-token-plan-guangzhou@5"
          : "wire-profile:tencent-enterprise-token-plan-singapore@5";
        readonly endpointOrigin: R["requirementKey"] extends `tencent-enterprise-plan.gz.${string}`
          ? "https://tokenhub.tencentmaas.com"
          : "https://tokenhub-intl.tencentmaas.com";
        readonly operationPath: R["protocolProfile"] extends "openai_chat_completions"
          ? "/plan/v3/chat/completions"
          : "/plan/anthropic/v1/messages";
        readonly modelsPath: "not_supported";
        readonly realmIsolation: "site_key_and_endpoint_must_match";
        readonly streamingTerminalPolicy: "http_status_or_typed_sse_error_terminal";
        readonly retryPolicy: "host_owned_no_hidden_retry";
        readonly responsesProtocolSupported: false;
        readonly productEditions: readonly ["enterprise_professional_points", "enterprise_auto_token_pool"];
        readonly enterprisePlanKeyCannotBeUsedOnPersonalOrOrdinaryTokenHubEndpoints: true;
      }
  : R["requirementKey"] extends "bigmodel.chat"
    ? ReferenceProviderWireProfileV5 & {
        readonly profileId: "wire-profile:zhipu-bigmodel-chat@5";
        readonly endpointOrigin: "https://open.bigmodel.cn";
        readonly operationPath: "/api/paas/v4/chat/completions";
        readonly modelsPath: "not_supported";
        readonly realmIsolation: "provider_defined";
        readonly streamingTerminalPolicy: "http_status_before_stream_then_protocol_terminal";
        readonly retryPolicy: "host_owned_no_hidden_retry";
        readonly ordinaryPlatformAndCodingPlanRouteIsolationRequired: true;
      }
    : R["requirementKey"] extends "bigmodel.messages"
      ? ReferenceProviderWireProfileV5 & {
          readonly profileId: "wire-profile:zhipu-bigmodel-anthropic-messages@5";
          readonly endpointOrigin: "https://open.bigmodel.cn";
          readonly operationPath: "/api/anthropic/v1/messages";
          readonly modelsPath: "not_supported";
          readonly realmIsolation: "provider_defined";
          readonly streamingTerminalPolicy: "http_status_before_stream_then_protocol_terminal";
          readonly retryPolicy: "host_owned_no_hidden_retry";
          readonly ordinaryPlatformAndCodingPlanRouteIsolationRequired: true;
        }
      : R["requirementKey"] extends "kimi.platform.chat"
        ? ReferenceProviderWireProfileV5 & {
            readonly profileId: "wire-profile:kimi-platform-payg-chat@5";
            readonly endpointOrigin: "https://api.moonshot.cn";
            readonly operationPath: "/v1/chat/completions";
            readonly modelsPath: "/v1/models";
            readonly realmIsolation: "provider_defined";
            readonly streamingTerminalPolicy: "http_status_before_stream_then_protocol_terminal";
            readonly retryPolicy: "host_owned_no_hidden_retry";
            readonly kimiCodeMembershipEndpointAndKeyCannotSubstitutePlatformPayg: true;
          }
        : R["requirementKey"] extends "kimi.code.chat"
          ? ReferenceProviderWireProfileV5 & {
              readonly profileId: "wire-profile:kimi-code-membership-chat@5";
              readonly endpointOrigin: "https://api.kimi.com";
              readonly operationPath: "/coding/v1/chat/completions";
              readonly modelsPath: "not_supported";
              readonly realmIsolation: "provider_defined";
              readonly streamingTerminalPolicy: "http_status_before_stream_then_protocol_terminal";
              readonly retryPolicy: "host_owned_no_hidden_retry";
              readonly realClientUserAgentPreservedAndImpersonationForbidden: true;
              readonly membershipEntitlementModelEligibilityAndExtraUsageObservationRequired: true;
            }
          : R["requirementKey"] extends "kimi.code.messages"
            ? ReferenceProviderWireProfileV5 & {
                readonly profileId: "wire-profile:kimi-code-membership-messages@5";
                readonly endpointOrigin: "https://api.kimi.com";
                readonly operationPath: "/coding/v1/messages";
                readonly modelsPath: "not_supported";
                readonly realmIsolation: "provider_defined";
                readonly streamingTerminalPolicy: "http_status_before_stream_then_protocol_terminal";
                readonly retryPolicy: "host_owned_no_hidden_retry";
                readonly realClientUserAgentPreservedAndImpersonationForbidden: true;
                readonly membershipEntitlementModelEligibilityAndExtraUsageObservationRequired: true;
              }
            : ReferenceProviderWireProfileV5;

type ReferenceExactWirePolicyV6 =
  | {
      readonly transport: "fixed_https";
      readonly profileId: `wire-oracle:${string}@6`;
      readonly method: "POST";
      readonly endpointOrigin: `https://${string}`;
      readonly operationPath: `/${string}`;
      readonly modelsRequest:
        | { readonly method: "GET"; readonly path: `/${string}` }
        | { readonly kind: "not_supported" };
      readonly modelPlacement:
        | "request_body_model"
        | "operation_path_model"
        | "operation_path_deployment"
        | "operation_path_project_location_publisher_model";
      readonly publicConstantHeaders: readonly {
        readonly name: string;
        readonly value: string;
      }[];
      readonly queryPolicy: "none" | "fixed_api_version_from_oracle";
      readonly realmAndCredentialRecipientPolicyId: string;
      readonly streamingTerminalPolicy:
        | "http_status_before_stream_then_protocol_terminal"
        | "http_status_or_typed_sse_error_terminal";
    }
  | {
      readonly transport: "templated_https";
      readonly profileId: `wire-oracle:${string}@6`;
      readonly method: "POST";
      readonly originTemplate: `https://${string}`;
      readonly operationPathTemplate: `/${string}`;
      readonly requiredTemplateVariables: readonly string[];
      readonly modelsRequest: { readonly kind: "not_supported" } | {
        readonly method: "GET";
        readonly pathTemplate: `/${string}`;
      };
      readonly modelPlacement:
        | "request_body_model"
        | "operation_path_model"
        | "operation_path_deployment"
        | "operation_path_project_location_publisher_model";
      readonly publicConstantHeaders: readonly { readonly name: string; readonly value: string }[];
      readonly queryPolicy: "none" | "fixed_api_version_from_oracle";
      readonly realmAndCredentialRecipientPolicyId: string;
      readonly streamingTerminalPolicy: "http_status_before_stream_then_protocol_terminal";
    }
  | {
      readonly transport: "vertex_location_resolved_https";
      readonly profileId: `wire-oracle:${string}@6`;
      readonly method: "POST";
      readonly globalOrigin: "https://aiplatform.googleapis.com";
      readonly regionalOriginTemplate: "https://{location}-aiplatform.googleapis.com";
      readonly operationPathTemplate: "/v1/projects/{project}/locations/{location}/publishers/google/models/{model}:generateContent";
      readonly streamOperationPathTemplate: "/v1/projects/{project}/locations/{location}/publishers/google/models/{model}:streamGenerateContent";
      readonly requiredTemplateVariables: readonly ["project", "location", "model"];
      readonly locationResolutionRules: readonly [
        { readonly family: "global"; readonly location: "global"; readonly exactOrigin: "https://aiplatform.googleapis.com" },
        { readonly family: "regional"; readonly locationPattern: "google-cloud-location-id"; readonly exactOriginTemplate: "https://{location}-aiplatform.googleapis.com" },
      ];
      readonly signedRegionModelAvailabilityEvidenceRequiredBeforeDns: true;
      readonly modelsRequest: { readonly kind: "not_supported" };
      readonly modelPlacement: "operation_path_project_location_publisher_model";
      readonly publicConstantHeaders: readonly { readonly name: string; readonly value: string }[];
      readonly queryPolicy: "none";
      readonly realmAndCredentialRecipientPolicyId: string;
      readonly streamingTerminalPolicy: "http_status_before_stream_then_protocol_terminal";
    }
  | {
      readonly transport: "release_signed_region_catalog_https";
      readonly profileId: `wire-oracle:${string}@6`;
      readonly method: "POST";
      readonly regionEndpointCatalog: readonly [
        {
          readonly regionId: "ap-southeast-1";
          readonly endpointOrigin: "https://ark.ap-southeast.bytepluses.com";
        },
        {
          readonly regionId: "eu-west-1";
          readonly endpointOrigin: "https://ark.eu-west.bytepluses.com";
        },
      ];
      readonly operationPath: "/api/v3/responses";
      readonly modelsRequest: { readonly kind: "not_supported" };
      readonly modelPlacement: "request_body_model";
      readonly publicConstantHeaders: readonly { readonly name: string; readonly value: string }[];
      readonly queryPolicy: "none";
      readonly realmAndCredentialRecipientPolicyId: string;
      readonly releaseSignedRegionCatalogAndModelAvailabilityEvidenceRequiredBeforeDns: true;
      readonly regionIdIsNeverInterpolatedIntoDns: true;
      readonly streamingTerminalPolicy: "http_status_before_stream_then_protocol_terminal";
    }
  | {
      readonly transport: "loopback_discovered_http";
      readonly profileId: `wire-oracle:${string}@6`;
      readonly method: "POST";
      readonly signedProductIdentity: string;
      readonly allowedCanonicalHosts: readonly ["127.0.0.1", "::1"];
      readonly defaultOrigin: `http://${string}` | "no_single_default_runtime_discovery_required";
      readonly operationPath: `/${string}`;
      readonly modelsRequest:
        | { readonly method: "GET"; readonly path: `/${string}` }
        | { readonly kind: "runtime_openapi_operation"; readonly operationId: string }
        | { readonly kind: "not_supported" };
      readonly modelPlacement: "request_body_model" | "runtime_openapi_bound";
      readonly publicConstantHeaders: readonly { readonly name: string; readonly value: string }[];
      readonly endpointPathCanOnlyComeFromThisLiteralOrSignedProductOpenApi: true;
      readonly lanRequiresExplicitActiveEndpointIdentityAndCannotReuseLoopbackReceipt: true;
      readonly streamingTerminalPolicy: "http_status_before_stream_then_protocol_terminal";
    }
  | {
      readonly transport: "runtime_openapi_bound_http";
      readonly profileId: `wire-oracle:${string}@6`;
      readonly signedProductIdentity: string;
      readonly allowedCanonicalHosts: readonly ["127.0.0.1", "::1"];
      readonly defaultOrigin: `http://${string}` | "no_single_default_runtime_discovery_required";
      readonly operationSelector:
        | { readonly kind: "signed_openapi_operation"; readonly operationId: string }
        | { readonly kind: "literal_method_path"; readonly method: "POST"; readonly pathTemplate: `/${string}` };
      readonly openApiDocumentOperationAndProcessGenerationMustBindEndpointIdentity: true;
      readonly applicationSecretReadBeforeOperationAndPeerBindingForbidden: true;
    }
  | {
      readonly transport: "local_process_protocol";
      readonly profileId: `wire-oracle:${string}@6`;
      readonly processProtocol: "app_server_stdio" | "acp_stdio" | "cli_stdio";
      readonly signedProductOrUserSelectedDriverIdentity: string;
      readonly httpMethodOriginPathModelsAndHeaders: "not_applicable";
    }
  | {
      readonly transport: "custom_configured_https_or_explicit_private_http";
      readonly profileId: `wire-oracle:${string}@6`;
      readonly method: "POST";
      readonly protocolProfile: "openai_chat_completions" | "openai_responses" | "anthropic_messages";
      readonly baseSemantics: "api_root_or_version_root_explicit_never_guessed";
      readonly operationRelativePaths:
        | { readonly apiRoot: "v1/chat/completions"; readonly versionRoot: "chat/completions" }
        | { readonly apiRoot: "v1/responses"; readonly versionRoot: "responses" }
        | { readonly apiRoot: "v1/messages"; readonly versionRoot: "messages" };
      readonly relativeRfc3986DirectoryResolutionOnly: true;
      readonly leadingSlashDotSegmentEncodedSeparatorQueryAndFragmentForbidden: true;
      readonly endpointIdentityIncludesFinalOriginPathProtocolAuthRecipientAndCredentialVersion: true;
    };

type ReferenceExactAuthFlowV7 =
  | {
      readonly kind: "static_or_brokered_request_credential";
      readonly tokenExchangeNetworkRequest: "not_applicable";
      readonly finalApiCredentialRecipientBoundSeparately: true;
    }
  | {
      readonly kind: "google_adc_oauth";
      readonly admissibleCredentialSourceProfiles: readonly [
        {
          readonly sourceClass: "authorized_user_adc";
          readonly tokenEndpoint: "https://oauth2.googleapis.com/token";
          readonly refreshTokenRemainsInBroker: true;
        },
        {
          readonly sourceClass: "service_account_adc";
          readonly tokenEndpoint: "https://oauth2.googleapis.com/token";
          readonly jwtAssertionSigningRemainsInBroker: true;
        },
        {
          readonly sourceClass: "external_account_adc";
          readonly stsEndpointPolicy: "validated_global_regional_or_mtls_from_external_account_configuration";
          readonly exactProviderAudienceAndSubjectTokenTypeRequired: true;
        },
        {
          readonly sourceClass: "metadata_adc";
          readonly metadataSourceAdmissionRequired: true;
        },
      ];
      readonly oauthScopes: readonly ["https://www.googleapis.com/auth/cloud-platform"];
      readonly selectedSourceProfilePrincipalProjectScopeAndTokenEndpointEnterCredentialFamilyIdentity: true;
      readonly finalApiCredentialRecipientBoundSeparately: true;
    }
  | {
      readonly kind: "google_workload_identity_federation";
      readonly externalAccountAudienceTemplate: "//iam.googleapis.com/projects/{projectNumber}/locations/global/workloadIdentityPools/{poolId}/providers/{providerId}";
      readonly subjectTokenAudienceSource: "verified_external_account_source_profile_distinct_from_sts_audience";
      readonly sourceProfileCatalog: readonly [
        { readonly sourceClass: "oidc"; readonly subjectTokenTypes: readonly ["urn:ietf:params:oauth:token-type:jwt", "urn:ietf:params:oauth:token-type:idToken"]; readonly endpointClass: "global_or_release_signed_regional_sts" },
        { readonly sourceClass: "saml2"; readonly subjectTokenTypes: readonly ["urn:ietf:params:oauth:token-type:saml2"]; readonly endpointClass: "global_or_release_signed_regional_sts" },
        { readonly sourceClass: "aws"; readonly subjectTokenTypes: readonly ["urn:ietf:params:aws:token-type:aws4_request"]; readonly endpointClass: "global_or_release_signed_regional_sts" },
        { readonly sourceClass: "x509"; readonly subjectTokenTypes: readonly ["urn:ietf:params:oauth:token-type:mtls"]; readonly endpointClass: "google_mtls_sts_only" },
      ];
      readonly stsEndpointPolicy: "derived_from_validated_external_account_configuration_and_release_allowlist";
      readonly stsMethod: "POST";
      readonly stsGrantType: "urn:ietf:params:oauth:grant-type:token-exchange";
      readonly requestedTokenType: "urn:ietf:params:oauth:token-type:access_token";
      readonly requestedOAuthScopes: readonly ["https://www.googleapis.com/auth/cloud-platform"];
      readonly serviceAccountImpersonationPolicy: "none_or_exact_generate_access_token_physical_operation";
      readonly everyConnectionFlowIsDerivedFromOneVerifiedSourceProfileAndOneExactImpersonationProfile: true;
      readonly finalApiCredentialRecipientBoundSeparately: true;
    }
  | {
      readonly kind: "aws_sigv4";
      readonly authorizationHeaderScheme: "AWS4-HMAC-SHA256";
      readonly requiredBaseSignedHeaderNames: readonly ["host", "x-amz-date", "x-amz-content-sha256"];
      readonly temporaryCredentialAdditionalSignedHeaderNames: readonly ["x-amz-security-token"];
      readonly credentialScopeComponents: readonly ["date", "region", "service", "aws4_request"];
      readonly service: "bedrock-runtime";
      readonly sessionTokenHeaderPolicy: "required_for_temporary_credentials_and_forbidden_otherwise";
      readonly canonicalRequestAndStringToSignEvidenceRequired: true;
      readonly finalApiCredentialRecipientBoundSeparately: true;
    }
  | {
      readonly kind: "azure_entra_oauth";
      readonly authorityHost: "https://login.microsoftonline.com";
      readonly credentialSourceProfile:
        | {
            readonly credentialSourceClass: "device_authorized_user";
            readonly tenantBoundDeviceAuthorizationEndpointTemplate: "https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/devicecode";
            readonly tenantBoundTokenEndpointTemplate: "https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token";
            readonly clientIdSource: "exact_selected_public_client_registration";
            readonly deviceAuthorizationScope: "https://cognitiveservices.azure.com/.default offline_access";
            readonly tokenPollGrantType: "urn:ietf:params:oauth:grant-type:device_code";
            readonly startAndPollPhysicalOperationsBindTenantClientAndDeviceCodeExactly: true;
          }
        | {
            readonly credentialSourceClass: "service_principal";
            readonly tenantBoundTokenEndpointTemplate: "https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token";
            readonly clientIdSource: "exact_selected_application_registration";
            readonly grantType: "client_credentials";
            readonly assertionKinds: readonly ["client_secret", "client_certificate", "federated_client_assertion"];
            readonly oauthScope: "https://cognitiveservices.azure.com/.default";
          };
      readonly finalApiCredentialRecipientBoundSeparately: true;
    }
  | {
      readonly kind: "azure_managed_identity_metadata";
      readonly credentialSourceClass: "managed_identity";
      readonly admissibleHostedSourceProfiles: readonly [
        {
          readonly kind: "azure_vm_imds";
          readonly endpoint: "http://169.254.169.254/metadata/identity/oauth2/token";
          readonly method: "GET";
          readonly requiredHeader: "Metadata: true";
          readonly apiVersion: "2018-02-01";
        },
        {
          readonly kind: "azure_app_service_identity_endpoint";
          readonly endpointSource: "attested_IDENTITY_ENDPOINT_environment_value";
          readonly requiredSecretHeaderSource: "brokered_IDENTITY_HEADER_environment_value";
          readonly method: "GET";
          readonly apiVersion: "2019-08-01";
        },
      ];
      readonly requestedResource: "https://cognitiveservices.azure.com";
      readonly managedIdentitySelectorPolicy: "system_assigned_none_or_user_assigned_exactly_one_of_client_id_object_id_msi_res_id_principal_id";
      readonly tenantBoundTokenEndpointTemplate?: never;
      readonly sourceEndpointIsAttestedAndNeverDerivedFromApiOrigin: true;
      readonly finalApiCredentialRecipientBoundSeparately: true;
    }
  | {
      readonly kind: "api_key_pkce_exchange";
      readonly authorizationEndpoint: "https://openrouter.ai/auth";
      readonly authorizationMethod: "GET";
      readonly responseType: "code";
      readonly codeChallengeMethod: "S256";
      readonly callbackStateAndVerifierMustEqualTheExactBrowserLaunchFamily: true;
      readonly exchangeEndpoint: "https://openrouter.ai/api/v1/auth/keys";
      readonly exchangeMethod: "POST";
      readonly exchangeBodyFields: readonly ["code", "code_verifier", "code_challenge_method"];
      readonly exchangeProducesBrokeredApiKeyFamilyBeforeFinalBearerUse: true;
      readonly finalApiCredentialRecipientBoundSeparately: true;
    }
  | {
      readonly kind: "upstream_application_or_no_application_credential";
      readonly tokenExchangeNetworkRequest: "not_applicable";
      readonly finalApiCredentialRecipientBoundSeparately: boolean;
    };

type ReferenceExactAuthPolicyInputV7 = {
  readonly profileId: `auth-oracle:${string}@6`;
  readonly requirementAuthKind: AuthSource["kind"];
  readonly semanticAuthFlowKind: ReferenceExactAuthFlowV7["kind"];
  readonly custodyKind: CredentialCustodyProfileV5["kind"];
  readonly wireKind: WireAuthSchemeV5["kind"];
  readonly credentialHeaderName:
    | "Authorization"
    | "x-api-key"
    | "x-goog-api-key"
    | "api-key"
    | "configured"
    | "none";
  readonly challengeKind: AuthChallengeModeV5["kind"];
  readonly principalAndKeyNamespace: string;
  readonly endpointIdentityMustContainPrincipalCredentialVersionAndRecipient: boolean;
};

declare const referenceExactAuthPolicyBrandV7: unique symbol;

type ReferenceExactAuthPolicyV6 = ReferenceExactAuthPolicyInputV7 & {
  readonly [referenceExactAuthPolicyBrandV7]: never;
  readonly authFlow: ReferenceExactAuthFlowV7;
  readonly tokenResourceOrAudience?: never;
};

type ReferenceDynamicPublicHeaderPolicyV7 =
  | { readonly kind: "none" }
  | {
      readonly kind: "signed_distribution_user_agent";
      readonly headerName: "User-Agent";
      readonly productToken: "SayDo";
      readonly versionFromSignedDistributionManifest: true;
      readonly distributionArtifactDigest: string;
      readonly impersonationOfClaudeOpenCodeCodexOrAnotherClientForbidden: true;
    };

type ReferenceConnectionOperationOverridesV7 = {
  readonly operationAuth?: ReferenceExactAuthPolicyV6;
  readonly modelsAuth?: ReferenceExactAuthPolicyV6;
  readonly streamMethodAndPath?: {
    readonly method: "POST";
    readonly pathOrTemplate: `/${string}`;
    readonly fixedQuery: "none" | "?alt=sse";
    readonly framing: "sse" | "aws_event_stream";
  };
  readonly operationDynamicPublicHeaderPolicy?:
    | { readonly kind: "none" }
    | {
        readonly kind: "signed_distribution_user_agent";
        readonly productToken: "SayDo";
        readonly versionSource: "signed_distribution_manifest";
        readonly impersonationOfClaudeOpenCodeCodexOrAnotherClientForbidden: true;
      };
  readonly modelsDynamicPublicHeaderPolicy?: { readonly kind: "none" };
  readonly optionalAuthWireAlternatives?:
    | {
        readonly acceptedWhenRequireAuthenticationIsEnabled: readonly [
          "anthropic_x_api_key",
          "authorization_bearer",
        ];
        readonly deterministicPreferenceOrder: readonly [
          "anthropic_x_api_key",
          "authorization_bearer",
        ];
        readonly exactlyOneCredentialHeaderPerPhysicalRequest: true;
        readonly credentialFreeWhenRequireAuthenticationIsDisabled: true;
      }
    | {
        readonly acceptedForExactEnterprisePlanEndpoint: readonly [
          "anthropic_x_api_key",
          "authorization_bearer",
        ];
        readonly deterministicPreferenceOrder: readonly [
          "anthropic_x_api_key",
          "authorization_bearer",
        ];
        readonly exactlyOneCredentialHeaderPerPhysicalRequest: true;
        readonly ordinaryTokenHubPersonalPlanAndCrossRegionKeyNamespacesForbidden: true;
      };
  readonly officialFallbackRoute?: {
    readonly routeId: "official_fallback";
    readonly exactOrigin: `https://${string}`;
    readonly separateEndpointIdentityRequired: true;
    readonly freshPhysicalAttemptLeaseRequired: true;
  };
};

type ReferencePhysicalRequestOperationKindV7 =
  | "unary_or_primary"
  | "stream"
  | "model_catalog"
  | "execution_or_bridge_operation";

interface ReferenceExactPhysicalRequestProfileV7<
  K extends string = string,
  P extends ReferenceProtocolProfileV3 = ReferenceProtocolProfileV3,
> extends ReceiptRef<"receipt:reference-exact-physical-request-profile@7", readonly [K, P, number]> {
  readonly requirementKey: K;
  readonly protocolProfile: P;
  readonly operationOrdinal: number;
  readonly operationKind: ReferencePhysicalRequestOperationKindV7;
  readonly method: "GET" | "POST" | "local_process_operation" | "runtime_openapi_operation";
  readonly exactOriginPathQueryOrProcessOperation: string;
  readonly auth: ReferenceExactAuthPolicyV6;
  readonly publicConstantHeaders: readonly { readonly name: string; readonly value: string }[];
  readonly dynamicPublicHeaderPolicy: ReferenceDynamicPublicHeaderPolicyV7;
  readonly framing: "json" | "sse" | "aws_event_stream" | "stdio_json_rpc" | "runtime_openapi";
  readonly credentialRecipientPolicyId: string;
  readonly exactRowWireDefaultAuthOverrideAndDistributionDigest: string;
  readonly endpointIdentityIncludesRequirementWireOperationAuthRecipientAndCredentialVersion: true;
}

declare const referencePhysicalRequestOperationGraphBrandV7: unique symbol;

interface ReferencePhysicalRequestOperationGraphV7<K extends string = string>
  extends ReceiptRef<"receipt:reference-physical-request-operation-graph@7", K> {
  readonly [referencePhysicalRequestOperationGraphBrandV7]: never;
  readonly requirementKey: K;
  readonly requirementSemanticIdentityDigest: string;
  readonly exactWireDefaultAuthOperationOverridesAndDistributionDigest: string;
  readonly orderedPhysicalRequestProfiles: NonEmptyReadonly<ReferenceExactPhysicalRequestProfileV7<K>>;
  readonly expectedOperationKeys: NonEmptyReadonly<`${K}:${ReferencePhysicalRequestOperationKindV7}:${number}`>;
  readonly actualOperationKeys: NonEmptyReadonly<`${K}:${ReferencePhysicalRequestOperationKindV7}:${number}`>;
  readonly missingDuplicateOrExtraOperationCount: 0;
  readonly operationAuthPathHeaderFramingRecipientOrDistributionMismatchCount: 0;
  readonly primaryRouteIdentity: {
    readonly routeId: "primary";
    readonly exactWireProfileId: `wire-oracle:${string}@6`;
    readonly endpointIdentityDigest: string;
  };
  readonly officialFallbackRoute: ReferenceConnectionOperationOverridesV7["officialFallbackRoute"] | {
    readonly kind: "not_configured";
  };
  readonly primaryAndOfficialFallbackNeverShareEndpointIdentityOrPhysicalAttemptLease: true;
  readonly compilerProvesEveryWireOperationHasExactlyOneProfileAndNoProfileExistsWithoutAWireOperation: true;
}

declare const referenceRowOperationOracleSemanticCompilationBrandV7: unique symbol;

interface ReferenceRowOperationOracleSemanticCompilationReceiptV7<K extends string = string>
  extends ReceiptRef<"receipt:reference-row-operation-oracle-semantic-compilation@7", K> {
  readonly [referenceRowOperationOracleSemanticCompilationBrandV7]: never;
  readonly requirementKey: K;
  readonly requirementSemanticIdentityDigest: string;
  readonly exactWireProfileId: `wire-oracle:${string}@6`;
  readonly exactAuthProfileId: `auth-oracle:${string}@6`;
  readonly operationGraph: ReferencePhysicalRequestOperationGraphV7<K>;
  readonly protocolSurfaceAuthWireOperationStreamingAndRecipientAreCompatible: true;
  readonly exactRequirementInputWireAuthAndOperationGraphDigest: string;
  readonly compilerExitCode: 0;
}

interface ReferenceExactConnectionOracleEntryV6<K extends string = string> {
  readonly requirementKey: K;
  readonly wire: ReferenceExactWirePolicyV6;
  readonly auth: ReferenceExactAuthPolicyV6;
  readonly physicalRequestOperationGraph: ReferencePhysicalRequestOperationGraphV7<K>;
  readonly rowSemanticCompilerReceipt: ReferenceRowOperationOracleSemanticCompilationReceiptV7<K>;
  readonly independentSignedOracleTargetPath: `providers/${string}/connection-oracle.v6.json`;
  readonly officialEvidenceLockTargetPath: `evidence/providers/${string}.v6.json`;
  readonly oracleAndEvidenceLockDigestAreSuppliedByTufTargetAuthorizationAtBuild: true;
}

interface ReferenceExactConnectionOracleRowProjectionV7<
  K extends string = string,
  W extends ReferenceExactWirePolicyV6 = ReferenceExactWirePolicyV6,
  A extends ReferenceExactAuthPolicyV6 = ReferenceExactAuthPolicyV6,
> {
  readonly requirementKey: K;
  readonly wire: W;
  readonly auth: A;
  readonly physicalRequestOperationGraph: ReceiptRef<"receipt:reference-physical-request-operation-graph@7", K>;
  readonly rowSemanticCompilerReceipt: ReceiptRef<"receipt:reference-row-operation-oracle-semantic-compilation@7", K>;
  readonly independentSignedOracleTargetPath: `providers/${string}/connection-oracle.v6.json`;
  readonly officialEvidenceLockTargetPath: `evidence/providers/${string}.v6.json`;
  readonly oracleAndEvidenceLockDigestAreSuppliedByTufTargetAuthorizationAtBuild: true;
  readonly projectionRetainsOnlyCommittedReceiptReferencesWhileTheCanonicalOracleRetainsFullCompilerProofs: true;
}

type ReferenceExactConnectionOracleForInputsV6<
  R extends readonly ReferenceRequirementInputV3[],
> = {
  readonly [K in R[number]["requirementKey"]]: ReferenceExactConnectionOracleEntryV6<K>;
};

type ReferenceFundingVariantForRequirementV6<R extends {
  readonly requirementKey: string;
  readonly fundingTier: GaFundingTier;
}> = R["requirementKey"] extends TokenHubRequirementKeyV5
  ? readonly [
      {
        readonly variantId: "tokenhub_free_only";
        readonly fundingTier: "payg";
        readonly requiredFundingState: "free_only";
        readonly paymentEnabled: false;
        readonly quotaExhaustionDisposition: "stop_before_paid_send";
      },
      {
        readonly variantId: "tokenhub_free_then_payg";
        readonly fundingTier: "payg";
        readonly requiredFundingState: "free_then_payg";
        readonly paymentEnabled: true;
        readonly quotaExhaustionDisposition: "payg_only_under_exact_budget";
      },
      {
        readonly variantId: "tokenhub_reserved";
        readonly fundingTier: "subscription";
        readonly requiredFundingState: "reserved";
        readonly paymentEnabled: boolean;
        readonly quotaExhaustionDisposition: "follow_exact_order_hard_cap_and_overage_policy";
      },
      {
        readonly variantId: "tokenhub_dedicated";
        readonly fundingTier: "subscription";
        readonly requiredFundingState: "dedicated";
        readonly paymentEnabled: boolean;
        readonly quotaExhaustionDisposition: "follow_exact_order_hard_cap_and_overage_policy";
      },
    ]
  : R["requirementKey"] extends "opencode.go.chat" | "opencode.go.responses" | "opencode.go.messages"
    ? readonly [
      {
        readonly variantId: "go_limit_only";
        readonly fundingTier: "subscription";
        readonly requiredFundingState: "overage_disabled";
        readonly zenBalanceComponent?: never;
        readonly quotaExhaustionDisposition: "hard_stop_without_new_spend";
      },
      {
        readonly variantId: "go_plus_zen_balance";
        readonly fundingTier: "subscription";
        readonly requiredFundingState: "overage_zen_balance_enabled";
        readonly zenBalanceComponent: "separate_payg_component";
        readonly quotaExhaustionDisposition: "continue_only_under_exact_user_budget_and_disclosure";
      },
      ]
    : R["requirementKey"] extends TencentEnterpriseTokenPlanRequirementKeyV20
      ? readonly [
          {
            readonly variantId: "enterprise_professional_points";
            readonly fundingTier: "subscription";
            readonly requiredFundingState: "enterprise_professional_points_pool_verified";
            readonly quotaExhaustionDisposition: "hard_stop_or_continue_only_under_exact_enterprise_contract_policy";
          },
          {
            readonly variantId: "enterprise_auto_token_pool";
            readonly fundingTier: "subscription";
            readonly requiredFundingState: "enterprise_auto_token_pool_verified";
            readonly quotaExhaustionDisposition: "hard_stop_at_monthly_token_pool_exhaustion";
          },
        ]
    : readonly [{
        readonly variantId: "baseline";
        readonly fundingTier: R["fundingTier"];
        readonly requiredFundingState?: never;
        readonly zenBalanceComponent?: never;
        readonly quotaExhaustionDisposition: "follow_exact_funding_policy";
      }];

type ReferenceLiveQualificationModeForRequirementV6<R extends {
  readonly requirementKey: string;
  readonly surfaceKind: ReferenceSurfaceKindV3;
  readonly realmClass: "china_mainland" | "global" | "local";
  readonly categoryKey: ReferenceCategoryKeyV3;
}> = ReferenceLiveDependencyClassForRequirementV7<R> extends "remote_existing_connection_migration"
  ? "required_remote_existing_connection_migration"
  : ReferenceLiveDependencyClassForRequirementV7<R> extends "remote_provider_account"
  ? "required_remote_provider"
  : ReferenceLiveDependencyClassForRequirementV7<R> extends "remote_backed_execution_or_bridge"
    ? "required_remote_upstream_surface"
    : ReferenceLiveDependencyClassForRequirementV7<R> extends "pure_local_runtime"
      ? "required_local_product"
      : ReferenceLiveDependencyClassForRequirementV7<R> extends "platform_control"
        ? "required_platform_control"
        : "not_applicable_user_or_admin_supplied_endpoint";

type ReferenceLiveDependencyClassV7 =
  | "remote_provider_account"
  | "remote_existing_connection_migration"
  | "remote_backed_execution_or_bridge"
  | "pure_local_runtime"
  | "user_or_admin_supplied_endpoint"
  | "platform_control";

type ReferenceLiveDependencyClassForRequirementV7<R extends {
  readonly requirementKey: string;
  readonly surfaceKind: ReferenceSurfaceKindV3;
  readonly realmClass: "china_mainland" | "global" | "local";
  readonly categoryKey: ReferenceCategoryKeyV3;
}> = R extends { readonly ownerOnboardingAvailability: "existing_connection_migration_only" }
  ? "remote_existing_connection_migration"
  : R["requirementKey"] extends "hunyuan.cn"
  ? "remote_existing_connection_migration"
  : R["categoryKey"] extends "custom_endpoint"
  ? "user_or_admin_supplied_endpoint"
  : R["surfaceKind"] extends "control_plane"
    ? "platform_control"
    : R["surfaceKind"] extends "execution" | "bridge"
      ? "remote_backed_execution_or_bridge"
      : R["realmClass"] extends "local"
        ? "pure_local_runtime"
        : "remote_provider_account";

type ReferenceOptionalAuthPolicyV6 =
  | {
      [K in OptionalServerAuthRequirementKeyV6]: ReferenceOptionalAuthPolicyForRequirementV6<{
        readonly requirementKey: K;
      }>;
    }[OptionalServerAuthRequirementKeyV6]
  | ReferenceOptionalAuthPolicyForRequirementV6<{
      readonly requirementKey: "not_optional_server_auth";
    }>;

type ReferenceFundingVariantV6 =
  | ReferenceFundingVariantForRequirementV6<{
      readonly requirementKey: "tokenhub.gz.chat";
      readonly fundingTier: "payg";
    }>[number]
  | ReferenceFundingVariantForRequirementV6<{
      readonly requirementKey: "opencode.go.chat";
      readonly fundingTier: "subscription";
    }>[number]
  | ReferenceFundingVariantForRequirementV6<{
      readonly requirementKey: "tencent-enterprise-plan.gz.chat";
      readonly fundingTier: "subscription";
    }>[number]
  | ReferenceFundingVariantForRequirementV6<{
      readonly requirementKey: "baseline";
      readonly fundingTier: GaFundingTier;
    }>[number];

type SpecialFundingRequirementKeyV6 =
  | TokenHubRequirementKeyV5
  | TencentEnterpriseTokenPlanRequirementKeyV20
  | "opencode.go.chat"
  | "opencode.go.responses"
  | "opencode.go.messages";

const TOKENHUB_REFERENCE_FUNDING_VARIANTS_V6 = [
  { variantId: "tokenhub_free_only", fundingTier: "payg", requiredFundingState: "free_only", paymentEnabled: false, quotaExhaustionDisposition: "stop_before_paid_send" },
  { variantId: "tokenhub_free_then_payg", fundingTier: "payg", requiredFundingState: "free_then_payg", paymentEnabled: true, quotaExhaustionDisposition: "payg_only_under_exact_budget" },
  { variantId: "tokenhub_reserved", fundingTier: "subscription", requiredFundingState: "reserved", paymentEnabled: true, quotaExhaustionDisposition: "follow_exact_order_hard_cap_and_overage_policy" },
  { variantId: "tokenhub_dedicated", fundingTier: "subscription", requiredFundingState: "dedicated", paymentEnabled: true, quotaExhaustionDisposition: "follow_exact_order_hard_cap_and_overage_policy" },
] as const satisfies ReferenceFundingVariantForRequirementV6<{
  readonly requirementKey: "tokenhub.gz.chat";
  readonly fundingTier: "payg";
}>;

const OPENCODE_GO_REFERENCE_FUNDING_VARIANTS_V6 = [
  { variantId: "go_limit_only", fundingTier: "subscription", requiredFundingState: "overage_disabled", quotaExhaustionDisposition: "hard_stop_without_new_spend" },
  { variantId: "go_plus_zen_balance", fundingTier: "subscription", requiredFundingState: "overage_zen_balance_enabled", zenBalanceComponent: "separate_payg_component", quotaExhaustionDisposition: "continue_only_under_exact_user_budget_and_disclosure" },
] as const satisfies ReferenceFundingVariantForRequirementV6<{
  readonly requirementKey: "opencode.go.chat";
  readonly fundingTier: "subscription";
}>;

const TENCENT_ENTERPRISE_TOKEN_PLAN_FUNDING_VARIANTS_V20 = [
  { variantId: "enterprise_professional_points", fundingTier: "subscription", requiredFundingState: "enterprise_professional_points_pool_verified", quotaExhaustionDisposition: "hard_stop_or_continue_only_under_exact_enterprise_contract_policy" },
  { variantId: "enterprise_auto_token_pool", fundingTier: "subscription", requiredFundingState: "enterprise_auto_token_pool_verified", quotaExhaustionDisposition: "hard_stop_at_monthly_token_pool_exhaustion" },
] as const satisfies ReferenceFundingVariantForRequirementV6<{
  readonly requirementKey: "tencent-enterprise-plan.gz.chat";
  readonly fundingTier: "subscription";
}>;

const REFERENCE_SPECIAL_FUNDING_VARIANT_REGISTRY_V6 = {
  "tokenhub.gz.chat": TOKENHUB_REFERENCE_FUNDING_VARIANTS_V6,
  "tokenhub.gz.responses": TOKENHUB_REFERENCE_FUNDING_VARIANTS_V6,
  "tokenhub.gz.messages": TOKENHUB_REFERENCE_FUNDING_VARIANTS_V6,
  "tokenhub.sg.chat": TOKENHUB_REFERENCE_FUNDING_VARIANTS_V6,
  "tokenhub.sg.responses": TOKENHUB_REFERENCE_FUNDING_VARIANTS_V6,
  "tokenhub.sg.messages": TOKENHUB_REFERENCE_FUNDING_VARIANTS_V6,
  "tencent-enterprise-plan.gz.chat": TENCENT_ENTERPRISE_TOKEN_PLAN_FUNDING_VARIANTS_V20,
  "tencent-enterprise-plan.gz.messages": TENCENT_ENTERPRISE_TOKEN_PLAN_FUNDING_VARIANTS_V20,
  "tencent-enterprise-plan.sg.chat": TENCENT_ENTERPRISE_TOKEN_PLAN_FUNDING_VARIANTS_V20,
  "tencent-enterprise-plan.sg.messages": TENCENT_ENTERPRISE_TOKEN_PLAN_FUNDING_VARIANTS_V20,
  "opencode.go.chat": OPENCODE_GO_REFERENCE_FUNDING_VARIANTS_V6,
  "opencode.go.responses": OPENCODE_GO_REFERENCE_FUNDING_VARIANTS_V6,
  "opencode.go.messages": OPENCODE_GO_REFERENCE_FUNDING_VARIANTS_V6,
} as const satisfies Record<SpecialFundingRequirementKeyV6, readonly ReferenceFundingVariantV6[]>;

type ReferenceLiveQualificationModeV6 =
  | "required_remote_provider"
  | "required_remote_existing_connection_migration"
  | "required_remote_upstream_surface"
  | "required_local_product"
  | "required_platform_control"
  | "not_applicable_user_or_admin_supplied_endpoint"
  ;

interface TokenHubFundingSubjectV6 {
  readonly siteRealm: "guangzhou" | "singapore";
  readonly principalAndCloudAccountDigest: string;
  readonly keyNamespaceAndVersionDigest: string;
  readonly modelServiceId: string;
  readonly modelId: string;
  readonly operationProfile: "openai_chat_completions" | "openai_responses" | "anthropic_messages";
  readonly capacityOrOrderId: string | "none";
  readonly region: string;
}

type TokenHubFundingClosureReceiptV6 = ReceiptRef<
  "receipt:tencent-tokenhub-funding-closure@6",
  TokenHubFundingSubjectV6
> & {
  readonly subject: TokenHubFundingSubjectV6;
  readonly paymentEnabled: boolean;
  readonly freeQuotaNativeUnitDigest: string;
  readonly freeQuotaExpiresAt: string | "none";
  readonly deductionOrderDigest: string;
  readonly authoritativeUsageBillingAndServiceActivationEvidenceDigest: string;
  readonly fundingPolicyTemplate: FundingPolicyTemplateReceipt;
  readonly checkedAt: string;
  readonly expiresAt: string;
} & (
  | {
      readonly fundingMode: "free_only";
      readonly paymentEnabled: false;
      readonly paidComponent?: never;
      readonly quotaExhaustionDisposition: "stop_before_paid_send";
    }
  | {
      readonly fundingMode: "free_then_payg";
      readonly paymentEnabled: true;
      readonly paidComponent: ReceiptRef<"receipt:tokenhub-payg-component@6", TokenHubFundingSubjectV6>;
      readonly quotaExhaustionDisposition: "payg_only_under_exact_budget";
    }
  | {
      readonly fundingMode: "reserved";
      readonly paymentEnabled: true;
      readonly capacityEntitlement: ReceiptRef<"receipt:tokenhub-capacity-entitlement@6", TokenHubFundingSubjectV6>;
      readonly paidComponent?: ReceiptRef<"receipt:tokenhub-payg-component@6", TokenHubFundingSubjectV6>;
      readonly quotaExhaustionDisposition: "follow_exact_order_hard_cap_and_overage_policy";
    }
  | {
      readonly fundingMode: "dedicated";
      readonly paymentEnabled: true;
      readonly capacityEntitlement: ReceiptRef<"receipt:tokenhub-capacity-entitlement@6", TokenHubFundingSubjectV6>;
      readonly paidComponent?: ReceiptRef<"receipt:tokenhub-payg-component@6", TokenHubFundingSubjectV6>;
      readonly quotaExhaustionDisposition: "follow_exact_order_hard_cap_and_overage_policy";
  }
);

interface TencentEnterpriseTokenPlanFundingSubjectV20 {
  readonly siteRealm: "guangzhou" | "singapore";
  readonly enterpriseOrganizationPrincipalDigest: string;
  readonly enterpriseCloudAccountDigest: string;
  readonly enterprisePlanCredentialNamespaceAndVersionDigest: string;
  readonly productEdition: "enterprise_professional_points" | "enterprise_auto_token_pool";
  readonly operationProfile: "openai_chat_completions" | "anthropic_messages";
  readonly modelEligibilitySetDigest: string;
  readonly enterpriseContractOrOrderDigest: string;
}

declare const tencentEnterpriseTokenPlanFundingClosureBrandV20: unique symbol;

type TencentEnterpriseTokenPlanFundingClosureReceiptV20 = ReceiptRef<
  "receipt:tencent-enterprise-token-plan-funding-closure@20",
  TencentEnterpriseTokenPlanFundingSubjectV20
> & {
  readonly [tencentEnterpriseTokenPlanFundingClosureBrandV20]: never;
  readonly subject: TencentEnterpriseTokenPlanFundingSubjectV20;
  readonly exactPlanEndpointAndCredentialRecipientDigest: string;
  readonly authoritativeEnterpriseEntitlementUsageAndBillingEvidenceDigest: string;
  readonly poolNativeUnitAndDeductionOrderDigest: string;
  readonly personalPlanAndOrdinaryTokenHubEvidenceSubstitutionCount: 0;
  readonly crossRegionCredentialOrEntitlementSubstitutionCount: 0;
  readonly checkedAt: string;
  readonly expiresAt: string;
} & (
  | {
      readonly fundingMode: "enterprise_professional_points";
      readonly subject: TencentEnterpriseTokenPlanFundingSubjectV20 & {
        readonly productEdition: "enterprise_professional_points";
      };
      readonly pointsPoolEntitlement: ReceiptRef<
        "receipt:tencent-enterprise-token-plan-points-pool-entitlement@20",
        TencentEnterpriseTokenPlanFundingSubjectV20
      >;
      readonly tokenPoolEntitlement?: never;
      readonly quotaExhaustionDisposition: "hard_stop_or_continue_only_under_exact_enterprise_contract_policy";
    }
  | {
      readonly fundingMode: "enterprise_auto_token_pool";
      readonly subject: TencentEnterpriseTokenPlanFundingSubjectV20 & {
        readonly productEdition: "enterprise_auto_token_pool";
      };
      readonly pointsPoolEntitlement?: never;
      readonly tokenPoolEntitlement: ReceiptRef<
        "receipt:tencent-enterprise-token-plan-token-pool-entitlement@20",
        TencentEnterpriseTokenPlanFundingSubjectV20
      >;
      readonly quotaExhaustionDisposition: "hard_stop_at_monthly_token_pool_exhaustion";
    }
);

declare function observeTencentEnterpriseTokenPlanFundingClosureV20<
  const S extends TencentEnterpriseTokenPlanFundingSubjectV20,
  const M extends S["productEdition"],
>(input: {
  readonly subject: S;
  readonly fundingMode: M;
  readonly exactPlanEndpointAndCredentialRecipient: ImportedOpaqueEvidenceLeafReceipt;
  readonly authoritativeEnterpriseEntitlementUsageAndBillingEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly poolNativeUnitAndDeductionOrder: ImportedOpaqueEvidenceLeafReceipt;
  readonly exactEditionEntitlement: M extends "enterprise_professional_points"
    ? ReceiptRef<"receipt:tencent-enterprise-token-plan-points-pool-entitlement@20", S>
    : ReceiptRef<"receipt:tencent-enterprise-token-plan-token-pool-entitlement@20", S>;
  readonly checkedAt: string;
  readonly expiresAt: string;
}): DeepFrozenCommittedReceiptV1<
  Extract<TencentEnterpriseTokenPlanFundingClosureReceiptV20, { readonly fundingMode: M }> & {
    readonly subject: S;
  }
>;

type ReferenceOnboardingAvailabilityForRequirementV5<R extends { readonly requirementKey: string }> =
  R extends { readonly ownerOnboardingAvailability: "existing_connection_migration_only" }
    ? "existing_connection_migration_only"
    : R extends { readonly ownerOnboardingAvailability: "fresh_onboarding" }
      ? "fresh_onboarding_default"
      : R["requirementKey"] extends "hunyuan.cn"
    ? "existing_connection_migration_only"
    : "fresh_onboarding_default";

interface ReferenceRequirementV3 {
  readonly requirementKey: string;
  readonly entryKey: string;
  readonly productId: string;
  readonly categoryKey: ReferenceCategoryKeyV3;
  readonly realmClass: "china_mainland" | "global" | "local";
  readonly platformScope: ReferencePlatformScopeV3;
  readonly surfaceKind: ReferenceSurfaceKindV3;
  readonly protocolProfile: ReferenceProtocolProfileV3;
  readonly authKind: AuthSource["kind"];
  readonly connectionOracle: ReferenceExactConnectionOracleRowProjectionV7;
  readonly authProfile: ReferenceExactAuthPolicyV6;
  readonly providerWireProfile: ReferenceExactWirePolicyV6;
  readonly optionalAuthPolicy: ReferenceOptionalAuthPolicyV6;
  readonly liveDependencyClass: ReferenceLiveDependencyClassV7;
  readonly liveQualificationMode: ReferenceLiveQualificationModeV6;
  readonly onboardingAvailability:
    | "fresh_onboarding_default"
    | "existing_connection_migration_only";
  readonly fundingTier: GaFundingTier;
  readonly journeyKey: string;
  readonly journeyTier: ReferenceJourneyTierV3;
  readonly onboardingRecipe: ReferenceOnboardingRecipeV1;
  readonly requiredRuntimeStates: readonly ReferenceRuntimeStateV3[];
  readonly runtimeStateClassifications: Readonly<
    Partial<
      Record<
        ReferenceRuntimeStateV3,
        {
          readonly state: ReferenceRuntimeStateV3;
          readonly stateClass: ReferenceRuntimeStateClassV5;
        }
      >
    >
  >;
  readonly requiredStartingAccountStates: NonEmptyReadonly<ReferenceStartingAccountStateV3>;
  readonly journeyGraph: ReferenceJourneyGraphV3;
  readonly stateAssertionPlan: Readonly<
    Partial<
      Record<
      ReferenceRuntimeStateV3,
      | {
          readonly state: ReferenceRuntimeStateV3;
          readonly assertionMode: ReferenceRuntimeStateAssertionModeV4;
          readonly source: ReferenceRuntimeStateProducerV3;
        }
      | undefined
      >
    >
  >;
  readonly ecosystemTier: GaRequiredEcosystemTier;
  readonly releaseMaturity: GaRequiredReleaseMaturity;
}

type ReferenceRequirementInputV3 = Omit<
  ReferenceRequirementV3,
  | "requiredStartingAccountStates"
  | "journeyGraph"
  | "stateAssertionPlan"
  | "runtimeStateClassifications"
  | "connectionOracle"
  | "authProfile"
  | "providerWireProfile"
  | "optionalAuthPolicy"
  | "liveDependencyClass"
  | "liveQualificationMode"
  | "onboardingAvailability"
>;

const RECIPE_GUIDED_KEY_V1 = {
  recipeClass: "guided_static_key",
  passiveInputs: ["release_pinned_official_preset"],
  fields: [
    { fieldId: "api_key", classification: "secret", source: "manual_secret_broker_entry", required: true, persistedAs: "secret_broker_handle", uxMetricClass: "secret" },
  ],
  activeValidationSequence: ["credential_free_metadata_if_supported", "current_rights_and_funding_check", "staged_conformance", "safe_restart_or_rebind", "live_conformance", "capability_and_readiness_projection"],
  recoveryStates: ["auth_missing", "auth_expired_or_revoked", "rights_or_quota_blocked", "network_or_proxy_blocked", "leave_and_return"],
  journeyGraph: JOURNEY_GRAPH_GUIDED_KEY_V3,
  requiredStartingAccountStates: JOURNEY_GRAPH_GUIDED_KEY_V3.requiredStartingAccountStates,
  returnFocusPolicy: "resume_exact_source_card_v1",
  onePrimaryActionPerUserTriggeredStateAndNoneForAutomaticState: true,
  neverReadsThirdPartySecretStore: true,
} as const satisfies ReferenceOnboardingRecipeV1;

const RECIPE_EXISTING_CONNECTION_MIGRATION_ONLY_V8 = {
  recipeClass: "existing_connection_migration_only",
  passiveInputs: ["legacy_connection_metadata_and_broker_handle"],
  fields: [],
  activeValidationSequence: [
    "legacy_connection_read_only_validation",
    "migration_destination_qualification",
    "legacy_connection_retirement_or_read_only_retention",
  ],
  recoveryStates: ["auth_expired_or_revoked", "network_or_proxy_blocked", "endpoint_or_protocol_mismatch", "configuration_drift"],
  journeyGraph: JOURNEY_GRAPH_EXISTING_CONNECTION_MIGRATION_ONLY_V8,
  requiredStartingAccountStates: JOURNEY_GRAPH_EXISTING_CONNECTION_MIGRATION_ONLY_V8.requiredStartingAccountStates,
  returnFocusPolicy: "resume_exact_source_card_v1",
  onePrimaryActionPerUserTriggeredStateAndNoneForAutomaticState: true,
  neverReadsThirdPartySecretStore: true,
  accountCreationBillingActivationCredentialCreationAndFreshPickerActionCount: 0,
  acceptsOnlyExistingLegacyConnectionMetadataAndExistingBrokerHandle: true,
} as const satisfies ReferenceOnboardingRecipeV1;

const RECIPE_LOCAL_ZERO_V1 = {
  recipeClass: "local_zero_config",
  passiveInputs: ["signed_binary_and_version", "known_loopback_listener_metadata", "public_cli_config_metadata"],
  fields: [],
  activeValidationSequence: ["peer_identity_challenge", "credential_free_metadata_if_supported", "current_rights_and_funding_check", "staged_conformance", "safe_restart_or_rebind", "live_conformance", "capability_and_readiness_projection"],
  recoveryStates: ["not_installed", "not_running", "model_missing_or_cold", "endpoint_or_protocol_mismatch", "configuration_drift"],
  journeyGraph: JOURNEY_GRAPH_LOCAL_V3,
  requiredStartingAccountStates: JOURNEY_GRAPH_LOCAL_V3.requiredStartingAccountStates,
  returnFocusPolicy: "resume_exact_source_card_v1",
  onePrimaryActionPerUserTriggeredStateAndNoneForAutomaticState: true,
  neverReadsThirdPartySecretStore: true,
} as const satisfies ReferenceOnboardingRecipeV1;

const RECIPE_WORKLOAD_V1 = {
  recipeClass: "workload_identity",
  passiveInputs: ["release_pinned_official_preset", "os_identity_metadata", "public_cli_config_metadata"],
  fields: [
    { fieldId: "account_or_principal", classification: "public_configuration", source: "explicit_user_selection", required: true, persistedAs: "public_profile", uxMetricClass: "accountOrPrincipal" },
    { fieldId: "region", classification: "public_configuration", source: "explicit_user_selection", required: true, persistedAs: "public_profile", uxMetricClass: "regionOrLocation" },
  ],
  activeValidationSequence: ["current_rights_and_funding_check", "staged_conformance", "safe_restart_or_rebind", "live_conformance", "capability_and_readiness_projection"],
  recoveryStates: ["auth_missing", "auth_expired_or_revoked", "rights_or_quota_blocked", "network_or_proxy_blocked", "leave_and_return"],
  journeyGraph: JOURNEY_GRAPH_ENTERPRISE_WORKLOAD_V3,
  requiredStartingAccountStates: JOURNEY_GRAPH_ENTERPRISE_WORKLOAD_V3.requiredStartingAccountStates,
  returnFocusPolicy: "resume_exact_source_card_v1",
  onePrimaryActionPerUserTriggeredStateAndNoneForAutomaticState: true,
  neverReadsThirdPartySecretStore: true,
} as const satisfies ReferenceOnboardingRecipeV1;

const RECIPE_BROWSER_OAUTH_V1 = {
  recipeClass: "browser_oauth",
  passiveInputs: ["release_pinned_official_preset", "os_identity_metadata", "public_cli_config_metadata"],
  fields: [],
  activeValidationSequence: ["current_rights_and_funding_check", "staged_conformance", "safe_restart_or_rebind", "live_conformance", "capability_and_readiness_projection"],
  recoveryStates: ["auth_missing", "auth_expired_or_revoked", "rights_or_quota_blocked", "network_or_proxy_blocked", "leave_and_return"],
  journeyGraph: JOURNEY_GRAPH_OAUTH_V3,
  requiredStartingAccountStates: JOURNEY_GRAPH_OAUTH_V3.requiredStartingAccountStates,
  returnFocusPolicy: "resume_exact_source_card_v1",
  onePrimaryActionPerUserTriggeredStateAndNoneForAutomaticState: true,
  neverReadsThirdPartySecretStore: true,
} as const satisfies ReferenceOnboardingRecipeV1;

const RECIPE_EXECUTION_STDIO_V1 = {
  recipeClass: "execution_stdio",
  passiveInputs: ["signed_binary_and_version", "public_cli_config_metadata"],
  fields: [],
  activeValidationSequence: ["peer_identity_challenge", "current_rights_and_funding_check", "staged_conformance", "safe_restart_or_rebind", "live_conformance", "capability_and_readiness_projection"],
  recoveryStates: ["not_installed", "auth_missing", "auth_expired_or_revoked", "rights_or_quota_blocked", "leave_and_return", "delivery_unknown", "configuration_drift"],
  journeyGraph: JOURNEY_GRAPH_EXECUTION_V3,
  requiredStartingAccountStates: JOURNEY_GRAPH_EXECUTION_V3.requiredStartingAccountStates,
  returnFocusPolicy: "resume_exact_source_card_v1",
  onePrimaryActionPerUserTriggeredStateAndNoneForAutomaticState: true,
  neverReadsThirdPartySecretStore: true,
} as const satisfies ReferenceOnboardingRecipeV1;

const RECIPE_EXECUTION_LOCAL_STDIO_V1 = {
  ...RECIPE_EXECUTION_STDIO_V1,
  journeyGraph: JOURNEY_GRAPH_CLI_STDIO_READY_V4,
  requiredStartingAccountStates: JOURNEY_GRAPH_CLI_STDIO_READY_V4.requiredStartingAccountStates,
  recoveryStates: ["not_installed", "not_running", "auth_missing", "endpoint_or_protocol_mismatch", "delivery_unknown", "configuration_drift"],
} as const satisfies ReferenceOnboardingRecipeV1;

const RECIPE_CUSTOM_ENDPOINT_V1 = {
  recipeClass: "custom_endpoint",
  passiveInputs: ["public_cli_config_metadata"],
  fields: [
    { fieldId: "base_url", classification: "public_configuration", source: "explicit_user_selection", required: true, persistedAs: "public_profile", uxMetricClass: "baseUrl" },
    { fieldId: "protocol", classification: "public_configuration", source: "explicit_user_selection", required: true, persistedAs: "public_profile", uxMetricClass: "protocol" },
    { fieldId: "model_or_deployment", classification: "public_configuration", source: "explicit_user_selection", required: true, persistedAs: "public_profile", uxMetricClass: "modelOrDeployment" },
    { fieldId: "api_key", classification: "secret", source: "manual_secret_broker_entry", required: true, persistedAs: "secret_broker_handle", uxMetricClass: "secret" },
  ],
  activeValidationSequence: ["credential_free_metadata_if_supported", "current_rights_and_funding_check", "staged_conformance", "safe_restart_or_rebind", "live_conformance", "capability_and_readiness_projection"],
  recoveryStates: ["auth_missing", "auth_expired_or_revoked", "network_or_proxy_blocked", "endpoint_or_protocol_mismatch", "configuration_drift"],
  journeyGraph: JOURNEY_GRAPH_CUSTOM_V3,
  requiredStartingAccountStates: JOURNEY_GRAPH_CUSTOM_V3.requiredStartingAccountStates,
  returnFocusPolicy: "resume_exact_source_card_v1",
  onePrimaryActionPerUserTriggeredStateAndNoneForAutomaticState: true,
  neverReadsThirdPartySecretStore: true,
} as const satisfies ReferenceOnboardingRecipeV1;

const RECIPE_BROWSER_KEY_V1 = {
  ...RECIPE_GUIDED_KEY_V1,
  recipeClass: "browser_key_exchange",
  fields: [],
  passiveInputs: ["release_pinned_official_preset", "public_cli_config_metadata"],
  journeyGraph: JOURNEY_GRAPH_BROWSER_KEY_V3,
  requiredStartingAccountStates: JOURNEY_GRAPH_BROWSER_KEY_V3.requiredStartingAccountStates,
} as const satisfies ReferenceOnboardingRecipeV1;

const RECIPE_AZURE_KEY_V1 = {
  ...RECIPE_WORKLOAD_V1,
  recipeClass: "guided_static_key",
  journeyGraph: JOURNEY_GRAPH_GUIDED_KEY_V3,
  requiredStartingAccountStates: JOURNEY_GRAPH_GUIDED_KEY_V3.requiredStartingAccountStates,
  fields: [
    { fieldId: "api_key", classification: "secret", source: "manual_secret_broker_entry", required: true, persistedAs: "secret_broker_handle", uxMetricClass: "secret" },
    { fieldId: "account_or_principal", classification: "public_configuration", source: "explicit_user_selection", required: true, persistedAs: "public_profile", uxMetricClass: "accountOrPrincipal" },
    { fieldId: "model_or_deployment", classification: "public_configuration", source: "explicit_user_selection", required: true, persistedAs: "public_profile", uxMetricClass: "modelOrDeployment" },
  ],
} as const satisfies ReferenceOnboardingRecipeV1;

const RECIPE_AZURE_OAUTH_V1 = {
  ...RECIPE_BROWSER_OAUTH_V1,
  journeyGraph: JOURNEY_GRAPH_ENTERPRISE_V3,
  requiredStartingAccountStates: JOURNEY_GRAPH_ENTERPRISE_V3.requiredStartingAccountStates,
  fields: [
    { fieldId: "account_or_principal", classification: "public_configuration", source: "explicit_user_selection", required: true, persistedAs: "public_profile", uxMetricClass: "accountOrPrincipal" },
    { fieldId: "model_or_deployment", classification: "public_configuration", source: "explicit_user_selection", required: true, persistedAs: "public_profile", uxMetricClass: "modelOrDeployment" },
  ],
} as const satisfies ReferenceOnboardingRecipeV1;

const RECIPE_AZURE_WORKLOAD_V1 = {
  ...RECIPE_WORKLOAD_V1,
  fields: [
    ...RECIPE_WORKLOAD_V1.fields,
    { fieldId: "model_or_deployment", classification: "public_configuration", source: "explicit_user_selection", required: true, persistedAs: "public_profile", uxMetricClass: "modelOrDeployment" },
  ],
} as const satisfies ReferenceOnboardingRecipeV1;

const RECIPE_BEDROCK_API_KEY_V1 = {
  ...RECIPE_GUIDED_KEY_V1,
  journeyGraph: JOURNEY_GRAPH_GUIDED_KEY_V3,
  requiredStartingAccountStates: JOURNEY_GRAPH_GUIDED_KEY_V3.requiredStartingAccountStates,
  fields: [
    ...RECIPE_GUIDED_KEY_V1.fields,
    { fieldId: "region", classification: "public_configuration", source: "explicit_user_selection", required: true, persistedAs: "public_profile", uxMetricClass: "regionOrLocation" },
    { fieldId: "model_or_deployment", classification: "public_configuration", source: "explicit_user_selection", required: true, persistedAs: "public_profile", uxMetricClass: "modelOrDeployment" },
  ],
} as const satisfies ReferenceOnboardingRecipeV1;

const RECIPE_AWS_PROFILE_V1 = {
  ...RECIPE_WORKLOAD_V1,
  recipeClass: "aws_named_profile",
  journeyGraph: JOURNEY_GRAPH_ENTERPRISE_PROFILE_V3,
  requiredStartingAccountStates: JOURNEY_GRAPH_ENTERPRISE_PROFILE_V3.requiredStartingAccountStates,
  fields: [
    { fieldId: "profile", classification: "credential_handle", source: "os_credential_or_identity_broker", required: true, persistedAs: "identity_broker_handle", uxMetricClass: "credentialHandle" },
    { fieldId: "region", classification: "public_configuration", source: "explicit_user_selection", required: true, persistedAs: "public_profile", uxMetricClass: "regionOrLocation" },
  ],
} as const satisfies ReferenceOnboardingRecipeV1;

const RECIPE_AWS_SSO_V1 = {
  ...RECIPE_AWS_PROFILE_V1,
  recipeClass: "aws_sso",
  journeyGraph: JOURNEY_GRAPH_ENTERPRISE_V3,
  requiredStartingAccountStates: JOURNEY_GRAPH_ENTERPRISE_V3.requiredStartingAccountStates,
  recoveryStates: ["auth_missing", "auth_expired_or_revoked", "rights_or_quota_blocked", "network_or_proxy_blocked", "leave_and_return"],
} as const satisfies ReferenceOnboardingRecipeV1;

const RECIPE_EXECUTION_HTTP_V1 = {
  ...RECIPE_EXECUTION_STDIO_V1,
  recipeClass: "execution_loopback_http",
  journeyGraph: JOURNEY_GRAPH_EXECUTION_HTTP_V3,
  requiredStartingAccountStates: JOURNEY_GRAPH_EXECUTION_HTTP_V3.requiredStartingAccountStates,
  passiveInputs: ["signed_binary_and_version", "known_loopback_listener_metadata", "public_cli_config_metadata"],
  fields: [
    { fieldId: "server_username", classification: "public_configuration", source: "explicit_user_selection", trustedPublicDefault: "opencode", required: false, requiredWhen: { observationStepId: "observe-server-auth-challenge", discriminator: "password_required", otherwiseFieldMustBeAbsent: true }, persistedAs: "public_profile", uxMetricClass: "accountOrPrincipal" },
    { fieldId: "server_password", classification: "secret", source: "manual_secret_broker_entry", required: false, requiredWhen: { observationStepId: "observe-server-auth-challenge", discriminator: "password_required", otherwiseFieldMustBeAbsent: true }, persistedAs: "secret_broker_handle", uxMetricClass: "secret" },
  ],
  recoveryStates: ["not_installed", "not_running", "auth_missing", "endpoint_or_protocol_mismatch", "leave_and_return", "delivery_unknown", "configuration_drift"],
} as const satisfies ReferenceOnboardingRecipeV1;

const RECIPE_BRIDGE_V1 = {
  ...RECIPE_LOCAL_ZERO_V1,
  recipeClass: "cc_switch_public_proxy",
  journeyGraph: JOURNEY_GRAPH_CC_SWITCH_PROXY_V6,
  requiredStartingAccountStates: JOURNEY_GRAPH_CC_SWITCH_PROXY_V6.requiredStartingAccountStates,
  fields: [],
  recoveryStates: ["not_running", "endpoint_or_protocol_mismatch", "configuration_drift"],
} as const satisfies ReferenceOnboardingRecipeV1;

const RECIPE_LMSTUDIO_OPTIONAL_AUTH_V6 = {
  ...RECIPE_LOCAL_ZERO_V1,
  recipeClass: "local_optional_bearer",
  journeyGraph: JOURNEY_GRAPH_LOCAL_OPTIONAL_BEARER_V6,
  requiredStartingAccountStates: JOURNEY_GRAPH_LOCAL_OPTIONAL_BEARER_V6.requiredStartingAccountStates,
  fields: [
    { fieldId: "api_key", classification: "secret", source: "manual_secret_broker_entry", required: false, requiredWhen: { observationStepId: "observe-local-auth-challenge", discriminator: "bearer_required", otherwiseFieldMustBeAbsent: true }, persistedAs: "secret_broker_handle", uxMetricClass: "secret" },
  ],
  recoveryStates: ["not_running", "model_missing_or_cold", "endpoint_or_protocol_mismatch", "configuration_drift"],
} as const satisfies ReferenceOnboardingRecipeV1;

const RECIPE_LMSTUDIO_MESSAGES_OPTIONAL_AUTH_V9 = {
  ...RECIPE_LOCAL_ZERO_V1,
  recipeClass: "local_optional_anthropic_auth",
  journeyGraph: JOURNEY_GRAPH_LOCAL_OPTIONAL_ANTHROPIC_AUTH_V9,
  requiredStartingAccountStates: JOURNEY_GRAPH_LOCAL_OPTIONAL_ANTHROPIC_AUTH_V9.requiredStartingAccountStates,
  fields: [
    { fieldId: "api_key", classification: "secret", source: "manual_secret_broker_entry", required: false, requiredWhen: { observationStepId: "observe-local-auth-challenge", discriminator: "secret_required", otherwiseFieldMustBeAbsent: true }, persistedAs: "secret_broker_handle", uxMetricClass: "secret" },
  ],
  recoveryStates: ["not_running", "model_missing_or_cold", "endpoint_or_protocol_mismatch", "configuration_drift"],
} as const satisfies ReferenceOnboardingRecipeV1;

const RECIPE_BRIDGE_OPENAI_V1 = {
  ...RECIPE_LOCAL_ZERO_V1,
  recipeClass: "bridge_loopback_control",
  journeyGraph: JOURNEY_GRAPH_BRIDGE_OPENAI_V4,
  requiredStartingAccountStates: JOURNEY_GRAPH_BRIDGE_OPENAI_V4.requiredStartingAccountStates,
  fields: [
    { fieldId: "api_key", classification: "secret", source: "manual_secret_broker_entry", required: false, requiredWhen: { observationStepId: "observe-bridge-auth-challenge", discriminator: "secret_required", otherwiseFieldMustBeAbsent: true }, persistedAs: "secret_broker_handle", uxMetricClass: "secret" },
  ],
  recoveryStates: ["not_running", "auth_missing", "endpoint_or_protocol_mismatch", "delivery_unknown", "configuration_drift"],
} as const satisfies ReferenceOnboardingRecipeV1;

const RECIPE_LOCAL_MANAGED_V1 = {
  ...RECIPE_LOCAL_ZERO_V1,
  recipeClass: "local_managed_service",
} as const satisfies ReferenceOnboardingRecipeV1;

const RECIPE_CUSTOM_MTLS_V1 = {
  ...RECIPE_CUSTOM_ENDPOINT_V1,
  recipeClass: "custom_mtls",
  fields: [
    { fieldId: "base_url", classification: "public_configuration", source: "explicit_user_selection", required: true, persistedAs: "public_profile", uxMetricClass: "baseUrl" },
    { fieldId: "protocol", classification: "public_configuration", source: "explicit_user_selection", required: true, persistedAs: "public_profile", uxMetricClass: "protocol" },
    { fieldId: "model_or_deployment", classification: "public_configuration", source: "explicit_user_selection", required: true, persistedAs: "public_profile", uxMetricClass: "modelOrDeployment" },
    { fieldId: "client_certificate", classification: "credential_handle", source: "os_credential_or_identity_broker", required: true, persistedAs: "identity_broker_handle", uxMetricClass: "credentialHandle" },
    { fieldId: "client_private_key_handle", classification: "credential_handle", source: "os_credential_or_identity_broker", required: true, persistedAs: "identity_broker_handle", uxMetricClass: "credentialHandle" },
  ],
} as const satisfies ReferenceOnboardingRecipeV1;

const RECIPE_CUSTOM_SECRET_HEADER_V1 = {
  ...RECIPE_CUSTOM_ENDPOINT_V1,
  fields: [
    { fieldId: "base_url", classification: "public_configuration", source: "explicit_user_selection", required: true, persistedAs: "public_profile", uxMetricClass: "baseUrl" },
    { fieldId: "protocol", classification: "public_configuration", source: "explicit_user_selection", required: true, persistedAs: "public_profile", uxMetricClass: "protocol" },
    { fieldId: "model_or_deployment", classification: "public_configuration", source: "explicit_user_selection", required: true, persistedAs: "public_profile", uxMetricClass: "modelOrDeployment" },
    { fieldId: "custom_secret_header_name", classification: "public_configuration", source: "explicit_user_selection", required: true, persistedAs: "public_profile", uxMetricClass: "customHeaderName" },
    { fieldId: "custom_secret_header_value", classification: "secret", source: "manual_secret_broker_entry", required: true, persistedAs: "secret_broker_handle", uxMetricClass: "secret" },
  ],
} as const satisfies ReferenceOnboardingRecipeV1;

const RECIPE_ANCHOR_V1 = {
  recipeClass: "anchor_control",
  passiveInputs: ["os_identity_metadata"],
  fields: [],
  activeValidationSequence: ["current_rights_and_funding_check", "staged_conformance", "safe_restart_or_rebind", "live_conformance", "capability_and_readiness_projection"],
  recoveryStates: ["rights_or_quota_blocked", "network_or_proxy_blocked", "leave_and_return", "delivery_unknown", "configuration_drift"],
  journeyGraph: JOURNEY_GRAPH_ANCHOR_V3,
  requiredStartingAccountStates: JOURNEY_GRAPH_ANCHOR_V3.requiredStartingAccountStates,
  returnFocusPolicy: "resume_exact_source_card_v1",
  onePrimaryActionPerUserTriggeredStateAndNoneForAutomaticState: true,
  neverReadsThirdPartySecretStore: true,
} as const satisfies ReferenceOnboardingRecipeV1;

const REFERENCE_RUNTIME_STATE_SOURCE_DECLARATIONS_V4 = {
  api_disabled: { producerKind: "authoritative_precondition_observation", observationProfileDigest: "profile:runtime-api-disabled" },
  api_off: { producerKind: "authoritative_precondition_observation", observationProfileDigest: "profile:runtime-api-off" },
  authoritative_funding_mode_observed: { producerKind: "active_validation", validationStep: "current_rights_and_funding_check" },
  auth_optional: { producerKind: "active_validation", validationStep: "current_rights_and_funding_check" },
  beijing_realm_verified: { producerKind: "active_validation", validationStep: "current_rights_and_funding_check" },
  benefit_balance_verified: { producerKind: "active_validation", validationStep: "current_rights_and_funding_check" },
  browser_login: { producerKind: "external_task", journeyStepId: "login" },
  browser_return: { producerKind: "external_task", journeyStepId: "browser-key-exchange" },
  certificate_selected: { producerKind: "manual_field", fieldId: "client_certificate" },
  china_realm_verified: { producerKind: "active_validation", validationStep: "current_rights_and_funding_check" },
  cold: { producerKind: "authoritative_precondition_observation", observationProfileDigest: "profile:runtime-model-cold" },
  continuity_lost: { producerKind: "authoritative_precondition_observation", observationProfileDigest: "profile:anchor-continuity-lost" },
  credits_verified: { producerKind: "active_validation", validationStep: "current_rights_and_funding_check" },
  deployment_selected: { producerKind: "manual_field", fieldId: "model_or_deployment" },
  disabled: { producerKind: "authoritative_precondition_observation", observationProfileDigest: "profile:runtime-disabled" },
  endpoint_model_verified: { producerKind: "active_validation", validationStep: "live_conformance" },
  enrolling: { producerKind: "journey_action", journeyStepId: "enroll-anchor" },
  enterprise_plan_edition_verified: { producerKind: "active_validation", validationStep: "current_rights_and_funding_check" },
  extra_usage_state_verified: { producerKind: "active_validation", validationStep: "current_rights_and_funding_check" },
  failover_opaque: { producerKind: "active_validation", validationStep: "current_rights_and_funding_check" },
  failover_unknown: { producerKind: "authoritative_runtime_terminal", terminalProfileDigest: "profile:failover-delivery-unknown" },
  global_realm_verified: { producerKind: "active_validation", validationStep: "current_rights_and_funding_check" },
  header_policy_verified: { producerKind: "manual_field", fieldId: "custom_secret_header_name" },
  identity_ready: { producerKind: "active_validation", validationStep: "current_rights_and_funding_check" },
  international_realm_verified: { producerKind: "active_validation", validationStep: "current_rights_and_funding_check" },
  key_committed: { producerKind: "external_task", journeyStepId: "browser-key-exchange" },
  leave_and_return: { producerKind: "external_task", journeyStepId: "login" },
  manual_config: { producerKind: "manual_field", fieldId: "base_url" },
  membership_tier_verified: { producerKind: "active_validation", validationStep: "current_rights_and_funding_check" },
  model_catalog_verified: { producerKind: "active_validation", validationStep: "credential_free_metadata_if_supported" },
  model_eligibility_verified: { producerKind: "active_validation", validationStep: "current_rights_and_funding_check" },
  model_protocol_assignment_verified: { producerKind: "active_validation", validationStep: "capability_and_readiness_projection" },
  model_service_enabled: { producerKind: "active_validation", validationStep: "current_rights_and_funding_check" },
  no_model: { producerKind: "authoritative_precondition_observation", observationProfileDigest: "profile:runtime-model-absent" },
  not_enrolled: { producerKind: "authoritative_precondition_observation", observationProfileDigest: "profile:anchor-not-enrolled" },
  not_installed: { producerKind: "authoritative_precondition_observation", observationProfileDigest: "profile:signed-binary-not-installed" },
  not_running: { producerKind: "authoritative_precondition_observation", observationProfileDigest: "profile:runtime-not-running" },
  offline: { producerKind: "authoritative_precondition_observation", observationProfileDigest: "profile:runtime-offline" },
  overage_disabled: { producerKind: "active_validation", validationStep: "current_rights_and_funding_check" },
  overage_policy_verified: { producerKind: "active_validation", validationStep: "current_rights_and_funding_check" },
  overage_zen_balance_enabled: { producerKind: "active_validation", validationStep: "current_rights_and_funding_check" },
  password_optional: { producerKind: "auth_challenge_observation", journeyStepId: "observe-server-auth-challenge", challengeDiscriminator: "password_required" },
  port_conflict: { producerKind: "authoritative_precondition_observation", observationProfileDigest: "profile:runtime-port-conflict" },
  private_key_handle_ready: { producerKind: "manual_field", fieldId: "client_private_key_handle" },
  profile_selected: { producerKind: "manual_field", fieldId: "profile" },
  proxy_blocked: { producerKind: "authoritative_precondition_observation", observationProfileDigest: "profile:runtime-proxy-blocked" },
  ready: { producerKind: "active_validation", validationStep: "capability_and_readiness_projection" },
  real_user_agent_preserved: { producerKind: "active_validation", validationStep: "staged_conformance" },
  region_selected: { producerKind: "manual_field", fieldId: "region" },
  region_verified: { producerKind: "active_validation", validationStep: "current_rights_and_funding_check" },
  renewal: { producerKind: "active_validation", validationStep: "current_rights_and_funding_check" },
  role_assumed: { producerKind: "active_validation", validationStep: "current_rights_and_funding_check" },
  rotation: { producerKind: "active_validation", validationStep: "current_rights_and_funding_check" },
  route_drift: { producerKind: "authoritative_precondition_observation", observationProfileDigest: "profile:runtime-route-drift" },
  route_opaque: { producerKind: "active_validation", validationStep: "current_rights_and_funding_check" },
  route_ready: { producerKind: "active_validation", validationStep: "capability_and_readiness_projection" },
  secret_optional: { producerKind: "auth_challenge_observation", journeyStepId: "observe-bridge-auth-challenge", challengeDiscriminator: "secret_required" },
  secret_broker_handle_ready: { producerKind: "manual_field", fieldId: "custom_secret_header_value" },
  session_recovery: { producerKind: "authoritative_runtime_terminal", terminalProfileDigest: "profile:session-recovery-transition" },
  signed_out: { producerKind: "authoritative_precondition_observation", observationProfileDigest: "profile:principal-signed-out" },
  signing_identity_ready: { producerKind: "active_validation", validationStep: "current_rights_and_funding_check" },
  singapore_realm_verified: { producerKind: "active_validation", validationStep: "current_rights_and_funding_check" },
  stopped: { producerKind: "authoritative_precondition_observation", observationProfileDigest: "profile:runtime-stopped" },
  subscription_verified: { producerKind: "active_validation", validationStep: "current_rights_and_funding_check" },
  subscription_pool_verified: { producerKind: "active_validation", validationStep: "current_rights_and_funding_check" },
  text_only: { producerKind: "active_validation", validationStep: "capability_and_readiness_projection" },
  threshold_partial: { producerKind: "authoritative_precondition_observation", observationProfileDigest: "profile:witness-threshold-partial" },
  tools_by_model: { producerKind: "active_validation", validationStep: "capability_and_readiness_projection" },
  unsupported_version: { producerKind: "authoritative_precondition_observation", observationProfileDigest: "profile:runtime-version-unsupported" },
  verified: { producerKind: "active_validation", validationStep: "live_conformance" },
  warm: { producerKind: "active_validation", validationStep: "live_conformance" },
} as const satisfies Record<ReferenceRuntimeStateV3, ReferenceRuntimeStateProducerV3>;

const REFERENCE_RUNTIME_STATE_ASSERTION_MODE_V4 = {
  api_disabled: "observes_precondition",
  api_off: "observes_precondition",
  authoritative_funding_mode_observed: "proves_postcondition",
  auth_optional: "proves_postcondition",
  beijing_realm_verified: "proves_postcondition",
  benefit_balance_verified: "proves_postcondition",
  browser_login: "causes_transition",
  browser_return: "proves_postcondition",
  certificate_selected: "proves_postcondition",
  china_realm_verified: "proves_postcondition",
  cold: "observes_precondition",
  continuity_lost: "observes_precondition",
  credits_verified: "proves_postcondition",
  deployment_selected: "proves_postcondition",
  disabled: "observes_precondition",
  endpoint_model_verified: "proves_postcondition",
  enrolling: "causes_transition",
  enterprise_plan_edition_verified: "proves_postcondition",
  extra_usage_state_verified: "proves_postcondition",
  failover_opaque: "proves_postcondition",
  failover_unknown: "observes_precondition",
  global_realm_verified: "proves_postcondition",
  header_policy_verified: "proves_postcondition",
  identity_ready: "proves_postcondition",
  international_realm_verified: "proves_postcondition",
  key_committed: "proves_postcondition",
  leave_and_return: "causes_transition",
  manual_config: "proves_postcondition",
  membership_tier_verified: "proves_postcondition",
  model_catalog_verified: "proves_postcondition",
  model_eligibility_verified: "proves_postcondition",
  model_protocol_assignment_verified: "proves_postcondition",
  model_service_enabled: "proves_postcondition",
  no_model: "observes_precondition",
  not_enrolled: "observes_precondition",
  not_installed: "observes_precondition",
  not_running: "observes_precondition",
  offline: "observes_precondition",
  overage_disabled: "proves_postcondition",
  overage_policy_verified: "proves_postcondition",
  overage_zen_balance_enabled: "proves_postcondition",
  password_optional: "proves_postcondition",
  port_conflict: "observes_precondition",
  private_key_handle_ready: "proves_postcondition",
  profile_selected: "proves_postcondition",
  proxy_blocked: "observes_precondition",
  ready: "proves_postcondition",
  real_user_agent_preserved: "proves_postcondition",
  region_selected: "proves_postcondition",
  region_verified: "proves_postcondition",
  renewal: "causes_transition",
  role_assumed: "proves_postcondition",
  rotation: "causes_transition",
  route_drift: "observes_precondition",
  route_opaque: "proves_postcondition",
  route_ready: "proves_postcondition",
  secret_optional: "proves_postcondition",
  secret_broker_handle_ready: "proves_postcondition",
  session_recovery: "causes_transition",
  signed_out: "observes_precondition",
  signing_identity_ready: "proves_postcondition",
  singapore_realm_verified: "proves_postcondition",
  stopped: "observes_precondition",
  subscription_verified: "proves_postcondition",
  subscription_pool_verified: "proves_postcondition",
  text_only: "proves_postcondition",
  threshold_partial: "observes_precondition",
  tools_by_model: "proves_postcondition",
  unsupported_version: "observes_precondition",
  verified: "proves_postcondition",
  warm: "proves_postcondition",
} as const satisfies Record<ReferenceRuntimeStateV3, ReferenceRuntimeStateAssertionModeV4>;

type ReferenceRuntimeStateClassV5 = "positive" | "transition" | "recovery_required";

type ReferenceRuntimeStateClassForV5<S extends ReferenceRuntimeStateV3> =
  S extends "session_recovery"
    ? "recovery_required"
    : (typeof REFERENCE_RUNTIME_STATE_ASSERTION_MODE_V4)[S] extends "observes_precondition"
      ? "recovery_required"
      : (typeof REFERENCE_RUNTIME_STATE_ASSERTION_MODE_V4)[S] extends "causes_transition"
        ? "transition"
        : "positive";

// 历史V5的state-only resolver只作为持久化迁移schema读取，不在release类型图内重建；
// release deriver只消费下述requirement×state的V6策略，避免两套可执行真相并存。
type ReferenceRecoveryPolicyShapeV6<
  Id extends string,
  G extends ReferenceJourneyGraphV3,
  O extends number,
  Terminal extends string,
> = {
  readonly resolverRuleId: Id;
  readonly recoveryGraph: G;
  readonly firstRecoveryStepOrdinal: O;
  readonly recoveryGraphTerminalStepOrdinal: G["terminalStepOrdinal"];
  readonly requiredTerminalEvidenceProfileId: Terminal;
  readonly recoveryGraphFirstStepAndTerminalAreCompilerSelectedNotRuntimeMetadata: true;
};

type ReferenceLocalRuntimeRecoveryPolicyV6<S extends ReferenceRuntimeStateV3> =
  S extends "not_running" | "stopped" | "disabled" | "api_disabled" | "api_off"
    ? ReferenceRecoveryPolicyShapeV6<
        "local_runtime_external_start",
        typeof JOURNEY_GRAPH_LOCAL_UNMANAGED_RECOVERY_V4,
        1,
        "terminal:local-runtime-peer-live-capability-activation@6"
      >
    : S extends "cold" | "no_model"
      ? ReferenceRecoveryPolicyShapeV6<
          "local_runtime_model_load",
          typeof JOURNEY_GRAPH_LOCAL_UNMANAGED_RECOVERY_V4,
          2,
          "terminal:local-runtime-model-live-capability-activation@6"
        >
      : ReferenceRecoveryPolicyShapeV6<
          "local_runtime_install_or_upgrade",
          typeof JOURNEY_GRAPH_LOCAL_UNMANAGED_RECOVERY_V4,
          0,
          "terminal:local-runtime-peer-live-capability-activation@6"
        >;

type ReferenceRecoveryPolicyForRequirementStateV6<
  R extends ReferenceRequirementRecoverySubjectV5,
  S extends R["requiredRuntimeStates"][number],
> = R["surfaceKind"] extends "execution"
  ? S extends "session_recovery"
    ? ReferenceRecoveryPolicyShapeV6<
        "execution_session_reconciliation",
        typeof JOURNEY_GRAPH_EXECUTION_SESSION_RECOVERY_V6,
        0,
        "terminal:execution-fresh-session-and-completed-turn@6"
      >
    : S extends "not_installed" | "not_running"
      ? ReferenceRecoveryPolicyShapeV6<
          "execution_exact_surface_install_or_start",
          typeof JOURNEY_GRAPH_EXECUTION_INSTALL_RECOVERY_V6,
          0,
          "terminal:execution-exact-surface-handshake@6"
        >
      : S extends "signed_out"
        ? ReferenceRecoveryPolicyShapeV6<
            "execution_upstream_authentication",
            R["onboardingRecipe"]["journeyGraph"],
            0,
            "terminal:execution-upstream-authenticated-session-and-turn@6"
          >
        : ReferenceRecoveryPolicyShapeV6<
            "execution_exact_surface_revalidation",
            R["onboardingRecipe"]["journeyGraph"],
            0,
            "terminal:execution-fresh-session-and-completed-turn@6"
          >
  : R["surfaceKind"] extends "bridge"
    ? S extends "not_running"
      ? ReferenceRecoveryPolicyShapeV6<
          "bridge_exact_service_start",
          typeof JOURNEY_GRAPH_BRIDGE_SERVICE_RECOVERY_V6,
          0,
          "terminal:bridge-exact-route-conformance@6"
        >
      : ReferenceRecoveryPolicyShapeV6<
          "bridge_exact_route_reconciliation",
          typeof JOURNEY_GRAPH_BRIDGE_OPENAI_V4,
          0,
          "terminal:bridge-exact-route-conformance@6"
        >
    : R["surfaceKind"] extends "control_plane"
      ? ReferenceRecoveryPolicyShapeV6<
          "anchor_platform_continuity_recovery",
          typeof JOURNEY_GRAPH_ANCHOR_V3,
          0,
          "terminal:platform-native-anchor-continuity@6"
        >
      : R extends { readonly realmClass: "local" }
        ? ReferenceLocalRuntimeRecoveryPolicyV6<S>
        : S extends "signed_out"
          ? ReferenceRecoveryPolicyShapeV6<
              "provider_exact_principal_reauthentication",
              R["onboardingRecipe"]["journeyGraph"],
              0,
              "terminal:provider-exact-principal-live-conformance@6"
            >
          : ReferenceRecoveryPolicyShapeV6<
              "provider_exact_endpoint_or_proxy_recovery",
              R["onboardingRecipe"]["journeyGraph"],
              0,
              "terminal:provider-exact-principal-live-conformance@6"
            >;

interface ReferenceRequirementRecoverySubjectV5 {
  readonly requirementKey: string;
  readonly entryKey: string;
  readonly journeyKey: string;
  readonly surfaceKind: ReferenceSurfaceKindV3;
  readonly onboardingRecipe: ReferenceOnboardingRecipeV1;
  readonly requiredRuntimeStates: readonly ReferenceRuntimeStateV3[];
}

declare const referenceRuntimeRecoveryScenarioBrandV5: unique symbol;

type ReferenceRuntimeRecoveryScenarioV5<
  R extends ReferenceRequirementRecoverySubjectV5 = ReferenceRequirementRecoverySubjectV5,
  S extends R["requiredRuntimeStates"][number] = R["requiredRuntimeStates"][number],
  P extends ReferenceRecoveryPolicyShapeV6<
    string,
    ReferenceJourneyGraphV3,
    number,
    string
  > = ReferenceRecoveryPolicyForRequirementStateV6<R, S>,
> = ReceiptRef<"receipt:reference-runtime-recovery-scenario@5", readonly [R, S]> & {
  readonly [referenceRuntimeRecoveryScenarioBrandV5]: never;
  readonly referenceRequirement: R;
  readonly runtimeState: S;
  readonly stateClass: "recovery_required";
  readonly resolverRuleId: P["resolverRuleId"];
  readonly resolverRule: P;
  readonly recoveryGraph: P["recoveryGraph"];
  readonly firstRecoveryStepOrdinal: P["firstRecoveryStepOrdinal"];
  readonly recoveryGraphTerminalStepOrdinal: P["recoveryGraphTerminalStepOrdinal"];
  readonly requiredTerminalEvidenceProfileId: P["requiredTerminalEvidenceProfileId"];
  readonly preconditionEvidenceProducer: (typeof REFERENCE_RUNTIME_STATE_SOURCE_DECLARATIONS_V4)[S];
  readonly initialConnectionReadiness: "action_required";
  readonly zeroConfigPassClaimForbiddenBeforeRecoveryTerminal: true;
  readonly successfulRecoveryStillRequiresTheFullPostGraphSuccessChain: true;
  readonly recoveryUxContract: typeof LOCAL_RUNTIME_RECOVERY_UX_CONTRACT_V4;
  readonly provesRequirementStateClassRuleGraphFirstStepPreconditionEvidenceAndTerminalChainExact: true;
};

type ReferenceRuntimeStateClassificationMapForV5<
  R extends ReferenceRequirementRecoverySubjectV5,
> = {
  readonly [S in R["requiredRuntimeStates"][number]]: {
    readonly state: S;
    readonly stateClass: ReferenceRuntimeStateClassForV5<S>;
  };
};

type ReferenceRuntimeRecoveryStateForV5<
  R extends ReferenceRequirementRecoverySubjectV5,
> = {
  [S in R["requiredRuntimeStates"][number]]: ReferenceRuntimeStateClassForV5<S> extends "recovery_required"
    ? S
    : never;
}[R["requiredRuntimeStates"][number]];

type ReferenceRuntimeStateAssertionPlanForV4<
  S extends readonly ReferenceRuntimeStateV3[],
> = {
  readonly [K in S[number]]: {
    readonly state: K;
    readonly assertionMode: (typeof REFERENCE_RUNTIME_STATE_ASSERTION_MODE_V4)[K];
    readonly source: (typeof REFERENCE_RUNTIME_STATE_SOURCE_DECLARATIONS_V4)[K];
  };
};

declare const referenceRuntimeStateAssertionEvidenceSetBrandV4: unique symbol;

interface ReferenceRuntimeStateAssertionEvidenceSetReceiptV4<
  R extends ReferenceRequirementV3 = ReferenceRequirementV3,
> extends ReceiptRef<"receipt:reference-runtime-state-assertion-evidence-set@4", R> {
  readonly [referenceRuntimeStateAssertionEvidenceSetBrandV4]: never;
  readonly referenceRequirement: R;
  readonly exactRunSubjectDigest: string;
  readonly stateMachineArtifact: ReferenceRuntimeStateMachineArtifactV4;
  readonly assertionPlan: R["stateAssertionPlan"];
  readonly assertions: {
    readonly [S in R["requiredRuntimeStates"][number]]: ReferenceRuntimeStateAssertionReceiptV4<
      R,
      S,
      (typeof REFERENCE_RUNTIME_STATE_ASSERTION_MODE_V4)[S]
    >;
  };
  readonly orderedRequiredStateSetDigest: string;
  readonly orderedActualAssertionStateSetDigest: string;
  readonly missingAssertionCount: 0;
  readonly duplicateAssertionCount: 0;
  readonly wrongPolarityOrSourceCount: 0;
  readonly provesRequiredAndActualStatesAreAKeyedBijectionAndEveryReceiptUsesTheCompilerPlan: true;
}

declare function commitReferenceRuntimeStateAssertionEvidenceSetV4<
  R extends ReferenceRequirementV3,
>(input: {
  readonly referenceRequirement: R;
  readonly exactRunSubjectDigest: string;
  readonly stateMachineArtifact: ReferenceRuntimeStateMachineArtifactV4;
  readonly assertions: ReferenceRuntimeStateAssertionEvidenceSetReceiptV4<R>["assertions"];
}): ReferenceRuntimeStateAssertionEvidenceSetReceiptV4<R>;

type ReferenceMigrationOnlyInputConstraintV8<R extends readonly ReferenceRequirementInputV3[]> = {
  readonly [I in keyof R]: R[I] extends { readonly requirementKey: "hunyuan.cn" }
    ? R[I] & {
        readonly journeyTier: "migration_only";
        readonly onboardingRecipe: typeof RECIPE_EXISTING_CONNECTION_MIGRATION_ONLY_V8;
        readonly requiredRuntimeStates: readonly ["china_realm_verified"];
      }
    : R[I];
};

declare function deriveReferenceRequirementsV4<
  const R extends readonly ReferenceRequirementInputV3[],
  const C extends ReferenceExactConnectionOracleForInputsV6<R>,
>(rows: R & ReferenceMigrationOnlyInputConstraintV8<R>, connectionOracle: C): {
  readonly [I in keyof R]: R[I] extends ReferenceRequirementInputV3
    ? R[I] & {
        readonly requiredStartingAccountStates: R[I]["onboardingRecipe"]["requiredStartingAccountStates"];
        readonly journeyGraph: R[I]["onboardingRecipe"]["journeyGraph"];
        readonly stateAssertionPlan: ReferenceRuntimeStateAssertionPlanForV4<
          R[I]["requiredRuntimeStates"]
        >;
        readonly runtimeStateClassifications: ReferenceRuntimeStateClassificationMapForV5<R[I]>;
        readonly connectionOracle: ReferenceExactConnectionOracleRowProjectionV7<
          R[I]["requirementKey"],
          C[R[I]["requirementKey"] & keyof C]["wire"],
          C[R[I]["requirementKey"] & keyof C]["auth"]
        >;
        readonly authProfile: C[R[I]["requirementKey"] & keyof C]["auth"];
        readonly providerWireProfile: C[R[I]["requirementKey"] & keyof C]["wire"];
        readonly optionalAuthPolicy: ReferenceOptionalAuthPolicyForRequirementV6<R[I]>;
        readonly liveDependencyClass: ReferenceLiveDependencyClassForRequirementV7<R[I]>;
        readonly liveQualificationMode: ReferenceLiveQualificationModeForRequirementV6<R[I]>;
        readonly onboardingAvailability: ReferenceOnboardingAvailabilityForRequirementV5<R[I]>;
      }
    : never;
};

const REFERENCE_REQUIREMENT_INPUTS_V3 = [
  { requirementKey: "openai.chat.key", entryKey: "global.openai.chat-completions.api-key", productId: "openai-platform", categoryKey: "global_official_api", realmClass: "global", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_chat_completions", authKind: "bearer", fundingTier: "payg", journeyKey: "openai-chat-completions-api-key", journeyTier: "guided_key", onboardingRecipe: RECIPE_GUIDED_KEY_V1, requiredRuntimeStates: ["warm"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "openai.responses.key", entryKey: "global.openai.responses.api-key", productId: "openai-platform", categoryKey: "global_official_api", realmClass: "global", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_responses", authKind: "bearer", fundingTier: "payg", journeyKey: "openai-responses-api-key", journeyTier: "guided_key", onboardingRecipe: RECIPE_GUIDED_KEY_V1, requiredRuntimeStates: ["warm"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "anthropic.messages.key", entryKey: "global.anthropic.messages.api-key", productId: "anthropic-api", categoryKey: "global_official_api", realmClass: "global", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "anthropic_messages", authKind: "x_api_key", fundingTier: "payg", journeyKey: "anthropic-messages-api-key", journeyTier: "guided_key", onboardingRecipe: RECIPE_GUIDED_KEY_V1, requiredRuntimeStates: ["warm"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "google.genai.key", entryKey: "global.google.genai.api-key", productId: "google-gemini-api", categoryKey: "global_official_api", realmClass: "global", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "google_genai", authKind: "registry_header", fundingTier: "payg", journeyKey: "google-genai-api-key", journeyTier: "guided_key", onboardingRecipe: RECIPE_GUIDED_KEY_V1, requiredRuntimeStates: ["warm"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "vertex.adc", entryKey: "global.google.vertex.adc", productId: "google-vertex-ai", categoryKey: "global_official_api", realmClass: "global", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "google_genai", authKind: "workload_identity", fundingTier: "payg", journeyKey: "google-vertex-adc-file", journeyTier: "enterprise_managed", onboardingRecipe: RECIPE_WORKLOAD_V1, requiredRuntimeStates: ["identity_ready"], ecosystemTier: "L1", releaseMaturity: "builtin_stable" },
  { requirementKey: "vertex.wif", entryKey: "global.google.vertex.workload-identity-federation", productId: "google-vertex-ai", categoryKey: "global_official_api", realmClass: "global", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "google_genai", authKind: "workload_identity", fundingTier: "payg", journeyKey: "google-vertex-workload-identity-federation", journeyTier: "enterprise_managed", onboardingRecipe: RECIPE_WORKLOAD_V1, requiredRuntimeStates: ["identity_ready", "renewal"], ecosystemTier: "L1", releaseMaturity: "builtin_stable" },
  { requirementKey: "azure.key", entryKey: "global.azure-openai.api-key", productId: "azure-openai", categoryKey: "global_official_api", realmClass: "global", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_responses", authKind: "registry_header", fundingTier: "payg", journeyKey: "azure-openai-api-key", journeyTier: "enterprise_managed", onboardingRecipe: RECIPE_AZURE_KEY_V1, requiredRuntimeStates: ["deployment_selected"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "azure.entra-user", entryKey: "global.azure-openai.entra-user", productId: "azure-openai", categoryKey: "global_official_api", realmClass: "global", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_responses", authKind: "oauth_device", fundingTier: "payg", journeyKey: "azure-openai-entra-user", journeyTier: "enterprise_managed", onboardingRecipe: RECIPE_AZURE_OAUTH_V1, requiredRuntimeStates: ["deployment_selected", "signed_out", "browser_login", "identity_ready", "leave_and_return"], ecosystemTier: "L1", releaseMaturity: "builtin_stable" },
  { requirementKey: "azure.service-principal", entryKey: "global.azure-openai.service-principal", productId: "azure-openai", categoryKey: "global_official_api", realmClass: "global", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_responses", authKind: "workload_identity", fundingTier: "payg", journeyKey: "azure-openai-service-principal", journeyTier: "enterprise_managed", onboardingRecipe: RECIPE_AZURE_WORKLOAD_V1, requiredRuntimeStates: ["deployment_selected", "identity_ready", "renewal"], ecosystemTier: "L1", releaseMaturity: "builtin_stable" },
  { requirementKey: "azure.managed-identity", entryKey: "global.azure-openai.managed-identity", productId: "azure-openai", categoryKey: "global_official_api", realmClass: "global", platformScope: "azure_hosted_runtime", surfaceKind: "inference", protocolProfile: "openai_responses", authKind: "workload_identity", fundingTier: "payg", journeyKey: "azure-openai-managed-identity", journeyTier: "enterprise_managed", onboardingRecipe: RECIPE_AZURE_WORKLOAD_V1, requiredRuntimeStates: ["identity_ready", "renewal"], ecosystemTier: "L1", releaseMaturity: "builtin_stable" },
  { requirementKey: "azure.chat.key", entryKey: "global.azure-openai.chat.api-key", productId: "azure-openai", categoryKey: "global_official_api", realmClass: "global", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_chat_completions", authKind: "registry_header", fundingTier: "payg", journeyKey: "azure-openai-chat-api-key", journeyTier: "enterprise_managed", onboardingRecipe: RECIPE_AZURE_KEY_V1, requiredRuntimeStates: ["deployment_selected"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "azure.chat.entra-user", entryKey: "global.azure-openai.chat.entra-user", productId: "azure-openai", categoryKey: "global_official_api", realmClass: "global", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_chat_completions", authKind: "oauth_device", fundingTier: "payg", journeyKey: "azure-openai-chat-entra-user", journeyTier: "enterprise_managed", onboardingRecipe: RECIPE_AZURE_OAUTH_V1, requiredRuntimeStates: ["deployment_selected", "signed_out", "browser_login", "identity_ready", "leave_and_return"], ecosystemTier: "L1", releaseMaturity: "builtin_stable" },
  { requirementKey: "azure.chat.service-principal", entryKey: "global.azure-openai.chat.service-principal", productId: "azure-openai", categoryKey: "global_official_api", realmClass: "global", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_chat_completions", authKind: "workload_identity", fundingTier: "payg", journeyKey: "azure-openai-chat-service-principal", journeyTier: "enterprise_managed", onboardingRecipe: RECIPE_AZURE_WORKLOAD_V1, requiredRuntimeStates: ["deployment_selected", "identity_ready", "renewal"], ecosystemTier: "L1", releaseMaturity: "builtin_stable" },
  { requirementKey: "azure.chat.managed-identity", entryKey: "global.azure-openai.chat.managed-identity", productId: "azure-openai", categoryKey: "global_official_api", realmClass: "global", platformScope: "azure_hosted_runtime", surfaceKind: "inference", protocolProfile: "openai_chat_completions", authKind: "workload_identity", fundingTier: "payg", journeyKey: "azure-openai-chat-managed-identity", journeyTier: "enterprise_managed", onboardingRecipe: RECIPE_AZURE_WORKLOAD_V1, requiredRuntimeStates: ["identity_ready", "renewal"], ecosystemTier: "L1", releaseMaturity: "builtin_stable" },
  { requirementKey: "bedrock.api-key", entryKey: "global.aws-bedrock.api-key", productId: "amazon-bedrock", categoryKey: "global_official_api", realmClass: "global", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "bedrock_converse", authKind: "bearer", fundingTier: "payg", journeyKey: "aws-bedrock-api-key", journeyTier: "enterprise_managed", onboardingRecipe: RECIPE_BEDROCK_API_KEY_V1, requiredRuntimeStates: ["region_selected"], ecosystemTier: "L1", releaseMaturity: "builtin_stable" },
  { requirementKey: "bedrock.static-profile", entryKey: "global.aws-bedrock.static-profile", productId: "amazon-bedrock", categoryKey: "global_official_api", realmClass: "global", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "bedrock_converse", authKind: "aws_static_profile_sigv4", fundingTier: "payg", journeyKey: "aws-bedrock-named-static-profile", journeyTier: "enterprise_managed", onboardingRecipe: RECIPE_AWS_PROFILE_V1, requiredRuntimeStates: ["profile_selected", "region_selected"], ecosystemTier: "L1", releaseMaturity: "builtin_stable" },
  { requirementKey: "bedrock.role-profile", entryKey: "global.aws-bedrock.role-profile", productId: "amazon-bedrock", categoryKey: "global_official_api", realmClass: "global", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "bedrock_converse", authKind: "workload_identity", fundingTier: "payg", journeyKey: "aws-bedrock-role-profile", journeyTier: "enterprise_managed", onboardingRecipe: RECIPE_AWS_PROFILE_V1, requiredRuntimeStates: ["profile_selected", "role_assumed", "renewal"], ecosystemTier: "L1", releaseMaturity: "builtin_stable" },
  { requirementKey: "bedrock.sso", entryKey: "global.aws-bedrock.sso", productId: "amazon-bedrock", categoryKey: "global_official_api", realmClass: "global", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "bedrock_converse", authKind: "workload_identity", fundingTier: "payg", journeyKey: "aws-bedrock-sso", journeyTier: "enterprise_managed", onboardingRecipe: RECIPE_AWS_SSO_V1, requiredRuntimeStates: ["profile_selected", "signed_out", "browser_login", "identity_ready", "renewal", "leave_and_return"], ecosystemTier: "L1", releaseMaturity: "builtin_stable" },
  { requirementKey: "openrouter.key", entryKey: "global.openrouter.credits-key", productId: "openrouter-credits", categoryKey: "global_gateway_and_subscription", realmClass: "global", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_chat_completions", authKind: "bearer", fundingTier: "payg", journeyKey: "openrouter-credits-key", journeyTier: "guided_key", onboardingRecipe: RECIPE_GUIDED_KEY_V1, requiredRuntimeStates: ["credits_verified"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "openrouter.pkce-key", entryKey: "global.openrouter.api-key-pkce", productId: "openrouter-credits", categoryKey: "global_gateway_and_subscription", realmClass: "global", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_chat_completions", authKind: "api_key_pkce_exchange", fundingTier: "payg", journeyKey: "openrouter-api-key-pkce", journeyTier: "guided_oauth", onboardingRecipe: RECIPE_BROWSER_KEY_V1, requiredRuntimeStates: ["browser_return", "key_committed", "credits_verified"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "opencode.zen.chat", entryKey: "global.opencode.zen-payg", productId: "opencode-zen", categoryKey: "global_gateway_and_subscription", realmClass: "global", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_chat_completions", authKind: "bearer", fundingTier: "payg", journeyKey: "opencode-zen-chat-api-key", journeyTier: "guided_key", onboardingRecipe: RECIPE_GUIDED_KEY_V1, requiredRuntimeStates: ["model_catalog_verified", "model_protocol_assignment_verified", "credits_verified"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "opencode.zen.responses", entryKey: "global.opencode.zen-payg", productId: "opencode-zen", categoryKey: "global_gateway_and_subscription", realmClass: "global", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_responses", authKind: "bearer", fundingTier: "payg", journeyKey: "opencode-zen-responses-api-key", journeyTier: "guided_key", onboardingRecipe: RECIPE_GUIDED_KEY_V1, requiredRuntimeStates: ["model_catalog_verified", "model_protocol_assignment_verified", "credits_verified"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "opencode.zen.messages", entryKey: "global.opencode.zen-payg", productId: "opencode-zen", categoryKey: "global_gateway_and_subscription", realmClass: "global", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "anthropic_messages", authKind: "x_api_key", fundingTier: "payg", journeyKey: "opencode-zen-messages-api-key", journeyTier: "guided_key", onboardingRecipe: RECIPE_GUIDED_KEY_V1, requiredRuntimeStates: ["model_catalog_verified", "model_protocol_assignment_verified", "credits_verified"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "opencode.go.chat", entryKey: "global.opencode.go-subscription", productId: "opencode-go", categoryKey: "global_gateway_and_subscription", realmClass: "global", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_chat_completions", authKind: "bearer", fundingTier: "subscription", journeyKey: "opencode-go-chat-api-key", journeyTier: "guided_key", onboardingRecipe: RECIPE_GUIDED_KEY_V1, requiredRuntimeStates: ["subscription_verified", "model_catalog_verified", "model_protocol_assignment_verified"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "opencode.go.responses", entryKey: "global.opencode.go-subscription", productId: "opencode-go", categoryKey: "global_gateway_and_subscription", realmClass: "global", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_responses", authKind: "bearer", fundingTier: "subscription", journeyKey: "opencode-go-responses-api-key", journeyTier: "guided_key", onboardingRecipe: RECIPE_GUIDED_KEY_V1, requiredRuntimeStates: ["subscription_verified", "model_catalog_verified", "model_protocol_assignment_verified"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "opencode.go.messages", entryKey: "global.opencode.go-subscription", productId: "opencode-go", categoryKey: "global_gateway_and_subscription", realmClass: "global", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "anthropic_messages", authKind: "x_api_key", fundingTier: "subscription", journeyKey: "opencode-go-messages-api-key", journeyTier: "guided_key", onboardingRecipe: RECIPE_GUIDED_KEY_V1, requiredRuntimeStates: ["subscription_verified", "model_catalog_verified", "model_protocol_assignment_verified"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "zai.chat", entryKey: "global.z-ai.api", productId: "z-ai-global-api", categoryKey: "global_official_api", realmClass: "global", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_chat_completions", authKind: "bearer", fundingTier: "payg", journeyKey: "z-ai-global-api-key", journeyTier: "guided_key", onboardingRecipe: RECIPE_GUIDED_KEY_V1, requiredRuntimeStates: ["warm"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "minimax.global", entryKey: "global.minimax.api", productId: "minimax-global-api", categoryKey: "global_official_api", realmClass: "global", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_chat_completions", authKind: "bearer", fundingTier: "payg", journeyKey: "minimax-global-api-key", journeyTier: "guided_key", onboardingRecipe: RECIPE_GUIDED_KEY_V1, requiredRuntimeStates: ["warm"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "minimax.global-plan", entryKey: "global.minimax.token-plan", productId: "minimax-global-token-plan", categoryKey: "global_gateway_and_subscription", realmClass: "global", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_chat_completions", authKind: "bearer", fundingTier: "subscription", journeyKey: "minimax-global-token-plan-key", journeyTier: "guided_key", onboardingRecipe: RECIPE_GUIDED_KEY_V1, requiredRuntimeStates: ["benefit_balance_verified", "overage_policy_verified"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "dashscope.global", entryKey: "global.dashscope.international", productId: "alibaba-model-studio-international", categoryKey: "global_official_api", realmClass: "global", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_chat_completions", authKind: "bearer", fundingTier: "payg", journeyKey: "dashscope-international-api-key", journeyTier: "guided_key", onboardingRecipe: RECIPE_GUIDED_KEY_V1, requiredRuntimeStates: ["singapore_realm_verified"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "siliconflow.global", entryKey: "global.siliconflow.api", productId: "siliconflow-global-api", categoryKey: "global_official_api", realmClass: "global", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_chat_completions", authKind: "bearer", fundingTier: "payg", journeyKey: "siliconflow-global-api-key", journeyTier: "guided_key", onboardingRecipe: RECIPE_GUIDED_KEY_V1, requiredRuntimeStates: ["global_realm_verified"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "byteplus.modelark.responses", entryKey: "global.byteplus-modelark.api", productId: "byteplus-modelark", categoryKey: "global_official_api", realmClass: "global", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_responses", authKind: "bearer", fundingTier: "payg", journeyKey: "byteplus-modelark-api-key", journeyTier: "guided_key", onboardingRecipe: RECIPE_GUIDED_KEY_V1, requiredRuntimeStates: ["international_realm_verified", "region_verified"], ecosystemTier: "L1", releaseMaturity: "builtin_beta" },
  { requirementKey: "bigmodel.chat", entryKey: "cn.zhipu.bigmodel-api", productId: "zhipu-bigmodel-cn", categoryKey: "china_mainland_official_api", realmClass: "china_mainland", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_chat_completions", authKind: "bearer", fundingTier: "payg", journeyKey: "zhipu-bigmodel-chat-api-key", journeyTier: "guided_key", onboardingRecipe: RECIPE_GUIDED_KEY_V1, requiredRuntimeStates: ["china_realm_verified"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "bigmodel.messages", entryKey: "cn.zhipu.bigmodel-api", productId: "zhipu-bigmodel-cn", categoryKey: "china_mainland_official_api", realmClass: "china_mainland", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "anthropic_messages", authKind: "x_api_key", fundingTier: "payg", journeyKey: "zhipu-bigmodel-messages-api-key", journeyTier: "guided_key", onboardingRecipe: RECIPE_GUIDED_KEY_V1, requiredRuntimeStates: ["china_realm_verified"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "kimi.platform.chat", entryKey: "cn.kimi.api", productId: "kimi-platform-cn", categoryKey: "china_mainland_official_api", realmClass: "china_mainland", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_chat_completions", authKind: "bearer", fundingTier: "payg", journeyKey: "kimi-platform-api-key", journeyTier: "guided_key", onboardingRecipe: RECIPE_GUIDED_KEY_V1, requiredRuntimeStates: ["china_realm_verified"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "kimi.code.chat", entryKey: "cn.kimi.coding-plan", productId: "kimi-code-membership-api", categoryKey: "global_gateway_and_subscription", realmClass: "china_mainland", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_chat_completions", authKind: "bearer", fundingTier: "subscription", journeyKey: "kimi-code-membership-openai", journeyTier: "guided_key", onboardingRecipe: RECIPE_GUIDED_KEY_V1, requiredRuntimeStates: ["membership_tier_verified", "model_eligibility_verified", "extra_usage_state_verified", "real_user_agent_preserved"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "kimi.code.messages", entryKey: "cn.kimi.coding-plan", productId: "kimi-code-membership-api", categoryKey: "global_gateway_and_subscription", realmClass: "china_mainland", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "anthropic_messages", authKind: "x_api_key", fundingTier: "subscription", journeyKey: "kimi-code-membership-anthropic", journeyTier: "guided_key", onboardingRecipe: RECIPE_GUIDED_KEY_V1, requiredRuntimeStates: ["membership_tier_verified", "model_eligibility_verified", "extra_usage_state_verified", "real_user_agent_preserved"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "deepseek.chat", entryKey: "cn.deepseek.api", productId: "deepseek-api-cn", categoryKey: "china_mainland_official_api", realmClass: "china_mainland", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_chat_completions", authKind: "bearer", fundingTier: "payg", journeyKey: "deepseek-api-key", journeyTier: "guided_key", onboardingRecipe: RECIPE_GUIDED_KEY_V1, requiredRuntimeStates: ["china_realm_verified"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "minimax.cn", entryKey: "cn.minimax.api", productId: "minimax-cn-api", categoryKey: "china_mainland_official_api", realmClass: "china_mainland", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_chat_completions", authKind: "bearer", fundingTier: "payg", journeyKey: "minimax-cn-api-key", journeyTier: "guided_key", onboardingRecipe: RECIPE_GUIDED_KEY_V1, requiredRuntimeStates: ["china_realm_verified"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "minimax.cn-plan", entryKey: "cn.minimax.token-plan", productId: "minimax-cn-token-plan", categoryKey: "global_gateway_and_subscription", realmClass: "china_mainland", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_chat_completions", authKind: "bearer", fundingTier: "subscription", journeyKey: "minimax-cn-token-plan-key", journeyTier: "guided_key", onboardingRecipe: RECIPE_GUIDED_KEY_V1, requiredRuntimeStates: ["benefit_balance_verified", "overage_policy_verified"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "dashscope.cn", entryKey: "cn.dashscope.beijing", productId: "alibaba-bailian-cn", categoryKey: "china_mainland_official_api", realmClass: "china_mainland", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_chat_completions", authKind: "bearer", fundingTier: "payg", journeyKey: "dashscope-beijing-api-key", journeyTier: "guided_key", onboardingRecipe: RECIPE_GUIDED_KEY_V1, requiredRuntimeStates: ["beijing_realm_verified"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "ark.cn.responses", entryKey: "cn.volcengine-ark.api", productId: "volcengine-ark-cn", categoryKey: "china_mainland_official_api", realmClass: "china_mainland", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_responses", authKind: "bearer", fundingTier: "payg", journeyKey: "volcengine-ark-api-key", journeyTier: "guided_key", onboardingRecipe: RECIPE_GUIDED_KEY_V1, requiredRuntimeStates: ["china_realm_verified", "endpoint_model_verified"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "tokenhub.gz.chat", entryKey: "cn.tencent-tokenhub.guangzhou", productId: "tencent-tokenhub-guangzhou", categoryKey: "global_gateway_and_subscription", realmClass: "china_mainland", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_chat_completions", authKind: "bearer", fundingTier: "payg", journeyKey: "tencent-tokenhub-guangzhou-chat", journeyTier: "guided_key", onboardingRecipe: RECIPE_GUIDED_KEY_V1, requiredRuntimeStates: ["china_realm_verified", "model_catalog_verified", "model_service_enabled", "authoritative_funding_mode_observed"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "tokenhub.gz.responses", entryKey: "cn.tencent-tokenhub.guangzhou", productId: "tencent-tokenhub-guangzhou", categoryKey: "global_gateway_and_subscription", realmClass: "china_mainland", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_responses", authKind: "bearer", fundingTier: "payg", journeyKey: "tencent-tokenhub-guangzhou-responses", journeyTier: "guided_key", onboardingRecipe: RECIPE_GUIDED_KEY_V1, requiredRuntimeStates: ["china_realm_verified", "model_catalog_verified", "model_service_enabled", "authoritative_funding_mode_observed"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "tokenhub.gz.messages", entryKey: "cn.tencent-tokenhub.guangzhou", productId: "tencent-tokenhub-guangzhou", categoryKey: "global_gateway_and_subscription", realmClass: "china_mainland", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "anthropic_messages", authKind: "x_api_key", fundingTier: "payg", journeyKey: "tencent-tokenhub-guangzhou-messages", journeyTier: "guided_key", onboardingRecipe: RECIPE_GUIDED_KEY_V1, requiredRuntimeStates: ["china_realm_verified", "model_catalog_verified", "model_service_enabled", "authoritative_funding_mode_observed"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "tokenhub.sg.chat", entryKey: "global.tencent-tokenhub.singapore", productId: "tencent-tokenhub-singapore", categoryKey: "global_gateway_and_subscription", realmClass: "global", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_chat_completions", authKind: "bearer", fundingTier: "payg", journeyKey: "tencent-tokenhub-singapore-chat", journeyTier: "guided_key", onboardingRecipe: RECIPE_GUIDED_KEY_V1, requiredRuntimeStates: ["singapore_realm_verified", "model_catalog_verified", "model_service_enabled", "authoritative_funding_mode_observed"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "tokenhub.sg.responses", entryKey: "global.tencent-tokenhub.singapore", productId: "tencent-tokenhub-singapore", categoryKey: "global_gateway_and_subscription", realmClass: "global", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_responses", authKind: "bearer", fundingTier: "payg", journeyKey: "tencent-tokenhub-singapore-responses", journeyTier: "guided_key", onboardingRecipe: RECIPE_GUIDED_KEY_V1, requiredRuntimeStates: ["singapore_realm_verified", "model_catalog_verified", "model_service_enabled", "authoritative_funding_mode_observed"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "tokenhub.sg.messages", entryKey: "global.tencent-tokenhub.singapore", productId: "tencent-tokenhub-singapore", categoryKey: "global_gateway_and_subscription", realmClass: "global", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "anthropic_messages", authKind: "x_api_key", fundingTier: "payg", journeyKey: "tencent-tokenhub-singapore-messages", journeyTier: "guided_key", onboardingRecipe: RECIPE_GUIDED_KEY_V1, requiredRuntimeStates: ["singapore_realm_verified", "model_catalog_verified", "model_service_enabled", "authoritative_funding_mode_observed"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "tencent-enterprise-plan.gz.chat", entryKey: "cn.tencent-token-plan-enterprise.guangzhou", productId: "tencent-token-plan-enterprise-guangzhou", categoryKey: "global_gateway_and_subscription", realmClass: "china_mainland", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_chat_completions", authKind: "bearer", fundingTier: "subscription", journeyKey: "tencent-enterprise-token-plan-guangzhou-chat", journeyTier: "guided_key", onboardingRecipe: RECIPE_GUIDED_KEY_V1, requiredRuntimeStates: ["china_realm_verified", "enterprise_plan_edition_verified", "subscription_pool_verified", "model_eligibility_verified", "overage_policy_verified"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "tencent-enterprise-plan.gz.messages", entryKey: "cn.tencent-token-plan-enterprise.guangzhou", productId: "tencent-token-plan-enterprise-guangzhou", categoryKey: "global_gateway_and_subscription", realmClass: "china_mainland", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "anthropic_messages", authKind: "x_api_key", fundingTier: "subscription", journeyKey: "tencent-enterprise-token-plan-guangzhou-messages", journeyTier: "guided_key", onboardingRecipe: RECIPE_GUIDED_KEY_V1, requiredRuntimeStates: ["china_realm_verified", "enterprise_plan_edition_verified", "subscription_pool_verified", "model_eligibility_verified", "overage_policy_verified"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "tencent-enterprise-plan.sg.chat", entryKey: "global.tencent-token-plan-enterprise.singapore", productId: "tencent-token-plan-enterprise-singapore", categoryKey: "global_gateway_and_subscription", realmClass: "global", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_chat_completions", authKind: "bearer", fundingTier: "subscription", journeyKey: "tencent-enterprise-token-plan-singapore-chat", journeyTier: "guided_key", onboardingRecipe: RECIPE_GUIDED_KEY_V1, requiredRuntimeStates: ["singapore_realm_verified", "enterprise_plan_edition_verified", "subscription_pool_verified", "model_eligibility_verified", "overage_policy_verified"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "tencent-enterprise-plan.sg.messages", entryKey: "global.tencent-token-plan-enterprise.singapore", productId: "tencent-token-plan-enterprise-singapore", categoryKey: "global_gateway_and_subscription", realmClass: "global", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "anthropic_messages", authKind: "x_api_key", fundingTier: "subscription", journeyKey: "tencent-enterprise-token-plan-singapore-messages", journeyTier: "guided_key", onboardingRecipe: RECIPE_GUIDED_KEY_V1, requiredRuntimeStates: ["singapore_realm_verified", "enterprise_plan_edition_verified", "subscription_pool_verified", "model_eligibility_verified", "overage_policy_verified"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "hunyuan.cn", entryKey: "cn.tencent-hunyuan.api", productId: "tencent-hunyuan-legacy-openai-compatible", categoryKey: "china_mainland_official_api", realmClass: "china_mainland", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_chat_completions", authKind: "bearer", fundingTier: "payg", journeyKey: "tencent-hunyuan-legacy-openai-key-migration", journeyTier: "migration_only", onboardingRecipe: RECIPE_EXISTING_CONNECTION_MIGRATION_ONLY_V8, requiredRuntimeStates: ["china_realm_verified"], ecosystemTier: "L1", releaseMaturity: "builtin_stable" },
  { requirementKey: "qianfan.v2", entryKey: "cn.baidu-qianfan.api-v2", productId: "baidu-qianfan-v2-cn", categoryKey: "china_mainland_official_api", realmClass: "china_mainland", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_chat_completions", authKind: "bearer", fundingTier: "payg", journeyKey: "baidu-qianfan-v2-api-key", journeyTier: "guided_key", onboardingRecipe: RECIPE_GUIDED_KEY_V1, requiredRuntimeStates: ["china_realm_verified"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "baidu.benefit-pack", entryKey: "cn.baidu-token-benefit-pack", productId: "baidu-token-benefit-pack-cn", categoryKey: "global_gateway_and_subscription", realmClass: "china_mainland", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_chat_completions", authKind: "bearer", fundingTier: "subscription", journeyKey: "baidu-token-benefit-pack-key", journeyTier: "guided_key", onboardingRecipe: RECIPE_GUIDED_KEY_V1, requiredRuntimeStates: ["benefit_balance_verified", "overage_policy_verified"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "siliconflow.cn", entryKey: "cn.siliconflow.api", productId: "siliconflow-cn-api", categoryKey: "china_mainland_official_api", realmClass: "china_mainland", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_chat_completions", authKind: "bearer", fundingTier: "payg", journeyKey: "siliconflow-cn-api-key", journeyTier: "guided_key", onboardingRecipe: RECIPE_GUIDED_KEY_V1, requiredRuntimeStates: ["china_realm_verified"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "ollama.chat", entryKey: "local.ollama", productId: "ollama-local", categoryKey: "local_runtime", realmClass: "local", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_chat_completions", authKind: "none", fundingTier: "owned_capacity", journeyKey: "ollama-text-only-plain-dialog", journeyTier: "zero_config", onboardingRecipe: RECIPE_LOCAL_ZERO_V1, requiredRuntimeStates: ["not_running", "cold", "warm", "text_only"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "ollama.responses", entryKey: "local.ollama", productId: "ollama-local", categoryKey: "local_runtime", realmClass: "local", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_responses", authKind: "none", fundingTier: "owned_capacity", journeyKey: "ollama-responses-cold-warm", journeyTier: "zero_config", onboardingRecipe: RECIPE_LOCAL_ZERO_V1, requiredRuntimeStates: ["not_running", "cold", "warm", "tools_by_model"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "lmstudio.chat", entryKey: "local.lm-studio", productId: "lm-studio-local", categoryKey: "local_runtime", realmClass: "local", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_chat_completions", authKind: "none", fundingTier: "owned_capacity", journeyKey: "lm-studio-chat-cold-warm", journeyTier: "zero_config", onboardingRecipe: RECIPE_LMSTUDIO_OPTIONAL_AUTH_V6, requiredRuntimeStates: ["not_running", "cold", "warm", "auth_optional"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "lmstudio.responses", entryKey: "local.lm-studio", productId: "lm-studio-local", categoryKey: "local_runtime", realmClass: "local", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_responses", authKind: "none", fundingTier: "owned_capacity", journeyKey: "lm-studio-responses-cold-warm", journeyTier: "zero_config", onboardingRecipe: RECIPE_LMSTUDIO_OPTIONAL_AUTH_V6, requiredRuntimeStates: ["cold", "warm", "tools_by_model", "auth_optional"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "lmstudio.messages", entryKey: "local.lm-studio", productId: "lm-studio-local", categoryKey: "local_runtime", realmClass: "local", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "anthropic_messages", authKind: "none", fundingTier: "owned_capacity", journeyKey: "lm-studio-messages-cold-warm", journeyTier: "zero_config", onboardingRecipe: RECIPE_LMSTUDIO_MESSAGES_OPTIONAL_AUTH_V9, requiredRuntimeStates: ["cold", "warm", "tools_by_model", "auth_optional"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "omlx.chat", entryKey: "local.omlx", productId: "omlx-local", categoryKey: "local_runtime", realmClass: "local", platformScope: "macos_arm64", surfaceKind: "inference", protocolProfile: "openai_chat_completions", authKind: "none", fundingTier: "owned_capacity", journeyKey: "omlx-chat-plain-dialog", journeyTier: "zero_config", onboardingRecipe: RECIPE_LOCAL_ZERO_V1, requiredRuntimeStates: ["not_running", "cold", "warm", "text_only"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "omlx.responses", entryKey: "local.omlx", productId: "omlx-local", categoryKey: "local_runtime", realmClass: "local", platformScope: "macos_arm64", surfaceKind: "inference", protocolProfile: "openai_responses", authKind: "none", fundingTier: "owned_capacity", journeyKey: "omlx-responses-cold-warm", journeyTier: "zero_config", onboardingRecipe: RECIPE_LOCAL_ZERO_V1, requiredRuntimeStates: ["cold", "warm"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "omlx.messages", entryKey: "local.omlx", productId: "omlx-local", categoryKey: "local_runtime", realmClass: "local", platformScope: "macos_arm64", surfaceKind: "inference", protocolProfile: "anthropic_messages", authKind: "none", fundingTier: "owned_capacity", journeyKey: "omlx-messages-cold-warm", journeyTier: "zero_config", onboardingRecipe: RECIPE_LOCAL_ZERO_V1, requiredRuntimeStates: ["cold", "warm"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "docker.model-runner", entryKey: "local.docker-model-runner", productId: "docker-model-runner", categoryKey: "local_runtime", realmClass: "local", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_chat_completions", authKind: "none", fundingTier: "owned_capacity", journeyKey: "docker-model-runner-ready-and-stopped", journeyTier: "zero_config", onboardingRecipe: RECIPE_LOCAL_MANAGED_V1, requiredRuntimeStates: ["disabled", "api_off", "no_model", "cold", "warm", "port_conflict"], ecosystemTier: "L2", releaseMaturity: "builtin_beta" },
  { requirementKey: "podman.ai-lab", entryKey: "local.podman-ai-lab", productId: "podman-ai-lab", categoryKey: "local_runtime", realmClass: "local", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_chat_completions", authKind: "none", fundingTier: "owned_capacity", journeyKey: "podman-ai-lab-ready-api-disabled-no-model-stopped-and-port-conflict", journeyTier: "zero_config", onboardingRecipe: RECIPE_LOCAL_MANAGED_V1, requiredRuntimeStates: ["ready", "api_disabled", "no_model", "stopped", "port_conflict", "unsupported_version"], ecosystemTier: "L2", releaseMaturity: "builtin_beta" },
  { requirementKey: "codex.app-server", entryKey: "execution.codex-app-server", productId: "openai-codex-app-server", categoryKey: "execution_subscription_surface", realmClass: "local", platformScope: "all_desktop", surfaceKind: "execution", protocolProfile: "app_server_stdio", authKind: "upstream_managed_credential", fundingTier: "subscription", journeyKey: "codex-app-server-stdio", journeyTier: "guided_oauth", onboardingRecipe: RECIPE_EXECUTION_STDIO_V1, requiredRuntimeStates: ["not_installed", "signed_out", "ready", "session_recovery"], ecosystemTier: "L1", releaseMaturity: "builtin_beta" },
  { requirementKey: "kimi.server.acp", entryKey: "execution.kimi-code-server-acp", productId: "kimi-code-server-acp", categoryKey: "execution_subscription_surface", realmClass: "local", platformScope: "all_desktop", surfaceKind: "execution", protocolProfile: "acp_stdio", authKind: "upstream_managed_credential", fundingTier: "subscription", journeyKey: "kimi-code-server-acp-stdio", journeyTier: "guided_oauth", onboardingRecipe: RECIPE_EXECUTION_STDIO_V1, requiredRuntimeStates: ["not_installed", "signed_out", "ready", "session_recovery"], ecosystemTier: "L1", releaseMaturity: "builtin_beta" },
  { requirementKey: "opencode.server.http", entryKey: "execution.opencode-server", productId: "opencode-server", categoryKey: "execution_subscription_surface", realmClass: "local", platformScope: "all_desktop", surfaceKind: "execution", protocolProfile: "agent_http", authKind: "upstream_managed_credential", fundingTier: "externally_metered_unknown", journeyKey: "opencode-server-loopback-http", journeyTier: "guided_key", onboardingRecipe: RECIPE_EXECUTION_HTTP_V1, requiredRuntimeStates: ["not_running", "ready", "password_optional", "session_recovery"], ecosystemTier: "L1", releaseMaturity: "builtin_beta" },
  { requirementKey: "opencode.acp.stdio", entryKey: "execution.opencode-server", productId: "opencode-acp", categoryKey: "execution_subscription_surface", realmClass: "local", platformScope: "all_desktop", surfaceKind: "execution", protocolProfile: "acp_stdio", authKind: "upstream_managed_credential", fundingTier: "externally_metered_unknown", journeyKey: "opencode-acp-stdio", journeyTier: "zero_config", onboardingRecipe: RECIPE_EXECUTION_LOCAL_STDIO_V1, requiredRuntimeStates: ["not_installed", "ready", "session_recovery"], ecosystemTier: "L1", releaseMaturity: "builtin_beta" },
  { requirementKey: "generic.cli.stdio", entryKey: "execution.user-cli-stdio", productId: "user-installed-ai-cli", categoryKey: "execution_subscription_surface", realmClass: "local", platformScope: "all_desktop", surfaceKind: "execution", protocolProfile: "cli_stdio", authKind: "upstream_managed_credential", fundingTier: "externally_metered_unknown", journeyKey: "user-installed-cli-stdio", journeyTier: "zero_config", onboardingRecipe: RECIPE_EXECUTION_LOCAL_STDIO_V1, requiredRuntimeStates: ["not_installed", "signed_out", "ready", "session_recovery"], ecosystemTier: "L1", releaseMaturity: "builtin_beta" },
  { requirementKey: "cc-switch.proxy.messages", entryKey: "bridge.cc-switch-public-proxy", productId: "cc-switch-desktop-public-proxy", categoryKey: "bridge_and_router", realmClass: "local", platformScope: "all_desktop", surfaceKind: "bridge", protocolProfile: "anthropic_messages", authKind: "none", fundingTier: "externally_metered_unknown", journeyKey: "cc-switch-public-proxy-messages", journeyTier: "zero_config", onboardingRecipe: RECIPE_BRIDGE_V1, requiredRuntimeStates: ["not_running", "route_opaque", "failover_opaque", "ready"], ecosystemTier: "L2", releaseMaturity: "community_verified" },
  { requirementKey: "litellm.bridge.openai", entryKey: "bridge.litellm-openai", productId: "litellm-proxy", categoryKey: "bridge_and_router", realmClass: "local", platformScope: "all_desktop", surfaceKind: "bridge", protocolProfile: "openai_chat_completions", authKind: "upstream_managed_credential", fundingTier: "externally_metered_unknown", journeyKey: "litellm-openai-compatible-loopback", journeyTier: "guided_key", onboardingRecipe: RECIPE_BRIDGE_OPENAI_V1, requiredRuntimeStates: ["not_running", "route_ready", "route_drift", "failover_unknown", "secret_optional"], ecosystemTier: "L2", releaseMaturity: "builtin_beta" },
  { requirementKey: "litellm.bridge.responses", entryKey: "bridge.litellm-openai", productId: "litellm-proxy", categoryKey: "bridge_and_router", realmClass: "local", platformScope: "all_desktop", surfaceKind: "bridge", protocolProfile: "openai_responses", authKind: "upstream_managed_credential", fundingTier: "externally_metered_unknown", journeyKey: "litellm-responses-compatible-loopback", journeyTier: "guided_key", onboardingRecipe: RECIPE_BRIDGE_OPENAI_V1, requiredRuntimeStates: ["not_running", "route_ready", "route_drift", "failover_unknown", "secret_optional"], ecosystemTier: "L2", releaseMaturity: "builtin_beta" },
  { requirementKey: "litellm.bridge.messages", entryKey: "bridge.litellm-openai", productId: "litellm-proxy", categoryKey: "bridge_and_router", realmClass: "local", platformScope: "all_desktop", surfaceKind: "bridge", protocolProfile: "anthropic_messages", authKind: "upstream_managed_credential", fundingTier: "externally_metered_unknown", journeyKey: "litellm-messages-compatible-loopback", journeyTier: "guided_key", onboardingRecipe: RECIPE_BRIDGE_OPENAI_V1, requiredRuntimeStates: ["not_running", "route_ready", "route_drift", "failover_unknown", "secret_optional"], ecosystemTier: "L2", releaseMaturity: "builtin_beta" },
  { requirementKey: "anchor.witness", entryKey: "control.anchor-witness", productId: "saydo-anchor-witness", categoryKey: "platform_anchor_control_plane", realmClass: "global", platformScope: "all_desktop", surfaceKind: "control_plane", protocolProfile: "control_plane", authKind: "none", fundingTier: "owned_capacity", journeyKey: "anchor-witness-enrollment-and-recovery", journeyTier: "zero_config", onboardingRecipe: RECIPE_ANCHOR_V1, requiredRuntimeStates: ["not_enrolled", "enrolling", "offline", "proxy_blocked", "threshold_partial", "rotation", "continuity_lost", "ready"], ecosystemTier: "L0", releaseMaturity: "builtin_stable" },
  { requirementKey: "custom.openai-chat", entryKey: "custom.openai-chat", productId: "custom-openai-chat-endpoint", categoryKey: "custom_endpoint", realmClass: "global", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_chat_completions", authKind: "bearer", fundingTier: "externally_metered_unknown", journeyKey: "custom-openai-chat", journeyTier: "custom_endpoint", onboardingRecipe: RECIPE_CUSTOM_ENDPOINT_V1, requiredRuntimeStates: ["manual_config", "verified"], ecosystemTier: "L1", releaseMaturity: "builtin_stable" },
  { requirementKey: "custom.openai-responses", entryKey: "custom.openai-responses", productId: "custom-openai-responses-endpoint", categoryKey: "custom_endpoint", realmClass: "global", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_responses", authKind: "bearer", fundingTier: "externally_metered_unknown", journeyKey: "custom-openai-responses", journeyTier: "custom_endpoint", onboardingRecipe: RECIPE_CUSTOM_ENDPOINT_V1, requiredRuntimeStates: ["manual_config", "verified"], ecosystemTier: "L1", releaseMaturity: "builtin_stable" },
  { requirementKey: "custom.anthropic-messages", entryKey: "custom.anthropic-messages", productId: "custom-anthropic-messages-endpoint", categoryKey: "custom_endpoint", realmClass: "global", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "anthropic_messages", authKind: "x_api_key", fundingTier: "externally_metered_unknown", journeyKey: "custom-anthropic-messages", journeyTier: "custom_endpoint", onboardingRecipe: RECIPE_CUSTOM_ENDPOINT_V1, requiredRuntimeStates: ["manual_config", "verified"], ecosystemTier: "L1", releaseMaturity: "builtin_stable" },
  { requirementKey: "custom.mtls", entryKey: "custom.mtls-only-private-gateway", productId: "custom-mtls-private-gateway", categoryKey: "custom_endpoint", realmClass: "global", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_chat_completions", authKind: "transport_mtls_only", fundingTier: "externally_metered_unknown", journeyKey: "custom-mtls-only-private-gateway", journeyTier: "custom_endpoint", onboardingRecipe: RECIPE_CUSTOM_MTLS_V1, requiredRuntimeStates: ["certificate_selected", "private_key_handle_ready", "verified"], ecosystemTier: "L2", releaseMaturity: "builtin_beta" },
  { requirementKey: "custom.secret-header", entryKey: "custom.secret-header-gateway", productId: "custom-secret-header-gateway", categoryKey: "custom_endpoint", realmClass: "global", platformScope: "all_desktop", surfaceKind: "inference", protocolProfile: "openai_chat_completions", authKind: "custom_secret_header", fundingTier: "externally_metered_unknown", journeyKey: "custom-secret-header", journeyTier: "custom_endpoint", onboardingRecipe: RECIPE_CUSTOM_SECRET_HEADER_V1, requiredRuntimeStates: ["header_policy_verified", "secret_broker_handle_ready", "verified"], ecosystemTier: "L2", releaseMaturity: "builtin_beta" },
] as const satisfies readonly ReferenceRequirementInputV3[];

type ReferenceRequirementInputKeyV7 = (typeof REFERENCE_REQUIREMENT_INPUTS_V3)[number]["requirementKey"];
type ReferenceRequirementInputMapV7 = {
  readonly [R in (typeof REFERENCE_REQUIREMENT_INPUTS_V3)[number] as R["requirementKey"]]: R;
};
type ReferenceRequirementInputForKeyV7<K extends ReferenceRequirementInputKeyV7> =
  ReferenceRequirementInputMapV7[K];

interface ReferenceWireProtocolByOracleProfileIdV7 {
  readonly "wire-oracle:openai-chat@6": "openai_chat_completions";
  readonly "wire-oracle:openai-responses@6": "openai_responses";
  readonly "wire-oracle:anthropic-messages@6": "anthropic_messages";
  readonly "wire-oracle:google-gemini-generate-content@6": "google_genai";
  readonly "wire-oracle:vertex-generate-content@6": "google_genai";
  readonly "wire-oracle:azure-openai-v1-chat@6": "openai_chat_completions";
  readonly "wire-oracle:azure-openai-v1-responses@6": "openai_responses";
  readonly "wire-oracle:bedrock-converse@6": "bedrock_converse";
  readonly "wire-oracle:openrouter-chat@6": "openai_chat_completions";
  readonly "wire-oracle:opencode-zen-chat@6": "openai_chat_completions";
  readonly "wire-oracle:opencode-zen-responses@6": "openai_responses";
  readonly "wire-oracle:opencode-zen-messages@6": "anthropic_messages";
  readonly "wire-oracle:opencode-go-chat@6": "openai_chat_completions";
  readonly "wire-oracle:opencode-go-responses@6": "openai_responses";
  readonly "wire-oracle:opencode-go-messages@6": "anthropic_messages";
  readonly "wire-oracle:z-ai-global-chat@6": "openai_chat_completions";
  readonly "wire-oracle:minimax-global-chat@6": "openai_chat_completions";
  readonly "wire-oracle:minimax-cn-chat@6": "openai_chat_completions";
  readonly "wire-oracle:dashscope-singapore-chat@6": "openai_chat_completions";
  readonly "wire-oracle:dashscope-beijing-chat@6": "openai_chat_completions";
  readonly "wire-oracle:siliconflow-global-chat@6": "openai_chat_completions";
  readonly "wire-oracle:siliconflow-cn-chat@6": "openai_chat_completions";
  readonly "wire-oracle:byteplus-modelark-responses@6": "openai_responses";
  readonly "wire-oracle:zhipu-bigmodel-chat@6": "openai_chat_completions";
  readonly "wire-oracle:zhipu-bigmodel-messages@6": "anthropic_messages";
  readonly "wire-oracle:kimi-platform-chat@6": "openai_chat_completions";
  readonly "wire-oracle:kimi-code-chat@6": "openai_chat_completions";
  readonly "wire-oracle:kimi-code-messages@6": "anthropic_messages";
  readonly "wire-oracle:deepseek-chat@6": "openai_chat_completions";
  readonly "wire-oracle:volcengine-ark-cn-responses@6": "openai_responses";
  readonly "wire-oracle:tokenhub-guangzhou-chat@6": "openai_chat_completions";
  readonly "wire-oracle:tokenhub-guangzhou-responses@6": "openai_responses";
  readonly "wire-oracle:tokenhub-guangzhou-messages@6": "anthropic_messages";
  readonly "wire-oracle:tokenhub-singapore-chat@6": "openai_chat_completions";
  readonly "wire-oracle:tokenhub-singapore-responses@6": "openai_responses";
  readonly "wire-oracle:tokenhub-singapore-messages@6": "anthropic_messages";
  readonly "wire-oracle:tencent-enterprise-token-plan-guangzhou-chat@6": "openai_chat_completions";
  readonly "wire-oracle:tencent-enterprise-token-plan-guangzhou-messages@6": "anthropic_messages";
  readonly "wire-oracle:tencent-enterprise-token-plan-singapore-chat@6": "openai_chat_completions";
  readonly "wire-oracle:tencent-enterprise-token-plan-singapore-messages@6": "anthropic_messages";
  readonly "wire-oracle:tencent-hunyuan-legacy-openai-chat@6": "openai_chat_completions";
  readonly "wire-oracle:baidu-qianfan-v2-chat@6": "openai_chat_completions";
  readonly "wire-oracle:ollama-chat@6": "openai_chat_completions";
  readonly "wire-oracle:ollama-responses@6": "openai_responses";
  readonly "wire-oracle:lm-studio-chat@6": "openai_chat_completions";
  readonly "wire-oracle:lm-studio-responses@6": "openai_responses";
  readonly "wire-oracle:lm-studio-messages@6": "anthropic_messages";
  readonly "wire-oracle:omlx-chat@6": "openai_chat_completions";
  readonly "wire-oracle:omlx-responses@6": "openai_responses";
  readonly "wire-oracle:omlx-messages@6": "anthropic_messages";
  readonly "wire-oracle:docker-model-runner-chat@6": "openai_chat_completions";
  readonly "wire-oracle:podman-ai-lab-chat@6": "openai_chat_completions";
  readonly "wire-oracle:codex-app-server-stdio@6": "app_server_stdio";
  readonly "wire-oracle:kimi-acp-stdio@6": "acp_stdio";
  readonly "wire-oracle:opencode-server-openapi@6": "agent_http";
  readonly "wire-oracle:opencode-acp-stdio@6": "acp_stdio";
  readonly "wire-oracle:user-selected-cli-stdio@6": "cli_stdio";
  readonly "wire-oracle:cc-switch-public-proxy-messages@6": "anthropic_messages";
  readonly "wire-oracle:litellm-proxy-chat@6": "openai_chat_completions";
  readonly "wire-oracle:litellm-proxy-responses@6": "openai_responses";
  readonly "wire-oracle:litellm-proxy-messages@6": "anthropic_messages";
  readonly "wire-oracle:saydo-anchor-control@6": "control_plane";
  readonly "wire-oracle:custom-openai-chat@6": "openai_chat_completions";
  readonly "wire-oracle:custom-openai-responses@6": "openai_responses";
  readonly "wire-oracle:custom-anthropic-messages@6": "anthropic_messages";
}

function defineExactWireOracleV6<const W extends ReferenceExactWirePolicyV6>(wire: W): W {
  return wire;
}

declare function defineExactAuthOracleV6<
  const A extends ReferenceExactAuthPolicyInputV7,
  const F extends ReferenceExactAuthFlowV7 & { readonly kind: A["semanticAuthFlowKind"] },
>(auth: A, authFlow: F): A & {
  readonly [referenceExactAuthPolicyBrandV7]: never;
  readonly authFlow: F;
  readonly tokenResourceOrAudience?: never;
};

declare function defineConnectionOracleEntryV6<
  const K extends ReferenceRequirementInputKeyV7,
  const W extends ReferenceExactWirePolicyV6 & {
    readonly profileId: keyof ReferenceWireProtocolByOracleProfileIdV7;
  },
  const A extends ReferenceExactAuthPolicyV6,
  const S extends string,
  const O extends ReferenceConnectionOperationOverridesV7 | undefined = undefined,
>(
  requirementKey: K,
  wire: W & (
    ReferenceWireProtocolByOracleProfileIdV7[W["profileId"]] extends ReferenceRequirementInputForKeyV7<K>["protocolProfile"]
      ? unknown
      : never
  ),
  auth: A & { readonly requirementAuthKind: ReferenceRequirementInputForKeyV7<K>["authKind"] },
  slug: S,
  overrides?: O,
): ReferenceExactConnectionOracleEntryV6<K> & {
  readonly wire: W;
  readonly auth: A;
  readonly exactOperationOverrides: O;
  readonly independentSignedOracleTargetPath: `providers/${S}/connection-oracle.v6.json`;
  readonly officialEvidenceLockTargetPath: `evidence/providers/${S}.v6.json`;
};

const STATIC_REQUEST_CREDENTIAL_FLOW_V7 = {
  kind: "static_or_brokered_request_credential",
  tokenExchangeNetworkRequest: "not_applicable",
  finalApiCredentialRecipientBoundSeparately: true,
} as const;

const UPSTREAM_OR_NO_APPLICATION_CREDENTIAL_FLOW_V7 = {
  kind: "upstream_application_or_no_application_credential",
  tokenExchangeNetworkRequest: "not_applicable",
  finalApiCredentialRecipientBoundSeparately: false,
} as const;

function manualBearerAuthV6<
  const P extends `auth-oracle:${string}@6`,
  const N extends string,
>(profileId: P, principalAndKeyNamespace: N) {
  return defineExactAuthOracleV6({
    profileId,
    requirementAuthKind: "bearer",
    semanticAuthFlowKind: "static_or_brokered_request_credential",
    custodyKind: "manual_secret_broker",
    wireKind: "authorization_bearer",
    credentialHeaderName: "Authorization",
    challengeKind: "none",
    principalAndKeyNamespace,
    endpointIdentityMustContainPrincipalCredentialVersionAndRecipient: true,
  }, STATIC_REQUEST_CREDENTIAL_FLOW_V7);
}

function manualXApiKeyAuthV6<
  const P extends `auth-oracle:${string}@6`,
  const N extends string,
>(profileId: P, principalAndKeyNamespace: N) {
  return defineExactAuthOracleV6({
    profileId,
    requirementAuthKind: "x_api_key",
    semanticAuthFlowKind: "static_or_brokered_request_credential",
    custodyKind: "manual_secret_broker",
    wireKind: "anthropic_x_api_key",
    credentialHeaderName: "x-api-key",
    challengeKind: "none",
    principalAndKeyNamespace,
    endpointIdentityMustContainPrincipalCredentialVersionAndRecipient: true,
  }, STATIC_REQUEST_CREDENTIAL_FLOW_V7);
}

function noApplicationAuthV6<
  const P extends `auth-oracle:${string}@6`,
  const N extends string,
>(profileId: P, principalAndKeyNamespace: N) {
  return defineExactAuthOracleV6({
    profileId,
    requirementAuthKind: "none",
    semanticAuthFlowKind: "upstream_application_or_no_application_credential",
    custodyKind: "none",
    wireKind: "none",
    credentialHeaderName: "none",
    challengeKind: "none",
    principalAndKeyNamespace,
    endpointIdentityMustContainPrincipalCredentialVersionAndRecipient: false,
  }, UPSTREAM_OR_NO_APPLICATION_CREDENTIAL_FLOW_V7);
}

function optionalServerAuthOracleV6<
  const P extends `auth-oracle:${string}@6`,
  const W extends "http_basic" | "authorization_bearer" | "anthropic_x_api_key",
  const H extends "Authorization" | "x-api-key",
  const N extends string,
  const R extends "none" | "upstream_managed_credential",
>(profileId: P, wireKind: W, credentialHeaderName: H, principalAndKeyNamespace: N, requirementAuthKind: R) {
  return defineExactAuthOracleV6({
    profileId,
    requirementAuthKind,
    semanticAuthFlowKind: "static_or_brokered_request_credential",
    custodyKind: "manual_secret_broker",
    wireKind,
    credentialHeaderName,
    challengeKind: "optional_server_challenge",
    principalAndKeyNamespace,
    endpointIdentityMustContainPrincipalCredentialVersionAndRecipient: true,
  }, STATIC_REQUEST_CREDENTIAL_FLOW_V7);
}

const WIRE_OPENAI_CHAT_V6 = defineExactWireOracleV6({ transport: "fixed_https", profileId: "wire-oracle:openai-chat@6", method: "POST", endpointOrigin: "https://api.openai.com", operationPath: "/v1/chat/completions", modelsRequest: { method: "GET", path: "/v1/models" }, modelPlacement: "request_body_model", publicConstantHeaders: [{ name: "Content-Type", value: "application/json" }], queryPolicy: "none", realmAndCredentialRecipientPolicyId: "openai-platform-global", streamingTerminalPolicy: "http_status_before_stream_then_protocol_terminal" });
const WIRE_OPENAI_RESPONSES_V6 = defineExactWireOracleV6({ transport: "fixed_https", profileId: "wire-oracle:openai-responses@6", method: "POST", endpointOrigin: "https://api.openai.com", operationPath: "/v1/responses", modelsRequest: { method: "GET", path: "/v1/models" }, modelPlacement: "request_body_model", publicConstantHeaders: [{ name: "Content-Type", value: "application/json" }], queryPolicy: "none", realmAndCredentialRecipientPolicyId: "openai-platform-global", streamingTerminalPolicy: "http_status_before_stream_then_protocol_terminal" });
const WIRE_ANTHROPIC_MESSAGES_V6 = defineExactWireOracleV6({ transport: "fixed_https", profileId: "wire-oracle:anthropic-messages@6", method: "POST", endpointOrigin: "https://api.anthropic.com", operationPath: "/v1/messages", modelsRequest: { method: "GET", path: "/v1/models" }, modelPlacement: "request_body_model", publicConstantHeaders: [{ name: "Content-Type", value: "application/json" }, { name: "anthropic-version", value: "2023-06-01" }], queryPolicy: "none", realmAndCredentialRecipientPolicyId: "anthropic-api-global", streamingTerminalPolicy: "http_status_before_stream_then_protocol_terminal" });
const WIRE_GEMINI_GENERATE_V6 = defineExactWireOracleV6({ transport: "fixed_https", profileId: "wire-oracle:google-gemini-generate-content@6", method: "POST", endpointOrigin: "https://generativelanguage.googleapis.com", operationPath: "/v1beta/models/{model}:generateContent", modelsRequest: { method: "GET", path: "/v1beta/models" }, modelPlacement: "operation_path_model", publicConstantHeaders: [{ name: "Content-Type", value: "application/json" }], queryPolicy: "none", realmAndCredentialRecipientPolicyId: "google-gemini-project-key", streamingTerminalPolicy: "http_status_before_stream_then_protocol_terminal" });
const WIRE_VERTEX_GENERATE_V6 = defineExactWireOracleV6({ transport: "vertex_location_resolved_https", profileId: "wire-oracle:vertex-generate-content@6", method: "POST", globalOrigin: "https://aiplatform.googleapis.com", regionalOriginTemplate: "https://{location}-aiplatform.googleapis.com", operationPathTemplate: "/v1/projects/{project}/locations/{location}/publishers/google/models/{model}:generateContent", streamOperationPathTemplate: "/v1/projects/{project}/locations/{location}/publishers/google/models/{model}:streamGenerateContent", requiredTemplateVariables: ["project", "location", "model"], locationResolutionRules: [{ family: "global", location: "global", exactOrigin: "https://aiplatform.googleapis.com" }, { family: "regional", locationPattern: "google-cloud-location-id", exactOriginTemplate: "https://{location}-aiplatform.googleapis.com" }], signedRegionModelAvailabilityEvidenceRequiredBeforeDns: true, modelsRequest: { kind: "not_supported" }, modelPlacement: "operation_path_project_location_publisher_model", publicConstantHeaders: [{ name: "Content-Type", value: "application/json" }], queryPolicy: "none", realmAndCredentialRecipientPolicyId: "google-cloud-project-location-principal", streamingTerminalPolicy: "http_status_before_stream_then_protocol_terminal" });
const WIRE_AZURE_CHAT_V6 = defineExactWireOracleV6({ transport: "templated_https", profileId: "wire-oracle:azure-openai-v1-chat@6", method: "POST", originTemplate: "https://{resource}.openai.azure.com", operationPathTemplate: "/openai/v1/chat/completions", requiredTemplateVariables: ["resource"], modelsRequest: { kind: "not_supported" }, modelPlacement: "request_body_model", publicConstantHeaders: [{ name: "Content-Type", value: "application/json" }], queryPolicy: "none", realmAndCredentialRecipientPolicyId: "azure-resource-tenant-principal", streamingTerminalPolicy: "http_status_before_stream_then_protocol_terminal" });
const WIRE_AZURE_RESPONSES_V6 = defineExactWireOracleV6({ transport: "templated_https", profileId: "wire-oracle:azure-openai-v1-responses@6", method: "POST", originTemplate: "https://{resource}.openai.azure.com", operationPathTemplate: "/openai/v1/responses", requiredTemplateVariables: ["resource"], modelsRequest: { kind: "not_supported" }, modelPlacement: "request_body_model", publicConstantHeaders: [{ name: "Content-Type", value: "application/json" }], queryPolicy: "none", realmAndCredentialRecipientPolicyId: "azure-resource-tenant-principal", streamingTerminalPolicy: "http_status_before_stream_then_protocol_terminal" });
const WIRE_BEDROCK_CONVERSE_V6 = defineExactWireOracleV6({ transport: "templated_https", profileId: "wire-oracle:bedrock-converse@6", method: "POST", originTemplate: "https://bedrock-runtime.{region}.{dnsSuffix}", operationPathTemplate: "/model/{modelId}/converse", requiredTemplateVariables: ["region", "dnsSuffix", "modelId"], modelsRequest: { kind: "not_supported" }, modelPlacement: "operation_path_model", publicConstantHeaders: [{ name: "Content-Type", value: "application/json" }], queryPolicy: "none", realmAndCredentialRecipientPolicyId: "aws-account-region-bedrock-principal", streamingTerminalPolicy: "http_status_before_stream_then_protocol_terminal" });
const WIRE_OPENROUTER_CHAT_V6 = defineExactWireOracleV6({ transport: "fixed_https", profileId: "wire-oracle:openrouter-chat@6", method: "POST", endpointOrigin: "https://openrouter.ai", operationPath: "/api/v1/chat/completions", modelsRequest: { method: "GET", path: "/api/v1/models" }, modelPlacement: "request_body_model", publicConstantHeaders: [{ name: "Content-Type", value: "application/json" }], queryPolicy: "none", realmAndCredentialRecipientPolicyId: "openrouter-account-key", streamingTerminalPolicy: "http_status_before_stream_then_protocol_terminal" });
const WIRE_OPENCODE_ZEN_CHAT_V6 = defineExactWireOracleV6({ ...WIRE_OPENAI_CHAT_V6, profileId: "wire-oracle:opencode-zen-chat@6", endpointOrigin: "https://opencode.ai", operationPath: "/zen/v1/chat/completions", modelsRequest: { method: "GET", path: "/zen/v1/models" }, realmAndCredentialRecipientPolicyId: "opencode-zen-key-and-balance" });
const WIRE_OPENCODE_ZEN_RESPONSES_V6 = defineExactWireOracleV6({ ...WIRE_OPENAI_RESPONSES_V6, profileId: "wire-oracle:opencode-zen-responses@6", endpointOrigin: "https://opencode.ai", operationPath: "/zen/v1/responses", modelsRequest: { method: "GET", path: "/zen/v1/models" }, realmAndCredentialRecipientPolicyId: "opencode-zen-key-and-balance" });
const WIRE_OPENCODE_ZEN_MESSAGES_V6 = defineExactWireOracleV6({ ...WIRE_ANTHROPIC_MESSAGES_V6, profileId: "wire-oracle:opencode-zen-messages@6", endpointOrigin: "https://opencode.ai", operationPath: "/zen/v1/messages", modelsRequest: { method: "GET", path: "/zen/v1/models" }, realmAndCredentialRecipientPolicyId: "opencode-zen-key-and-balance" });
const WIRE_OPENCODE_GO_CHAT_V6 = defineExactWireOracleV6({ ...WIRE_OPENAI_CHAT_V6, profileId: "wire-oracle:opencode-go-chat@6", endpointOrigin: "https://opencode.ai", operationPath: "/zen/go/v1/chat/completions", modelsRequest: { method: "GET", path: "/zen/go/v1/models" }, realmAndCredentialRecipientPolicyId: "opencode-go-subscription-key" });
const WIRE_OPENCODE_GO_RESPONSES_V6 = defineExactWireOracleV6({ ...WIRE_OPENAI_RESPONSES_V6, profileId: "wire-oracle:opencode-go-responses@6", endpointOrigin: "https://opencode.ai", operationPath: "/zen/go/v1/responses", modelsRequest: { method: "GET", path: "/zen/go/v1/models" }, realmAndCredentialRecipientPolicyId: "opencode-go-subscription-key" });
const WIRE_OPENCODE_GO_MESSAGES_V6 = defineExactWireOracleV6({ ...WIRE_ANTHROPIC_MESSAGES_V6, profileId: "wire-oracle:opencode-go-messages@6", endpointOrigin: "https://opencode.ai", operationPath: "/zen/go/v1/messages", modelsRequest: { method: "GET", path: "/zen/go/v1/models" }, realmAndCredentialRecipientPolicyId: "opencode-go-subscription-key" });
const WIRE_ZAI_CHAT_V6 = defineExactWireOracleV6({ ...WIRE_OPENAI_CHAT_V6, profileId: "wire-oracle:z-ai-global-chat@6", endpointOrigin: "https://api.z.ai", operationPath: "/api/paas/v4/chat/completions", modelsRequest: { kind: "not_supported" }, realmAndCredentialRecipientPolicyId: "z-ai-global-account-key" });
const WIRE_MINIMAX_GLOBAL_CHAT_V6 = defineExactWireOracleV6({ ...WIRE_OPENAI_CHAT_V6, profileId: "wire-oracle:minimax-global-chat@6", endpointOrigin: "https://api.minimax.io", operationPath: "/v1/chat/completions", modelsRequest: { kind: "not_supported" }, realmAndCredentialRecipientPolicyId: "minimax-international-account-key" });
const WIRE_MINIMAX_CN_CHAT_V6 = defineExactWireOracleV6({ ...WIRE_OPENAI_CHAT_V6, profileId: "wire-oracle:minimax-cn-chat@6", endpointOrigin: "https://api.minimaxi.com", operationPath: "/v1/chat/completions", modelsRequest: { kind: "not_supported" }, realmAndCredentialRecipientPolicyId: "minimax-china-account-key" });
const WIRE_DASHSCOPE_GLOBAL_CHAT_V6 = defineExactWireOracleV6({ ...WIRE_OPENAI_CHAT_V6, profileId: "wire-oracle:dashscope-singapore-chat@6", endpointOrigin: "https://dashscope-intl.aliyuncs.com", operationPath: "/compatible-mode/v1/chat/completions", modelsRequest: { kind: "not_supported" }, realmAndCredentialRecipientPolicyId: "dashscope-singapore-workspace-key" });
const WIRE_DASHSCOPE_CN_CHAT_V6 = defineExactWireOracleV6({ ...WIRE_OPENAI_CHAT_V6, profileId: "wire-oracle:dashscope-beijing-chat@6", endpointOrigin: "https://dashscope.aliyuncs.com", operationPath: "/compatible-mode/v1/chat/completions", modelsRequest: { kind: "not_supported" }, realmAndCredentialRecipientPolicyId: "dashscope-beijing-workspace-key" });
const WIRE_SILICONFLOW_GLOBAL_CHAT_V6 = defineExactWireOracleV6({ ...WIRE_OPENAI_CHAT_V6, profileId: "wire-oracle:siliconflow-global-chat@6", endpointOrigin: "https://api.siliconflow.com", operationPath: "/v1/chat/completions", realmAndCredentialRecipientPolicyId: "siliconflow-global-account-key" });
const WIRE_SILICONFLOW_CN_CHAT_V6 = defineExactWireOracleV6({ ...WIRE_OPENAI_CHAT_V6, profileId: "wire-oracle:siliconflow-cn-chat@6", endpointOrigin: "https://api.siliconflow.cn", operationPath: "/v1/chat/completions", realmAndCredentialRecipientPolicyId: "siliconflow-china-account-key" });
const WIRE_BYTEPLUS_RESPONSES_V6 = defineExactWireOracleV6({ transport: "release_signed_region_catalog_https", profileId: "wire-oracle:byteplus-modelark-responses@6", method: "POST", regionEndpointCatalog: [{ regionId: "ap-southeast-1", endpointOrigin: "https://ark.ap-southeast.bytepluses.com" }, { regionId: "eu-west-1", endpointOrigin: "https://ark.eu-west.bytepluses.com" }], operationPath: "/api/v3/responses", modelsRequest: { kind: "not_supported" }, modelPlacement: "request_body_model", publicConstantHeaders: [{ name: "Content-Type", value: "application/json" }], queryPolicy: "none", realmAndCredentialRecipientPolicyId: "byteplus-region-endpoint-key", releaseSignedRegionCatalogAndModelAvailabilityEvidenceRequiredBeforeDns: true, regionIdIsNeverInterpolatedIntoDns: true, streamingTerminalPolicy: "http_status_before_stream_then_protocol_terminal" });
const WIRE_BIGMODEL_CHAT_V6 = defineExactWireOracleV6({ ...WIRE_OPENAI_CHAT_V6, profileId: "wire-oracle:zhipu-bigmodel-chat@6", endpointOrigin: "https://open.bigmodel.cn", operationPath: "/api/paas/v4/chat/completions", modelsRequest: { kind: "not_supported" }, realmAndCredentialRecipientPolicyId: "zhipu-ordinary-platform-key" });
const WIRE_BIGMODEL_MESSAGES_V6 = defineExactWireOracleV6({ ...WIRE_ANTHROPIC_MESSAGES_V6, profileId: "wire-oracle:zhipu-bigmodel-messages@6", endpointOrigin: "https://open.bigmodel.cn", operationPath: "/api/anthropic/v1/messages", modelsRequest: { kind: "not_supported" }, realmAndCredentialRecipientPolicyId: "zhipu-ordinary-platform-key" });
const WIRE_KIMI_PLATFORM_CHAT_V6 = defineExactWireOracleV6({ ...WIRE_OPENAI_CHAT_V6, profileId: "wire-oracle:kimi-platform-chat@6", endpointOrigin: "https://api.moonshot.cn", operationPath: "/v1/chat/completions", realmAndCredentialRecipientPolicyId: "kimi-platform-payg-key" });
const WIRE_KIMI_CODE_CHAT_V6 = defineExactWireOracleV6({ ...WIRE_OPENAI_CHAT_V6, profileId: "wire-oracle:kimi-code-chat@6", endpointOrigin: "https://api.kimi.com", operationPath: "/coding/v1/chat/completions", modelsRequest: { kind: "not_supported" }, realmAndCredentialRecipientPolicyId: "kimi-code-membership-key" });
const WIRE_KIMI_CODE_MESSAGES_V6 = defineExactWireOracleV6({ ...WIRE_ANTHROPIC_MESSAGES_V6, profileId: "wire-oracle:kimi-code-messages@6", endpointOrigin: "https://api.kimi.com", operationPath: "/coding/v1/messages", modelsRequest: { kind: "not_supported" }, realmAndCredentialRecipientPolicyId: "kimi-code-membership-key" });
const WIRE_DEEPSEEK_CHAT_V6 = defineExactWireOracleV6({ ...WIRE_OPENAI_CHAT_V6, profileId: "wire-oracle:deepseek-chat@6", endpointOrigin: "https://api.deepseek.com", operationPath: "/chat/completions", modelsRequest: { method: "GET", path: "/models" }, realmAndCredentialRecipientPolicyId: "deepseek-platform-key" });
const WIRE_ARK_CN_RESPONSES_V6 = defineExactWireOracleV6({ ...WIRE_OPENAI_RESPONSES_V6, profileId: "wire-oracle:volcengine-ark-cn-responses@6", endpointOrigin: "https://ark.cn-beijing.volces.com", operationPath: "/api/v3/responses", modelsRequest: { kind: "not_supported" }, realmAndCredentialRecipientPolicyId: "volcengine-ark-resource-key" });
const WIRE_TOKENHUB_GZ_CHAT_V6 = defineExactWireOracleV6({ ...WIRE_OPENAI_CHAT_V6, profileId: "wire-oracle:tokenhub-guangzhou-chat@6", endpointOrigin: "https://tokenhub.tencentmaas.com", operationPath: "/v1/chat/completions", realmAndCredentialRecipientPolicyId: "tokenhub-guangzhou-site-key", streamingTerminalPolicy: "http_status_or_typed_sse_error_terminal" });
const WIRE_TOKENHUB_GZ_RESPONSES_V6 = defineExactWireOracleV6({ ...WIRE_OPENAI_RESPONSES_V6, profileId: "wire-oracle:tokenhub-guangzhou-responses@6", endpointOrigin: "https://tokenhub.tencentmaas.com", operationPath: "/v1/responses", realmAndCredentialRecipientPolicyId: "tokenhub-guangzhou-site-key", streamingTerminalPolicy: "http_status_or_typed_sse_error_terminal" });
const WIRE_TOKENHUB_GZ_MESSAGES_V6 = defineExactWireOracleV6({ ...WIRE_ANTHROPIC_MESSAGES_V6, profileId: "wire-oracle:tokenhub-guangzhou-messages@6", endpointOrigin: "https://tokenhub.tencentmaas.com", operationPath: "/v1/messages", realmAndCredentialRecipientPolicyId: "tokenhub-guangzhou-site-key", streamingTerminalPolicy: "http_status_or_typed_sse_error_terminal" });
const WIRE_TOKENHUB_SG_CHAT_V6 = defineExactWireOracleV6({ ...WIRE_TOKENHUB_GZ_CHAT_V6, profileId: "wire-oracle:tokenhub-singapore-chat@6", endpointOrigin: "https://tokenhub-intl.tencentmaas.com", realmAndCredentialRecipientPolicyId: "tokenhub-singapore-site-key", streamingTerminalPolicy: "http_status_or_typed_sse_error_terminal" });
const WIRE_TOKENHUB_SG_RESPONSES_V6 = defineExactWireOracleV6({ ...WIRE_TOKENHUB_GZ_RESPONSES_V6, profileId: "wire-oracle:tokenhub-singapore-responses@6", endpointOrigin: "https://tokenhub-intl.tencentmaas.com", realmAndCredentialRecipientPolicyId: "tokenhub-singapore-site-key" });
const WIRE_TOKENHUB_SG_MESSAGES_V6 = defineExactWireOracleV6({ ...WIRE_TOKENHUB_GZ_MESSAGES_V6, profileId: "wire-oracle:tokenhub-singapore-messages@6", endpointOrigin: "https://tokenhub-intl.tencentmaas.com", realmAndCredentialRecipientPolicyId: "tokenhub-singapore-site-key" });
const WIRE_TENCENT_ENTERPRISE_PLAN_GZ_CHAT_V20 = defineExactWireOracleV6({ ...WIRE_OPENAI_CHAT_V6, profileId: "wire-oracle:tencent-enterprise-token-plan-guangzhou-chat@6", endpointOrigin: "https://tokenhub.tencentmaas.com", operationPath: "/plan/v3/chat/completions", modelsRequest: { kind: "not_supported" }, realmAndCredentialRecipientPolicyId: "tencent-enterprise-token-plan-guangzhou-key", streamingTerminalPolicy: "http_status_or_typed_sse_error_terminal" });
const WIRE_TENCENT_ENTERPRISE_PLAN_GZ_MESSAGES_V20 = defineExactWireOracleV6({ ...WIRE_ANTHROPIC_MESSAGES_V6, profileId: "wire-oracle:tencent-enterprise-token-plan-guangzhou-messages@6", endpointOrigin: "https://tokenhub.tencentmaas.com", operationPath: "/plan/anthropic/v1/messages", modelsRequest: { kind: "not_supported" }, realmAndCredentialRecipientPolicyId: "tencent-enterprise-token-plan-guangzhou-key", streamingTerminalPolicy: "http_status_or_typed_sse_error_terminal" });
const WIRE_TENCENT_ENTERPRISE_PLAN_SG_CHAT_V20 = defineExactWireOracleV6({ ...WIRE_TENCENT_ENTERPRISE_PLAN_GZ_CHAT_V20, profileId: "wire-oracle:tencent-enterprise-token-plan-singapore-chat@6", endpointOrigin: "https://tokenhub-intl.tencentmaas.com", realmAndCredentialRecipientPolicyId: "tencent-enterprise-token-plan-singapore-key" });
const WIRE_TENCENT_ENTERPRISE_PLAN_SG_MESSAGES_V20 = defineExactWireOracleV6({ ...WIRE_TENCENT_ENTERPRISE_PLAN_GZ_MESSAGES_V20, profileId: "wire-oracle:tencent-enterprise-token-plan-singapore-messages@6", endpointOrigin: "https://tokenhub-intl.tencentmaas.com", realmAndCredentialRecipientPolicyId: "tencent-enterprise-token-plan-singapore-key" });
const WIRE_HUNYUAN_LEGACY_CHAT_V6 = defineExactWireOracleV6({ ...WIRE_OPENAI_CHAT_V6, profileId: "wire-oracle:tencent-hunyuan-legacy-openai-chat@6", endpointOrigin: "https://api.hunyuan.cloud.tencent.com", operationPath: "/v1/chat/completions", modelsRequest: { kind: "not_supported" }, realmAndCredentialRecipientPolicyId: "hunyuan-legacy-api-key-migration-only" });
const WIRE_QIANFAN_CHAT_V6 = defineExactWireOracleV6({ ...WIRE_OPENAI_CHAT_V6, profileId: "wire-oracle:baidu-qianfan-v2-chat@6", endpointOrigin: "https://qianfan.baidubce.com", operationPath: "/v2/chat/completions", modelsRequest: { kind: "not_supported" }, realmAndCredentialRecipientPolicyId: "baidu-qianfan-account-key" });
const WIRE_OLLAMA_CHAT_V6 = defineExactWireOracleV6({ transport: "loopback_discovered_http", profileId: "wire-oracle:ollama-chat@6", method: "POST", signedProductIdentity: "ollama", allowedCanonicalHosts: ["127.0.0.1", "::1"], defaultOrigin: "http://127.0.0.1:11434", operationPath: "/v1/chat/completions", modelsRequest: { method: "GET", path: "/v1/models" }, modelPlacement: "request_body_model", publicConstantHeaders: [{ name: "Content-Type", value: "application/json" }], endpointPathCanOnlyComeFromThisLiteralOrSignedProductOpenApi: true, lanRequiresExplicitActiveEndpointIdentityAndCannotReuseLoopbackReceipt: true, streamingTerminalPolicy: "http_status_before_stream_then_protocol_terminal" });
const WIRE_OLLAMA_RESPONSES_V6 = defineExactWireOracleV6({ ...WIRE_OLLAMA_CHAT_V6, profileId: "wire-oracle:ollama-responses@6", operationPath: "/v1/responses" });
const WIRE_LMSTUDIO_CHAT_V6 = defineExactWireOracleV6({ ...WIRE_OLLAMA_CHAT_V6, profileId: "wire-oracle:lm-studio-chat@6", signedProductIdentity: "lm-studio", defaultOrigin: "http://127.0.0.1:1234", operationPath: "/v1/chat/completions" });
const WIRE_LMSTUDIO_RESPONSES_V6 = defineExactWireOracleV6({ ...WIRE_LMSTUDIO_CHAT_V6, profileId: "wire-oracle:lm-studio-responses@6", operationPath: "/v1/responses" });
const WIRE_LMSTUDIO_MESSAGES_V6 = defineExactWireOracleV6({ ...WIRE_LMSTUDIO_CHAT_V6, profileId: "wire-oracle:lm-studio-messages@6", operationPath: "/v1/messages", publicConstantHeaders: [{ name: "Content-Type", value: "application/json" }, { name: "anthropic-version", value: "2023-06-01" }] });
const WIRE_OMLX_CHAT_V6 = defineExactWireOracleV6({ ...WIRE_OLLAMA_CHAT_V6, profileId: "wire-oracle:omlx-chat@6", signedProductIdentity: "omlx", defaultOrigin: "http://127.0.0.1:8000", operationPath: "/v1/chat/completions" });
const WIRE_OMLX_RESPONSES_V6 = defineExactWireOracleV6({ ...WIRE_OMLX_CHAT_V6, profileId: "wire-oracle:omlx-responses@6", operationPath: "/v1/responses" });
const WIRE_OMLX_MESSAGES_V6 = defineExactWireOracleV6({ ...WIRE_OMLX_CHAT_V6, profileId: "wire-oracle:omlx-messages@6", operationPath: "/v1/messages", publicConstantHeaders: [{ name: "Content-Type", value: "application/json" }, { name: "anthropic-version", value: "2023-06-01" }] });
const WIRE_DOCKER_MODEL_RUNNER_V6 = defineExactWireOracleV6({ transport: "runtime_openapi_bound_http", profileId: "wire-oracle:docker-model-runner-chat@6", signedProductIdentity: "docker-model-runner", allowedCanonicalHosts: ["127.0.0.1", "::1"], defaultOrigin: "no_single_default_runtime_discovery_required", operationSelector: { kind: "signed_openapi_operation", operationId: "openai.chat.completions.create" }, openApiDocumentOperationAndProcessGenerationMustBindEndpointIdentity: true, applicationSecretReadBeforeOperationAndPeerBindingForbidden: true });
const WIRE_PODMAN_AI_LAB_V6 = defineExactWireOracleV6({ ...WIRE_DOCKER_MODEL_RUNNER_V6, profileId: "wire-oracle:podman-ai-lab-chat@6", signedProductIdentity: "podman-ai-lab" });
const WIRE_CODEX_APP_SERVER_V6 = defineExactWireOracleV6({ transport: "local_process_protocol", profileId: "wire-oracle:codex-app-server-stdio@6", processProtocol: "app_server_stdio", signedProductOrUserSelectedDriverIdentity: "openai-codex-app-server", httpMethodOriginPathModelsAndHeaders: "not_applicable" });
const WIRE_KIMI_ACP_V6 = defineExactWireOracleV6({ transport: "local_process_protocol", profileId: "wire-oracle:kimi-acp-stdio@6", processProtocol: "acp_stdio", signedProductOrUserSelectedDriverIdentity: "kimi-code-server-acp", httpMethodOriginPathModelsAndHeaders: "not_applicable" });
const WIRE_OPENCODE_SERVER_V6 = defineExactWireOracleV6({ transport: "runtime_openapi_bound_http", profileId: "wire-oracle:opencode-server-openapi@6", signedProductIdentity: "opencode-server", allowedCanonicalHosts: ["127.0.0.1", "::1"], defaultOrigin: "http://127.0.0.1:4096", operationSelector: { kind: "literal_method_path", method: "POST", pathTemplate: "/session/{sessionId}/message" }, openApiDocumentOperationAndProcessGenerationMustBindEndpointIdentity: true, applicationSecretReadBeforeOperationAndPeerBindingForbidden: true });
const WIRE_OPENCODE_ACP_V6 = defineExactWireOracleV6({ transport: "local_process_protocol", profileId: "wire-oracle:opencode-acp-stdio@6", processProtocol: "acp_stdio", signedProductOrUserSelectedDriverIdentity: "opencode-acp", httpMethodOriginPathModelsAndHeaders: "not_applicable" });
const WIRE_GENERIC_CLI_V6 = defineExactWireOracleV6({ transport: "local_process_protocol", profileId: "wire-oracle:user-selected-cli-stdio@6", processProtocol: "cli_stdio", signedProductOrUserSelectedDriverIdentity: "user-selected-versioned-execution-driver", httpMethodOriginPathModelsAndHeaders: "not_applicable" });
const WIRE_CC_SWITCH_MESSAGES_V6 = defineExactWireOracleV6({ ...WIRE_LMSTUDIO_MESSAGES_V6, profileId: "wire-oracle:cc-switch-public-proxy-messages@6", signedProductIdentity: "cc-switch-desktop-public-proxy", defaultOrigin: "http://127.0.0.1:15721", operationPath: "/v1/messages", modelsRequest: { kind: "not_supported" } });
const WIRE_LITELLM_CHAT_V6 = defineExactWireOracleV6({ ...WIRE_OLLAMA_CHAT_V6, profileId: "wire-oracle:litellm-proxy-chat@6", signedProductIdentity: "litellm-proxy", defaultOrigin: "http://127.0.0.1:4000", operationPath: "/v1/chat/completions" });
const WIRE_LITELLM_RESPONSES_V6 = defineExactWireOracleV6({ ...WIRE_LITELLM_CHAT_V6, profileId: "wire-oracle:litellm-proxy-responses@6", operationPath: "/v1/responses" });
const WIRE_LITELLM_MESSAGES_V6 = defineExactWireOracleV6({ ...WIRE_LITELLM_CHAT_V6, profileId: "wire-oracle:litellm-proxy-messages@6", operationPath: "/v1/messages", publicConstantHeaders: [{ name: "Content-Type", value: "application/json" }, { name: "anthropic-version", value: "2023-06-01" }] });
const WIRE_ANCHOR_CONTROL_V6 = defineExactWireOracleV6({ transport: "local_process_protocol", profileId: "wire-oracle:saydo-anchor-control@6", processProtocol: "cli_stdio", signedProductOrUserSelectedDriverIdentity: "saydo-platform-security-helper", httpMethodOriginPathModelsAndHeaders: "not_applicable" });
const WIRE_CUSTOM_CHAT_V6 = defineExactWireOracleV6({ transport: "custom_configured_https_or_explicit_private_http", profileId: "wire-oracle:custom-openai-chat@6", method: "POST", protocolProfile: "openai_chat_completions", baseSemantics: "api_root_or_version_root_explicit_never_guessed", operationRelativePaths: { apiRoot: "v1/chat/completions", versionRoot: "chat/completions" }, relativeRfc3986DirectoryResolutionOnly: true, leadingSlashDotSegmentEncodedSeparatorQueryAndFragmentForbidden: true, endpointIdentityIncludesFinalOriginPathProtocolAuthRecipientAndCredentialVersion: true });
const WIRE_CUSTOM_RESPONSES_V6 = defineExactWireOracleV6({ ...WIRE_CUSTOM_CHAT_V6, profileId: "wire-oracle:custom-openai-responses@6", protocolProfile: "openai_responses", operationRelativePaths: { apiRoot: "v1/responses", versionRoot: "responses" } });
const WIRE_CUSTOM_MESSAGES_V6 = defineExactWireOracleV6({ ...WIRE_CUSTOM_CHAT_V6, profileId: "wire-oracle:custom-anthropic-messages@6", protocolProfile: "anthropic_messages", operationRelativePaths: { apiRoot: "v1/messages", versionRoot: "messages" } });

const AUTH_GOOGLE_API_KEY_V6 = defineExactAuthOracleV6({ profileId: "auth-oracle:google-gemini-api-key@6", requirementAuthKind: "registry_header", semanticAuthFlowKind: "static_or_brokered_request_credential", custodyKind: "manual_secret_broker", wireKind: "google_api_key", credentialHeaderName: "x-goog-api-key", challengeKind: "none", principalAndKeyNamespace: "google-cloud-project-api-key", endpointIdentityMustContainPrincipalCredentialVersionAndRecipient: true }, STATIC_REQUEST_CREDENTIAL_FLOW_V7);
const AUTH_VERTEX_ADC_V7 = defineExactAuthOracleV6(
  { profileId: "auth-oracle:vertex-adc-bearer@6", requirementAuthKind: "workload_identity", semanticAuthFlowKind: "google_adc_oauth", custodyKind: "os_identity_broker", wireKind: "authorization_bearer", credentialHeaderName: "Authorization", challengeKind: "workload_identity", principalAndKeyNamespace: "google-cloud-project-adc-principal", endpointIdentityMustContainPrincipalCredentialVersionAndRecipient: true },
  {
    kind: "google_adc_oauth",
    admissibleCredentialSourceProfiles: [
      { sourceClass: "authorized_user_adc", tokenEndpoint: "https://oauth2.googleapis.com/token", refreshTokenRemainsInBroker: true },
      { sourceClass: "service_account_adc", tokenEndpoint: "https://oauth2.googleapis.com/token", jwtAssertionSigningRemainsInBroker: true },
      { sourceClass: "external_account_adc", stsEndpointPolicy: "validated_global_regional_or_mtls_from_external_account_configuration", exactProviderAudienceAndSubjectTokenTypeRequired: true },
      { sourceClass: "metadata_adc", metadataSourceAdmissionRequired: true },
    ],
    oauthScopes: ["https://www.googleapis.com/auth/cloud-platform"],
    selectedSourceProfilePrincipalProjectScopeAndTokenEndpointEnterCredentialFamilyIdentity: true,
    finalApiCredentialRecipientBoundSeparately: true,
  },
);
const AUTH_VERTEX_WIF_V7 = defineExactAuthOracleV6(
  { profileId: "auth-oracle:vertex-wif-bearer@6", requirementAuthKind: "workload_identity", semanticAuthFlowKind: "google_workload_identity_federation", custodyKind: "os_identity_broker", wireKind: "authorization_bearer", credentialHeaderName: "Authorization", challengeKind: "workload_identity", principalAndKeyNamespace: "google-cloud-project-wif-principal", endpointIdentityMustContainPrincipalCredentialVersionAndRecipient: true },
  {
    kind: "google_workload_identity_federation",
    externalAccountAudienceTemplate: "//iam.googleapis.com/projects/{projectNumber}/locations/global/workloadIdentityPools/{poolId}/providers/{providerId}",
    subjectTokenAudienceSource: "verified_external_account_source_profile_distinct_from_sts_audience",
    sourceProfileCatalog: [
      { sourceClass: "oidc", subjectTokenTypes: ["urn:ietf:params:oauth:token-type:jwt", "urn:ietf:params:oauth:token-type:idToken"], endpointClass: "global_or_release_signed_regional_sts" },
      { sourceClass: "saml2", subjectTokenTypes: ["urn:ietf:params:oauth:token-type:saml2"], endpointClass: "global_or_release_signed_regional_sts" },
      { sourceClass: "aws", subjectTokenTypes: ["urn:ietf:params:aws:token-type:aws4_request"], endpointClass: "global_or_release_signed_regional_sts" },
      { sourceClass: "x509", subjectTokenTypes: ["urn:ietf:params:oauth:token-type:mtls"], endpointClass: "google_mtls_sts_only" },
    ],
    stsEndpointPolicy: "derived_from_validated_external_account_configuration_and_release_allowlist",
    stsMethod: "POST",
    stsGrantType: "urn:ietf:params:oauth:grant-type:token-exchange",
    requestedTokenType: "urn:ietf:params:oauth:token-type:access_token",
    requestedOAuthScopes: ["https://www.googleapis.com/auth/cloud-platform"],
    serviceAccountImpersonationPolicy: "none_or_exact_generate_access_token_physical_operation",
    everyConnectionFlowIsDerivedFromOneVerifiedSourceProfileAndOneExactImpersonationProfile: true,
    finalApiCredentialRecipientBoundSeparately: true,
  },
);
const AUTH_AZURE_KEY_V6 = defineExactAuthOracleV6({ profileId: "auth-oracle:azure-openai-api-key@6", requirementAuthKind: "registry_header", semanticAuthFlowKind: "static_or_brokered_request_credential", custodyKind: "manual_secret_broker", wireKind: "azure_api_key", credentialHeaderName: "api-key", challengeKind: "none", principalAndKeyNamespace: "azure-resource-api-key", endpointIdentityMustContainPrincipalCredentialVersionAndRecipient: true }, STATIC_REQUEST_CREDENTIAL_FLOW_V7);
const AUTH_AZURE_USER_V7 = defineExactAuthOracleV6(
  { profileId: "auth-oracle:azure-entra-user@6", requirementAuthKind: "oauth_device", semanticAuthFlowKind: "azure_entra_oauth", custodyKind: "os_identity_broker", wireKind: "authorization_bearer", credentialHeaderName: "Authorization", challengeKind: "device_authorization", principalAndKeyNamespace: "azure-tenant-user-resource", endpointIdentityMustContainPrincipalCredentialVersionAndRecipient: true },
  { kind: "azure_entra_oauth", authorityHost: "https://login.microsoftonline.com", credentialSourceProfile: { credentialSourceClass: "device_authorized_user", tenantBoundDeviceAuthorizationEndpointTemplate: "https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/devicecode", tenantBoundTokenEndpointTemplate: "https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token", clientIdSource: "exact_selected_public_client_registration", deviceAuthorizationScope: "https://cognitiveservices.azure.com/.default offline_access", tokenPollGrantType: "urn:ietf:params:oauth:grant-type:device_code", startAndPollPhysicalOperationsBindTenantClientAndDeviceCodeExactly: true }, finalApiCredentialRecipientBoundSeparately: true },
);
const AUTH_AZURE_SERVICE_PRINCIPAL_V7 = defineExactAuthOracleV6(
  { profileId: "auth-oracle:azure-entra-service-principal@6", requirementAuthKind: "workload_identity", semanticAuthFlowKind: "azure_entra_oauth", custodyKind: "os_identity_broker", wireKind: "authorization_bearer", credentialHeaderName: "Authorization", challengeKind: "workload_identity", principalAndKeyNamespace: "azure-tenant-service-principal-resource", endpointIdentityMustContainPrincipalCredentialVersionAndRecipient: true },
  { kind: "azure_entra_oauth", authorityHost: "https://login.microsoftonline.com", credentialSourceProfile: { credentialSourceClass: "service_principal", tenantBoundTokenEndpointTemplate: "https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token", clientIdSource: "exact_selected_application_registration", grantType: "client_credentials", assertionKinds: ["client_secret", "client_certificate", "federated_client_assertion"], oauthScope: "https://cognitiveservices.azure.com/.default" }, finalApiCredentialRecipientBoundSeparately: true },
);
const AUTH_AZURE_MANAGED_IDENTITY_V7 = defineExactAuthOracleV6(
  { profileId: "auth-oracle:azure-managed-identity@6", requirementAuthKind: "workload_identity", semanticAuthFlowKind: "azure_managed_identity_metadata", custodyKind: "os_identity_broker", wireKind: "authorization_bearer", credentialHeaderName: "Authorization", challengeKind: "workload_identity", principalAndKeyNamespace: "azure-hosted-managed-identity-resource", endpointIdentityMustContainPrincipalCredentialVersionAndRecipient: true },
  {
    kind: "azure_managed_identity_metadata",
    credentialSourceClass: "managed_identity",
    admissibleHostedSourceProfiles: [
      { kind: "azure_vm_imds", endpoint: "http://169.254.169.254/metadata/identity/oauth2/token", method: "GET", requiredHeader: "Metadata: true", apiVersion: "2018-02-01" },
      { kind: "azure_app_service_identity_endpoint", endpointSource: "attested_IDENTITY_ENDPOINT_environment_value", requiredSecretHeaderSource: "brokered_IDENTITY_HEADER_environment_value", method: "GET", apiVersion: "2019-08-01" },
    ],
    requestedResource: "https://cognitiveservices.azure.com",
    managedIdentitySelectorPolicy: "system_assigned_none_or_user_assigned_exactly_one_of_client_id_object_id_msi_res_id_principal_id",
    sourceEndpointIsAttestedAndNeverDerivedFromApiOrigin: true,
    finalApiCredentialRecipientBoundSeparately: true,
  },
);
const AUTH_BEDROCK_API_KEY_V6 = defineExactAuthOracleV6({ profileId: "auth-oracle:bedrock-long-term-api-key@6", requirementAuthKind: "bearer", semanticAuthFlowKind: "static_or_brokered_request_credential", custodyKind: "manual_secret_broker", wireKind: "authorization_bearer", credentialHeaderName: "Authorization", challengeKind: "none", principalAndKeyNamespace: "aws-account-bedrock-api-key", endpointIdentityMustContainPrincipalCredentialVersionAndRecipient: true }, STATIC_REQUEST_CREDENTIAL_FLOW_V7);
const AWS_BEDROCK_SIGV4_FLOW_V7 = { kind: "aws_sigv4", authorizationHeaderScheme: "AWS4-HMAC-SHA256", requiredBaseSignedHeaderNames: ["host", "x-amz-date", "x-amz-content-sha256"], temporaryCredentialAdditionalSignedHeaderNames: ["x-amz-security-token"], credentialScopeComponents: ["date", "region", "service", "aws4_request"], service: "bedrock-runtime", sessionTokenHeaderPolicy: "required_for_temporary_credentials_and_forbidden_otherwise", canonicalRequestAndStringToSignEvidenceRequired: true, finalApiCredentialRecipientBoundSeparately: true } as const;
function awsBedrockSigV4AuthOracleV7<
  const P extends `auth-oracle:${string}@6`,
  const R extends "aws_static_profile_sigv4" | "workload_identity",
>(profileId: P, requirementAuthKind: R) {
  return defineExactAuthOracleV6(
    { profileId, requirementAuthKind, semanticAuthFlowKind: "aws_sigv4", custodyKind: "official_sdk_signer", wireKind: "aws_sigv4", credentialHeaderName: "Authorization", challengeKind: "workload_identity", principalAndKeyNamespace: "aws-account-profile-role-session", endpointIdentityMustContainPrincipalCredentialVersionAndRecipient: true },
    AWS_BEDROCK_SIGV4_FLOW_V7,
  );
}
const AUTH_AWS_STATIC_PROFILE_SIGV4_V7 = awsBedrockSigV4AuthOracleV7("auth-oracle:aws-bedrock-static-profile-sigv4@6", "aws_static_profile_sigv4");
const AUTH_AWS_WORKLOAD_SIGV4_V7 = awsBedrockSigV4AuthOracleV7("auth-oracle:aws-bedrock-workload-sigv4@6", "workload_identity");
const OPENROUTER_API_KEY_PKCE_EXCHANGE_FLOW_V8 = {
  kind: "api_key_pkce_exchange",
  authorizationEndpoint: "https://openrouter.ai/auth",
  authorizationMethod: "GET",
  responseType: "code",
  codeChallengeMethod: "S256",
  callbackStateAndVerifierMustEqualTheExactBrowserLaunchFamily: true,
  exchangeEndpoint: "https://openrouter.ai/api/v1/auth/keys",
  exchangeMethod: "POST",
  exchangeBodyFields: ["code", "code_verifier", "code_challenge_method"],
  exchangeProducesBrokeredApiKeyFamilyBeforeFinalBearerUse: true,
  finalApiCredentialRecipientBoundSeparately: true,
} as const;
const AUTH_OPENROUTER_PKCE_V8 = defineExactAuthOracleV6(
  { profileId: "auth-oracle:openrouter-pkce-key@6", requirementAuthKind: "api_key_pkce_exchange", semanticAuthFlowKind: "api_key_pkce_exchange", custodyKind: "os_identity_broker", wireKind: "authorization_bearer", credentialHeaderName: "Authorization", challengeKind: "browser_pkce", principalAndKeyNamespace: "openrouter-account-exchanged-key", endpointIdentityMustContainPrincipalCredentialVersionAndRecipient: true },
  OPENROUTER_API_KEY_PKCE_EXCHANGE_FLOW_V8,
);
const AUTH_EXECUTION_UPSTREAM_V6 = defineExactAuthOracleV6({ profileId: "auth-oracle:execution-upstream-managed@6", requirementAuthKind: "upstream_managed_credential", semanticAuthFlowKind: "upstream_application_or_no_application_credential", custodyKind: "upstream_application", wireKind: "none", credentialHeaderName: "none", challengeKind: "none", principalAndKeyNamespace: "upstream-execution-session", endpointIdentityMustContainPrincipalCredentialVersionAndRecipient: false }, UPSTREAM_OR_NO_APPLICATION_CREDENTIAL_FLOW_V7);
const AUTH_OPENCODE_SERVER_OPTIONAL_V6 = optionalServerAuthOracleV6("auth-oracle:opencode-server-optional-basic@6", "http_basic", "Authorization", "opencode-server-endpoint-principal", "upstream_managed_credential");
const AUTH_LMSTUDIO_OPTIONAL_V6 = optionalServerAuthOracleV6("auth-oracle:lm-studio-optional-bearer@6", "authorization_bearer", "Authorization", "lm-studio-process-token", "none");
const AUTH_LMSTUDIO_MESSAGES_OPTIONAL_ANTHROPIC_V9 = optionalServerAuthOracleV6("auth-oracle:lm-studio-messages-optional-anthropic-auth-preferred-x-api-key@6", "anthropic_x_api_key", "x-api-key", "lm-studio-process-token", "none");
const AUTH_LITELLM_OPTIONAL_V6 = optionalServerAuthOracleV6("auth-oracle:litellm-optional-bearer@6", "authorization_bearer", "Authorization", "litellm-proxy-principal-key", "upstream_managed_credential");
const AUTH_CUSTOM_MTLS_V6 = defineExactAuthOracleV6({ profileId: "auth-oracle:custom-mtls@6", requirementAuthKind: "transport_mtls_only", semanticAuthFlowKind: "static_or_brokered_request_credential", custodyKind: "os_identity_broker", wireKind: "mutual_tls", credentialHeaderName: "none", challengeKind: "none", principalAndKeyNamespace: "custom-endpoint-client-certificate", endpointIdentityMustContainPrincipalCredentialVersionAndRecipient: true }, STATIC_REQUEST_CREDENTIAL_FLOW_V7);
const AUTH_CUSTOM_HEADER_V6 = defineExactAuthOracleV6({ profileId: "auth-oracle:custom-secret-header@6", requirementAuthKind: "custom_secret_header", semanticAuthFlowKind: "static_or_brokered_request_credential", custodyKind: "manual_secret_broker", wireKind: "configured_secret_header", credentialHeaderName: "configured", challengeKind: "none", principalAndKeyNamespace: "custom-endpoint-configured-header", endpointIdentityMustContainPrincipalCredentialVersionAndRecipient: true }, STATIC_REQUEST_CREDENTIAL_FLOW_V7);
const AUTH_TOKENHUB_GZ_MODELS_V7 = manualBearerAuthV6("auth-oracle:tokenhub-guangzhou-models-bearer@6", "tokenhub-guangzhou-site-key");
const AUTH_TOKENHUB_SG_MODELS_V7 = manualBearerAuthV6("auth-oracle:tokenhub-singapore-models-bearer@6", "tokenhub-singapore-site-key");

const GEMINI_STREAM_OPERATION_OVERRIDES_V7 = {
  streamMethodAndPath: { method: "POST", pathOrTemplate: "/v1beta/models/{model}:streamGenerateContent", fixedQuery: "?alt=sse", framing: "sse" },
} as const;
const VERTEX_STREAM_OPERATION_OVERRIDES_V7 = {
  streamMethodAndPath: { method: "POST", pathOrTemplate: "/v1/projects/{project}/locations/{location}/publishers/google/models/{model}:streamGenerateContent", fixedQuery: "?alt=sse", framing: "sse" },
} as const;
const BEDROCK_STREAM_OPERATION_OVERRIDES_V7 = {
  streamMethodAndPath: { method: "POST", pathOrTemplate: "/model/{modelId}/converse-stream", fixedQuery: "none", framing: "aws_event_stream" },
} as const;
const KIMI_CODE_USER_AGENT_OVERRIDES_V7 = {
  operationDynamicPublicHeaderPolicy: { kind: "signed_distribution_user_agent", productToken: "SayDo", versionSource: "signed_distribution_manifest", impersonationOfClaudeOpenCodeCodexOrAnotherClientForbidden: true },
} as const;
const LMSTUDIO_MESSAGES_OPTIONAL_AUTH_OVERRIDES_V9 = {
  optionalAuthWireAlternatives: {
    acceptedWhenRequireAuthenticationIsEnabled: ["anthropic_x_api_key", "authorization_bearer"],
    deterministicPreferenceOrder: ["anthropic_x_api_key", "authorization_bearer"],
    exactlyOneCredentialHeaderPerPhysicalRequest: true,
    credentialFreeWhenRequireAuthenticationIsDisabled: true,
  },
} as const;
const TOKENHUB_GZ_ROUTE_OVERRIDES_V7 = {
  officialFallbackRoute: { routeId: "official_fallback", exactOrigin: "https://tokenhub.tencentmaas.cn", separateEndpointIdentityRequired: true, freshPhysicalAttemptLeaseRequired: true },
} as const;
const TOKENHUB_SG_ROUTE_OVERRIDES_V7 = {
  officialFallbackRoute: { routeId: "official_fallback", exactOrigin: "https://tokenhub-intl.tencentmaas.cn", separateEndpointIdentityRequired: true, freshPhysicalAttemptLeaseRequired: true },
} as const;
const TOKENHUB_GZ_MESSAGES_OVERRIDES_V7 = {
  ...TOKENHUB_GZ_ROUTE_OVERRIDES_V7,
  modelsAuth: AUTH_TOKENHUB_GZ_MODELS_V7,
} as const;
const TOKENHUB_SG_MESSAGES_OVERRIDES_V7 = {
  ...TOKENHUB_SG_ROUTE_OVERRIDES_V7,
  modelsAuth: AUTH_TOKENHUB_SG_MODELS_V7,
} as const;
const TENCENT_ENTERPRISE_PLAN_MESSAGES_AUTH_OVERRIDES_V20 = {
  optionalAuthWireAlternatives: {
    acceptedForExactEnterprisePlanEndpoint: ["anthropic_x_api_key", "authorization_bearer"],
    deterministicPreferenceOrder: ["anthropic_x_api_key", "authorization_bearer"],
    exactlyOneCredentialHeaderPerPhysicalRequest: true,
    ordinaryTokenHubPersonalPlanAndCrossRegionKeyNamespacesForbidden: true,
  },
} as const;

const REFERENCE_EXACT_CONNECTION_ORACLE_V6 = {
  "openai.chat.key": defineConnectionOracleEntryV6("openai.chat.key", WIRE_OPENAI_CHAT_V6, manualBearerAuthV6("auth-oracle:openai-platform-key@6", "openai-platform-api-key"), "openai-chat"),
  "openai.responses.key": defineConnectionOracleEntryV6("openai.responses.key", WIRE_OPENAI_RESPONSES_V6, manualBearerAuthV6("auth-oracle:openai-platform-key@6", "openai-platform-api-key"), "openai-responses"),
  "anthropic.messages.key": defineConnectionOracleEntryV6("anthropic.messages.key", WIRE_ANTHROPIC_MESSAGES_V6, manualXApiKeyAuthV6("auth-oracle:anthropic-api-key@6", "anthropic-api-account-key"), "anthropic-messages"),
  "google.genai.key": defineConnectionOracleEntryV6("google.genai.key", WIRE_GEMINI_GENERATE_V6, AUTH_GOOGLE_API_KEY_V6, "google-gemini", GEMINI_STREAM_OPERATION_OVERRIDES_V7),
  "vertex.adc": defineConnectionOracleEntryV6("vertex.adc", WIRE_VERTEX_GENERATE_V6, AUTH_VERTEX_ADC_V7, "google-vertex-adc", VERTEX_STREAM_OPERATION_OVERRIDES_V7),
  "vertex.wif": defineConnectionOracleEntryV6("vertex.wif", WIRE_VERTEX_GENERATE_V6, AUTH_VERTEX_WIF_V7, "google-vertex-wif", VERTEX_STREAM_OPERATION_OVERRIDES_V7),
  "azure.key": defineConnectionOracleEntryV6("azure.key", WIRE_AZURE_RESPONSES_V6, AUTH_AZURE_KEY_V6, "azure-openai-key"),
  "azure.entra-user": defineConnectionOracleEntryV6("azure.entra-user", WIRE_AZURE_RESPONSES_V6, AUTH_AZURE_USER_V7, "azure-openai-entra-user"),
  "azure.service-principal": defineConnectionOracleEntryV6("azure.service-principal", WIRE_AZURE_RESPONSES_V6, AUTH_AZURE_SERVICE_PRINCIPAL_V7, "azure-openai-service-principal"),
  "azure.managed-identity": defineConnectionOracleEntryV6("azure.managed-identity", WIRE_AZURE_RESPONSES_V6, AUTH_AZURE_MANAGED_IDENTITY_V7, "azure-openai-managed-identity"),
  "azure.chat.key": defineConnectionOracleEntryV6("azure.chat.key", WIRE_AZURE_CHAT_V6, AUTH_AZURE_KEY_V6, "azure-openai-chat-key"),
  "azure.chat.entra-user": defineConnectionOracleEntryV6("azure.chat.entra-user", WIRE_AZURE_CHAT_V6, AUTH_AZURE_USER_V7, "azure-openai-chat-entra-user"),
  "azure.chat.service-principal": defineConnectionOracleEntryV6("azure.chat.service-principal", WIRE_AZURE_CHAT_V6, AUTH_AZURE_SERVICE_PRINCIPAL_V7, "azure-openai-chat-service-principal"),
  "azure.chat.managed-identity": defineConnectionOracleEntryV6("azure.chat.managed-identity", WIRE_AZURE_CHAT_V6, AUTH_AZURE_MANAGED_IDENTITY_V7, "azure-openai-chat-managed-identity"),
  "bedrock.api-key": defineConnectionOracleEntryV6("bedrock.api-key", WIRE_BEDROCK_CONVERSE_V6, AUTH_BEDROCK_API_KEY_V6, "bedrock-api-key", BEDROCK_STREAM_OPERATION_OVERRIDES_V7),
  "bedrock.static-profile": defineConnectionOracleEntryV6("bedrock.static-profile", WIRE_BEDROCK_CONVERSE_V6, AUTH_AWS_STATIC_PROFILE_SIGV4_V7, "bedrock-static-profile", BEDROCK_STREAM_OPERATION_OVERRIDES_V7),
  "bedrock.role-profile": defineConnectionOracleEntryV6("bedrock.role-profile", WIRE_BEDROCK_CONVERSE_V6, AUTH_AWS_WORKLOAD_SIGV4_V7, "bedrock-role-profile", BEDROCK_STREAM_OPERATION_OVERRIDES_V7),
  "bedrock.sso": defineConnectionOracleEntryV6("bedrock.sso", WIRE_BEDROCK_CONVERSE_V6, AUTH_AWS_WORKLOAD_SIGV4_V7, "bedrock-sso", BEDROCK_STREAM_OPERATION_OVERRIDES_V7),
  "openrouter.key": defineConnectionOracleEntryV6("openrouter.key", WIRE_OPENROUTER_CHAT_V6, manualBearerAuthV6("auth-oracle:openrouter-key@6", "openrouter-account-key"), "openrouter-key"),
  "openrouter.pkce-key": defineConnectionOracleEntryV6("openrouter.pkce-key", WIRE_OPENROUTER_CHAT_V6, AUTH_OPENROUTER_PKCE_V8, "openrouter-pkce-key"),
  "opencode.zen.chat": defineConnectionOracleEntryV6("opencode.zen.chat", WIRE_OPENCODE_ZEN_CHAT_V6, manualBearerAuthV6("auth-oracle:opencode-zen-key@6", "opencode-zen-key"), "opencode-zen-chat"),
  "opencode.zen.responses": defineConnectionOracleEntryV6("opencode.zen.responses", WIRE_OPENCODE_ZEN_RESPONSES_V6, manualBearerAuthV6("auth-oracle:opencode-zen-key@6", "opencode-zen-key"), "opencode-zen-responses"),
  "opencode.zen.messages": defineConnectionOracleEntryV6("opencode.zen.messages", WIRE_OPENCODE_ZEN_MESSAGES_V6, manualXApiKeyAuthV6("auth-oracle:opencode-zen-key-messages@6", "opencode-zen-key"), "opencode-zen-messages"),
  "opencode.go.chat": defineConnectionOracleEntryV6("opencode.go.chat", WIRE_OPENCODE_GO_CHAT_V6, manualBearerAuthV6("auth-oracle:opencode-go-key@6", "opencode-go-subscription-key"), "opencode-go-chat"),
  "opencode.go.responses": defineConnectionOracleEntryV6("opencode.go.responses", WIRE_OPENCODE_GO_RESPONSES_V6, manualBearerAuthV6("auth-oracle:opencode-go-key@6", "opencode-go-subscription-key"), "opencode-go-responses"),
  "opencode.go.messages": defineConnectionOracleEntryV6("opencode.go.messages", WIRE_OPENCODE_GO_MESSAGES_V6, manualXApiKeyAuthV6("auth-oracle:opencode-go-key-messages@6", "opencode-go-subscription-key"), "opencode-go-messages"),
  "zai.chat": defineConnectionOracleEntryV6("zai.chat", WIRE_ZAI_CHAT_V6, manualBearerAuthV6("auth-oracle:z-ai-global-key@6", "z-ai-global-account-key"), "zai-chat"),
  "minimax.global": defineConnectionOracleEntryV6("minimax.global", WIRE_MINIMAX_GLOBAL_CHAT_V6, manualBearerAuthV6("auth-oracle:minimax-global-key@6", "minimax-international-account-key"), "minimax-global"),
  "minimax.global-plan": defineConnectionOracleEntryV6("minimax.global-plan", WIRE_MINIMAX_GLOBAL_CHAT_V6, manualBearerAuthV6("auth-oracle:minimax-global-plan-key@6", "minimax-international-token-plan-key"), "minimax-global-plan"),
  "dashscope.global": defineConnectionOracleEntryV6("dashscope.global", WIRE_DASHSCOPE_GLOBAL_CHAT_V6, manualBearerAuthV6("auth-oracle:dashscope-singapore-key@6", "dashscope-singapore-workspace-key"), "dashscope-global"),
  "siliconflow.global": defineConnectionOracleEntryV6("siliconflow.global", WIRE_SILICONFLOW_GLOBAL_CHAT_V6, manualBearerAuthV6("auth-oracle:siliconflow-global-key@6", "siliconflow-global-account-key"), "siliconflow-global"),
  "byteplus.modelark.responses": defineConnectionOracleEntryV6("byteplus.modelark.responses", WIRE_BYTEPLUS_RESPONSES_V6, manualBearerAuthV6("auth-oracle:byteplus-modelark-key@6", "byteplus-region-endpoint-key"), "byteplus-modelark"),
  "bigmodel.chat": defineConnectionOracleEntryV6("bigmodel.chat", WIRE_BIGMODEL_CHAT_V6, manualBearerAuthV6("auth-oracle:zhipu-ordinary-chat-key@6", "zhipu-ordinary-platform-key"), "zhipu-bigmodel-chat"),
  "bigmodel.messages": defineConnectionOracleEntryV6("bigmodel.messages", WIRE_BIGMODEL_MESSAGES_V6, manualXApiKeyAuthV6("auth-oracle:zhipu-ordinary-messages-key@6", "zhipu-ordinary-platform-key"), "zhipu-bigmodel-messages"),
  "kimi.platform.chat": defineConnectionOracleEntryV6("kimi.platform.chat", WIRE_KIMI_PLATFORM_CHAT_V6, manualBearerAuthV6("auth-oracle:kimi-platform-key@6", "kimi-platform-payg-key"), "kimi-platform"),
  "kimi.code.chat": defineConnectionOracleEntryV6("kimi.code.chat", WIRE_KIMI_CODE_CHAT_V6, manualBearerAuthV6("auth-oracle:kimi-code-key@6", "kimi-code-membership-key"), "kimi-code-chat", KIMI_CODE_USER_AGENT_OVERRIDES_V7),
  "kimi.code.messages": defineConnectionOracleEntryV6("kimi.code.messages", WIRE_KIMI_CODE_MESSAGES_V6, manualXApiKeyAuthV6("auth-oracle:kimi-code-key-messages@6", "kimi-code-membership-key"), "kimi-code-messages", KIMI_CODE_USER_AGENT_OVERRIDES_V7),
  "deepseek.chat": defineConnectionOracleEntryV6("deepseek.chat", WIRE_DEEPSEEK_CHAT_V6, manualBearerAuthV6("auth-oracle:deepseek-key@6", "deepseek-platform-key"), "deepseek-chat"),
  "minimax.cn": defineConnectionOracleEntryV6("minimax.cn", WIRE_MINIMAX_CN_CHAT_V6, manualBearerAuthV6("auth-oracle:minimax-cn-key@6", "minimax-china-account-key"), "minimax-cn"),
  "minimax.cn-plan": defineConnectionOracleEntryV6("minimax.cn-plan", WIRE_MINIMAX_CN_CHAT_V6, manualBearerAuthV6("auth-oracle:minimax-cn-plan-key@6", "minimax-china-token-plan-key"), "minimax-cn-plan"),
  "dashscope.cn": defineConnectionOracleEntryV6("dashscope.cn", WIRE_DASHSCOPE_CN_CHAT_V6, manualBearerAuthV6("auth-oracle:dashscope-beijing-key@6", "dashscope-beijing-workspace-key"), "dashscope-cn"),
  "ark.cn.responses": defineConnectionOracleEntryV6("ark.cn.responses", WIRE_ARK_CN_RESPONSES_V6, manualBearerAuthV6("auth-oracle:volcengine-ark-key@6", "volcengine-ark-resource-key"), "volcengine-ark-cn"),
  "tokenhub.gz.chat": defineConnectionOracleEntryV6("tokenhub.gz.chat", WIRE_TOKENHUB_GZ_CHAT_V6, manualBearerAuthV6("auth-oracle:tokenhub-guangzhou-key@6", "tokenhub-guangzhou-site-key"), "tokenhub-gz-chat", TOKENHUB_GZ_ROUTE_OVERRIDES_V7),
  "tokenhub.gz.responses": defineConnectionOracleEntryV6("tokenhub.gz.responses", WIRE_TOKENHUB_GZ_RESPONSES_V6, manualBearerAuthV6("auth-oracle:tokenhub-guangzhou-key@6", "tokenhub-guangzhou-site-key"), "tokenhub-gz-responses", TOKENHUB_GZ_ROUTE_OVERRIDES_V7),
  "tokenhub.gz.messages": defineConnectionOracleEntryV6("tokenhub.gz.messages", WIRE_TOKENHUB_GZ_MESSAGES_V6, manualXApiKeyAuthV6("auth-oracle:tokenhub-guangzhou-messages-key@6", "tokenhub-guangzhou-site-key"), "tokenhub-gz-messages", TOKENHUB_GZ_MESSAGES_OVERRIDES_V7),
  "tokenhub.sg.chat": defineConnectionOracleEntryV6("tokenhub.sg.chat", WIRE_TOKENHUB_SG_CHAT_V6, manualBearerAuthV6("auth-oracle:tokenhub-singapore-key@6", "tokenhub-singapore-site-key"), "tokenhub-sg-chat", TOKENHUB_SG_ROUTE_OVERRIDES_V7),
  "tokenhub.sg.responses": defineConnectionOracleEntryV6("tokenhub.sg.responses", WIRE_TOKENHUB_SG_RESPONSES_V6, manualBearerAuthV6("auth-oracle:tokenhub-singapore-key@6", "tokenhub-singapore-site-key"), "tokenhub-sg-responses", TOKENHUB_SG_ROUTE_OVERRIDES_V7),
  "tokenhub.sg.messages": defineConnectionOracleEntryV6("tokenhub.sg.messages", WIRE_TOKENHUB_SG_MESSAGES_V6, manualXApiKeyAuthV6("auth-oracle:tokenhub-singapore-messages-key@6", "tokenhub-singapore-site-key"), "tokenhub-sg-messages", TOKENHUB_SG_MESSAGES_OVERRIDES_V7),
  "tencent-enterprise-plan.gz.chat": defineConnectionOracleEntryV6("tencent-enterprise-plan.gz.chat", WIRE_TENCENT_ENTERPRISE_PLAN_GZ_CHAT_V20, manualBearerAuthV6("auth-oracle:tencent-enterprise-token-plan-guangzhou-key@6", "tencent-enterprise-token-plan-guangzhou-key"), "tencent-enterprise-plan-gz-chat"),
  "tencent-enterprise-plan.gz.messages": defineConnectionOracleEntryV6("tencent-enterprise-plan.gz.messages", WIRE_TENCENT_ENTERPRISE_PLAN_GZ_MESSAGES_V20, manualXApiKeyAuthV6("auth-oracle:tencent-enterprise-token-plan-guangzhou-messages-key@6", "tencent-enterprise-token-plan-guangzhou-key"), "tencent-enterprise-plan-gz-messages", TENCENT_ENTERPRISE_PLAN_MESSAGES_AUTH_OVERRIDES_V20),
  "tencent-enterprise-plan.sg.chat": defineConnectionOracleEntryV6("tencent-enterprise-plan.sg.chat", WIRE_TENCENT_ENTERPRISE_PLAN_SG_CHAT_V20, manualBearerAuthV6("auth-oracle:tencent-enterprise-token-plan-singapore-key@6", "tencent-enterprise-token-plan-singapore-key"), "tencent-enterprise-plan-sg-chat"),
  "tencent-enterprise-plan.sg.messages": defineConnectionOracleEntryV6("tencent-enterprise-plan.sg.messages", WIRE_TENCENT_ENTERPRISE_PLAN_SG_MESSAGES_V20, manualXApiKeyAuthV6("auth-oracle:tencent-enterprise-token-plan-singapore-messages-key@6", "tencent-enterprise-token-plan-singapore-key"), "tencent-enterprise-plan-sg-messages", TENCENT_ENTERPRISE_PLAN_MESSAGES_AUTH_OVERRIDES_V20),
  "hunyuan.cn": defineConnectionOracleEntryV6("hunyuan.cn", WIRE_HUNYUAN_LEGACY_CHAT_V6, manualBearerAuthV6("auth-oracle:hunyuan-legacy-key@6", "hunyuan-legacy-migration-key"), "hunyuan-legacy"),
  "qianfan.v2": defineConnectionOracleEntryV6("qianfan.v2", WIRE_QIANFAN_CHAT_V6, manualBearerAuthV6("auth-oracle:qianfan-v2-key@6", "baidu-qianfan-account-key"), "qianfan-v2"),
  "baidu.benefit-pack": defineConnectionOracleEntryV6("baidu.benefit-pack", WIRE_QIANFAN_CHAT_V6, manualBearerAuthV6("auth-oracle:baidu-benefit-pack-key@6", "baidu-benefit-pack-key"), "baidu-benefit-pack"),
  "siliconflow.cn": defineConnectionOracleEntryV6("siliconflow.cn", WIRE_SILICONFLOW_CN_CHAT_V6, manualBearerAuthV6("auth-oracle:siliconflow-cn-key@6", "siliconflow-china-account-key"), "siliconflow-cn"),
  "ollama.chat": defineConnectionOracleEntryV6("ollama.chat", WIRE_OLLAMA_CHAT_V6, noApplicationAuthV6("auth-oracle:ollama-none@6", "local-user-ollama"), "ollama-chat"),
  "ollama.responses": defineConnectionOracleEntryV6("ollama.responses", WIRE_OLLAMA_RESPONSES_V6, noApplicationAuthV6("auth-oracle:ollama-none@6", "local-user-ollama"), "ollama-responses"),
  "lmstudio.chat": defineConnectionOracleEntryV6("lmstudio.chat", WIRE_LMSTUDIO_CHAT_V6, AUTH_LMSTUDIO_OPTIONAL_V6, "lm-studio-chat"),
  "lmstudio.responses": defineConnectionOracleEntryV6("lmstudio.responses", WIRE_LMSTUDIO_RESPONSES_V6, AUTH_LMSTUDIO_OPTIONAL_V6, "lm-studio-responses"),
  "lmstudio.messages": defineConnectionOracleEntryV6("lmstudio.messages", WIRE_LMSTUDIO_MESSAGES_V6, AUTH_LMSTUDIO_MESSAGES_OPTIONAL_ANTHROPIC_V9, "lm-studio-messages", LMSTUDIO_MESSAGES_OPTIONAL_AUTH_OVERRIDES_V9),
  "omlx.chat": defineConnectionOracleEntryV6("omlx.chat", WIRE_OMLX_CHAT_V6, noApplicationAuthV6("auth-oracle:omlx-none@6", "local-user-omlx"), "omlx-chat"),
  "omlx.responses": defineConnectionOracleEntryV6("omlx.responses", WIRE_OMLX_RESPONSES_V6, noApplicationAuthV6("auth-oracle:omlx-none@6", "local-user-omlx"), "omlx-responses"),
  "omlx.messages": defineConnectionOracleEntryV6("omlx.messages", WIRE_OMLX_MESSAGES_V6, noApplicationAuthV6("auth-oracle:omlx-none@6", "local-user-omlx"), "omlx-messages"),
  "docker.model-runner": defineConnectionOracleEntryV6("docker.model-runner", WIRE_DOCKER_MODEL_RUNNER_V6, noApplicationAuthV6("auth-oracle:docker-model-runner-none@6", "local-user-docker-model-runner"), "docker-model-runner"),
  "podman.ai-lab": defineConnectionOracleEntryV6("podman.ai-lab", WIRE_PODMAN_AI_LAB_V6, noApplicationAuthV6("auth-oracle:podman-ai-lab-none@6", "local-user-podman-ai-lab"), "podman-ai-lab"),
  "codex.app-server": defineConnectionOracleEntryV6("codex.app-server", WIRE_CODEX_APP_SERVER_V6, AUTH_EXECUTION_UPSTREAM_V6, "codex-app-server"),
  "kimi.server.acp": defineConnectionOracleEntryV6("kimi.server.acp", WIRE_KIMI_ACP_V6, AUTH_EXECUTION_UPSTREAM_V6, "kimi-server-acp"),
  "opencode.server.http": defineConnectionOracleEntryV6("opencode.server.http", WIRE_OPENCODE_SERVER_V6, AUTH_OPENCODE_SERVER_OPTIONAL_V6, "opencode-server"),
  "opencode.acp.stdio": defineConnectionOracleEntryV6("opencode.acp.stdio", WIRE_OPENCODE_ACP_V6, AUTH_EXECUTION_UPSTREAM_V6, "opencode-acp"),
  "generic.cli.stdio": defineConnectionOracleEntryV6("generic.cli.stdio", WIRE_GENERIC_CLI_V6, AUTH_EXECUTION_UPSTREAM_V6, "generic-cli"),
  "cc-switch.proxy.messages": defineConnectionOracleEntryV6("cc-switch.proxy.messages", WIRE_CC_SWITCH_MESSAGES_V6, noApplicationAuthV6("auth-oracle:cc-switch-proxy-none@6", "cc-switch-upstream-managed"), "cc-switch-proxy"),
  "litellm.bridge.openai": defineConnectionOracleEntryV6("litellm.bridge.openai", WIRE_LITELLM_CHAT_V6, AUTH_LITELLM_OPTIONAL_V6, "litellm-chat"),
  "litellm.bridge.responses": defineConnectionOracleEntryV6("litellm.bridge.responses", WIRE_LITELLM_RESPONSES_V6, AUTH_LITELLM_OPTIONAL_V6, "litellm-responses"),
  "litellm.bridge.messages": defineConnectionOracleEntryV6("litellm.bridge.messages", WIRE_LITELLM_MESSAGES_V6, AUTH_LITELLM_OPTIONAL_V6, "litellm-messages"),
  "anchor.witness": defineConnectionOracleEntryV6("anchor.witness", WIRE_ANCHOR_CONTROL_V6, noApplicationAuthV6("auth-oracle:anchor-control-none@6", "saydo-platform-security-helper"), "anchor-witness"),
  "custom.openai-chat": defineConnectionOracleEntryV6("custom.openai-chat", WIRE_CUSTOM_CHAT_V6, manualBearerAuthV6("auth-oracle:custom-openai-bearer@6", "custom-endpoint-principal-key"), "custom-openai-chat"),
  "custom.openai-responses": defineConnectionOracleEntryV6("custom.openai-responses", WIRE_CUSTOM_RESPONSES_V6, manualBearerAuthV6("auth-oracle:custom-openai-bearer@6", "custom-endpoint-principal-key"), "custom-openai-responses"),
  "custom.anthropic-messages": defineConnectionOracleEntryV6("custom.anthropic-messages", WIRE_CUSTOM_MESSAGES_V6, manualXApiKeyAuthV6("auth-oracle:custom-anthropic-x-api-key@6", "custom-endpoint-principal-key"), "custom-anthropic-messages"),
  "custom.mtls": defineConnectionOracleEntryV6("custom.mtls", WIRE_CUSTOM_CHAT_V6, AUTH_CUSTOM_MTLS_V6, "custom-mtls"),
  "custom.secret-header": defineConnectionOracleEntryV6("custom.secret-header", WIRE_CUSTOM_CHAT_V6, AUTH_CUSTOM_HEADER_V6, "custom-secret-header"),
} as const satisfies ReferenceExactConnectionOracleForInputsV6<
  typeof REFERENCE_REQUIREMENT_INPUTS_V3
>;

const REFERENCE_REQUIREMENTS_V3 = deriveReferenceRequirementsV4(
  REFERENCE_REQUIREMENT_INPUTS_V3,
  REFERENCE_EXACT_CONNECTION_ORACLE_V6,
);

type ReferenceRequirementRowV3 = (typeof REFERENCE_REQUIREMENTS_V3)[number];
type ReferenceRequirementKeyV3 = ReferenceRequirementRowV3["requirementKey"];
type ReferenceEntryKeyV3 = ReferenceRequirementRowV3["entryKey"];
type ReferenceJourneyKeyV3 = ReferenceRequirementRowV3["journeyKey"];

type DesktopReferencePlatformProfileV8 = "macos_arm64" | "linux_x64" | "windows_x64";
type AzureHostedRuntimeProfileV8 = "azure_vm_imds" | "azure_app_service_managed_identity";
type ReferencePlatformProfileV4 = DesktopReferencePlatformProfileV8 | AzureHostedRuntimeProfileV8;
type ReferencePlatformForScopeV4<S extends ReferencePlatformScopeV3> = S extends "all_desktop"
  ? DesktopReferencePlatformProfileV8
  : S extends "azure_hosted_runtime"
    ? AzureHostedRuntimeProfileV8
    : S;

type ReferenceJourneyEntryForStartingStateV4<
  R extends ReferenceRequirementRowV3,
  S extends R["requiredStartingAccountStates"][number],
> = Extract<
  R["journeyGraph"]["startStateEntrySteps"][number],
  { readonly startingAccountState: S }
>;

type GaReferenceUserRunSubjectForStartingStateV4<
  R extends ReferenceRequirementRowV3,
  S extends R["requiredStartingAccountStates"][number],
> = {
  readonly runKind: "user_journey";
  readonly requirementKey: R["requirementKey"];
  readonly entryKey: R["entryKey"];
  readonly journeyKey: R["journeyKey"];
  readonly surfaceKind: R["surfaceKind"];
  readonly protocolProfile: R["protocolProfile"];
  readonly authKind: R["authKind"];
  readonly realmClass: R["realmClass"];
  readonly platformProfile: ReferencePlatformForScopeV4<R["platformScope"]>;
  readonly userLocale: "zh-CN" | "en-US" | "ar-SA";
  readonly startingAnchorState: "not_enrolled" | "ready";
  readonly startingAccountState: S;
  readonly journeyGraph: R["journeyGraph"];
  readonly startingGraphEntry: ReferenceJourneyEntryForStartingStateV4<R, S>;
  readonly onboardingRecipe: R["onboardingRecipe"];
  readonly requiredRuntimeStates: R["requiredRuntimeStates"];
  readonly stateAssertionPlan: R["stateAssertionPlan"];
  readonly provesRequirementPlatformLocaleAnchorAccountStateGraphEntryAndAssertionPlanExact: true;
};

type GaReferenceUserRunSubjectV4<
  R extends ReferenceRequirementRowV3 = ReferenceRequirementRowV3,
> = R extends ReferenceRequirementRowV3
  ? {
      [S in R["requiredStartingAccountStates"][number]]: GaReferenceUserRunSubjectForStartingStateV4<
        R,
        S
      >;
    }[R["requiredStartingAccountStates"][number]]
  : never;

type GaReferencePseudoLocaleRunSubjectForStartingStateV4<
  R extends ReferenceRequirementRowV3,
  S extends R["requiredStartingAccountStates"][number],
> = Omit<GaReferenceUserRunSubjectForStartingStateV4<R, S>, "runKind" | "userLocale"> & {
  readonly runKind: "pseudo_locale_suite";
  readonly pseudoLocaleSuite: "en-XA";
  readonly userLocale?: never;
  readonly externalProviderActionCap: 0;
  readonly externalTaskExecutionMode: "deterministic_non_network_fixture_preserving_user_path_metrics";
  readonly actualNetworkProcessBrowserAndProviderEffectCount: 0;
  readonly provesSyntheticExternalTaskEventsPreserveExactGraphPathMetricClassesWithoutExternalEffects: true;
};

type GaReferencePseudoLocaleRunSubjectV4<
  R extends ReferenceRequirementRowV3 = ReferenceRequirementRowV3,
> = R extends ReferenceRequirementRowV3
  ? {
      [S in R["requiredStartingAccountStates"][number]]: GaReferencePseudoLocaleRunSubjectForStartingStateV4<
        R,
        S
      >;
    }[R["requiredStartingAccountStates"][number]]
  : never;

declare const gaReferenceRunSubjectIndexBrandV9: unique symbol;

interface GaReferenceRunSubjectIndexV9 extends ReceiptRef<
  "receipt:ga-reference-run-subject-index@9",
  readonly [ReferenceRequirementKeyV3, "user_journey" | "pseudo_locale_suite"]
> {
  readonly [gaReferenceRunSubjectIndexBrandV9]: never;
  readonly runKind: "user_journey" | "pseudo_locale_suite";
  readonly requirementKey: ReferenceRequirementKeyV3;
  readonly entryKey: ReferenceEntryKeyV3;
  readonly journeyKey: ReferenceJourneyKeyV3;
  readonly platformProfile: ReferencePlatformProfileV4;
  readonly startingAnchorState: "not_enrolled" | "ready";
  readonly startingAccountState: ReferenceStartingAccountStateV3;
  readonly exactTypedRunSubjectDigest: string;
  readonly indexWasCommittedOnlyFromOneExactTypedRunSubjectWithoutTypeErasure: true;
}

declare function commitGaReferenceRunSubjectIndexV9<
  const R extends ReferenceRequirementRowV3,
>(input: {
  readonly exactReferenceRunSubject:
    | GaReferenceUserRunSubjectV4<R>
    | GaReferencePseudoLocaleRunSubjectV4<R>;
}): DeepFrozenCommittedReceiptV1<
  GaReferenceRunSubjectIndexV9 & {
    readonly requirementKey: R["requirementKey"];
    readonly entryKey: R["entryKey"];
    readonly journeyKey: R["journeyKey"];
  }
>;

type GaReferenceRuntimeRecoveryRunSubjectV4<
  R extends ReferenceRequirementRowV3 = ReferenceRequirementRowV3,
> = R extends ReferenceRequirementRowV3
  ? {
      [S in ReferenceRuntimeRecoveryStateForV5<R>]: {
          readonly runKind: "runtime_recovery";
          readonly requirementKey: R["requirementKey"];
          readonly entryKey: R["entryKey"];
          readonly journeyKey: R["journeyKey"];
          readonly platformProfile: ReferencePlatformForScopeV4<R["platformScope"]>;
          readonly referenceRequirement: R;
          readonly runtimeState: S;
          readonly stateClassification: ReferenceRuntimeStateClassificationMapForV5<R>[S] & {
            readonly stateClass: "recovery_required";
          };
          readonly recoveryScenario: ReferenceRuntimeRecoveryScenarioV5<R, S>;
          readonly exactFirstRecoveryStepOrdinal: ReferenceRuntimeRecoveryScenarioV5<
            R,
            S
          >["firstRecoveryStepOrdinal"];
          readonly initialConnectionReadiness: "action_required";
          readonly zeroConfigPassClaimForbiddenBeforeRecoveryTerminal: true;
          readonly expectedTerminalState: "live_activation_committed";
        };
    }[ReferenceRuntimeRecoveryStateForV5<R>]
  : never;

// 聚合release图保存私有producer生成的紧凑索引，不把81行完整dependent union在每个
// 外层收据重复展开。逐row构造仍必须先通过上面的精确类型；索引只去除重复类型展开，
// 不去除row/state/platform/scenario的identity与canonical digest。
declare const gaReferenceRuntimeRecoveryRunIndexBrandV6: unique symbol;

interface GaReferenceRuntimeRecoveryRunIndexV6 extends ReceiptRef<
  "receipt:ga-reference-runtime-recovery-run-index@6",
  readonly [ReferenceRequirementKeyV3, ReferenceRuntimeStateV3, ReferencePlatformProfileV4]
> {
  readonly [gaReferenceRuntimeRecoveryRunIndexBrandV6]: never;
  readonly requirementKey: ReferenceRequirementKeyV3;
  readonly entryKey: ReferenceEntryKeyV3;
  readonly journeyKey: ReferenceJourneyKeyV3;
  readonly runtimeState: ReferenceRuntimeStateV3;
  readonly platformProfile: ReferencePlatformProfileV4;
  readonly exactTypedRunSubjectDigest: string;
  readonly exactRecoveryScenarioDigest: string;
  readonly exactConnectionOracleDigest: string;
  readonly exactFirstRecoveryStepOrdinal: number;
  readonly initialConnectionReadiness: "action_required";
  readonly expectedTerminalState: "live_activation_committed";
  readonly provesIndexWasCommittedOnlyFromOneExactTypedRequirementStatePlatformSubject: true;
}

declare function commitGaReferenceRuntimeRecoveryRunIndexV6<
  R extends ReferenceRequirementRowV3,
  S extends ReferenceRuntimeRecoveryStateForV5<R>,
>(subject: {
  readonly runKind: "runtime_recovery";
  readonly requirementKey: R["requirementKey"];
  readonly entryKey: R["entryKey"];
  readonly journeyKey: R["journeyKey"];
  readonly platformProfile: ReferencePlatformForScopeV4<R["platformScope"]>;
  readonly referenceRequirement: R;
  readonly runtimeState: S;
  readonly stateClassification: ReferenceRuntimeStateClassificationMapForV5<R>[S] & {
    readonly stateClass: "recovery_required";
  };
  readonly recoveryScenario: ReferenceRuntimeRecoveryScenarioV5<R, S>;
  readonly exactFirstRecoveryStepOrdinal: ReferenceRuntimeRecoveryScenarioV5<
    R,
    S
  >["firstRecoveryStepOrdinal"];
  readonly initialConnectionReadiness: "action_required";
  readonly zeroConfigPassClaimForbiddenBeforeRecoveryTerminal: true;
  readonly expectedTerminalState: "live_activation_committed";
}): GaReferenceRuntimeRecoveryRunIndexV6;

type GaReferenceMigrationOnlyAbsenceRunSubjectV8 = {
  readonly runKind: "migration_only_absence";
  readonly requirementKey: "hunyuan.cn";
  readonly referenceRequirement: ReferenceRowByKeyV3<"hunyuan.cn"> & {
    readonly onboardingAvailability: "existing_connection_migration_only";
    readonly journeyTier: "migration_only";
    readonly onboardingRecipe: typeof RECIPE_EXISTING_CONNECTION_MIGRATION_ONLY_V8;
  };
  readonly startingConnectionState: "no_existing_connection";
  readonly expectedDisposition: "not_applicable_no_existing_connection";
  readonly freshPickerEntryCount: 0;
  readonly accountCreationBillingActivationCredentialCreationAndNetworkSendCount: 0;
  readonly existingBrokerHandleReadCount: 0;
  readonly provesAbsenceCannotEnterThePositiveMigrationGraphOrAnyFreshOnboardingGraph: true;
};

declare function deriveReferenceRunSubjectsV4(
  requirements: typeof REFERENCE_REQUIREMENTS_V3,
): {
  readonly userRuns: NonEmptyReadonly<GaReferenceRunSubjectIndexV9 & { readonly runKind: "user_journey" }>;
  readonly pseudoLocaleRuns: NonEmptyReadonly<GaReferenceRunSubjectIndexV9 & { readonly runKind: "pseudo_locale_suite" }>;
  readonly runtimeRecoveryRuns: NonEmptyReadonly<GaReferenceRuntimeRecoveryRunIndexV6>;
  readonly migrationOnlyAbsenceRuns: readonly [GaReferenceMigrationOnlyAbsenceRunSubjectV8];
};

const REFERENCE_RUN_SUBJECTS_V4 = deriveReferenceRunSubjectsV4(
  REFERENCE_REQUIREMENTS_V3,
);

interface ReferenceRunSubjectDerivationReceiptV4 extends ReceiptRef {
  readonly schemaVersion: "saydo.dev/reference-run-subject-derivation/v4";
  readonly requirements: typeof REFERENCE_REQUIREMENTS_V3;
  readonly expectedUserRunSubjects: typeof REFERENCE_RUN_SUBJECTS_V4.userRuns;
  readonly expectedPseudoLocaleRunSubjects: typeof REFERENCE_RUN_SUBJECTS_V4.pseudoLocaleRuns;
  readonly expectedRuntimeRecoveryRunSubjects: typeof REFERENCE_RUN_SUBJECTS_V4.runtimeRecoveryRuns;
  readonly expectedMigrationOnlyAbsenceRunSubjects: typeof REFERENCE_RUN_SUBJECTS_V4.migrationOnlyAbsenceRuns;
  readonly expectedUserRunSubjectDigests: NonEmptyReadonly<string>;
  readonly expectedPseudoLocaleRunSubjectDigests: NonEmptyReadonly<string>;
  readonly expectedRuntimeRecoveryRunSubjectDigests: NonEmptyReadonly<string>;
  readonly expectedMigrationOnlyAbsenceRunSubjectDigests: readonly [string];
  readonly expectedUserRunCount: number;
  readonly expectedPseudoLocaleRunCount: number;
  readonly expectedRuntimeRecoveryRunCount: number;
  readonly expectedMigrationOnlyAbsenceRunCount: 1;
  readonly duplicateRunSubjectCount: 0;
  readonly missingStartingAccountStateGraphEntryCount: 0;
  readonly incompatibleRuntimeStateProducerCount: 0;
  readonly missingOrAmbiguousRequiredRecipeFieldPathCount: 0;
  readonly missingConditionalNestedExternalTaskPositiveOrNegativeFixtureCount: 0;
  readonly derivationAlgorithm: "fresh-requirement-platform-locale-anchor-account-state-cartesian-plus-migration-existing-only-and-absence-v8";
  readonly deterministicDeriverArtifactDigest: string;
  readonly deterministicDerivationTranscriptDigest: string;
  readonly deterministicDerivationExitCode: 0;
  readonly runtimeRecoveryIndexProducerArtifactDigest: string;
  readonly expectedAndActualRuntimeRecoveryRequirementStatePlatformKeysDigest: string;
  readonly runtimeRecoveryIndexMissingDuplicateOrExtraCount: 0;
  readonly provesEveryCountPositiveAndEqualsExactCartesianProductForItsRequirementScope: true;
  readonly provesEveryStartingAccountStateBindsItsExactGraphEntryAndCompleteStateAssertionPlan: true;
  readonly provesEveryRequiredStateUsesCompilerSelectedPolaritySourceAndBrandedEvidenceReceipt: true;
  readonly provesEveryRunBindsTheExactRequirementRecipeAndRequiredFieldSet: true;
  readonly provesEveryRequiredRecipeFieldIsConsumedByAnExplicitFieldOrRecipeFieldGroupStepBeforeValidation: true;
  readonly provesConditionalMfaAndFutureNestedTasksHaveTypedParentBoundEventsAndBothFixtureBranches: true;
  readonly provesUserAndPseudoLocaleRunSetsAreSortedUniqueDisjointAndComplete: true;
  readonly provesRuntimeRecoveryRunsEqualTheMechanicallyDerivedRecoveryRequiredStateMapForEveryRequirementAndCannotEnterPositiveZeroConfigGateBeforeTerminal: true;
  readonly provesEveryRuntimeRecoveryIndexWasRecomputedFromItsExactTypedSubjectAndCanonicalScenarioWithoutTypeErasure: true;
  readonly provesMigrationOnlyRowsHaveOnlyExistingConnectionPositiveRunsAndOneNoExistingConnectionNotApplicableRun: true;
  readonly provesMigrationOnlyRunsContainNoFreshAccountBillingCredentialCreationOrPickerAction: true;
}

type ReferenceInvariantTrueV3<T extends true> = T;
type ReferenceInvariantEqualV3<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
    ? (<T>() => T extends B ? 1 : 2) extends (<T>() => T extends A ? 1 : 2)
      ? true
      : false
    : false;

type _ReferenceGeminiStreamOracleExactV7 = ReferenceInvariantTrueV3<
  ReferenceInvariantEqualV3<
    (typeof REFERENCE_EXACT_CONNECTION_ORACLE_V6)["google.genai.key"]["exactOperationOverrides"],
    typeof GEMINI_STREAM_OPERATION_OVERRIDES_V7
  >
>;

type _ReferenceVertexEndpointAndStreamOracleExactV7 = ReferenceInvariantTrueV3<
  ReferenceInvariantEqualV3<
    readonly [
      (typeof REFERENCE_EXACT_CONNECTION_ORACLE_V6)["vertex.adc"]["wire"]["globalOrigin"],
      (typeof REFERENCE_EXACT_CONNECTION_ORACLE_V6)["vertex.adc"]["wire"]["regionalOriginTemplate"],
      (typeof REFERENCE_EXACT_CONNECTION_ORACLE_V6)["vertex.adc"]["exactOperationOverrides"],
      (typeof REFERENCE_EXACT_CONNECTION_ORACLE_V6)["vertex.wif"]["exactOperationOverrides"],
      (typeof REFERENCE_EXACT_CONNECTION_ORACLE_V6)["vertex.adc"]["auth"]["authFlow"]["kind"],
      (typeof REFERENCE_EXACT_CONNECTION_ORACLE_V6)["vertex.wif"]["auth"]["authFlow"]["kind"],
    ],
    readonly [
      "https://aiplatform.googleapis.com",
      "https://{location}-aiplatform.googleapis.com",
      typeof VERTEX_STREAM_OPERATION_OVERRIDES_V7,
      typeof VERTEX_STREAM_OPERATION_OVERRIDES_V7,
      "google_adc_oauth",
      "google_workload_identity_federation",
    ]
  >
>;

type _ReferenceBedrockStreamingAndSigV4OracleExactV7 = ReferenceInvariantTrueV3<
  ReferenceInvariantEqualV3<
    readonly [
      (typeof REFERENCE_EXACT_CONNECTION_ORACLE_V6)["bedrock.api-key"]["exactOperationOverrides"],
      (typeof REFERENCE_EXACT_CONNECTION_ORACLE_V6)["bedrock.static-profile"]["exactOperationOverrides"],
      (typeof REFERENCE_EXACT_CONNECTION_ORACLE_V6)["bedrock.role-profile"]["auth"]["credentialHeaderName"],
      (typeof REFERENCE_EXACT_CONNECTION_ORACLE_V6)["bedrock.role-profile"]["auth"]["authFlow"]["authorizationHeaderScheme"],
      (typeof REFERENCE_EXACT_CONNECTION_ORACLE_V6)["bedrock.sso"]["auth"]["authFlow"]["service"],
    ],
    readonly [
      typeof BEDROCK_STREAM_OPERATION_OVERRIDES_V7,
      typeof BEDROCK_STREAM_OPERATION_OVERRIDES_V7,
      "Authorization",
      "AWS4-HMAC-SHA256",
      "bedrock-runtime",
    ]
  >
>;

type _ReferenceTokenHubMessagesOperationModelsAndFallbackOracleExactV7 = ReferenceInvariantTrueV3<
  ReferenceInvariantEqualV3<
    readonly [
      (typeof REFERENCE_EXACT_CONNECTION_ORACLE_V6)["tokenhub.gz.messages"]["auth"]["wireKind"],
      (typeof REFERENCE_EXACT_CONNECTION_ORACLE_V6)["tokenhub.gz.messages"]["exactOperationOverrides"]["modelsAuth"]["wireKind"],
      (typeof REFERENCE_EXACT_CONNECTION_ORACLE_V6)["tokenhub.gz.messages"]["exactOperationOverrides"]["officialFallbackRoute"]["exactOrigin"],
      (typeof REFERENCE_EXACT_CONNECTION_ORACLE_V6)["tokenhub.sg.messages"]["auth"]["wireKind"],
      (typeof REFERENCE_EXACT_CONNECTION_ORACLE_V6)["tokenhub.sg.messages"]["exactOperationOverrides"]["modelsAuth"]["wireKind"],
      (typeof REFERENCE_EXACT_CONNECTION_ORACLE_V6)["tokenhub.sg.messages"]["exactOperationOverrides"]["officialFallbackRoute"]["exactOrigin"],
    ],
    readonly [
      "anthropic_x_api_key",
      "authorization_bearer",
      "https://tokenhub.tencentmaas.cn",
      "anthropic_x_api_key",
      "authorization_bearer",
      "https://tokenhub-intl.tencentmaas.cn",
    ]
  >
>;

type _ReferenceLmStudioMessagesOptionalAuthAlternativesExactV9 = ReferenceInvariantTrueV3<
  ReferenceInvariantEqualV3<
    readonly [
      (typeof REFERENCE_EXACT_CONNECTION_ORACLE_V6)["lmstudio.messages"]["auth"]["wireKind"],
      (typeof REFERENCE_EXACT_CONNECTION_ORACLE_V6)["lmstudio.messages"]["exactOperationOverrides"],
      ReferenceOptionalAuthPolicyForRequirementV6<{ readonly requirementKey: "lmstudio.messages" }>["acceptedSchemes"],
    ],
    readonly [
      "anthropic_x_api_key",
      typeof LMSTUDIO_MESSAGES_OPTIONAL_AUTH_OVERRIDES_V9,
      readonly ["none", "anthropic_x_api_key", "authorization_bearer"],
    ]
  >
>;

type _ReferenceKimiCodeDistributionUserAgentOracleExactV7 = ReferenceInvariantTrueV3<
  ReferenceInvariantEqualV3<
    readonly [
      (typeof REFERENCE_EXACT_CONNECTION_ORACLE_V6)["kimi.code.chat"]["exactOperationOverrides"],
      (typeof REFERENCE_EXACT_CONNECTION_ORACLE_V6)["kimi.code.messages"]["exactOperationOverrides"],
      "real_user_agent_preserved" extends ReferenceRequirementInputForKeyV7<"kimi.code.chat">["requiredRuntimeStates"][number] ? true : false,
      "real_user_agent_preserved" extends ReferenceRequirementInputForKeyV7<"kimi.code.messages">["requiredRuntimeStates"][number] ? true : false,
    ],
    readonly [
      typeof KIMI_CODE_USER_AGENT_OVERRIDES_V7,
      typeof KIMI_CODE_USER_AGENT_OVERRIDES_V7,
      true,
      true,
    ]
  >
>;

declare const referenceExpectedOracleIdentityRegistryBrandV9: unique symbol;
declare const referenceExactOracleIdentityComparisonBrandV9: unique symbol;
declare const referenceExactOracleConformanceBrandV9: unique symbol;

interface ReferenceExpectedOracleIdentityRecordV9<K extends ReferenceRequirementKeyV3 = ReferenceRequirementKeyV3> {
  readonly requirementKey: K;
  readonly providerProductIdentity: string;
  readonly realmClass: "china_mainland" | "global" | "local";
  readonly surfaceAndProtocolIdentity: string;
  readonly wireProfileId: `wire-oracle:${string}@6`;
  readonly exactOriginPathQueryModelsAndStreamingIdentityDigest: string;
  readonly authProfileId: `auth-oracle:${string}@6`;
  readonly exactAuthFlowAndCredentialRecipientNamespaceDigest: string;
  readonly exactPhysicalOperationGraphDigest: string;
  readonly independentSignedOracleTargetPath: `providers/${string}/connection-oracle.v6.json`;
  readonly officialEvidenceLockTargetPath: `evidence/providers/${string}.v6.json`;
  readonly expectedReleasedDistributionArtifactDigest: string;
  readonly canonicalExpectedIdentityTupleDigest: string;
}

interface ReferenceExpectedOracleIdentityRegistryReceiptV9 extends ReceiptRef<
  "receipt:reference-expected-oracle-identity-registry@9",
  ReferenceRequirementKeyV3
> {
  readonly [referenceExpectedOracleIdentityRegistryBrandV9]: never;
  readonly schemaVersion: "saydo.dev/reference-expected-oracle-identity-registry/v9";
  readonly sourceTargetPath: "reference-grade/expected-provider-oracle-identities.v9.json";
  readonly sourceTargetAuthorization: TufTargetAuthorizationReceipt;
  readonly sourcePublisherTrustDomainDigest: string;
  readonly sourceArtifactDigest: string;
  readonly orderedRecords: NonEmptyReadonly<ReferenceExpectedOracleIdentityRecordV9>;
  readonly expectedRequirementKeys: NonEmptyReadonly<ReferenceRequirementKeyV3>;
  readonly actualRecordKeys: NonEmptyReadonly<ReferenceRequirementKeyV3>;
  readonly recordCount: 81;
  readonly missingDuplicateOrExtraRecordCount: 0;
  readonly recordsWereAuthoredAndSignedIndependentlyFromRequirementAndConnectionOracleGeneration: true;
  readonly canonicalExpectedIdentityTupleDigestsWereRecomputedFromVerifiedSourceBytes: true;
}

declare function verifyReferenceExpectedOracleIdentityRegistryV9(input: {
  readonly sourceBytes: ImportedOpaqueEvidenceLeafReceipt;
  readonly sourceTargetAuthorization: TufTargetAuthorizationReceipt;
  readonly expectedRequirementKeys: NonEmptyReadonly<ReferenceRequirementKeyV3>;
  readonly independentPublisherAndBuildProvenance: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<ReferenceExpectedOracleIdentityRegistryReceiptV9>;

interface ReferenceExactOracleIdentityComparisonReceiptV9<
  K extends ReferenceRequirementKeyV3 = ReferenceRequirementKeyV3,
  D extends string = string,
> extends ReceiptRef<"receipt:reference-exact-oracle-identity-comparison@9", readonly [K, D]> {
  readonly [referenceExactOracleIdentityComparisonBrandV9]: never;
  readonly requirementKey: K;
  readonly expectedIdentityRecord: ReferenceExpectedOracleIdentityRecordV9<K> & {
    readonly expectedReleasedDistributionArtifactDigest: D;
  };
  readonly actualRequirement: ReferenceRowByKeyV3<K>;
  readonly actualConnectionOracle: (typeof REFERENCE_EXACT_CONNECTION_ORACLE_V6)[K];
  readonly testedDistributionArtifactDigest: D;
  readonly actualProviderProductRealmSurfaceProtocolWireOriginPathAuthRecipientOperationEvidenceAndDistributionTupleDigest: string;
  readonly expectedProviderProductRealmSurfaceProtocolWireOriginPathAuthRecipientOperationEvidenceAndDistributionTupleDigest: string;
  readonly tupleMismatchCount: 0;
  readonly providerProductMismatchCount: 0;
  readonly realmMismatchCount: 0;
  readonly surfaceOrProtocolMismatchCount: 0;
  readonly wireProfileOriginPathOrStreamingMismatchCount: 0;
  readonly authFlowOrCredentialRecipientMismatchCount: 0;
  readonly physicalOperationGraphMismatchCount: 0;
  readonly signedOracleOrEvidenceLockPathMismatchCount: 0;
  readonly distributionMismatchCount: 0;
  readonly provesExpectedAndActualInputsCameFromIndependentTrustAndBuildDomains: true;
}

interface ReferenceExactOracleConformanceReceiptV9<D extends string = string> extends ReceiptRef<
  "receipt:reference-exact-oracle-conformance@9",
  readonly [typeof REFERENCE_EXACT_CONNECTION_ORACLE_V6, D]
> {
  readonly [referenceExactOracleConformanceBrandV9]: never;
  readonly expectedIdentityRegistry: DeepFrozenCommittedReceiptV1<ReferenceExpectedOracleIdentityRegistryReceiptV9>;
  readonly exactRequirements: typeof REFERENCE_REQUIREMENTS_V3;
  readonly exactOracle: typeof REFERENCE_EXACT_CONNECTION_ORACLE_V6;
  readonly testedDistributionArtifactDigest: D;
  readonly orderedIdentityComparisons: NonEmptyReadonly<
    ReferenceExactOracleIdentityComparisonReceiptV9<ReferenceRequirementKeyV3, D>
  >;
  readonly expectedRequirementKeys: NonEmptyReadonly<ReferenceRequirementKeyV3>;
  readonly actualComparedRequirementKeys: NonEmptyReadonly<ReferenceRequirementKeyV3>;
  readonly identityComparisonCount: 81;
  readonly missingDuplicateExtraOrMismatchedIdentityCount: 0;
  readonly generatedPhysicalRequestOperationGraphs: readonly ReferencePhysicalRequestOperationGraphV7[];
  readonly goldenCaptureClasses: readonly [
    "all_81_requirement_identity_tuples",
    "gemini_unary_and_stream",
    "vertex_global_regional_unary_stream_adc_and_wif",
    "bedrock_unary_stream_bearer_and_sigv4",
    "tokenhub_both_sites_all_protocols_business_models_and_fallback",
    "kimi_code_chat_and_messages_signed_distribution_user_agent",
  ];
  readonly requiredRejectedMutationKinds: readonly [
    "provider_product_swap",
    "wire_profile_swap",
    "origin_path_or_streaming_swap",
    "auth_profile_swap",
    "credential_recipient_namespace_swap",
    "physical_operation_graph_swap",
    "signed_oracle_or_evidence_lock_path_swap",
    "released_distribution_swap",
    "literal_sigv4_header_or_wrong_scope_service_region",
    "adc_wif_scope_audience_or_source_swap",
    "tokenhub_business_models_site_or_fallback_identity_swap",
    "kimi_missing_stale_duplicate_or_impersonated_user_agent",
    "test_side_special_case_not_derived_from_oracle",
  ];
  readonly expectedAndActualOperationKeySetMismatchCount: 0;
  readonly semanticCompilerFailureCount: 0;
  readonly survivingMutationCount: 0;
  readonly testSideProviderSpecialCaseCount: 0;
  readonly provesEveryRequirementWasComparedAgainstAnIndependentExpectedIdentityBeforeGoldenCaptureAndRelease: true;
  readonly provesEveryCaptureAndMutationWasGeneratedOnlyFromTheComparedCanonicalRowOperationOracle: true;
}

declare function compileReferenceExactOracleConformanceV9<const D extends string>(input: {
  readonly expectedIdentityRegistry: DeepFrozenCommittedReceiptV1<ReferenceExpectedOracleIdentityRegistryReceiptV9>;
  readonly exactRequirements: typeof REFERENCE_REQUIREMENTS_V3;
  readonly exactOracle: typeof REFERENCE_EXACT_CONNECTION_ORACLE_V6;
  readonly testedDistributionArtifactDigest: D;
  readonly signedGoldenCaptures: NonEmptyReadonly<ImportedOpaqueEvidenceLeafReceipt>;
  readonly independentExpectedAndActualMutationCorpus: NonEmptyReadonly<ImportedOpaqueEvidenceLeafReceipt>;
  readonly vertexEndpointResolutionConformance: GoogleVertexEndpointResolutionConformanceReceiptV7;
}): DeepFrozenCommittedReceiptV1<ReferenceExactOracleConformanceReceiptV9<D>>;
type ReferenceRowByKeyV3<K extends ReferenceRequirementKeyV3> = Extract<
  ReferenceRequirementRowV3,
  { readonly requirementKey: K }
>;
type ReferenceProtocolByKeyV3<K extends ReferenceRequirementKeyV3> =
  ReferenceRowByKeyV3<K>["protocolProfile"];
type ReferenceRecipeClassByKeyV3<K extends ReferenceRequirementKeyV3> =
  ReferenceRowByKeyV3<K>["onboardingRecipe"]["recipeClass"];

type ReferenceCriticalRequirementKeysV3 =
  | "openai.chat.key"
  | "openai.responses.key"
  | "anthropic.messages.key"
  | "google.genai.key"
  | "byteplus.modelark.responses"
  | "bigmodel.chat"
  | "bigmodel.messages"
  | "kimi.platform.chat"
  | "lmstudio.chat"
  | "lmstudio.responses"
  | "lmstudio.messages"
  | "omlx.chat"
  | "omlx.responses"
  | "omlx.messages"
  | "ollama.chat"
  | "ollama.responses"
  | "kimi.code.chat"
  | "kimi.code.messages"
  | "opencode.zen.chat"
  | "opencode.zen.responses"
  | "opencode.zen.messages"
  | "opencode.go.chat"
  | "opencode.go.responses"
  | "opencode.go.messages"
  | "opencode.server.http"
  | "opencode.acp.stdio"
  | "generic.cli.stdio"
  | "cc-switch.proxy.messages"
  | "litellm.bridge.openai"
  | "litellm.bridge.responses"
  | "litellm.bridge.messages"
  | "tokenhub.gz.chat"
  | "tokenhub.gz.responses"
  | "tokenhub.gz.messages"
  | "tokenhub.sg.chat"
  | "tokenhub.sg.responses"
  | "tokenhub.sg.messages"
  | "custom.openai-chat"
  | "custom.openai-responses"
  | "custom.anthropic-messages"
  | "custom.mtls"
  | "custom.secret-header"
  | "azure.key"
  | "azure.entra-user"
  | "azure.service-principal"
  | "azure.managed-identity"
  | "azure.chat.key"
  | "azure.chat.entra-user"
  | "azure.chat.service-principal"
  | "azure.chat.managed-identity"
  | "bedrock.api-key"
  | "bedrock.static-profile"
  | "bedrock.role-profile"
  | "bedrock.sso";

type _ReferenceCriticalRequirementsPresentV3 = ReferenceInvariantTrueV3<
  ReferenceCriticalRequirementKeysV3 extends ReferenceRequirementKeyV3 ? true : false
>;
type _ReferenceGlobalNativeProtocolsExactV3 = ReferenceInvariantTrueV3<
  ReferenceInvariantEqualV3<
    readonly [
      ReferenceProtocolByKeyV3<"openai.chat.key">,
      ReferenceProtocolByKeyV3<"openai.responses.key">,
      ReferenceProtocolByKeyV3<"anthropic.messages.key">,
      ReferenceProtocolByKeyV3<"google.genai.key">
    ],
    readonly [
      "openai_chat_completions",
      "openai_responses",
      "anthropic_messages",
      "google_genai"
    ]
  >
>;
type _ReferenceBigModelAndKimiPlatformProtocolsExactV3 = ReferenceInvariantTrueV3<
  ReferenceInvariantEqualV3<
    readonly [
      ReferenceProtocolByKeyV3<"bigmodel.chat">,
      ReferenceProtocolByKeyV3<"bigmodel.messages">,
      ReferenceProtocolByKeyV3<"kimi.platform.chat">
    ],
    readonly ["openai_chat_completions", "anthropic_messages", "openai_chat_completions"]
  >
>;
type _ReferenceLmStudioProtocolsExactV3 = ReferenceInvariantTrueV3<
  ReferenceInvariantEqualV3<
    readonly [
      ReferenceProtocolByKeyV3<"lmstudio.chat">,
      ReferenceProtocolByKeyV3<"lmstudio.responses">,
      ReferenceProtocolByKeyV3<"lmstudio.messages">
    ],
    readonly ["openai_chat_completions", "openai_responses", "anthropic_messages"]
  >
>;
type _ReferenceOmlxProtocolsExactV3 = ReferenceInvariantTrueV3<
  ReferenceInvariantEqualV3<
    readonly [
      ReferenceProtocolByKeyV3<"omlx.chat">,
      ReferenceProtocolByKeyV3<"omlx.responses">,
      ReferenceProtocolByKeyV3<"omlx.messages">
    ],
    readonly ["openai_chat_completions", "openai_responses", "anthropic_messages"]
  >
>;
type _ReferenceKimiCodeProtocolsExactV3 = ReferenceInvariantTrueV3<
  ReferenceInvariantEqualV3<
    readonly [
      ReferenceProtocolByKeyV3<"kimi.code.chat">,
      ReferenceProtocolByKeyV3<"kimi.code.messages">
    ],
    readonly ["openai_chat_completions", "anthropic_messages"]
  >
>;
type _ReferenceOpenCodeInferenceProtocolsExactV3 = ReferenceInvariantTrueV3<
  ReferenceInvariantEqualV3<
    readonly [
      ReferenceProtocolByKeyV3<"opencode.zen.chat">,
      ReferenceProtocolByKeyV3<"opencode.zen.responses">,
      ReferenceProtocolByKeyV3<"opencode.zen.messages">,
      ReferenceProtocolByKeyV3<"opencode.go.chat">,
      ReferenceProtocolByKeyV3<"opencode.go.responses">,
      ReferenceProtocolByKeyV3<"opencode.go.messages">
    ],
    readonly [
      "openai_chat_completions",
      "openai_responses",
      "anthropic_messages",
      "openai_chat_completions",
      "openai_responses",
      "anthropic_messages"
    ]
  >
>;
type _ReferenceOpenCodeExecutionSurfacesExactV3 = ReferenceInvariantTrueV3<
  ReferenceInvariantEqualV3<
    readonly [
      ReferenceProtocolByKeyV3<"opencode.server.http">,
      ReferenceProtocolByKeyV3<"opencode.acp.stdio">
    ],
    readonly ["agent_http", "acp_stdio"]
  >
>;
type _ReferenceOrdinaryCliAndSecondBridgeExactV3 = ReferenceInvariantTrueV3<
  ReferenceInvariantEqualV3<
    readonly [
      ReferenceProtocolByKeyV3<"generic.cli.stdio">,
      ReferenceProtocolByKeyV3<"cc-switch.proxy.messages">,
      ReferenceProtocolByKeyV3<"litellm.bridge.openai">,
      ReferenceProtocolByKeyV3<"litellm.bridge.responses">,
      ReferenceProtocolByKeyV3<"litellm.bridge.messages">
    ],
    readonly [
      "cli_stdio",
      "anthropic_messages",
      "openai_chat_completions",
      "openai_responses",
      "anthropic_messages"
    ]
  >
>;
type _ReferenceOllamaProtocolsExactV5 = ReferenceInvariantTrueV3<
  ReferenceInvariantEqualV3<
    readonly [
      ReferenceProtocolByKeyV3<"ollama.chat">,
      ReferenceProtocolByKeyV3<"ollama.responses">
    ],
    readonly ["openai_chat_completions", "openai_responses"]
  >
>;
type _ReferenceTokenHubRealmProtocolAuthExactV5 = ReferenceInvariantTrueV3<
  ReferenceInvariantEqualV3<
    readonly [
      ReferenceProtocolByKeyV3<"tokenhub.gz.chat">,
      ReferenceProtocolByKeyV3<"tokenhub.gz.responses">,
      ReferenceProtocolByKeyV3<"tokenhub.gz.messages">,
      ReferenceProtocolByKeyV3<"tokenhub.sg.chat">,
      ReferenceProtocolByKeyV3<"tokenhub.sg.responses">,
      ReferenceProtocolByKeyV3<"tokenhub.sg.messages">,
      ReferenceRowByKeyV3<"tokenhub.gz.chat">["realmClass"],
      ReferenceRowByKeyV3<"tokenhub.sg.chat">["realmClass"],
      ReferenceRowByKeyV3<"tokenhub.gz.chat">["authKind"],
      ReferenceRowByKeyV3<"tokenhub.gz.messages">["authKind"],
      ReferenceRowByKeyV3<"tokenhub.gz.chat">["fundingTier"],
      ReferenceRowByKeyV3<"tokenhub.sg.chat">["fundingTier"],
      ReferenceRowByKeyV3<"tokenhub.gz.chat">["providerWireProfile"]["endpointOrigin"],
      ReferenceRowByKeyV3<"tokenhub.sg.chat">["providerWireProfile"]["endpointOrigin"]
    ],
    readonly [
      "openai_chat_completions",
      "openai_responses",
      "anthropic_messages",
      "openai_chat_completions",
      "openai_responses",
      "anthropic_messages",
      "china_mainland",
      "global",
      "bearer",
      "x_api_key",
      "payg",
      "payg",
      "https://tokenhub.tencentmaas.com",
      "https://tokenhub-intl.tencentmaas.com"
    ]
  >
>;
type _ReferenceTencentEnterpriseTokenPlanRealmProtocolAuthWireFundingExactV20 =
  ReferenceInvariantTrueV3<
    ReferenceInvariantEqualV3<
      readonly [
        ReferenceProtocolByKeyV3<"tencent-enterprise-plan.gz.chat">,
        ReferenceProtocolByKeyV3<"tencent-enterprise-plan.gz.messages">,
        ReferenceProtocolByKeyV3<"tencent-enterprise-plan.sg.chat">,
        ReferenceProtocolByKeyV3<"tencent-enterprise-plan.sg.messages">,
        ReferenceRowByKeyV3<"tencent-enterprise-plan.gz.chat">["realmClass"],
        ReferenceRowByKeyV3<"tencent-enterprise-plan.sg.chat">["realmClass"],
        ReferenceRowByKeyV3<"tencent-enterprise-plan.gz.chat">["authKind"],
        ReferenceRowByKeyV3<"tencent-enterprise-plan.gz.messages">["authKind"],
        ReferenceRowByKeyV3<"tencent-enterprise-plan.gz.chat">["fundingTier"],
        ReferenceRowByKeyV3<"tencent-enterprise-plan.sg.chat">["fundingTier"],
        ReferenceRowByKeyV3<"tencent-enterprise-plan.gz.chat">["providerWireProfile"]["endpointOrigin"],
        ReferenceRowByKeyV3<"tencent-enterprise-plan.sg.chat">["providerWireProfile"]["endpointOrigin"],
        ReferenceRowByKeyV3<"tencent-enterprise-plan.gz.chat">["providerWireProfile"]["operationPath"],
        ReferenceRowByKeyV3<"tencent-enterprise-plan.gz.messages">["providerWireProfile"]["operationPath"]
      ],
      readonly [
        "openai_chat_completions",
        "anthropic_messages",
        "openai_chat_completions",
        "anthropic_messages",
        "china_mainland",
        "global",
        "bearer",
        "x_api_key",
        "subscription",
        "subscription",
        "https://tokenhub.tencentmaas.com",
        "https://tokenhub-intl.tencentmaas.com",
        "/plan/v3/chat/completions",
        "/plan/anthropic/v1/messages"
      ]
    >
  >;
type _ReferenceTencentEnterpriseTokenPlanDerivedWireProfilesConstructibleV20 =
  ReferenceInvariantTrueV3<
    ReferenceInvariantEqualV3<
      readonly [
        ReferenceProviderWireProfileForRequirementV5<{
          readonly requirementKey: "tencent-enterprise-plan.gz.chat";
          readonly protocolProfile: "openai_chat_completions";
        }>["profileId"],
        ReferenceProviderWireProfileForRequirementV5<{
          readonly requirementKey: "tencent-enterprise-plan.sg.messages";
          readonly protocolProfile: "anthropic_messages";
        }>["profileId"]
      ],
      readonly [
        "wire-profile:tencent-enterprise-token-plan-guangzhou@5",
        "wire-profile:tencent-enterprise-token-plan-singapore@5"
      ]
    >
  >;
type _ReferenceCustomEndpointProtocolsExactV3 = ReferenceInvariantTrueV3<
  ReferenceInvariantEqualV3<
    readonly [
      ReferenceProtocolByKeyV3<"custom.openai-chat">,
      ReferenceProtocolByKeyV3<"custom.openai-responses">,
      ReferenceProtocolByKeyV3<"custom.anthropic-messages">,
      ReferenceProtocolByKeyV3<"custom.mtls">,
      ReferenceProtocolByKeyV3<"custom.secret-header">
    ],
    readonly [
      "openai_chat_completions",
      "openai_responses",
      "anthropic_messages",
      "openai_chat_completions",
      "openai_chat_completions"
    ]
  >
>;
type _ReferenceAzureRecipesExactV3 = ReferenceInvariantTrueV3<
  ReferenceInvariantEqualV3<
    readonly [
      ReferenceRecipeClassByKeyV3<"azure.key">,
      ReferenceRecipeClassByKeyV3<"azure.entra-user">,
      ReferenceRecipeClassByKeyV3<"azure.service-principal">,
      ReferenceRecipeClassByKeyV3<"azure.managed-identity">,
      ReferenceRecipeClassByKeyV3<"azure.chat.key">,
      ReferenceRecipeClassByKeyV3<"azure.chat.entra-user">,
      ReferenceRecipeClassByKeyV3<"azure.chat.service-principal">,
      ReferenceRecipeClassByKeyV3<"azure.chat.managed-identity">
    ],
    readonly [
      "guided_static_key", "browser_oauth", "workload_identity", "workload_identity",
      "guided_static_key", "browser_oauth", "workload_identity", "workload_identity"
    ]
  >
>;
type _ReferenceBedrockRecipesExactV3 = ReferenceInvariantTrueV3<
  ReferenceInvariantEqualV3<
    readonly [
      ReferenceRecipeClassByKeyV3<"bedrock.api-key">,
      ReferenceRecipeClassByKeyV3<"bedrock.static-profile">,
      ReferenceRecipeClassByKeyV3<"bedrock.role-profile">,
      ReferenceRecipeClassByKeyV3<"bedrock.sso">
    ],
    readonly ["guided_static_key", "aws_named_profile", "aws_named_profile", "aws_sso"]
  >
>;
type _ReferenceExactWireAuthProfilesV5 = ReferenceInvariantTrueV3<
  ReferenceInvariantEqualV3<
    readonly [
      ReferenceRowByKeyV3<"google.genai.key">["authProfile"]["wireKind"],
      ReferenceRowByKeyV3<"azure.key">["authProfile"]["wireKind"],
      ReferenceRowByKeyV3<"azure.entra-user">["authProfile"]["wireKind"],
      ReferenceRowByKeyV3<"azure.chat.key">["authProfile"]["wireKind"],
      ReferenceRowByKeyV3<"azure.chat.entra-user">["authProfile"]["wireKind"],
      ReferenceRowByKeyV3<"bigmodel.chat">["authProfile"]["wireKind"],
      ReferenceRowByKeyV3<"bigmodel.messages">["authProfile"]["wireKind"],
      ReferenceRowByKeyV3<"kimi.platform.chat">["authProfile"]["wireKind"],
      ReferenceRowByKeyV3<"kimi.code.chat">["authProfile"]["wireKind"],
      ReferenceRowByKeyV3<"kimi.code.messages">["authProfile"]["wireKind"],
      ReferenceRowByKeyV3<"tokenhub.gz.chat">["authProfile"]["wireKind"],
      ReferenceRowByKeyV3<"tokenhub.gz.messages">["authProfile"]["wireKind"],
      ReferenceRowByKeyV3<"tokenhub.sg.chat">["authProfile"]["wireKind"],
      ReferenceRowByKeyV3<"opencode.server.http">["authProfile"]["challengeKind"],
      ReferenceRowByKeyV3<"lmstudio.chat">["authProfile"]["challengeKind"],
      ReferenceRowByKeyV3<"litellm.bridge.openai">["authProfile"]["challengeKind"]
    ],
    readonly [
      "google_api_key",
      "azure_api_key",
      "authorization_bearer",
      "azure_api_key",
      "authorization_bearer",
      "authorization_bearer",
      "anthropic_x_api_key",
      "authorization_bearer",
      "authorization_bearer",
      "anthropic_x_api_key",
      "authorization_bearer",
      "anthropic_x_api_key",
      "authorization_bearer",
      "optional_server_challenge",
      "optional_server_challenge",
      "optional_server_challenge"
    ]
  >
>;
type _ReferenceBigModelAndKimiWireProfilesExactV5 = ReferenceInvariantTrueV3<
  ReferenceInvariantEqualV3<
    readonly [
      ReferenceRowByKeyV3<"bigmodel.chat">["providerWireProfile"]["endpointOrigin"],
      ReferenceRowByKeyV3<"bigmodel.chat">["providerWireProfile"]["operationPath"],
      ReferenceRowByKeyV3<"bigmodel.messages">["providerWireProfile"]["endpointOrigin"],
      ReferenceRowByKeyV3<"bigmodel.messages">["providerWireProfile"]["operationPath"],
      ReferenceRowByKeyV3<"kimi.platform.chat">["providerWireProfile"]["endpointOrigin"],
      ReferenceRowByKeyV3<"kimi.platform.chat">["providerWireProfile"]["operationPath"],
      ReferenceRowByKeyV3<"kimi.code.chat">["providerWireProfile"]["endpointOrigin"],
      ReferenceRowByKeyV3<"kimi.code.chat">["providerWireProfile"]["operationPath"],
      ReferenceRowByKeyV3<"kimi.code.messages">["providerWireProfile"]["endpointOrigin"],
      ReferenceRowByKeyV3<"kimi.code.messages">["providerWireProfile"]["operationPath"]
    ],
    readonly [
      "https://open.bigmodel.cn",
      "/api/paas/v4/chat/completions",
      "https://open.bigmodel.cn",
      "/api/anthropic/v1/messages",
      "https://api.moonshot.cn",
      "/v1/chat/completions",
      "https://api.kimi.com",
      "/coding/v1/chat/completions",
      "https://api.kimi.com",
      "/coding/v1/messages"
    ]
  >
>;

type ReferenceJourneyClassForSurfaceV4<S extends ReferenceSurfaceKindV3> =
  S extends "execution" ? "execution" : S extends "control_plane" ? "control_plane" : "supply";

type ReferenceJourneyDefinitionForRowV4<R extends ReferenceRequirementRowV3> = Extract<
  GaJourneyDefinitionV2,
  {
    readonly journeyClass: ReferenceJourneyClassForSurfaceV4<R["surfaceKind"]>;
    readonly journeyTier: R["journeyTier"];
  }
>;

type ReferenceJourneyPassForRowV4<R extends ReferenceRequirementRowV3> = Extract<
  GaJourneyPassPayloadV2,
  {
    readonly journeyDefinition: {
      readonly journeyClass: ReferenceJourneyClassForSurfaceV4<R["surfaceKind"]>;
      readonly journeyTier: R["journeyTier"];
    };
  }
>;

type ReferenceJourneyProjectionFailureKeyV4 = {
  [K in ReferenceRequirementKeyV3]: [ReferenceJourneyDefinitionForRowV4<ReferenceRowByKeyV3<K>>] extends [never]
    ? K
    : [ReferenceJourneyPassForRowV4<ReferenceRowByKeyV3<K>>] extends [never]
      ? K
      : never;
}[ReferenceRequirementKeyV3];

type _EveryReferenceRequirementHasExactlyOneJourneyAndPassProjectionV4 = ReferenceInvariantTrueV3<
  ReferenceInvariantEqualV3<ReferenceJourneyProjectionFailureKeyV4, never>
>;

type ReferenceStateAssertionCompatibleWithRecipeV4<
  R extends ReferenceRequirementRowV3,
  S extends ReferenceRuntimeStateV3,
> = S extends keyof R["stateAssertionPlan"]
  ? (R["stateAssertionPlan"][S] extends {
      readonly state: S;
      readonly assertionMode: (typeof REFERENCE_RUNTIME_STATE_ASSERTION_MODE_V4)[S];
      readonly source: infer P;
    }
  ? P extends { readonly producerKind: "manual_field"; readonly fieldId: infer F }
    ? F extends R["onboardingRecipe"]["fields"][number]["fieldId"]
      ? true
      : false
    : P extends { readonly producerKind: "journey_action"; readonly journeyStepId: infer ActionStep }
      ? ActionStep extends R["journeyGraph"]["steps"][number]["stepId"]
        ? true
        : false
    : P extends {
          readonly producerKind: "external_task";
          readonly journeyStepId: infer J;
        }
      ? J extends R["journeyGraph"]["steps"][number]["stepId"]
        ? Extract<
            R["journeyGraph"]["steps"][number],
            { readonly stepId: J; readonly stepKind: "external_task" }
          > extends { readonly externalTaskClass: keyof GaUxPlannedMetricsV2["maximumExternalTasksByClass"] }
          ? true
          : false
        : false
      : P extends { readonly producerKind: "active_validation"; readonly validationStep: infer V }
        ? V extends R["onboardingRecipe"]["activeValidationSequence"][number]
          ? true
          : false
        : P extends {
              readonly producerKind: "auth_challenge_observation";
              readonly journeyStepId: infer J;
              readonly challengeDiscriminator: infer D;
            }
          ? Extract<
              R["journeyGraph"]["steps"][number],
              {
                readonly stepId: J;
                readonly stepKind: "auth_challenge_observation";
                readonly challengeDiscriminator: D;
              }
            > extends never
            ? false
            : true
        : P extends { readonly producerKind: "recovery_action"; readonly recoveryState: infer X }
          ? X extends R["onboardingRecipe"]["recoveryStates"][number]
            ? true
            : false
          : P extends ReferenceRuntimeStateProducerV3
            ? true
            : false
    : false)
  : false;

declare const referenceStateAssertionCompatibilityCompilationBrandV7: unique symbol;

interface ReferenceStateAssertionCompatibilityCompilationReceiptV7 extends ReceiptRef<
  "receipt:reference-state-assertion-compatibility-compilation@7",
  readonly [typeof REFERENCE_REQUIREMENTS_V3, typeof REFERENCE_RUNTIME_STATE_SOURCE_DECLARATIONS_V4]
> {
  readonly [referenceStateAssertionCompatibilityCompilationBrandV7]: never;
  readonly compilerSchemaVersion: "saydo.dev/reference-state-assertion-compiler/v7";
  readonly requirementsDigest: string;
  readonly sourceDeclarationDigest: string;
  readonly expectedRequirementCount: typeof REFERENCE_REQUIREMENT_INPUTS_V3["length"];
  readonly actualRequirementCount: typeof REFERENCE_REQUIREMENT_INPUTS_V3["length"];
  readonly expectedRequirementStateTupleSetDigest: string;
  readonly actualRequirementStateTupleSetDigest: string;
  readonly evaluatedRequiredStateCount: number;
  readonly missingRequirementOrStateCount: 0;
  readonly duplicateRequirementOrStateCount: 0;
  readonly unknownAssertionModeCount: 0;
  readonly unresolvedProducerCount: 0;
  readonly producerRecipeFieldStepTaskValidationChallengeOrRecoveryMismatchCount: 0;
  readonly incompatibleObservationPolarityCount: 0;
  readonly executableCompilerArtifactDigest: string;
  readonly deterministicFixtureCorpusDigest: string;
  readonly mutationCorpusDigest: string;
  readonly everyWrongFieldStepTaskValidationChallengeRecoveryOrPolarityMutationWasRejected: true;
  readonly compilerExitCode: 0;
  readonly provesEveryRequiredRuntimeStateHasExactlyOneRecipeCompatibleProducerAndNoUnlistedTupleWasAccepted: true;
}

declare function compileReferenceStateAssertionCompatibilityV7(input: {
  readonly requirements: typeof REFERENCE_REQUIREMENTS_V3;
  readonly sourceDeclarations: typeof REFERENCE_RUNTIME_STATE_SOURCE_DECLARATIONS_V4;
  readonly compilerArtifact: ReceiptRef<"receipt:reference-state-assertion-compiler-artifact@7">;
  readonly deterministicFixtures: ImportedOpaqueEvidenceLeafReceipt;
  readonly mutationCorpus: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<ReferenceStateAssertionCompatibilityCompilationReceiptV7>;

declare const REFERENCE_STATE_ASSERTION_COMPATIBILITY_COMPILATION_V7: DeepFrozenCommittedReceiptV1<
  ReferenceStateAssertionCompatibilityCompilationReceiptV7
>;

type ReferenceRequiredFieldIdsV4<R extends ReferenceRequirementRowV3> = R["onboardingRecipe"]["fields"][number] extends infer F
  ? F extends { readonly required: true; readonly fieldId: infer I }
    ? I
    : F extends { readonly requiredWhen: { readonly observationStepId: string; readonly discriminator: string }; readonly fieldId: infer I }
      ? I
      : never
  : never;

type ReferenceExpectedCustomFieldIdsV4<R extends ReferenceRequirementRowV3> = R["authKind"] extends
  | "bearer"
  | "x_api_key"
  ? "base_url" | "protocol" | "model_or_deployment" | "api_key"
  : R["authKind"] extends "custom_secret_header"
    ? "base_url" | "protocol" | "model_or_deployment" | "custom_secret_header_name" | "custom_secret_header_value"
    : R["authKind"] extends "transport_mtls_only"
      ? "base_url" | "protocol" | "model_or_deployment" | "client_certificate" | "client_private_key_handle"
      : never;

type ReferenceCustomRequirementKeyV4 =
  | "custom.openai-chat"
  | "custom.openai-responses"
  | "custom.anthropic-messages"
  | "custom.mtls"
  | "custom.secret-header";

type ReferenceCustomAuthRecipeFailureKeyV4 = {
  [K in ReferenceCustomRequirementKeyV4]: K;
}[ReferenceCustomRequirementKeyV4] extends infer _AllCustomKeys
  ?
      | (ReferenceInvariantEqualV3<
            ReferenceRequiredFieldIdsV4<ReferenceRowByKeyV3<"custom.openai-chat">>,
            ReferenceExpectedCustomFieldIdsV4<ReferenceRowByKeyV3<"custom.openai-chat">>
          > extends true
          ? never
          : "custom.openai-chat")
      | (ReferenceInvariantEqualV3<
            ReferenceRequiredFieldIdsV4<ReferenceRowByKeyV3<"custom.openai-responses">>,
            ReferenceExpectedCustomFieldIdsV4<ReferenceRowByKeyV3<"custom.openai-responses">>
          > extends true
          ? never
          : "custom.openai-responses")
      | (ReferenceInvariantEqualV3<
            ReferenceRequiredFieldIdsV4<ReferenceRowByKeyV3<"custom.anthropic-messages">>,
            ReferenceExpectedCustomFieldIdsV4<ReferenceRowByKeyV3<"custom.anthropic-messages">>
          > extends true
          ? never
          : "custom.anthropic-messages")
      | (ReferenceInvariantEqualV3<
            ReferenceRequiredFieldIdsV4<ReferenceRowByKeyV3<"custom.mtls">>,
            ReferenceExpectedCustomFieldIdsV4<ReferenceRowByKeyV3<"custom.mtls">>
          > extends true
          ? never
          : "custom.mtls")
      | (ReferenceInvariantEqualV3<
            ReferenceRequiredFieldIdsV4<ReferenceRowByKeyV3<"custom.secret-header">>,
            ReferenceExpectedCustomFieldIdsV4<ReferenceRowByKeyV3<"custom.secret-header">>
          > extends true
          ? never
          : "custom.secret-header")
  : never;

type _EveryCustomAuthKindHasExactRequiredRecipeFieldsV4 = ReferenceInvariantTrueV3<
  ReferenceInvariantEqualV3<ReferenceCustomAuthRecipeFailureKeyV4, never>
>;

interface ReferenceRequirementsDerivationReceiptV3 extends ReceiptRef {
  readonly schemaVersion: "saydo.dev/reference-requirements-derivation/v3";
  readonly requirements: typeof REFERENCE_REQUIREMENTS_V3;
  readonly requirementsDigest: string;
  readonly requirementCount: 81;
  readonly orderedRequirementKeys: NonEmptyReadonly<ReferenceRequirementKeyV3>;
  readonly orderedEntryKeys: NonEmptyReadonly<ReferenceEntryKeyV3>;
  readonly orderedJourneyKeys: NonEmptyReadonly<ReferenceJourneyKeyV3>;
  readonly runSubjectDerivation: ReferenceRunSubjectDerivationReceiptV4;
  readonly duplicateRequirementKeyCount: 0;
  readonly duplicateCompositeSubjectCount: 0;
  readonly missingOrEmptyRecipeCount: 0;
  readonly invalidRecipeFieldSourceCount: 0;
  readonly unprojectableJourneyDefinitionOrPassCount: 0;
  readonly missingOrAmbiguousStartingAccountStatePathCount: 0;
  readonly missingIncompatibleOrWrongPolarityRuntimeStateAssertionCount: 0;
  readonly authKindRecipeFieldMismatchCount: 0;
  readonly recipeRequiredFieldUxClassOrSignedLimitViolationCount: 0;
  readonly missingOrAmbiguousRequiredRecipeFieldJourneyEventCount: 0;
  readonly missingConditionalNestedExternalTaskFixtureOrEventCount: 0;
  readonly journeyGraphPathExceedsSignedScalarOrPerClassLimitCount: 0;
  readonly deterministicDeriverArtifactDigest: string;
  readonly deterministicDerivationTranscriptDigest: string;
  readonly deterministicDerivationExitCode: 0;
  readonly provesKeysEntriesJourneysAndCompositeSubjectsAreExactSortedProjections: true;
  readonly provesEveryRecipeFieldClassificationSourcePersistenceAndRecoveryStateValidated: true;
  readonly provesEveryRequirementProjectsToExactlyOneJourneyDefinitionPassAndEvidenceChain: true;
  readonly provesEveryRequiredAccountStartStateExpandsIntoRunSubjectsAndReachesTerminal: true;
  readonly provesEveryUserAndPseudoLocaleRunEqualsTypedPlatformAnchorAccountStateCartesianDerivation: true;
  readonly provesEveryRequiredRuntimeStateHasExactlyOneRecipeCompatibleCompilerSelectedAssertionPlan: true;
  readonly provesPreconditionsAreObservedBeforeRecoveryTransitionsAndPostconditionsAfterValidation: true;
  readonly provesAuthKindRequiredFieldsUxMetricClassesAndSignedLimitsAreExact: true;
  readonly provesEveryRequiredRecipeFieldHasOneTypedJourneyEventAndNoUiCounterCanReplaceIt: true;
  readonly provesEveryConditionalNestedExternalTaskVariantHasPositiveNegativeFixturesAndWorstCaseCountsWithinSignedLimits: true;
  readonly provesEveryStartingAccountStatePathCanReachTerminalWithinItsExactSignedScalarAndPerClassLimits: true;
  readonly provesCriticalProtocolSurfaceAuthAndRecipeCompileTimeInvariantsWereEmitted: true;
}

interface ReturnFocusPolicyV1 {
  readonly policyId: "resume_exact_source_card_v1";
  readonly captureBeforeExternalTask: readonly ["window_id", "route_id", "source_card_id", "control_id", "action_nonce"];
  readonly restoreOrder: readonly ["same_control", "source_card_primary_action", "source_card_heading", "supply_page_heading"];
  readonly restoreOnlyWhenTargetVisibleEnabledAndSameActionNonce: true;
  readonly restoreRequiresSameCapturedWindowAndRouteBeforeCardOrControlFallback: true;
  readonly announceStateChangeThroughPoliteLiveRegion: true;
  readonly neverMoveFocusDuringPassiveRefresh: true;
  readonly keyboardAndScreenReaderFixtureRequired: true;
  readonly exactActiveElementAndAccessibilityTreeBeforeAfterEvidenceRequired: true;
}

interface ReferenceGradeProfileV3 {
  readonly schemaVersion: "saydo.dev/reference-grade-profile/v3";
  readonly profileId: "saydo-reference-grade-2026-v3";
  readonly requirements: typeof REFERENCE_REQUIREMENTS_V3;
  readonly requirementsDigest: string;
  readonly requirementsDerivation: ReferenceRequirementsDerivationReceiptV3;
  readonly runSubjectDerivation: ReferenceRunSubjectDerivationReceiptV4;
  readonly expectedOracleIdentityRegistry: DeepFrozenCommittedReceiptV1<
    ReferenceExpectedOracleIdentityRegistryReceiptV9
  >;
  readonly exactOracleConformance: DeepFrozenCommittedReceiptV1<ReferenceExactOracleConformanceReceiptV9>;
  readonly requirementKeySet: NonEmptyReadonly<ReferenceRequirementKeyV3>;
  readonly requiredEntryKeys: NonEmptyReadonly<ReferenceEntryKeyV3>;
  readonly requiredJourneyKeys: NonEmptyReadonly<ReferenceJourneyKeyV3>;
  readonly returnFocusPolicy: ReturnFocusPolicyV1;
  readonly derivationAlgorithm: "requirements-v3-sorted-unique-entry-journey-protocol-auth-realm-recipe-fold-v1";
  readonly matrixEntriesJourneysProtocolProfilesAuthRealmsFundingRecipesStatesFixturesAndDocsGeneratedOnlyFromRequirements: true;
  readonly everyRequirementNeedsIndependentCurrentDistributionCompletedPassEvidence: true;
  readonly repeatedEntryRowsRequireIndependentProtocolOrSurfaceConformanceAndCannotShareReports: true;
  readonly ownerAdditionsMayOnlyAppendNamespacedRequirements: true;
  readonly deletionReplacementOrSemanticWeakeningChangesDesignationAndRevokesReferenceGradeAndGa: true;
  readonly v1AndV2ProfilesAreMigrationInputsOnlyAndNeverReferenceGradeOrGaEligible: true;
  readonly requiredJourneyAnchorStartStates: readonly ["not_enrolled", "ready"];
  readonly requiredUserLocales: readonly ["zh-CN", "en-US", "ar-SA"];
  readonly requiredPseudoLocaleSuites: readonly ["en-XA"];
  readonly requiredMutationFixtureKinds: readonly [
    "blocked_readiness_pass_injection",
    "action_required_readiness_pass_injection",
    "advanced_definition_in_required_journey",
    "self_declared_wider_ux_limits",
    "wrong_reference_limit_class_for_journey_tier",
    "omit_not_enrolled_anchor_run",
    "omit_ready_anchor_run",
    "exclude_prerequisite_events_or_elapsed_time_from_unified_metrics",
    "mark_l0_entry_non_required",
    "substitute_conditional_rights_entry_for_fixed_minimum",
    "omit_requirement_protocol_or_surface_row",
    "substitute_recipe_or_manual_field_source",
    "custom_auth_kind_recipe_field_mismatch",
    "custom_recipe_exceeds_signed_per_class_limit",
    "omit_required_starting_account_state_run",
    "cross_attach_starting_account_state_to_wrong_graph_entry",
    "pseudo_locale_uses_unlisted_generic_account_state",
    "cross_attach_run_to_different_typed_reference_run_subject",
    "omit_duplicate_or_misclassify_required_recipe_field_event",
    "omit_mfa_positive_negative_fixture_or_parent_bound_nested_task_event",
    "understate_account_start_path_actions_external_tasks_or_leave_return",
    "run_failed_cancelled_or_external_task_failed_marked_pass",
    "administrator_rejected_or_cancelled_marked_pass",
    "omit_initial_or_terminal_visibility_boundary",
    "duplicate_or_restate_visibility_transition",
    "each_scalar_metric_exact_limit_plus_one",
    "mfa_required_without_nested_task_or_mfa_not_required_with_nested_task",
    "conditional_secret_required_without_field_or_negative_observation_with_field",
    "entitlement_observation_omitted_cross_principal_or_wrong_successor",
    "zero_config_pass_before_runtime_recovery_terminal",
    "single_requirement_self_claims_review_ready",
    "provider_product_swap",
    "wire_profile_swap",
    "origin_path_or_streaming_swap",
    "auth_profile_swap",
    "credential_recipient_namespace_swap",
    "physical_operation_graph_swap",
    "signed_oracle_or_evidence_lock_path_swap",
    "released_distribution_swap"
  ];
  readonly referenceUxLimits: readonly GaReferenceUxLimitV2[];
  readonly referenceUxClassLimits: readonly [
    Extract<GaReferenceUxClassLimitV3, { readonly limitClass: "zero_config_or_local_ready" }>,
    Extract<GaReferenceUxClassLimitV3, { readonly limitClass: "guided_key" }>,
    Extract<GaReferenceUxClassLimitV3, { readonly limitClass: "guided_oauth_or_subscription" }>,
    Extract<GaReferenceUxClassLimitV3, { readonly limitClass: "enterprise_cloud_or_execution" }>,
    Extract<GaReferenceUxClassLimitV3, { readonly limitClass: "custom_endpoint" }>,
    Extract<GaReferenceUxClassLimitV3, { readonly limitClass: "anchor_control" }>
  ];
  readonly perClassUxLimitsAreReleaseGatesNotInformationalMetadata: true;
  readonly remoteLiveQualificationPolicyId: "remote-provider-two-independent-cycles-exact-row-v6";
  readonly requiredRemoteQualificationRequirementKeys: NonEmptyReadonly<
    RequiredRemoteQualificationRequirementKeyV6
  >;
  readonly nonRemoteQualificationRequirementKeys: NonEmptyReadonly<
    NonRemoteQualificationRequirementKeyV6
  >;
  readonly liveQualificationApplicabilityIsCompilerDerivedPerRequirementAndReleaseCannotChooseNotApplicable: true;
  readonly platformSecurityProductionPolicyId: "three-native-helpers-installers-platform-bound-backends-and-typed-remote-witness-v6";
  readonly requiredPlatformOrder: readonly ["macos_arm64", "linux_x64", "windows_x64"];
  readonly macosPersistentBackendSet: readonly ["remote_transparency_witness"];
  readonly linuxPersistentBackendSet: readonly ["tpm2_nv_counter", "remote_transparency_witness"];
  readonly windowsPersistentBackendSet: readonly ["tpm2_nv_counter", "remote_transparency_witness"];
  readonly specialFundingRequirementKeys: NonEmptyReadonly<SpecialFundingRequirementKeyV6>;
  readonly everyTokenHubAndOpenCodeGoFundingVariantExpandsIntoIndependentRunSubjectsAndEvidence: true;
}

declare const ownerRequirementKeyBrandV4: unique symbol;
declare const ownerRequirementNamespaceBrandV10: unique symbol;

type OwnerRequirementKeyV4 = `owner.${string}.${string}` & {
  readonly [ownerRequirementKeyBrandV4]: never;
};

interface OwnerRequirementNamespaceReceiptV4 extends ReceiptRef<
  "receipt:owner-requirement-namespace@10",
  readonly [string, string]
> {
  readonly [ownerRequirementNamespaceBrandV10]: never;
  readonly rawPublisherNamespace: string;
  readonly rawLocalRequirementName: string;
  readonly canonicalPublisherNamespace: string;
  readonly canonicalLocalRequirementName: string;
  readonly canonicalRequirementKey: OwnerRequirementKeyV4;
  readonly nfkcDigest: string;
  readonly unicodeConfusableSkeletonDigest: string;
  readonly canonicalAsciiPattern: "^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?\\.[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$";
  readonly fixedRequirementKeyCollisionCount: 0;
  readonly fixedCompositeSubjectCollisionCount: 0;
  readonly priorOwnerCanonicalKeyOrSkeletonCollisionCount: 0;
  readonly provesLowercaseAsciiLengthNfkcConfusableAndCompositeSubjectUniqueness: true;
}

declare function normalizeAndCommitOwnerRequirementNamespaceV10(input: {
  readonly rawPublisherNamespace: string;
  readonly rawLocalRequirementName: string;
  readonly fixedAndPriorOwnerNamespaceCollisionCorpus: ImportedOpaqueEvidenceLeafReceipt;
  readonly unicodeNfkcAndConfusablePolicy: TufTargetAuthorizationReceipt<
    TufRepositoryIdentityReceipt<"policy">,
    `delegated:${string}`,
    `policies/owner-requirement-namespace/${string}`
  >;
}): DeepFrozenCommittedReceiptV1<OwnerRequirementNamespaceReceiptV4>;

type OwnerAdditionalRequirementInputV7 = Omit<ReferenceRequirementInputV3, "requirementKey"> & {
  readonly requirementKey: OwnerRequirementKeyV4;
  readonly ownerNamespace: OwnerRequirementNamespaceReceiptV4;
  readonly provesRequirementKeyEqualsNamespaceReceiptCanonicalRequirementKey: true;
} & (
  | {
      readonly ownerOnboardingAvailability: "fresh_onboarding";
      readonly signedExistingConnectionMigrationPolicySource?: never;
    }
  | {
      readonly ownerOnboardingAvailability: "existing_connection_migration_only";
      readonly signedExistingConnectionMigrationPolicySource: ImportedOpaqueEvidenceLeafReceipt;
      readonly onboardingRecipe: typeof RECIPE_EXISTING_CONNECTION_MIGRATION_ONLY_V8;
    }
);

interface OwnerConnectionOracleRawSourceV7<
  K extends OwnerRequirementKeyV4 = OwnerRequirementKeyV4,
> {
  readonly requirementKey: K;
  readonly signedConnectorDefinitionOrPluginManifest: ImportedOpaqueEvidenceLeafReceipt;
  readonly rawWireOperationSchemaSource: ImportedOpaqueEvidenceLeafReceipt;
  readonly rawAuthenticationFlowSchemaSource: ImportedOpaqueEvidenceLeafReceipt;
  readonly rawEndpointRealmAndCredentialRecipientSource: ImportedOpaqueEvidenceLeafReceipt;
  readonly rawStreamingFramingAndTerminalSource: ImportedOpaqueEvidenceLeafReceipt;
  readonly officialOrPublisherEvidenceLock: ImportedOpaqueEvidenceLeafReceipt;
  readonly ownerCannotSupplyCompiledWireAuthLiveModeAvailabilityQualificationReceiptsOrReleaseClaims: true;
}

declare const ownerRequirementSemanticCompilationBrandV7: unique symbol;
declare const ownerAdditionalRequirementBrandV7: unique symbol;

interface OwnerRequirementSemanticCompilationReceiptV7<
  I extends OwnerAdditionalRequirementInputV7 = OwnerAdditionalRequirementInputV7,
  O extends ReferenceExactConnectionOracleEntryV6<I["requirementKey"]> = ReferenceExactConnectionOracleEntryV6<I["requirementKey"]>,
> extends ReceiptRef<"receipt:owner-requirement-semantic-compilation@7", readonly [I, O]> {
  readonly [ownerRequirementSemanticCompilationBrandV7]: never;
  readonly rawInput: I;
  readonly rawConnectionOracleSource: OwnerConnectionOracleRawSourceV7<I["requirementKey"]>;
  readonly compiledConnectionOracle: O;
  readonly compilerArtifactDigest: string;
  readonly requirementProtocolSurfaceAuthWireOperationStreamingRealmAndRecipientCompatibilityDigest: string;
  readonly journeyGraphStateAssertionOptionalAuthLiveDependencyAvailabilityAndFundingDerivationDigest: string;
  readonly callerSuppliedDerivedFactCount: 0;
  readonly wireAuthProtocolSurfaceOrRealmMismatchCount: 0;
  readonly missingDuplicateOrExtraPhysicalOperationCount: 0;
  readonly invalidJourneyStateRecipeOrConditionalFieldCount: 0;
  readonly compilerExitCode: 0;
  readonly provesOwnerRawInputPassedTheSameSemanticCompilerProfilesAsFixedInputsAndEveryDerivedFactCameOnlyFromCompilerOutput: true;
}

type OwnerAdditionalRequirementV4<
  I extends OwnerAdditionalRequirementInputV7 = OwnerAdditionalRequirementInputV7,
  O extends ReferenceExactConnectionOracleEntryV6<I["requirementKey"]> = ReferenceExactConnectionOracleEntryV6<I["requirementKey"]>,
> = I & {
  readonly [ownerAdditionalRequirementBrandV7]: never;
  readonly semanticCompilation: OwnerRequirementSemanticCompilationReceiptV7<I, O>;
  readonly requiredStartingAccountStates: I["onboardingRecipe"]["requiredStartingAccountStates"];
  readonly journeyGraph: I["onboardingRecipe"]["journeyGraph"];
  readonly stateAssertionPlan: ReferenceRuntimeStateAssertionPlanForV4<I["requiredRuntimeStates"]>;
  readonly runtimeStateClassifications: ReferenceRuntimeStateClassificationMapForV5<I>;
  readonly connectionOracle: ReferenceExactConnectionOracleRowProjectionV7<
    I["requirementKey"],
    O["wire"],
    O["auth"]
  >;
  readonly authProfile: O["auth"];
  readonly providerWireProfile: O["wire"];
  readonly optionalAuthPolicy: ReferenceOptionalAuthPolicyForRequirementV6<I>;
  readonly liveDependencyClass: ReferenceLiveDependencyClassForRequirementV7<I>;
  readonly liveQualificationMode: ReferenceLiveQualificationModeForRequirementV6<I>;
  readonly onboardingAvailability: ReferenceOnboardingAvailabilityForRequirementV5<I>;
  readonly provesRequirementKeyEqualsNamespaceReceiptCanonicalRequirementKey: true;
  readonly provesNoCallerSuppliedDerivedFactEnteredTheCompiledRequirement: true;
};

type CompiledOwnerAdditionalRequirementTupleV7<
  I extends readonly OwnerAdditionalRequirementInputV7[],
> = {
  readonly [N in keyof I]: I[N] extends OwnerAdditionalRequirementInputV7
    ? OwnerAdditionalRequirementV4<I[N]>
    : never;
};

interface OwnerAdditionalRequirementSetCompilationReceiptV4<
  I extends readonly OwnerAdditionalRequirementInputV7[] = readonly OwnerAdditionalRequirementInputV7[],
  R extends readonly OwnerAdditionalRequirementV4[] = CompiledOwnerAdditionalRequirementTupleV7<I>,
> extends ReceiptRef<"receipt:owner-additional-requirement-set-compilation@7", readonly [I, R]> {
  readonly fixedRequirements: typeof REFERENCE_REQUIREMENTS_V3;
  readonly ownerInputs: I;
  readonly ownerConnectionOracleRawSources: OwnerConnectionOracleRawSourceTupleForInputsV10<I>;
  readonly ownerRequirements: R;
  readonly fixedRequirementsDigest: string;
  readonly ownerInputsDigest: string;
  readonly ownerRequirementsDigest: string;
  readonly canonicalCombinedRequirementKeySetDigest: string;
  readonly canonicalCombinedCompositeSubjectSetDigest: string;
  readonly duplicateCanonicalKeyCount: 0;
  readonly duplicateConfusableSkeletonCount: 0;
  readonly duplicateCompositeSubjectCount: 0;
  readonly nonCanonicalOrReservedNamespaceCount: 0;
  readonly callerSuppliedDerivedFactCount: 0;
  readonly semanticCompilationFailureCount: 0;
  readonly deterministicCompilerArtifactDigest: string;
  readonly deterministicCompilerExitCode: 0;
  readonly provesOwnerRowsOnlyAppendAndCannotShadowReplaceMergeOrWeakenFixedRows: true;
  readonly provesEveryOwnerOutputRowWasProducedFromOneRawInputAndOneRawOracleSourceByTheSameFixedRequirementSemanticCompilerProfiles: true;
}

type OwnerConnectionOracleRawSourceTupleForInputsV10<
  I extends readonly OwnerAdditionalRequirementInputV7[],
> = {
  readonly [N in keyof I]: I[N] extends OwnerAdditionalRequirementInputV7
    ? OwnerConnectionOracleRawSourceV7<I[N]["requirementKey"]>
    : never;
};

declare function compileOwnerAdditionalRequirementSetV7<
  const I extends readonly OwnerAdditionalRequirementInputV7[],
>(input: {
  readonly fixedRequirements: typeof REFERENCE_REQUIREMENTS_V3;
  readonly ownerInputs: I;
  readonly ownerConnectionOracleRawSources: OwnerConnectionOracleRawSourceTupleForInputsV10<NoInfer<I>>;
  readonly semanticCompilerArtifact: ReceiptRef<"receipt:owner-requirement-semantic-compiler-artifact@7">;
  readonly namespaceCollisionAndMutationCorpus: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<OwnerAdditionalRequirementSetCompilationReceiptV4<I>>;

interface GaMandatoryBaselineV3 {
  readonly schemaVersion: "saydo.dev/ga-mandatory-baseline/v3";
  readonly referenceGradeProfileDigest: string;
  readonly requirements: typeof REFERENCE_REQUIREMENTS_V3;
  readonly requirementsDigest: string;
  readonly requirementsDerivation: ReferenceRequirementsDerivationReceiptV3;
  readonly runSubjectDerivation: ReferenceRunSubjectDerivationReceiptV4;
  readonly requiredRequirementKeys: NonEmptyReadonly<ReferenceRequirementKeyV3>;
  readonly requiredEntryKeys: NonEmptyReadonly<ReferenceEntryKeyV3>;
  readonly requiredJourneyKeys: NonEmptyReadonly<ReferenceJourneyKeyV3>;
  readonly requiredProtocolAuthRealmRecipeSubjects: NonEmptyReadonly<ReferenceRequirementRowV3>;
  readonly requiredRuntimeRecoveryRunSubjectDigests: NonEmptyReadonly<string>;
  readonly requiredRemoteQualificationRequirementKeys: NonEmptyReadonly<
    RequiredRemoteQualificationRequirementKeyV6
  >;
  readonly requiredNonRemoteQualificationDispositionKeys: NonEmptyReadonly<
    NonRemoteQualificationRequirementKeyV6
  >;
  readonly requiredPlatformSecurityProductionPolicyId: ReferenceGradeProfileV3["platformSecurityProductionPolicyId"];
  readonly requiredSpecialFundingRequirementKeys: NonEmptyReadonly<SpecialFundingRequirementKeyV6>;
  readonly ownerAdditionalRequirements: readonly OwnerAdditionalRequirementV4[];
  readonly ownerRequirementCompilation: OwnerAdditionalRequirementSetCompilationReceiptV4;
  readonly derivationAlgorithm: "exact-reference-requirements-plus-namespaced-owner-append-only-v1";
  readonly provesNoFixedRequirementWasRemovedReplacedMergedOrWeakened: true;
  readonly provesCombinedKeyAndCompositeSubjectSetsAreCanonicalUniqueAndConfusableFree: true;
}

interface GaEcosystemMatrixCoreV3 {
  readonly schemaVersion: "saydo.dev/ga-ecosystem-matrix/v3";
  readonly referenceGradeProfileDigest: string;
  readonly mandatoryBaselineDigest: string;
  readonly requirementsDigest: string;
  readonly entries: NonEmptyReadonly<GaEcosystemMatrixEntryV2>;
  readonly provesEntriesAndJourneysAreExactProjectionOfReferenceRequirementsAndOwnerAppendOnlyRows: true;
}

declare const gaOwnerDecisionProposalBrandV10: unique symbol;

interface GaOwnerDecisionProposalReceipt extends ReceiptRef<"receipt:ga-owner-decision-proposal@10"> {
  readonly [gaOwnerDecisionProposalBrandV10]: never;
  readonly subjectKind: "matrix_entry" | "journey" | "mandatory_baseline" | "custom_profile";
  readonly subjectKey: string;
  readonly subjectCoreDigest: string;
  readonly referenceGradeProfileDigest: string;
  readonly rationaleDigest: string;
  readonly excludesDecisionAndAttestationFieldsFromSubjectDigest: true;
}

declare function commitGaOwnerDecisionProposalV10(input: {
  readonly subjectKind: GaOwnerDecisionProposalReceipt["subjectKind"];
  readonly subjectKey: string;
  readonly subjectCoreCanonicalBytes: ImportedOpaqueEvidenceLeafReceipt;
  readonly referenceGradeProfileDigest: string;
  readonly rationaleCanonicalBytes: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<GaOwnerDecisionProposalReceipt>;

declare const gaOwnerDecisionAttestationBrandV9: unique symbol;

interface GaOwnerDecisionAttestationBase<P extends GaOwnerDecisionProposalReceipt = GaOwnerDecisionProposalReceipt> {
  readonly [gaOwnerDecisionAttestationBrandV9]: never;
  readonly proposal: P;
  readonly authorizationProposal: Extract<AuthorizationProposalReceipt, { readonly proposalKind: "ga_owner_decision" }>;
  readonly authorizationDisclosure: Extract<AuthorizationDisclosureReceipt, { readonly disclosureKind: "ga_owner_decision" }>;
  readonly userDecision: AcceptedUserDecisionReceipt;
  readonly userDecisionConsumptionCommit: UserDecisionConsumptionCommitReceipt;
  readonly ownerPrincipalDigest: string;
  readonly localControlSession: LocalControlSessionReceipt;
  readonly actionNonceDigest: string;
  readonly decidedAt: string;
  readonly notAfter: string;
  readonly signatureDigest: string;
  readonly provesCoreProposalDisclosureUserDecisionAndFinalDecisionEqual: true;
}

type GaOwnerDecisionAttestationReceipt<P extends GaOwnerDecisionProposalReceipt = GaOwnerDecisionProposalReceipt> = ReceiptRef &
  GaOwnerDecisionAttestationBase<P> &
  (
    | { readonly decision: "approve"; readonly approvedSubjectCoreDigest: P["subjectCoreDigest"] }
    | { readonly decision: "reject"; readonly rejectionReasonDigest: string }
  );

type GaOwnerDecisionAttestationInputV10<P extends GaOwnerDecisionProposalReceipt> = {
  readonly proposal: P;
  readonly authorizationProposal: Extract<AuthorizationProposalReceipt, { readonly proposalKind: "ga_owner_decision" }>;
  readonly authorizationDisclosure: Extract<AuthorizationDisclosureReceipt, { readonly disclosureKind: "ga_owner_decision" }>;
  readonly userDecision: AcceptedUserDecisionReceipt;
  readonly userDecisionConsumptionCommit: UserDecisionConsumptionCommitReceipt;
  readonly localControlSession: LocalControlSessionReceipt;
  readonly rawOwnerSignatureAndNonceEvidence: ImportedOpaqueEvidenceLeafReceipt;
} & (
  | { readonly decision: "approve"; readonly rejectionReasonDigest?: never }
  | { readonly decision: "reject"; readonly rejectionReasonDigest: string }
);

declare function commitGaOwnerDecisionAttestationV9<
  const P extends GaOwnerDecisionProposalReceipt,
  const I extends GaOwnerDecisionAttestationInputV10<NoInfer<P>>,
>(input: I): DeepFrozenCommittedReceiptV1<
  Extract<GaOwnerDecisionAttestationReceipt<P>, { readonly decision: I["decision"] }>
>;

type OpenCodeGoFundingSubjectV6 = {
  readonly requirementKey: "opencode.go.chat" | "opencode.go.responses" | "opencode.go.messages";
  readonly subscriptionPrincipalDigest: string;
  readonly subscriptionEntitlementVersionDigest: string;
  readonly modelId: string;
  readonly protocolProfile: "openai_chat_completions" | "openai_responses" | "anthropic_messages";
};

type OpenCodeGoFundingClosureReceiptV6 = ReceiptRef<
  "receipt:opencode-go-funding-closure@6",
  OpenCodeGoFundingSubjectV6
> & {
  readonly subject: OpenCodeGoFundingSubjectV6;
  readonly authoritativeSubscriptionUsageAndResetEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly checkedAt: string;
  readonly expiresAt: string;
} &
  (
    | {
        readonly variantId: "go_limit_only";
        readonly observedFundingState: "overage_disabled";
        readonly zenBalanceComponent?: never;
        readonly paidDispatchAuthorization?: never;
        readonly quotaExhaustionDisposition: "hard_stop_without_new_spend";
      }
    | {
        readonly variantId: "go_plus_zen_balance";
        readonly observedFundingState: "overage_zen_balance_enabled";
        readonly zenBalanceComponent: ReceiptRef<
          "receipt:opencode-zen-balance-component@6",
          OpenCodeGoFundingSubjectV6
        >;
        readonly paidDispatchAuthorization: RuntimeSpendAuthorizationReceipt;
        readonly quotaExhaustionDisposition: "continue_only_under_exact_user_budget_and_disclosure";
      }
  );

type SpecialFundingVariantIdForRequirementV7<K extends SpecialFundingRequirementKeyV6> =
  (typeof REFERENCE_SPECIAL_FUNDING_VARIANT_REGISTRY_V6)[K][number]["variantId"];

type ProtocolForSpecialFundingRequirementV7<K extends SpecialFundingRequirementKeyV6> =
  K extends `${string}.chat` ? "openai_chat_completions"
    : K extends `${string}.responses` ? "openai_responses"
      : "anthropic_messages";

type TokenHubSiteForRequirementV7<K extends TokenHubRequirementKeyV5> =
  K extends `tokenhub.gz.${string}` ? "guangzhou" : "singapore";

type TokenHubFundingModeForVariantV7<V extends SpecialFundingVariantIdForRequirementV7<TokenHubRequirementKeyV5>> =
  V extends "tokenhub_free_only" ? "free_only"
    : V extends "tokenhub_free_then_payg" ? "free_then_payg"
      : V extends "tokenhub_reserved" ? "reserved"
        : "dedicated";

type TokenHubFundingClosureForVariantV7<
  K extends TokenHubRequirementKeyV5,
  V extends SpecialFundingVariantIdForRequirementV7<K>,
> = Extract<
  TokenHubFundingClosureReceiptV6,
  { readonly fundingMode: TokenHubFundingModeForVariantV7<V> }
> & {
  readonly subject: TokenHubFundingSubjectV6 & {
    readonly siteRealm: TokenHubSiteForRequirementV7<K>;
    readonly operationProfile: ProtocolForSpecialFundingRequirementV7<K>;
  };
} & (V extends "tokenhub_free_only"
  ? { readonly paymentEnabled: false; readonly paidComponent?: never }
  : { readonly paymentEnabled: true });

type TencentEnterpriseTokenPlanSiteForRequirementV20<
  K extends TencentEnterpriseTokenPlanRequirementKeyV20,
> = K extends `tencent-enterprise-plan.gz.${string}` ? "guangzhou" : "singapore";

type TencentEnterpriseTokenPlanFundingModeForVariantV20<
  V extends SpecialFundingVariantIdForRequirementV7<TencentEnterpriseTokenPlanRequirementKeyV20>,
> = V extends "enterprise_professional_points"
  ? "enterprise_professional_points"
  : "enterprise_auto_token_pool";

type TencentEnterpriseTokenPlanFundingClosureForVariantV20<
  K extends TencentEnterpriseTokenPlanRequirementKeyV20,
  V extends SpecialFundingVariantIdForRequirementV7<K>,
> = Extract<
  TencentEnterpriseTokenPlanFundingClosureReceiptV20,
  { readonly fundingMode: TencentEnterpriseTokenPlanFundingModeForVariantV20<V> }
> & {
  readonly subject: TencentEnterpriseTokenPlanFundingSubjectV20 & {
    readonly siteRealm: TencentEnterpriseTokenPlanSiteForRequirementV20<K>;
    readonly operationProfile: ProtocolForSpecialFundingRequirementV7<K>;
    readonly productEdition: TencentEnterpriseTokenPlanFundingModeForVariantV20<V>;
  };
};

type OpenCodeGoFundingClosureForVariantV7<
  K extends "opencode.go.chat" | "opencode.go.responses" | "opencode.go.messages",
  V extends SpecialFundingVariantIdForRequirementV7<K>,
> = Extract<OpenCodeGoFundingClosureReceiptV6, { readonly variantId: V }> & {
  readonly subject: OpenCodeGoFundingSubjectV6 & {
    readonly requirementKey: K;
    readonly protocolProfile: ProtocolForSpecialFundingRequirementV7<K>;
  };
} & (V extends "go_limit_only"
  ? { readonly zenBalanceComponent?: never; readonly paidDispatchAuthorization?: never }
  : { readonly zenBalanceComponent: ReceiptRef<"receipt:opencode-zen-balance-component@6", OpenCodeGoFundingSubjectV6>; readonly paidDispatchAuthorization: RuntimeSpendAuthorizationReceipt });

type SpecialFundingVariantEvidenceForV7<
  K extends SpecialFundingRequirementKeyV6,
  V extends SpecialFundingVariantIdForRequirementV7<K>,
> = ReceiptRef<"receipt:special-funding-variant-evidence@7", readonly [K, V]> & {
  readonly requirement: ReferenceRowByKeyV3<K>;
  readonly requirementKey: K;
  readonly registryVariant: Extract<
    (typeof REFERENCE_SPECIAL_FUNDING_VARIANT_REGISTRY_V6)[K][number],
    { readonly variantId: V }
  >;
  readonly variantId: V;
  readonly fundingFamily: K extends TokenHubRequirementKeyV5
    ? "tencent_tokenhub"
    : K extends TencentEnterpriseTokenPlanRequirementKeyV20
      ? "tencent_enterprise_token_plan"
      : "opencode_go";
  readonly fundingClosure: K extends TokenHubRequirementKeyV5
    ? TokenHubFundingClosureForVariantV7<K, V>
    : K extends TencentEnterpriseTokenPlanRequirementKeyV20
      ? TencentEnterpriseTokenPlanFundingClosureForVariantV20<K, V>
      : K extends "opencode.go.chat" | "opencode.go.responses" | "opencode.go.messages"
        ? OpenCodeGoFundingClosureForVariantV7<K, V>
        : never;
  readonly expectedIndependentRunSubjectDigests: NonEmptyReadonly<string>;
  readonly actualIndependentCompletedRunSubjectDigests: NonEmptyReadonly<string>;
  readonly provesRequirementRegistrySiteProtocolPrincipalModelVariantFundingModePaymentOverageAndRunSubjectsAreExact: true;
};

type SpecialFundingVariantEvidenceV6 = {
  [K in SpecialFundingRequirementKeyV6]: {
    [V in SpecialFundingVariantIdForRequirementV7<K>]: SpecialFundingVariantEvidenceForV7<K, V>;
  }[SpecialFundingVariantIdForRequirementV7<K>];
}[SpecialFundingRequirementKeyV6];

type _ReferenceTencentEnterpriseTokenPlanFundingEvidenceBranchesConstructibleV20 =
  ReferenceInvariantTrueV3<
    ReferenceInvariantEqualV3<
      readonly [
        SpecialFundingVariantEvidenceForV7<
          "tencent-enterprise-plan.gz.chat",
          "enterprise_professional_points"
        > extends never ? false : true,
        SpecialFundingVariantEvidenceForV7<
          "tencent-enterprise-plan.gz.messages",
          "enterprise_auto_token_pool"
        > extends never ? false : true,
        SpecialFundingVariantEvidenceForV7<
          "tencent-enterprise-plan.sg.chat",
          "enterprise_professional_points"
        > extends never ? false : true,
        SpecialFundingVariantEvidenceForV7<
          "tencent-enterprise-plan.sg.messages",
          "enterprise_auto_token_pool"
        > extends never ? false : true
      ],
      readonly [true, true, true, true]
    >
  >;

type ExactSpecialFundingEvidenceMapV7 = {
  readonly [K in SpecialFundingRequirementKeyV6]: {
    readonly [V in SpecialFundingVariantIdForRequirementV7<K>]: SpecialFundingVariantEvidenceForV7<K, V>;
  };
};

declare const specialFundingReleaseClosureBrandV6: unique symbol;

interface SpecialFundingReleaseClosureV6<D extends string = string> extends ReceiptRef {
  readonly [specialFundingReleaseClosureBrandV6]: never;
  readonly testedDistributionArtifactDigest: D;
  readonly variantRegistry: typeof REFERENCE_SPECIAL_FUNDING_VARIANT_REGISTRY_V6;
  readonly variantRegistryDigest: string;
  readonly expectedSpecialFundingRequirementKeys: NonEmptyReadonly<SpecialFundingRequirementKeyV6>;
  readonly actualSpecialFundingRequirementKeys: NonEmptyReadonly<SpecialFundingRequirementKeyV6>;
  readonly expectedRequirementVariantPairCount: 38;
  readonly actualRequirementVariantPairCount: 38;
  readonly expectedRequirementVariantPairSetDigest: string;
  readonly actualRequirementVariantPairSetDigest: string;
  readonly evidenceByRequirementAndVariant: ExactSpecialFundingEvidenceMapV7;
  readonly orderedVariantEvidence: NonEmptyReadonly<SpecialFundingVariantEvidenceV6>;
  readonly tokenHubFreeOnlyPaidSendCount: 0;
  readonly enterprisePlanCrossEditionRegionPersonalPlanOrOrdinaryTokenHubSubstitutionCount: 0;
  readonly opencodeGoLimitOnlyZenBalanceOrPaidDispatchCount: 0;
  readonly missingDuplicateExtraOrCrossRequirementCount: 0;
  readonly provesEveryOrdinaryTokenHubEnterpriseTokenPlanAndOpenCodeGoVariantHasIndependentExactEvidenceAndReleaseRuns: true;
}

declare function commitSpecialFundingReleaseClosureV7<const D extends string>(input: {
  readonly testedDistributionArtifactDigest: D;
  readonly variantRegistry: typeof REFERENCE_SPECIAL_FUNDING_VARIANT_REGISTRY_V6;
  readonly evidenceByRequirementAndVariant: ExactSpecialFundingEvidenceMapV7;
  readonly completedLiveQualificationRuns: NonEmptyReadonly<GaLiveProviderQualificationRunReceiptV6>;
}): DeepFrozenCommittedReceiptV1<SpecialFundingReleaseClosureV6<D>>;

type GaApprovedOwnerDecisionAttestationReceipt = Extract<
  GaOwnerDecisionAttestationReceipt,
  { readonly decision: "approve" }
>;

interface GaOwnerDecisionEvidenceSetV1 {
  readonly schemaVersion: "saydo.dev/ga-owner-decision-evidence-set/v1";
  readonly gaMatrixCoreDigest: string;
  readonly gaMandatoryBaselineDigest: string;
  readonly referenceGradeProfileDigest: string;
  readonly decisions: NonEmptyReadonly<GaApprovedOwnerDecisionAttestationReceipt>;
  readonly provesExactRequiredSubjectCoverageWithoutEmbeddingInCore: true;
}

declare const gaExactReferenceRunSubjectBindingBrandV4: unique symbol;

interface GaExactReferenceRunSubjectBindingReceiptV4<
  R extends ReferenceRequirementRowV3,
> extends ReceiptRef<"receipt:ga-exact-reference-run-subject-binding@4", R> {
  readonly [gaExactReferenceRunSubjectBindingBrandV4]: never;
  readonly referenceRequirement: R;
  readonly exactReferenceRunSubject:
    | GaReferenceUserRunSubjectV4<R>
    | GaReferencePseudoLocaleRunSubjectV4<R>;
  readonly requirementKey: R["requirementKey"];
  readonly entryKey: R["entryKey"];
  readonly journeyKey: R["journeyKey"];
  readonly surfaceKind: R["surfaceKind"];
  readonly protocolProfile: R["protocolProfile"];
  readonly authKind: R["authKind"];
  readonly realmClass: R["realmClass"];
  readonly onboardingRecipe: R["onboardingRecipe"];
  readonly requiredRuntimeStates: R["requiredRuntimeStates"];
  readonly stateAssertionPlan: R["stateAssertionPlan"];
  readonly provesAllFlatFieldsStartingStateGraphEntryPlatformLocaleAnchorRecipeAndPlanExact: true;
}

declare function commitGaExactReferenceRunSubjectBindingV4<
  const R extends ReferenceRequirementRowV3,
>(input: {
  readonly referenceRequirement: R;
  readonly exactReferenceRunSubject:
    | GaReferenceUserRunSubjectV4<NoInfer<R>>
    | GaReferencePseudoLocaleRunSubjectV4<NoInfer<R>>;
}): GaExactReferenceRunSubjectBindingReceiptV4<R>;

declare const gaExactReferenceRunSubjectBindingIndexBrandV9: unique symbol;

interface GaExactReferenceRunSubjectBindingIndexV9 extends ReceiptRef<
  "receipt:ga-exact-reference-run-subject-binding-index@9",
  ReferenceRequirementKeyV3
> {
  readonly [gaExactReferenceRunSubjectBindingIndexBrandV9]: never;
  readonly requirementKey: ReferenceRequirementKeyV3;
  readonly entryKey: ReferenceEntryKeyV3;
  readonly journeyKey: ReferenceJourneyKeyV3;
  readonly exactBindingReceiptId: string;
  readonly exactBindingDigest: string;
  readonly exactReferenceRunSubjectDigest: string;
  readonly indexWasCommittedOnlyFromOneExactBrandedBindingWithoutTypeErasure: true;
}

type CommittedGaExactReferenceRunSubjectBindingIndexForRowV10<
  R extends ReferenceRequirementRowV3,
> = DeepFrozenCommittedReceiptV1<
  GaExactReferenceRunSubjectBindingIndexV9 & {
    readonly requirementKey: R["requirementKey"];
    readonly entryKey: R["entryKey"];
    readonly journeyKey: R["journeyKey"];
  }
>;

declare function commitGaExactReferenceRunSubjectBindingIndexV9<
  const R extends ReferenceRequirementRowV3,
>(input: {
  readonly exactBinding: GaExactReferenceRunSubjectBindingReceiptV4<R>;
}): DeepFrozenCommittedReceiptV1<
  GaExactReferenceRunSubjectBindingIndexV9 & {
    readonly requirementKey: R["requirementKey"];
    readonly entryKey: R["entryKey"];
    readonly journeyKey: R["journeyKey"];
  }
>;

type GaJourneyRunSubjectV2 = GaJourneySubjectTemplateV1 & {
  readonly distributionArtifactDigest: string;
  readonly platformProfileDigest: string;
  readonly startingAnchorState: "not_enrolled" | "ready";
  readonly exactReferenceBinding: GaExactReferenceRunSubjectBindingIndexV9;
  readonly referenceRequirement: ReferenceRequirementRowV3;
  readonly referenceRunSubject: GaReferenceRunSubjectIndexV9;
  readonly referenceRunSubjectDigest: string;
  readonly requirementKey: ReferenceRequirementKeyV3;
  readonly platformProfile: ReferencePlatformProfileV4;
  readonly startingAccountState: ReferenceStartingAccountStateV3;
  readonly startingGraphEntry: ReferenceJourneyGraphV3["startStateEntrySteps"][number];
  readonly onboardingRecipe: ReferenceOnboardingRecipeV1;
  readonly requiredRuntimeStates: readonly ReferenceRuntimeStateV3[];
  readonly stateAssertionPlan: ReferenceRequirementV3["stateAssertionPlan"];
  readonly provesAllFlatSubjectFieldsEqualTheExactBrandedReferenceBinding: true;
} &
  (
    | {
        readonly runKind: "user_journey";
        readonly userLocale: "zh-CN" | "en-US" | "ar-SA";
        readonly pseudoLocaleSuite?: never;
      }
    | {
        readonly runKind: "pseudo_locale_suite";
        readonly userLocale?: never;
        readonly pseudoLocaleSuite: "en-XA";
        readonly pseudoLocaleProfileDigest: string;
        readonly externalProviderActionCap: 0;
        readonly externalTaskExecutionMode: "deterministic_non_network_fixture_preserving_user_path_metrics";
        readonly actualNetworkProcessBrowserAndProviderEffectCount: 0;
        readonly provesSyntheticExternalTaskEventsPreserveExactGraphPathMetricClassesWithoutExternalEffects: true;
        readonly provesStartingAccountStateComesFromExactReferenceRequirementRunSubject: true;
      }
  );

interface GaJourneyActionInventoryCompositionBaseV2 extends ReceiptRef {
  readonly runSubject: GaJourneyRunSubjectV2;
  readonly anchorPrerequisiteClosure: GaAnchorPrerequisiteClosureReceipt;
  readonly prerequisiteActionEventSetDigest: string;
  readonly prerequisiteUxMetrics: GaUxEventMetricVectorV2;
  readonly mainJourneyActionEventSetDigest: string;
  readonly mainJourneyUxMetrics: GaUxEventMetricVectorV2;
  readonly unifiedTypedActionEventInventoryDigest: string;
  readonly typedActionEvents: readonly GaUxActionEventV3[];
  readonly exactRequiredRecipeFields: GaJourneyRunSubjectV2["onboardingRecipe"]["fields"];
  readonly exactRequiredRecipeFieldEventSetDigest: string;
  readonly returnFocusEvidence: readonly GaReturnFocusEvidenceReceipt[];
  readonly metricReducer: GaUxMetricReducerReceiptV4;
  readonly actualUxMetrics: GaUxActualMetricsV2;
  readonly compositionAlgorithm: "ordered-disjoint-union-componentwise-sum-v1";
  readonly provesPrerequisiteAndMainEventSetsDisjointCompleteAndExactlyEqualUnifiedInventory: true;
  readonly provesEveryUxMetricEqualsComponentwiseSumIncludingElapsedIntervalsWithoutDoubleCounting: true;
  readonly provesActualUxMetricsExactlyEqualDeterministicReducerOutput: true;
  readonly provesActualMetricsStartingAccountStateEqualsRunSubjectAndExecutedGraphEntry: true;
  readonly provesEveryRequiredRecipeFieldHasExactlyOneMatchingCommittedEventAndNoUndeclaredFieldEvent: true;
  readonly provesRecipeFieldGroupStepsExpandOnlyToStillUncommittedRequiredFieldsBeforeValidation: true;
  readonly provesPrimaryActionEventsEqualExactlyTheVisitedUserTriggeredJourneyStepsAndNoAutomaticStepEmitsOne: true;
  readonly provesEveryLeaveEventHasExactlyOneSameNonceReturnFocusEvidenceAndNoPassiveRefreshFocusMove: true;
}

type GaJourneyActionInventoryCompositionReceipt = GaJourneyActionInventoryCompositionBaseV2 &
  (
    | ({
        [C in "supply" | "execution"]: {
          readonly journeyClass: C;
          readonly startingAnchorState: "ready";
          readonly anchorPrerequisiteClosure: Extract<
            GaAnchorPrerequisiteClosureReceipt,
            { readonly startingAnchorState: "ready"; readonly prerequisiteMode: "already_ready" }
          >;
          readonly prerequisiteActionEventSetDigest: "sha256-empty-set";
          readonly prerequisiteUxMetrics: GaZeroUxEventMetricVectorV2;
        };
      }["supply" | "execution"])
    | ({
        [C in "supply" | "execution"]: {
          readonly journeyClass: C;
          readonly startingAnchorState: "not_enrolled";
          readonly anchorPrerequisiteClosure: Extract<
            GaAnchorPrerequisiteClosureReceipt,
            { readonly startingAnchorState: "not_enrolled"; readonly prerequisiteMode: "fresh_enrollment_composed" }
          >;
          readonly prerequisiteActionEventSetDigest: string;
          readonly prerequisiteUxMetrics: GaUxEventMetricVectorV2;
        };
      }["supply" | "execution"])
    | ({
        [A in "not_enrolled" | "ready"]: {
          readonly journeyClass: "control_plane";
          readonly startingAnchorState: A;
          readonly anchorPrerequisiteClosure: Extract<
            GaAnchorPrerequisiteClosureReceipt,
            { readonly prerequisiteMode: "journey_is_anchor_control" }
          > & { readonly startingAnchorState: A };
          readonly prerequisiteActionEventSetDigest: "sha256-empty-set";
          readonly prerequisiteUxMetrics: GaZeroUxEventMetricVectorV2;
        };
      }["not_enrolled" | "ready"])
  );

interface GaAccessibilitySnapshotEvidenceBaseV6 extends ReceiptRef {
  readonly testedDistributionArtifactDigest: string;
  readonly exactRunSubjectDigest: string;
  readonly platformProfile: ReferencePlatformProfileV4;
  readonly locale: "zh-CN" | "en-US" | "ar-SA" | "en-XA";
  readonly viewportCssPixels: { readonly width: number; readonly height: number };
  readonly deviceScaleFactor: number;
  readonly zoomPercent: 100 | 200 | 400;
  readonly inputModality: "keyboard_only" | "screen_reader_keyboard" | "pointer";
  readonly screenReader:
    | { readonly kind: "voiceover"; readonly versionDigest: string }
    | { readonly kind: "nvda"; readonly versionDigest: string }
    | { readonly kind: "orca"; readonly versionDigest: string }
    | { readonly kind: "none" };
  readonly exactDomSnapshotEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly exactAccessibilityTreeEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly exactFocusTraceEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly exactLiveRegionTraceEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly exactRenderedScreenshotEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly axeOrEquivalentRuleResultEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly wcagTarget: "WCAG-2.2-AA";
  readonly keyboardTraversalComplete: boolean;
  readonly focusOrderMatchesVisualAndSemanticOrder: boolean;
  readonly focusNeverLostOrTrapped: boolean;
  readonly statusAndErrorAnnouncementsCompleteAndNonDuplicated: boolean;
  readonly controlsHaveProgrammaticNameRoleStateAndErrorAssociation: boolean;
  readonly textReflowHasNoTwoDimensionalScrollAt320CssPixelsExceptEssentialContent: boolean;
  readonly outcome: "pass" | "fail";
}

type GaAccessibilitySnapshotEvidenceReceiptV4 = GaAccessibilitySnapshotEvidenceBaseV6 &
  (
    | {
        readonly viewportClass: "desktop";
        readonly colorScheme: "light" | "dark";
        readonly presentationProfile: "canonical_desktop_light" | "canonical_desktop_dark";
      }
    | {
        readonly viewportClass: "mobile";
        readonly colorScheme: "paper";
        readonly presentationProfile: "canonical_mobile_paper";
      }
  );

declare const gaAccessibilityPassSnapshotBrandV9: unique symbol;

type GaAccessibilityPassSnapshotReceiptV9 = GaAccessibilitySnapshotEvidenceReceiptV4 & {
  readonly [gaAccessibilityPassSnapshotBrandV9]: never;
  readonly matrixKey: readonly [
    ReferencePlatformProfileV4,
    "zh-CN" | "en-US" | "ar-SA" | "en-XA",
    "desktop" | "mobile",
    "canonical_desktop_light" | "canonical_desktop_dark" | "canonical_mobile_paper",
    { readonly width: number; readonly height: number },
    number,
    100 | 200 | 400,
    "keyboard_only" | "screen_reader_keyboard" | "pointer",
    GaAccessibilitySnapshotEvidenceBaseV6["screenReader"],
  ];
  readonly keyboardTraversalComplete: true;
  readonly focusOrderMatchesVisualAndSemanticOrder: true;
  readonly focusNeverLostOrTrapped: true;
  readonly statusAndErrorAnnouncementsCompleteAndNonDuplicated: true;
  readonly controlsHaveProgrammaticNameRoleStateAndErrorAssociation: true;
  readonly textReflowHasNoTwoDimensionalScrollAt320CssPixelsExceptEssentialContent: true;
  readonly outcome: "pass";
};

declare function commitGaAccessibilityPassSnapshotV9(input: {
  readonly rawSnapshot: GaAccessibilitySnapshotEvidenceReceiptV4;
  readonly requiredPresentationMatrix: GaAccessibilityRequiredPresentationMatrixReceiptV6;
  readonly registeredAssertionEvaluator: ReceiptRef<"receipt:ga-accessibility-assertion-evaluator@9">;
}): DeepFrozenCommittedReceiptV1<GaAccessibilityPassSnapshotReceiptV9>;

interface GaAccessibilityRequiredPresentationMatrixReceiptV6 extends ReceiptRef {
  readonly schemaVersion: "saydo.dev/ga-accessibility-required-presentation-matrix/v6";
  readonly canonicalUiSpecDigest: string;
  readonly requiredPresentationProfiles: readonly [
    "canonical_desktop_light",
    "canonical_desktop_dark",
    "canonical_mobile_paper",
  ];
  readonly desktopColorSchemes: readonly ["light", "dark"];
  readonly mobileColorSchemes: readonly ["paper"];
  readonly mobileDarkOrLightSubstitutionForbidden: true;
  readonly platformLocaleZoomInputAndScreenReaderAxesDigest: string;
  readonly exactCartesianExpansionDigest: string;
  readonly provesPresentationProfilesMatchTheCurrentCanonicalDesktopAndMobileSpecification: true;
}

interface GaIcuMessageParityEvidenceReceiptV4 extends ReceiptRef {
  readonly testedDistributionArtifactDigest: string;
  readonly exactRunSubjectDigest: string;
  readonly sourceLocale: "zh-CN" | "en-US" | "ar-SA";
  readonly comparisonLocale: "zh-CN" | "en-US" | "ar-SA" | "en-XA";
  readonly exactVisitedMessageKeySetDigest: string;
  readonly exactRenderedMessageArgumentSetDigest: string;
  readonly missingKeyCount: number;
  readonly extraKeyCount: number;
  readonly placeholderMismatchCount: number;
  readonly untranslatedFallbackCount: number;
  readonly clippedOrOverflowingMessageCount: number;
  readonly outcome: "pass" | "fail";
}

declare const gaUiQualificationBrandV4: unique symbol;

interface GaUiQualificationPassReceiptV4 extends ReceiptRef {
  readonly [gaUiQualificationBrandV4]: never;
  readonly testedDistributionArtifactDigest: string;
  readonly exactRunSubjectDigest: string;
  readonly accessibilityRuns: NonEmptyReadonly<GaAccessibilityPassSnapshotReceiptV9>;
  readonly icuParityRuns: NonEmptyReadonly<
    GaIcuMessageParityEvidenceReceiptV4 & { readonly outcome: "pass" }
  >;
  readonly requiredPlatformLocaleViewportZoomInputAndScreenReaderMatrixDigest: string;
  readonly actualPlatformLocaleViewportZoomInputAndScreenReaderMatrixDigest: string;
  readonly requiredPresentationMatrix: GaAccessibilityRequiredPresentationMatrixReceiptV6;
  readonly requiredAndActualPresentationProfileSetDigest: string;
  readonly missingMatrixCellCount: 0;
  readonly duplicateMatrixCellCount: 0;
  readonly failedAccessibilityOrIcuAssertionCount: 0;
  readonly provesExpectedAndActualMatrixAreAnExactKeyedBijectionForThisDistributionAndRunSubject: true;
  readonly outcome: "pass";
}

declare function commitGaUiQualificationPassV4(input: {
  readonly testedDistributionArtifactDigest: string;
  readonly exactRunSubjectDigest: string;
  readonly accessibilityRuns: NonEmptyReadonly<GaAccessibilityPassSnapshotReceiptV9>;
  readonly icuParityRuns: NonEmptyReadonly<GaIcuMessageParityEvidenceReceiptV4>;
  readonly signedRequiredMatrixReceipt: GaAccessibilityRequiredPresentationMatrixReceiptV6;
}): DeepFrozenCommittedReceiptV1<GaUiQualificationPassReceiptV4>;

interface ActivationActivePointerCommitReceiptV4<
  M extends ActivationManifest = ActivationManifest,
> extends ReceiptRef<"receipt:activation-active-pointer-commit@4", M> {
  readonly activationManifest: M;
  readonly connectionId: M["connectionId"];
  readonly connectionRevision: M["connectionRevision"];
  readonly activePointerRevision: number;
  readonly predecessorActivePointer?: ActivationActivePointerCommitReceiptV4<M>;
  readonly compareAndSwapCommitEvidence: ReceiptRef;
  readonly provesManifestWasCommittedBeforePointerAndPointerHasOneSuccessor: true;
}

type GaPositiveSupplyJourneyTerminalEvidenceForSlotV6<K extends SupplySlotId> = ReceiptRef & {
  readonly terminalKind: "supply_conversation_activation";
  readonly invokedSlot: K;
  readonly runSubject: GaJourneyRunSubjectV2;
  readonly liveConformanceResult: LiveConformanceResultReceipt;
  readonly capability: CapabilityReceipt;
  readonly binding: SupplySlotBindingReceipt<K>;
  readonly activationManifest: InferenceActivationManifest;
  readonly activePointerCommit: ActivationActivePointerCommitReceiptV4<InferenceActivationManifest>;
  readonly finalConnectionReadiness: "connected_verified";
  readonly finalSolutionReadiness: "conversation_ready";
  readonly provesLiveResultCapabilityBindingManifestPointerSubjectModelRouteSlotAndDistributionExact: true;
};

type GaPositiveSupplyJourneyTerminalEvidenceV6 = {
  [K in SupplySlotId]: GaPositiveSupplyJourneyTerminalEvidenceForSlotV6<K>;
}[SupplySlotId];

type GaPositiveJourneyTerminalEvidenceV4 =
  | GaPositiveSupplyJourneyTerminalEvidenceV6
  | (ReceiptRef & {
      readonly terminalKind: "existing_connection_migration_disposition";
      readonly runSubject: GaJourneyRunSubjectV2;
      readonly referenceRequirement: ReferenceRowByKeyV3<"hunyuan.cn">;
      readonly existingLegacyConnectionValidationTerminal: ImportedOpaqueEvidenceLeafReceipt;
      readonly selectedDisposition: "migrated_to_qualified_tokenhub_destination" | "retained_read_only" | "retired";
      readonly migrationDestinationQualification?: ImportedOpaqueEvidenceLeafReceipt;
      readonly freshAccountBillingCredentialCreationAndPickerActionCount: 0;
      readonly finalMigrationReadiness: "migration_disposition_committed";
      readonly provesExistingConnectionValidationDispositionAndNoFreshOnboardingExact: true;
    })
  | (ReceiptRef &
      {
        readonly terminalKind: "execution_session_and_turn_activation";
        readonly runSubject: GaJourneyRunSubjectV2;
        readonly activationManifest: ExecutionActivationManifest;
        readonly activePointerCommit: ActivationActivePointerCommitReceiptV4<ExecutionActivationManifest>;
        readonly sessionStartTerminal: Extract<
          ExecutionSessionStartTerminalReceipt,
          { readonly outcome: "started" }
        >;
        readonly executionSession: ExecutionSessionLeaseReceipt;
        readonly completedTurnTerminal: Extract<ExecutionTurnTerminalReceipt, { readonly outcome: "completed" }>;
        readonly finalConnectionReadiness: "connected_verified";
        readonly finalExecutionReadiness: "execution_ready";
        readonly provesActivationPointerSessionSurfaceStartTerminalAndCompletedTurnSubjectExact: true;
      })
  | (ReceiptRef &
      {
        readonly terminalKind: "anchor_control_ready";
        readonly runSubject: GaJourneyRunSubjectV2;
        readonly enrollmentCommit: AnchorBootstrapEnrollmentCommitReceipt;
        readonly resultingAnchor: SecurityMonotonicAnchorReceipt;
        readonly finalControlReadiness: "control_ready";
        readonly provesEnrollmentCommitAnchorRunSubjectPlatformContinuityAndDistributionExact: true;
      });

declare const gaPositiveJourneyTerminalBrandV4: unique symbol;

type BrandedGaPositiveJourneyTerminalEvidenceV4 = GaPositiveJourneyTerminalEvidenceV4 & {
  readonly [gaPositiveJourneyTerminalBrandV4]: never;
};

type GaPositiveJourneyTerminalKindV4 = GaPositiveJourneyTerminalEvidenceV4["terminalKind"];

type GaPositiveJourneyTerminalCommitInputV4<
  R extends GaJourneyRunSubjectV2,
  K extends GaPositiveJourneyTerminalKindV4,
> = Omit<
  Extract<GaPositiveJourneyTerminalEvidenceV4, { readonly terminalKind: K }>,
  keyof ReceiptRef | "runSubject"
> & {
  readonly runSubject: R;
  readonly testedDistributionArtifactDigest: R["distributionArtifactDigest"];
};

declare function commitGaPositiveJourneyTerminalEvidenceV4<
  R extends GaJourneyRunSubjectV2,
  K extends GaPositiveJourneyTerminalKindV4,
>(
  input: GaPositiveJourneyTerminalCommitInputV4<R, K>,
): Extract<BrandedGaPositiveJourneyTerminalEvidenceV4, { readonly terminalKind: K }> & {
  readonly runSubject: R;
};

declare function commitGaPositiveSupplyJourneyTerminalEvidenceV6<
  R extends GaJourneyRunSubjectV2,
  K extends SupplySlotId,
>(input: Omit<
  GaPositiveSupplyJourneyTerminalEvidenceForSlotV6<K>,
  keyof ReceiptRef | "runSubject"
> & {
  readonly runSubject: R;
  readonly testedDistributionArtifactDigest: R["distributionArtifactDigest"];
}): Extract<
  BrandedGaPositiveJourneyTerminalEvidenceV4,
  { readonly terminalKind: "supply_conversation_activation"; readonly invokedSlot: K }
> & { readonly runSubject: R };

type SupplySolutionSlotOrdinalV4 = 0 | 1 | 2 | 3;

type SupplySolutionSlotIdForOrdinalV4<I extends SupplySolutionSlotOrdinalV4> = I extends 0
  ? "dialog"
  : I extends 1
    ? "thinking"
    : I extends 2
      ? "cheap"
      : "evaluator";

type SupplySolutionSlotBindingForOrdinalV4<
  S extends SupplySolutionReceipt,
  I extends SupplySolutionSlotOrdinalV4,
> = Extract<S["slots"][I], { readonly slot: SupplySolutionSlotIdForOrdinalV4<I> }>;

type InferenceReferenceRequirementRowV5 = Extract<
  ReferenceRequirementRowV3,
  { readonly surfaceKind: "inference" }
>;

declare const gaReviewConversationReadyGateBrandV5: unique symbol;

type GaReviewConversationReadyGateForDistributionV4<
  D extends string,
  S extends SupplySolutionReceipt = SupplySolutionReceipt,
  I extends SupplySolutionSlotOrdinalV4 = SupplySolutionSlotOrdinalV4,
  R extends InferenceReferenceRequirementRowV5 = InferenceReferenceRequirementRowV5,
> = ReceiptRef<
  "receipt:ga-review-conversation-ready-gate@5",
  readonly [S, I, R, D]
> & {
  readonly [gaReviewConversationReadyGateBrandV5]: never;
  readonly solution: S;
  readonly slotOrdinal: I;
  readonly slotId: SupplySolutionSlotIdForOrdinalV4<I>;
  readonly slotBinding: SupplySolutionSlotBindingForOrdinalV4<S, I>;
  readonly positiveTerminalEvidence: Extract<
    BrandedGaPositiveJourneyTerminalEvidenceV4,
    {
      readonly terminalKind: "supply_conversation_activation";
      readonly invokedSlot: SupplySolutionSlotIdForOrdinalV4<I>;
    }
  > & {
    readonly binding: SupplySolutionSlotBindingForOrdinalV4<S, I>;
  };
  readonly referenceRequirement: R;
  readonly runGateReport: Extract<
    GaJourneyRunGateReportReceipt,
    { readonly actualSolutionReadiness: "conversation_ready" }
  > & {
    readonly testedDistributionArtifactDigest: D;
  };
  readonly reportAttestation: GaJourneyReportAttestationReceipt & {
    readonly testedDistributionArtifactDigest: D;
  };
  readonly testedDistributionArtifactDigest: D;
  readonly provesRequirementRunSubjectBindingPositiveTerminalSlotSolutionAndDistributionExactEquality: true;
};

declare function commitGaReviewConversationReadyGateV5<
  S extends SupplySolutionReceipt,
  I extends SupplySolutionSlotOrdinalV4,
  R extends InferenceReferenceRequirementRowV5,
  D extends string,
>(input: {
  readonly solution: S;
  readonly slotOrdinal: I;
  readonly slotId: SupplySolutionSlotIdForOrdinalV4<I>;
  readonly slotBinding: SupplySolutionSlotBindingForOrdinalV4<S, I>;
  readonly referenceRequirement: R;
  readonly runGateReport: Extract<
    GaJourneyRunGateReportReceipt,
    { readonly actualSolutionReadiness: "conversation_ready" }
  > & { readonly testedDistributionArtifactDigest: D };
  readonly reportAttestation: GaJourneyReportAttestationReceipt & {
    readonly testedDistributionArtifactDigest: D;
  };
  readonly testedDistributionArtifactDigest: D;
}): DeepFrozenCommittedReceiptV1<GaReviewConversationReadyGateForDistributionV4<D, S, I, R>>;

type GaReviewSuccessfulSlotChatTerminalV4<
  S extends SupplySolutionReceipt,
  I extends SupplySolutionSlotOrdinalV4,
> = Extract<RuntimeRouteSequenceTerminalReceipt, { readonly outcome: "success" }> & {
  readonly runtimeRouteFenceLease: RuntimeRouteFenceLeaseReceipt & {
    readonly operation: "chat";
    readonly invocationEnvelope: RuntimeInvocationEnvelopeReceipt & {
      readonly operation: "chat";
      readonly bindingIdentityDigest: SupplySolutionSlotBindingForOrdinalV4<
        S,
        I
      >["bindingIdentityDigest"];
    };
  };
  readonly invocationEnvelope: RuntimeInvocationEnvelopeReceipt & {
    readonly operation: "chat";
    readonly bindingIdentityDigest: SupplySolutionSlotBindingForOrdinalV4<
      S,
      I
    >["bindingIdentityDigest"];
  };
};

declare const gaReviewSolutionSlotQualificationBrandV4: unique symbol;

type GaReviewSolutionSlotQualificationReceiptV4<
  S extends SupplySolutionReceipt,
  I extends SupplySolutionSlotOrdinalV4,
  R extends InferenceReferenceRequirementRowV5,
  D extends string,
> = ReceiptRef<"receipt:ga-review-solution-slot-qualification@5", readonly [S, I, R, D]> & {
  readonly [gaReviewSolutionSlotQualificationBrandV4]: never;
  readonly solution: S;
  readonly slotOrdinal: I;
  readonly slotId: SupplySolutionSlotIdForOrdinalV4<I>;
  readonly slotBinding: SupplySolutionSlotBindingForOrdinalV4<S, I>;
  readonly referenceRequirement: R;
  readonly activationPointer: ActivationActivePointerCommitReceiptV4<
    InferenceActivationManifest & {
      readonly binding: SupplySolutionSlotBindingForOrdinalV4<S, I>;
    }
  >;
  readonly successfulChatTerminal: GaReviewSuccessfulSlotChatTerminalV4<S, I>;
  readonly onboardingConversationReadyGateReport: GaReviewConversationReadyGateForDistributionV4<
    D,
    S,
    I,
    R
  >;
  readonly testedDistributionArtifactDigest: D;
  readonly provesSolutionTupleMemberActivationBindingRuntimeChatAndJourneyDistributionExact: true;
};

declare function commitGaReviewSolutionSlotQualificationV4<
  S extends SupplySolutionReceipt,
  I extends SupplySolutionSlotOrdinalV4,
  R extends InferenceReferenceRequirementRowV5,
  D extends string,
>(input: {
  readonly solution: S;
  readonly slotOrdinal: I;
  readonly slotId: SupplySolutionSlotIdForOrdinalV4<I>;
  readonly slotBinding: SupplySolutionSlotBindingForOrdinalV4<S, I>;
  readonly referenceRequirement: R;
  readonly activationPointer: ActivationActivePointerCommitReceiptV4<
    InferenceActivationManifest & {
      readonly binding: SupplySolutionSlotBindingForOrdinalV4<S, I>;
    }
  >;
  readonly successfulChatTerminal: GaReviewSuccessfulSlotChatTerminalV4<S, I>;
  readonly onboardingConversationReadyGateReport: GaReviewConversationReadyGateForDistributionV4<
    D,
    S,
    I,
    R
  >;
  readonly testedDistributionArtifactDigest: D;
}): DeepFrozenCommittedReceiptV1<GaReviewSolutionSlotQualificationReceiptV4<S, I, R, D>>;

type ReviewSlotRequirementTupleV5 = readonly [
  InferenceReferenceRequirementRowV5,
  InferenceReferenceRequirementRowV5,
  InferenceReferenceRequirementRowV5,
  InferenceReferenceRequirementRowV5,
];

type GaReviewSolutionSlotQualificationTupleV4<
  S extends SupplySolutionReceipt,
  D extends string,
  R extends ReviewSlotRequirementTupleV5 = ReviewSlotRequirementTupleV5,
> = readonly [
  GaReviewSolutionSlotQualificationReceiptV4<S, 0, R[0], D>,
  GaReviewSolutionSlotQualificationReceiptV4<S, 1, R[1], D>,
  GaReviewSolutionSlotQualificationReceiptV4<S, 2, R[2], D>,
  GaReviewSolutionSlotQualificationReceiptV4<S, 3, R[3], D>,
];

declare const gaReviewSolutionQualificationBrandV4: unique symbol;

type GaReviewSolutionQualificationReceiptV4<
  S extends SupplySolutionReceipt = SupplySolutionReceipt,
  D extends string = string,
  R extends ReviewSlotRequirementTupleV5 = ReviewSlotRequirementTupleV5,
> = ReceiptRef<"receipt:ga-review-solution-qualification@5", readonly [S, R, D]> & {
  readonly [gaReviewSolutionQualificationBrandV4]: never;
  readonly solution: S;
  readonly exactFourSlotBindings: S["slots"];
  readonly slotRequirements: R;
  readonly slotQualifications: GaReviewSolutionSlotQualificationTupleV4<S, D, R>;
  readonly evaluatorIndependenceProof: S["crossSlotEvaluatorIndependenceProof"];
  readonly testedDistributionArtifactDigest: D;
  readonly provesSlotOrderBindingActivationPointerRuntimeChatJourneyGateAndDistributionExact: true;
  readonly provesEvaluatorSlotProofEqualsSolutionCrossSlotIndependenceProofExactly: true;
  readonly provesNoSingleRequirementRowCanSelfClaimReviewReady: true;
};

declare function commitGaReviewSolutionQualificationV4<
  S extends SupplySolutionReceipt,
  D extends string,
  const R extends ReviewSlotRequirementTupleV5,
>(input: {
  readonly solution: S;
  readonly exactFourSlotBindings: S["slots"];
  readonly slotRequirements: R;
  readonly slotQualifications: GaReviewSolutionSlotQualificationTupleV4<S, D, R>;
  readonly evaluatorIndependenceProof: S["crossSlotEvaluatorIndependenceProof"];
  readonly testedDistributionArtifactDigest: D;
}): DeepFrozenCommittedReceiptV1<GaReviewSolutionQualificationReceiptV4<S, D, R>>;

declare const reviewReadySupplySolutionBrandV5: unique symbol;

type ReviewReadySupplySolutionReceiptV5<
  S extends SupplySolutionReceipt = SupplySolutionReceipt,
  D extends string = string,
  R extends ReviewSlotRequirementTupleV5 = ReviewSlotRequirementTupleV5,
> = ReceiptRef<"receipt:review-ready-supply-solution@5", readonly [S, R, D]> & {
  readonly [reviewReadySupplySolutionBrandV5]: never;
  readonly baseSolution: S;
  readonly qualification: GaReviewSolutionQualificationReceiptV4<S, D, R>;
  readonly readiness: "review_ready";
  readonly testedDistributionArtifactDigest: D;
  readonly provesReviewReadyWasDerivedOnlyFromExactFourSlotQualifications: true;
};

declare function commitReviewReadySupplySolutionV5<
  S extends SupplySolutionReceipt,
  D extends string,
  const R extends ReviewSlotRequirementTupleV5,
>(input: {
  readonly baseSolution: S;
  readonly qualification: GaReviewSolutionQualificationReceiptV4<S, D, R>;
  readonly testedDistributionArtifactDigest: D;
}): DeepFrozenCommittedReceiptV1<ReviewReadySupplySolutionReceiptV5<S, D, R>>;

declare const gaRuntimeRecoveryUxGateBrandV5: unique symbol;

type GaRuntimeRecoveryUxGateReceiptV4<
  R extends ReferenceRequirementRowV3 = ReferenceRequirementRowV3,
  S extends ReferenceRuntimeRecoveryStateForV5<R> = ReferenceRuntimeRecoveryStateForV5<R>,
  D extends string = string,
> = ReceiptRef<"receipt:ga-runtime-recovery-ux-gate@5", readonly [R, S, D]> & {
  readonly [gaRuntimeRecoveryUxGateBrandV5]: never;
  readonly referenceRequirement: R;
  readonly recoverySubject: Extract<GaReferenceRuntimeRecoveryRunSubjectV4<R>, { readonly runtimeState: S }>;
  readonly testedDistributionArtifactDigest: D;
  readonly orderedTypedActionEvents: NonEmptyReadonly<GaUxActionEventV3>;
  readonly actualMetrics: GaUxActualMetricsV2;
  readonly signedRecoveryUxContract: ReferenceRuntimeRecoveryScenarioV5<R, S>["recoveryUxContract"];
  readonly primaryActionComparison: "within_limit";
  readonly externalTaskComparison: "within_limit";
  readonly manualFieldComparison: "within_limit";
  readonly leaveAndReturnComparison: "within_limit";
  readonly recoveryLoopComparison: "within_limit";
  readonly appElapsedComparison: "within_limit";
  readonly rawElapsedComparison: "within_limit";
  readonly provesEveryMetricIsDerivedFromTheCompleteEventLogAndComparedExactlyOnce: true;
};

declare const gaRuntimeRecoveryJourneyEvidenceBrandV5: unique symbol;

type GaRuntimeRecoveryJourneyEvidenceV4<
  R extends ReferenceRequirementRowV3 = ReferenceRequirementRowV3,
  S extends ReferenceRuntimeRecoveryStateForV5<R> = ReferenceRuntimeRecoveryStateForV5<R>,
  D extends string = string,
> = ReceiptRef<"receipt:ga-runtime-recovery-journey-evidence@5", readonly [R, S, D]> & {
  readonly [gaRuntimeRecoveryJourneyEvidenceBrandV5]: never;
  readonly referenceRequirement: R;
  readonly recoverySubject: Extract<GaReferenceRuntimeRecoveryRunSubjectV4<R>, { readonly runtimeState: S }>;
  readonly recoveryScenario: ReferenceRuntimeRecoveryScenarioV5<R, S>;
  readonly testedDistributionArtifactDigest: D;
  readonly exactRecoverySubjectDigest: string;
  readonly preconditionStateAssertion: ReferenceRuntimeStateAssertionReceiptV4<
    R,
    S,
    (typeof REFERENCE_RUNTIME_STATE_ASSERTION_MODE_V4)[S]
  >;
  readonly initialConnectionReadiness: "action_required";
  readonly zeroConfigPassReceiptBeforeRecoveryTerminal?: never;
  readonly exactVisitedRecoveryStepOrdinals: NonEmptyReadonly<number>;
  readonly exactRecoveryGraphTerminalReceipt: ReceiptRef;
  readonly runtimeRecoveryUxGate: GaRuntimeRecoveryUxGateReceiptV4<R, S, D>;
  readonly resultingPositiveJourneyReport: Extract<
    GaJourneyRunReportReceipt,
    { readonly reportOutcome: "completed_pass" }
  >;
  readonly resultingPositiveTerminalEvidence: BrandedGaPositiveJourneyTerminalEvidenceV4;
  readonly provesStateScenarioFirstStepGraphPathTerminalPostGraphChainAndPositiveRunExact: true;
};

declare function commitGaRuntimeRecoveryJourneyEvidenceV5<
  R extends ReferenceRequirementRowV3,
  S extends ReferenceRuntimeRecoveryStateForV5<R>,
  D extends string,
>(input: {
  readonly referenceRequirement: R;
  readonly recoverySubject: Extract<GaReferenceRuntimeRecoveryRunSubjectV4<R>, { readonly runtimeState: S }>;
  readonly recoveryScenario: ReferenceRuntimeRecoveryScenarioV5<R, S>;
  readonly testedDistributionArtifactDigest: D;
  readonly preconditionStateAssertion: ReferenceRuntimeStateAssertionReceiptV4<
    R,
    S,
    (typeof REFERENCE_RUNTIME_STATE_ASSERTION_MODE_V4)[S]
  >;
  readonly exactRecoveryGraphTerminalReceipt: ReceiptRef;
  readonly runtimeRecoveryUxGate: GaRuntimeRecoveryUxGateReceiptV4<R, S, D>;
  readonly resultingPositiveJourneyReport: Extract<
    GaJourneyRunReportReceipt,
    { readonly reportOutcome: "completed_pass" }
  >;
  readonly resultingPositiveTerminalEvidence: BrandedGaPositiveJourneyTerminalEvidenceV4;
}): GaRuntimeRecoveryJourneyEvidenceV4<R, S, D>;

interface GaJourneyRunPayloadBaseV2 {
  readonly schemaVersion: "saydo.dev/ga-journey-run/v2";
  readonly subject: GaJourneyRunSubjectV2;
  readonly runSubjectDigest: string;
  readonly gaMatrixCoreDigest: string;
  readonly gaMandatoryBaselineDigest: string;
  readonly referenceGradeProfileDigest: string;
  readonly journeyDefinition: GaJourneyDefinitionV2;
  readonly journeyDefinitionDigest: string;
  readonly provesJourneyDefinitionDigestAndRunSubjectExact: true;
  readonly runnerProfileDigest: string;
  readonly runnerArtifactDigest: string;
  readonly runnerInvocationDigest: string;
  readonly invokedPublicEntryPointDigest: string;
  readonly builderIdentityDigest: string;
  readonly environmentClass: string;
  readonly environmentDigest: string;
  readonly deterministicSeed: string;
  readonly executionMode: "deterministic_fixture";
  readonly deterministicExecution: GaDeterministicJourneyExecutionReceiptV5;
  readonly expectedFixtureSetDigest: string;
  readonly completedFixtureSetDigest: string;
  readonly fixtureResultInventoryDigest: string;
  readonly rawEvidenceArtifactSetDigest: string;
  readonly rawEvidenceMerkleRootDigest: string;
  readonly actionEventLogDigest: string;
  readonly unifiedTypedActionEventInventoryDigest: string;
  readonly anchorPrerequisiteClosure: GaAnchorPrerequisiteClosureReceipt;
  readonly actionInventoryComposition: GaJourneyActionInventoryCompositionReceipt;
  readonly runtimeStateAssertionEvidenceSet: ReferenceRuntimeStateAssertionEvidenceSetReceiptV4;
  readonly referenceUxLimits: GaReferenceUxLimitV2;
  readonly referenceUxClassLimits: GaReferenceUxClassLimitV3;
  readonly actualUxMetrics: GaUxActualMetricsV2;
  readonly provesPrerequisiteAndMainJourneyEventsShareOneCompleteInventoryWithoutDoubleCounting: true;
  readonly provesStartingAnchorStateDefinitionRunSubjectPrerequisiteClosureAndAutoResumeExact: true;
  readonly provesStartingAccountStateIsRequiredByDefinitionAndJourneyGraphPathWasExecutedToTerminal: true;
  readonly provesRuntimeStateAssertionRequirementRunSubjectPlanAndExactEvidenceSetEqualPayload: true;
  readonly provesDeterministicExecutionRunSubjectEqualsPayloadAndUsesNoExternalAccountInternetOrProviderSideEffect: true;
  readonly stdoutSummaryDigest: string;
  readonly stderrSummaryDigest: string;
  readonly exitCode: number;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly outcome: "completed_pass" | "completed_fail" | "incomplete";
}

type GaJourneyRunPayloadV2 = {
  [A in "not_enrolled" | "ready"]:
    | (GaJourneyRunPayloadBaseV2 & {
        readonly subject: GaJourneyRunSubjectV2 & { readonly startingAnchorState: A };
        readonly journeyDefinition: Exclude<
          Extract<GaJourneyDefinitionV2, { readonly journeyClass: "supply" }>,
          { readonly journeyTier: "migration_only" }
        >;
        readonly anchorPrerequisiteClosure: A extends "ready"
          ? Extract<
              GaAnchorPrerequisiteClosureReceipt,
              { readonly startingAnchorState: "ready"; readonly prerequisiteMode: "already_ready" }
            >
          : Extract<
              GaAnchorPrerequisiteClosureReceipt,
              { readonly startingAnchorState: "not_enrolled"; readonly prerequisiteMode: "fresh_enrollment_composed" }
            >;
        readonly actionInventoryComposition: Extract<
          GaJourneyActionInventoryCompositionReceipt,
          { readonly journeyClass: "supply"; readonly startingAnchorState: A }
        >;
        readonly finalConnectionReadiness: ConnectionReadiness;
        readonly finalSolutionReadiness: SolutionReadiness;
        readonly finalExecutionReadiness?: never;
        readonly finalControlReadiness?: never;
      })
    | (GaJourneyRunPayloadBaseV2 & {
        readonly subject: GaJourneyRunSubjectV2 & { readonly startingAnchorState: A };
        readonly journeyDefinition: Extract<
          GaJourneyDefinitionV2,
          { readonly journeyClass: "supply"; readonly journeyTier: "migration_only" }
        >;
        readonly anchorPrerequisiteClosure: A extends "ready"
          ? Extract<
              GaAnchorPrerequisiteClosureReceipt,
              { readonly startingAnchorState: "ready"; readonly prerequisiteMode: "already_ready" }
            >
          : Extract<
              GaAnchorPrerequisiteClosureReceipt,
              { readonly startingAnchorState: "not_enrolled"; readonly prerequisiteMode: "fresh_enrollment_composed" }
            >;
        readonly actionInventoryComposition: Extract<
          GaJourneyActionInventoryCompositionReceipt,
          { readonly journeyClass: "supply"; readonly startingAnchorState: A }
        >;
        readonly finalConnectionReadiness?: never;
        readonly finalSolutionReadiness?: never;
        readonly finalExecutionReadiness?: never;
        readonly finalControlReadiness?: never;
        readonly finalMigrationReadiness: "migration_disposition_committed";
      })
    | (GaJourneyRunPayloadBaseV2 & {
        readonly subject: GaJourneyRunSubjectV2 & { readonly startingAnchorState: A };
        readonly journeyDefinition: Extract<GaJourneyDefinitionV2, { readonly journeyClass: "execution" }>;
        readonly anchorPrerequisiteClosure: A extends "ready"
          ? Extract<
              GaAnchorPrerequisiteClosureReceipt,
              { readonly startingAnchorState: "ready"; readonly prerequisiteMode: "already_ready" }
            >
          : Extract<
              GaAnchorPrerequisiteClosureReceipt,
              { readonly startingAnchorState: "not_enrolled"; readonly prerequisiteMode: "fresh_enrollment_composed" }
            >;
        readonly actionInventoryComposition: Extract<
          GaJourneyActionInventoryCompositionReceipt,
          { readonly journeyClass: "execution"; readonly startingAnchorState: A }
        >;
        readonly finalConnectionReadiness: ConnectionReadiness;
        readonly finalSolutionReadiness?: never;
        readonly finalExecutionReadiness: "execution_ready" | "action_required" | "blocked";
        readonly finalControlReadiness?: never;
      })
    | (GaJourneyRunPayloadBaseV2 & {
        readonly subject: GaJourneyRunSubjectV2 & { readonly startingAnchorState: A };
        readonly journeyDefinition: Extract<GaJourneyDefinitionV2, { readonly journeyClass: "control_plane" }>;
        readonly anchorPrerequisiteClosure: Extract<
          GaAnchorPrerequisiteClosureReceipt,
          { readonly prerequisiteMode: "journey_is_anchor_control" }
        > & { readonly startingAnchorState: A };
        readonly actionInventoryComposition: Extract<
          GaJourneyActionInventoryCompositionReceipt,
          { readonly journeyClass: "control_plane" }
        > & { readonly startingAnchorState: A };
        readonly finalConnectionReadiness?: never;
        readonly finalSolutionReadiness?: never;
        readonly finalExecutionReadiness?: never;
        readonly finalControlReadiness: "control_ready" | "action_required" | "blocked";
      });
}["not_enrolled" | "ready"];

type GaSupplyJourneyTierV2 = GaSupplyJourneyUxBindingV2["journeyTier"];

type GaSupplyReferenceUxLimitForTierV2<T extends GaSupplyJourneyTierV2> = T extends "zero_config"
  ? Extract<GaReferenceUxLimitV2, { readonly limitClass: "zero_config_or_local_ready" }>
  : T extends "guided_key"
    ? Extract<GaReferenceUxLimitV2, { readonly limitClass: "guided_key" }>
    : T extends "guided_oauth"
      ? Extract<GaReferenceUxLimitV2, { readonly limitClass: "guided_oauth_or_subscription" }>
      : T extends "enterprise_managed"
        ? Extract<GaReferenceUxLimitV2, { readonly limitClass: "enterprise_cloud_or_execution" }>
        : T extends "migration_only"
          ? Extract<GaReferenceUxLimitV2, { readonly limitClass: "zero_config_or_local_ready" }>
          : Extract<GaReferenceUxLimitV2, { readonly limitClass: "custom_endpoint" }>;

type GaSupplyReferenceUxClassLimitForTierV3<T extends GaSupplyJourneyTierV2> = T extends "zero_config"
  ? Extract<GaReferenceUxClassLimitV3, { readonly limitClass: "zero_config_or_local_ready" }>
  : T extends "guided_key"
    ? Extract<GaReferenceUxClassLimitV3, { readonly limitClass: "guided_key" }>
    : T extends "guided_oauth"
      ? Extract<GaReferenceUxClassLimitV3, { readonly limitClass: "guided_oauth_or_subscription" }>
      : T extends "enterprise_managed"
        ? Extract<GaReferenceUxClassLimitV3, { readonly limitClass: "enterprise_cloud_or_execution" }>
        : T extends "migration_only"
          ? Extract<GaReferenceUxClassLimitV3, { readonly limitClass: "zero_config_or_local_ready" }>
          : Extract<GaReferenceUxClassLimitV3, { readonly limitClass: "custom_endpoint" }>;

type GaExecutionJourneyTierV3 = GaExecutionJourneyUxBindingV3["journeyTier"];
type GaExecutionReferenceUxLimitForTierV3<T extends GaExecutionJourneyTierV3> = T extends "zero_config"
  ? Extract<GaReferenceUxLimitV2, { readonly limitClass: "zero_config_or_local_ready" }>
  : T extends "guided_key"
    ? Extract<GaReferenceUxLimitV2, { readonly limitClass: "guided_key" }>
    : T extends "guided_oauth"
      ? Extract<GaReferenceUxLimitV2, { readonly limitClass: "guided_oauth_or_subscription" }>
      : Extract<GaReferenceUxLimitV2, { readonly limitClass: "enterprise_cloud_or_execution" }>;

type GaExecutionReferenceUxClassLimitForTierV3<T extends GaExecutionJourneyTierV3> =
  T extends "zero_config"
    ? Extract<GaReferenceUxClassLimitV3, { readonly limitClass: "zero_config_or_local_ready" }>
    : T extends "guided_key"
      ? Extract<GaReferenceUxClassLimitV3, { readonly limitClass: "guided_key" }>
      : T extends "guided_oauth"
        ? Extract<GaReferenceUxClassLimitV3, { readonly limitClass: "guided_oauth_or_subscription" }>
        : Extract<GaReferenceUxClassLimitV3, { readonly limitClass: "enterprise_cloud_or_execution" }>;

interface GaJourneyPassEvidenceClosureV4 {
  readonly metricReducer: Extract<GaUxMetricReducerReceiptV4, { readonly foldOutcome: "success" }>;
  readonly perClassUxGate: GaUxPerClassGateReceipt;
  readonly uiQualification: GaUiQualificationPassReceiptV4;
  readonly provesActualMetricsEqualReducerOutputAndAllSignedScalarAndClassLimitsPass: true;
  readonly provesUiQualificationDistributionAndRunSubjectEqualPayload: true;
}

type GaJourneyPassPayloadV2 = (
  | ({
      [T in Exclude<GaSupplyJourneyTierV2, "migration_only">]: {
        [S in "conversation_ready"]: GaJourneyRunPayloadV2 & {
          readonly journeyDefinition: Extract<
            GaJourneyDefinitionV2,
            { readonly journeyClass: "supply"; readonly journeyTier: T }
          > & {
            readonly expectedConnectionReadiness: "connected_verified";
            readonly expectedSolutionReadiness: S;
          };
          readonly referenceUxLimits: GaSupplyReferenceUxLimitForTierV2<T>;
          readonly referenceUxClassLimits: GaSupplyReferenceUxClassLimitForTierV3<T>;
          readonly expectedConnectionReadiness: "connected_verified";
          readonly finalConnectionReadiness: "connected_verified";
          readonly expectedSolutionReadiness: S;
          readonly finalSolutionReadiness: S;
          readonly expectedExecutionReadiness?: never;
          readonly finalExecutionReadiness?: never;
          readonly expectedControlReadiness?: never;
          readonly finalControlReadiness?: never;
          readonly positiveTerminalEvidence: Extract<
            BrandedGaPositiveJourneyTerminalEvidenceV4,
            { readonly terminalKind: "supply_conversation_activation" }
          >;
          readonly outcome: "completed_pass";
          readonly exitCode: 0;
          readonly expectedAndCompletedFixtureSetsEqual: true;
          readonly everyFixturePassed: true;
          readonly rawEvidenceComplete: true;
          readonly provesExpectedReadinessEqualsJourneyDefinitionAndFinalReadinessExactly: true;
          readonly provesReferenceUxLimitsEqualJourneyDefinitionAndSignedProfileLimitExactly: true;
        };
      }["conversation_ready"];
    }[Exclude<GaSupplyJourneyTierV2, "migration_only">])
  | (GaJourneyRunPayloadV2 & {
      readonly journeyDefinition: Extract<
        GaJourneyDefinitionV2,
        { readonly journeyClass: "supply"; readonly journeyTier: "migration_only" }
      > & { readonly expectedMigrationReadiness: "migration_disposition_committed" };
      readonly referenceUxLimits: GaSupplyReferenceUxLimitForTierV2<"migration_only">;
      readonly referenceUxClassLimits: GaSupplyReferenceUxClassLimitForTierV3<"migration_only">;
      readonly expectedConnectionReadiness?: never;
      readonly finalConnectionReadiness?: never;
      readonly expectedSolutionReadiness?: never;
      readonly finalSolutionReadiness?: never;
      readonly expectedExecutionReadiness?: never;
      readonly finalExecutionReadiness?: never;
      readonly expectedControlReadiness?: never;
      readonly finalControlReadiness?: never;
      readonly expectedMigrationReadiness: "migration_disposition_committed";
      readonly finalMigrationReadiness: "migration_disposition_committed";
      readonly positiveTerminalEvidence: Extract<
        BrandedGaPositiveJourneyTerminalEvidenceV4,
        { readonly terminalKind: "existing_connection_migration_disposition" }
      >;
      readonly outcome: "completed_pass";
      readonly exitCode: 0;
      readonly expectedAndCompletedFixtureSetsEqual: true;
      readonly everyFixturePassed: true;
      readonly rawEvidenceComplete: true;
      readonly provesExpectedReadinessEqualsJourneyDefinitionAndFinalReadinessExactly: true;
      readonly provesReferenceUxLimitsEqualJourneyDefinitionAndSignedProfileLimitExactly: true;
    })
  | ({
      [T in GaExecutionJourneyTierV3]: GaJourneyRunPayloadV2 & {
        readonly journeyDefinition: Extract<
          GaJourneyDefinitionV2,
          { readonly journeyClass: "execution"; readonly journeyTier: T }
        >;
        readonly referenceUxLimits: GaExecutionReferenceUxLimitForTierV3<T>;
        readonly referenceUxClassLimits: GaExecutionReferenceUxClassLimitForTierV3<T>;
        readonly expectedConnectionReadiness: "connected_verified";
        readonly finalConnectionReadiness: "connected_verified";
        readonly expectedSolutionReadiness?: never;
        readonly finalSolutionReadiness?: never;
        readonly expectedExecutionReadiness: "execution_ready";
        readonly finalExecutionReadiness: "execution_ready";
        readonly expectedControlReadiness?: never;
        readonly finalControlReadiness?: never;
        readonly positiveTerminalEvidence: Extract<
          BrandedGaPositiveJourneyTerminalEvidenceV4,
          { readonly terminalKind: "execution_session_and_turn_activation" }
        >;
        readonly outcome: "completed_pass";
        readonly exitCode: 0;
        readonly expectedAndCompletedFixtureSetsEqual: true;
        readonly everyFixturePassed: true;
        readonly rawEvidenceComplete: true;
        readonly provesExpectedReadinessEqualsJourneyDefinitionAndFinalReadinessExactly: true;
        readonly provesReferenceUxLimitsEqualJourneyDefinitionAndSignedProfileLimitExactly: true;
      };
    }[GaExecutionJourneyTierV3])
  | (GaJourneyRunPayloadV2 & {
      readonly journeyDefinition: Extract<GaJourneyDefinitionV2, { readonly journeyClass: "control_plane" }>;
      readonly referenceUxLimits: Extract<GaReferenceUxLimitV2, { readonly limitClass: "anchor_control" }>;
      readonly referenceUxClassLimits: Extract<GaReferenceUxClassLimitV3, { readonly limitClass: "anchor_control" }>;
      readonly expectedConnectionReadiness?: never;
      readonly finalConnectionReadiness?: never;
      readonly expectedSolutionReadiness?: never;
      readonly finalSolutionReadiness?: never;
      readonly expectedExecutionReadiness?: never;
      readonly finalExecutionReadiness?: never;
      readonly expectedControlReadiness: "control_ready";
      readonly finalControlReadiness: "control_ready";
      readonly positiveTerminalEvidence: Extract<
        BrandedGaPositiveJourneyTerminalEvidenceV4,
        { readonly terminalKind: "anchor_control_ready" }
      >;
      readonly outcome: "completed_pass";
      readonly exitCode: 0;
      readonly expectedAndCompletedFixtureSetsEqual: true;
      readonly everyFixturePassed: true;
      readonly rawEvidenceComplete: true;
      readonly provesExpectedReadinessEqualsJourneyDefinitionAndFinalReadinessExactly: true;
      readonly provesReferenceUxLimitsEqualJourneyDefinitionAndSignedProfileLimitExactly: true;
    })
) & GaJourneyPassEvidenceClosureV4;

type GaJourneyFailPayloadV2 = GaJourneyRunPayloadV2 & {
  readonly outcome: "completed_fail";
  readonly metricReducer: Extract<GaUxMetricReducerReceiptV4, { readonly foldOutcome: "failed" }>;
  readonly perClassUxGate?: never;
  readonly positiveTerminalEvidence?: never;
  readonly uiQualification?: never;
  readonly releaseGateEligible: false;
};

type GaJourneyIncompletePayloadV2 = GaJourneyRunPayloadV2 & {
  readonly outcome: "incomplete";
  readonly metricReductionRejection: GaUxMetricReductionRejectionReceiptV4;
  readonly metricReducer?: never;
  readonly perClassUxGate?: never;
  readonly positiveTerminalEvidence?: never;
  readonly uiQualification?: never;
  readonly releaseGateEligible: false;
};

type GaJourneyRunReportReceipt = ReceiptRef &
  (
    | {
        readonly reportOutcome: "completed_pass";
        readonly payload: GaJourneyPassPayloadV2;
        readonly payloadDigest: string;
      }
    | {
        readonly reportOutcome: "completed_fail";
        readonly payload: GaJourneyFailPayloadV2;
        readonly payloadDigest: string;
        readonly releaseGateEligible: false;
      }
    | {
        readonly reportOutcome: "incomplete";
        readonly payload: GaJourneyIncompletePayloadV2;
        readonly payloadDigest: string;
        readonly releaseGateEligible: false;
      }
  );

interface GaJourneyReportAttestationReceipt extends ReceiptRef {
  readonly report: Extract<GaJourneyRunReportReceipt, { readonly reportOutcome: "completed_pass" }>;
  readonly payloadDigest: string;
  readonly runSubjectDigest: string;
  readonly referenceLimitsActualMetricsAndUnifiedEventInventoryDigest: string;
  readonly verifierPolicy: TufTargetAuthorizationReceipt;
  readonly oidcIssuerDigest: string;
  readonly sourceRepositoryDigest: string;
  readonly workflowPathDigest: string;
  readonly protectedRefOrTagDigest: string;
  readonly builderIdentityDigest: string;
  readonly runnerArtifactDigest: string;
  readonly testedDistributionArtifactDigest: string;
  readonly slsaProvenanceDigest: string;
  readonly provenanceSubjectDigest: string;
  readonly dsseSubjectDigest: string;
  readonly sigstoreBundleDigest: string;
  readonly transparencyCheckpointDigest: string;
  readonly provesAllSubjectsEqualPayloadDigestAndCurrentDistribution: true;
  readonly provesRunSubjectReferenceLimitsPrerequisiteClosureUnifiedEventsAndTypedUxMetricsEqualPayload: true;
}

interface GaJourneyRunGateReportBase extends ReceiptRef {
  readonly reportAttestation: GaJourneyReportAttestationReceipt;
  readonly exactRunSubjectDigest: string;
  readonly expectedFixtureSetDigest: string;
  readonly completedFixtureSetDigest: string;
  readonly readinessComparisonAlgorithm: "exact-definition-to-pass-payload-v1";
  readonly testedDistributionArtifactDigest: string;
  readonly verifierPolicyDigest: string;
  readonly computedOutcome: "completed_pass";
  readonly provesDefinitionSubjectRunSubjectRunnerFixturesExitAndEvidenceExact: true;
  readonly provesPositiveJourneyClassAndExpectedActualReadinessExact: true;
  readonly provesReferenceUxLimitsAndFreshOrReadyAnchorPrerequisiteCompositionExact: true;
  readonly provesScalarAndEveryExternalTaskAndManualFieldClassLimitAgainstSignedProfile: true;
  readonly provesActionInventoryCompositionReceiptEventsMetricsAndElapsedTimeExact: true;
}

type GaJourneyRunGateReportReceipt =
  | ({
      [T in Exclude<GaSupplyJourneyTierV2, "migration_only">]: {
        [S in "conversation_ready"]: GaJourneyRunGateReportBase & {
          readonly journeyDefinition: Extract<
            GaJourneyDefinitionV2,
            { readonly journeyClass: "supply"; readonly journeyTier: T }
          > & {
            readonly expectedConnectionReadiness: "connected_verified";
            readonly expectedSolutionReadiness: S;
          };
          readonly report: Extract<GaJourneyRunReportReceipt, { readonly reportOutcome: "completed_pass" }> & {
            readonly payload: Extract<
              GaJourneyPassPayloadV2,
              {
                readonly referenceUxLimits: GaSupplyReferenceUxLimitForTierV2<T>;
                readonly referenceUxClassLimits: GaSupplyReferenceUxClassLimitForTierV3<T>;
                readonly expectedConnectionReadiness: "connected_verified";
                readonly expectedSolutionReadiness: S;
              }
            >;
          };
          readonly referenceUxLimits: GaSupplyReferenceUxLimitForTierV2<T>;
          readonly referenceUxClassLimits: GaSupplyReferenceUxClassLimitForTierV3<T>;
          readonly expectedConnectionReadiness: "connected_verified";
          readonly actualConnectionReadiness: "connected_verified";
          readonly expectedSolutionReadiness: S;
          readonly actualSolutionReadiness: S;
          readonly expectedExecutionReadiness?: never;
          readonly actualExecutionReadiness?: never;
          readonly expectedControlReadiness?: never;
          readonly actualControlReadiness?: never;
        };
      }["conversation_ready"];
    }[Exclude<GaSupplyJourneyTierV2, "migration_only">])
  | (GaJourneyRunGateReportBase & {
      readonly journeyDefinition: Extract<
        GaJourneyDefinitionV2,
        { readonly journeyClass: "supply"; readonly journeyTier: "migration_only" }
      > & { readonly expectedMigrationReadiness: "migration_disposition_committed" };
      readonly report: Extract<GaJourneyRunReportReceipt, { readonly reportOutcome: "completed_pass" }> & {
        readonly payload: Extract<
          GaJourneyPassPayloadV2,
          { readonly expectedMigrationReadiness: "migration_disposition_committed" }
        >;
      };
      readonly referenceUxLimits: GaSupplyReferenceUxLimitForTierV2<"migration_only">;
      readonly referenceUxClassLimits: GaSupplyReferenceUxClassLimitForTierV3<"migration_only">;
      readonly expectedConnectionReadiness?: never;
      readonly actualConnectionReadiness?: never;
      readonly expectedSolutionReadiness?: never;
      readonly actualSolutionReadiness?: never;
      readonly expectedExecutionReadiness?: never;
      readonly actualExecutionReadiness?: never;
      readonly expectedControlReadiness?: never;
      readonly actualControlReadiness?: never;
      readonly expectedMigrationReadiness: "migration_disposition_committed";
      readonly actualMigrationReadiness: "migration_disposition_committed";
    })
  | ({
      [T in GaExecutionJourneyTierV3]: GaJourneyRunGateReportBase & {
        readonly journeyDefinition: Extract<
          GaJourneyDefinitionV2,
          { readonly journeyClass: "execution"; readonly journeyTier: T }
        >;
        readonly report: Extract<GaJourneyRunReportReceipt, { readonly reportOutcome: "completed_pass" }> & {
          readonly payload: Extract<
            GaJourneyPassPayloadV2,
            { readonly expectedExecutionReadiness: "execution_ready"; readonly referenceUxLimits: GaExecutionReferenceUxLimitForTierV3<T> }
          >;
        };
        readonly referenceUxLimits: GaExecutionReferenceUxLimitForTierV3<T>;
        readonly referenceUxClassLimits: GaExecutionReferenceUxClassLimitForTierV3<T>;
        readonly expectedConnectionReadiness: "connected_verified";
        readonly actualConnectionReadiness: "connected_verified";
        readonly expectedSolutionReadiness?: never;
        readonly actualSolutionReadiness?: never;
        readonly expectedExecutionReadiness: "execution_ready";
        readonly actualExecutionReadiness: "execution_ready";
        readonly expectedControlReadiness?: never;
        readonly actualControlReadiness?: never;
      };
    }[GaExecutionJourneyTierV3])
  | (GaJourneyRunGateReportBase & {
      readonly journeyDefinition: Extract<GaJourneyDefinitionV2, { readonly journeyClass: "control_plane" }>;
      readonly report: Extract<GaJourneyRunReportReceipt, { readonly reportOutcome: "completed_pass" }> & {
        readonly payload: Extract<GaJourneyPassPayloadV2, { readonly expectedControlReadiness: "control_ready" }>;
      };
      readonly referenceUxLimits: Extract<GaReferenceUxLimitV2, { readonly limitClass: "anchor_control" }>;
      readonly referenceUxClassLimits: Extract<GaReferenceUxClassLimitV3, { readonly limitClass: "anchor_control" }>;
      readonly expectedConnectionReadiness?: never;
      readonly actualConnectionReadiness?: never;
      readonly expectedSolutionReadiness?: never;
      readonly actualSolutionReadiness?: never;
      readonly expectedExecutionReadiness?: never;
      readonly actualExecutionReadiness?: never;
      readonly expectedControlReadiness: "control_ready";
      readonly actualControlReadiness: "control_ready";
    });

interface GaJourneyRunGateAttestationReceipt extends ReceiptRef {
  readonly gateReport: GaJourneyRunGateReportReceipt;
  readonly gateReportDigest: string;
  readonly verifierPolicy: TufTargetAuthorizationReceipt;
  readonly issuerRepositoryWorkflowBuilderAndDistributionDigest: string;
  readonly dsseSubjectDigest: string;
  readonly provenanceSubjectDigest: string;
  readonly sigstoreBundleDigest: string;
  readonly provesSubjectsEqualGateReportDigest: true;
}

type ReferenceConformanceCoreForRowV4<R extends ReferenceRequirementRowV3> =
  R["surfaceKind"] extends "execution"
    ? Extract<
        ConformanceResultCore,
        { readonly reportKind: "execution"; readonly protocolId: R["protocolProfile"] }
      > & { readonly providerProductId: R["productId"] }
    : R["surfaceKind"] extends "bridge"
      ? R["protocolProfile"] extends InferenceProtocolId
        ? ConformanceResultCoreBase &
          BrandedInferenceBridgeConformanceResultCore<R["protocolProfile"]> & {
            readonly providerProductId: R["productId"];
          }
        : R["protocolProfile"] extends BridgeControlProtocolId
          ? ConformanceResultCoreBase &
            BrandedControlBridgeConformanceResultCore<R["protocolProfile"]> & {
              readonly providerProductId: R["productId"];
            }
          : never
    : R["surfaceKind"] extends "control_plane"
      ? Extract<ConformanceResultCore, { readonly reportKind: "discovery" }> & {
          readonly providerProductId: R["productId"];
        }
      : Extract<
          ConformanceResultCore,
          { readonly reportKind: "capability"; readonly protocolId: R["protocolProfile"] }
        > & { readonly providerProductId: R["productId"] };

declare const gaRequirementConformanceSemanticBindingBrandV4: unique symbol;

interface GaRequirementConformanceSemanticBindingReceiptV4<
  R extends ReferenceRequirementRowV3,
  C extends ReferenceConformanceCoreForRowV4<R>,
> extends ReceiptRef<"receipt:ga-requirement-conformance-semantic-binding@4", readonly [R, C]> {
  readonly [gaRequirementConformanceSemanticBindingBrandV4]: never;
  readonly referenceRequirement: R;
  readonly conformanceCore: C;
  readonly requirementKey: R["requirementKey"];
  readonly entryKey: R["entryKey"];
  readonly productId: R["productId"];
  readonly surfaceKind: R["surfaceKind"];
  readonly protocolProfile: R["protocolProfile"];
  readonly authKind: R["authKind"];
  readonly realmClass: R["realmClass"];
  readonly onboardingRecipeDigest: string;
  readonly exactDetailedReferenceBindingReceiptId: string;
  readonly exactDetailedReferenceBindingDigest: string;
  readonly provesRunSubjectIndexReceiptIdAndDigestEqualTheSeparateDetailedBinding: true;
  readonly provesRequirementRowRunSubjectCoreSemanticSubjectAndProtocolOrSurfaceExact: true;
}

declare function commitGaRequirementConformanceSemanticBindingV4<
  R extends ReferenceRequirementRowV3,
  C extends ReferenceConformanceCoreForRowV4<R>,
>(input: {
  readonly referenceRequirement: R;
  readonly runSubject: GaJourneyRunSubjectV2 & {
    readonly referenceRequirement: R;
    readonly requirementKey: R["requirementKey"];
    readonly exactReferenceBinding: CommittedGaExactReferenceRunSubjectBindingIndexForRowV10<R>;
  };
  readonly exactDetailedReferenceBinding: GaExactReferenceRunSubjectBindingReceiptV4<NoInfer<R>>;
  readonly conformanceCore: C;
  readonly onboardingRecipeDigest: string;
}): GaRequirementConformanceSemanticBindingReceiptV4<R, C>;

declare const gaJourneyRunReleaseConformanceBindingBrandV9: unique symbol;

interface GaJourneyRunReleaseConformanceBindingForRowReceipt<
  R extends ReferenceRequirementRowV3 = ReferenceRequirementRowV3,
> extends ReceiptRef<"receipt:ga-journey-run-release-conformance-binding@9", R["requirementKey"]> {
  readonly [gaJourneyRunReleaseConformanceBindingBrandV9]: never;
  readonly referenceRequirement: R;
  readonly requirementKey: R["requirementKey"];
  readonly entryKey: R["entryKey"];
  readonly productId: R["productId"];
  readonly surfaceKind: R["surfaceKind"];
  readonly protocolProfile: R["protocolProfile"];
  readonly authKind: R["authKind"];
  readonly realmClass: R["realmClass"];
  readonly runSubjectDigest: string;
  readonly conformanceCoreDigest: string;
  readonly report: ReceiptRef;
  readonly reportAttestation: ReceiptRef;
  readonly semanticBinding: ReceiptRef<
    "receipt:ga-requirement-conformance-semantic-binding-index@9"
  >;
  readonly releaseBinding: ReceiptRef<"receipt:release-conformance-binding-index@9">;
  readonly bindingDigest: string;
  readonly payloadDigest: string;
  readonly testedDistributionArtifactDigest: string;
  readonly exactDetailedReferenceBindingReceiptId: string;
  readonly exactDetailedReferenceBindingDigest: string;
  readonly provesRunSubjectIndexAndDetailedReferenceBindingAreTheSameCommittedBinding: true;
  readonly exactDetailedTypeChainWasVerifiedBeforeThisCompactIndexWasCommitted: true;
  readonly provesReportRunSubjectRequirementCorePayloadAttestationAndDistributionExact: true;
}

type CommittedGaJourneyRunReleaseConformanceBindingForRowReceiptV9<
  R extends ReferenceRequirementRowV3,
  D extends string,
> = GaJourneyRunReleaseConformanceBindingForRowReceipt<R> &
  DeepFrozenCommittedReceiptV1<
    ReceiptRef<"receipt:ga-journey-run-release-conformance-binding@9", R["requirementKey"]>
  > & {
    readonly testedDistributionArtifactDigest: D;
  };

declare const gaRequirementConformanceSemanticBindingIndexBrandV9: unique symbol;

interface GaRequirementConformanceSemanticBindingIndexReceiptV9<
  R extends ReferenceRequirementRowV3 = ReferenceRequirementRowV3,
  CD extends string = string,
> extends ReceiptRef<
    "receipt:ga-requirement-conformance-semantic-binding-index@9",
    readonly [R["requirementKey"], CD]
  > {
  readonly [gaRequirementConformanceSemanticBindingIndexBrandV9]: never;
  readonly referenceRequirement: R;
  readonly requirementKey: R["requirementKey"];
  readonly entryKey: R["entryKey"];
  readonly productId: R["productId"];
  readonly surfaceKind: R["surfaceKind"];
  readonly protocolProfile: R["protocolProfile"];
  readonly authKind: R["authKind"];
  readonly realmClass: R["realmClass"];
  readonly conformanceCoreDigest: CD;
  readonly exactDetailedSemanticBinding: ReceiptRef<
    "receipt:ga-requirement-conformance-semantic-binding@4"
  >;
  readonly exactDetailedSemanticBindingDigest: string;
  readonly exactDetailedTypeChainWasVerifiedBeforeThisCompactIndexWasCommitted: true;
}

type CommittedGaRequirementConformanceSemanticBindingIndexReceiptV9<
  R extends ReferenceRequirementRowV3,
  CD extends string,
> = GaRequirementConformanceSemanticBindingIndexReceiptV9<R, CD> &
  DeepFrozenCommittedReceiptV1<
    ReceiptRef<
      "receipt:ga-requirement-conformance-semantic-binding-index@9",
      readonly [R["requirementKey"], CD]
    >
  >;

declare function commitGaRequirementConformanceSemanticBindingIndexV9<
  const R extends ReferenceRequirementRowV3,
  const C extends ReferenceConformanceCoreForRowV4<R>,
  const CD extends string,
>(input: {
  readonly referenceRequirement: R;
  readonly detailedBinding: GaRequirementConformanceSemanticBindingReceiptV4<NoInfer<R>, C>;
  readonly conformanceCoreDigest: CD;
}): CommittedGaRequirementConformanceSemanticBindingIndexReceiptV9<R, CD>;

declare const releaseConformanceBindingIndexBrandV9: unique symbol;

interface ReleaseConformanceBindingIndexReceiptV9<
  CD extends string = string,
  D extends string = string,
> extends ReceiptRef<"receipt:release-conformance-binding-index@9", readonly [CD, D]> {
  readonly [releaseConformanceBindingIndexBrandV9]: never;
  readonly conformanceCoreDigest: CD;
  readonly exactDetailedReleaseBindingDigest: string;
  readonly payloadDigest: string;
  readonly attestationDigest: string;
  readonly testedDistributionArtifactDigest: D;
  readonly releasedDistributionPayloadDigest: string;
  readonly exactCorePayloadAttestationSutAndDistributionTypeChainWasVerifiedBeforeThisCompactIndexWasCommitted: true;
}

type CommittedReleaseConformanceBindingIndexReceiptV9<
  CD extends string,
  D extends string,
> = ReleaseConformanceBindingIndexReceiptV9<CD, D> &
  DeepFrozenCommittedReceiptV1<
    ReceiptRef<"receipt:release-conformance-binding-index@9", readonly [CD, D]>
  >;

declare function commitReleaseConformanceBindingIndexV9<
  const C extends ConformanceResultCore,
  const CD extends string,
  const D extends string,
>(input: {
  readonly conformanceCore: C;
  readonly conformanceCoreDigest: CD;
  readonly detailedBinding: ReleaseConformanceBindingForCore<NoInfer<C>> & {
    readonly sutDistributionArtifactDigest: NoInfer<D>;
  };
  readonly detailedBindingDigest: string;
  readonly testedDistributionArtifactDigest: D;
}): CommittedReleaseConformanceBindingIndexReceiptV9<CD, D>;

declare function commitGaJourneyRunReleaseConformanceBindingV9<
  const R extends ReferenceRequirementRowV3,
  const CD extends string,
  const D extends string,
>(input: {
  readonly referenceRequirement: R;
  readonly runSubject: GaJourneyRunSubjectV2 & {
    readonly referenceRequirement: NoInfer<R>;
    readonly requirementKey: NoInfer<R>["requirementKey"];
    readonly exactReferenceBinding: CommittedGaExactReferenceRunSubjectBindingIndexForRowV10<NoInfer<R>>;
  };
  readonly exactDetailedReferenceBinding: GaExactReferenceRunSubjectBindingReceiptV4<NoInfer<R>>;
  readonly runSubjectDigest: string;
  readonly conformanceCoreDigest: CD;
  readonly report: Extract<GaJourneyRunReportReceipt, { readonly reportOutcome: "completed_pass" }>;
  readonly reportAttestation: GaJourneyReportAttestationReceipt & {
    readonly testedDistributionArtifactDigest: NoInfer<D>;
  };
  readonly semanticBinding: CommittedGaRequirementConformanceSemanticBindingIndexReceiptV9<
    NoInfer<R>,
    NoInfer<CD>
  >;
  readonly releaseBinding: CommittedReleaseConformanceBindingIndexReceiptV9<
    NoInfer<CD>,
    NoInfer<D>
  >;
  readonly testedDistributionArtifactDigest: D;
}): CommittedGaJourneyRunReleaseConformanceBindingForRowReceiptV9<R, D>;

type GaJourneyRunReleaseConformanceBindingReceipt =
  GaJourneyRunReleaseConformanceBindingForRowReceipt;

declare const gaJourneyRunEvidenceForRowBrandV9: unique symbol;

type GaJourneyRunEvidenceForRowV4<
  R extends ReferenceRequirementRowV3 = ReferenceRequirementRowV3,
> = ReceiptRef<
  "receipt:ga-journey-run-evidence@9",
  R["requirementKey"]
> & {
  readonly [gaJourneyRunEvidenceForRowBrandV9]: never;
  readonly referenceRequirement: R;
  readonly requirementKey: R["requirementKey"];
  readonly entryKey: R["entryKey"];
  readonly runSubjectDigest: string;
  readonly journeyKey: R["journeyKey"];
  readonly productId: R["productId"];
  readonly surfaceKind: R["surfaceKind"];
  readonly protocolProfile: R["protocolProfile"];
  readonly authKind: R["authKind"];
  readonly realmClass: R["realmClass"];
  readonly report: ReceiptRef;
  readonly reportAttestation: ReceiptRef;
  readonly runGateReport: ReceiptRef;
  readonly runGateAttestation: ReceiptRef;
  readonly releaseConformanceBinding: ReceiptRef<
    "receipt:ga-journey-run-release-conformance-binding@9",
    R["requirementKey"]
  >;
  readonly releaseConformanceBindingDigest: string;
  readonly testedDistributionArtifactDigest: string;
  readonly exactDetailedReferenceBindingReceiptId: string;
  readonly exactDetailedReferenceBindingDigest: string;
  readonly provesRunSubjectIndexAndDetailedReferenceBindingAreTheSameCommittedBinding: true;
  readonly computedGateOutcome: "completed_pass";
  readonly exactDetailedTypeChainWasVerifiedBeforeThisCompactEvidenceWasCommitted: true;
  readonly provesEveryNestedReportGateAndBindingUsesThisExactRequirementAndRunSubject: true;
};

type CommittedGaJourneyRunEvidenceForRowReceiptV9<
  R extends ReferenceRequirementRowV3,
  D extends string,
> = GaJourneyRunEvidenceForRowV4<R> &
  DeepFrozenCommittedReceiptV1<ReceiptRef<"receipt:ga-journey-run-evidence@9", R["requirementKey"]>> & {
    readonly testedDistributionArtifactDigest: D;
  };

declare function commitGaJourneyRunEvidenceForRowV9<
  const R extends ReferenceRequirementRowV3,
  const D extends string,
>(input: {
  readonly referenceRequirement: R;
  readonly runSubject: GaJourneyRunSubjectV2 & {
    readonly referenceRequirement: NoInfer<R>;
    readonly requirementKey: NoInfer<R>["requirementKey"];
    readonly exactReferenceBinding: CommittedGaExactReferenceRunSubjectBindingIndexForRowV10<NoInfer<R>>;
  };
  readonly exactDetailedReferenceBinding: GaExactReferenceRunSubjectBindingReceiptV4<NoInfer<R>>;
  readonly runSubjectDigest: string;
  readonly report: Extract<GaJourneyRunReportReceipt, { readonly reportOutcome: "completed_pass" }>;
  readonly reportAttestation: GaJourneyReportAttestationReceipt & {
    readonly testedDistributionArtifactDigest: NoInfer<D>;
  };
  readonly runGateReport: GaJourneyRunGateReportReceipt & {
    readonly testedDistributionArtifactDigest: NoInfer<D>;
  };
  readonly runGateAttestation: GaJourneyRunGateAttestationReceipt;
  readonly releaseConformanceBinding: CommittedGaJourneyRunReleaseConformanceBindingForRowReceiptV9<
    NoInfer<R>,
    NoInfer<D>
  >;
  readonly testedDistributionArtifactDigest: D;
}): CommittedGaJourneyRunEvidenceForRowReceiptV9<R, D>;

type GaJourneyRunEvidenceV2 = GaJourneyRunEvidenceForRowV4;

interface GaJourneyAggregateGateReportReceipt extends ReceiptRef {
  readonly journeyDefinition: GaJourneyDefinitionV2;
  readonly referenceRunSubjectDerivation: ReferenceRunSubjectDerivationReceiptV4;
  readonly expectedUserRunSubjectDigests: NonEmptyReadonly<string>;
  readonly expectedPseudoLocaleRunSubjectDigests: NonEmptyReadonly<string>;
  readonly actualUserRunSubjectDigests: NonEmptyReadonly<string>;
  readonly actualPseudoLocaleRunSubjectDigests: NonEmptyReadonly<string>;
  readonly runGateReports: NonEmptyReadonly<GaJourneyRunGateReportReceipt>;
  readonly runGateAttestations: NonEmptyReadonly<GaJourneyRunGateAttestationReceipt>;
  readonly testedDistributionArtifactDigest: string;
  readonly computedOutcome: "completed_pass";
  readonly provesExpectedAndActualCanonicalRunSubjectSetsEqualWithoutOmissionDuplicationOrExtra: true;
  readonly provesExpectedSubjectsAreExactRequirementPlatformLocaleAnchorAccountStateGraphCartesianSubset: true;
  readonly provesEveryRunReportAttestationBindingPlatformLocaleFixtureAndUxMetricContractExact: true;
}

interface GaJourneyAggregateGateAttestationReceipt extends ReceiptRef {
  readonly gateReport: GaJourneyAggregateGateReportReceipt;
  readonly gateReportDigest: string;
  readonly verifierPolicy: TufTargetAuthorizationReceipt;
  readonly dsseSubjectDigest: string;
  readonly provenanceSubjectDigest: string;
  readonly sigstoreBundleDigest: string;
  readonly provesSubjectsEqualGateReportDigest: true;
}

interface GaJourneyReleaseEvidenceV2 {
  readonly journeyKey: string;
  readonly journeyDefinition: GaJourneyDefinitionV2;
  readonly expectedUserRunSubjectDigests: NonEmptyReadonly<string>;
  readonly expectedPseudoLocaleRunSubjectDigests: NonEmptyReadonly<string>;
  readonly runs: NonEmptyReadonly<GaJourneyRunEvidenceV2>;
  readonly aggregateGateReport: GaJourneyAggregateGateReportReceipt;
  readonly aggregateGateAttestation: GaJourneyAggregateGateAttestationReceipt;
  readonly liveQualificationReleaseClosure: GaLiveQualificationReleaseClosureV6;
  readonly testedDistributionArtifactDigest: string;
  readonly computedGateOutcome: "completed_pass";
  readonly provesRunsExactlyEqualExpectedUserAndPseudoRunSubjects: true;
  readonly provesDeterministicCartesianCoverageAndBoundedLiveQualificationAreSeparateNonSubstitutableEvidenceSets: true;
}

interface GaEntryGateReportReceipt extends ReceiptRef {
  readonly entryKey: string;
  readonly matrixEntry: Extract<GaEcosystemMatrixEntryV2, { readonly requiredForGa: true }>;
  readonly referenceGradeProfile: ReferenceGradeProfileV3;
  readonly mandatoryBaseline: GaMandatoryBaselineV3;
  readonly referenceRunSubjectDerivation: ReferenceRunSubjectDerivationReceiptV4;
  readonly expectedRequirementRows: NonEmptyReadonly<ReferenceRequirementRowV3>;
  readonly actualCompletedRequirementRows: NonEmptyReadonly<ReferenceRequirementRowV3>;
  readonly expectedJourneySubjectDigests: NonEmptyReadonly<string>;
  readonly expectedUserRunSubjectDigests: NonEmptyReadonly<string>;
  readonly expectedPseudoLocaleRunSubjectDigests: NonEmptyReadonly<string>;
  readonly journeyGateReports: NonEmptyReadonly<GaJourneyAggregateGateReportReceipt>;
  readonly journeyGateAttestations: NonEmptyReadonly<GaJourneyAggregateGateAttestationReceipt>;
  readonly actualUserRunSubjectDigests: NonEmptyReadonly<string>;
  readonly actualPseudoLocaleRunSubjectDigests: NonEmptyReadonly<string>;
  readonly liveQualificationReleaseClosure: GaLiveQualificationReleaseClosureV6;
  readonly testedDistributionArtifactDigest: string;
  readonly computedOutcome: "completed_pass";
  readonly provesEntryMaturityTierAndEveryRunReadinessEligibleAndExact: true;
  readonly provesExpectedAndActualRequirementProtocolSurfaceAuthRealmRecipeStateSetsEqual: true;
  readonly provesExactRequiredJourneyAndRunCoverageAndReportAttestationPairingWithoutOmissionDuplicationOrSubstitution: true;
}

interface GaEntryGateAttestationReceipt extends ReceiptRef {
  readonly gateReport: GaEntryGateReportReceipt;
  readonly gateReportDigest: string;
  readonly verifierPolicy: TufTargetAuthorizationReceipt;
  readonly dsseSubjectDigest: string;
  readonly provenanceSubjectDigest: string;
  readonly sigstoreBundleDigest: string;
  readonly provesSubjectsEqualGateReportDigest: true;
}

interface GaEntryReleaseEvidenceV2 {
  readonly entryKey: string;
  readonly journeyEvidence: NonEmptyReadonly<GaJourneyReleaseEvidenceV2>;
  readonly gateReport: GaEntryGateReportReceipt;
  readonly gateAttestation: GaEntryGateAttestationReceipt;
  readonly computedGateOutcome: "completed_pass";
  readonly provesJourneyEvidenceReportsAttestationsAndEntryGateInputsEqual: true;
}

interface GaReferenceMutationGateReportReceipt extends ReceiptRef {
  readonly referenceGradeProfileDigest: string;
  readonly gaMatrixCoreDigest: string;
  readonly gaMandatoryBaselineDigest: string;
  readonly distributionArtifactDigest: string;
  readonly requiredMutationFixtureKinds: ReferenceGradeProfileV3["requiredMutationFixtureKinds"];
  readonly executedMutationFixtureKinds: ReferenceGradeProfileV3["requiredMutationFixtureKinds"];
  readonly mutationResultDigestsByKind: {
    readonly [K in ReferenceGradeProfileV3["requiredMutationFixtureKinds"][number]]: string;
  };
  readonly everyMutationWasRejectedBeforeReleaseGateSuccess: true;
  readonly provesRequiredAndExecutedMutationSetsEqualWithoutOmissionDuplicationOrExtra: true;
  readonly provesReadinessUxAnchorAccountStateGraphEntryL0RightsRequirementRecipeCustomAuthAndEveryOracleIdentityAxisMutationCannotPass: true;
  readonly computedOutcome: "completed_pass";
}

interface GaEcosystemGateReportReceipt extends ReceiptRef {
  readonly gaMatrixCoreDigest: string;
  readonly gaMandatoryBaselineDigest: string;
  readonly referenceGradeProfileDigest: string;
  readonly referenceRunSubjectDerivation: ReferenceRunSubjectDerivationReceiptV4;
  readonly exactOracleConformance: DeepFrozenCommittedReceiptV1<ReferenceExactOracleConformanceReceiptV9>;
  readonly ownerDecisionEvidenceSetDigest: string;
  readonly distributionArtifactDigest: string;
  readonly expectedEntryKeySetDigest: string;
  readonly expectedRequirementKeys: NonEmptyReadonly<ReferenceRequirementKeyV3>;
  readonly actualCompletedRequirementKeys: NonEmptyReadonly<ReferenceRequirementKeyV3>;
  readonly expectedJourneySubjectDigests: NonEmptyReadonly<string>;
  readonly expectedUserRunSubjectDigests: NonEmptyReadonly<string>;
  readonly expectedPseudoLocaleRunSubjectDigests: NonEmptyReadonly<string>;
  readonly expectedRuntimeRecoveryRunSubjectDigests: NonEmptyReadonly<string>;
  readonly actualEntryKeySetDigest: string;
  readonly actualJourneySubjectDigests: NonEmptyReadonly<string>;
  readonly actualUserRunSubjectDigests: NonEmptyReadonly<string>;
  readonly actualPseudoLocaleRunSubjectDigests: NonEmptyReadonly<string>;
  readonly actualRuntimeRecoveryRunSubjectDigests: NonEmptyReadonly<string>;
  readonly actualMigrationOnlyAbsenceRunSubjectDigests: readonly [string];
  readonly runtimeRecoveryEvidence: NonEmptyReadonly<GaRuntimeRecoveryJourneyEvidenceV4>;
  readonly liveQualificationReleaseClosure: GaLiveQualificationReleaseClosureV6;
  readonly platformSecurityProductionClosure: PlatformSecurityProductionClosureV6;
  readonly specialFundingReleaseClosure: SpecialFundingReleaseClosureV6;
  readonly entryGateReports: NonEmptyReadonly<GaEntryGateReportReceipt>;
  readonly entryGateAttestations: NonEmptyReadonly<GaEntryGateAttestationReceipt>;
  readonly referenceMutationGateReport: GaReferenceMutationGateReportReceipt;
  readonly reviewReadySolution: ReviewReadySupplySolutionReceiptV5;
  readonly computedOutcome: "completed_pass";
  readonly provesEveryRequiredEntryMaturityTierAndEveryRunReadinessEligibleAndExact: true;
  readonly provesExpectedAndActualRequirementKeysProtocolAuthRealmRecipePlatformAndEvidenceSetsExact: true;
  readonly provesCanonicalExpectedAndActualEntryJourneyAuthPlatformUserLocalePseudoSuiteFundingAndAttestationSetsEqual: true;
  readonly provesExpectedUserAndPseudoRunSubjectsEqualTypedAccountStateGraphCartesianDerivation: true;
  readonly provesExpectedAndActualRuntimeRecoverySubjectsAndEvidenceAreExactWithoutZeroConfigPreTerminalPass: true;
  readonly provesMigrationOnlyExistingConnectionAndNoExistingConnectionAbsenceSubjectsAreExactAndFreshRunsAreZero: true;
  readonly provesReferenceMutationGateProfileMatrixBaselineDistributionAndOutcomeExact: true;
  readonly provesExactOracleConformanceRegistryRequirementDistributionAndMutationGateAreTheSameReleaseSubjects: true;
  readonly provesReviewReadyOnlyFromExactFourSlotSolutionActivationPointersAndIndependentEvaluator: true;
}

interface GaEcosystemGateAttestationReceipt extends ReceiptRef {
  readonly gateReport: GaEcosystemGateReportReceipt;
  readonly gateReportDigest: string;
  readonly verifierPolicy: TufTargetAuthorizationReceipt;
  readonly dsseSubjectDigest: string;
  readonly provenanceSubjectDigest: string;
  readonly sigstoreBundleDigest: string;
  readonly provesSubjectsEqualGateReportDigest: true;
}

type GeneratedSupportArtifactKindV4 =
  | "support_page"
  | "connection_picker"
  | "test_matrix"
  | "release_note";

type PublishedClaimDisclosureClassV6 =
  | "exact_direct_or_platform_route"
  | "runtime_route_or_funding_variant_disclosed"
  | "opaque_bridge_route_and_funding_disclosed"
  | "migration_only_existing_connection_required_and_fresh_onboarding_unavailable"
  | "execution_or_control_surface_not_inference";

type PublishedClaimDisclosureClassForRowV8<R extends ReferenceRequirementRowV3> =
  R["onboardingAvailability"] extends "existing_connection_migration_only"
    ? "migration_only_existing_connection_required_and_fresh_onboarding_unavailable"
    : Exclude<
        PublishedClaimDisclosureClassV6,
        "migration_only_existing_connection_required_and_fresh_onboarding_unavailable"
      >;

type PublishedClaimLimitationKeysForRowV8<R extends ReferenceRequirementRowV3> =
  R["onboardingAvailability"] extends "existing_connection_migration_only"
    ? readonly [
        "supply.claim.limit.existing_connection_required",
        "supply.claim.limit.fresh_onboarding_unavailable",
        "supply.claim.limit.migrate_to_tokenhub_or_retain_read_only",
      ]
    : readonly `supply.claim.limit.${string}`[];

type PublishedPickerAvailabilityForRowV8<R extends ReferenceRequirementRowV3> =
  R["onboardingAvailability"] extends "existing_connection_migration_only"
    ? {
        readonly freshConnectionPickerVisibility: "hidden";
        readonly existingConnectionManagementCardVisibility: "visible_only_when_existing_connection_present";
        readonly noExistingConnectionDisposition: "not_applicable_no_existing_connection";
        readonly onlyPrimaryAction: "review-existing-connection-migration";
      }
    : {
        readonly freshConnectionPickerVisibility: "visible_if_current_runtime_readiness_allows";
        readonly existingConnectionManagementCardVisibility: "derived_from_current_connection_state";
        readonly noExistingConnectionDisposition: "fresh_onboarding_available";
        readonly onlyPrimaryAction?: never;
      };

declare const publishedProductProtocolClaimBrandV6: unique symbol;

type PublishedProductProtocolClaimForRowV6<
  R extends ReferenceRequirementRowV3,
  D extends string,
> = ReceiptRef<
  "receipt:published-product-protocol-claim@6",
  readonly [R["requirementKey"], D]
> & {
  readonly [publishedProductProtocolClaimBrandV6]: never;
  readonly referenceRequirement: R;
  readonly exactConnectionOracle: R["connectionOracle"];
  readonly exactOracleIdentityComparison: ReferenceExactOracleIdentityComparisonReceiptV9<
    R["requirementKey"],
    D
  >;
  readonly requirementKey: R["requirementKey"];
  readonly entryKey: R["entryKey"];
  readonly productId: R["productId"];
  readonly surfaceKind: R["surfaceKind"];
  readonly protocolProfile: R["protocolProfile"];
  readonly exactConnectionOracleProfileId: R["connectionOracle"]["wire"]["profileId"];
  readonly exactAuthOracleProfileId: R["connectionOracle"]["auth"]["profileId"];
  readonly exactConnectionOracleDigest: string;
  readonly exactAuthOracleDigest: string;
  readonly realmClass: R["realmClass"];
  readonly platformScope: R["platformScope"];
  readonly onboardingAvailability: R["onboardingAvailability"];
  readonly fundingTier: R["fundingTier"];
  readonly ecosystemTier: R["ecosystemTier"];
  readonly releaseMaturity: R["releaseMaturity"];
  readonly liveQualificationMode: R["liveQualificationMode"];
  readonly liveQualificationDisposition: GaLiveQualificationDispositionForRequirementV6<R, D>;
  readonly disclosureClass: PublishedClaimDisclosureClassForRowV8<R>;
  readonly generatedLimitationMessageKeys: PublishedClaimLimitationKeysForRowV8<R>;
  readonly pickerAvailability: PublishedPickerAvailabilityForRowV8<R>;
  readonly claimStatus: "released_and_evidence_bound";
  readonly testedDistributionArtifactDigest: D;
  readonly exactRequirementDigest: string;
  readonly exactJourneyAndConformanceEvidenceDigest: string;
  readonly exactEntryAndEcosystemGateDigest: string;
  readonly liveQualificationDispositionDigest: string;
  readonly applicableFundingVariantEvidenceDigest: string | "baseline_no_special_variant";
  readonly canonicalClaimBytesDigest: string;
  readonly currentUserConnectionReadinessMustStillBeDerivedAtRuntime: true;
  readonly cannotImplyUnlistedProtocolAuthRealmFundingRouteModelOrProductEdition: true;
  readonly provesClaimWasCommittedOnlyFromTheExactRequirementOracleCompletedEvidenceGateLiveDispositionFundingVariantAndDistribution: true;
};

declare const publishedProductProtocolClaimIndexBrandV9: unique symbol;

interface PublishedProductProtocolClaimV6<D extends string = string> extends ReceiptRef<
  "receipt:published-product-protocol-claim-index@9",
  readonly [ReferenceRequirementKeyV3, D]
> {
  readonly [publishedProductProtocolClaimIndexBrandV9]: never;
  readonly requirementKey: ReferenceRequirementKeyV3;
  readonly entryKey: ReferenceEntryKeyV3;
  readonly productId: string;
  readonly surfaceKind: ReferenceSurfaceKindV3;
  readonly protocolProfile: ReferenceProtocolProfileV3;
  readonly realmClass: "china_mainland" | "global" | "local";
  readonly exactConnectionOracleProfileId: `wire-oracle:${string}@6`;
  readonly exactAuthOracleProfileId: `auth-oracle:${string}@6`;
  readonly exactDetailedClaimReceiptId: string;
  readonly exactDetailedClaimDigest: string;
  readonly exactOracleIdentityComparisonReceiptId: string;
  readonly testedDistributionArtifactDigest: D;
  readonly claimStatus: "released_and_evidence_bound";
  readonly indexWasCommittedOnlyFromOneDeepFrozenExactRowClaimWithoutTypeErasure: true;
}

declare function commitPublishedProductProtocolClaimIndexV9<
  const R extends ReferenceRequirementRowV3,
  const D extends string,
>(input: {
  readonly detailedClaim: DeepFrozenCommittedReceiptV1<PublishedProductProtocolClaimForRowV6<R, D>>;
}): DeepFrozenCommittedReceiptV1<
  PublishedProductProtocolClaimV6<D> & {
    readonly requirementKey: R["requirementKey"];
    readonly entryKey: R["entryKey"];
    readonly productId: R["productId"];
    readonly surfaceKind: R["surfaceKind"];
    readonly protocolProfile: R["protocolProfile"];
    readonly realmClass: R["realmClass"];
    readonly exactConnectionOracleProfileId: R["connectionOracle"]["wire"]["profileId"];
    readonly exactAuthOracleProfileId: R["connectionOracle"]["auth"]["profileId"];
  }
>;

declare function commitPublishedProductProtocolClaimV6<
  R extends ReferenceRequirementRowV3,
  D extends string,
>(input: {
  readonly referenceRequirement: R;
  readonly exactConnectionOracle: NoInfer<R>["connectionOracle"];
  readonly exactOracleIdentityComparison: ReferenceExactOracleIdentityComparisonReceiptV9<
    NoInfer<R>["requirementKey"],
    NoInfer<D>
  >;
  readonly completedJourneyEvidence: CommittedGaJourneyRunEvidenceForRowReceiptV9<
    NoInfer<R>,
    NoInfer<D>
  >;
  readonly entryGateReport: GaEntryGateReportReceipt & {
    readonly entryKey: NoInfer<R>["entryKey"];
    readonly testedDistributionArtifactDigest: NoInfer<D>;
    readonly liveQualificationReleaseClosure: GaLiveQualificationReleaseClosureV6<NoInfer<D>>;
    readonly computedOutcome: "completed_pass";
  };
  readonly ecosystemGateReport: GaEcosystemGateReportReceipt & {
    readonly distributionArtifactDigest: NoInfer<D>;
    readonly liveQualificationReleaseClosure: GaLiveQualificationReleaseClosureV6<NoInfer<D>>;
    readonly platformSecurityProductionClosure: PlatformSecurityProductionClosureV6<NoInfer<D>>;
    readonly specialFundingReleaseClosure: SpecialFundingReleaseClosureV6<NoInfer<D>>;
    readonly computedOutcome: "completed_pass";
  };
  readonly liveQualificationReleaseClosure: GaLiveQualificationReleaseClosureV6<NoInfer<D>>;
  readonly specialFundingReleaseClosure: SpecialFundingReleaseClosureV6<NoInfer<D>>;
  readonly testedDistributionArtifactDigest: D;
}): DeepFrozenCommittedReceiptV1<PublishedProductProtocolClaimForRowV6<R, D>>;

declare const publishedProductProtocolClaimSetBrandV6: unique symbol;

interface PublishedProductProtocolClaimSetReceiptV6<D extends string = string>
  extends ReceiptRef<"receipt:published-product-protocol-claim-set@6", D> {
  readonly [publishedProductProtocolClaimSetBrandV6]: never;
  readonly schemaVersion: "saydo.dev/published-product-protocol-claim-set/v6";
  readonly referenceRequirementsDigest: string;
  readonly exactOracleConformance: DeepFrozenCommittedReceiptV1<ReferenceExactOracleConformanceReceiptV9<D>>;
  readonly expectedRequirementKeys: NonEmptyReadonly<ReferenceRequirementKeyV3>;
  readonly actualClaimRequirementKeys: NonEmptyReadonly<ReferenceRequirementKeyV3>;
  readonly orderedClaims: NonEmptyReadonly<PublishedProductProtocolClaimV6<D>>;
  readonly claimCount: 81;
  readonly duplicateMissingOrExtraClaimCount: 0;
  readonly handMaintainedOrUnverifiedClaimCount: 0;
  readonly crossRequirementOracleEvidenceGateLiveFundingOrDistributionMismatchCount: 0;
  readonly testedDistributionArtifactDigest: D;
  readonly claimSetDigest: string;
  readonly canonicalClaimSetBytesDigest: string;
  readonly mutationFixtureRejectedKinds: readonly [
    "unlisted_protocol",
    "wrong_auth",
    "wrong_realm",
    "wrong_product_edition",
    "wrong_funding_variant",
    "opaque_route_claimed_exact",
    "inventory_claimed_supported",
    "stale_or_wrong_distribution_evidence",
  ];
  readonly provesClaimsAreASortedExactBijectionWithReleasedRequirementsAndNoProseOnlyCapabilityCanEnter: true;
}

declare function commitPublishedProductProtocolClaimSetV6<const D extends string>(input: {
  readonly requirements: typeof REFERENCE_REQUIREMENTS_V3;
  readonly claims: NonEmptyReadonly<PublishedProductProtocolClaimV6<NoInfer<D>>>;
  readonly exactOracleConformance: DeepFrozenCommittedReceiptV1<ReferenceExactOracleConformanceReceiptV9<NoInfer<D>>>;
  readonly releaseEvidenceSet: GaEcosystemReleaseEvidenceSetV3 & {
    readonly distributionArtifactDigest: NoInfer<D>;
    readonly liveQualificationReleaseClosure: GaLiveQualificationReleaseClosureV6<NoInfer<D>>;
    readonly platformSecurityProductionClosure: PlatformSecurityProductionClosureV6<NoInfer<D>>;
    readonly specialFundingReleaseClosure: SpecialFundingReleaseClosureV6<NoInfer<D>>;
  };
  readonly testedDistributionArtifactDigest: D;
}): DeepFrozenCommittedReceiptV1<PublishedProductProtocolClaimSetReceiptV6<D>>;

declare const ownerAdditionalRequirementReleaseQualificationBrandV6: unique symbol;
declare const ownerRequirementJourneyQualificationBrandV7: unique symbol;
declare const ownerRequirementLiveQualificationBrandV7: unique symbol;
declare const ownerRequirementFundingQualificationBrandV7: unique symbol;
declare const ownerRequirementMutationQualificationBrandV7: unique symbol;

interface OwnerRequirementJourneyQualificationReceiptV7<
  R extends OwnerAdditionalRequirementV4 = OwnerAdditionalRequirementV4,
  D extends string = string,
> extends ReceiptRef<"receipt:owner-requirement-journey-qualification@7", readonly [R, D]> {
  readonly [ownerRequirementJourneyQualificationBrandV7]: never;
  readonly ownerRequirement: R;
  readonly semanticCompilation: R["semanticCompilation"];
  readonly testedDistributionArtifactDigest: D;
  readonly exactDerivedRunSubjectSet: NonEmptyReadonly<ReceiptRef<"receipt:owner-requirement-run-subject@7", R>>;
  readonly completedJourneyGateReports: NonEmptyReadonly<GaJourneyRunGateReportReceipt>;
  readonly completedRuntimeRecoveryGateReports: readonly GaJourneyRunGateReportReceipt[];
  readonly requiredAndActualStartingAccountPlatformLocaleAndPseudoLocaleTupleSetDigest: string;
  readonly requiredAndActualRuntimeRecoveryTupleSetDigest: string;
  readonly exactRecipeFieldConditionalTaskAndStateAssertionEvidenceDigest: string;
  readonly missingDuplicateExtraFailedOrCrossRequirementRunCount: 0;
  readonly provesEveryCompilerDerivedRunSubjectPassedItsExactJourneyRecipeUxLocaleAccessibilityAndRecoveryGateForThisDistribution: true;
}

type OwnerRequirementLiveQualificationModeEvidenceV7<
  R extends OwnerAdditionalRequirementV4,
  D extends string,
> = R["liveQualificationMode"] extends "required_remote_provider"
  ? {
      readonly mode: "required_remote_provider";
      readonly coveragePlan: GaLiveQualificationCoveragePlanReceiptV6;
      readonly cycleOne: GaLiveQualificationCycleReceiptV6<1, D>;
      readonly cycleTwo: GaLiveQualificationCycleReceiptV6<2, D>;
      readonly twoCycleEvidenceDisjointness: GaTwoCycleEvidenceDisjointnessReceiptV7<D>;
      readonly exactOwnerRequirementCoverageUnitAndCompletedRunReceiptSetDigest: string;
    }
  : R["liveQualificationMode"] extends "required_remote_existing_connection_migration"
    ? never
  : R["liveQualificationMode"] extends "required_remote_upstream_surface"
    ? {
        readonly mode: "required_remote_upstream_surface";
        readonly cycleOneManagedAccountSurfaceSessionAndTurn: ReceiptRef<
          "receipt:owner-remote-upstream-surface-cycle@7",
          readonly [R, 1, D]
        >;
        readonly cycleTwoManagedAccountSurfaceSessionAndTurn: ReceiptRef<
          "receipt:owner-remote-upstream-surface-cycle@7",
          readonly [R, 2, D]
        >;
        readonly twoCycleOccurrenceDisjointness: GaQualificationOccurrenceDisjointnessReceiptV7;
      }
    : R["liveQualificationMode"] extends "required_local_product"
      ? {
          readonly mode: "required_local_product";
          readonly cycleOneInstalledProductColdWarmProtocolEvidence: ReceiptRef<
            "receipt:owner-local-product-cycle@7",
            readonly [R, 1, D]
          >;
          readonly cycleTwoInstalledProductColdWarmProtocolEvidence: ReceiptRef<
            "receipt:owner-local-product-cycle@7",
            readonly [R, 2, D]
          >;
          readonly twoCycleOccurrenceDisjointness: GaQualificationOccurrenceDisjointnessReceiptV7;
        }
      : R["liveQualificationMode"] extends "required_platform_control"
        ? {
            readonly mode: "required_platform_control";
            readonly platformSecurityProductionClosure: PlatformSecurityProductionClosureV6<D>;
          }
        : {
            readonly mode: "not_applicable_user_or_admin_supplied_endpoint";
            readonly dependencyClass: "user_or_admin_supplied_endpoint";
            readonly compilerProof: ReceiptRef<
              "receipt:owner-live-not-applicable-custom-endpoint-proof@7",
              readonly [R, D]
            >;
            readonly provesOnlyCompilerClassifiedUserOrAdminSuppliedEndpointCanUseNotApplicable: true;
          };

interface OwnerRequirementLiveQualificationReceiptV7<
  R extends OwnerAdditionalRequirementV4 = OwnerAdditionalRequirementV4,
  D extends string = string,
> extends ReceiptRef<"receipt:owner-requirement-live-qualification@7", readonly [R, D]> {
  readonly [ownerRequirementLiveQualificationBrandV7]: never;
  readonly ownerRequirement: R;
  readonly semanticCompilation: R["semanticCompilation"];
  readonly compilerDerivedMode: R["liveQualificationMode"];
  readonly modeEvidence: OwnerRequirementLiveQualificationModeEvidenceV7<R, D>;
  readonly testedDistributionArtifactDigest: D;
  readonly crossRequirementModeEvidenceDistributionOrOccurrenceMismatchCount: 0;
  readonly provesModeEvidenceIsTheOnlyConstituentForTheCompilerDerivedDependencyClassAndExactOwnerRow: true;
}

interface OwnerRequirementFundingQualificationReceiptV7<
  R extends OwnerAdditionalRequirementV4 = OwnerAdditionalRequirementV4,
  D extends string = string,
> extends ReceiptRef<"receipt:owner-requirement-funding-qualification@7", readonly [R, D]> {
  readonly [ownerRequirementFundingQualificationBrandV7]: never;
  readonly ownerRequirement: R;
  readonly fundingTier: R["fundingTier"];
  readonly fundingPolicyTemplate: FundingPolicyTemplateReceipt;
  readonly rightsEligibilityAndEntitlementEvidence: ReceiptRef<
    "receipt:owner-requirement-rights-entitlement-evidence@7",
    R
  >;
  readonly exactFundingDecisionOrNoNewSpendProof: ReceiptRef<
    "receipt:owner-requirement-funding-decision@7",
    readonly [R, D]
  >;
  readonly authoritativeUsageBillingAndReconciliationEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly testedDistributionArtifactDigest: D;
  readonly crossRequirementTierRightsEntitlementBudgetDecisionOrDistributionMismatchCount: 0;
  readonly provesFundingWasDerivedFromExactSurfaceTierRightsEntitlementMeteringAndBudgetWithoutOwnerSuppliedOutcome: true;
}

interface OwnerRequirementMutationQualificationReceiptV7<
  R extends OwnerAdditionalRequirementV4 = OwnerAdditionalRequirementV4,
  D extends string = string,
> extends ReceiptRef<"receipt:owner-requirement-mutation-qualification@7", readonly [R, D]> {
  readonly [ownerRequirementMutationQualificationBrandV7]: never;
  readonly ownerRequirement: R;
  readonly testedDistributionArtifactDigest: D;
  readonly mutationCorpus: ImportedOpaqueEvidenceLeafReceipt;
  readonly requiredRejectedMutationKinds: readonly [
    "wire_protocol_or_operation_swap",
    "auth_flow_or_credential_recipient_swap",
    "remote_dependency_changed_to_not_applicable",
    "journey_recipe_or_state_producer_swap",
    "funding_rights_or_entitlement_swap",
    "platform_or_distribution_swap",
    "fixed_namespace_shadow_or_confusable_collision",
  ];
  readonly survivingMutationCount: 0;
  readonly deterministicMutationRunnerExitCode: 0;
}

interface OwnerAdditionalRequirementReleaseQualificationReceiptV6<
  R extends OwnerAdditionalRequirementV4 = OwnerAdditionalRequirementV4,
  D extends string = string,
> extends ReceiptRef<"receipt:owner-additional-requirement-release-qualification@6", readonly [R, D]> {
  readonly [ownerAdditionalRequirementReleaseQualificationBrandV6]: never;
  readonly ownerRequirement: R;
  readonly ownerRequirementCompilation: OwnerAdditionalRequirementSetCompilationReceiptV4;
  readonly semanticCompilation: R["semanticCompilation"];
  readonly exactConnectionOracle: R["connectionOracle"];
  readonly journeyQualification: OwnerRequirementJourneyQualificationReceiptV7<R, D>;
  readonly liveQualification: OwnerRequirementLiveQualificationReceiptV7<R, D>;
  readonly fundingQualification: OwnerRequirementFundingQualificationReceiptV7<R, D>;
  readonly platformSecurityProductionClosure: PlatformSecurityProductionClosureV6<D>;
  readonly entryGateReport: GaEntryGateReportReceipt & {
    readonly entryKey: R["entryKey"];
    readonly testedDistributionArtifactDigest: D;
    readonly computedOutcome: "completed_pass";
  };
  readonly ecosystemGateReport: GaEcosystemGateReportReceipt & {
    readonly distributionArtifactDigest: D;
    readonly computedOutcome: "completed_pass";
  };
  readonly localeAccessibilityAndPassiveActiveInteractionQualification: ReceiptRef<
    "receipt:owner-requirement-locale-accessibility-interaction-qualification@7",
    readonly [R, D]
  >;
  readonly mutationQualification: OwnerRequirementMutationQualificationReceiptV7<R, D>;
  readonly testedDistributionArtifactDigest: D;
  readonly duplicateMissingOrExtraRunCount: 0;
  readonly crossRequirementOracleEvidenceGateLiveFundingOrDistributionMismatchCount: 0;
  readonly provesOwnerRowPassedTheSameDeterministicLiveFundingPlatformLocaleAccessibilityAndMutationPoliciesAsAFixedRow: true;
}

declare function commitOwnerAdditionalRequirementReleaseQualificationV7<
  const R extends OwnerAdditionalRequirementV4,
  const D extends string,
>(input: Omit<
  OwnerAdditionalRequirementReleaseQualificationReceiptV6<R, D>,
  keyof ReceiptRef | typeof ownerAdditionalRequirementReleaseQualificationBrandV6
>): DeepFrozenCommittedReceiptV1<OwnerAdditionalRequirementReleaseQualificationReceiptV6<R, D>>;

declare const publishedOwnerProductProtocolClaimBrandV6: unique symbol;

interface PublishedOwnerProductProtocolClaimV6<
  R extends OwnerAdditionalRequirementV4 = OwnerAdditionalRequirementV4,
  D extends string = string,
> extends ReceiptRef<"receipt:published-owner-product-protocol-claim@6", readonly [R["requirementKey"], D]> {
  readonly [publishedOwnerProductProtocolClaimBrandV6]: never;
  readonly claimOrigin: "owner_namespaced_append_only";
  readonly ownerRequirement: R;
  readonly exactConnectionOracle: R["connectionOracle"];
  readonly requirementKey: R["requirementKey"];
  readonly ownerNamespace: R["ownerNamespace"];
  readonly entryKey: R["entryKey"];
  readonly productId: R["productId"];
  readonly surfaceKind: R["surfaceKind"];
  readonly protocolProfile: R["protocolProfile"];
  readonly exactConnectionOracleProfileId: R["connectionOracle"]["wire"]["profileId"];
  readonly exactAuthOracleProfileId: R["connectionOracle"]["auth"]["profileId"];
  readonly realmClass: R["realmClass"];
  readonly platformScope: R["platformScope"];
  readonly fundingTier: R["fundingTier"];
  readonly ecosystemTier: R["ecosystemTier"];
  readonly releaseMaturity: R["releaseMaturity"];
  readonly disclosureClass: PublishedClaimDisclosureClassV6;
  readonly generatedLimitationMessageKeys: readonly `supply.claim.limit.${string}`[];
  readonly qualification: OwnerRequirementQualificationReceiptV19<R, D>;
  readonly testedDistributionArtifactDigest: D;
  readonly canonicalClaimBytesDigest: string;
  readonly currentUserConnectionReadinessMustStillBeDerivedAtRuntime: true;
  readonly cannotShadowReplaceMergeOrWeakenAnyFixedRequirementOrClaim: true;
  readonly provesClaimWasCommittedOnlyFromTheCanonicalOwnerRowAndFullReleaseQualification: true;
}

declare function commitPublishedOwnerProductProtocolClaimV6<
  R extends OwnerAdditionalRequirementV4,
  D extends string,
>(input: {
  readonly ownerRequirement: R;
  readonly ownerRequirementCompilation: OwnerAdditionalRequirementSetCompilationReceiptV4;
  readonly exactConnectionOracle: NoInfer<R>["connectionOracle"];
  readonly releaseQualification: OwnerRequirementQualificationReceiptV19<
    NoInfer<R>,
    NoInfer<D>
  >;
  readonly testedDistributionArtifactDigest: D;
}): DeepFrozenCommittedReceiptV1<PublishedOwnerProductProtocolClaimV6<R, D>>;

type PublishedSupportClaimV6<D extends string = string> =
  | PublishedProductProtocolClaimV6<D>
  | PublishedOwnerProductProtocolClaimV6<OwnerAdditionalRequirementV4, D>;

declare const publishedSupportClaimSetBrandV6: unique symbol;

interface PublishedSupportClaimSetReceiptV6<D extends string = string>
  extends ReceiptRef<"receipt:published-support-claim-set@6", D> {
  readonly [publishedSupportClaimSetBrandV6]: never;
  readonly schemaVersion: "saydo.dev/published-support-claim-set/v6";
  readonly referenceClaims: PublishedProductProtocolClaimSetReceiptV6<D>;
  readonly ownerRequirementCompilation: OwnerAdditionalRequirementSetCompilationReceiptV4;
  readonly expectedOwnerRequirementKeys: readonly OwnerRequirementKeyV4[];
  readonly actualOwnerClaimRequirementKeys: readonly OwnerRequirementKeyV4[];
  readonly ownerClaims: readonly PublishedOwnerProductProtocolClaimV6<OwnerAdditionalRequirementV4, D>[];
  readonly orderedClaims: NonEmptyReadonly<PublishedSupportClaimV6<D>>;
  readonly fixedReferenceClaimCount: 81;
  readonly totalClaimCount: number;
  readonly ownerClaimMissingDuplicateExtraOrCollisionCount: 0;
  readonly crossFixedOwnerClaimOrDistributionMismatchCount: 0;
  readonly testedDistributionArtifactDigest: D;
  readonly supportClaimSetDigest: string;
  readonly provesReferenceClaimsRemainExactAndOwnerClaimsAreAnAppendOnlyExactBijectionWithQualifiedOwnerRequirements: true;
}

declare function commitPublishedSupportClaimSetV6<const D extends string>(input: {
  readonly referenceClaims: PublishedProductProtocolClaimSetReceiptV6<NoInfer<D>>;
  readonly mandatoryBaseline: GaMandatoryBaselineV3;
  readonly ownerRequirementCompilation: OwnerAdditionalRequirementSetCompilationReceiptV4;
  readonly ownerClaims: readonly PublishedOwnerProductProtocolClaimV6<
    OwnerAdditionalRequirementV4,
    NoInfer<D>
  >[];
  readonly testedDistributionArtifactDigest: D;
}): DeepFrozenCommittedReceiptV1<PublishedSupportClaimSetReceiptV6<D>>;

interface SupportGenerationInputReceiptV4<D extends string = string>
  extends ReceiptRef<"receipt:support-generation-input@4", D> {
  readonly [supportGenerationInputBrandV9]: never;
  readonly referenceRequirementsDigest: string;
  readonly referenceGradeProfileDigest: string;
  readonly gaMatrixCoreDigest: string;
  readonly gaMandatoryBaselineDigest: string;
  readonly gaReleaseEvidenceSetDigest: string;
  readonly distributionArtifactDigest: D;
  readonly registrySnapshotDigest: string;
  readonly liveQualificationReleaseClosureDigest: string;
  readonly platformSecurityProductionClosureDigest: string;
  readonly specialFundingReleaseClosureDigest: string;
  readonly publishedSupportClaimSet: PublishedSupportClaimSetReceiptV6<D>;
  readonly publishedSupportClaimSetDigest: string;
  readonly excludesGeneratedArtifactsReleaseBindingAttestationAndOuterReleaseMetadata: true;
}

declare const generatedSupportArtifactBrandV9: unique symbol;
declare const generatedSupportArtifactSetBrandV9: unique symbol;
declare const releaseEcosystemBindingBrandV9: unique symbol;
declare const releaseEcosystemBindingAttestationBrandV9: unique symbol;
declare const supportGenerationInputBrandV9: unique symbol;
declare const gaEcosystemReleaseEvidenceSetBrandV9: unique symbol;

declare function commitSupportGenerationInputV9<const D extends string>(input: {
  readonly distributionArtifactDigest: D;
  readonly releaseEvidenceSet: GaEcosystemReleaseEvidenceSetV3<D>;
  readonly publishedSupportClaimSet: PublishedSupportClaimSetReceiptV6<D>;
  readonly registryAndManifestScopeEvidence: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<SupportGenerationInputReceiptV4<D>>;

interface GeneratedSupportArtifactReceiptV4<
  K extends GeneratedSupportArtifactKindV4 = GeneratedSupportArtifactKindV4,
  D extends string = string,
> extends ReceiptRef<"receipt:generated-support-artifact@4", readonly [K, D]> {
  readonly [generatedSupportArtifactBrandV9]: never;
  readonly artifactKind: K;
  readonly referenceRequirementsDigest: string;
  readonly referenceGradeProfileDigest: string;
  readonly gaMatrixCoreDigest: string;
  readonly gaMandatoryBaselineDigest: string;
  readonly gaReleaseEvidenceSetDigest: string;
  readonly publishedSupportClaimSetDigest: string;
  readonly generationInput: SupportGenerationInputReceiptV4<D>;
  readonly distributionArtifactDigest: D;
  readonly generatorArtifactDigest: string;
  readonly generatorInputProjectionDigest: string;
  readonly exactGeneratedBytesDigest: string;
  readonly exactGeneratedBytesLength: number;
  readonly generatedArtifactPathDigest: string;
  readonly provesContentIsTotalProjectionWithoutHandMaintainedProviderCapabilityOrMaturityFacts: true;
  readonly provesEveryVisibleProviderProtocolAuthRealmFundingLimitationAndSupportStatementComesFromTheExactPublishedClaimSet: true;
}

type GeneratedSupportArtifactSetV4<D extends string = string> = readonly [
  GeneratedSupportArtifactReceiptV4<"support_page", D>,
  GeneratedSupportArtifactReceiptV4<"connection_picker", D>,
  GeneratedSupportArtifactReceiptV4<"test_matrix", D>,
  GeneratedSupportArtifactReceiptV4<"release_note", D>,
];

interface GeneratedSupportArtifactSetReceiptV4<D extends string = string>
  extends ReceiptRef<"receipt:generated-support-artifact-set@4", D> {
  readonly [generatedSupportArtifactSetBrandV9]: never;
  readonly artifacts: GeneratedSupportArtifactSetV4<D>;
  readonly distributionArtifactDigest: D;
  readonly publishedSupportClaimSet: PublishedSupportClaimSetReceiptV6<D>;
  readonly orderedKinds: readonly [
    "support_page",
    "connection_picker",
    "test_matrix",
    "release_note",
  ];
  readonly artifactSetDigest: string;
  readonly missingKindCount: 0;
  readonly duplicateKindCount: 0;
  readonly crossArtifactInputOrDistributionMismatchCount: 0;
  readonly crossArtifactClaimSetMismatchCount: 0;
  readonly provesKindsAreAnExactKeyedBijectionAndAllInputsEqual: true;
}

declare function generateSupportArtifactV9<
  const K extends GeneratedSupportArtifactKindV4,
  const D extends string,
  const I extends SupportGenerationInputReceiptV4<D>,
>(input: {
  readonly artifactKind: K; readonly generationInput: I;
  readonly generatorArtifact: ImportedOpaqueEvidenceLeafReceipt;
  readonly exactGeneratedBytes: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<GeneratedSupportArtifactReceiptV4<K, D>>;

declare function commitGeneratedSupportArtifactSetV9<const D extends string>(input: {
  readonly artifacts: GeneratedSupportArtifactSetV4<D>;
  readonly publishedSupportClaimSet: PublishedSupportClaimSetReceiptV6<D>;
}): DeepFrozenCommittedReceiptV1<GeneratedSupportArtifactSetReceiptV4<D>>;

interface GaEcosystemReleaseEvidenceSetV3<D extends string = string>
  extends ReceiptRef<"receipt:ga-ecosystem-release-evidence-set@9", D> {
  readonly [gaEcosystemReleaseEvidenceSetBrandV9]: never;
  readonly schemaVersion: "saydo.dev/ga-ecosystem-release-evidence-set/v3";
  readonly gaMatrixCoreDigest: string;
  readonly gaMandatoryBaselineDigest: string;
  readonly referenceGradeProfileDigest: string;
  readonly ownerDecisionEvidenceSetDigest: string;
  readonly distributionArtifactDigest: D;
  readonly requirementsDigest: string;
  readonly exactOracleConformance: DeepFrozenCommittedReceiptV1<ReferenceExactOracleConformanceReceiptV9<D>>;
  readonly referenceRunSubjectDerivation: ReferenceRunSubjectDerivationReceiptV4;
  readonly expectedRequirementKeys: NonEmptyReadonly<ReferenceRequirementKeyV3>;
  readonly actualCompletedRequirementKeys: NonEmptyReadonly<ReferenceRequirementKeyV3>;
  readonly entries: NonEmptyReadonly<GaEntryReleaseEvidenceV2>;
  readonly expectedUserRunSubjectDigests: NonEmptyReadonly<string>;
  readonly expectedPseudoLocaleRunSubjectDigests: NonEmptyReadonly<string>;
  readonly expectedRuntimeRecoveryRunSubjectDigests: NonEmptyReadonly<string>;
  readonly actualUserRunSubjectDigests: NonEmptyReadonly<string>;
  readonly actualPseudoLocaleRunSubjectDigests: NonEmptyReadonly<string>;
  readonly actualRuntimeRecoveryRunSubjectDigests: NonEmptyReadonly<string>;
  readonly runtimeRecoveryEvidence: NonEmptyReadonly<GaRuntimeRecoveryJourneyEvidenceV4>;
  readonly liveQualificationReleaseClosure: GaLiveQualificationReleaseClosureV6<D>;
  readonly platformSecurityProductionClosure: PlatformSecurityProductionClosureV6<D>;
  readonly specialFundingReleaseClosure: SpecialFundingReleaseClosureV6<D>;
  readonly ecosystemGateReport: GaEcosystemGateReportReceipt;
  readonly ecosystemGateAttestation: GaEcosystemGateAttestationReceipt;
  readonly referenceMutationGateReport: GaReferenceMutationGateReportReceipt;
  readonly reviewReadySolution: ReviewReadySupplySolutionReceiptV5<SupplySolutionReceipt, D>;
  readonly provesExactRequiredRequirementEntryJourneyProtocolAuthRealmRecipePlatformAndRunCoverage: true;
  readonly provesEntriesGateReportsAttestationsAndEcosystemGateInputsEqual: true;
  readonly provesConversationReadyRowsAndGlobalReviewReadySolutionAreSeparateExactGates: true;
  readonly provesExactOracleConformanceGateClaimsAndDistributionAreTheSameReleaseSubjects: true;
}

declare function commitGaEcosystemReleaseEvidenceSetV9<const D extends string>(input: {
  readonly distributionArtifactDigest: D;
  readonly exactOracleConformance: DeepFrozenCommittedReceiptV1<ReferenceExactOracleConformanceReceiptV9<D>>;
  readonly exactCompletedJourneyAndRecoveryEvidenceGraph: ImportedOpaqueEvidenceLeafReceipt;
  readonly liveQualificationReleaseClosure: GaLiveQualificationReleaseClosureV6<D>;
  readonly platformSecurityProductionClosure: PlatformSecurityProductionClosureV6<D>;
  readonly specialFundingReleaseClosure: SpecialFundingReleaseClosureV6<D>;
  readonly ecosystemGateAndMutationReports: NonEmptyReadonly<ReceiptRef>;
  readonly reviewReadySolution: ReviewReadySupplySolutionReceiptV5<SupplySolutionReceipt, D>;
}): DeepFrozenCommittedReceiptV1<GaEcosystemReleaseEvidenceSetV3<D>>;

interface ReleaseEcosystemBinding<D extends string = string>
  extends ReceiptRef<"receipt:release-ecosystem-binding@9", D> {
  readonly [releaseEcosystemBindingBrandV9]: never;
  readonly schemaVersion: "saydo.dev/release-ecosystem-binding/v3";
  readonly gaMatrixCoreDigest: string;
  readonly gaMandatoryBaselineDigest: string;
  readonly referenceGradeProfileDigest: string;
  readonly referenceRequirementsDigest: string;
  readonly exactOracleConformance: DeepFrozenCommittedReceiptV1<ReferenceExactOracleConformanceReceiptV9<D>>;
  readonly exactOracleConformanceDigest: string;
  readonly referenceRunSubjectDerivationDigest: string;
  readonly ownerDecisionEvidenceSetDigest: string;
  readonly gaReleaseEvidenceSetDigest: string;
  readonly expectedAndActualRunSubjectSetDigest: string;
  readonly expectedAndActualRequirementKeySetDigest: string;
  readonly ecosystemGateReportDigest: string;
  readonly ecosystemGateAttestationDigest: string;
  readonly referenceMutationGateReportDigest: string;
  readonly liveQualificationReleaseClosure: GaLiveQualificationReleaseClosureV6<D>;
  readonly liveQualificationReleaseClosureDigest: string;
  readonly platformSecurityProductionClosure: PlatformSecurityProductionClosureV6<D>;
  readonly platformSecurityProductionClosureDigest: string;
  readonly specialFundingReleaseClosure: SpecialFundingReleaseClosureV6<D>;
  readonly specialFundingReleaseClosureDigest: string;
  readonly publishedSupportClaimSet: PublishedSupportClaimSetReceiptV6<D>;
  readonly publishedSupportClaimSetDigest: string;
  readonly passiveProbeCapabilitySetDigest: string;
  readonly releaseConformanceBindingSetDigest: string;
  readonly registrySnapshotDigest: string;
  readonly reviewReadySolution: ReviewReadySupplySolutionReceiptV5<SupplySolutionReceipt, D>;
  readonly generatedSupportArtifacts: GeneratedSupportArtifactSetReceiptV4<D>;
  readonly generatedSupportArtifactSetDigest: string;
  readonly distributionArtifactDigest: D;
  readonly manifestScopeDigest: string;
  readonly provesSupportArtifactInputsEvidenceBindingAndDistributionAreExactAndComplete: true;
  readonly provesPublishedClaimsAndAllFourGeneratedArtifactsAreTheSameExactEvidenceBoundProjection: true;
  readonly provesExpectedOracleRegistryConformanceClaimsEvidenceAndDistributionAreTheSameReleaseSubjects: true;
}

interface ReleaseEcosystemBindingAttestation<
  B extends ReleaseEcosystemBinding = ReleaseEcosystemBinding,
> extends ReceiptRef<"receipt:release-ecosystem-binding-attestation@9", B> {
  readonly [releaseEcosystemBindingAttestationBrandV9]: never;
  readonly schemaVersion: "saydo.dev/release-ecosystem-binding-attestation/v1";
  readonly releaseEcosystemBinding: B;
  readonly bindingDigest: B["digest"];
  readonly dsseSubjectDigest: B["digest"];
  readonly provenanceSubjectDigest: B["digest"];
  readonly signatureBundleDigest: string;
}

declare function commitReleaseEcosystemBindingV9<const D extends string>(input: {
  readonly releaseEvidenceSet: GaEcosystemReleaseEvidenceSetV3<D>;
  readonly publishedSupportClaimSet: PublishedSupportClaimSetReceiptV6<D>;
  readonly generatedSupportArtifacts: GeneratedSupportArtifactSetReceiptV4<D>;
  readonly distributionArtifact: ImportedOpaqueEvidenceLeafReceipt;
  readonly canonicalManifestScopeAndRegistryEvidence: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<ReleaseEcosystemBinding<D>>;

declare function attestReleaseEcosystemBindingV9<const B extends ReleaseEcosystemBinding>(input: {
  readonly releaseEcosystemBinding: B;
  readonly independentSigningAndProvenanceAuthority: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<ReleaseEcosystemBindingAttestation<B>>;

type ProtocolConformanceCoreIsReachable = ContractAssert<
  ContractIsNonNever<Extract<ConformanceResultCore, { readonly reportKind: "protocol" }>>
>;
type CapabilityConformanceCoreIsReachable = ContractAssert<
  ContractIsNonNever<Extract<ConformanceResultCore, { readonly reportKind: "capability" }>>
>;
type DiscoveryConformanceCoreIsReachable = ContractAssert<
  ContractIsNonNever<Extract<ConformanceResultCore, { readonly reportKind: "discovery" }>>
>;
type ExecutionConformanceCoreIsReachable = ContractAssert<
  ContractIsNonNever<Extract<ConformanceResultCore, { readonly reportKind: "execution" }>>
>;
type BridgeConformanceCoreIsReachable = ContractAssert<
  ContractIsNonNever<Extract<ConformanceResultCore, { readonly reportKind: "bridge" }>>
>;
type CcSwitchBridgeConformanceCoreIsReachable = ContractAssert<
  ContractIsNonNever<
    ReferenceConformanceCoreForRowV4<ReferenceRowByKeyV3<"cc-switch.proxy.messages">>
  >
>;
type LiteLlmBridgeConformanceCoreIsReachable = ContractAssert<
  ContractIsNonNever<
    ReferenceConformanceCoreForRowV4<ReferenceRowByKeyV3<"litellm.bridge.openai">>
  >
>;
type CcSwitchPublicProxyUsesInferenceDataPlaneProtocolClass = ContractAssert<
  ContractIsNonNever<
    Extract<
      ReferenceConformanceCoreForRowV4<ReferenceRowByKeyV3<"cc-switch.proxy.messages">>,
      { readonly protocolClass: "inference_data_plane" }
    >
  >
>;
type LiteLlmCannotUseBridgeControlProtocolClass = ContractAssert<
  ContractIsNever<
    Extract<
      ReferenceConformanceCoreForRowV4<ReferenceRowByKeyV3<"litellm.bridge.openai">>,
      { readonly protocolClass: "bridge_control" }
    >
  >
>;
type ProtocolCoreCannotCarryDiscoverySubject = ContractAssert<
  ContractIsNever<
    Extract<ConformanceResultCore, { readonly reportKind: "protocol"; readonly detectorIdentityDigest: string }>
  >
>;
type ProviderAgnosticDiscoveryCoreCannotCarryProviderSubject = ContractAssert<
  ContractIsNever<
    Extract<
      ConformanceResultCore,
      { readonly reportKind: "discovery"; readonly discoveryScope: "provider_agnostic"; readonly providerProductId: string }
    >
  >
>;
type ProviderSpecificDiscoveryCoreCannotOmitProviderSubject = ContractAssert<
  ContractIsNever<
    Extract<
      ConformanceResultCore,
      {
        readonly reportKind: "discovery";
        readonly discoveryScope: "provider_specific";
        readonly providerProductId?: never;
      }
    >
  >
>;
type ExecutionCoreCannotCarryModelSubject = ContractAssert<
  ContractIsNever<
    Extract<ConformanceResultCore, { readonly reportKind: "execution"; readonly modelIdentityDigest: string }>
  >
>;
type BridgeCoreCannotCarryModelSubject = ContractAssert<
  ContractIsNever<
    Extract<ConformanceResultCore, { readonly reportKind: "bridge"; readonly modelIdentityDigest: string }>
  >
>;
type BridgeCoreCannotCarryExecutionSurfaceSubject = ContractAssert<
  ContractIsNever<
    Extract<ConformanceResultCore, { readonly reportKind: "bridge"; readonly executionSurfaceIdentityDigest: string }>
  >
>;

type GaInventoryEntryCannotBeRequired = ContractAssert<
  ContractIsNever<
    Extract<GaEcosystemMatrixEntryV2, { readonly requiredForGa: true; readonly ecosystemTier: "inventory" }>
  >
>;
type GaCommunityUnverifiedEntryCannotBeRequired = ContractAssert<
  ContractIsNever<
    Extract<
      GaEcosystemMatrixEntryV2,
      { readonly requiredForGa: true; readonly releaseMaturity: "community_unverified" }
    >
  >
>;
type GaL0EntryCannotBeNonRequired = ContractAssert<
  ContractIsNever<Extract<GaEcosystemMatrixEntryV2, { readonly requiredForGa: false; readonly ecosystemTier: "L0" }>>
>;
type GaAdvancedJourneyDefinitionCannotEnterRequiredRuns = ContractAssert<
  ContractIsNever<Extract<GaJourneyDefinitionV2, { readonly journeyTier: "advanced" }>>
>;
type GaNegativeFixtureCannotMasqueradeAsPositiveDefinition = ContractAssert<
  ContractNot<ContractIsAssignable<GaNegativeJourneyFixtureDefinitionV2, GaJourneyDefinitionV2>>
>;
type GaConnectionReadinessMismatchCannotPass = ContractAssert<
  ContractIsNever<
    Extract<
      GaJourneyPassPayloadV2,
      { readonly expectedConnectionReadiness: "connected_verified"; readonly finalConnectionReadiness: "blocked" }
    >
  >
>;
type GaSolutionReadinessMismatchCannotPass = ContractAssert<
  ContractIsNever<
    Extract<
      GaJourneyPassPayloadV2,
      { readonly expectedSolutionReadiness: "conversation_ready"; readonly finalSolutionReadiness: "blocked" }
    >
  >
>;
type GaSingleRequirementCannotSelfClaimReviewReady = ContractAssert<
  ContractIsNever<Extract<GaJourneyPassPayloadV2, { readonly expectedSolutionReadiness: "review_ready" }>>
>;
type GaCompletedFailCannotCarryPassGate = ContractAssert<
  ContractIsNever<Extract<GaJourneyFailPayloadV2, { readonly perClassUxGate: GaUxPerClassGateReceipt }>>
>;
type GaIncompleteCannotCarryPositiveTerminal = ContractAssert<
  ContractIsNever<
    Extract<GaJourneyIncompletePayloadV2, { readonly positiveTerminalEvidence: BrandedGaPositiveJourneyTerminalEvidenceV4 }>
  >
>;
type GaActionRequiredConnectionCannotPass = ContractAssert<
  ContractIsNever<
    Extract<GaJourneyPassPayloadV2, { readonly finalConnectionReadiness: "action_required" }>
  >
>;
type GaBlockedExecutionCannotPass = ContractAssert<
  ContractIsNever<Extract<GaJourneyPassPayloadV2, { readonly finalExecutionReadiness: "blocked" }>>
>;
type GaActionRequiredControlPlaneCannotPass = ContractAssert<
  ContractIsNever<Extract<GaJourneyPassPayloadV2, { readonly finalControlReadiness: "action_required" }>>
>;
type GaGuidedKeyCannotPassWithEnterpriseUxLimits = ContractAssert<
  ContractIsNever<
    Extract<
      GaJourneyPassPayloadV2,
      {
        readonly journeyDefinition: { readonly journeyClass: "supply"; readonly journeyTier: "guided_key" };
        readonly referenceUxLimits: { readonly limitClass: "enterprise_cloud_or_execution" };
      }
    >
  >
>;
type GaFreshSupplyRunCannotUseReadyAnchorClosure = ContractAssert<
  ContractIsNever<
    Extract<
      GaJourneyRunPayloadV2,
      {
        readonly subject: { readonly startingAnchorState: "not_enrolled" };
        readonly journeyDefinition: { readonly journeyClass: "supply" };
        readonly anchorPrerequisiteClosure: { readonly prerequisiteMode: "already_ready" };
      }
    >
  >
>;
type GaReadyExecutionRunCannotUseFreshEnrollmentClosure = ContractAssert<
  ContractIsNever<
    Extract<
      GaJourneyRunPayloadV2,
      {
        readonly subject: { readonly startingAnchorState: "ready" };
        readonly journeyDefinition: { readonly journeyClass: "execution" };
        readonly anchorPrerequisiteClosure: { readonly prerequisiteMode: "fresh_enrollment_composed" };
      }
    >
  >
>;
type GaClaudeCodeConditionalEntryCannotBeFixedMinimum = ContractAssert<
  ContractNot<
    ContractIsAssignable<"execution.claude-code", ReferenceEntryKeyV3>
  >
>;
type GaHunyuanAndQianfanAreFixedReferenceMinimums = ContractAssert<
  ContractIsAssignable<
    "cn.tencent-hunyuan.api" | "cn.baidu-qianfan.api-v2",
    ReferenceEntryKeyV3
  >
>;
type GaRunGateConnectionMismatchIsImpossible = ContractAssert<
  ContractIsNever<
    Extract<
      GaJourneyRunGateReportReceipt,
      { readonly expectedConnectionReadiness: "connected_verified"; readonly actualConnectionReadiness: "blocked" }
    >
  >
>;
type GaUxPlanIncludesCopyAndLeaveReturnLimits = ContractAssert<
  ContractIsAssignable<
    GaUxPlannedMetricsV2,
    { readonly maximumCopyPasteCount: number; readonly maximumLeaveAndReturnCount: number }
  >
>;
type HostWorkerProfileIncludesPublisherFairnessCaps = ContractAssert<
  ContractIsAssignable<
    HostWorkerBudgetProfileV1,
    {
      readonly coreDetectorReservedWorkerSlots: 2;
      readonly pluginDispatchPoolWorkerSlots: 2;
      readonly coreDetectorReservedQueuePermille: 500;
      readonly pluginCannotBorrowCoreReservedCapacity: true;
      readonly maxQueuedJobsPerPublisher: 64;
      readonly maxQueuedBytesPerPublisher: 16_777_216;
      readonly maxPreparedAttemptsPerPublisher: 16;
      readonly maxRssBytesPerPublisher: 402_653_184;
      readonly maxCpuLogicalCoresPerPublisher: 1;
      readonly maxProcessTreeMembersPerPublisher: 4;
      readonly maxWorkerSlotsPerPublisher: 2;
      readonly dedicatedWorkerSlotsPerPublisher: 0;
      readonly maximumReferenceGuaranteedEligibleDebtGroups: 4;
      readonly minimumContinuouslyEligibleDebtGroupLongRunSharePermilleOfPluginPool: 250;
      readonly publisherFairScheduler: "bounded-service-deficit-round-robin-v2";
      readonly publisherFairSchedulingProfile: PublisherFairSchedulingProfileV1;
      readonly healthyRunningPluginPreemptionForbidden: true;
      readonly publisherQuotaStatePersistsAcrossDaemonRestart: true;
    }
  >
>;

const AI_SUPPLY_DEFINITION_COMPLETE_REQUIREMENTS_V9 = [
  "canonical_and_adr", "typed_connection_protocol_auth", "oauth_and_workload_identity",
  "local_control_anchor_and_tuf", "receipt_dag_and_reference_monitor", "inference_pipeline_and_slo",
  "conformance_runtime_fallback", "execution_effect_once", "connector_sdk_and_external_consumers",
  "reference_ecosystem_coverage", "claim_and_support_artifact_bijection", "local_runtime_cold_start",
  "custom_endpoint_three_protocols", "plugin_isolation", "onboarding_ux_and_accessibility",
  "runtime_child_registry_migration", "strict_contract_compile_budget", "live_account_pool_cleanup",
  "zero_unresolved_review_findings", "offline_release_evidence", "open_source_governance",
] as const;

type AiSupplyDefinitionCompleteRequirementIdV9 = (typeof AI_SUPPLY_DEFINITION_COMPLETE_REQUIREMENTS_V9)[number];
type AiSupplyPhaseIdV9 = "0" | "1" | "1A" | "2" | "3" | "4" | "5" | "6" | "7" | "8";

const AI_SUPPLY_CANONICAL_PHASE_STEP_BOM_V9 = [
  { phaseId: "0", stepId: "canonical-consistency", argv: ["node", "scripts/check-ai-supply-canonical-consistency.mjs"], predecessors: [], enabledScope: "phase_0_through_release", covers: ["canonical_and_adr"] },
  { phaseId: "0", stepId: "strict-contract-compile", argv: ["node", "scripts/check-ai-supply-contract-semantics.mjs"], predecessors: ["canonical-consistency"], enabledScope: "phase_0_through_release", covers: ["strict_contract_compile_budget", "typed_connection_protocol_auth"] },
  { phaseId: "0", stepId: "receipt-dag-authority", argv: ["node", "scripts/check-ai-supply-receipt-dag.mjs"], predecessors: ["strict-contract-compile"], enabledScope: "phase_0_through_release", covers: ["receipt_dag_and_reference_monitor"] },
  { phaseId: "1", stepId: "local-control-and-credential-boundary", argv: ["node", "scripts/run-suite.mjs", "local-control-authorization.tck", "transport-credential-boundary.tck"], predecessors: [], enabledScope: "phase_1_through_release", covers: ["oauth_and_workload_identity"] },
  { phaseId: "1", stepId: "runtime-child-registry-migration", argv: ["node", "scripts/run-suite.mjs", "runtime-child-registry-migration.model"], predecessors: ["local-control-and-credential-boundary"], enabledScope: "phase_1_through_release", covers: ["runtime_child_registry_migration"] },
  { phaseId: "1", stepId: "tuf-root-role-rollback", argv: ["node", "scripts/run-suite.mjs", "tuf-root-role-rollback.tck"], predecessors: ["runtime-child-registry-migration"], enabledScope: "phase_1_through_release", covers: ["local_control_anchor_and_tuf"] },
  { phaseId: "1A", stepId: "platform-security-three-platform-report", argv: ["node", "scripts/run-suite.mjs", "platform-security-production.tck"], predecessors: [], enabledScope: "phase_1A_through_release", covers: ["local_control_anchor_and_tuf", "offline_release_evidence"] },
  { phaseId: "1A", stepId: "witness-three-realm-independence", argv: ["node", "scripts/run-suite.mjs", "anchor-witness-production.tck"], predecessors: ["platform-security-three-platform-report"], enabledScope: "phase_1A_through_release", covers: ["local_control_anchor_and_tuf"] },
  { phaseId: "2", stepId: "three-protocol-wire-tck", argv: ["node", "scripts/run-suite.mjs", "inference-protocol-conformance.tck"], predecessors: [], enabledScope: "phase_2_through_release", covers: ["inference_pipeline_and_slo"] },
  { phaseId: "3", stepId: "funding-rights-runtime-closure", argv: ["node", "scripts/run-suite.mjs", "inference-funding-attempt.model"], predecessors: [], enabledScope: "phase_3_through_release", covers: ["conformance_runtime_fallback"] },
  { phaseId: "4", stepId: "local-runtime-cold-start", argv: ["node", "scripts/run-suite.mjs", "local-runtime-cold-start.tck"], predecessors: [], enabledScope: "phase_4_through_release", covers: ["local_runtime_cold_start"] },
  { phaseId: "5", stepId: "execution-effect-once", argv: ["node", "scripts/run-suite.mjs", "execution-effect-once.model"], predecessors: [], enabledScope: "phase_5_through_release", covers: ["execution_effect_once", "plugin_isolation"] },
  { phaseId: "6", stepId: "journey-ux-accessibility", argv: ["node", "scripts/run-suite.mjs", "realm-and-ga-binding.tck"], predecessors: [], enabledScope: "phase_6_through_release", covers: ["onboarding_ux_and_accessibility"] },
  { phaseId: "7", stepId: "custom-and-enterprise-endpoints", argv: ["node", "scripts/run-suite.mjs", "custom-enterprise-endpoints.tck"], predecessors: [], enabledScope: "phase_7_through_release", covers: ["custom_endpoint_three_protocols"] },
  { phaseId: "8", stepId: "external-sdk-fresh-consumers", argv: ["node", "scripts/run-suite.mjs", "external-connector-consumers.tck"], predecessors: [], enabledScope: "phase_8_and_release", covers: ["connector_sdk_and_external_consumers"] },
  { phaseId: "8", stepId: "provider-test-account-pool", argv: ["node", "scripts/run-suite.mjs", "provider-test-account-pool.model"], predecessors: ["external-sdk-fresh-consumers"], enabledScope: "phase_8_and_release", covers: ["live_account_pool_cleanup"] },
  { phaseId: "8", stepId: "reference-ecosystem-and-claims", argv: ["node", "scripts/run-suite.mjs", "reference-ecosystem-coverage.tck"], predecessors: ["provider-test-account-pool"], enabledScope: "phase_8_and_release", covers: ["reference_ecosystem_coverage", "claim_and_support_artifact_bijection"] },
  { phaseId: "8", stepId: "detached-reviews-zero-findings", argv: ["node", "scripts/check-detached-review-closure.mjs"], predecessors: ["reference-ecosystem-and-claims"], enabledScope: "phase_8_and_release", covers: ["zero_unresolved_review_findings"] },
  { phaseId: "8", stepId: "offline-release-evidence", argv: ["node", "scripts/check-ai-supply-release-evidence.mjs"], predecessors: ["detached-reviews-zero-findings"], enabledScope: "release_only", covers: ["offline_release_evidence", "open_source_governance"] },
] as const satisfies readonly {
  readonly phaseId: AiSupplyPhaseIdV9; readonly stepId: string; readonly argv: NonEmptyReadonly<string>;
  readonly predecessors: readonly string[]; readonly enabledScope: string;
  readonly covers: NonEmptyReadonly<AiSupplyDefinitionCompleteRequirementIdV9>;
}[];

type AiSupplyCanonicalBomCoverageV9 = (typeof AI_SUPPLY_CANONICAL_PHASE_STEP_BOM_V9)[number]["covers"][number];
type AiSupplyBomCoversAllDefinitionCompleteV9 = ContractAssert<
  ContractIsNever<Exclude<AiSupplyDefinitionCompleteRequirementIdV9, AiSupplyCanonicalBomCoverageV9>>
>;

declare const aiSupplySignedExpectedBomBrandV9: unique symbol;
declare const aiSupplyGatePreflightBrandV9: unique symbol;

interface AiSupplySignedExpectedPhaseBomReceiptV9 extends ReceiptRef {
  readonly [aiSupplySignedExpectedBomBrandV9]: never;
  readonly canonicalDefinitionCompleteRequirements: typeof AI_SUPPLY_DEFINITION_COMPLETE_REQUIREMENTS_V9;
  readonly canonicalPhaseStepRows: typeof AI_SUPPLY_CANONICAL_PHASE_STEP_BOM_V9;
  readonly canonicalSourceDigest: string;
  readonly tufTargetAuthorization: TufTargetAuthorizationReceipt;
}

interface AiSupplyGateManifestPreflightReceiptV9 extends ReceiptRef {
  readonly [aiSupplyGatePreflightBrandV9]: never;
  readonly signedExpectedBom: AiSupplySignedExpectedPhaseBomReceiptV9;
  readonly actualVersionedManifestRows: typeof AI_SUPPLY_CANONICAL_PHASE_STEP_BOM_V9;
  readonly missingDuplicateExtraRenamedReorderedOrEarlyDisabledStepCount: 0;
  readonly phaseArgvDigestPredecessorOrEnabledScopeMismatchCount: 0;
  readonly missingOrExtraDefinitionCompleteCoverageEdgeCount: 0;
  readonly executionPermit: "all_expected_steps_exact_start_fail_fast_execution";
}

declare function commitAiSupplyGateManifestPreflightV9(input: {
  readonly signedExpectedBom: AiSupplySignedExpectedPhaseBomReceiptV9;
  readonly rawVersionedManifestBytes: ImportedOpaqueEvidenceLeafReceipt;
  readonly currentCanonicalPhaseSuiteAndDefinitionCompleteBytes: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<AiSupplyGateManifestPreflightReceiptV9>;

interface AiSupplyFailFastOrchestratorTerminalReceiptV9 extends ReceiptRef {
  readonly preflight: AiSupplyGateManifestPreflightReceiptV9;
  readonly exactOrderedStepTerminals: { readonly [I in keyof typeof AI_SUPPLY_CANONICAL_PHASE_STEP_BOM_V9]: ReceiptRef };
  readonly firstFailureStopsAllSuccessors: true;
  readonly everyExpectedStepHasPassedOrNotRunDueToPredecessorFailure: true;
}
