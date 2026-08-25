// ===== 来源:4. 目标架构 / 4.10.2 最小且封闭的扩展点 =====
// 原文档行 24722-25265 (共 544 行)
type ConnectorExtensionCapability =
  | { readonly kind: "declarative_catalog"; readonly schemaVersion: string }
  | { readonly kind: "static_discovery"; readonly evidenceSchemaVersion: string }
  | { readonly kind: "passive_loopback_discovery"; readonly probeProfileDigest: string }
  | { readonly kind: "explicit_active_discovery"; readonly canaryProfileDigest: string }
  | { readonly kind: "inference_wire_adapter"; readonly protocolId: InferenceProtocolId }
  | { readonly kind: "execution_session_driver"; readonly protocolId: ExecutionWireProtocolId }
  | { readonly kind: "declarative_signer"; readonly signingProfileId: string };

interface ConnectorDefinitionBaseV1 {
  readonly apiVersion: "saydo.dev/connector/v1alpha1";
  readonly id: `${string}.${string}`; // canonical ASCII publisher.name；长度/字符集由 schema 限制
  readonly manifestDigest: string;
}

type ConnectorDefinition =
  | (ConnectorDefinitionBaseV1 & {
      readonly kind: "provider_pack";
      readonly capabilities: NonEmptyReadonly<
        Extract<
          ConnectorExtensionCapability,
          {
            readonly kind:
              | "declarative_catalog"
              | "static_discovery"
              | "passive_loopback_discovery"
              | "explicit_active_discovery";
          }
        >
      >;
      readonly inferenceProtocolProfiles: readonly InferenceProtocolId[];
      readonly executionProtocolProfiles?: never;
    })
  | (ConnectorDefinitionBaseV1 & {
      readonly kind: "signing_profile_pack";
      readonly capabilities: NonEmptyReadonly<
        Extract<ConnectorExtensionCapability, { readonly kind: "declarative_signer" }>
      >;
      readonly inferenceProtocolProfiles: readonly [];
      readonly executionProtocolProfiles: readonly [];
    })
  | (ConnectorDefinitionBaseV1 & {
      readonly kind: "inference_driver";
      readonly capabilities: NonEmptyReadonly<
        Extract<ConnectorExtensionCapability, { readonly kind: "inference_wire_adapter" }>
      >;
      readonly inferenceProtocolProfiles: NonEmptyReadonly<InferenceProtocolId>;
      readonly executionProtocolProfiles?: never;
    })
  | (ConnectorDefinitionBaseV1 & {
      readonly kind: "execution_agent_driver";
      readonly capabilities: NonEmptyReadonly<
        Extract<ConnectorExtensionCapability, { readonly kind: "execution_session_driver" }>
      >;
      readonly executionProtocolProfiles: NonEmptyReadonly<ExecutionWireProtocolId>;
      readonly inferenceProtocolProfiles?: never;
    });

type IrFeature =
  | "instruction"
  | "text"
  | "image"
  | "audio"
  | "document"
  | "file_reference"
  | "tool_call"
  | "tool_result"
  | "reasoning"
  | "citation"
  | "annotation"
  | "refusal"
  | "response_constraint"
  | "conversation_continuation"
  | "provider_hosted_tool"
  | "provider_sealed_option";

declare const inferenceIrContentHandleBrandV20: unique symbol;
declare const inferenceRequestIrBrandV20: unique symbol;
declare const inferenceEventIrBrandV20: unique symbol;

interface InferenceIrContentHandleReceiptV20<
  I extends string = string,
  D extends string = string,
  L extends number = number,
  M extends string = string,
> extends ReceiptRef<
  "receipt:inference-ir-content-handle@20",
  readonly [I, D, L]
> {
  readonly [inferenceIrContentHandleBrandV20]: never;
  readonly handleId: I;
  readonly contentDigest: D;
  readonly byteLength: L;
  readonly mimeType: M;
  readonly immutableOpenPolicyDigest: string;
  readonly hostOwnsLifetimeAndAdapterCannotOpenAmbientPaths: true;
}

declare function commitInferenceIrContentHandleV20<
  const I extends string,
  const D extends string,
  const L extends number,
  const M extends string,
>(input: {
  readonly handleId: I & AiSupplySingleLiteralV20<I>;
  readonly contentDigest: D & AiSupplySingleLiteralV20<D>;
  readonly byteLength: L;
  readonly mimeType: M & AiSupplySingleLiteralV20<M>;
  readonly immutableOpenPolicyDigest: string;
  readonly exactContentBytes: ImportedOpaqueEvidenceLeafReceipt;
  readonly hostOwnedLifetimeAndByteDigestVerification: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<InferenceIrContentHandleReceiptV20<I, D, L, M>>;

type CanonicalJsonValueV20 =
  | null
  | boolean
  | string
  | number
  | readonly CanonicalJsonValueV20[]
  | { readonly [key: string]: CanonicalJsonValueV20 };
type CanonicalJsonObjectV20 = { readonly [key: string]: CanonicalJsonValueV20 };

type InferenceIrTypedValueV20 =
  | { readonly kind: "instruction" | "text" | "reasoning" | "refusal"; readonly text: string }
  | { readonly kind: "image" | "audio" | "document"; readonly content: InferenceIrContentHandleReceiptV20 }
  | { readonly kind: "file_reference"; readonly file: InferenceIrContentHandleReceiptV20; readonly displayName: string }
  | { readonly kind: "tool_call"; readonly callId: string; readonly toolName: string; readonly argumentsCanonicalJson: CanonicalJsonObjectV20 }
  | { readonly kind: "tool_result"; readonly callId: string; readonly result: string | InferenceIrContentHandleReceiptV20; readonly isError: boolean }
  | { readonly kind: "citation"; readonly sourceHandle: InferenceIrContentHandleReceiptV20; readonly title: string; readonly startIndex: number; readonly endIndex: number }
  | { readonly kind: "annotation"; readonly annotationType: string; readonly value: CanonicalJsonObjectV20 }
  | { readonly kind: "response_constraint"; readonly constraintSchema: CanonicalJsonObjectV20 }
  | { readonly kind: "conversation_continuation"; readonly continuationId: string }
  | { readonly kind: "provider_hosted_tool"; readonly toolName: string; readonly canonicalArguments: CanonicalJsonObjectV20 }
  | { readonly kind: "provider_sealed_option"; readonly optionName: string; readonly canonicalValue: CanonicalJsonObjectV20 };

type InferenceIrOccurrenceV1 = InferenceIrTypedValueV20 extends infer V
  ? V extends { readonly kind: infer K extends IrFeature }
    ? {
        readonly path: string;
        readonly kind: K;
        readonly digest: string;
        readonly requiredness: "required" | "optional_display";
        readonly value: V;
        readonly canonicalValueDigest: string;
      }
    : never
  : never;

interface InferenceRequestIR<
  O extends readonly InferenceIrOccurrenceV1[] = readonly InferenceIrOccurrenceV1[],
  H extends readonly InferenceIrContentHandleReceiptV20[] = readonly InferenceIrContentHandleReceiptV20[],
  RD extends string = string,
  OD extends string = string,
  HD extends string = string,
  CD extends string = string,
> extends ReceiptRef<
  "receipt:inference-request-ir@20",
  readonly [RD, OD, HD, CD]
> {
  readonly [inferenceRequestIrBrandV20]: never;
  readonly schemaVersion: "saydo.dev/inference-request-ir/v1";
  readonly operation: InferenceOperation;
  readonly requestedModel: string;
  readonly orderedOccurrences: O;
  readonly immutableContentHandles: H;
  readonly contentHandleSetDigest: HD;
  readonly occurrenceSetDigest: OD;
  readonly requiredCapabilitySetDigest: CD;
  readonly store: false;
  readonly requestDigest: RD;
  readonly everyOccurrenceValueAndContentHandleIsCoveredExactlyOnceByCanonicalBytes: true;
  readonly noAmbientPathOrMutableContentAliasCount: 0;
}

declare function commitInferenceRequestIrV20<
  const O extends readonly InferenceIrOccurrenceV1[],
  const H extends readonly InferenceIrContentHandleReceiptV20[],
  const RD extends string,
  const OD extends string,
  const HD extends string,
  const CD extends string,
>(input: {
  readonly operation: InferenceOperation;
  readonly requestedModel: string;
  readonly orderedOccurrences: O;
  readonly immutableContentHandles: H;
  readonly requestDigest: RD & AiSupplySingleLiteralV20<RD>;
  readonly occurrenceSetDigest: OD & AiSupplySingleLiteralV20<OD>;
  readonly contentHandleSetDigest: HD & AiSupplySingleLiteralV20<HD>;
  readonly requiredCapabilitySetDigest: CD & AiSupplySingleLiteralV20<CD>;
  readonly exactCanonicalRequestOccurrenceAndHandleBytes: readonly [
    ImportedOpaqueEvidenceLeafReceipt,
    ImportedOpaqueEvidenceLeafReceipt,
    ImportedOpaqueEvidenceLeafReceipt,
  ];
  readonly deterministicOccurrenceHandleCoverageAndDigestVerifier: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<InferenceRequestIR<O, H, RD, OD, HD, CD>>;

interface ProtocolTarget {
  readonly protocolId: InferenceProtocolId;
  readonly endpointIdentityDigest: string;
  readonly wireProfileDigest: string;
  readonly modelOrDeployment: string;
  readonly adapterArtifactDigest: string;
}

interface DecodeContext<
  R extends InferenceRequestIR = InferenceRequestIR,
  A extends string = string,
> {
  readonly request: ExactReceiptPointerForV20<R>;
  readonly requestId: R["requestDigest"];
  readonly protocolTarget: ProtocolTarget;
  readonly attemptId: A;
  readonly boundedRawFrameBytes: number;
  readonly framingProfileDigest: string;
  readonly trustedClockSnapshotDigest: string;
}

type InferenceEventPayloadV20 =
  | { readonly kind: "item_start"; readonly sequence: number; readonly itemId: string; readonly itemKind: IrFeature }
  | { readonly kind: "content_delta"; readonly sequence: number; readonly itemId: string; readonly occurrence: InferenceIrOccurrenceV1 }
  | { readonly kind: "item_end"; readonly sequence: number; readonly itemId: string }
  | { readonly kind: "usage_correction"; readonly sequence: number; readonly usageVectorDigest: string }
  | { readonly kind: "model_or_route_evidence"; readonly sequence: number }
  | { readonly kind: "warning"; readonly sequence: number; readonly warningDigest: string }
  | { readonly kind: "terminal_success"; readonly sequence: number; readonly terminalDigest: string }
  | { readonly kind: "terminal_error"; readonly sequence: number; readonly errorClass: string; readonly terminalDigest: string };

interface DecodedInferenceEventProposalV20<
  R extends InferenceRequestIR = InferenceRequestIR,
  A extends string = string,
> {
  readonly schemaVersion: "saydo.dev/decoded-inference-event-proposal/v1";
  readonly requestId: R["requestDigest"];
  readonly attemptId: A;
  readonly evidenceDigest: string;
  readonly event: InferenceEventPayloadV20;
}

type InferenceEventIR<
  R extends InferenceRequestIR = InferenceRequestIR,
  A extends string = string,
  E extends InferenceEventPayloadV20 = InferenceEventPayloadV20,
> = ReceiptRef<
  "receipt:inference-event-ir@20",
  readonly [ExactReceiptPointerForV20<R>, A, E["sequence"], E["kind"]]
> & {
  readonly [inferenceEventIrBrandV20]: never;
  readonly schemaVersion: "saydo.dev/inference-event-ir/v1";
  readonly request: ExactReceiptPointerForV20<R>;
  readonly requestId: R["requestDigest"];
  readonly attemptId: A;
  readonly evidenceDigest: string;
  readonly exactRawFrameOccurrenceEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly proposalAndRequestAttemptSequenceCanonicalEqualityVerified: true;
} & E;

declare function verifyAndCommitInferenceEventIrV20<
  const R extends InferenceRequestIR,
  const A extends string,
  const E extends InferenceEventPayloadV20,
>(input: {
  readonly request: R;
  readonly decodeContext: DecodeContext<NoInfer<R>, A>;
  readonly proposal: DecodedInferenceEventProposalV20<NoInfer<R>, NoInfer<A>> & {
    readonly event: E;
  };
  readonly exactRawFrameOccurrenceEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly trustedFramingProfileAndCanonicalEventVerifier: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<InferenceEventIR<R, A, E>>;

interface StaticDiscoveryContext {
  readonly platformProfileDigest: string;
  readonly approvedPublicPathHandles: readonly PublicMetadataHandle[];
  readonly environmentValueAccessForbidden: true;
  readonly secretStoreAccessForbidden: true;
}

interface PassiveLoopbackPlanContext {
  readonly platformProfileDigest: string;
  readonly releasePinnedProbePolicyDigest: string;
  readonly canonicalLoopbackAddresses: readonly CanonicalLoopbackIpV1[];
  readonly secretStoreAccessForbidden: true;
}

interface ExplicitActiveDiscoveryContext {
  readonly platformProfileDigest: string;
  readonly acceptedUserDecision: AcceptedUserDecisionReceipt;
  readonly activeCanaryAuthorizationDigest: string;
  readonly secretBrokerHandles: readonly ReceiptRef[];
}

interface PublicMetadataHandle {
  readonly handleId: string;
  readonly fileIdentityDigest: string;
  readonly canonicalAllowedPathDigest: string;
  readonly maximumBytes: number;
  readonly containsSecretMaterial: false;
}

interface HostOwnedProbeResult {
  readonly probeDigest: string;
  readonly peerIdentityDigest: string;
  readonly transportEvidenceDigest: string;
  readonly boundedResponseDigest: string;
  readonly terminal: "matched" | "not_matched" | "unreachable" | "policy_blocked";
}

type DiscoveryEvidence =
  | { readonly mode: "static_filesystem"; readonly publicMetadataHandle: PublicMetadataHandle; readonly evidenceDigest: string }
  | { readonly mode: "passive_loopback_metadata"; readonly hostOwnedProbeResult: HostOwnedProbeResult; readonly evidenceDigest: string }
  | { readonly mode: "explicit_active"; readonly acceptedUserDecisionDigest: string; readonly canaryTerminalDigest: string; readonly evidenceDigest: string };

type ConnectorEvidence =
  | DiscoveryEvidence
  | { readonly mode: "protocol_capability"; readonly protocolId: InferenceProtocolId | ExecutionWireProtocolId; readonly evidenceDigest: string };

interface AdapterWarning {
  readonly occurrenceDigest: string;
  readonly warningCode: string;
  readonly localizedMessageKey: string;
  readonly blocksDispatch: boolean;
}

interface WireRequestPlan {
  readonly protocolId: InferenceProtocolId;
  readonly method: "POST";
  readonly canonicalPathAndQueryDigest: string;
  readonly publicHeaderSetDigest: string;
  readonly credentialInsertionPointSetDigest: string;
  readonly bodyDigest: string;
  readonly orderedBodySegments: NonEmptyReadonly<
    | { readonly kind: "inline_canonical_json"; readonly canonicalBytesDigest: string; readonly byteLength: number }
    | { readonly kind: "content_handle"; readonly content: InferenceIrContentHandleReceiptV20 }
  >;
  readonly hostOwnedBodySegmentResolver: ReceiptRef<
    "receipt:host-owned-wire-body-segment-resolver@20",
    readonly InferenceIrContentHandleReceiptV20[]
  >;
  readonly exactWirePlanDigest: string;
  readonly containsNoCredentialBytes: true;
}

declare const compiledSnapshotHandleBrandV1: unique symbol;

interface CompiledSnapshotHandleV1<K extends string> {
  readonly [compiledSnapshotHandleBrandV1]: K;
  readonly key: string;
  readonly sourceCoreDigest: string;
  readonly compiledArtifactDigest: string;
  readonly immutableAndAliasClosed: true;
}

type CompiledBinding = CompiledSnapshotHandleV1<"binding">;
type EndpointHandle = CompiledSnapshotHandleV1<"endpoint">;
type AuthHandle = CompiledSnapshotHandleV1<"auth">;
type CompiledPolicyProgram = CompiledSnapshotHandleV1<"policy_program">;
type CompiledAuthorizationFoldProgram = CompiledSnapshotHandleV1<"authorization_fold_program">;
type CompiledFallbackPlanTemplate = CompiledSnapshotHandleV1<"fallback_plan_template">;
type AdapterRuntimeHandle = CompiledSnapshotHandleV1<"adapter_runtime">;

interface ProtocolAdapter {
  readonly id: string;
  readonly apiVersion: string;
  readonly artifactDigest: string;
  compile<const R extends InferenceRequestIR>(request: R, target: ProtocolTarget): AdaptationPlan<R>;
  createDecoder<const R extends InferenceRequestIR, const A extends string>(
    context: DecodeContext<R, A>,
  ): WireEventDecoder<R, A>;
}

interface WireEventDecoder<
  R extends InferenceRequestIR = InferenceRequestIR,
  A extends string = string,
> {
  push(chunk: Uint8Array): readonly DecodedInferenceEventProposalV20<R, A>[];
  finish(): readonly DecodedInferenceEventProposalV20<R, A>[];
}

type CanonicalLoopbackIpV1 = "127.0.0.1" | "::1";
type UrlAuthorityLoopbackHostLiteralV1 = "127.0.0.1" | "[::1]";

interface LoopbackUrlAuthoritySerializationReceiptV1 extends ReceiptRef {
  readonly canonicalIp: CanonicalLoopbackIpV1;
  readonly urlAuthorityHostLiteral: UrlAuthorityLoopbackHostLiteralV1;
  readonly canonicalizerId: "rfc3986-loopback-host-v1";
  readonly goldenVectorId: "ipv4-raw-ipv6-bracket-on-url-serialization-only";
  readonly provesIpv4IdentityAndIpv6BracketTransformationExact: true;
}

declare function serializeLoopbackIpForUrlAuthorityV1(
  canonicalIp: CanonicalLoopbackIpV1,
): LoopbackUrlAuthoritySerializationReceiptV1;

interface PassiveLoopbackMetadataProbe {
  readonly detectorId: string;
  readonly address: CanonicalLoopbackIpV1;
  readonly port: number;
  readonly method: "GET" | "HEAD";
  readonly canonicalPath: string;
  readonly expectedSignatureProfileDigest: string;
  readonly maxResponseBytes: number;
  readonly deadlineMs: number;
}

type DiscoveryDetector =
  | {
      readonly mode: "static_filesystem";
      detect(context: StaticDiscoveryContext): Promise<readonly DiscoveryEvidence[]>;
    }
  | {
      readonly mode: "passive_loopback_metadata";
      plan(context: PassiveLoopbackPlanContext): readonly PassiveLoopbackMetadataProbe[];
      consume(results: readonly HostOwnedProbeResult[]): readonly DiscoveryEvidence[];
    }
  | {
      readonly mode: "explicit_active";
      detect(context: ExplicitActiveDiscoveryContext): Promise<readonly DiscoveryEvidence[]>;
    };

interface ConnectorPluginHost {
  getPublicMetadata(handle: PublicMetadataHandle): Promise<unknown>;
  emitEvidence(evidence: ConnectorEvidence): Promise<void>;
}

interface PreparedAttemptDescriptor {
  readonly snapshotDigest: string;
  readonly attemptId: string;
  readonly referenceMonitorWriterLeaseDigest: string;
  readonly writerEpoch: number;
  readonly endpointIdentityDigest: string;
  readonly transportSecurityProfileDigest: string;
  readonly observablePlaintextProcessorSetDigest: string;
  readonly authorizedPlaintextProcessorSetDigest: string;
  readonly proxyResolutionAttemptAttestations: readonly ProxyResolutionAttemptAttestationReceipt[];
  readonly requestDigest: string;
  readonly wirePlanDigest: string;
  readonly reservationDigests: readonly string[];
  readonly credentialEgressDecision:
    | {
        readonly kind: "credential_set";
        readonly completeCredentialComponentSetDigest: string;
        readonly components: NonEmptyReadonly<{
          readonly componentId: string;
          readonly role: CredentialComponentBinding["role"];
          readonly transportHopOrdinal: number;
          readonly recipientEndpointDigest: string;
          readonly observablePlaintextProcessorSetDigest: string;
          readonly authorizedPlaintextProcessorSetDigest: string;
          readonly credentialExposureDecisionDigest: string;
          readonly endpointCredentialEgressDigest: string;
          readonly brokerAclDigest: string;
        }>;
      }
    | {
        readonly kind: "no_credential";
        readonly emptyCredentialComponentSetDigest: string;
        readonly authSubjectDigest: string;
        readonly proofDigest: string;
      };
  readonly credentialIssuance:
    | {
        readonly kind: "workload_identity_lease";
        readonly workloadIdentityProfileDigest: string;
        readonly workloadIdentityCredentialLeaseDigest: string;
      }
    | {
        readonly kind: "oauth_access_lease";
        readonly oauthCredentialFamilyDigest: string;
        readonly oauthAccessCredentialLeaseDigest: string;
      }
    | {
        readonly kind: "aws_static_profile_signing_lease";
        readonly signingAuthorityDigest: string;
        readonly signingLeaseDigest: string;
      }
    | {
        readonly kind: "declarative_signing_lease";
        readonly signingProfileDigest: string;
        readonly signingLeaseDigest: string;
      }
    | { readonly kind: "stored_or_brokered_credential"; readonly credentialSourceDigest: string }
    | { readonly kind: "no_application_credential"; readonly proofDigest: string };
  readonly attemptAuthorization:
    | {
        readonly kind: "conformance";
        readonly conformanceAdmissionDecisionDigest: string;
        readonly conformanceAttemptIntentLeaseDigest: string;
        readonly canonicalConformanceIrDigest: string;
        readonly fixtureAndNoUserContentProofDigest: string;
        readonly authorizedPreparedAndWireRequestDigest: string;
      }
    | {
        readonly kind: "runtime";
        readonly runtimeRouteFenceLeaseDigest: string;
        readonly runtimeAttemptIntentLeaseDigest: string;
        readonly fundingPolicyTemplateDigest: string;
        readonly fundingDecisionDigest: string;
        readonly logicalCallId: string;
        readonly ingressAttemptId: string;
        readonly selectedSequenceDigest: string;
      };
  readonly localInferenceDecision:
    | {
        readonly kind: "local_peer_and_compute";
        readonly peerLeaseDigest: string;
        readonly localComputeLeaseDigest: string;
        readonly runtimeIsolationDigest: string;
      }
    | { readonly kind: "lan_compute"; readonly lanComputeLeaseDigest: string }
    | { readonly kind: "not_local"; readonly computeBoundaryDigest: string };
  readonly pluginExecution:
    | {
        readonly kind: "bundled_or_declarative";
        readonly noThirdPartyCodePluginProofDigest: string;
      }
    | {
        readonly kind: "third_party_code_plugin";
        readonly pluginRuntimeClosure: InferencePluginRuntimeClosureReceipt;
        readonly inferencePluginPolicyDigest?: never;
        readonly pluginRuntimeSandboxAttestationDigest?: never;
        readonly provesDescriptorConsumesExactActivationImplementationPolicyArtifactAndRuntimeClosure: true;
      };
  readonly hostedToolOccurrenceInventoryDigest: string;
  readonly hostedToolOccurrenceCount: number;
  readonly hostedToolPolicyTemplateDigests: readonly string[];
  readonly containsNoFinalHostedToolAuthorizationOrBundleDigest: true;
  readonly singleUse: true;
}

interface AuthorizedSendEnvelope {
  readonly schemaVersion: "saydo.dev/authorized-send-envelope/v1";
  readonly descriptorDigest: string;
  readonly finalPhysicalLeaseDigest: string;
  readonly referenceMonitorWriterLeaseDigest: string;
  readonly writerEpoch: number;
  readonly physicalAttemptId: string;
  readonly endpointIdentityDigest: string;
  readonly exactPreparedAndWireRequestDigest: string;
  readonly hardStopGeneration: number;
  readonly notAfter: string;
  readonly provesDescriptorPrecedesFinalLeaseAndEnvelopeAndEnvelopePrecedesBundleWithoutAnyReverseDigestEdge: true;
}
