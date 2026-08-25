// ===== 来源:4. 目标架构 / 4.16.8 v20 单一公共真相与根因闭包 =====
// 原文档行 40200-41148 (共 949 行)
type AiSupplyNonUnionV20<T, Whole = T> = T extends Whole
  ? ([Whole] extends [T] ? T : never)
  : never;

type AiSupplySingleLiteralV20<T> = [T] extends [never]
  ? never
  : [T] extends [string]
    ? string extends T
      ? never
      : IsUnionV19<T> extends true
        ? never
        : T
    : IsUnionV19<T> extends true
      ? never
      : T;

declare const exactInvariantIdentityBrandV20: unique symbol;

interface ExactInvariantIdentityReceiptV20<T> extends ReceiptRef<
  "receipt:exact-invariant-identity@20",
  T
> {
  readonly [exactInvariantIdentityBrandV20]: (value: T) => T;
  readonly canonicalValue: CanonicalJsonProjectionV19<T>;
  readonly canonicalValueDigest: ReceiptIdentityDigestV20<
    "receipt:exact-invariant-identity@20",
    T
  >;
  readonly runtimeSchemaAndCanonicalByteEqualityVerified: true;
}

declare function commitExactInvariantIdentityV20<const T>(input: {
  readonly value: T & AiSupplySingleLiteralV20<T>;
  readonly canonicalValueBytes: ImportedOpaqueEvidenceLeafReceipt;
  readonly schemaAndCanonicalEqualityVerifier: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<ExactInvariantIdentityReceiptV20<T>>;

declare const exactTufRootAndTimeAuthorizationBrandV20: unique symbol;
declare const exactTufDelegationPathAuthorizationBrandV20: unique symbol;
declare const exactTufHighWatermarkAdvanceBrandV20: unique symbol;
declare const exactTufTargetAuthorizationBrandV20: unique symbol;

interface ExactTufRootAndTimeAuthorizationReceiptV20<
  R extends TufRepositoryIdentityReceipt,
> extends ReceiptRef<"receipt:exact-tuf-root-and-time-authorization@20", R> {
  readonly [exactTufRootAndTimeAuthorizationBrandV20]: never;
  readonly repositoryIdentity: R;
  readonly trustedBootstrapRootBytes: ImportedOpaqueEvidenceLeafReceipt;
  readonly orderedRootMetadata: NonEmptyReadonly<TufRawMetadataEvidenceReceipt<R, "root">>;
  readonly exactOldAndNewThresholdVerificationTranscripts: readonly ImportedOpaqueEvidenceLeafReceipt[];
  readonly updateStartTrustedTimeEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly updateStartLowerBoundUtc: string;
  readonly updateStartUpperBoundUtc: string;
  readonly finalRootVersion: number;
  readonly finalRootDigest: string;
  readonly predecessorProtectedCounter: number;
  readonly resultingProtectedCounter: number;
  readonly durableSingleSuccessorCasEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly rootVersionsAdvanceExactlyOneAndEveryExpiryUsesThisUpdateStartTime: true;
}

interface ExactTufDelegationPathAuthorizationReceiptV20<
  R extends TufRepositoryIdentityReceipt,
  N extends TufTargetRoleNameV10,
  P extends string,
> extends ReceiptRef<"receipt:exact-tuf-delegation-path-authorization@20", readonly [R, N, P]> {
  readonly [exactTufDelegationPathAuthorizationBrandV20]: never;
  readonly repositoryIdentity: R;
  readonly finalRoleName: N;
  readonly targetPath: P;
  readonly orderedRoleMetadata: NonEmptyReadonly<
    TufRawMetadataEvidenceReceipt<R, "targets" | `delegated:${string}`>
  >;
  readonly orderedParentChildKeyThresholdAndExactPathEvaluationTranscripts: readonly ImportedOpaqueEvidenceLeafReceipt[];
  readonly exactOrderedRoleNameVersionDigestAndExpiryTupleDigest: string;
  readonly pathPatternHashPrefixTerminatingAndRoleOrderRulesAllEvaluatedForThisExactPath: true;
  readonly finalRoleIsTargetsOnlyForEmptyDelegationOtherwiseExactLastAuthorizedChild: true;
}

interface ExactTufHighWatermarkAdvanceReceiptV20<
  R extends TufRepositoryIdentityReceipt,
  N extends TufTargetRoleNameV10,
  P extends string,
> extends ReceiptRef<"receipt:exact-tuf-high-watermark-advance@20", readonly [R, N, P]> {
  readonly [exactTufHighWatermarkAdvanceBrandV20]: never;
  readonly repositoryIdentity: R;
  readonly finalRoleName: N;
  readonly targetPath: P;
  readonly predecessorRevision: number;
  readonly resultingRevision: number;
  readonly exactPredecessorRoleVersionDigestMap: Readonly<Record<TufRoleNameV2, string>>;
  readonly exactResultingRoleVersionDigestMap: Readonly<Record<TufRoleNameV2, string>>;
  readonly currentTimestampSnapshotTargetsAndDelegatedEntryTupleDigest: string;
  readonly protectedCounterAndWriterEpochDigest: string;
  readonly durableSingleSuccessorCasEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly sameVersionDifferentDigestLowerVersionExpiredRoleCrossRepositoryOrMissingDelegatedRoleCount: 0;
}

interface ExactTufTargetAuthorizationReceiptV20<
  R extends TufRepositoryIdentityReceipt,
  N extends TufTargetRoleNameV10,
  P extends string,
  D extends string,
> extends ReceiptRef<"receipt:exact-tuf-target-authorization@20", readonly [R, N, P, D]> {
  readonly [exactTufTargetAuthorizationBrandV20]: never;
  readonly repositoryIdentity: R;
  readonly rootAndTimeAuthorization: ExactTufRootAndTimeAuthorizationReceiptV20<R>;
  readonly timestampMetadata: TufRawMetadataEvidenceReceipt<R, "timestamp">;
  readonly snapshotMetadata: TufRawMetadataEvidenceReceipt<R, "snapshot">;
  readonly delegationPathAuthorization: ExactTufDelegationPathAuthorizationReceiptV20<R, N, P>;
  readonly highWatermarkAdvance: ExactTufHighWatermarkAdvanceReceiptV20<R, N, P>;
  readonly finalRoleName: N;
  readonly targetPath: P;
  readonly targetDigest: D;
  readonly targetLength: number;
  readonly rawTargetBytesEvidence: TufRawTargetBytesEvidenceReceipt<R> & {
    readonly targetPath: P;
    readonly targetDigest: D;
  };
  readonly rootTimestampSnapshotDelegationTargetBytesTrustedTimeAndHighWatermarkAreOneAtomicVerification: true;
  readonly repositoryRolePathDigestLengthExpiryRollbackFreezeOrMixAndMatchMismatchCount: 0;
}

declare function verifyAndCommitExactTufRootAndTimeAuthorizationV20<
  const R extends TufRepositoryIdentityReceipt,
>(input: {
  readonly repositoryIdentity: R;
  readonly trustedBootstrapRootBytes: ImportedOpaqueEvidenceLeafReceipt;
  readonly rawRootRotationLineageEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly orderedRootMetadata: NonEmptyReadonly<TufRawMetadataEvidenceReceipt<R, "root">>;
  readonly exactOldAndNewThresholdVerificationTranscripts: readonly ImportedOpaqueEvidenceLeafReceipt[];
  readonly updateStartTrustedTimeEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly predecessorProtectedCounter: number;
  readonly writerLease: ReferenceMonitorWriterLeaseReceipt;
}): DeepFrozenCommittedReceiptV1<ExactTufRootAndTimeAuthorizationReceiptV20<R>>;

declare function verifyAndCommitExactTufDelegationPathAuthorizationV20<
  const R extends TufRepositoryIdentityReceipt,
  const N extends TufTargetRoleNameV10,
  const P extends string,
>(input: {
  readonly repositoryIdentity: R;
  readonly finalRoleName: N & AiSupplySingleLiteralV20<N>;
  readonly targetPath: P & AiSupplySingleLiteralV20<P>;
  readonly orderedRoleMetadata: NonEmptyReadonly<
    TufRawMetadataEvidenceReceipt<R, "targets" | `delegated:${string}`>
  >;
  readonly orderedParentChildKeyThresholdAndExactPathEvaluationTranscripts: readonly ImportedOpaqueEvidenceLeafReceipt[];
  readonly deterministicDelegationLineageCompiler: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<ExactTufDelegationPathAuthorizationReceiptV20<R, N, P>>;

declare function commitExactTufHighWatermarkAdvanceV20<
  const R extends TufRepositoryIdentityReceipt,
  const N extends TufTargetRoleNameV10,
  const P extends string,
>(input: {
  readonly repositoryIdentity: R;
  readonly finalRoleName: N & AiSupplySingleLiteralV20<N>;
  readonly targetPath: P & AiSupplySingleLiteralV20<P>;
  readonly predecessorHighWatermarkEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly currentTimestampSnapshotTargetsAndDelegatedEntryEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly writerLease: ReferenceMonitorWriterLeaseReceipt;
  readonly expectedPredecessorRevision: number;
}): DeepFrozenCommittedReceiptV1<ExactTufHighWatermarkAdvanceReceiptV20<R, N, P>>;

declare function verifyAndCommitExactTufTargetAuthorizationV20<
  const R extends TufRepositoryIdentityReceipt,
  const N extends TufTargetRoleNameV10,
  const P extends string,
  const D extends string,
>(input: {
  readonly repositoryIdentity: R;
  readonly rootAndTimeAuthorization: ExactTufRootAndTimeAuthorizationReceiptV20<R>;
  readonly timestampMetadata: TufRawMetadataEvidenceReceipt<R, "timestamp">;
  readonly snapshotMetadata: TufRawMetadataEvidenceReceipt<R, "snapshot">;
  readonly delegationPathAuthorization: ExactTufDelegationPathAuthorizationReceiptV20<R, N, P>;
  readonly highWatermarkAdvance: ExactTufHighWatermarkAdvanceReceiptV20<R, N, P>;
  readonly rawTargetBytes: TufRawTargetBytesEvidenceReceipt<R> & {
    readonly targetPath: P;
    readonly targetDigest: D & AiSupplySingleLiteralV20<D>;
  };
  readonly expectedFinalRoleName: N & AiSupplySingleLiteralV20<N>;
  readonly atomicRootMetadataDelegationTargetAndHighWatermarkCommitEvidence: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<ExactTufTargetAuthorizationReceiptV20<
  R,
  N,
  P,
  D
>>;

declare const distributionArtifactIdentityBrandV20: unique symbol;

interface DistributionArtifactIdentityReceiptV20<
  D extends string,
  P extends `distributions/${string}`,
> extends ReceiptRef<"receipt:distribution-artifact-identity@20", readonly [D, P]> {
  readonly [distributionArtifactIdentityBrandV20]: (digest: D) => D;
  readonly distributionArtifactDigest: D;
  readonly targetPath: P;
  readonly exactArtifactBytes: TufRawTargetBytesEvidenceReceipt<TufRepositoryIdentityReceipt<"catalog">> & {
    readonly targetPath: P;
    readonly targetDigest: D;
  };
  readonly targetLength: number;
  readonly targetDigest: D;
  readonly tufTargetAuthorization: ExactTufTargetAuthorizationReceiptV20<
    TufRepositoryIdentityReceipt<"catalog">,
    "delegated:release",
    P,
    D
  >;
  readonly exactDigestIdentity: ExactInvariantIdentityReceiptV20<D>;
  readonly canonicalBytesDigestTufDigestAndDistributionDigestByteEqual: true;
}

declare function commitDistributionArtifactIdentityV20<
  const D extends string,
  const P extends `distributions/${string}`,
>(input: {
  readonly distributionArtifactDigest: D & AiSupplySingleLiteralV20<D>;
  readonly targetPath: P & AiSupplySingleLiteralV20<P>;
  readonly exactArtifactBytes: TufRawTargetBytesEvidenceReceipt<TufRepositoryIdentityReceipt<"catalog">> & {
    readonly targetPath: P;
    readonly targetDigest: D;
  };
  readonly tufTargetAuthorization: ExactTufTargetAuthorizationReceiptV20<
    TufRepositoryIdentityReceipt<"catalog">,
    "delegated:release",
    P,
    D
  >;
  readonly exactDigestIdentity: ExactInvariantIdentityReceiptV20<D>;
}): DeepFrozenCommittedReceiptV1<DistributionArtifactIdentityReceiptV20<D, P>>;

type ReferenceTrustTargetPathV20 =
  | "reference-grade/profile.v20.json"
  | "reference-grade/mandatory-baseline.v20.json"
  | "reference-grade/ecosystem-matrix.v20.json";

type ReferenceTrustTargetDigestMapV20 = {
  readonly [P in ReferenceTrustTargetPathV20]: string;
};

declare const referenceGradeTrustRootBundleBrandV20: unique symbol;

interface ReferenceGradeTrustRootBundleReceiptV20<
  D extends string,
  DP extends `distributions/${string}`,
  M extends ReferenceTrustTargetDigestMapV20,
> extends ReceiptRef<"receipt:reference-grade-trust-root-bundle@20", readonly [D, M]> {
  readonly [referenceGradeTrustRootBundleBrandV20]: never;
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<D, DP>;
  readonly exactTargetDigestMap: M;
  readonly exactTargetAuthorizations: {
    readonly [P in keyof M & ReferenceTrustTargetPathV20]: ExactTufTargetAuthorizationReceiptV20<
      TufRepositoryIdentityReceipt<"catalog">,
      "delegated:release",
      P,
      M[P]
    >;
  };
  readonly exactCanonicalTargetBytes: {
    readonly [P in keyof M & ReferenceTrustTargetPathV20]: TufRawTargetBytesEvidenceReceipt<
      TufRepositoryIdentityReceipt<"catalog">
    > & { readonly targetPath: P; readonly targetDigest: M[P] };
  };
  readonly missingDuplicateExtraCrossRepositoryRolePathDigestOrDistributionCount: 0;
}

declare function commitReferenceGradeTrustRootBundleV20<
  const D extends string,
  const DP extends `distributions/${string}`,
  const M extends ReferenceTrustTargetDigestMapV20,
>(input: {
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<D, DP>;
  readonly exactTargetDigestMap: M;
  readonly exactTargetAuthorizations: ReferenceGradeTrustRootBundleReceiptV20<NoInfer<D>, NoInfer<DP>, M>["exactTargetAuthorizations"];
  readonly exactCanonicalTargetBytes: ReferenceGradeTrustRootBundleReceiptV20<NoInfer<D>, NoInfer<DP>, M>["exactCanonicalTargetBytes"];
  readonly deterministicRequirementsMatrixAndDigestCompiler: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<ReferenceGradeTrustRootBundleReceiptV20<D, DP, M>>;

type ResourceScopeCoreV20 = DistributiveOmitV1<ResourceScopeReceipt, keyof ReceiptRef>;
type EffectiveRouteCoreV20 = DistributiveOmitV1<EffectiveRouteReceipt, keyof ReceiptRef>;

declare const exactResourceScopeBrandV20: unique symbol;
declare const exactEffectiveRouteBrandV20: unique symbol;

interface AnyExactResourceScopeReceiptV20 extends ReceiptRef<
  "receipt:exact-resource-scope@20",
  unknown
> {
  readonly [exactResourceScopeBrandV20]: unknown;
  readonly scope: ResourceScopeCoreV20;
  readonly canonicalScopeBytesDigest: string;
}

interface AnyExactEffectiveRouteReceiptV20 extends ReceiptRef<
  "receipt:exact-effective-route@20",
  unknown
> {
  readonly [exactEffectiveRouteBrandV20]: unknown;
  readonly route: EffectiveRouteCoreV20;
  readonly canonicalRouteBytesDigest: string;
}

interface ExactResourceScopeReceiptV20<
  S extends ResourceScopeCoreV20,
> extends ReceiptRef<"receipt:exact-resource-scope@20", S> {
  readonly [exactResourceScopeBrandV20]: (scope: S) => S;
  readonly scope: S;
  readonly invariantScopeIdentity: ExactInvariantIdentityReceiptV20<S>;
  readonly canonicalScopeBytesDigest: string;
}

interface ExactEffectiveRouteReceiptV20<
  R extends EffectiveRouteCoreV20,
> extends ReceiptRef<"receipt:exact-effective-route@20", R> {
  readonly [exactEffectiveRouteBrandV20]: (route: R) => R;
  readonly route: R;
  readonly invariantRouteIdentity: ExactInvariantIdentityReceiptV20<R>;
  readonly canonicalRouteBytesDigest: string;
}

declare function commitExactResourceScopeV20<const S extends ResourceScopeCoreV20>(input: {
  readonly scope: S & AiSupplySingleLiteralV20<S>;
  readonly invariantScopeIdentity: ExactInvariantIdentityReceiptV20<S>;
  readonly canonicalScopeBytes: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<ExactResourceScopeReceiptV20<S>>;

declare function commitExactEffectiveRouteV20<const R extends EffectiveRouteCoreV20>(input: {
  readonly route: R & AiSupplySingleLiteralV20<R>;
  readonly invariantRouteIdentity: ExactInvariantIdentityReceiptV20<R>;
  readonly canonicalRouteBytes: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<ExactEffectiveRouteReceiptV20<R>>;

interface ExactComputePolicyCoreV20<D extends string> {
  readonly credentialPrincipalDigest: string;
  readonly providerProductId: string;
  readonly providerRealmDigest: string;
  readonly surfaceClass: "inference" | "execution";
  readonly surfaceId: string;
  readonly operation: RightsOperationV8;
  readonly useCase: UseCaseIdV8;
  readonly resourceScope: AnyExactResourceScopeReceiptV20;
  readonly effectiveRoute: AnyExactEffectiveRouteReceiptV20;
  readonly distributionArtifactDigest: D;
  readonly rightsSubject: RightsSubjectV8<string, string, string, RightsOperationV8, UseCaseIdV8, D>;
}

declare const exactComputePolicySubjectBrandV20: unique symbol;

interface ExactComputePolicySubjectReceiptV20<
  S extends ExactComputePolicyCoreV20<D>,
  D extends string,
> extends ReceiptRef<"receipt:exact-compute-policy-subject@20", readonly [S, D]> {
  readonly [exactComputePolicySubjectBrandV20]: (subject: S) => S;
  readonly subject: S;
  readonly distributionArtifactDigest: D;
  readonly invariantSubjectIdentity: ExactInvariantIdentityReceiptV20<S>;
  readonly canonicalSubjectBytesDigest: string;
  readonly rightsSubjectProjectionByteEqual: true;
}

declare function commitExactComputePolicySubjectV20<
  const D extends string,
  const S extends ExactComputePolicyCoreV20<D>,
>(input: {
  readonly subject: S & AiSupplySingleLiteralV20<S>;
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<D, `distributions/${string}`>;
  readonly invariantSubjectIdentity: ExactInvariantIdentityReceiptV20<S>;
  readonly canonicalProjectionAndRightsSubjectEqualityEvidence: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<ExactComputePolicySubjectReceiptV20<S, D>>;

type ComputePolicyComponentKindV20 = "rights" | "network" | "billing" | "data_boundary";

type ComputePolicyComponentRoleV20<K extends ComputePolicyComponentKindV20> =
  K extends "rights" ? "delegated:rights"
    : K extends "network" ? "delegated:network"
      : K extends "billing" ? "delegated:billing"
        : "delegated:data-boundary";

type ComputePolicyComponentTargetPathV20<
  K extends ComputePolicyComponentKindV20,
  S extends ExactComputePolicyCoreV20<string>,
> = `policies/${K}/${S["providerProductId"]}/${string}.v20.json`;

declare const computePolicyComponentBrandV20: unique symbol;
declare const exactPolicyTemporalValidityBrandV20: unique symbol;

interface ExactPolicyTemporalValidityReceiptV20<
  K extends ComputePolicyComponentKindV20,
  S extends ExactComputePolicyCoreV20<D>,
  D extends string,
  P extends ComputePolicyComponentTargetPathV20<K, S>,
  TD extends string,
> extends ReceiptRef<"receipt:exact-policy-temporal-validity@20", readonly [K, S, D, P, TD]> {
  readonly [exactPolicyTemporalValidityBrandV20]: never;
  readonly componentKind: K;
  readonly subject: ExactComputePolicySubjectReceiptV20<S, D>;
  readonly policyTargetAuthorization: ExactTufTargetAuthorizationReceiptV20<
    TufRepositoryIdentityReceipt<"policy">,
    ComputePolicyComponentRoleV20<K>,
    P,
    TD
  >;
  readonly evaluatedAtRootAndTimeAuthorization: ExactTufRootAndTimeAuthorizationReceiptV20<
    TufRepositoryIdentityReceipt<"policy">
  >;
  readonly policyNotBefore: string;
  readonly policyNotAfter: string;
  readonly evaluatedLowerBoundUtc: string;
  readonly evaluatedUpperBoundUtc: string;
  readonly outcome: "valid";
  readonly exactTargetExpirySubjectDistributionAndUpdateStartTimeComparisonDigest: string;
}

declare function commitExactPolicyTemporalValidityV20<
  const K extends ComputePolicyComponentKindV20,
  const S extends ExactComputePolicyCoreV20<D>,
  const D extends string,
  const P extends ComputePolicyComponentTargetPathV20<K, S>,
  const TD extends string,
>(input: {
  readonly componentKind: K & AiSupplySingleLiteralV20<K>;
  readonly subject: ExactComputePolicySubjectReceiptV20<S, D>;
  readonly policyTargetAuthorization: ExactTufTargetAuthorizationReceiptV20<
    TufRepositoryIdentityReceipt<"policy">,
    ComputePolicyComponentRoleV20<K>,
    P,
    TD
  >;
  readonly canonicalPolicyTargetBytes: TufRawTargetBytesEvidenceReceipt<TufRepositoryIdentityReceipt<"policy">> & {
    readonly targetPath: P;
    readonly targetDigest: TD;
  };
  readonly exactExpirySubjectDistributionAndTrustedTimeComparison: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<ExactPolicyTemporalValidityReceiptV20<K, S, D, P, TD>>;

interface ComputePolicyComponentReceiptV20<
  K extends ComputePolicyComponentKindV20,
  S extends ExactComputePolicyCoreV20<D>,
  D extends string,
  P extends ComputePolicyComponentTargetPathV20<K, S>,
  TD extends string,
> extends ReceiptRef<"receipt:compute-policy-component@20", readonly [K, S, D, P, TD]> {
  readonly [computePolicyComponentBrandV20]: K;
  readonly componentKind: K;
  readonly subject: ExactComputePolicySubjectReceiptV20<S, D>;
  readonly distributionArtifactDigest: D;
  readonly policyTargetAuthorization: ExactTufTargetAuthorizationReceiptV20<
    TufRepositoryIdentityReceipt<"policy">,
    ComputePolicyComponentRoleV20<K>,
    P,
    TD
  >;
  readonly canonicalPolicyTargetBytes: TufRawTargetBytesEvidenceReceipt<TufRepositoryIdentityReceipt<"policy">> & {
    readonly targetPath: P;
    readonly targetDigest: TD;
  };
  readonly temporalValidity: ExactPolicyTemporalValidityReceiptV20<K, S, D, P, TD>;
  readonly canonicalPolicyProjectionDigest: string;
  readonly rootTimestampSnapshotDelegationTargetBytesTimeAndHighWatermarkRemainTraversable: true;
}

declare function commitComputePolicyComponentV20<
  const K extends ComputePolicyComponentKindV20,
  const S extends ExactComputePolicyCoreV20<D>,
  const D extends string,
  const P extends ComputePolicyComponentTargetPathV20<K, S>,
  const TD extends string,
>(input: Omit<
  ComputePolicyComponentReceiptV20<K, S, D, P, TD>,
  keyof ReceiptRef | typeof computePolicyComponentBrandV20
>): DeepFrozenCommittedReceiptV1<ComputePolicyComponentReceiptV20<K, S, D, P, TD>>;

declare const pricedOfficialRightsBrandV20: unique symbol;
declare const customRightsBrandV20: unique symbol;
declare const officialUnknownRightsBrandV20: unique symbol;

interface ExactPricedOfficialRightsReceiptV20<
  S extends ExactComputePolicyCoreV20<D>,
  D extends string,
  R extends ComputePolicyComponentReceiptV20<
    "rights",
    S,
    D,
    ComputePolicyComponentTargetPathV20<"rights", S>,
    string
  >,
> extends ReceiptRef<"receipt:exact-priced-official-rights@20", readonly [S, D, R]> {
  readonly [pricedOfficialRightsBrandV20]: never;
  readonly subject: ExactComputePolicySubjectReceiptV20<S, D>;
  readonly rightsPolicy: R;
  readonly productEligibility: Extract<ProductEligibilityReceipt, { readonly status: "eligible" }>;
  readonly decision: "allowed" | "official_surface_only";
  readonly exactEndpointProductPrincipalUseOperationRealmRouteResourceDistributionAndTufPolicyEqual: true;
  readonly customOrUnknownEligibilityAcceptedCount: 0;
}

declare function commitExactPricedOfficialRightsV20<
  const S extends ExactComputePolicyCoreV20<D>,
  const D extends string,
  const R extends ComputePolicyComponentReceiptV20<
    "rights",
    S,
    D,
    ComputePolicyComponentTargetPathV20<"rights", S>,
    string
  >,
>(input: {
  readonly subject: ExactComputePolicySubjectReceiptV20<S, D>;
  readonly rightsPolicy: R;
  readonly productEligibility: Extract<ProductEligibilityReceipt, { readonly status: "eligible" }>;
  readonly legacyAllowedDecisionToReverify: AllowedRightsReceipt<S["rightsSubject"]>;
  readonly canonicalPolicyEligibilityDecisionAndAllAxisEqualityEvidence: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<ExactPricedOfficialRightsReceiptV20<S, D, R>>;

interface ExactCustomRightsReceiptV20<
  S extends ExactComputePolicyCoreV20<D>,
  D extends string,
> extends ReceiptRef<"receipt:exact-custom-rights@20", readonly [S, D]> {
  readonly [customRightsBrandV20]: never;
  readonly subject: ExactComputePolicySubjectReceiptV20<S, D>;
  readonly productEligibility: Extract<ProductEligibilityReceipt, { readonly status: "user_or_admin_attested_custom" }>;
  readonly attestingAuthority: "resource_owner" | "organization_admin";
  readonly exactEndpointProductPrincipalUseOperationRealmRouteResourceAndDistributionEqual: true;
  readonly permitsOnlyExplicitPerInvocationUse: true;
  readonly recommendationFallbackEvaluatorBackgroundAndUnattendedUseForbidden: true;
}

interface ExactOfficialUnknownRightsReceiptV20<
  S extends ExactComputePolicyCoreV20<D>,
  D extends string,
> extends ReceiptRef<"receipt:exact-official-unknown-rights@20", readonly [S, D]> {
  readonly [officialUnknownRightsBrandV20]: never;
  readonly subject: ExactComputePolicySubjectReceiptV20<S, D>;
  readonly productEligibility: Extract<ProductEligibilityReceipt, { readonly status: "eligible" }>;
  readonly exactOfficialEnterpriseSurfaceEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly priceCreditsCostCenterOrHardCapUnknown: true;
  readonly exactEndpointProductPrincipalUseOperationRealmRouteResourceAndDistributionEqual: true;
  readonly permitsOnlyExplicitPerInvocationUse: true;
  readonly recommendationFallbackEvaluatorBackgroundAndUnattendedUseForbidden: true;
}

declare function commitExactCustomRightsV20<
  const S extends ExactComputePolicyCoreV20<D>,
  const D extends string,
>(input: {
  readonly subject: ExactComputePolicySubjectReceiptV20<S, D>;
  readonly productEligibility: Extract<ProductEligibilityReceipt, { readonly status: "user_or_admin_attested_custom" }>;
  readonly acceptedOwnerOrAdminDecision: AcceptedUserDecisionReceipt;
  readonly canonicalAllAxisEqualityEvidence: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<ExactCustomRightsReceiptV20<S, D>>;

declare function commitExactOfficialUnknownRightsV20<
  const S extends ExactComputePolicyCoreV20<D>,
  const D extends string,
>(input: {
  readonly subject: ExactComputePolicySubjectReceiptV20<S, D>;
  readonly productEligibility: Extract<ProductEligibilityReceipt, { readonly status: "eligible" }>;
  readonly exactOfficialEnterpriseSurfaceEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly canonicalAllAxisEqualityEvidence: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<ExactOfficialUnknownRightsReceiptV20<S, D>>;

type ComputePolicyModeV20 = "priced_official" | "unknown_custom" | "unknown_official";

declare const exactComputePolicyBindingBrandV20: unique symbol;

type ExactComputePolicyBindingReceiptV20<
  M extends ComputePolicyModeV20,
  S extends ExactComputePolicyCoreV20<D>,
  D extends string,
  R extends ComputePolicyComponentReceiptV20<"rights", S, D, ComputePolicyComponentTargetPathV20<"rights", S>, string>,
  N extends ComputePolicyComponentReceiptV20<"network", S, D, ComputePolicyComponentTargetPathV20<"network", S>, string>,
  B extends ComputePolicyComponentReceiptV20<"billing", S, D, ComputePolicyComponentTargetPathV20<"billing", S>, string>,
  DB extends ComputePolicyComponentReceiptV20<"data_boundary", S, D, ComputePolicyComponentTargetPathV20<"data_boundary", S>, string>,
> = ReceiptRef<"receipt:exact-compute-policy-binding@20", readonly [M, S, D]> & {
  readonly [exactComputePolicyBindingBrandV20]: (subject: S) => S;
  readonly mode: M;
  readonly subject: ExactComputePolicySubjectReceiptV20<S, D>;
  readonly rightsPolicy: R;
  readonly networkPolicy: N;
  readonly billingPolicy: B;
  readonly dataBoundaryPolicy: DB;
  readonly exactComponentSetDigest: string;
  readonly allFourTufChainsAndCanonicalSubjectsRemainTraversableAndByteEqual: true;
} & (
  M extends "priced_official"
    ? {
        readonly rightsDecision: ExactPricedOfficialRightsReceiptV20<S, D, R>;
        readonly automaticRecommendationFallbackEvaluatorAndBackgroundUse: "allowed_only_by_exact_funding_and_use_case_policy";
      }
    : M extends "unknown_custom"
      ? {
          readonly rightsDecision: ExactCustomRightsReceiptV20<S, D>;
          readonly automaticRecommendationFallbackEvaluatorAndBackgroundUse: "forbidden";
        }
      : {
          readonly rightsDecision: ExactOfficialUnknownRightsReceiptV20<S, D>;
          readonly automaticRecommendationFallbackEvaluatorAndBackgroundUse: "forbidden";
        }
);

interface AnyExactComputePolicySubjectReceiptV20 extends ReceiptRef<
  "receipt:exact-compute-policy-subject@20",
  unknown
> {
  readonly subject: ExactComputePolicyCoreV20<string>;
  readonly distributionArtifactDigest: string;
}

type ExactComputePolicyCoreOfSubjectReceiptV20<
  SR extends AnyExactComputePolicySubjectReceiptV20,
> = SR["subject"];
type ExactComputePolicyDistributionOfSubjectReceiptV20<
  SR extends AnyExactComputePolicySubjectReceiptV20,
> = SR["distributionArtifactDigest"];
type ExactComputePolicyBoundCoreOfSubjectReceiptV20<
  SR extends AnyExactComputePolicySubjectReceiptV20,
> = ExactComputePolicyCoreOfSubjectReceiptV20<SR> & ExactComputePolicyCoreV20<
  ExactComputePolicyDistributionOfSubjectReceiptV20<SR>
>;

declare function commitExactComputePolicyBindingV20<
  const M extends ComputePolicyModeV20,
  const SR extends AnyExactComputePolicySubjectReceiptV20,
  const R extends ComputePolicyComponentReceiptV20<
    "rights",
    ExactComputePolicyBoundCoreOfSubjectReceiptV20<SR>,
    ExactComputePolicyDistributionOfSubjectReceiptV20<SR>,
    ComputePolicyComponentTargetPathV20<"rights", ExactComputePolicyBoundCoreOfSubjectReceiptV20<SR>>,
    string
  >,
  const N extends ComputePolicyComponentReceiptV20<
    "network",
    ExactComputePolicyBoundCoreOfSubjectReceiptV20<SR>,
    ExactComputePolicyDistributionOfSubjectReceiptV20<SR>,
    ComputePolicyComponentTargetPathV20<"network", ExactComputePolicyBoundCoreOfSubjectReceiptV20<SR>>,
    string
  >,
  const B extends ComputePolicyComponentReceiptV20<
    "billing",
    ExactComputePolicyBoundCoreOfSubjectReceiptV20<SR>,
    ExactComputePolicyDistributionOfSubjectReceiptV20<SR>,
    ComputePolicyComponentTargetPathV20<"billing", ExactComputePolicyBoundCoreOfSubjectReceiptV20<SR>>,
    string
  >,
  const DB extends ComputePolicyComponentReceiptV20<
    "data_boundary",
    ExactComputePolicyBoundCoreOfSubjectReceiptV20<SR>,
    ExactComputePolicyDistributionOfSubjectReceiptV20<SR>,
    ComputePolicyComponentTargetPathV20<"data_boundary", ExactComputePolicyBoundCoreOfSubjectReceiptV20<SR>>,
    string
  >,
>(input: {
  readonly mode: M & AiSupplySingleLiteralV20<M>;
  readonly subject: SR;
  readonly rightsPolicy: R;
  readonly networkPolicy: N;
  readonly billingPolicy: B;
  readonly dataBoundaryPolicy: DB;
  readonly rightsDecision: M extends "priced_official"
    ? ExactPricedOfficialRightsReceiptV20<
        ExactComputePolicyBoundCoreOfSubjectReceiptV20<NoInfer<SR>>,
        ExactComputePolicyDistributionOfSubjectReceiptV20<NoInfer<SR>>,
        NoInfer<R>
      >
    : M extends "unknown_custom"
      ? ExactCustomRightsReceiptV20<
          ExactComputePolicyBoundCoreOfSubjectReceiptV20<NoInfer<SR>>,
          ExactComputePolicyDistributionOfSubjectReceiptV20<NoInfer<SR>>
        >
      : ExactOfficialUnknownRightsReceiptV20<
          ExactComputePolicyBoundCoreOfSubjectReceiptV20<NoInfer<SR>>,
          ExactComputePolicyDistributionOfSubjectReceiptV20<NoInfer<SR>>
        >;
  readonly exactCanonicalComponentSetAndSubjectByteEqualityEvidence: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<ExactComputePolicyBindingReceiptV20<
  M,
  ExactComputePolicyBoundCoreOfSubjectReceiptV20<SR>,
  ExactComputePolicyDistributionOfSubjectReceiptV20<SR>,
  R,
  N,
  B,
  DB
>>;

declare const rightsBlockedDomainSubjectBrandV20: unique symbol;
declare const rightsBlockedActionBrandV20: unique symbol;
declare const exactLocalControlSessionBrandV20: unique symbol;

type LocalControlSessionCoreV20 = DistributiveOmitV1<LocalControlSessionReceipt, keyof ReceiptRef>;

interface AnyExactLocalControlSessionReceiptV20 extends ReceiptRef<
  "receipt:exact-local-control-session@20",
  unknown
> {
  readonly [exactLocalControlSessionBrandV20]: unknown;
  readonly session: LocalControlSessionCoreV20;
  readonly canonicalSessionIdentityDigest: string;
}

interface ExactLocalControlSessionReceiptV20<
  L extends LocalControlSessionCoreV20,
> extends ReceiptRef<"receipt:exact-local-control-session@20", L> {
  readonly [exactLocalControlSessionBrandV20]: (session: L) => L;
  readonly session: L;
  readonly canonicalSessionIdentityDigest: string;
  readonly originHostWebSocketCsrfChannelBindingExpiryAndDistributionVerified: true;
}

declare function commitExactLocalControlSessionV20<
  const L extends LocalControlSessionCoreV20,
>(input: {
  readonly legacySessionToReverify: LocalControlSessionReceipt & L;
  readonly canonicalSessionBytes: ImportedOpaqueEvidenceLeafReceipt;
  readonly currentDistributionOriginHostWebSocketCsrfAndChannelBindingEvidence: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<ExactLocalControlSessionReceiptV20<L>>;

interface RightsBlockedDomainSubjectReceiptV20<
  S extends ExactComputePolicyCoreV20<D>,
  D extends string,
  E extends BlockedRightsDecisionReceiptV9<S["rightsSubject"]>,
  L extends AnyExactLocalControlSessionReceiptV20 = AnyExactLocalControlSessionReceiptV20,
> extends ReceiptRef<"receipt:rights-blocked-domain-subject@20", readonly [S, D, E, L]> {
  readonly [rightsBlockedDomainSubjectBrandV20]: never;
  readonly subject: ExactComputePolicySubjectReceiptV20<S, D>;
  readonly exactRightsPolicy: ComputePolicyComponentReceiptV20<
    "rights",
    S,
    D,
    ComputePolicyComponentTargetPathV20<"rights", S>,
    string
  >;
  readonly exactBlockedRightsEvidence: E;
  readonly currentLocalControlSession: L;
  readonly generation: number;
  readonly expiresAt: string;
}

declare function commitRightsBlockedDomainSubjectV20<
  const S extends ExactComputePolicyCoreV20<D>,
  const D extends string,
  const E extends BlockedRightsDecisionReceiptV9<S["rightsSubject"]>,
  const L extends AnyExactLocalControlSessionReceiptV20,
>(input: {
  readonly subject: ExactComputePolicySubjectReceiptV20<S, D>;
  readonly exactRightsPolicy: ComputePolicyComponentReceiptV20<
    "rights",
    S,
    D,
    ComputePolicyComponentTargetPathV20<"rights", S>,
    string
  >;
  readonly exactBlockedRightsEvidence: E;
  readonly currentLocalControlSession: L;
  readonly currentGenerationAndExpiryEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly exactSubjectEvidenceSessionGenerationAndDistributionEqualityEvidence: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<RightsBlockedDomainSubjectReceiptV20<S, D, E, L>>;

interface AnyRightsBlockedDomainSubjectReceiptV20 extends ReceiptRef<
  "receipt:rights-blocked-domain-subject@20",
  unknown
> {
  readonly [rightsBlockedDomainSubjectBrandV20]: never;
  readonly subject: ReceiptRef<"receipt:exact-compute-policy-subject@20", unknown>;
  readonly exactRightsPolicy: ReceiptRef<"receipt:compute-policy-component@20", unknown>;
  readonly exactBlockedRightsEvidence: ReceiptRef<"receipt:exact-rights-decision@9", unknown> & {
    readonly status: "unknown" | "forbidden";
    readonly blockedReasonCode:
      | "insufficient_current_official_evidence"
      | "official_policy_forbids_exact_subject";
  };
  readonly currentLocalControlSession: AnyExactLocalControlSessionReceiptV20;
  readonly generation: number;
  readonly expiresAt: string;
}

interface RightsBlockedPrimaryActionReceiptV20<
  DS extends AnyRightsBlockedDomainSubjectReceiptV20,
> extends ReceiptRef<"receipt:rights-blocked-primary-action@20", DS> {
  readonly [rightsBlockedActionBrandV20]: never;
  readonly domainSubject: DS;
  readonly exactEvidence: DS["exactBlockedRightsEvidence"];
  readonly actionKind: DS["exactBlockedRightsEvidence"]["status"] extends "forbidden"
    ? "show_official_scope_or_safe_alternative"
    : "show_current_policy_evidence_or_safe_alternative";
  readonly crossSubjectProductPrincipalRealmCredentialUseOperationGenerationOrDistributionAttachmentCount: 0;
}

declare function resolveRightsBlockedPrimaryActionV20<
  const DS extends AnyRightsBlockedDomainSubjectReceiptV20,
>(input: {
  readonly domainSubject: DS;
  readonly currentTimeAndSingleUseActionNonce: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<RightsBlockedPrimaryActionReceiptV20<DS>>;

declare const protocolImplementationBrandV20: unique symbol;
declare const conformanceCoreBrandV20: unique symbol;
declare const conformanceRunPayloadBrandV20: unique symbol;
declare const conformanceAttestationBrandV20: unique symbol;
declare const conformanceReleaseBindingBrandV20: unique symbol;

interface ProtocolImplementationIdentityReceiptV20<
  P extends InferenceProtocolId,
  D extends string,
  DP extends `distributions/${string}`,
> extends ReceiptRef<"receipt:protocol-implementation-identity@20", readonly [P, D]> {
  readonly [protocolImplementationBrandV20]: (protocol: P) => P;
  readonly protocolId: P;
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<D, DP>;
  readonly implementationArtifactDigest: D;
  readonly publicEntryPointDigest: string;
}

interface AnyProtocolImplementationIdentityReceiptV20 extends ReceiptRef<
  "receipt:protocol-implementation-identity@20",
  unknown
> {
  readonly protocolId: InferenceProtocolId;
  readonly distributionIdentity: ReceiptRef<"receipt:distribution-artifact-identity@20", unknown> & {
    readonly distributionArtifactDigest: string;
    readonly targetPath: `distributions/${string}`;
  };
  readonly implementationArtifactDigest: string;
  readonly publicEntryPointDigest: string;
}

declare function commitProtocolImplementationIdentityV20<
  const P extends InferenceProtocolId,
  const D extends string,
  const DP extends `distributions/${string}`,
>(input: {
  readonly protocolId: P & AiSupplySingleLiteralV20<P>;
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<D, DP>;
  readonly exactPublicEntryPointAndArtifactProjection: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<ProtocolImplementationIdentityReceiptV20<P, D, DP>>;

interface ProtocolConformanceCoreReceiptV20<
  I extends AnyProtocolImplementationIdentityReceiptV20,
> extends ReceiptRef<"receipt:protocol-conformance-core@20", I> {
  readonly [conformanceCoreBrandV20]: (implementation: I) => I;
  readonly implementation: I;
  readonly protocolId: I["protocolId"];
  readonly semanticSubject: ProtocolConformanceSemanticSubject<I["protocolId"], "inference">;
  readonly distributionIdentity: I["distributionIdentity"];
  readonly exactFixtureSetDigest: string;
  readonly deterministicCoreDigest: string;
}

declare function commitProtocolConformanceCoreV20<
  const I extends AnyProtocolImplementationIdentityReceiptV20,
>(input: {
  readonly implementation: I;
  readonly semanticSubject: ProtocolConformanceSemanticSubject<NoInfer<I>["protocolId"], "inference">;
  readonly distributionIdentity: NoInfer<I>["distributionIdentity"];
  readonly exactFixtureSet: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<ProtocolConformanceCoreReceiptV20<I>>;

interface AnyProtocolConformanceCoreReceiptV20 extends ReceiptRef<
  "receipt:protocol-conformance-core@20",
  unknown
> {
  readonly implementation: AnyProtocolImplementationIdentityReceiptV20;
  readonly protocolId: InferenceProtocolId;
  readonly distributionIdentity: ReceiptRef<"receipt:distribution-artifact-identity@20", unknown>;
  readonly exactFixtureSetDigest: string;
  readonly deterministicCoreDigest: string;
}

interface ConformanceRunPayloadReceiptV20<
  C extends AnyProtocolConformanceCoreReceiptV20,
> extends ReceiptRef<"receipt:conformance-run-payload@20", C> {
  readonly [conformanceRunPayloadBrandV20]: never;
  readonly core: C;
  readonly implementation: C["implementation"];
  readonly distributionIdentity: C["distributionIdentity"];
  readonly exactCompletedFixtureSetDigest: C["exactFixtureSetDigest"];
  readonly rawRunEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly outcome: "completed_pass";
  readonly exitCode: 0;
}

declare function commitConformanceRunPayloadV20<
  const C extends AnyProtocolConformanceCoreReceiptV20,
>(input: {
  readonly core: C;
  readonly exactCompletedFixtureSetDigest: NoInfer<C>["exactFixtureSetDigest"];
  readonly rawRunEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly runnerArtifactEnvironmentSeedAndInvocation: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<ConformanceRunPayloadReceiptV20<C>>;

interface AnyConformanceRunPayloadReceiptV20 extends ReceiptRef<
  "receipt:conformance-run-payload@20",
  unknown
> {
  readonly core: AnyProtocolConformanceCoreReceiptV20;
  readonly implementation: AnyProtocolImplementationIdentityReceiptV20;
  readonly distributionIdentity: ReceiptRef<"receipt:distribution-artifact-identity@20", unknown>;
  readonly exactCompletedFixtureSetDigest: string;
  readonly outcome: "completed_pass";
  readonly exitCode: 0;
}

interface ConformanceAttestationReceiptV20<
  P extends AnyConformanceRunPayloadReceiptV20,
> extends ReceiptRef<"receipt:conformance-attestation@20", P> {
  readonly [conformanceAttestationBrandV20]: never;
  readonly runPayload: P;
  readonly payloadDigest: P["digest"];
  readonly distributionIdentity: P["distributionIdentity"];
  readonly slsaProvenance: ImportedOpaqueEvidenceLeafReceipt;
  readonly dsseAndSigstoreBundle: ImportedOpaqueEvidenceLeafReceipt;
  readonly provenanceAndSignatureSubjectEqualExactPayloadDigest: true;
}

declare function commitConformanceAttestationV20<
  const P extends AnyConformanceRunPayloadReceiptV20,
>(input: {
  readonly runPayload: P;
  readonly slsaProvenance: ImportedOpaqueEvidenceLeafReceipt;
  readonly dsseAndSigstoreBundle: ImportedOpaqueEvidenceLeafReceipt;
  readonly trustedBuilderIssuerRepositoryWorkflowAndArtifactVerifier: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<ConformanceAttestationReceiptV20<P>>;

interface ReleaseConformanceBindingReceiptV20<
  C extends AnyProtocolConformanceCoreReceiptV20,
  P extends ConformanceRunPayloadReceiptV20<C>,
  A extends ConformanceAttestationReceiptV20<P>,
> extends ReceiptRef<"receipt:release-conformance-binding@20", readonly [C, P, A]> {
  readonly [conformanceReleaseBindingBrandV20]: never;
  readonly core: C;
  readonly implementation: C["implementation"];
  readonly runPayload: P;
  readonly attestation: A;
  readonly distributionIdentity: C["distributionIdentity"];
  readonly payloadAttestationImplementationCoreAndDistributionAreOneExactChain: true;
}

declare function commitReleaseConformanceBindingV20<
  const C extends AnyProtocolConformanceCoreReceiptV20,
  const P extends ConformanceRunPayloadReceiptV20<C>,
  const A extends ConformanceAttestationReceiptV20<P>,
>(input: {
  readonly core: C;
  readonly runPayload: P;
  readonly attestation: A;
  readonly canonicalEqualityVerifier: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<ReleaseConformanceBindingReceiptV20<C, P, A>>;

// ===== 来源:4. 目标架构 / 4.16.8 v20 单一公共真相与根因闭包 =====
// 原文档行 41154-41886 (共 733 行)
declare const physicalAttemptAuthorityBindingBrandV20: unique symbol;
declare const physicalAttemptSubjectBrandV20: unique symbol;
declare const physicalAttemptTerminalBrandV20: unique symbol;

interface PhysicalAttemptAuthorityBindingReceiptV20<
  Domain extends PhysicalAttemptDomainV19,
  D extends string,
  DP extends `distributions/${string}`,
  L extends AuthorityInventoryBearingLease,
  CP extends ReceiptRef<"receipt:exact-compute-policy-binding@20", unknown>,
> extends ReceiptRef<"receipt:physical-attempt-authority-binding@20", readonly [Domain, D, L, CP]> {
  readonly [physicalAttemptAuthorityBindingBrandV20]: (lease: L) => L;
  readonly domain: Domain;
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<D, DP>;
  readonly exactDomainLease: L;
  readonly exactIntentOrPreIntentCursor: ReceiptRef<
    "receipt:physical-attempt-intent-cursor@20",
    readonly [Domain, D, L]
  >;
  readonly exactComputePolicyBinding: CP;
  readonly exactLeaseIntentCursorPolicySubjectDigest: string;
}

declare function commitPhysicalAttemptAuthorityBindingV20<
  const Domain extends PhysicalAttemptDomainV19,
  const D extends string,
  const DP extends `distributions/${string}`,
  const L extends AuthorityInventoryBearingLease,
  const CP extends ReceiptRef<"receipt:exact-compute-policy-binding@20", unknown>,
>(input: {
  readonly domain: Domain & AiSupplySingleLiteralV20<Domain>;
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<D, DP>;
  readonly exactDomainLease: L;
  readonly exactIntentOrPreIntentCursor: ReceiptRef<
    "receipt:physical-attempt-intent-cursor@20",
    readonly [Domain, D, L]
  >;
  readonly exactComputePolicyBinding: CP;
  readonly authorityRegistry: AuthorityLeaseRegistryGeneratedArtifactReceiptV6;
  readonly receiptEdgeManifest: ReceiptRef<"receipt:receipt-edge-manifest@20">;
}): DeepFrozenCommittedReceiptV1<PhysicalAttemptAuthorityBindingReceiptV20<Domain, D, DP, L, CP>>;

type PhysicalFallbackStartRefV20 = ReceiptRef<"receipt:fallback-attempt-start@20", unknown>;

type PhysicalAttemptAuthorityDomainOfV20<
  A extends ReceiptRef<"receipt:physical-attempt-authority-binding@20", unknown>,
> = A extends PhysicalAttemptAuthorityBindingReceiptV20<infer Domain, infer _D, infer _DP, infer _L, infer _CP>
  ? Domain
  : never;
type PhysicalAttemptAuthorityDistributionOfV20<
  A extends ReceiptRef<"receipt:physical-attempt-authority-binding@20", unknown>,
> = A extends PhysicalAttemptAuthorityBindingReceiptV20<infer _Domain, infer D, infer DP, infer _L, infer _CP>
  ? DistributionArtifactIdentityReceiptV20<D, DP>
  : never;
type PhysicalAttemptAuthorityLeaseOfV20<
  A extends ReceiptRef<"receipt:physical-attempt-authority-binding@20", unknown>,
> = A extends PhysicalAttemptAuthorityBindingReceiptV20<infer _Domain, infer _D, infer _DP, infer L, infer _CP>
  ? L
  : never;
type FallbackAttemptLeaseOfStartV20<
  F extends PhysicalFallbackStartRefV20,
> = F extends FallbackAttemptStartCommitV20<infer _S, infer _R, infer L> ? L : never;
type PhysicalFallbackStartAuthorityCompatibilityV20<
  A extends ReceiptRef<"receipt:physical-attempt-authority-binding@20", unknown>,
  F extends PhysicalFallbackStartRefV20 | "not_applicable",
> = F extends "not_applicable"
  ? unknown
  : F extends PhysicalFallbackStartRefV20
    ? [FallbackAttemptLeaseOfStartV20<F>] extends [never]
      ? never
      : ExactTypeEqualV7<
            PhysicalAttemptAuthorityLeaseOfV20<A>,
            FallbackAttemptLeaseOfStartV20<F>
          > extends true
        ? PhysicalAttemptAuthorityDomainOfV20<A> extends "runtime_inference"
          ? unknown
          : never
        : never
    : never;

interface PhysicalAttemptSubjectReceiptV20<
  A extends ReceiptRef<"receipt:physical-attempt-authority-binding@20", unknown>,
  State extends "before_send" | "after_send_intent",
  F extends PhysicalFallbackStartRefV20 | "not_applicable",
> extends ReceiptRef<"receipt:physical-attempt-subject@20", readonly [A, State, F]> {
  readonly [physicalAttemptSubjectBrandV20]: (fallbackStart: F) => F;
  readonly domain: PhysicalAttemptAuthorityDomainOfV20<A>;
  readonly distributionIdentity: PhysicalAttemptAuthorityDistributionOfV20<A>;
  readonly authorityBinding: A;
  readonly exactDomainLease: PhysicalAttemptAuthorityLeaseOfV20<A>;
  readonly sendState: State;
  readonly fallbackAttemptStart: F;
  readonly logicalCallId: string;
  readonly physicalAttemptId: string;
  readonly ordinal: number;
  readonly endpointIdentityDigest: string;
  readonly canonicalRequestDigest: string;
  readonly fundingAndEffectSubjectDigest: string;
  readonly exactSendIntent: State extends "before_send"
    ? "none_before_send"
    : ReceiptRef<"receipt:physical-send-intent@20", readonly [A, F]>;
}

declare function commitPhysicalAttemptSubjectV20<
  const A extends ReceiptRef<"receipt:physical-attempt-authority-binding@20", unknown>,
  const State extends "before_send" | "after_send_intent",
  const F extends PhysicalFallbackStartRefV20 | "not_applicable",
>(input: {
  readonly authorityBinding: A & (
    [PhysicalAttemptAuthorityLeaseOfV20<A>] extends [never] ? never : unknown
  );
  readonly sendState: State & AiSupplySingleLiteralV20<State>;
  readonly fallbackAttemptStart: F & PhysicalFallbackStartAuthorityCompatibilityV20<A, F>;
  readonly exactSendIntent: State extends "before_send"
    ? "none_before_send"
    : ReceiptRef<"receipt:physical-send-intent@20", readonly [A, F]>;
  readonly exactCanonicalRequestEndpointFundingEffectAndOrdinalProjection: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<PhysicalAttemptSubjectReceiptV20<A, State, F>>;

interface AnyPhysicalAttemptSubjectReceiptV20 extends ReceiptRef<
  "receipt:physical-attempt-subject@20",
  unknown
> {
  readonly domain: PhysicalAttemptDomainV19;
  readonly authorityBinding: ReceiptRef<"receipt:physical-attempt-authority-binding@20", unknown>;
  readonly exactDomainLease: AuthorityInventoryBearingLease;
  readonly sendState: "before_send" | "after_send_intent";
  readonly fallbackAttemptStart: PhysicalFallbackStartRefV20 | "not_applicable";
}

type ExactPhysicalAttemptTerminalReceiptV20<
  S extends AnyPhysicalAttemptSubjectReceiptV20,
> = ReceiptRef<"receipt:exact-physical-attempt-terminal@20", S> & {
      readonly [physicalAttemptTerminalBrandV20]: never;
      readonly subject: S;
      readonly authorityBinding: S["authorityBinding"];
      readonly exactDomainLease: S["exactDomainLease"];
      readonly exactAuthorityReleaseTuple: ExactLeaseAuthorityReleaseTuple<S["exactDomainLease"]>;
      readonly exactAuthorityReleaseCount: number;
      readonly exactAuthorityReleaseSetDigest: string;
      readonly exactLedgerRange: AuthoritativeLedgerRangeReceipt;
      readonly fallbackAttemptStart: S["fallbackAttemptStart"];
      readonly allLeaseAuthoritiesClosedExactlyOnce: true;
    } & (S["sendState"] extends "before_send"
      ? {
          readonly outcome: "failed_before_send";
          readonly sent: false;
          readonly continuation: "retryable_with_fresh_lease";
          readonly responseEvidence?: never;
        }
      :
        | {
            readonly outcome: "succeeded";
            readonly sent: true;
            readonly continuation: "terminal_success";
            readonly responseEvidence: ImportedOpaqueEvidenceLeafReceipt;
          }
        | {
            readonly outcome: "authoritatively_not_committed";
            readonly sent: true;
            readonly continuation: "retryable_with_fresh_lease";
            readonly responseEvidence: ImportedOpaqueEvidenceLeafReceipt;
          }
        | {
            readonly outcome: "failed_after_send";
            readonly sent: true;
            readonly continuation: "terminal_failure";
            readonly responseEvidence: ImportedOpaqueEvidenceLeafReceipt;
          }
        | {
            readonly outcome: "delivery_unknown";
            readonly sent: true;
            readonly continuation: "terminal_unknown";
            readonly responseEvidence: ImportedOpaqueEvidenceLeafReceipt;
          });

type PhysicalAttemptLeaseOfV20<S extends AnyPhysicalAttemptSubjectReceiptV20> = S["exactDomainLease"];

type PhysicalAttemptSendStateOfV20<S extends AnyPhysicalAttemptSubjectReceiptV20> = S["sendState"];

declare function commitExactPhysicalAttemptTerminalV20<
  const S extends AnyPhysicalAttemptSubjectReceiptV20,
>(input: {
  readonly subject: S;
  readonly exactAuthorityReleaseTuple: ExactLeaseAuthorityReleaseTuple<PhysicalAttemptLeaseOfV20<S>>;
  readonly exactLedgerRange: AuthoritativeLedgerRangeReceipt;
  readonly outcomeAndTransportEvidence: PhysicalAttemptSendStateOfV20<S> extends "before_send"
    ? { readonly outcome: "failed_before_send"; readonly preIntentClosure: PreIntentLeaseClosureReceipt<PhysicalAttemptLeaseOfV20<S>> }
    : {
        readonly outcome: "succeeded" | "authoritatively_not_committed" | "failed_after_send" | "delivery_unknown";
        readonly transportOrProviderEvidence: ImportedOpaqueEvidenceLeafReceipt;
      };
}): DeepFrozenCommittedReceiptV1<ExactPhysicalAttemptTerminalReceiptV20<S>>;

declare const fallbackSubjectBrandV20: unique symbol;
declare const fallbackCursorBrandV20: unique symbol;
declare const fallbackAttemptStartBrandV20: unique symbol;
declare const fallbackAdvanceBrandV20: unique symbol;
declare const fallbackTerminalBrandV20: unique symbol;

interface FallbackSubjectReceiptV20<
  Slot extends SupplySlotId,
  D extends string,
  DP extends `distributions/${string}`,
  Alternatives extends NonEmptyReadonly<string>,
> extends ReceiptRef<"receipt:fallback-subject@20", readonly [Slot, D, Alternatives]> {
  readonly [fallbackSubjectBrandV20]: (alternatives: Alternatives) => Alternatives;
  readonly invokedSlot: Slot;
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<D, DP>;
  readonly exactOrderedAlternativeIds: Alternatives;
  readonly invocationEnvelopeDigest: string;
  readonly aggregateFundingAndDataBoundaryPolicyDigest: string;
}

interface AnyFallbackSubjectReceiptV20 extends ReceiptRef<
  "receipt:fallback-subject@20",
  unknown
> {
  readonly invokedSlot: SupplySlotId;
  readonly distributionIdentity: ReceiptRef<"receipt:distribution-artifact-identity@20", unknown> & {
    readonly distributionArtifactDigest: string;
    readonly targetPath: `distributions/${string}`;
  };
  readonly exactOrderedAlternativeIds: NonEmptyReadonly<string>;
  readonly invocationEnvelopeDigest: string;
  readonly aggregateFundingAndDataBoundaryPolicyDigest: string;
}

declare function commitFallbackSubjectV20<
  const Slot extends SupplySlotId,
  const D extends string,
  const DP extends `distributions/${string}`,
  const Alternatives extends NonEmptyReadonly<string>,
>(input: {
  readonly invokedSlot: Slot & AiSupplySingleLiteralV20<Slot>;
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<D, DP>;
  readonly exactOrderedAlternativeIds: Alternatives;
  readonly invocationEnvelopeAggregateFundingAndDataBoundary: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<FallbackSubjectReceiptV20<Slot, D, DP, Alternatives>>;

interface FallbackGenesisReadyCursorReceiptV20<
  S extends AnyFallbackSubjectReceiptV20,
> extends ReceiptRef<"receipt:fallback-ready-cursor@20", readonly [S, 0]> {
  readonly [fallbackCursorBrandV20]: never;
  readonly subject: S;
  readonly state: "ready";
  readonly cause: "genesis";
  readonly revision: 0;
  readonly nextAlternativeOrdinal: 0;
  readonly predecessorAdvance?: never;
}

interface FallbackAdvancedReadyCursorReceiptV20<
  S extends AnyFallbackSubjectReceiptV20,
  A extends ReceiptRef<"receipt:fallback-advance@20", S>,
> extends ReceiptRef<"receipt:fallback-ready-cursor@20", readonly [S, A]> {
  readonly [fallbackCursorBrandV20]: never;
  readonly subject: S;
  readonly state: "ready";
  readonly cause: "advanced_after_retryable_terminal";
  readonly revision: number;
  readonly nextAlternativeOrdinal: number;
  readonly predecessorAdvance: A;
}

type FallbackReadyCursorReceiptV20<
  S extends AnyFallbackSubjectReceiptV20,
> = FallbackGenesisReadyCursorReceiptV20<S> | FallbackAdvancedReadyCursorReceiptV20<S, ReceiptRef<"receipt:fallback-advance@20", S>>;

interface FallbackAttemptLeaseReceiptV20<
  S extends AnyFallbackSubjectReceiptV20,
  R extends FallbackReadyCursorReceiptV20<S>,
> extends AuthorityInventoryBearingLease {
  readonly subject: S;
  readonly predecessorCursor: R;
  readonly alternativeOrdinal: R["nextAlternativeOrdinal"];
  readonly exactAlternativeId: S["exactOrderedAlternativeIds"][R["nextAlternativeOrdinal"] & keyof S["exactOrderedAlternativeIds"]];
  readonly exactAdmissionFundingRightsDataAndBindingDigest: string;
  readonly singleUse: true;
}

interface FallbackAttemptStartCommitV20<
  S extends AnyFallbackSubjectReceiptV20,
  R extends FallbackReadyCursorReceiptV20<S>,
  L extends FallbackAttemptLeaseReceiptV20<S, R>,
> extends ReceiptRef<"receipt:fallback-attempt-start@20", readonly [S, R, L]> {
  readonly [fallbackAttemptStartBrandV20]: never;
  readonly subject: S;
  readonly predecessorCursor: R;
  readonly attemptLease: L;
  readonly inFlightCursor: ReceiptRef<"receipt:fallback-in-flight-cursor@20", readonly [S, R, L]>;
  readonly exactAlternativeOrdinal: R["nextAlternativeOrdinal"];
  readonly exactAlternativeId: L["exactAlternativeId"];
}

declare function commitFallbackInitialCursorV20<
  const S extends AnyFallbackSubjectReceiptV20,
>(input: {
  readonly subject: S;
  readonly writerFenceAndPlanAdmission: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<FallbackGenesisReadyCursorReceiptV20<S>>;

declare function commitFallbackAttemptStartV20<
  const S extends AnyFallbackSubjectReceiptV20,
  const R extends FallbackReadyCursorReceiptV20<S>,
  const L extends FallbackAttemptLeaseReceiptV20<S, R>,
>(input: {
  readonly subject: S;
  readonly predecessorCursor: R;
  readonly attemptLease: L;
  readonly exactAlternativeTupleMembershipAndCursorCasEvidence: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<FallbackAttemptStartCommitV20<S, R, L>>;

type FallbackRetryablePhysicalTerminalForStartV20<
  Start extends ReceiptRef<"receipt:fallback-attempt-start@20", unknown>,
> = ReceiptRef<"receipt:exact-physical-attempt-terminal@20", unknown> & {
  readonly subject: ReceiptRef<"receipt:physical-attempt-subject@20", unknown> & {
    readonly domain: "runtime_inference";
    readonly fallbackAttemptStart: Start;
  };
  readonly fallbackAttemptStart: Start;
  readonly outcome: "failed_before_send" | "authoritatively_not_committed";
  readonly continuation: "retryable_with_fresh_lease";
  readonly allLeaseAuthoritiesClosedExactlyOnce: true;
};

interface FallbackAdvanceCommitReceiptV20<
  S extends AnyFallbackSubjectReceiptV20,
  R extends FallbackReadyCursorReceiptV20<S>,
  L extends FallbackAttemptLeaseReceiptV20<S, R>,
  Start extends FallbackAttemptStartCommitV20<S, R, L>,
  T extends FallbackRetryablePhysicalTerminalForStartV20<Start>,
> extends ReceiptRef<"receipt:fallback-advance@20", S> {
  readonly [fallbackAdvanceBrandV20]: never;
  readonly subject: S;
  readonly predecessorCursor: R;
  readonly attemptStart: Start;
  readonly retryablePhysicalTerminal: T & { readonly continuation: "retryable_with_fresh_lease" };
  readonly successorCursor: FallbackAdvancedReadyCursorReceiptV20<S, FallbackAdvanceCommitReceiptV20<S, R, L, Start, T>>;
  readonly predecessorAndSuccessorRevisionOrdinalAndSingleWinnerCasVerified: true;
}

declare function commitFallbackAdvanceV20<
  const S extends AnyFallbackSubjectReceiptV20,
  const R extends FallbackReadyCursorReceiptV20<S>,
  const L extends FallbackAttemptLeaseReceiptV20<S, R>,
  const Start extends FallbackAttemptStartCommitV20<S, R, L>,
  const T extends FallbackRetryablePhysicalTerminalForStartV20<Start>,
>(input: {
  readonly subject: S;
  readonly attemptStart: Start;
  readonly terminal: T & { readonly continuation: "retryable_with_fresh_lease" };
  readonly exactNextAlternativeAndSingleWinnerCasEvidence: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<FallbackAdvanceCommitReceiptV20<S, R, L, Start, T>>;

type FallbackFinalDispositionV20 =
  | "physical_success"
  | "physical_terminal_failure"
  | "physical_delivery_unknown"
  | "alternatives_exhausted"
  | "cancelled_before_attempt"
  | "hard_stopped_before_attempt"
  | "deadline_before_attempt";

interface FallbackTerminalReceiptV20<
  S extends AnyFallbackSubjectReceiptV20,
> extends ReceiptRef<"receipt:fallback-terminal@20", S> {
  readonly [fallbackTerminalBrandV20]: never;
  readonly subject: S;
  readonly finalDisposition: FallbackFinalDispositionV20;
  readonly exactPredecessorReadyOrAttemptStart: ReceiptRef<
    "receipt:fallback-ready-cursor@20" | "receipt:fallback-attempt-start@20",
    unknown
  >;
  readonly finalPhysicalTerminal?: ReceiptRef<"receipt:exact-physical-attempt-terminal@20", unknown>;
  readonly exactAggregateLedgerRange: AuthoritativeLedgerRangeReceipt;
  readonly fullAdvanceHistoryRemainsReachableFromPredecessorChain: true;
}

declare function commitFallbackTerminalV20<
  const S extends AnyFallbackSubjectReceiptV20,
>(input: {
  readonly subject: S;
  readonly exactPredecessorReadyOrAttemptStart: FallbackTerminalReceiptV20<S>["exactPredecessorReadyOrAttemptStart"];
  readonly finalDisposition: FallbackFinalDispositionV20;
  readonly finalPhysicalTerminal?: FallbackTerminalReceiptV20<S>["finalPhysicalTerminal"];
  readonly exactAggregateLedgerRange: AuthoritativeLedgerRangeReceipt;
  readonly dispositionTerminalCompatibilityAndHistoryVerifier: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<FallbackTerminalReceiptV20<S>>;

declare const codexCommandAuthInitialCredentialBrandV20: unique symbol;
declare const codexCommandAuthRefreshCursorBrandV20: unique symbol;
declare const codexCommandAuthFailureObservationBrandV20: unique symbol;
declare const codexCommandAuthRefreshDeadlineBrandV20: unique symbol;
declare const codexCommandAuthRefreshLeaseBrandV20: unique symbol;
declare const codexCommandAuthRefreshTerminalBrandV20: unique symbol;
declare const codexCommandAuthCredentialTransitionBrandV20: unique symbol;
declare const codexCommandAuthCredentialRetirementBrandV20: unique symbol;
declare const codexCommandAuthDefinitionBindingBrandV20: unique symbol;

type CodexCommandAuthCandidatePointerV20 = ReceiptPointerV20<
  "receipt:codex-command-auth-candidate@19",
  unknown
>;

interface CodexCommandAuthDefinitionBindingReceiptV20<
  D extends CodexCommandAuthDefinitionV19,
> extends ReceiptRef<
  "receipt:codex-command-auth-definition-binding@20",
  readonly [CodexCommandAuthCandidatePointerV20, D]
> {
  readonly [codexCommandAuthDefinitionBindingBrandV20]: never;
  readonly candidate: CodexCommandAuthCandidatePointerV20;
  readonly exactDefinition: D;
  readonly refreshMode: D["refreshMode"];
  readonly refreshIntervalMillis: D extends { readonly refreshMode: "fixed_interval" }
    ? D["refreshIntervalMillis"]
    : "on_authentication_retry";
  readonly exactDefinitionIdentityDigest: string;
  readonly executableArgvWorkingDirectoryEnvironmentTimeoutOutputAndRefreshDiscriminantComparedByteExactly: true;
}

declare function commitCodexCommandAuthDefinitionBindingV20<
  const D extends CodexCommandAuthDefinitionV19,
>(input: {
  readonly candidate: CodexCommandAuthCandidateReceiptV19;
  readonly exactDefinition: D;
  readonly exactCandidateDefinitionIndexBytesAndDiscriminantComparison: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<CodexCommandAuthDefinitionBindingReceiptV20<D>>;

interface CodexCommandAuthActiveCredentialCoreV20<
  D extends CodexCommandAuthDefinitionV19 = CodexCommandAuthDefinitionV19,
  S = unknown,
> extends ReceiptRef<
  "receipt:codex-command-auth-active-credential@20",
  S
> {
  readonly definitionBinding: ReceiptPointerV20<
    "receipt:codex-command-auth-definition-binding@20",
    readonly [CodexCommandAuthCandidatePointerV20, D]
  >;
  readonly candidate: CodexCommandAuthCandidatePointerV20;
  readonly exactDefinition: D;
  readonly refreshMode: D["refreshMode"];
  readonly credentialGeneration: number;
  readonly brokeredSecretVersionDigest: string;
  readonly acquiredAtMonotonicDigest: string;
  readonly brokerCredentialNotAfter: string;
  readonly commandOutputDidNotAssertTokenExpiry: true;
}

interface CodexCommandAuthInitialCredentialReceiptV20<
  B extends CodexCommandAuthDefinitionBindingReceiptV20<CodexCommandAuthDefinitionV19>,
> extends CodexCommandAuthActiveCredentialCoreV20<
  B["exactDefinition"],
  readonly ["initial", ExactReceiptPointerForV20<B>]
> {
  readonly [codexCommandAuthInitialCredentialBrandV20]: never;
  readonly definitionBinding: ExactReceiptPointerForV20<B>;
  readonly candidate: B["candidate"];
  readonly exactDefinition: B["exactDefinition"];
  readonly acquisitionTerminal: ReceiptPointerV20<"receipt:codex-command-auth-process-terminal@19", unknown>;
  readonly credentialGeneration: 0;
}

interface CodexCommandAuthCredentialTransitionReceiptV20<
  Old extends CodexCommandAuthActiveCredentialCoreV20,
  L extends CodexCommandAuthRefreshAttemptLeaseReceiptV20<Old, CodexCommandAuthRefreshReadyCursorReceiptV20<Old>>,
> extends CodexCommandAuthActiveCredentialCoreV20<
  Old["exactDefinition"],
  readonly ["refresh", ExactReceiptPointerForV20<Old>, ExactReceiptPointerForV20<L>]
> {
  readonly [codexCommandAuthCredentialTransitionBrandV20]: never;
  readonly definitionBinding: Old["definitionBinding"];
  readonly candidate: Old["candidate"];
  readonly exactDefinition: Old["exactDefinition"];
  readonly predecessorCredential: ExactReceiptPointerForV20<Old>;
  readonly refreshLease: ExactReceiptPointerForV20<L>;
  readonly successfulRefreshTerminal: ReceiptPointerV20<
    "receipt:codex-command-auth-refresh-process-terminal@20",
    ExactReceiptPointerForV20<L>
  >;
  readonly predecessorRetirement: ReceiptPointerV20<
    "receipt:codex-command-auth-credential-retirement@20",
    readonly [ExactReceiptPointerForV20<Old>, ExactReceiptPointerForV20<L>]
  >;
  readonly credentialGeneration: number;
  readonly oldSecretRetiredBeforeNewCredentialBecameActive: true;
}

type CodexCommandAuthActiveCredentialReceiptV20 = CodexCommandAuthActiveCredentialCoreV20<
  CodexCommandAuthDefinitionV19,
  unknown
>;

interface CodexCommandAuthRefreshReadyCursorReceiptV20<
  C extends CodexCommandAuthActiveCredentialCoreV20,
> extends ReceiptRef<"receipt:codex-command-auth-refresh-ready-cursor@20", ExactReceiptPointerForV20<C>> {
  readonly [codexCommandAuthRefreshCursorBrandV20]: never;
  readonly activeCredential: ExactReceiptPointerForV20<C>;
  readonly candidate: C["candidate"];
  readonly exactDefinition: C["exactDefinition"];
  readonly revision: number;
  readonly state: "ready";
  readonly writerEpoch: number;
  readonly predecessorTransition?: ReceiptRef<"receipt:codex-command-auth-active-credential@20", unknown>;
}

interface CodexCommandAuthAuthenticationFailureObservationReceiptV20<
  C extends CodexCommandAuthActiveCredentialReceiptV20,
> extends ReceiptRef<"receipt:codex-command-auth-authentication-failure@20", ExactReceiptPointerForV20<C>> {
  readonly [codexCommandAuthFailureObservationBrandV20]: never;
  readonly activeCredential: ExactReceiptPointerForV20<C>;
  readonly exactFailedPhysicalAttemptTerminal: ReceiptPointerV20<"receipt:exact-physical-attempt-terminal@20", unknown>;
  readonly providerClassifiedOutcome: "authentication_failed_retry_permitted";
  readonly noApplicationPayloadAutomaticReplayPermission: true;
}

interface CodexCommandAuthFixedIntervalDeadlineReceiptV20<
  C extends CodexCommandAuthActiveCredentialReceiptV20,
> extends ReceiptRef<"receipt:codex-command-auth-fixed-interval-deadline@20", ExactReceiptPointerForV20<C>> {
  readonly [codexCommandAuthRefreshDeadlineBrandV20]: never;
  readonly activeCredential: ExactReceiptPointerForV20<C>;
  readonly configuredRefreshIntervalMillis: number;
  readonly acquisitionMonotonicDigest: C["acquiredAtMonotonicDigest"];
  readonly currentTimeAuthority: TimeAuthorityReceipt;
  readonly currentSecurityAnchor: SecurityMonotonicAnchorReceipt;
  readonly deadlineRelation: "at_or_after_acquisition_plus_fixed_interval";
}

type CodexCommandAuthRefreshTriggerReceiptV20<
  C extends CodexCommandAuthActiveCredentialReceiptV20,
> = C["exactDefinition"] extends { readonly refreshMode: "on_authentication_retry" }
  ? CodexCommandAuthAuthenticationFailureObservationReceiptV20<C>
  : CodexCommandAuthFixedIntervalDeadlineReceiptV20<C>;

type CodexCommandAuthRefreshAttemptLeaseReceiptV20<
  C extends CodexCommandAuthActiveCredentialReceiptV20,
  R extends CodexCommandAuthRefreshReadyCursorReceiptV20<C>,
> = AuthorityInventoryBearingLease<NonEmptyLeaseAuthorityInventoryTuple<readonly [
  "process_or_session",
  "network_admission",
  "broker_handle",
  "credential_or_signing",
  "exclusive_cursor_action",
]>> & ReceiptRef<
  "receipt:codex-command-auth-refresh-attempt-lease@20",
  readonly [ExactReceiptPointerForV20<C>, ExactReceiptPointerForV20<R>]
> & {
  readonly [codexCommandAuthRefreshLeaseBrandV20]: never;
  readonly activeCredential: ExactReceiptPointerForV20<C>;
  readonly predecessorCursor: ExactReceiptPointerForV20<R>;
  readonly trigger: ExactReceiptPointerForV20<CodexCommandAuthRefreshTriggerReceiptV20<C>>;
  readonly expectedCursorRevision: R["revision"];
  readonly singleWinnerCasCommitted: true;
  readonly singleUse: true;
};

interface CodexCommandAuthRefreshCredentialRetirementReceiptV20<
  C extends CodexCommandAuthActiveCredentialReceiptV20,
  L extends CodexCommandAuthRefreshAttemptLeaseReceiptV20<C, CodexCommandAuthRefreshReadyCursorReceiptV20<C>>,
> extends ReceiptRef<
  "receipt:codex-command-auth-credential-retirement@20",
  readonly [ExactReceiptPointerForV20<C>, ExactReceiptPointerForV20<L>]
> {
  readonly [codexCommandAuthCredentialRetirementBrandV20]: never;
  readonly retiredCredential: ExactReceiptPointerForV20<C>;
  readonly refreshLease: ExactReceiptPointerForV20<L>;
  readonly successfulRefreshTerminal: ReceiptPointerV20<
    "receipt:codex-command-auth-refresh-process-terminal@20",
    ExactReceiptPointerForV20<L>
  >;
  readonly brokeredSecretVersionDigest: C["brokeredSecretVersionDigest"];
  readonly retirementReason: "refresh_transition";
  readonly furtherBrokerReadAndSendCount: 0;
}

interface CodexCommandAuthTerminalCredentialRetirementReceiptV20<
  C extends CodexCommandAuthActiveCredentialReceiptV20,
  R extends "hard_stop" | "candidate_changed",
> extends ReceiptRef<
  "receipt:codex-command-auth-credential-retirement@20",
  readonly [ExactReceiptPointerForV20<C>, R]
> {
  readonly [codexCommandAuthCredentialRetirementBrandV20]: never;
  readonly retiredCredential: ExactReceiptPointerForV20<C>;
  readonly brokeredSecretVersionDigest: C["brokeredSecretVersionDigest"];
  readonly retirementReason: R;
  readonly terminalStopOrCandidateReplacementAuthority: ImportedOpaqueEvidenceLeafReceipt;
  readonly furtherBrokerReadAndSendCount: 0;
}

type AnyCodexCommandAuthRefreshAttemptLeaseReceiptV20 = AuthorityInventoryBearingLease<
  NonEmptyLeaseAuthorityInventoryTuple<readonly [
    "process_or_session",
    "network_admission",
    "broker_handle",
    "credential_or_signing",
    "exclusive_cursor_action",
  ]>
> & ReceiptRef<
  "receipt:codex-command-auth-refresh-attempt-lease@20",
  readonly [
    ReceiptPointerV20<"receipt:codex-command-auth-active-credential@20", unknown>,
    ReceiptPointerV20<"receipt:codex-command-auth-refresh-ready-cursor@20", unknown>
  ]
>;

type CodexCommandAuthRefreshProcessTerminalReceiptV20<
  L extends AnyCodexCommandAuthRefreshAttemptLeaseReceiptV20,
> = ReceiptRef<
  "receipt:codex-command-auth-refresh-process-terminal@20",
  ExactReceiptPointerForV20<L>
> & {
  readonly [codexCommandAuthRefreshTerminalBrandV20]: never;
  readonly refreshLease: ExactReceiptPointerForV20<L>;
  readonly exactAuthorityReleaseTuple: ExactLeaseAuthorityReleaseTuple<L>;
  readonly stdoutWasNeverLoggedRenderedOrPersisted: true;
} & (
  | { readonly outcome: "succeeded_and_imported"; readonly newBrokeredSecretVersionDigest: string }
  | { readonly outcome: "failed_before_spawn"; readonly newBrokeredSecretVersionDigest?: never }
  | { readonly outcome: "failed_or_invalid_output"; readonly newBrokeredSecretVersionDigest?: never }
  | { readonly outcome: "delivery_unknown_secret_quarantined"; readonly newBrokeredSecretVersionDigest?: never }
);

declare function commitCodexCommandAuthInitialCredentialV20<
  const B extends CodexCommandAuthDefinitionBindingReceiptV20<CodexCommandAuthDefinitionV19>,
>(input: {
  readonly definitionBinding: B;
  readonly successfulProcessTerminal: ReceiptPointerV20<"receipt:codex-command-auth-process-terminal@19", unknown>;
  readonly exactDefinitionCandidateLeaseTerminalAndBrokerImportComparison: ImportedOpaqueEvidenceLeafReceipt;
  readonly brokerImportAndAcquisitionTimeEvidence: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<CodexCommandAuthInitialCredentialReceiptV20<B>>;

declare function commitCodexCommandAuthRefreshReadyCursorV20<
  const C extends CodexCommandAuthActiveCredentialReceiptV20,
>(input: {
  readonly activeCredential: C;
  readonly predecessorCursorOrGenesis:
    | "genesis"
    | ReceiptRef<"receipt:codex-command-auth-refresh-ready-cursor@20", unknown>;
  readonly predecessorTransitionOrGenesis:
    | "genesis"
    | ReceiptRef<"receipt:codex-command-auth-active-credential@20", unknown>;
  readonly exactTransitionAndSingleSuccessorCasEvidence: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<CodexCommandAuthRefreshReadyCursorReceiptV20<C>>;

declare function commitCodexCommandAuthAuthenticationFailureObservationV20<
  const C extends CodexCommandAuthActiveCredentialReceiptV20,
>(input: {
  readonly activeCredential: C;
  readonly exactFailedPhysicalAttemptTerminal: ReceiptRef<"receipt:exact-physical-attempt-terminal@20", unknown>;
  readonly providerAuthenticationClassificationEvidence: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<CodexCommandAuthAuthenticationFailureObservationReceiptV20<C>>;

declare function commitCodexCommandAuthFixedIntervalDeadlineV20<
  const C extends CodexCommandAuthActiveCredentialReceiptV20,
>(input: C["exactDefinition"] extends { readonly refreshMode: "fixed_interval" }
  ? {
      readonly activeCredential: C;
      readonly currentTimeAuthority: TimeAuthorityReceipt;
      readonly currentSecurityAnchor: SecurityMonotonicAnchorReceipt;
      readonly exactAcquisitionPlusIntervalDeadlineComparison: ImportedOpaqueEvidenceLeafReceipt;
    }
  : never): DeepFrozenCommittedReceiptV1<CodexCommandAuthFixedIntervalDeadlineReceiptV20<C>>;

declare function commitCodexCommandAuthRefreshAttemptLeaseV20<
  const C extends CodexCommandAuthActiveCredentialReceiptV20,
  const R extends CodexCommandAuthRefreshReadyCursorReceiptV20<C>,
>(input: {
  readonly activeCredential: C;
  readonly predecessorCursor: R;
  readonly trigger: CodexCommandAuthRefreshTriggerReceiptV20<NoInfer<C>>;
  readonly authorityInventory: NonEmptyLeaseAuthorityInventoryTuple<readonly [
    "process_or_session",
    "network_admission",
    "broker_handle",
    "credential_or_signing",
    "exclusive_cursor_action",
  ]>;
  readonly exactSandboxAndCursorCasEvidence: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<CodexCommandAuthRefreshAttemptLeaseReceiptV20<C, R>>;

declare function executeAndCloseCodexCommandAuthRefreshProcessV20<
  const L extends AnyCodexCommandAuthRefreshAttemptLeaseReceiptV20,
>(input: {
  readonly refreshLease: L;
  readonly exactSpawnIntentSandboxPipeBrokerAndOutcomeEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly exactAuthorityReleaseTuple: ExactLeaseAuthorityReleaseTuple<L>;
}): DeepFrozenCommittedReceiptV1<CodexCommandAuthRefreshProcessTerminalReceiptV20<L>>;

declare function commitCodexCommandAuthRefreshCredentialRetirementV20<
  const Old extends CodexCommandAuthActiveCredentialReceiptV20,
  const L extends CodexCommandAuthRefreshAttemptLeaseReceiptV20<
    Old,
    CodexCommandAuthRefreshReadyCursorReceiptV20<Old>
  >,
>(input: {
  readonly predecessorCredential: Old;
  readonly refreshLease: L;
  readonly successfulRefreshTerminal: Extract<
    CodexCommandAuthRefreshProcessTerminalReceiptV20<NoInfer<L>>,
    { readonly outcome: "succeeded_and_imported" }
  >;
  readonly exactBrokerSecretRetirementAndFurtherReadFenceEvidence: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<CodexCommandAuthRefreshCredentialRetirementReceiptV20<Old, L>>;

declare function commitCodexCommandAuthTerminalCredentialRetirementV20<
  const C extends CodexCommandAuthActiveCredentialReceiptV20,
  const R extends "hard_stop" | "candidate_changed",
>(input: {
  readonly activeCredential: C;
  readonly retirementReason: R & AiSupplySingleLiteralV20<R>;
  readonly terminalStopOrCandidateReplacementAuthority: ImportedOpaqueEvidenceLeafReceipt;
  readonly exactBrokerSecretRetirementAndFurtherReadFenceEvidence: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<CodexCommandAuthTerminalCredentialRetirementReceiptV20<C, R>>;

declare function commitCodexCommandAuthCredentialTransitionV20<
  const Old extends CodexCommandAuthActiveCredentialReceiptV20,
  const L extends CodexCommandAuthRefreshAttemptLeaseReceiptV20<
    Old,
    CodexCommandAuthRefreshReadyCursorReceiptV20<Old>
  >,
>(input: {
  readonly predecessorCredential: Old;
  readonly refreshLease: L;
  readonly successfulRefreshTerminal: Extract<
    CodexCommandAuthRefreshProcessTerminalReceiptV20<NoInfer<L>>,
    { readonly outcome: "succeeded_and_imported" }
  >;
  readonly predecessorRetirement: CodexCommandAuthRefreshCredentialRetirementReceiptV20<NoInfer<Old>, NoInfer<L>>;
  readonly exactBrokerGenerationTransitionAndOldSecretRetirementEvidence: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<CodexCommandAuthCredentialTransitionReceiptV20<Old, L>>;

// ===== 来源:4. 目标架构 / 4.16.8 v20 单一公共真相与根因闭包 =====
// 原文档行 41892-42455 (共 564 行)
interface TypeContractSourceMetricsV20 {
  readonly measurementSubject: "complete_generated_contract" | "single_isolated_fixture_module";
  readonly nodeRuntimeVersion: `v22.${number}.${number}`;
  readonly nodeProcessArgvPrefix: typeof TYPE_CONTRACT_COMPILE_BUDGET_V1.nodeProcessArgvPrefix;
  readonly contractSourceDigest: string;
  readonly contractSourceBytes: number;
  readonly contractSourceLines: number;
  readonly handwrittenSourceDigest: string;
  readonly handwrittenSourceBytes: number;
  readonly handwrittenSourceLines: number;
  readonly generatedSourceDigest: string;
  readonly generatedSourceBytes: number;
  readonly generatedSourceLines: number;
  readonly typeInstantiations: number;
  readonly typeCount: number;
  readonly diagnostics: 0;
  readonly externalOrInternalAnyStubCount: 0;
  readonly writablePropertySignatureCount: 0;
  readonly nonBrandRequiredNeverCount: 0;
  readonly compileWallSampleMillis: readonly [number, number, number, number, number];
  readonly residentSetSampleBytes: readonly [number, number, number, number, number];
  readonly compileWallMedianMillis: number;
  readonly residentSetMaximumBytes: number;
}

declare const typeContractInvocationIdentityBrandV20: unique symbol;

interface TypeContractInvocationIdentityReceiptV20<
  D extends string,
  DP extends `distributions/${string}`,
> extends ReceiptRef<"receipt:type-contract-invocation-identity@20", readonly [D, DP]> {
  readonly [typeContractInvocationIdentityBrandV20]: never;
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<D, DP>;
  readonly exactContractArtifactDigest: string;
  readonly exactHandwrittenSourceSetDigest: string;
  readonly exactGeneratedSourceSetDigest: string;
  readonly nodeRuntimeVersion: `v22.${number}.${number}`;
  readonly nodeProcessArgvPrefix: typeof TYPE_CONTRACT_COMPILE_BUDGET_V1.nodeProcessArgvPrefix;
  readonly compilerPackage: "typescript";
  readonly compilerVersion: "5.9.3";
  readonly strictCompilerArgv: NonEmptyReadonly<string>;
  readonly compilerPackageLockDigest: string;
  readonly runnerImageDigest: string;
  readonly runnerHardwareProfileDigest: string;
  readonly measurementProtocol: "five-isolated-cold-processes-median-wall-max-rss-v1";
  readonly exactExecutableArgvLockRunnerHardwareSourceAndDistributionIdentityDigest: string;
}

declare function commitTypeContractInvocationIdentityV20<
  const D extends string,
  const DP extends `distributions/${string}`,
>(input: {
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<D, DP>;
  readonly exactContractHandwrittenAndGeneratedSourceArtifacts: readonly [
    ImportedOpaqueEvidenceLeafReceipt,
    ImportedOpaqueEvidenceLeafReceipt,
    ImportedOpaqueEvidenceLeafReceipt,
  ];
  readonly strictCompilerArgv: NonEmptyReadonly<string>;
  readonly compilerPackageLockRunnerAndHardwareEvidence: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<TypeContractInvocationIdentityReceiptV20<D, DP>>;

declare const typeContractBaselineGenesisAuthorityBrandV20: unique symbol;
declare const typeContractBaselineAbsenceBrandV20: unique symbol;
declare const typeContractBaselineCursorBrandV20: unique symbol;
declare const typeContractBaselineBrandV20: unique symbol;
declare const typeContractCompileGateBrandV20: unique symbol;

interface TypeContractBaselineGenesisAuthorityReceiptV20<
  D extends string,
  DP extends `distributions/${string}`,
> extends ReceiptRef<"receipt:type-contract-baseline-genesis-authority@20", readonly [D, DP]> {
  readonly [typeContractBaselineGenesisAuthorityBrandV20]: never;
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<D, DP>;
  readonly policyAuthorization: ExactTufTargetAuthorizationReceiptV20<
    TufRepositoryIdentityReceipt<"policy">,
    "delegated:type-contract-baselines",
    `policies/type-contract-baselines/${string}`,
    string
  >;
  readonly oneTimeRepositoryInitializationCeremony: ImportedOpaqueEvidenceLeafReceipt;
  readonly authorityCanBeConsumedExactlyOnce: true;
}

interface TypeContractBaselinePredecessorAbsenceReceiptV20<
  D extends string,
  DP extends `distributions/${string}`,
> extends ReceiptRef<"receipt:type-contract-baseline-predecessor-absence@20", readonly [D, DP]> {
  readonly [typeContractBaselineAbsenceBrandV20]: never;
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<D, DP>;
  readonly baselineNamespaceEnumeration: ImportedOpaqueEvidenceLeafReceipt;
  readonly predecessorCount: 0;
  readonly rollbackProtectedRepositoryHighWatermark: TufRepositoryHighWatermarkCursorReceipt<
    TufRepositoryIdentityReceipt<"policy">
  >;
}

interface TypeContractBaselineCursorReceiptV20<
  D extends string,
  DP extends `distributions/${string}`,
> extends ReceiptRef<"receipt:type-contract-baseline-cursor@20", readonly [D, DP]> {
  readonly [typeContractBaselineCursorBrandV20]: never;
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<D, DP>;
  readonly revision: number;
  readonly currentBaselineReceiptDigest: string | "none";
  readonly writerEpoch: number;
}

type TypeContractCompileBaselinePointerV20<
  D extends string,
  DP extends `distributions/${string}`,
> = ReceiptPointerV20<
  "receipt:type-contract-compile-baseline@20",
  | readonly ["genesis", D, DP]
  | readonly ["replacement", D, DP, string]
>;

type TypeContractCompileGatePointerV20<
  BP extends TypeContractCompileBaselinePointerV20<D, DP>,
  D extends string,
  DP extends `distributions/${string}`,
> = ReceiptPointerV20<
  "receipt:type-contract-compile-gate@20",
  readonly [BP, D, DP]
>;
type AnyPassingTypeContractCompileGatePointerV20<
  D extends string,
  DP extends `distributions/${string}`,
> = TypeContractCompileGatePointerV20<TypeContractCompileBaselinePointerV20<D, DP>, D, DP>;

interface InitialTypeContractCompileBaselineReceiptV20<
  D extends string,
  DP extends `distributions/${string}`,
> extends ReceiptRef<"receipt:type-contract-compile-baseline@20", readonly ["genesis", D, DP]> {
  readonly [typeContractBaselineBrandV20]: "genesis";
  readonly mode: "genesis";
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<D, DP>;
  readonly distributionArtifactDigest: D;
  readonly distributionTargetPath: DP;
  readonly invocationIdentity: TypeContractInvocationIdentityReceiptV20<D, DP>;
  readonly metrics: TypeContractSourceMetricsV20;
  readonly genesisAuthority: TypeContractBaselineGenesisAuthorityReceiptV20<D, DP>;
  readonly predecessorAbsence: TypeContractBaselinePredecessorAbsenceReceiptV20<D, DP>;
  readonly predecessorBaseline?: never;
  readonly predecessorPassingGate?: never;
  readonly ownerReplacementDecision?: never;
  readonly predecessorCursor: TypeContractBaselineCursorReceiptV20<D, DP> & {
    readonly currentBaselineReceiptDigest: "none";
  };
  readonly successorCursor: TypeContractBaselineCursorReceiptV20<D, DP>;
  readonly singleWinnerCasCommitted: true;
}

interface ReplacementTypeContractCompileBaselineReceiptV20<
  D extends string,
  DP extends `distributions/${string}`,
  BP extends TypeContractCompileBaselinePointerV20<D, DP>,
> extends ReceiptRef<"receipt:type-contract-compile-baseline@20", readonly ["replacement", D, DP, BP["digest"]]> {
  readonly [typeContractBaselineBrandV20]: "replacement";
  readonly mode: "replacement";
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<D, DP>;
  readonly distributionArtifactDigest: D;
  readonly distributionTargetPath: DP;
  readonly invocationIdentity: TypeContractInvocationIdentityReceiptV20<D, DP>;
  readonly metrics: TypeContractSourceMetricsV20;
  readonly genesisAuthority?: never;
  readonly predecessorAbsence?: never;
  readonly predecessorBaseline: BP;
  readonly predecessorPassingGate: TypeContractCompileGatePointerV20<BP, D, DP>;
  readonly ownerReplacementDecision: GaOwnerDecisionAttestationReceipt & { readonly decision: "approve" };
  readonly predecessorCursor: TypeContractBaselineCursorReceiptV20<D, DP> & {
    readonly currentBaselineReceiptDigest: BP["digest"];
  };
  readonly successorCursor: TypeContractBaselineCursorReceiptV20<D, DP>;
  readonly singleWinnerCasCommitted: true;
}

type TypeContractCompileBaselineReceiptV20<
  D extends string,
  DP extends `distributions/${string}`,
> =
  | InitialTypeContractCompileBaselineReceiptV20<D, DP>
  | ReplacementTypeContractCompileBaselineReceiptV20<
      D,
      DP,
      TypeContractCompileBaselinePointerV20<D, DP>
    >;

interface TypeContractCompileGateReceiptV20<
  BP extends TypeContractCompileBaselinePointerV20<D, DP>,
  D extends string,
  DP extends `distributions/${string}`,
> extends ReceiptRef<"receipt:type-contract-compile-gate@20", readonly [BP, D, DP]> {
  readonly [typeContractCompileGateBrandV20]: never;
  readonly signedBaseline: BP;
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<D, DP>;
  readonly currentInvocationIdentity: TypeContractInvocationIdentityReceiptV20<D, DP>;
  readonly currentMetrics: TypeContractSourceMetricsV20;
  readonly exactParsedExtendedDiagnostics: ImportedOpaqueEvidenceLeafReceipt;
  readonly exactParsedProcessResourceUsage: ImportedOpaqueEvidenceLeafReceipt;
  readonly totalHandwrittenGeneratedAndPerPartitionArithmeticRecomputed: true;
  readonly absoluteBudgetOutcome: "pass";
  readonly signedBaselineRegressionOutcome: "pass";
  readonly currentHandwrittenSourceBudgetOutcome: "pass";
  readonly currentGeneratedSourceBudgetOutcome: "pass";
  readonly exactInvocationBaselineDistributionAndMetricSubjectByteEqual: true;
}

declare function commitInitialTypeContractCompileBaselineV20<
  const D extends string,
  const DP extends `distributions/${string}`,
>(input: {
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<D, DP>;
  readonly invocationIdentity: TypeContractInvocationIdentityReceiptV20<NoInfer<D>, NoInfer<DP>>;
  readonly measuredMetrics: TypeContractSourceMetricsV20;
  readonly genesisAuthority: TypeContractBaselineGenesisAuthorityReceiptV20<NoInfer<D>, NoInfer<DP>>;
  readonly predecessorAbsence: TypeContractBaselinePredecessorAbsenceReceiptV20<NoInfer<D>, NoInfer<DP>>;
  readonly predecessorCursor: TypeContractBaselineCursorReceiptV20<NoInfer<D>, NoInfer<DP>> & {
    readonly currentBaselineReceiptDigest: "none";
  };
  readonly exactCanonicalBaselineBytesMetricParserAndSingleWinnerCasEvidence: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<InitialTypeContractCompileBaselineReceiptV20<D, DP>>;

declare function commitReplacementTypeContractCompileBaselineV20<
  const D extends string,
  const DP extends `distributions/${string}`,
  const BP extends TypeContractCompileBaselinePointerV20<D, DP>,
>(input: {
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<D, DP>;
  readonly invocationIdentity: TypeContractInvocationIdentityReceiptV20<NoInfer<D>, NoInfer<DP>>;
  readonly measuredMetrics: TypeContractSourceMetricsV20;
  readonly predecessorBaseline: BP;
  readonly predecessorPassingGate: TypeContractCompileGatePointerV20<NoInfer<BP>, NoInfer<D>, NoInfer<DP>>;
  readonly ownerReplacementDecision: GaOwnerDecisionAttestationReceipt & { readonly decision: "approve" };
  readonly predecessorCursor: TypeContractBaselineCursorReceiptV20<NoInfer<D>, NoInfer<DP>> & {
    readonly currentBaselineReceiptDigest: BP["digest"];
  };
  readonly exactCanonicalBaselineBytesMetricParserAndSingleWinnerCasEvidence: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<ReplacementTypeContractCompileBaselineReceiptV20<D, DP, BP>>;

declare function commitTypeContractCompileGateV20<
  const D extends string,
  const DP extends `distributions/${string}`,
  const BP extends TypeContractCompileBaselinePointerV20<D, DP>,
>(input: {
  readonly signedBaseline: BP;
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<D, DP>;
  readonly currentInvocationIdentity: TypeContractInvocationIdentityReceiptV20<NoInfer<D>, NoInfer<DP>>;
  readonly exactExtendedDiagnosticsProcessMetricsAndPartitionInventory: readonly [
    ImportedOpaqueEvidenceLeafReceipt,
    ImportedOpaqueEvidenceLeafReceipt,
    ImportedOpaqueEvidenceLeafReceipt,
  ];
  readonly deterministicBudgetAndRegressionEvaluator: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<TypeContractCompileGateReceiptV20<BP, D, DP>>;

declare const localeDeliveryBundleBrandV20: unique symbol;

interface LocaleDeliveryBundleReceiptV20<
  D extends string,
  DP extends `distributions/${string}`,
> extends ReceiptRef<"receipt:locale-delivery-bundle@20", readonly [D, DP]> {
  readonly [localeDeliveryBundleBrandV20]: never;
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<D, DP>;
  readonly realLocaleFiles: readonly [
    "packages/console/src/locales/zh-CN/",
    "packages/console/src/locales/en-US/",
    "packages/console/src/locales/ar-SA/",
  ];
  readonly pseudoLocaleFiles: readonly ["packages/console/src/locales/en-XA/"];
  readonly exactLocaleTreeArtifactDigests: readonly [string, string, string, string];
  readonly arSaDirection: "rtl";
  readonly exactMessageKeyBijectionAcrossThreeRealLocales: true;
  readonly pseudoLocaleGeneratedOnlyFromCanonicalMessageKeys: true;
  readonly missingEmptyFallbackOrWrongDirectionLocaleCount: 0;
}

declare function commitLocaleDeliveryBundleV20<
  const D extends string,
  const DP extends `distributions/${string}`,
>(input: {
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<D, DP>;
  readonly exactFourLocaleDirectoryTrees: readonly [
    ImportedOpaqueEvidenceLeafReceipt,
    ImportedOpaqueEvidenceLeafReceipt,
    ImportedOpaqueEvidenceLeafReceipt,
    ImportedOpaqueEvidenceLeafReceipt,
  ];
  readonly deterministicMessageKeyRtlAndFallbackVerifier: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<LocaleDeliveryBundleReceiptV20<D, DP>>;

declare const accessibilityRequiredMatrixBrandV20: unique symbol;
declare const accessibilityPassedCellBrandV20: unique symbol;
declare const accessibilityPassedCellSetBrandV20: unique symbol;
declare const accessibilityReleaseClosureBrandV20: unique symbol;

interface GaAccessibilityRequiredMatrixReceiptV20<
  D extends string,
  DP extends `distributions/${string}`,
  PD extends string,
> extends ReceiptRef<"receipt:ga-accessibility-required-matrix@20", readonly [D, DP, PD]> {
  readonly [accessibilityRequiredMatrixBrandV20]: never;
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<D, DP>;
  readonly distributionArtifactDigest: D;
  readonly distributionTargetPath: DP;
  readonly policyTargetDigest: PD;
  readonly localeDeliveryBundle: LocaleDeliveryBundleReceiptV20<D, DP>;
  readonly policyAuthorization: ExactTufTargetAuthorizationReceiptV20<
    TufRepositoryIdentityReceipt<"policy">,
    "delegated:accessibility",
    "policies/accessibility/reference-matrix.v20.json",
    PD
  >;
  readonly userLocales: typeof GA_ACCESSIBILITY_USER_LOCALES_V19;
  readonly pseudoLocales: typeof GA_ACCESSIBILITY_PSEUDO_LOCALES_V19;
  readonly platforms: typeof GA_ACCESSIBILITY_PLATFORMS_V19;
  readonly presentations: typeof GA_ACCESSIBILITY_PRESENTATIONS_V19;
  readonly viewports: typeof GA_ACCESSIBILITY_VIEWPORTS_V19;
  readonly zooms: typeof GA_ACCESSIBILITY_ZOOMS_V19;
  readonly modalities: typeof GA_ACCESSIBILITY_MODALITIES_V19;
  readonly exactCartesianCellSetContentHandle: ReceiptPointerV20<
    "receipt:ga-accessibility-required-cell-set-content-handle@20",
    readonly [D, DP, PD]
  >;
  readonly exactCartesianCellKeySetDigest: string;
  readonly exactCartesianCellReceiptPointerSetDigest: string;
  readonly exactCartesianCellCount: 972;
  readonly missingDuplicateExtraOrCrossAxisCellCount: 0;
}

declare function commitGaAccessibilityRequiredMatrixV20<
  const D extends string,
  const DP extends `distributions/${string}`,
  const PD extends string,
>(input: {
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<D, DP>;
  readonly localeDeliveryBundle: LocaleDeliveryBundleReceiptV20<NoInfer<D>, NoInfer<DP>>;
  readonly policyAuthorization: ExactTufTargetAuthorizationReceiptV20<
    TufRepositoryIdentityReceipt<"policy">,
    "delegated:accessibility",
    "policies/accessibility/reference-matrix.v20.json",
    PD
  >;
  readonly deterministicCartesianGeneratorAndPolicyBytesVerifier: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<GaAccessibilityRequiredMatrixReceiptV20<D, DP, PD>>;

interface AnyGaAccessibilityRequiredMatrixReceiptV20 extends ReceiptRef<
  "receipt:ga-accessibility-required-matrix@20",
  unknown
> {
  readonly distributionIdentity: ReceiptRef<"receipt:distribution-artifact-identity@20", unknown>;
  readonly distributionArtifactDigest: string;
  readonly distributionTargetPath: `distributions/${string}`;
  readonly policyTargetDigest: string;
  readonly exactCartesianCellSetContentHandle: ReceiptPointerV20<
    "receipt:ga-accessibility-required-cell-set-content-handle@20",
    unknown
  >;
}

interface GaAccessibilityPassedCellReceiptV20<
  K extends GaAccessibilityRequiredCellKeyV19,
  M extends AnyGaAccessibilityRequiredMatrixReceiptV20,
> extends ReceiptRef<
  "receipt:ga-accessibility-passed-cell@20",
  readonly [K, ExactReceiptPointerForV20<M>]
> {
  readonly [accessibilityPassedCellBrandV20]: (key: K) => K;
  readonly requiredMatrix: ExactReceiptPointerForV20<M>;
  readonly exactRequiredCell: ReceiptPointerV20<"receipt:ga-accessibility-required-cell@19", K>;
  readonly exactRequiredCellKey: K;
  readonly distributionIdentity: ExactReceiptPointerForV20<M["distributionIdentity"]>;
  readonly passSnapshot: ExactReceiptPointerForV20<GaAccessibilityPassSnapshotReceiptV9>;
  readonly outcome: "pass";
  readonly domAccessibilityTreeFocusContrastZoomRtlAndInputEvidenceBoundToExactCell: true;
}

declare function commitGaAccessibilityPassedCellV20<
  const K extends GaAccessibilityRequiredCellKeyV19,
  const M extends AnyGaAccessibilityRequiredMatrixReceiptV20,
>(input: {
  readonly requiredMatrix: M;
  readonly exactRequiredCellKey: K & AiSupplySingleLiteralV20<K>;
  readonly exactRequiredCell: ReceiptPointerV20<"receipt:ga-accessibility-required-cell@19", NoInfer<K>>;
  readonly distributionIdentity: NoInfer<M>["distributionIdentity"];
  readonly rawPassSnapshot: GaAccessibilityPassSnapshotReceiptV9;
  readonly verifiedRequiredCellSetResolverEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly exactAxisSnapshotAndDistributionComparison: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<GaAccessibilityPassedCellReceiptV20<K, M>>;

interface GaAccessibilityPassedCellSetReceiptV20<
  M extends AnyGaAccessibilityRequiredMatrixReceiptV20,
> extends ReceiptRef<
  "receipt:ga-accessibility-passed-cell-set@20",
  ExactReceiptPointerForV20<M>
> {
  readonly [accessibilityPassedCellSetBrandV20]: never;
  readonly distributionIdentity: ExactReceiptPointerForV20<M["distributionIdentity"]>;
  readonly requiredMatrix: ExactReceiptPointerForV20<M>;
  readonly exactOrderedPassedCellPointers: readonly ReceiptPointerV20<
    "receipt:ga-accessibility-passed-cell@20",
    unknown
  >[];
  readonly exactOrderedPassedCellPointerSetDigest: string;
  readonly exactPassedCellCount: 972;
  readonly resolvedCellKeySetEqualsMatrixKeySetAndEveryCellPointsBackToThisExactMatrix: true;
  readonly missingDuplicateExtraFailedCrossCellCrossMatrixOrCrossDistributionCount: 0;
}

declare function commitGaAccessibilityPassedCellSetV20<
  const M extends AnyGaAccessibilityRequiredMatrixReceiptV20,
>(input: {
  readonly distributionIdentity: NoInfer<M>["distributionIdentity"];
  readonly requiredMatrix: M;
  readonly exactOrderedPassedCellPointers: readonly ReceiptPointerV20<
    "receipt:ga-accessibility-passed-cell@20",
    unknown
  >[];
  readonly verifiedCellReceiptResolverAndCanonicalPointerSetBytes: readonly [
    ImportedOpaqueEvidenceLeafReceipt,
    ImportedOpaqueEvidenceLeafReceipt,
  ];
  readonly deterministicExactKeySetMatrixBackPointerAndDistributionVerifier: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<GaAccessibilityPassedCellSetReceiptV20<M>>;

interface GaAccessibilityReleaseClosureReceiptV20<
  M extends AnyGaAccessibilityRequiredMatrixReceiptV20,
> extends ReceiptRef<"receipt:ga-accessibility-release-closure@20", ExactReceiptPointerForV20<M>> {
  readonly [accessibilityReleaseClosureBrandV20]: never;
  readonly distributionIdentity: ExactReceiptPointerForV20<M["distributionIdentity"]>;
  readonly requiredMatrix: ExactReceiptPointerForV20<M>;
  readonly passedCellSet: ExactReceiptPointerForV20<GaAccessibilityPassedCellSetReceiptV20<M>>;
  readonly exactPassedCellCount: 972;
  readonly missingDuplicateExtraFailedCrossCellCrossMatrixOrCrossDistributionCount: 0;
}

declare function commitGaAccessibilityReleaseClosureV20<
  const M extends AnyGaAccessibilityRequiredMatrixReceiptV20,
>(input: {
  readonly distributionIdentity: NoInfer<M>["distributionIdentity"];
  readonly requiredMatrix: M;
  readonly passedCellSet: GaAccessibilityPassedCellSetReceiptV20<NoInfer<M>>;
  readonly deterministicExactKeySetAndPrivateBrandVerifier: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<GaAccessibilityReleaseClosureReceiptV20<M>>;

declare const ownerFreshQualificationBrandV20: unique symbol;
declare const ownerMigrationPositiveBrandV20: unique symbol;
declare const ownerMigrationAbsenceBrandV20: unique symbol;
declare const ownerOnboardingQualificationBrandV20: unique symbol;

interface OwnerFreshOnboardingQualificationReceiptV20<
  R extends OwnerAdditionalRequirementV4,
  D extends string,
  DP extends `distributions/${string}`,
> extends ReceiptRef<"receipt:owner-fresh-onboarding-qualification@20", readonly [R, D, DP]> {
  readonly [ownerFreshQualificationBrandV20]: never;
  readonly ownerRequirement: R & { readonly onboardingAvailability: "fresh_onboarding_default" };
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<D, DP>;
  readonly exactConversationOrExecutionReadyJourneyGate: ReceiptRef<
    "receipt:owner-fresh-ready-journey-gate@20",
    readonly [R, D, DP]
  >;
  readonly migrationPositiveGate?: never;
  readonly migrationAbsenceGate?: never;
  readonly freshPickerEntryCount: 1;
  readonly computedOutcome: "completed_pass";
}

interface OwnerMigrationPositiveGateReceiptV20<
  R extends OwnerAdditionalRequirementV4,
  D extends string,
  DP extends `distributions/${string}`,
> extends ReceiptRef<"receipt:owner-migration-positive-gate@20", readonly [R, D, DP]> {
  readonly [ownerMigrationPositiveBrandV20]: never;
  readonly ownerRequirement: R & { readonly onboardingAvailability: "existing_connection_migration_only" };
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<D, DP>;
  readonly exactMigrationDispositionCommittedJourneyGate: ReceiptRef<
    "receipt:owner-migration-disposition-committed-gate@20",
    readonly [R, D, DP]
  >;
  readonly freshPickerEntryCount: 0;
  readonly computedOutcome: "completed_pass";
}

interface OwnerMigrationAbsenceGateReceiptV20<
  R extends OwnerAdditionalRequirementV4,
  D extends string,
  DP extends `distributions/${string}`,
> extends ReceiptRef<"receipt:owner-migration-absence-gate@20", readonly [R, D, DP]> {
  readonly [ownerMigrationAbsenceBrandV20]: never;
  readonly ownerRequirement: R & { readonly onboardingAvailability: "existing_connection_migration_only" };
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<D, DP>;
  readonly noExistingConnectionRun: ReceiptRef<"receipt:owner-no-existing-connection-run@20", readonly [R, D, DP]>;
  readonly freshPickerEntryCount: 0;
  readonly accountCredentialBillingNetworkAndProviderEffectCount: 0;
  readonly primaryAction: "choose_another_source_or_open_existing_connection_migration_help";
  readonly computedOutcome: "completed_pass";
}

type OwnerModeSpecificOnboardingQualificationReceiptV20<
  R extends OwnerAdditionalRequirementV4,
  D extends string,
  DP extends `distributions/${string}`,
> = R["onboardingAvailability"] extends "existing_connection_migration_only"
  ? readonly [OwnerMigrationPositiveGateReceiptV20<R, D, DP>, OwnerMigrationAbsenceGateReceiptV20<R, D, DP>]
  : readonly [OwnerFreshOnboardingQualificationReceiptV20<R, D, DP>];

interface OwnerOnboardingQualificationReceiptV20<
  R extends OwnerAdditionalRequirementV4,
  D extends string,
  DP extends `distributions/${string}`,
> extends ReceiptRef<"receipt:owner-onboarding-qualification@20", readonly [R, D, DP]> {
  readonly [ownerOnboardingQualificationBrandV20]: never;
  readonly ownerRequirement: R;
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<D, DP>;
  readonly compilerDerivedOnboardingAvailability: R["onboardingAvailability"];
  readonly exactModeSpecificQualification: OwnerModeSpecificOnboardingQualificationReceiptV20<R, D, DP>;
  readonly freshMigrationPositiveAndMigrationAbsenceBranchCount: R["onboardingAvailability"] extends "existing_connection_migration_only" ? 2 : 1;
  readonly crossRequirementModeOrDistributionAttachmentCount: 0;
}

declare function commitOwnerFreshOnboardingQualificationV20<
  const R extends OwnerAdditionalRequirementV4 & { readonly onboardingAvailability: "fresh_onboarding_default" },
  const D extends string,
  const DP extends `distributions/${string}`,
>(input: {
  readonly ownerRequirement: R;
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<D, DP>;
  readonly exactConversationOrExecutionReadyJourneyGate: OwnerFreshOnboardingQualificationReceiptV20<R, D, DP>["exactConversationOrExecutionReadyJourneyGate"];
  readonly exactCompilerJourneyAndDistributionComparison: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<OwnerFreshOnboardingQualificationReceiptV20<R, D, DP>>;

declare function commitOwnerMigrationPositiveGateV20<
  const R extends OwnerAdditionalRequirementV4 & { readonly onboardingAvailability: "existing_connection_migration_only" },
  const D extends string,
  const DP extends `distributions/${string}`,
>(input: {
  readonly ownerRequirement: R;
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<D, DP>;
  readonly exactMigrationDispositionCommittedJourneyGate: OwnerMigrationPositiveGateReceiptV20<R, D, DP>["exactMigrationDispositionCommittedJourneyGate"];
  readonly exactCompilerJourneyAndDistributionComparison: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<OwnerMigrationPositiveGateReceiptV20<R, D, DP>>;

declare function commitOwnerMigrationAbsenceGateV20<
  const R extends OwnerAdditionalRequirementV4 & { readonly onboardingAvailability: "existing_connection_migration_only" },
  const D extends string,
  const DP extends `distributions/${string}`,
>(input: {
  readonly ownerRequirement: R;
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<D, DP>;
  readonly noExistingConnectionRun: OwnerMigrationAbsenceGateReceiptV20<R, D, DP>["noExistingConnectionRun"];
  readonly exactUiNetworkCredentialBillingAndEffectEventInventory: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<OwnerMigrationAbsenceGateReceiptV20<R, D, DP>>;

declare function commitOwnerOnboardingQualificationV20<
  const R extends OwnerAdditionalRequirementV4,
  const D extends string,
  const DP extends `distributions/${string}`,
>(input: {
  readonly ownerRequirement: R;
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<D, DP>;
  readonly exactModeSpecificQualification: OwnerModeSpecificOnboardingQualificationReceiptV20<NoInfer<R>, NoInfer<D>, NoInfer<DP>>;
  readonly exactCompilerModeKeyAndDistributionBijectionEvidence: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<OwnerOnboardingQualificationReceiptV20<R, D, DP>>;

// ===== 来源:4. 目标架构 / 4.16.8 v20 单一公共真相与根因闭包 =====
// 原文档行 42461-43313 (共 853 行)
declare const fixedSupportClaimSetBrandV20: unique symbol;
declare const publishedOwnerClaimBrandV20: unique symbol;
declare const publishedSupportClaimSetBrandV20: unique symbol;

type OwnerRequirementCompilationPointerV20 = ReceiptPointerV20<
  "receipt:owner-additional-requirement-set-compilation@7",
  readonly [readonly OwnerAdditionalRequirementInputV7[], readonly OwnerAdditionalRequirementV4[]]
>;

type OwnerRequirementTupleFromCompilationPointerV20<
  OC extends OwnerRequirementCompilationPointerV20,
> = OC extends ReceiptPointerV20<
  "receipt:owner-additional-requirement-set-compilation@7",
  readonly [readonly OwnerAdditionalRequirementInputV7[], infer R extends readonly OwnerAdditionalRequirementV4[]]
>
  ? R
  : never;

type FixedPublishedSupportClaimMapV20<
  D extends string,
> = {
  readonly [K in ReferenceRequirementKeyV3]: ReceiptPointerV20<
    "receipt:published-product-protocol-claim-index@9",
    readonly [K, D]
  >;
};

interface FixedPublishedSupportClaimSetReceiptV20<
  D extends string,
  DP extends `distributions/${string}`,
> extends ReceiptRef<"receipt:fixed-published-support-claim-set@20", readonly [D, DP]> {
  readonly [fixedSupportClaimSetBrandV20]: never;
  readonly distributionIdentity: ReceiptPointerV20<"receipt:distribution-artifact-identity@20", readonly [D, DP]>;
  readonly exactReferenceRequirementsContentHandle: ReceiptPointerV20<
    "receipt:reference-requirements-content-handle@20",
    D
  >;
  readonly exactConnectionOracleContentHandle: ReceiptPointerV20<
    "receipt:reference-connection-oracle-content-handle@20",
    D
  >;
  readonly exactClaimsByRequirementKey: FixedPublishedSupportClaimMapV20<D>;
  readonly exactOrderedRequirementKeys: readonly ReferenceRequirementKeyV3[];
  readonly exactClaimCount: 81;
  readonly missingDuplicateExtraCrossRowOracleQualificationOrDistributionCount: 0;
}

declare function commitFixedPublishedSupportClaimSetV20<
  const D extends string,
  const DP extends `distributions/${string}`,
>(input: {
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<D, DP>;
  readonly legacyTypedReferenceClaims: ReceiptPointerV20<"receipt:published-product-protocol-claim-set@6", D>;
  readonly exactReferenceRequirementsAndConnectionOracleBytes: readonly [
    ImportedOpaqueEvidenceLeafReceipt,
    ImportedOpaqueEvidenceLeafReceipt,
  ];
  readonly deterministicExactKeyClaimQualificationAndDistributionCompiler: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<FixedPublishedSupportClaimSetReceiptV20<D, DP>>;

interface PublishedOwnerProductProtocolClaimReceiptV20<
  R extends OwnerAdditionalRequirementV4,
  D extends string,
  DP extends `distributions/${string}`,
> extends ReceiptRef<"receipt:published-owner-product-protocol-claim@20", readonly [R, D, DP]> {
  readonly [publishedOwnerClaimBrandV20]: never;
  readonly ownerRequirement: R;
  readonly requirementKey: R["requirementKey"];
  readonly exactConnectionOracle: R["connectionOracle"];
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<D, DP>;
  readonly baseQualification: OwnerRequirementQualificationReceiptV19<R, D>;
  readonly onboardingQualification: OwnerOnboardingQualificationReceiptV20<R, D, DP>;
  readonly onboardingAvailability: R["onboardingAvailability"];
  readonly freshPickerVisibility: R["onboardingAvailability"] extends "existing_connection_migration_only" ? "hidden" : "visible";
  readonly currentRuntimeReadinessMustStillBeDerived: true;
  readonly cannotShadowReplaceMergeOrWeakenAnyFixedClaim: true;
}

declare function commitPublishedOwnerProductProtocolClaimV20<
  const R extends OwnerAdditionalRequirementV4,
  const D extends string,
  const DP extends `distributions/${string}`,
>(input: {
  readonly ownerRequirement: R;
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<D, DP>;
  readonly baseQualification: OwnerRequirementQualificationReceiptV19<NoInfer<R>, NoInfer<D>>;
  readonly onboardingQualification: OwnerOnboardingQualificationReceiptV20<NoInfer<R>, NoInfer<D>, NoInfer<DP>>;
  readonly exactRequirementOracleQualificationModeAndDistributionComparison: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<PublishedOwnerProductProtocolClaimReceiptV20<R, D, DP>>;

type OwnerPublishedClaimTupleForRequirementsV20<
  R extends readonly OwnerAdditionalRequirementV4[],
  D extends string,
  DP extends `distributions/${string}`,
> = {
  readonly [I in keyof R]: R[I] extends OwnerAdditionalRequirementV4
    ? PublishedOwnerProductProtocolClaimReceiptV20<R[I], D, DP>
    : R[I];
};

type OwnerPublishedClaimTupleForCompilationV20<
  C extends OwnerAdditionalRequirementSetCompilationReceiptV4,
  D extends string,
  DP extends `distributions/${string}`,
> = OwnerPublishedClaimTupleForRequirementsV20<C["ownerRequirements"], D, DP>;

type OwnerPublishedClaimPointerTupleForCompilationV20<
  C extends OwnerAdditionalRequirementSetCompilationReceiptV4,
  D extends string,
  DP extends `distributions/${string}`,
> = {
  readonly [I in keyof OwnerPublishedClaimTupleForCompilationV20<C, D, DP>]:
    OwnerPublishedClaimTupleForCompilationV20<C, D, DP>[I] extends ReceiptRef
      ? ExactReceiptPointerForV20<OwnerPublishedClaimTupleForCompilationV20<C, D, DP>[I]>
      : OwnerPublishedClaimTupleForCompilationV20<C, D, DP>[I];
};

type OwnerPublishedClaimPointerTupleForCompilationPointerV20<
  OC extends OwnerRequirementCompilationPointerV20,
  D extends string,
  DP extends `distributions/${string}`,
> = {
  readonly [I in keyof OwnerRequirementTupleFromCompilationPointerV20<OC>]:
    OwnerRequirementTupleFromCompilationPointerV20<OC>[I] extends OwnerAdditionalRequirementV4
      ? ReceiptPointerV20<
          "receipt:published-owner-product-protocol-claim@20",
          readonly [OwnerRequirementTupleFromCompilationPointerV20<OC>[I], D, DP]
        >
      : OwnerRequirementTupleFromCompilationPointerV20<OC>[I];
};

interface PublishedSupportClaimSetReceiptV20<
  OC extends OwnerRequirementCompilationPointerV20,
  D extends string,
  DP extends `distributions/${string}`,
> extends ReceiptRef<
  "receipt:published-support-claim-set@20",
  readonly [OC, D, DP]
> {
  readonly [publishedSupportClaimSetBrandV20]: never;
  readonly distributionIdentity: ReceiptPointerV20<"receipt:distribution-artifact-identity@20", readonly [D, DP]>;
  readonly fixedClaims: ExactReceiptPointerForV20<FixedPublishedSupportClaimSetReceiptV20<D, DP>>;
  readonly ownerRequirementCompilation: OC;
  readonly ownerClaims: OwnerPublishedClaimPointerTupleForCompilationPointerV20<OC, D, DP>;
  readonly fixedRequirementKeys: readonly ReferenceRequirementKeyV3[];
  readonly ownerRequirementKeys: readonly OwnerRequirementKeyV4[];
  readonly exactCombinedOrderedClaimCount: number;
  readonly fixedClaimCount: 81;
  readonly ownerClaimCount: OwnerRequirementTupleFromCompilationPointerV20<OC>["length"];
  readonly missingDuplicateExtraCollisionModeQualificationOrDistributionCount: 0;
  readonly provesFixedClaimsRemainExactAndOwnerClaimsAreAnAppendOnlyBijectionWithCompilerRows: true;
}

declare function commitPublishedSupportClaimSetV20<
  const D extends string,
  const DP extends `distributions/${string}`,
  const OC extends OwnerRequirementCompilationPointerV20,
>(input: {
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<D, DP>;
  readonly fixedClaims: ExactReceiptPointerForV20<FixedPublishedSupportClaimSetReceiptV20<NoInfer<D>, NoInfer<DP>>>;
  readonly ownerRequirementCompilation: OC;
  readonly ownerClaims: OwnerPublishedClaimPointerTupleForCompilationPointerV20<NoInfer<OC>, NoInfer<D>, NoInfer<DP>>;
  readonly deterministicCombinedKeyOrderAndExactBijectionVerifier: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<PublishedSupportClaimSetReceiptV20<OC, D, DP>>;

const AI_SUPPLY_RELEASE_SUITE_IDS_V20 = [
  "type-contract-compile-budget.model",
  "oauth-state-machine.tck",
  "receipt-dag-and-anchor.model",
  "pre-intent-authority-closure.model",
  "reference-monitor-writer-fence.model",
  "conformance-round-closure.model",
  "persistent-budget-ledger.model",
  "ledger-report-correction.model",
  "usage-dimension-fold.tck",
  "metadata-health-admission.tck",
  "provider-wire-auth-regression.tck",
  "capability-slot-funding.tck",
  "passive-loopback-peer.tck",
  "discovery-conformance.tck",
  "local-preload-state-machine.model",
  "local-product-journeys.tck",
  "execution-surface-chain.tck",
  "execution-tool-child-lease.model",
  "bridge-conformance.tck",
  "conformance-two-round-budget.model",
  "workload-identity-signing.tck",
  "plugin-budget-state-machine.tck",
  "platform-anchor-offline-mode.tck",
  "local-data-locality.tck",
  "evidence-orphan-recovery.chaos",
  "realm-and-ga-binding.tck",
  "provider-account-cleanup-operation-matrix.model",
  "tuf-root-role-rollback.tck",
  "runtime-route-terminal-fold.model",
  "owner-extension-fresh-consumer.tck",
  "accessibility-rtl-cartesian.tck",
  "release-distribution-cross-swap.model",
  "local-control-authorization.tck",
  "runtime-child-registry-migration.model",
  "transport-credential-boundary.tck",
  "inference-funding-attempt.model",
  "provider-test-account-pool.model",
] as const;

type AiSupplyReleaseSuiteIdV20 = (typeof AI_SUPPLY_RELEASE_SUITE_IDS_V20)[number];

type AiSupplySuiteStepRowV20<
  I extends AiSupplyReleaseSuiteIdV20,
  P extends string,
> = {
  readonly stepId: `suite:${I}`;
  readonly kind: "suite";
  readonly argv: readonly ["pnpm", "exec", "vitest", "run", `e2e/smoke/${I}`];
  readonly predecessorStepId: P;
  readonly shell: false;
};

type AiSupplySuiteStepTupleV20<
  T extends readonly AiSupplyReleaseSuiteIdV20[],
  P extends string = "preflight_open",
> = T extends readonly [
  infer H extends AiSupplyReleaseSuiteIdV20,
  ...infer R extends readonly AiSupplyReleaseSuiteIdV20[],
]
  ? readonly [AiSupplySuiteStepRowV20<H, P>, ...AiSupplySuiteStepTupleV20<R, `suite:${H}`>]
  : readonly [];

type AiSupplyLastSuiteIdV20<T extends readonly AiSupplyReleaseSuiteIdV20[]> =
  T extends readonly [...readonly AiSupplyReleaseSuiteIdV20[], infer L extends AiSupplyReleaseSuiteIdV20]
    ? L
    : never;

type AiSupplyExactOrderedBomRowsV20 = readonly [
  {
    readonly stepId: "preflight_open";
    readonly kind: "preflight";
    readonly argv: readonly ["pnpm", "exec", "tsx", "scripts/ai-supply-preflight.ts", "--stage", "open"];
    readonly predecessorStepId: "none";
    readonly shell: false;
  },
  ...AiSupplySuiteStepTupleV20<typeof AI_SUPPLY_RELEASE_SUITE_IDS_V20>,
  {
    readonly stepId: "preflight_close";
    readonly kind: "preflight";
    readonly argv: readonly ["pnpm", "exec", "tsx", "scripts/ai-supply-preflight.ts", "--stage", "close"];
    readonly predecessorStepId: `suite:${AiSupplyLastSuiteIdV20<typeof AI_SUPPLY_RELEASE_SUITE_IDS_V20>}`;
    readonly shell: false;
  },
];

type AiSupplyCanonicalStepRowV20 = AiSupplyExactOrderedBomRowsV20[number];

type _V20ReleaseSuiteCountExactly37 = ContractAssert<ExactTypeEqualV7<
  typeof AI_SUPPLY_RELEASE_SUITE_IDS_V20["length"],
  37
>>;
type _V20BomRowsExactlyPreflightPlus37SuitesPlusClose = ContractAssert<ExactTypeEqualV7<
  AiSupplyExactOrderedBomRowsV20["length"],
  39
>>;

declare const signedExpectedBomBrandV20: unique symbol;
declare const orchestratorGenesisBrandV20: unique symbol;
declare const stepTerminalBrandV20: unique symbol;
declare const successfulOrchestratorBrandV20: unique symbol;
declare const failedOrchestratorBrandV20: unique symbol;

interface AnyAiSupplySignedExpectedBomReceiptV20 extends ReceiptRef<
  "receipt:ai-supply-signed-expected-bom@20",
  unknown
> {
  readonly distributionIdentity: ReceiptRef<"receipt:distribution-artifact-identity@20", unknown>;
  readonly exactOrderedRows: AiSupplyExactOrderedBomRowsV20;
}

interface AiSupplySignedExpectedBomReceiptV20<
  D extends string,
  DP extends `distributions/${string}`,
  BD extends string,
> extends ReceiptRef<"receipt:ai-supply-signed-expected-bom@20", readonly [D, DP, BD]> {
  readonly [signedExpectedBomBrandV20]: never;
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<D, DP>;
  readonly canonicalSuiteIds: typeof AI_SUPPLY_RELEASE_SUITE_IDS_V20;
  readonly exactOrderedRows: AiSupplyExactOrderedBomRowsV20;
  readonly policyAuthorization: ExactTufTargetAuthorizationReceiptV20<
    TufRepositoryIdentityReceipt<"policy">,
    "delegated:release-gates",
    "policies/release/ai-supply-bom.v20.json",
    BD
  >;
  readonly canonicalRowsDigest: BD;
  readonly suiteIdMissingDuplicateOrExtraCount: 0;
  readonly exactOrderedRowCount: 39;
  readonly everyArgvIsAnArrayAndShellIsFalse: true;
}

declare function commitAiSupplySignedExpectedBomV20<
  const D extends string,
  const DP extends `distributions/${string}`,
  const BD extends string,
>(input: {
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<D, DP>;
  readonly canonicalSuiteIds: typeof AI_SUPPLY_RELEASE_SUITE_IDS_V20;
  readonly canonicalBomBytes: TufRawTargetBytesEvidenceReceipt<TufRepositoryIdentityReceipt<"policy">> & {
    readonly targetPath: "policies/release/ai-supply-bom.v20.json";
    readonly targetDigest: BD;
  };
  readonly policyAuthorization: ExactTufTargetAuthorizationReceiptV20<
    TufRepositoryIdentityReceipt<"policy">,
    "delegated:release-gates",
    "policies/release/ai-supply-bom.v20.json",
    BD
  >;
  readonly deterministicExpansionDagArgvAndDistributionVerifier: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<AiSupplySignedExpectedBomReceiptV20<D, DP, BD>>;

interface AiSupplyOrchestratorGenesisReceiptV20<
  B extends AnyAiSupplySignedExpectedBomReceiptV20,
> extends ReceiptRef<"receipt:ai-supply-orchestrator-genesis@20", B> {
  readonly [orchestratorGenesisBrandV20]: never;
  readonly signedExpectedBom: B;
  readonly distributionIdentity: B["distributionIdentity"];
  readonly exactRunnerEnvironmentAndNoPriorStepEvidence: ImportedOpaqueEvidenceLeafReceipt;
}

type AiSupplyDeclaredPredecessorRowV20<R extends AiSupplyCanonicalStepRowV20> =
  R["predecessorStepId"] extends infer P extends string
    ? P extends "none"
      ? never
      : Extract<AiSupplyCanonicalStepRowV20, { readonly stepId: P }>
    : never;

type AiSupplyPassedPredecessorV20<
  B extends AnyAiSupplySignedExpectedBomReceiptV20,
  R extends AiSupplyCanonicalStepRowV20,
> = [AiSupplyDeclaredPredecessorRowV20<R>] extends [never]
  ? {
      readonly genesis: AiSupplyOrchestratorGenesisReceiptV20<B>;
      readonly predecessorTerminal?: never;
    }
  : {
      readonly genesis?: never;
      readonly predecessorTerminal: ReceiptRef<
        "receipt:ai-supply-step-terminal@20",
        readonly [B, AiSupplyDeclaredPredecessorRowV20<R>]
      > & {
        readonly [stepTerminalBrandV20]: (row: AiSupplyDeclaredPredecessorRowV20<R>) => AiSupplyDeclaredPredecessorRowV20<R>;
        readonly signedExpectedBom: B;
        readonly distributionIdentity: B["distributionIdentity"];
        readonly row: AiSupplyDeclaredPredecessorRowV20<R>;
        readonly outcome: "passed";
        readonly exitCode: 0;
      };
    };

type AiSupplyFailedPredecessorV20<
  B extends AnyAiSupplySignedExpectedBomReceiptV20,
  R extends AiSupplyCanonicalStepRowV20,
> = [AiSupplyDeclaredPredecessorRowV20<R>] extends [never]
  ? never
  : {
      readonly predecessorTerminal: ReceiptRef<
        "receipt:ai-supply-step-terminal@20",
        readonly [B, AiSupplyDeclaredPredecessorRowV20<R>]
      > & {
        readonly [stepTerminalBrandV20]: (row: AiSupplyDeclaredPredecessorRowV20<R>) => AiSupplyDeclaredPredecessorRowV20<R>;
        readonly signedExpectedBom: B;
        readonly distributionIdentity: B["distributionIdentity"];
        readonly row: AiSupplyDeclaredPredecessorRowV20<R>;
        readonly outcome: "failed" | "not_run_due_to_predecessor_failure";
      };
    };

type AiSupplyStepTerminalReceiptV20<
  B extends AnyAiSupplySignedExpectedBomReceiptV20,
  R extends AiSupplyCanonicalStepRowV20,
> = ReceiptRef<"receipt:ai-supply-step-terminal@20", readonly [B, R]> & {
  readonly [stepTerminalBrandV20]: (row: R) => R;
  readonly signedExpectedBom: B;
  readonly distributionIdentity: B["distributionIdentity"];
  readonly row: R;
  readonly exactArgv: R["argv"];
  readonly shell: false;
  readonly rawProcessTerminalEvidence: ImportedOpaqueEvidenceLeafReceipt;
} & (
  | ({ readonly outcome: "passed"; readonly exitCode: 0 } & AiSupplyPassedPredecessorV20<B, R>)
  | ({ readonly outcome: "failed"; readonly exitCode: NonzeroExitCodeV19 } & AiSupplyPassedPredecessorV20<B, R>)
  | ({ readonly outcome: "not_run_due_to_predecessor_failure"; readonly exitCode?: never } & AiSupplyFailedPredecessorV20<B, R>)
);

declare function commitAiSupplyOrchestratorGenesisV20<
  const B extends AnyAiSupplySignedExpectedBomReceiptV20,
>(input: {
  readonly signedExpectedBom: B;
  readonly exactRunnerEnvironmentAndNoPriorStepEvidence: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<AiSupplyOrchestratorGenesisReceiptV20<B>>;

declare function commitAiSupplyPassedStepTerminalV20<
  const B extends AnyAiSupplySignedExpectedBomReceiptV20,
  const R extends B["exactOrderedRows"][number],
>(input: {
  readonly signedExpectedBom: B;
  readonly row: R;
  readonly exactSpawnArgvEnvironmentRunnerAndExitEvidence: ImportedOpaqueEvidenceLeafReceipt;
} & AiSupplyPassedPredecessorV20<B, R>): DeepFrozenCommittedReceiptV1<
  Extract<AiSupplyStepTerminalReceiptV20<B, R>, { readonly outcome: "passed" }>
>;

declare function commitAiSupplyFailedStepTerminalV20<
  const B extends AnyAiSupplySignedExpectedBomReceiptV20,
  const R extends B["exactOrderedRows"][number],
>(input: {
  readonly signedExpectedBom: B;
  readonly row: R;
  readonly exactSpawnArgvEnvironmentRunnerAndNonzeroExitEvidence: ImportedOpaqueEvidenceLeafReceipt;
} & AiSupplyPassedPredecessorV20<B, R>): DeepFrozenCommittedReceiptV1<
  Extract<AiSupplyStepTerminalReceiptV20<B, R>, { readonly outcome: "failed" }>
>;

declare function commitAiSupplyNotRunStepTerminalV20<
  const B extends AnyAiSupplySignedExpectedBomReceiptV20,
  const R extends B["exactOrderedRows"][number],
>(input: {
  readonly signedExpectedBom: B;
  readonly row: R;
  readonly provesNoProcessWasSpawnedForThisRow: ImportedOpaqueEvidenceLeafReceipt;
} & AiSupplyFailedPredecessorV20<B, R>): DeepFrozenCommittedReceiptV1<
  Extract<AiSupplyStepTerminalReceiptV20<B, R>, { readonly outcome: "not_run_due_to_predecessor_failure" }>
>;

type AiSupplyPassedStepTupleV20<
  B extends AnyAiSupplySignedExpectedBomReceiptV20,
> = {
  readonly [I in keyof B["exactOrderedRows"]]: B["exactOrderedRows"][I] extends AiSupplyCanonicalStepRowV20
    ? Extract<AiSupplyStepTerminalReceiptV20<B, B["exactOrderedRows"][I]>, { readonly outcome: "passed" }>
    : B["exactOrderedRows"][I];
};

type AiSupplyPassedStepPointerTupleV20<
  B extends AnyAiSupplySignedExpectedBomReceiptV20,
> = {
  readonly [I in keyof B["exactOrderedRows"]]: B["exactOrderedRows"][I] extends AiSupplyCanonicalStepRowV20
    ? ExactReceiptPointerForV20<
        Extract<AiSupplyStepTerminalReceiptV20<B, B["exactOrderedRows"][I]>, { readonly outcome: "passed" }>
      >
    : B["exactOrderedRows"][I];
};

interface AiSupplySuccessfulOrchestratorTerminalReceiptV20<
  B extends AnyAiSupplySignedExpectedBomReceiptV20,
> extends ReceiptRef<"receipt:ai-supply-orchestrator-terminal@20", ExactReceiptPointerForV20<B>> {
  readonly [successfulOrchestratorBrandV20]: never;
  readonly signedExpectedBom: ExactReceiptPointerForV20<B>;
  readonly distributionIdentity: ExactReceiptPointerForV20<B["distributionIdentity"]>;
  readonly exactOrderedStepTerminals: AiSupplyPassedStepPointerTupleV20<B>;
  readonly passedStepCount: 39;
  readonly failedOrNotRunStepCount: 0;
  readonly overallOutcome: "completed_pass";
}

interface AiSupplyFailedOrchestratorTerminalReceiptV20<
  B extends AnyAiSupplySignedExpectedBomReceiptV20,
> extends ReceiptRef<"receipt:ai-supply-orchestrator-failed-terminal@20", B> {
  readonly [failedOrchestratorBrandV20]: never;
  readonly signedExpectedBom: B;
  readonly distributionIdentity: B["distributionIdentity"];
  readonly exactOrderedStepTerminals: {
    readonly [I in keyof B["exactOrderedRows"]]: B["exactOrderedRows"][I] extends AiSupplyCanonicalStepRowV20
      ? AiSupplyStepTerminalReceiptV20<B, B["exactOrderedRows"][I]>
      : B["exactOrderedRows"][I];
  };
  readonly firstFailureRowId: AiSupplyCanonicalStepRowV20["stepId"];
  readonly passedPrefixThenOneFailureThenOnlyNotRunWasVerified: true;
  readonly overallOutcome: "completed_fail";
  readonly releasePromotionEligible: false;
}

declare function commitAiSupplySuccessfulOrchestratorTerminalV20<
  const B extends AnyAiSupplySignedExpectedBomReceiptV20,
>(input: {
  readonly signedExpectedBom: B;
  readonly exactOrderedStepTerminals: AiSupplyPassedStepTupleV20<B>;
  readonly deterministicExactTupleBomAndDistributionVerifier: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<AiSupplySuccessfulOrchestratorTerminalReceiptV20<B>>;

declare function commitAiSupplyFailedOrchestratorTerminalV20<
  const B extends AnyAiSupplySignedExpectedBomReceiptV20,
>(input: {
  readonly signedExpectedBom: B;
  readonly exactOrderedStepTerminals: AiSupplyFailedOrchestratorTerminalReceiptV20<B>["exactOrderedStepTerminals"];
  readonly deterministicFirstFailureAndNoSuccessorSpawnVerifier: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<AiSupplyFailedOrchestratorTerminalReceiptV20<B>>;

const AI_SUPPLY_PUBLIC_PRODUCER_IDS_V20 = [
  "verifyAiSupplyWireEnvelopeV20",
  "executeAiSupplyPublicOperationV20",
  "verifyAiSupplyReleaseBundleV20",
  "compileAndCommitAiSupplyPublicContractV20",
  "compileAndCommitReceiptEdgeManifestV20",
] as const;

type AiSupplyPublicProducerIdV20 = (typeof AI_SUPPLY_PUBLIC_PRODUCER_IDS_V20)[number];

const AI_SUPPLY_PUBLIC_RECEIPT_GRAPH_ROOT_KINDS_V20 = [
  "receipt:ai-supply-verified-wire-envelope@20",
  "receipt:ai-supply-public-operation-result@20",
  "receipt:ai-supply-release-bundle-verification@20",
  "receipt:ai-supply-public-contract-compilation@20",
  "receipt:receipt-edge-manifest@20",
] as const;

type AiSupplyPublicReceiptGraphRootKindV20 =
  (typeof AI_SUPPLY_PUBLIC_RECEIPT_GRAPH_ROOT_KINDS_V20)[number];

const AI_SUPPLY_CONTRACT_POSITIVE_FIXTURE_IDS_V20 = [
  "canonical-wire-roundtrip",
  "union-decoder-distribution",
  "inference-ir-content-event-correlation",
  "before-send-terminal",
  "after-send-terminal",
  "fallback-multi-attempt-history",
  "legacy-invalid-unreadable-quarantine",
  "codex-command-auth-refresh-lifecycle",
  "owner-fresh-and-migration-branches",
  "extension-protocol-literal-conformance",
  "support-claim-artifact-release-chain",
  "ecosystem-release-binding",
  "a11y-exact-cell-producer",
  "successful-bom-orchestrator",
  "baseline-bootstrap-approved-replacement",
  "custom-base-url-three-core-protocols",
  "tencent-enterprise-token-plan-four-row-matrix",
] as const;

const AI_SUPPLY_CONTRACT_NEGATIVE_FIXTURE_IDS_V20 = [
  "cross-distribution-artifact",
  "union-distribution-inference",
  "before-after-send-swap",
  "fallback-delivery-unknown-advance",
  "fallback-predecessor-erasure",
  "cross-subject-compute-policy",
  "cross-subject-rights-action",
  "invalid-legacy-child-not-quarantined",
  "owner-migration-as-fresh",
  "owner-migration-missing-absence",
  "a11y-brand-object-spread",
  "bom-string-argv",
  "bom-cross-distribution-terminal",
  "baseline-unapproved-rebootstrap",
  "inference-ir-value-digest-mismatch",
  "inference-event-cross-request-attempt",
  "legacy-quarantine-cross-index",
  "codex-auth-retry-as-fixed-interval",
  "codex-refresh-retirement-cross-lease",
  "extension-protocol-cross-plane",
  "support-claim-cross-distribution",
  "release-binding-cross-witness-time",
  "custom-base-url-protocol-guess",
  "token-plan-personal-direct-activation",
  "token-plan-enterprise-cross-region-or-protocol",
] as const;

// 这42个ID是实施期必须真实提交的独立模块清单，不是本文自审脚本的通过声明。
// 每个positive模块必须从公开或其阶段内唯一受信producer真实串接到终点；每个negative
// 模块必须以准确预期diagnostic失败。release runner逐文件冷编译，禁止把全部链合并成一个
// mega-module后再以总diagnostics=0代替逐夹具结果，也禁止用as any、ts-ignore或未使用的
// ts-expect-error指令掩盖不可构造路径。

declare const contractArtifactIdentityBrandV20: unique symbol;
declare const contractFixtureQualificationBrandV20: unique symbol;
declare const publicContractCompilationBrandV20: unique symbol;
declare const receiptEdgeManifestBrandV20: unique symbol;
declare const verifiedWireEnvelopeBrandV20: unique symbol;
declare const publicOperationAdmissionBrandV20: unique symbol;
declare const publicOperationResultBrandV20: unique symbol;
declare const opaqueContentHandleBrandV20: unique symbol;

type AiSupplyOpaqueContentHandleKindV20 =
  | "receipt:canonical-envelope-content-handle@20"
  | "receipt:public-operation-request-content-handle@20"
  | "receipt:public-operation-result-content-handle@20"
  | "receipt:ai-supply-contract-artifact-content-handle@20"
  | "receipt:ai-supply-contract-fixture-content-handle@20"
  | "receipt:ai-supply-release-bundle-content-handle@20";

interface AiSupplyOpaqueContentHandleReceiptV20<
  K extends AiSupplyOpaqueContentHandleKindV20,
  S,
> extends ReceiptRef<K, S> {
  readonly [opaqueContentHandleBrandV20]: (subject: S) => S;
  readonly contentDigest: ReceiptIdentityDigestV20<K, S>;
  readonly contentLength: number;
  readonly encryptedOrPublicStorageLocatorDigest: string;
  readonly outgoingReceiptEdgeCount: 0;
  readonly contentCanOnlyBeReadThroughTheVerifiedResolverForThisExactKindSubjectAndDigest: true;
}

declare function commitAiSupplyOpaqueContentHandleV20<
  const K extends AiSupplyOpaqueContentHandleKindV20,
  const S,
>(input: {
  readonly receiptKind: K & AiSupplySingleLiteralV20<K>;
  readonly canonicalSubject: S;
  readonly exactContentBytes: ImportedOpaqueEvidenceLeafReceipt;
  readonly encryptedOrPublicStorageLocatorEvidence: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<AiSupplyOpaqueContentHandleReceiptV20<K, S>>;

interface AnyAiSupplyContractArtifactIdentityReceiptV20 extends ReceiptRef<
  "receipt:ai-supply-contract-artifact-identity@20",
  unknown
> {
  readonly distributionIdentity: ReceiptRef<"receipt:distribution-artifact-identity@20", unknown>;
  readonly distributionArtifactDigest: string;
  readonly distributionTargetPath: `distributions/${string}`;
  readonly contractArtifactDigest: string;
}

interface AiSupplyContractArtifactIdentityReceiptV20<
  D extends string,
  DP extends `distributions/${string}`,
  CD extends string,
> extends ReceiptRef<"receipt:ai-supply-contract-artifact-identity@20", readonly [D, DP, CD]> {
  readonly [contractArtifactIdentityBrandV20]: never;
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<D, DP>;
  readonly distributionArtifactDigest: D;
  readonly distributionTargetPath: DP;
  readonly contractArtifactDigest: CD;
  readonly exactHandwrittenAndGeneratedSourceBytes: readonly [
    ImportedOpaqueEvidenceLeafReceipt,
    ImportedOpaqueEvidenceLeafReceipt,
  ];
  readonly exactPackageExportMapBytes: ImportedOpaqueEvidenceLeafReceipt;
  readonly exactCompilerResolverAndGeneratorArtifact: ImportedOpaqueEvidenceLeafReceipt;
  readonly sourceExportMapCompilerAndDistributionIdentityDigest: string;
}

declare function commitAiSupplyContractArtifactIdentityV20<
  const D extends string,
  const DP extends `distributions/${string}`,
  const CD extends string,
>(input: {
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<D, DP>;
  readonly contractArtifactDigest: CD & AiSupplySingleLiteralV20<CD>;
  readonly exactHandwrittenAndGeneratedSourceBytes: readonly [
    ImportedOpaqueEvidenceLeafReceipt,
    ImportedOpaqueEvidenceLeafReceipt,
  ];
  readonly exactPackageExportMapBytes: ImportedOpaqueEvidenceLeafReceipt;
  readonly exactCompilerResolverAndGeneratorArtifact: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<AiSupplyContractArtifactIdentityReceiptV20<D, DP, CD>>;

interface AiSupplyContractFixtureQualificationReceiptV20<
  A extends AnyAiSupplyContractArtifactIdentityReceiptV20,
> extends ReceiptRef<"receipt:ai-supply-contract-fixture-qualification@20", ExactReceiptPointerForV20<A>> {
  readonly [contractFixtureQualificationBrandV20]: never;
  readonly contractArtifactIdentity: ExactReceiptPointerForV20<A>;
  readonly checkedInPositiveFixtureIds: typeof AI_SUPPLY_CONTRACT_POSITIVE_FIXTURE_IDS_V20;
  readonly checkedInNegativeFixtureIds: typeof AI_SUPPLY_CONTRACT_NEGATIVE_FIXTURE_IDS_V20;
  readonly positiveFixtureModulePaths: {
    readonly [K in (typeof AI_SUPPLY_CONTRACT_POSITIVE_FIXTURE_IDS_V20)[number]]: `packages/contracts/test-d/positive/${K}.ts`;
  };
  readonly negativeFixtureModulePaths: {
    readonly [K in (typeof AI_SUPPLY_CONTRACT_NEGATIVE_FIXTURE_IDS_V20)[number]]: `packages/contracts/test-d/negative/${K}.ts`;
  };
  readonly positiveFixtureCompileFailureCount: 0;
  readonly negativeFixtureUnexpectedCompileSuccessCount: 0;
  readonly exactCompilerInvocationAndPerModuleDiagnosticTranscript: ImportedOpaqueEvidenceLeafReceipt;
}

declare function commitAiSupplyContractFixtureQualificationV20<
  const A extends AnyAiSupplyContractArtifactIdentityReceiptV20,
>(input: {
  readonly contractArtifactIdentity: A;
  readonly exactCheckedInFixtureTrees: readonly [ImportedOpaqueEvidenceLeafReceipt, ImportedOpaqueEvidenceLeafReceipt];
  readonly exactCompilerInvocationAndPerModuleDiagnosticTranscript: ImportedOpaqueEvidenceLeafReceipt;
  readonly deterministicExpectedDiagnosticMatcher: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<AiSupplyContractFixtureQualificationReceiptV20<A>>;

interface AiSupplyPublicContractCompilationReceiptV20<
  A extends AnyAiSupplyContractArtifactIdentityReceiptV20,
> extends ReceiptRef<
  "receipt:ai-supply-public-contract-compilation@20",
  readonly [A["contractArtifactDigest"], A["distributionArtifactDigest"], A["distributionTargetPath"]]
> {
  readonly [publicContractCompilationBrandV20]: never;
  readonly contractArtifactIdentityContentHandle: ReceiptPointerV20<
    "receipt:ai-supply-contract-artifact-content-handle@20",
    readonly [A["contractArtifactDigest"], A["distributionArtifactDigest"], A["distributionTargetPath"]]
  >;
  readonly fixtureQualificationContentHandle: ReceiptPointerV20<
    "receipt:ai-supply-contract-fixture-content-handle@20",
    readonly [A["contractArtifactDigest"], A["distributionArtifactDigest"], A["distributionTargetPath"]]
  >;
  readonly contractArtifactDigest: A["contractArtifactDigest"];
  readonly distributionArtifactDigest: A["distributionArtifactDigest"];
  readonly distributionTargetPath: A["distributionTargetPath"];
  readonly expectedPublicProducerIds: typeof AI_SUPPLY_PUBLIC_PRODUCER_IDS_V20;
  readonly actualPublicProducerIds: typeof AI_SUPPLY_PUBLIC_PRODUCER_IDS_V20;
  readonly expectedPublicRootKinds: typeof AI_SUPPLY_PUBLIC_RECEIPT_GRAPH_ROOT_KINDS_V20;
  readonly actualPublicRootKinds: typeof AI_SUPPLY_PUBLIC_RECEIPT_GRAPH_ROOT_KINDS_V20;
  readonly legacyV19OrEarlierProducerExportCount: 0;
  readonly exportedInternalLifecycleProducerCount: 0;
  readonly exportedProducerReturningUncommittedOrUnfrozenReceiptCount: 0;
  readonly exportedConsumerAcceptingUnverifiedReceiptCount: 0;
  readonly unresolvedCallableOrRootSymbolCount: 0;
  readonly exactArtifactExportMapAndResolvedSignatureGraphDigest: string;
}

declare function compileAndCommitAiSupplyPublicContractV20<
  const A extends AnyAiSupplyContractArtifactIdentityReceiptV20,
>(input: {
  readonly contractArtifactIdentity: A;
  readonly fixtureQualification: AiSupplyContractFixtureQualificationReceiptV20<NoInfer<A>>;
  readonly expectedPublicProducerIds: typeof AI_SUPPLY_PUBLIC_PRODUCER_IDS_V20;
  readonly expectedPublicRootKinds: typeof AI_SUPPLY_PUBLIC_RECEIPT_GRAPH_ROOT_KINDS_V20;
  readonly exactResolvedPackageExportAndCallSignatureGraph: ImportedOpaqueEvidenceLeafReceipt;
  readonly compilerApiAndPackageExportResolverArtifact: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<AiSupplyPublicContractCompilationReceiptV20<A>>;

interface AnyAiSupplyPublicContractCompilationReceiptV20 extends ReceiptRef<
  "receipt:ai-supply-public-contract-compilation@20",
  unknown
> {
  readonly contractArtifactIdentityContentHandle: ReceiptPointerV20<
    "receipt:ai-supply-contract-artifact-content-handle@20",
    unknown
  >;
  readonly fixtureQualificationContentHandle: ReceiptPointerV20<
    "receipt:ai-supply-contract-fixture-content-handle@20",
    unknown
  >;
  readonly contractArtifactDigest: string;
  readonly distributionArtifactDigest: string;
  readonly distributionTargetPath: `distributions/${string}`;
}

interface ReceiptEdgeManifestReceiptV20<
  C extends AnyAiSupplyPublicContractCompilationReceiptV20,
> extends ReceiptRef<"receipt:receipt-edge-manifest@20", ExactReceiptPointerForV20<C>> {
  readonly [receiptEdgeManifestBrandV20]: never;
  readonly publicContractCompilation: ExactReceiptPointerForV20<C>;
  readonly contractArtifactIdentityContentHandle: C["contractArtifactIdentityContentHandle"];
  readonly fixtureQualificationContentHandle: C["fixtureQualificationContentHandle"];
  readonly contractArtifactDigest: C["contractArtifactDigest"];
  readonly distributionArtifactDigest: C["distributionArtifactDigest"];
  readonly distributionTargetPath: C["distributionTargetPath"];
  readonly exactRootReceiptKinds: typeof AI_SUPPLY_PUBLIC_RECEIPT_GRAPH_ROOT_KINDS_V20;
  readonly exactGeneratedPointerSchemas: NonEmptyReadonly<ReceiptNodeEdgeSchemaV19>;
  readonly exactRuntimePointerSchemas: NonEmptyReadonly<ReceiptNodeEdgeSchemaV19>;
  readonly canonicalSchemaAndRuntimeManifestDigest: string;
  readonly missingDuplicateExtraWildcardOrUnregisteredPointerCount: 0;
  readonly bareReceiptRefOrUnrecoverableKindSubjectCount: 0;
  readonly nestedWireReceiptFieldCountOtherThanExactSixFieldPointer: 0;
  readonly generatorFailsClosedInsteadOfGuessingFromPropertyNames: true;
}

declare function compileAndCommitReceiptEdgeManifestV20<
  const C extends AnyAiSupplyPublicContractCompilationReceiptV20,
>(input: {
  readonly publicContractCompilation: C;
  readonly exactCompilerResolvedOwnerPropertyTargetKindSubjectAndCardinalityGraph: ImportedOpaqueEvidenceLeafReceipt;
  readonly canonicalSchemaCompilerAndRuntimeManifestGeneratorArtifact: ImportedOpaqueEvidenceLeafReceipt;
  readonly sixFieldPointerSchemaAndHydrationRegistry: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<ReceiptEdgeManifestReceiptV20<C>>;

type AiSupplyPublicOperationV20 =
  | "discover"
  | "inspect_candidate"
  | "prepare_connection"
  | "verify_connection"
  | "select_solution"
  | "start_session"
  | "disconnect_or_revoke";

interface AiSupplyVerifiedWireEnvelopeReceiptV20<
  K extends AiSupplyPublicReceiptGraphRootKindV20,
  C extends AnyAiSupplyPublicContractCompilationReceiptV20,
> extends ReceiptRef<"receipt:ai-supply-verified-wire-envelope@20", readonly [K, C]> {
  readonly [verifiedWireEnvelopeBrandV20]: never;
  readonly decodedRootKind: K;
  readonly publicContractCompilation: ExactReceiptPointerForV20<C>;
  readonly receiptEdgeManifest: ExactReceiptPointerForV20<ReceiptEdgeManifestReceiptV20<C>>;
  readonly canonicalEnvelopeContentHandle: ReceiptPointerV20<
    "receipt:canonical-envelope-content-handle@20",
    readonly [K, C]
  >;
  readonly exactPublicContractEdgeManifestAndDependencyGraphDigest: string;
  readonly completeDependencyGraphVerifiedButNotExposedAsMutableObjects: true;
}

interface AiSupplyPublicOperationResultReceiptV20<
  O extends AiSupplyPublicOperationV20,
  A extends AiSupplyPublicOperationAdmissionReceiptV20<O>,
> extends ReceiptRef<"receipt:ai-supply-public-operation-result@20", A> {
  readonly [publicOperationResultBrandV20]: (operation: O) => O;
  readonly operationAdmission: ExactReceiptPointerForV20<A>;
  readonly operation: O;
  readonly currentState: SupplyViewStateIdV6;
  readonly localizedMessageKey: `supply.${string}`;
  readonly resultContentHandle: ReceiptPointerV20<
    "receipt:public-operation-result-content-handle@20",
    readonly [A, O, string]
  >;
  readonly nextActionCapabilityCount: 0 | 1;
  readonly secretOrRawCredentialByteCount: 0;
}

interface AiSupplyPublicOperationAdmissionReceiptV20<
  O extends AiSupplyPublicOperationV20,
> extends ReceiptRef<"receipt:ai-supply-public-operation-admission@20", O> {
  readonly [publicOperationAdmissionBrandV20]: (operation: O) => O;
  readonly operation: O;
  readonly canonicalRequestContentHandle: ReceiptPointerV20<
    "receipt:public-operation-request-content-handle@20",
    O
  >;
  readonly exactLocalControlSessionIdentityDigest: string;
  readonly exactCurrentRenderAndSingleUseActionCapabilityOrAutomaticAdmissionDigest: string;
  readonly operationRequestSessionRenderAndCapabilityWereComparedBeforeAnyEffect: true;
}

declare function admitAiSupplyPublicOperationV20<
  const O extends AiSupplyPublicOperationV20,
>(input: {
  readonly operation: O & AiSupplySingleLiteralV20<O>;
  readonly canonicalRequestContentHandle: ReceiptPointerV20<
    "receipt:public-operation-request-content-handle@20",
    O
  >;
  readonly localControlSession: AnyExactLocalControlSessionReceiptV20;
  readonly exactCurrentRenderAndSingleUseActionCapabilityOrAutomaticAdmission: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<AiSupplyPublicOperationAdmissionReceiptV20<O>>;

declare function verifyAiSupplyWireEnvelopeV20<
  const K extends AiSupplyPublicReceiptGraphRootKindV20,
  const C extends AnyAiSupplyPublicContractCompilationReceiptV20,
>(input: {
  readonly persistedCanonicalEnvelopeBytes: ImportedOpaqueEvidenceLeafReceipt;
  readonly expectedRootKind: K & AiSupplySingleLiteralV20<K>;
  readonly publicContractCompilation: C;
  readonly edgeManifest: ReceiptEdgeManifestReceiptV20<NoInfer<C>>;
  readonly trustedDependencyResolver: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<AiSupplyVerifiedWireEnvelopeReceiptV20<K, C>>;

declare function executeAiSupplyPublicOperationV20<
  const O extends AiSupplyPublicOperationV20,
  const A extends AiSupplyPublicOperationAdmissionReceiptV20<O>,
>(input: {
  readonly operationAdmission: A;
  readonly operation: O & AiSupplySingleLiteralV20<O>;
  readonly exactSingleUseAdmissionConsumptionCommit: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<AiSupplyPublicOperationResultReceiptV20<O, A>>;

// ===== 来源:4. 目标架构 / 4.16.8 v20 单一公共真相与根因闭包 =====
// 原文档行 43319-43632 (共 314 行)
declare const ecosystemEvidenceClosureBrandV20: unique symbol;
declare const generatedSupportArtifactSetBrandV20: unique symbol;
declare const releaseEcosystemBindingBrandV20: unique symbol;
declare const releaseBundleVerificationBrandV20: unique symbol;

type AnyPublishedSupportClaimSetReceiptV20 = ReceiptRef<
  "receipt:published-support-claim-set@20",
  readonly [ReceiptPointerV20<"receipt:owner-additional-requirement-set-compilation@7", unknown>, string, `distributions/${string}`]
>;

type PublishedSupportClaimSetSubjectV20<PS extends AnyPublishedSupportClaimSetReceiptV20> =
  PS extends ReceiptRef<"receipt:published-support-claim-set@20", infer S>
    ? S
    : never;

interface GeneratedSupportArtifactSetReceiptV20<
  PS extends AnyPublishedSupportClaimSetReceiptV20,
> extends ReceiptRef<
  "receipt:generated-support-artifact-set@20",
  ExactReceiptPointerForV20<PS>
> {
  readonly [generatedSupportArtifactSetBrandV20]: never;
  readonly distributionIdentity: ReceiptPointerV20<
    "receipt:distribution-artifact-identity@20",
    readonly [PublishedSupportClaimSetSubjectV20<PS>[1], PublishedSupportClaimSetSubjectV20<PS>[2]]
  >;
  readonly publishedSupportClaimSet: ExactReceiptPointerForV20<PS>;
  readonly supportPage: ReceiptPointerV20<"receipt:generated-support-page@20", ExactReceiptPointerForV20<PS>>;
  readonly connectionPicker: ReceiptPointerV20<"receipt:generated-connection-picker@20", ExactReceiptPointerForV20<PS>>;
  readonly testMatrix: ReceiptPointerV20<"receipt:generated-test-matrix@20", ExactReceiptPointerForV20<PS>>;
  readonly releaseNotes: ReceiptPointerV20<"receipt:generated-release-notes@20", ExactReceiptPointerForV20<PS>>;
  readonly allFourArtifactClaimSetAndDistributionDigestsByteEqual: true;
}

declare function commitGeneratedSupportArtifactSetV20<
  const PS extends AnyPublishedSupportClaimSetReceiptV20,
>(input: {
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<
    PublishedSupportClaimSetSubjectV20<PS>[1],
    PublishedSupportClaimSetSubjectV20<PS>[2]
  >;
  readonly publishedSupportClaimSet: PS;
  readonly exactFourGeneratedArtifactBytes: readonly [
    ImportedOpaqueEvidenceLeafReceipt,
    ImportedOpaqueEvidenceLeafReceipt,
    ImportedOpaqueEvidenceLeafReceipt,
    ImportedOpaqueEvidenceLeafReceipt,
  ];
  readonly deterministicSingleInputGeneratorAndByteEqualityVerifier: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<GeneratedSupportArtifactSetReceiptV20<PS>>;

interface EcosystemEvidenceClosureReceiptV20<
  D extends string,
  DP extends `distributions/${string}`,
  RW extends RemoteTransparencyWitnessOperationalReleaseProfileV1 = RemoteTransparencyWitnessOperationalReleaseProfileV1,
> extends ReceiptRef<"receipt:ecosystem-evidence-closure@20", readonly [D, DP]> {
  readonly [ecosystemEvidenceClosureBrandV20]: never;
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<D, DP>;
  readonly exactReleaseEvidenceSet: GaEcosystemReleaseEvidenceSetV3<D>;
  readonly platformSecurityProductionClosure: PlatformSecurityProductionClosureV6<D>;
  readonly fixedMigrationPositiveGate: GaMigrationPositiveGateReceiptV19<D>;
  readonly fixedMigrationAbsenceGate: GaMigrationAbsenceGateReceiptV19<D>;
  readonly mfaWorstCaseDerivation: MfaWorstCaseDerivationReceiptV19;
  readonly remoteWitnessOperationalRelease: RW;
  readonly remoteWitnessReleaseTimeComparison: RW["releaseTimeComparison"];
  readonly exactSbomSlsaProvenanceAndSigstoreBundle: readonly [
    ImportedOpaqueEvidenceLeafReceipt,
    ImportedOpaqueEvidenceLeafReceipt,
    ImportedOpaqueEvidenceLeafReceipt,
  ];
  readonly everyLegacyInternalEvidenceSubjectWasReverifiedAgainstThisExactV20Distribution: true;
  readonly missingStaleCrossDistributionOrDigestOnlyCriticalEvidenceCount: 0;
}

interface AnyExactEcosystemEvidenceClosureReceiptV20<
  D extends string,
  DP extends `distributions/${string}`,
> extends ReceiptRef<"receipt:ecosystem-evidence-closure@20", readonly [D, DP]> {
  readonly [ecosystemEvidenceClosureBrandV20]: unknown;
  readonly distributionIdentity: ReceiptRef<
    "receipt:distribution-artifact-identity@20",
    readonly [D, DP]
  > & {
    readonly distributionArtifactDigest: D;
    readonly targetPath: DP;
  };
  readonly everyLegacyInternalEvidenceSubjectWasReverifiedAgainstThisExactV20Distribution: true;
  readonly missingStaleCrossDistributionOrDigestOnlyCriticalEvidenceCount: 0;
}

declare function commitEcosystemEvidenceClosureV20<
  const D extends string,
  const DP extends `distributions/${string}`,
  const RW extends RemoteTransparencyWitnessOperationalReleaseProfileV1,
>(input: {
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<D, DP>;
  readonly exactReleaseEvidenceSet: GaEcosystemReleaseEvidenceSetV3<NoInfer<D>>;
  readonly platformSecurityProductionClosure: PlatformSecurityProductionClosureV6<NoInfer<D>>;
  readonly fixedMigrationPositiveGate: GaMigrationPositiveGateReceiptV19<NoInfer<D>>;
  readonly fixedMigrationAbsenceGate: GaMigrationAbsenceGateReceiptV19<NoInfer<D>>;
  readonly mfaWorstCaseDerivation: MfaWorstCaseDerivationReceiptV19;
  readonly remoteWitnessOperationalRelease: RW;
  readonly exactSbomSlsaProvenanceAndSigstoreBundle: readonly [
    ImportedOpaqueEvidenceLeafReceipt,
    ImportedOpaqueEvidenceLeafReceipt,
    ImportedOpaqueEvidenceLeafReceipt,
  ];
  readonly canonicalSubjectDistributionTimeAndArtifactGraphVerifier: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<EcosystemEvidenceClosureReceiptV20<D, DP, RW>>;

type PublishedSupportClaimSetPointerV20<
  OC extends OwnerRequirementCompilationPointerV20,
  D extends string,
  DP extends `distributions/${string}`,
> = ReceiptPointerV20<"receipt:published-support-claim-set@20", readonly [OC, D, DP]>;

type GeneratedSupportArtifactSetPointerV20<
  OC extends OwnerRequirementCompilationPointerV20,
  D extends string,
  DP extends `distributions/${string}`,
> = ReceiptPointerV20<
  "receipt:generated-support-artifact-set@20",
  PublishedSupportClaimSetPointerV20<OC, D, DP>
>;

type AccessibilityRequiredMatrixPointerV20<
  D extends string,
  DP extends `distributions/${string}`,
  PD extends string,
> = ReceiptPointerV20<"receipt:ga-accessibility-required-matrix@20", readonly [D, DP, PD]>;

type AccessibilityReleaseClosurePointerV20<
  D extends string,
  DP extends `distributions/${string}`,
  PD extends string,
> = ReceiptPointerV20<
  "receipt:ga-accessibility-release-closure@20",
  AccessibilityRequiredMatrixPointerV20<D, DP, PD>
>;

type ContractArtifactIdentityPointerV20<
  D extends string,
  DP extends `distributions/${string}`,
  CD extends string,
> = ReceiptPointerV20<"receipt:ai-supply-contract-artifact-identity@20", readonly [D, DP, CD]>;

type PublicContractCompilationPointerV20<
  D extends string,
  DP extends `distributions/${string}`,
  CD extends string,
> = ReceiptPointerV20<"receipt:ai-supply-public-contract-compilation@20", readonly [CD, D, DP]>;

type SignedExpectedBomPointerV20<
  D extends string,
  DP extends `distributions/${string}`,
  BD extends string,
> = ReceiptPointerV20<"receipt:ai-supply-signed-expected-bom@20", readonly [D, DP, BD]>;

interface ReleaseEcosystemBindingReceiptV20<
  OC extends OwnerRequirementCompilationPointerV20,
  D extends string,
  DP extends `distributions/${string}`,
  TM extends ReferenceTrustTargetDigestMapV20,
  PD extends string,
  BD extends string,
  CD extends string,
> extends ReceiptRef<
  "receipt:release-ecosystem-binding@20",
  readonly [OC, D, DP, TM, PD, BD, CD]
> {
  readonly [releaseEcosystemBindingBrandV20]: never;
  readonly distributionIdentity: ReceiptPointerV20<"receipt:distribution-artifact-identity@20", readonly [D, DP]>;
  readonly distributionArtifactDigest: D;
  readonly distributionTargetPath: DP;
  readonly trustRoots: ReceiptPointerV20<"receipt:reference-grade-trust-root-bundle@20", readonly [D, TM]>;
  readonly ecosystemEvidence: ReceiptPointerV20<"receipt:ecosystem-evidence-closure@20", readonly [D, DP]>;
  readonly publishedSupportClaimSet: PublishedSupportClaimSetPointerV20<OC, D, DP>;
  readonly generatedSupportArtifacts: GeneratedSupportArtifactSetPointerV20<OC, D, DP>;
  readonly accessibilityRequiredMatrix: AccessibilityRequiredMatrixPointerV20<D, DP, PD>;
  readonly accessibilityReleaseClosure: AccessibilityReleaseClosurePointerV20<D, DP, PD>;
  readonly typeContractCompileGate: AnyPassingTypeContractCompileGatePointerV20<D, DP>;
  readonly contractArtifactIdentity: ContractArtifactIdentityPointerV20<D, DP, CD>;
  readonly contractFixtureQualification: ReceiptPointerV20<
    "receipt:ai-supply-contract-fixture-qualification@20",
    ContractArtifactIdentityPointerV20<D, DP, CD>
  >;
  readonly publicContractCompilation: PublicContractCompilationPointerV20<D, DP, CD>;
  readonly receiptEdgeManifest: ReceiptPointerV20<
    "receipt:receipt-edge-manifest@20",
    PublicContractCompilationPointerV20<D, DP, CD>
  >;
  readonly signedExpectedBom: SignedExpectedBomPointerV20<D, DP, BD>;
  readonly orchestratorTerminal: ReceiptPointerV20<
    "receipt:ai-supply-orchestrator-terminal@20",
    SignedExpectedBomPointerV20<D, DP, BD>
  >;
  readonly exactReleaseArtifactSbomProvenanceSignatureAndTufTarget: ReceiptPointerV20<
    "receipt:exact-tuf-target-authorization@20",
    readonly [TufRepositoryIdentityReceipt<"catalog">, "delegated:release", DP, D]
  >;
  readonly everyReleaseCriticalReceiptEdgeUsesThisExactNonUnionDistributionIdentity: true;
  readonly legacyV19OrEarlierPublicProducerConsumptionCount: 0;
  readonly allThirtyNineSignedBomRowsPassedForThisExactDistribution: true;
}

declare function commitReleaseEcosystemBindingV20<
  const D extends string,
  const DP extends `distributions/${string}`,
  const OC extends OwnerRequirementCompilationPointerV20,
  const TM extends ReferenceTrustTargetDigestMapV20,
  const PD extends string,
  const BD extends string,
  const CD extends string,
>(input: {
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV20<D, DP>;
  readonly trustRoots: ReceiptPointerV20<"receipt:reference-grade-trust-root-bundle@20", readonly [NoInfer<D>, TM]>;
  readonly ecosystemEvidence: ReceiptPointerV20<
    "receipt:ecosystem-evidence-closure@20",
    readonly [NoInfer<D>, NoInfer<DP>]
  >;
  readonly publishedSupportClaimSet: PublishedSupportClaimSetPointerV20<OC, NoInfer<D>, NoInfer<DP>>;
  readonly generatedSupportArtifacts: GeneratedSupportArtifactSetPointerV20<NoInfer<OC>, NoInfer<D>, NoInfer<DP>>;
  readonly accessibilityRequiredMatrix: AccessibilityRequiredMatrixPointerV20<NoInfer<D>, NoInfer<DP>, PD>;
  readonly accessibilityReleaseClosure: AccessibilityReleaseClosurePointerV20<NoInfer<D>, NoInfer<DP>, NoInfer<PD>>;
  readonly typeContractCompileGate: AnyPassingTypeContractCompileGatePointerV20<NoInfer<D>, NoInfer<DP>>;
  readonly contractArtifactIdentity: ContractArtifactIdentityPointerV20<NoInfer<D>, NoInfer<DP>, CD>;
  readonly contractFixtureQualification: ReceiptPointerV20<
    "receipt:ai-supply-contract-fixture-qualification@20",
    ContractArtifactIdentityPointerV20<NoInfer<D>, NoInfer<DP>, NoInfer<CD>>
  >;
  readonly publicContractCompilation: PublicContractCompilationPointerV20<NoInfer<D>, NoInfer<DP>, NoInfer<CD>>;
  readonly receiptEdgeManifest: ReceiptPointerV20<
    "receipt:receipt-edge-manifest@20",
    PublicContractCompilationPointerV20<NoInfer<D>, NoInfer<DP>, NoInfer<CD>>
  >;
  readonly signedExpectedBom: SignedExpectedBomPointerV20<NoInfer<D>, NoInfer<DP>, BD>;
  readonly orchestratorTerminal: ReceiptPointerV20<
    "receipt:ai-supply-orchestrator-terminal@20",
    SignedExpectedBomPointerV20<NoInfer<D>, NoInfer<DP>, NoInfer<BD>>
  >;
  readonly exactReleaseArtifactSbomProvenanceSignatureAndTufTarget: ReceiptPointerV20<
    "receipt:exact-tuf-target-authorization@20",
    readonly [TufRepositoryIdentityReceipt<"catalog">, "delegated:release", NoInfer<DP>, NoInfer<D>]
  >;
  readonly canonicalAllInputPointerSubjectAndDistributionEqualityVerifier: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<ReleaseEcosystemBindingReceiptV20<OC, D, DP, TM, PD, BD, CD>>;

interface AnyReleaseEcosystemBindingReceiptV20 extends ReceiptRef<
  "receipt:release-ecosystem-binding@20",
  unknown
> {
  readonly [releaseEcosystemBindingBrandV20]: unknown;
  readonly distributionIdentity: ReceiptPointerV20<"receipt:distribution-artifact-identity@20", unknown>;
  readonly distributionArtifactDigest: string;
  readonly distributionTargetPath: `distributions/${string}`;
  readonly everyReleaseCriticalReceiptEdgeUsesThisExactNonUnionDistributionIdentity: true;
  readonly legacyV19OrEarlierPublicProducerConsumptionCount: 0;
  readonly allThirtyNineSignedBomRowsPassedForThisExactDistribution: true;
}

interface AiSupplyReleaseBundleVerificationReceiptV20<
  R extends AnyReleaseEcosystemBindingReceiptV20,
> extends ReceiptRef<
  "receipt:ai-supply-release-bundle-verification@20",
  readonly [
    R["distributionArtifactDigest"],
    R["distributionTargetPath"]
  ]
> {
  readonly [releaseBundleVerificationBrandV20]: never;
  readonly verifiedReleaseBundleContentHandle: ReceiptPointerV20<
    "receipt:ai-supply-release-bundle-content-handle@20",
    readonly [
      R["distributionArtifactDigest"],
      R["distributionTargetPath"]
    ]
  >;
  readonly verifiedDistributionArtifactDigest: R["distributionArtifactDigest"];
  readonly verifiedDistributionTargetPath: R["distributionTargetPath"];
  readonly releaseBindingAndCompleteInternalEvidenceGraphDigest: string;
  readonly trustedBootstrapRootDigest: string;
  readonly offlineVerificationOutcome: "installable";
  readonly networkRequestCountDuringOfflineVerification: 0;
  readonly missingInvalidExpiredRolledBackCrossSignedOrCrossDistributionArtifactCount: 0;
}

declare function verifyAiSupplyReleaseBundleV20<
  const R extends AnyReleaseEcosystemBindingReceiptV20,
>(input: {
  readonly detachedReleaseBundleBytes: ImportedOpaqueEvidenceLeafReceipt;
  readonly trustedBootstrapRootBytes: ImportedOpaqueEvidenceLeafReceipt;
  readonly releaseBinding: R;
  readonly offlineTufSbomProvenanceSignatureContractManifestAndEvidenceVerifier: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<AiSupplyReleaseBundleVerificationReceiptV20<R>>;

type _V20PublicProducerCountExactly5 = ContractAssert<ExactTypeEqualV7<
  typeof AI_SUPPLY_PUBLIC_PRODUCER_IDS_V20["length"],
  5
>>;
type _V20PublicRootCountExactly5 = ContractAssert<ExactTypeEqualV7<
  typeof AI_SUPPLY_PUBLIC_RECEIPT_GRAPH_ROOT_KINDS_V20["length"],
  5
>>;
type _V20PositiveFixtureCountExactly17 = ContractAssert<ExactTypeEqualV7<
  typeof AI_SUPPLY_CONTRACT_POSITIVE_FIXTURE_IDS_V20["length"],
  17
>>;
type _V20NegativeFixtureCountExactly25 = ContractAssert<ExactTypeEqualV7<
  typeof AI_SUPPLY_CONTRACT_NEGATIVE_FIXTURE_IDS_V20["length"],
  25
>>;
type _V20V19ProducerNamesAreDisjointFromPublicSurface = ContractAssert<ContractIsNever<
  Extract<AiSupplyPublicProducerIdV20, AiSupplyPublicProducerIdV19>
>>;
