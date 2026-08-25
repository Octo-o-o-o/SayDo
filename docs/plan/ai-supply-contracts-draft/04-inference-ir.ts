// ===== 来源:4. 目标架构 / 4.11 可保真的 Inference IR 与 adaptation-loss gate =====
// 原文档行 25326-25344 (共 19 行)
interface AdaptationPlan<
  R extends InferenceRequestIR = InferenceRequestIR,
> {
  readonly request: ExactReceiptPointerForV20<R>;
  readonly requestDigest: R["requestDigest"];
  readonly protocolProfile: string;
  readonly occurrencesDigest: R["occurrenceSetDigest"];
  readonly coverage: readonly {
    readonly path: string;
    readonly kind: IrFeature;
    readonly occurrenceDigest: string;
    readonly outcome: "preserved" | "translated" | "omitted";
    readonly rule?: string;
    readonly wireLocations: readonly string[];
  }[];
  readonly warnings: readonly AdapterWarning[];
  readonly wireRequest: WireRequestPlan;
  readonly wireRequestDigest: string;
}

// ===== 来源:4. 目标架构 / 4.11 可保真的 Inference IR 与 adaptation-loss gate =====
// 原文档行 25352-25468 (共 117 行)
interface RawResponseOccurrence {
  readonly frameSequence: number;
  readonly path: string;
  readonly kind: string;
  readonly occurrenceDigest: string;
}

interface RawResponseInventoryReceipt extends ReceiptRef {
  readonly attemptId: string;
  readonly transportEvidenceDigest: string;
  readonly framingProfileDigest: string;
  readonly occurrences: readonly RawResponseOccurrence[];
  readonly occurrencesDigest: string;
}

interface DecodingPlan extends ReceiptRef {
  readonly rawInventory: RawResponseInventoryReceipt;
  readonly decoderArtifact: ReceiptRef;
  readonly responseProfileDigest: string;
  readonly coverage: readonly {
    readonly rawPath: string;
    readonly occurrenceDigest: string;
    readonly outcome: "preserved" | "translated" | "ignored_optional" | "fatal_unknown";
    readonly irLocations: readonly string[];
    readonly ruleDigest: string;
  }[];
}

interface ResponseLossReceipt extends ReceiptRef {
  readonly rawInventory: RawResponseInventoryReceipt;
  readonly decodingPlan: DecodingPlan;
  readonly outcome: "lossless_required" | "optional_loss_disclosed" | "fatal";
  readonly terminalBasisDigest: string;
}

type SecurityExtractionValue =
  | { readonly field: "observed_model"; readonly canonicalModelIdentityDigest: string }
  | { readonly field: "effective_route"; readonly canonicalEffectiveRouteDigest: string }
  | { readonly field: "usage"; readonly canonicalUsageVectorDigest: string }
  | { readonly field: "processing_region"; readonly canonicalRegionValueDigest: string }
  | { readonly field: "data_processor"; readonly canonicalProcessorIdentityDigest: string }
  | { readonly field: "billing_component"; readonly canonicalBillingComponentDigest: string }
  | { readonly field: "terminal"; readonly canonicalTerminalValueDigest: string };

interface BundledSecurityVerifierPolicyReceipt<F extends SecurityExtractionField> extends ReceiptRef {
  readonly field: F;
  readonly distributionArtifact: DistributionArtifactIdentityReceipt;
  readonly releaseManifestDigest: string;
  readonly protocolId: InferenceProtocolId;
  readonly wireProfileDigest: string;
  readonly rawOccurrencePathDigest: string;
  readonly canonicalizerDigest: string;
  readonly verifierGeneration: number;
  readonly expiresAt: string;
}

interface UpstreamSecurityExtractionAuthorityPolicyReceipt<F extends SecurityExtractionField>
  extends ReceiptRef {
  readonly field: F;
  readonly providerProductId: string;
  readonly protocolId: InferenceProtocolId;
  readonly authorityIdentityDigest: string;
  readonly authorityTrustDomainDigest: string;
  readonly protectedUpstreamTrustDomainDigest: string;
  readonly protectedRouteIdentityDigest: string;
  readonly acceptedAuthorityArtifactDigests: NonEmptyReadonly<string>;
  readonly verifierTrustPolicyDigest: string;
  readonly requiredNonceProfileDigest: string;
  readonly provesAuthorityIsIndependentFromProtectedUpstreamSubject: true;
  readonly expiresAt: string;
}

interface UpstreamSecurityExtractionAttestationReceipt<F extends SecurityExtractionField>
  extends ReceiptRef {
  readonly authorityPolicy: UpstreamSecurityExtractionAuthorityPolicyReceipt<F>;
  readonly rawInventory: RawResponseInventoryReceipt;
  readonly rawOccurrencePath: string;
  readonly rawOccurrenceDigest: string;
  readonly canonicalValueDigest: string;
  readonly targetSubjectDigest: string;
  readonly nonceDigest: string;
  readonly measuredAuthorityArtifactDigest: string;
  readonly configGeneration: number;
  readonly notAfter: string;
  readonly singleUse: true;
  readonly provesPolicyFieldInventoryOccurrenceValueTargetNonceArtifactAndGenerationExact: true;
}

type SecurityAuthorityExtractionBase<F extends SecurityExtractionField> = ReceiptRef & {
  readonly rawInventory: RawResponseInventoryReceipt;
  readonly rawOccurrencePath: string;
  readonly rawOccurrenceDigest: string;
  readonly value: Extract<SecurityExtractionValue, { readonly field: F }>;
  readonly canonicalValueDigest: string;
  readonly targetSubjectDigest: string;
};

type SecurityAuthorityExtractionReceipt = {
  [F in SecurityExtractionField]: SecurityAuthorityExtractionBase<F> &
    (
      | { readonly kind: "bundled_verifier"; readonly bundledVerifierPolicy: BundledSecurityVerifierPolicyReceipt<F> }
      | { readonly kind: "trusted_declarative_extractor"; readonly extractorPolicy: ExtractorPolicyReceipt<F> }
      | {
          readonly kind: "upstream_attestation";
          readonly authorityPolicy: UpstreamSecurityExtractionAuthorityPolicyReceipt<F>;
          readonly attestation: UpstreamSecurityExtractionAttestationReceipt<F>;
        }
    );
}[SecurityExtractionField];

type AdvisorySecurityExtractionReceipt = {
  [F in SecurityExtractionField]: SecurityAuthorityExtractionBase<F> & {
    readonly kind: "unverified";
    readonly reasonDigest: string;
    readonly cannotSatisfyAuthoritativeExtractionRequirement: true;
  };
}[SecurityExtractionField];
