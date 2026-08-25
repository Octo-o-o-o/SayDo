// ===== 来源:4. 目标架构 / 4.15 开源贡献者与长期兼容性合同 =====
// 原文档行 25584-26257 (共 674 行)
interface ConformanceResultCoreBase {
  readonly schemaVersion: "saydo.dev/conformance-core/v1alpha1";
  readonly sdkDigest: string;
  readonly tckDigest: string;
  readonly connectorDigest: string;
  readonly profileDigest: string;
  readonly fixturesDigest: string;
  readonly deterministicResultsDigest: string;
}

type ProtocolConformanceSemanticSubject<
  P extends InferenceProtocolId | ExecutionWireProtocolId,
  Plane extends "inference" | "execution",
> = Plane extends "inference"
  ? P extends InferenceProtocolId
    ? {
        readonly plane: "inference";
        readonly providerProductId: string;
        readonly endpointIdentityDigest: string;
        readonly protocolId: P;
        readonly wireProfileDigest: string;
        readonly implementationArtifactDigest: string;
        readonly connectorDefinitionKind: "inference_connection";
      }
    : never
  : P extends ExecutionWireProtocolId
    ? {
        readonly plane: "execution";
        readonly providerProductId: string;
        readonly executionSurfaceIdentityDigest: string;
        readonly protocolId: P;
        readonly wireProfileDigest: string;
        readonly implementationArtifactDigest: string;
        readonly connectorDefinitionKind: "execution_agent_connection";
      }
    : never;

type CapabilityConformanceSemanticSubject<P extends InferenceProtocolId> = {
    readonly plane: "inference";
    readonly providerProductId: string;
    readonly endpointIdentityDigest: string;
    readonly protocolId: P;
    readonly protocolImplementation: ProtocolImplementationReceipt & { readonly plane: "inference"; readonly protocolId: P };
    readonly requestedModel: string;
    readonly modelIdentityDigest: string;
    readonly modelArtifactIdentityDigest: string;
    readonly effectiveRouteIdentityDigest: string;
    readonly capabilityProfileDigest: string;
  };

type DiscoveryConformanceSemanticSubjectBase = {
  readonly detectorIdentityDigest: string;
  readonly candidateKind: "cli" | "loopback_service" | "bridge" | "cloud_profile";
  readonly discoveryBudgetProfileDigest: string;
  readonly discoveryProvenancePolicyDigest: string;
  readonly discoveryEnvironmentClassDigest: string;
  readonly detectorArtifactAndConfigurationGenerationDigest: string;
};

type DiscoveryConformanceModeBinding =
  | {
      readonly discoveryMode: "static_filesystem";
      readonly staticFilesystemReadBudgetDigest: string;
      readonly staticFilesystemReadPolicyDigest: string;
      readonly packetCount: 0;
      readonly subprocessCount: 0;
      readonly loopbackPeerAdmissionPolicyDigest?: never;
      readonly loopbackRequestProfileDigest?: never;
      readonly explicitUserDecisionPolicyDigest?: never;
      readonly explicitActiveSandboxCanaryProfileDigest?: never;
      readonly provesOnlyAllowlistedPublicConfigAndArtifactMetadataWereRead: true;
    }
  | {
      readonly discoveryMode: "passive_loopback_metadata";
      readonly staticFilesystemReadBudgetDigest?: never;
      readonly staticFilesystemReadPolicyDigest?: never;
      readonly maximumPacketCount: number;
      readonly subprocessCount: 0;
      readonly releaseBundledLoopbackCapabilityDigest: string;
      readonly loopbackPeerAdmissionPolicyDigest: string;
      readonly loopbackRequestProfileDigest: string;
      readonly literalLoopbackAddress: CanonicalLoopbackIpV1;
      readonly urlAuthoritySerialization: LoopbackUrlAuthoritySerializationReceiptV1;
      readonly method: "GET" | "HEAD";
      readonly canonicalPath: string;
      readonly maximumRequestBytes: number;
      readonly maximumResponseBytes: number;
      readonly explicitUserDecisionPolicyDigest?: never;
      readonly explicitActiveSandboxCanaryProfileDigest?: never;
      readonly requiresHeldSocketPeerAdmissionAndTypedRunTerminalEvidence: true;
    }
  | {
      readonly discoveryMode: "explicit_active";
      readonly staticFilesystemReadBudgetDigest?: never;
      readonly staticFilesystemReadPolicyDigest?: never;
      readonly maximumPacketCount: number;
      readonly maximumSubprocessCount: number;
      readonly loopbackPeerAdmissionPolicyDigest?: never;
      readonly loopbackRequestProfileDigest?: never;
      readonly explicitUserDecisionPolicyDigest: string;
      readonly explicitActiveSandboxCanaryProfileDigest: string;
      readonly activeCapabilityAndBudgetDigest: string;
      readonly requiresCurrentDecisionConsumptionSandboxCanaryAndTypedActionTerminalEvidence: true;
    };

type DiscoveryConformanceSemanticSubject = DiscoveryConformanceSemanticSubjectBase &
  DiscoveryConformanceModeBinding &
  (
    | {
      readonly discoveryScope: "provider_agnostic";
      readonly providerProductId?: never;
      readonly providerDetectorProfileDigest?: never;
    }
  | {
      readonly discoveryScope: "provider_specific";
      readonly providerProductId: string;
      readonly providerDetectorProfileDigest: string;
    }
  );

type ExecutionConformanceSemanticSubject<P extends ExecutionWireProtocolId> = {
    readonly plane: "execution";
    readonly providerProductId: string;
    readonly executionSurfaceIdentityDigest: string;
    readonly protocolId: P;
    readonly protocolImplementation: ProtocolImplementationReceipt & { readonly plane: "execution"; readonly protocolId: P };
    readonly executionWireProfileDigest: string;
    readonly peerIdentityPolicyDigest: string;
    readonly sandboxPolicyTemplateDigest: string;
    readonly dispatchGatePolicyDigest: string;
    readonly fundingPolicyProfileDigest: string;
    readonly idempotencyAndRecoveryProfileDigest: string;
  };

type BridgeConformanceSemanticSubjectBase = {
  readonly plane: "bridge";
  readonly providerProductId: string;
  readonly bridgeIdentityDigest: string;
  readonly bridgeImplementationArtifactDigest: string;
  readonly bridgeProfileDigest: string;
  readonly routePinningOrFiniteRouteSetPolicyDigest: string;
  readonly effectiveRouteEvidenceProfileDigest: string;
  readonly credentialIsolationPolicyDigest: string;
  readonly fundingAndDataBoundaryProjectionDigest: string;
  readonly connectorDefinitionKind: "bridge_connection";
};

type BridgeInferenceConformanceSemanticSubject<
  P extends InferenceProtocolId = InferenceProtocolId,
> = BridgeConformanceSemanticSubjectBase & {
  readonly protocolClass: "inference_data_plane";
  readonly protocolId: P;
  readonly protocolDependency: ProtocolImplementationReceipt & {
    readonly plane: "inference";
    readonly protocolId: P;
  };
};

type BridgeControlConformanceSemanticSubject<
  P extends BridgeControlProtocolId = BridgeControlProtocolId,
> = BridgeConformanceSemanticSubjectBase & {
  readonly protocolClass: "bridge_control";
  readonly protocolId: P;
  readonly protocolDependency: ReceiptRef<"receipt:bridge-control-profile@1", P>;
};

type BridgeConformanceSemanticSubject =
  | BridgeInferenceConformanceSemanticSubject<InferenceProtocolId>
  | BridgeControlConformanceSemanticSubject<BridgeControlProtocolId>;

type BridgeConformanceResultCoreBase = {
  readonly reportKind: "bridge";
  readonly plane: "bridge";
  readonly providerProductId: string;
  readonly bridgeIdentityDigest: string;
  readonly bridgeImplementationArtifactDigest: string;
  readonly bridgeProfileDigest: string;
  readonly routePinningOrFiniteRouteSetPolicyDigest: string;
  readonly effectiveRouteEvidenceProfileDigest: string;
  readonly credentialIsolationPolicyDigest: string;
  readonly fundingAndDataBoundaryProjectionDigest: string;
  readonly endpointIdentityDigest?: never;
  readonly modelIdentityDigest?: never;
  readonly detectorIdentityDigest?: never;
  readonly executionSurfaceIdentityDigest?: never;
  readonly provesBridgeIdentityProtocolRouteFundingDataCredentialAndSemanticSubjectExactEquality: true;
};

declare const bridgeConformanceResultCoreBrandV1: unique symbol;

type BrandedInferenceBridgeConformanceResultCore<
  P extends InferenceProtocolId = InferenceProtocolId,
> = BridgeConformanceResultCoreBase & {
  readonly [bridgeConformanceResultCoreBrandV1]: never;
  readonly protocolClass: "inference_data_plane";
  readonly protocolId: P;
  readonly protocolDependency: ProtocolImplementationReceipt & {
    readonly plane: "inference";
    readonly protocolId: P;
  };
  readonly semanticSubject: BridgeInferenceConformanceSemanticSubject<P>;
};

type BrandedControlBridgeConformanceResultCore<
  P extends BridgeControlProtocolId = BridgeControlProtocolId,
> = BridgeConformanceResultCoreBase & {
  readonly [bridgeConformanceResultCoreBrandV1]: never;
  readonly protocolClass: "bridge_control";
  readonly protocolId: P;
  readonly protocolDependency: ReceiptRef<"receipt:bridge-control-profile@1", P>;
  readonly semanticSubject: BridgeControlConformanceSemanticSubject<P>;
};

declare function commitInferenceBridgeConformanceResultCoreV1<
  P extends InferenceProtocolId,
>(
  input: Omit<
    BrandedInferenceBridgeConformanceResultCore<P>,
    typeof bridgeConformanceResultCoreBrandV1
  >,
): BrandedInferenceBridgeConformanceResultCore<P>;

declare function commitControlBridgeConformanceResultCoreV1<
  P extends BridgeControlProtocolId,
>(
  input: Omit<
    BrandedControlBridgeConformanceResultCore<P>,
    typeof bridgeConformanceResultCoreBrandV1
  >,
): BrandedControlBridgeConformanceResultCore<P>;

type ConformanceResultCore = ConformanceResultCoreBase &
  (
    | ({
        [P in InferenceProtocolId]: {
          readonly reportKind: "protocol";
          readonly plane: "inference";
          readonly providerProductId: string;
          readonly endpointIdentityDigest: string;
          readonly protocolId: P;
          readonly wireProfileDigest: string;
          readonly wireImplementationArtifactDigest: string;
          readonly authProfileDigest: string;
          readonly semanticSubject: ProtocolConformanceSemanticSubject<P, "inference">;
          readonly modelIdentityDigest?: never;
          readonly detectorIdentityDigest?: never;
          readonly executionSurfaceIdentityDigest?: never;
          readonly provesFlatFieldsEqualSemanticSubjectExactly: true;
        };
      }[InferenceProtocolId])
    | ({
        [P in ExecutionWireProtocolId]: {
          readonly reportKind: "protocol";
          readonly plane: "execution";
          readonly providerProductId: string;
          readonly endpointIdentityDigest?: never;
          readonly executionSurfaceIdentityDigest: string;
          readonly protocolId: P;
          readonly wireProfileDigest: string;
          readonly wireImplementationArtifactDigest: string;
          readonly authProfileDigest: string;
          readonly semanticSubject: ProtocolConformanceSemanticSubject<P, "execution">;
          readonly modelIdentityDigest?: never;
          readonly detectorIdentityDigest?: never;
          readonly provesFlatFieldsEqualSemanticSubjectExactly: true;
        };
      }[ExecutionWireProtocolId])
    | ({
        [P in InferenceProtocolId]: {
          readonly reportKind: "capability";
          readonly plane: "inference";
          readonly providerProductId: string;
          readonly endpointIdentityDigest: string;
          readonly modelIdentityDigest: string;
          readonly modelArtifactIdentityDigest: string;
          readonly capabilityProfileDigest: string;
          readonly protocolId: P;
          readonly wireProfileDigest: string;
          readonly protocolImplementation: ProtocolImplementationReceipt & {
            readonly plane: "inference";
            readonly protocolId: P;
          };
          readonly semanticSubject: CapabilityConformanceSemanticSubject<P>;
          readonly detectorIdentityDigest?: never;
          readonly executionSurfaceIdentityDigest?: never;
          readonly provesEndpointModelImplementationProtocolAndSemanticSubjectExactEquality: true;
        };
      }[InferenceProtocolId])
    | ({
        [M in DiscoveryConformanceModeBinding["discoveryMode"]]: Extract<
          DiscoveryConformanceModeBinding,
          { readonly discoveryMode: M }
        > & {
          readonly reportKind: "discovery";
          readonly discoveryScope: "provider_agnostic";
          readonly plane?: never;
          readonly semanticSubject: Extract<
            DiscoveryConformanceSemanticSubject,
            { readonly discoveryScope: "provider_agnostic"; readonly discoveryMode: M }
          >;
          readonly detectorIdentityDigest: string;
          readonly discoveryBudgetProfileDigest: string;
          readonly discoveryProvenancePolicyDigest: string;
          readonly discoveryEnvironmentClassDigest: string;
          readonly detectorArtifactAndConfigurationGenerationDigest: string;
          readonly providerProductId?: never;
          readonly providerDetectorProfileDigest?: never;
          readonly endpointIdentityDigest?: never;
          readonly modelIdentityDigest?: never;
          readonly executionSurfaceIdentityDigest?: never;
          readonly provesDetectorProductScopeModeBudgetProvenanceEnvironmentArtifactAndGenerationEqualSemanticSubjectExactly: true;
        };
      }[DiscoveryConformanceModeBinding["discoveryMode"]])
    | ({
        [M in DiscoveryConformanceModeBinding["discoveryMode"]]: Extract<
          DiscoveryConformanceModeBinding,
          { readonly discoveryMode: M }
        > & {
          readonly reportKind: "discovery";
          readonly discoveryScope: "provider_specific";
          readonly plane?: never;
          readonly semanticSubject: Extract<
            DiscoveryConformanceSemanticSubject,
            { readonly discoveryScope: "provider_specific"; readonly discoveryMode: M }
          >;
          readonly detectorIdentityDigest: string;
          readonly discoveryBudgetProfileDigest: string;
          readonly discoveryProvenancePolicyDigest: string;
          readonly discoveryEnvironmentClassDigest: string;
          readonly detectorArtifactAndConfigurationGenerationDigest: string;
          readonly providerProductId: string;
          readonly providerDetectorProfileDigest: string;
          readonly endpointIdentityDigest?: never;
          readonly modelIdentityDigest?: never;
          readonly executionSurfaceIdentityDigest?: never;
          readonly provesDetectorProductScopeModeBudgetProvenanceEnvironmentArtifactAndGenerationEqualSemanticSubjectExactly: true;
        };
      }[DiscoveryConformanceModeBinding["discoveryMode"]])
    | ({
        [P in ExecutionWireProtocolId]: {
          readonly reportKind: "execution";
          readonly plane: "execution";
          readonly providerProductId: string;
          readonly executionSurfaceIdentityDigest: string;
          readonly protocolId: P;
          readonly protocolImplementation: ProtocolImplementationReceipt & {
            readonly plane: "execution";
            readonly protocolId: P;
          };
          readonly semanticSubject: ExecutionConformanceSemanticSubject<P>;
          readonly executionWireProfileDigest: string;
          readonly peerIdentityPolicyDigest: string;
          readonly sandboxPolicyTemplateDigest: string;
          readonly dispatchGatePolicyDigest: string;
          readonly fundingPolicyProfileDigest: string;
          readonly idempotencyAndRecoveryProfileDigest: string;
          readonly endpointIdentityDigest?: never;
          readonly modelIdentityDigest?: never;
          readonly detectorIdentityDigest?: never;
          readonly provesSurfaceProductImplementationProtocolSandboxGateAndSemanticSubjectExactEquality: true;
        };
      }[ExecutionWireProtocolId])
    | BrandedInferenceBridgeConformanceResultCore
    | BrandedControlBridgeConformanceResultCore
  );

interface DiscoveryStaticFilesystemRunEvidenceReceipt extends ReceiptRef {
  readonly coreDigest: string;
  readonly allowlistedReadInventoryDigest: string;
  readonly openedArtifactAndPublicConfigurationIdentitySetDigest: string;
  readonly totalOpenedFileCount: number;
  readonly totalReadBytes: number;
  readonly packetCount: 0;
  readonly subprocessCount: 0;
  readonly sentinelEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly provesEveryOpenedIdentityWasAllowlistedAndAllCountsStayedWithinCoreBudget: true;
  readonly provesNoSecretSessionHistoryCredentialStoreSocketOrProcessWasOpened: true;
}

interface PassiveLoopbackDiscoveryProbeIntentReceipt extends ReceiptRef {
  readonly coreDigest: string;
  readonly peerAdmission: PreparedAttemptTransportAdmissionLeaseReceipt;
  readonly heldConnectedSocketIdentityDigest: string;
  readonly literalLoopbackAddress: CanonicalLoopbackIpV1;
  readonly urlAuthoritySerialization: LoopbackUrlAuthoritySerializationReceiptV1;
  readonly method: "GET" | "HEAD";
  readonly canonicalPath: string;
  readonly canonicalRequestDigest: string;
  readonly commitTokenDigest: string;
  readonly persistedBeforeAnyProbeByte: true;
  readonly provesCorePolicyPeerAdmissionHeldSocketAddressMethodPathAndBudgetExact: true;
}

type PassiveLoopbackDiscoveryProbeTerminalReceipt = ReceiptRef & {
  readonly probeIntent: PassiveLoopbackDiscoveryProbeIntentReceipt;
  readonly peerAdmission: PreparedAttemptTransportAdmissionLeaseReceipt;
  readonly peerAdmissionAuthorityRelease: Extract<
    LeaseAuthorityReleaseReceipt<PreparedAttemptTransportAdmissionLeaseReceipt>,
    { readonly authorityEntry: LeaseAuthorityInventoryEntry<"network_admission"> }
  >;
  readonly actualPacketCount: number;
  readonly actualRequestBytes: number;
  readonly actualResponseBytes: number;
  readonly subprocessCount: 0;
  readonly provesIntentAdmissionHeldSocketAndActualByteEvidenceExact: true;
  readonly provesPacketAndByteCountsArePositiveWhereRequiredAndWithinCoreMaximums: true;
  readonly provesAdmissionInventoryHasExactlyOneNetworkAuthorityAndReleaseClosesThatExactEntry: true;
  readonly provesAdmissionAuthorityReachedExactlyOneRegisteredAfterIntentTerminal: true;
} &
  (
    | {
        readonly outcome: "metadata_received";
        readonly rawMetadataEvidence: ImportedOpaqueEvidenceLeafReceipt;
        readonly parsedCandidateProjectionDigest: string;
      }
    | {
        readonly outcome: "not_recognized" | "peer_closed" | "protocol_rejected";
        readonly rawMetadataEvidence?: ImportedOpaqueEvidenceLeafReceipt;
        readonly parsedCandidateProjectionDigest?: never;
      }
  );

interface ExplicitActiveDiscoveryActionLeaseBase {
  readonly coreDigest: string;
  readonly decisionSubjectDigest: string;
  readonly exactActionSubjectDigest: string;
  readonly sandboxCanaryEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly actionOrdinal: number;
  readonly commitTokenDigest: string;
  readonly notAfter: string;
  readonly singleUse: true;
}

type ExplicitDiscoveryCliMetadataLeaseReceipt = AuthorityInventoryBearingLease<
  LeaseAuthorityInventoryTuple<readonly ["process_or_session", "exclusive_cursor_action"]>
> &
  ExplicitActiveDiscoveryActionLeaseBase & {
    readonly actionKind: "cli_metadata_subprocess";
    readonly exactBinaryArtifactAndFileIdentityDigest: string;
    readonly exactArgumentVectorDigest: string;
    readonly environmentAndSandboxProfileDigest: string;
  };

type ExplicitDiscoveryContainerMetadataLeaseReceipt = AuthorityInventoryBearingLease<
  LeaseAuthorityInventoryTuple<readonly ["process_or_session", "exclusive_cursor_action"]>
> &
  ExplicitActiveDiscoveryActionLeaseBase & {
    readonly actionKind: "container_inventory_subprocess";
    readonly exactContainerManagerBinaryIdentityDigest: string;
    readonly exactReadOnlyArgumentVectorDigest: string;
    readonly containerSocketReadOnlyPolicyDigest: string;
  };

type ExplicitDiscoveryServiceMetadataLeaseReceipt = AuthorityInventoryBearingLease<
  LeaseAuthorityInventoryTuple<readonly ["process_or_session", "exclusive_cursor_action"]>
> &
  ExplicitActiveDiscoveryActionLeaseBase & {
    readonly actionKind: "service_manager_metadata_subprocess";
    readonly exactServiceManagerIdentityDigest: string;
    readonly exactReadOnlyQueryDigest: string;
    readonly serviceMutationDeniedPolicyDigest: string;
  };

type ExplicitDiscoveryLoopbackMetadataLeaseReceipt = AuthorityInventoryBearingLease<
  LeaseAuthorityInventoryTuple<readonly ["network_admission", "exclusive_cursor_action"]>
> &
  ExplicitActiveDiscoveryActionLeaseBase & {
    readonly actionKind: "explicit_loopback_metadata_request";
    readonly canonicalLoopbackIp: CanonicalLoopbackIpV1;
    readonly urlAuthoritySerialization: LoopbackUrlAuthoritySerializationReceiptV1;
    readonly exactMethodPathHeaderAndEmptyBodyDigest: string;
    readonly connectedPeerAdmission: PassiveLoopbackPeerAdmissionReceipt;
  };

type ExplicitActiveDiscoveryActionLeaseReceipt =
  | ExplicitDiscoveryCliMetadataLeaseReceipt
  | ExplicitDiscoveryContainerMetadataLeaseReceipt
  | ExplicitDiscoveryServiceMetadataLeaseReceipt
  | ExplicitDiscoveryLoopbackMetadataLeaseReceipt;

type ExplicitActiveDiscoveryActionIntentReceipt<
  L extends ExplicitActiveDiscoveryActionLeaseReceipt = ExplicitActiveDiscoveryActionLeaseReceipt,
> = L extends ExplicitActiveDiscoveryActionLeaseReceipt
  ? ReceiptRef<"receipt:explicit-discovery-action-intent@1", L> & {
      readonly actionKind: L["actionKind"];
      readonly subjectLease: L;
      readonly exactActionSubjectDigest: L["exactActionSubjectDigest"];
      readonly actionOrdinal: L["actionOrdinal"];
      readonly commitTokenDigest: L["commitTokenDigest"];
      readonly persistedBeforeAnyProcessNetworkSocketOrServiceManagerByte: true;
    }
  : never;

type ExplicitActiveDiscoveryActionTerminalReceipt<
  L extends ExplicitActiveDiscoveryActionLeaseReceipt = ExplicitActiveDiscoveryActionLeaseReceipt,
> = L extends ExplicitActiveDiscoveryActionLeaseReceipt
  ? ReceiptRef<"receipt:explicit-discovery-action-terminal@1", L> & {
      readonly actionKind: L["actionKind"];
      readonly subjectLease: L;
      readonly actionIntent: ExplicitActiveDiscoveryActionIntentReceipt<L>;
      readonly exactActionSubjectDigest: L["exactActionSubjectDigest"];
      readonly actionOrdinal: L["actionOrdinal"];
      readonly rawStdoutResponseOrMetadataEvidence: ImportedOpaqueEvidenceLeafReceipt;
      readonly actualPacketCount: number;
      readonly actualSubprocessCount: number;
      readonly outcome: "metadata_received" | "not_recognized" | "failed" | "cancelled";
      readonly subjectScopedSingleSuccessorCasCommitted: true;
    }
  : never;

interface ExplicitActiveDiscoveryActionAuthorityClosureReceipt<
  L extends ExplicitActiveDiscoveryActionLeaseReceipt = ExplicitActiveDiscoveryActionLeaseReceipt,
> extends ReceiptRef<"receipt:explicit-discovery-action-authority-closure@1", L> {
  readonly actionKind: L["actionKind"];
  readonly subjectLease: L;
  readonly actionIntent: ExplicitActiveDiscoveryActionIntentReceipt<L>;
  readonly actionTerminal: ExplicitActiveDiscoveryActionTerminalReceipt<L>;
  readonly authorityInventory: L["authorityInventory"];
  readonly authorityReleases: ExactLeaseAuthorityReleaseTuple<L>;
  readonly releasedAuthorityCount: number;
  readonly releasedAuthoritySetDigest: string;
  readonly provesIntentTerminalLeaseCoreCommitTokenAndInventoryExactEquality: true;
  readonly provesEveryInventoryEntryHasExactlyOneCompatibleReleaseAndNoExtraRelease: true;
  readonly provesReleasedAuthorityCountAndSetDigestEqualTheNonemptyInventoryExactly: true;
  readonly provesActionReachedExactlyOneRegisteredAfterIntentTerminal: true;
}

type ExplicitActiveDiscoveryActionSetMemberV1 = {
  readonly actionKind: ExplicitActiveDiscoveryActionLeaseReceipt["actionKind"];
  readonly actionOrdinal: number;
  readonly exactActionSubjectDigest: string;
  readonly exactTargetAndProfileDigest: string;
};

interface ExplicitActiveDiscoveryActionSetReceiptV1 extends ReceiptRef {
  readonly coreDigest: string;
  readonly members: NonEmptyReadonly<ExplicitActiveDiscoveryActionSetMemberV1>;
  readonly exactOrderedActionSetDigest: string;
  readonly frozenBeforeAcceptedDecision: true;
  readonly noActionOutsideSetCanAcquireLease: true;
}

interface ExplicitActiveDiscoveryAuthorizationReceiptV1 extends ReceiptRef {
  readonly actionSet: ExplicitActiveDiscoveryActionSetReceiptV1;
  readonly acceptedUserDecision: AcceptedUserDecisionReceipt;
  readonly userDecisionConsumptionCommit: UserDecisionConsumptionCommitReceipt;
  readonly exactDecisionSubjectAndActionSetDigest: string;
  readonly singleUseForExactActionSet: true;
}

interface ExplicitActiveDiscoveryActionEvidenceReceipt extends ReceiptRef {
  readonly coreDigest: string;
  readonly actionSet: ExplicitActiveDiscoveryActionSetReceiptV1;
  readonly authorization: ExplicitActiveDiscoveryAuthorizationReceiptV1;
  readonly sandboxCanaryEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly actionAuthorityClosures: NonEmptyReadonly<ExplicitActiveDiscoveryActionAuthorityClosureReceipt>;
  readonly actualPacketCount: number;
  readonly actualSubprocessCount: number;
  readonly exactOrderedActionSetDigest: string;
  readonly provesDecisionPolicyConsumptionCanaryCapabilityBudgetAndEveryActionExact: true;
  readonly provesEveryActionLeaseInventoryClosedWithoutOmissionOrDuplicationAndCountsStayedWithinCoreMaximums: true;
  readonly provesActionSetAndClosureSetAreAKeyedBijectionWithNoPassiveOrCrossActionLeaseIntentTerminal: true;
}

declare function commitExplicitActiveDiscoveryEvidenceV1<
  const L extends NonEmptyReadonly<ExplicitActiveDiscoveryActionLeaseReceipt>,
>(input: {
  readonly actionSet: ExplicitActiveDiscoveryActionSetReceiptV1;
  readonly authorization: ExplicitActiveDiscoveryAuthorizationReceiptV1;
  readonly closures: { readonly [I in keyof L]: ExplicitActiveDiscoveryActionAuthorityClosureReceipt<L[I]> };
  readonly sandboxCanaryEvidence: ImportedOpaqueEvidenceLeafReceipt;
}): ExplicitActiveDiscoveryActionEvidenceReceipt;

interface NonDiscoveryConformanceRunEvidenceReceipt extends ReceiptRef {
  readonly coreDigest: string;
  readonly typedFixtureExecutionEvidenceDigest: string;
  readonly provesEvidenceUsesOnlyTheIdentityAndProfilesFrozenByCore: true;
}

type ConformanceRunEvidenceForCore<C extends ConformanceResultCore> =
  C extends { readonly reportKind: "discovery"; readonly discoveryMode: "static_filesystem" }
    ? DiscoveryStaticFilesystemRunEvidenceReceipt
    : C extends {
          readonly reportKind: "discovery";
          readonly discoveryMode: "passive_loopback_metadata";
        }
      ? PassiveLoopbackDiscoveryProbeTerminalReceipt
      : C extends { readonly reportKind: "discovery"; readonly discoveryMode: "explicit_active" }
        ? ExplicitActiveDiscoveryActionEvidenceReceipt
        : NonDiscoveryConformanceRunEvidenceReceipt;

interface ConformanceRunPayloadBase {
  readonly schemaVersion: "saydo.dev/conformance-run/v1alpha1";
  readonly sourceCommit: string;
  readonly runnerArtifactDigest: string;
  readonly sutRuntimeArtifactDigest: string;
  readonly sutDistributionArtifactDigest: string;
  readonly sandboxHelperArtifactDigest?: string;
  readonly sandboxPolicyDigest?: string;
  readonly platformProfileDigest: string;
  readonly builderIdentity: string;
  readonly environmentClass: string;
  readonly environmentDigest: string;
  readonly deterministicSeed: string;
  readonly runnerInvocationDigest: string;
  readonly invokedPublicEntryPointDigest: string;
  readonly expectedFixtureSetDigest: string;
  readonly completedFixtureSetDigest: string;
  readonly rawEvidenceDigest: string;
  readonly stdoutSummaryDigest: string;
  readonly stderrSummaryDigest: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly exitCode: number;
  readonly outcome: "completed_pass" | "completed_fail" | "incomplete";
}

type ConformanceRunPayloadForCore<C extends ConformanceResultCore = ConformanceResultCore> =
  C extends ConformanceResultCore
    ? ConformanceRunPayloadBase & {
        readonly core: C;
        readonly runEvidence: ConformanceRunEvidenceForCore<C>;
        readonly provesRunEvidenceCoreDigestEqualsDeterministicCoreDigest: true;
      }
    : never;

type ConformanceRunPayload = ConformanceRunPayloadForCore;

type CompletedPassConformanceRunPayloadForCore<
  C extends ConformanceResultCore,
> = ConformanceRunPayloadForCore<C> & {
  readonly outcome: "completed_pass";
  readonly exitCode: 0;
  readonly expectedFixtureSetDigest: string;
  readonly completedFixtureSetDigest: string;
  readonly provesExpectedAndCompletedFixtureSetsEqual: true;
};

interface ConformanceAttestationForPayload<
  P extends ConformanceRunPayloadBase & {
    readonly outcome: "completed_pass";
    readonly exitCode: 0;
  },
> {
  readonly schemaVersion: "saydo.dev/conformance-attestation/v1alpha1";
  readonly runPayload: P;
  readonly payloadDigest: string;
  readonly slsaProvenanceDigest: string;
  readonly provenanceSubjectDigest: string; // 必须等于 payloadDigest
  readonly sigstoreBundleDigest: string;
  readonly dsseSubjectDigest: string; // 必须等于 payloadDigest
  readonly provesPayloadDigestEqualsExactCanonicalRunPayloadBytes: true;
}

type ReleaseConformanceBindingForCore<
  C extends ConformanceResultCore,
> = C extends ConformanceResultCore
  ? {
  readonly schemaVersion: "saydo.dev/release-conformance-binding/v1alpha1";
  readonly core: C;
  readonly runPayload: CompletedPassConformanceRunPayloadForCore<C>;
  readonly attestation: ConformanceAttestationForPayload<
    CompletedPassConformanceRunPayloadForCore<C>
  >;
  readonly payloadDigest: string;
  readonly attestationDigest: string;
  readonly sutDistributionArtifactDigest: string;
  readonly releasedDistributionPayloadDigest: string;
  readonly provesCorePayloadAttestationSutAndReleasedDistributionAreOneExactTypedChain: true;
  readonly releasedDistributionManifestScopeExcludesThisBindingAndAllDetachedSignatures: true;
}
  : never;

type ReleaseConformanceBinding = ReleaseConformanceBindingForCore<ConformanceResultCore>;
