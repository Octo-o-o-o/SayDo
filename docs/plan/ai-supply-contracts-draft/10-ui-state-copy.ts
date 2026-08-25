// ===== 来源:8. 交互与文案合同 / 8.2 状态词与提示模板 =====
// 原文档行 43865-44257 (共 393 行)
type RightsBlockedStateV8 = "unknown" | "forbidden";
type OfficialApiMigrationPolicyKeyV8 = `official-migration:${string}@${number}`;
type OfficialApiMigrationRouteKeyV8 = `supply-route:official-api:${string}`;
type SafeAlternativePickerRouteKeyV8 = `supply-route:safe-alternative:${string}`;
type SupplyReturnStateKeyV8 = `supply-return:${string}`;

type OfficialApiMigrationPolicyRowV8<
  P extends string = string,
  K extends ReferenceRequirementKeyV3 = ReferenceRequirementKeyV3,
> = DeepReadonlyV1<{
  readonly policyKey: OfficialApiMigrationPolicyKeyV8;
  readonly sourceProductId: P;
  readonly blockedRightsStates: readonly ["unknown", "forbidden"];
  readonly providerIntentFamily: `provider-intent:${string}`;
  readonly destinationRequirementKey: K;
  readonly destinationProductId: ReferenceRowByKeyV3<K>["productId"];
  readonly destinationRealmClass: ReferenceRowByKeyV3<K>["realmClass"];
  readonly destinationProtocolProfile: ReferenceRowByKeyV3<K>["protocolProfile"];
  readonly destinationAuthKind: ReferenceRowByKeyV3<K>["authKind"];
  readonly destinationJourneyKey: ReferenceRowByKeyV3<K>["journeyKey"];
  readonly routeKey: OfficialApiMigrationRouteKeyV8;
  readonly returnStateKey: SupplyReturnStateKeyV8;
}>;

const OFFICIAL_API_MIGRATION_POLICY_ROWS_V8 = [
  { policyKey: "official-migration:openai-codex-to-platform-responses@1", sourceProductId: "openai-codex-app-server", blockedRightsStates: ["unknown", "forbidden"], providerIntentFamily: "provider-intent:openai", destinationRequirementKey: "openai.responses.key", destinationProductId: "openai-platform", destinationRealmClass: "global", destinationProtocolProfile: "openai_responses", destinationAuthKind: "bearer", destinationJourneyKey: "openai-responses-api-key", routeKey: "supply-route:official-api:openai-platform-responses", returnStateKey: "supply-return:source-card" },
  { policyKey: "official-migration:anthropic-claude-code-to-messages@1", sourceProductId: "anthropic-claude-code", blockedRightsStates: ["unknown", "forbidden"], providerIntentFamily: "provider-intent:anthropic", destinationRequirementKey: "anthropic.messages.key", destinationProductId: "anthropic-api", destinationRealmClass: "global", destinationProtocolProfile: "anthropic_messages", destinationAuthKind: "x_api_key", destinationJourneyKey: "anthropic-messages-api-key", routeKey: "supply-route:official-api:anthropic-messages", returnStateKey: "supply-return:source-card" },
  { policyKey: "official-migration:google-antigravity-to-genai@1", sourceProductId: "google-antigravity-cli", blockedRightsStates: ["unknown", "forbidden"], providerIntentFamily: "provider-intent:google-gemini", destinationRequirementKey: "google.genai.key", destinationProductId: "google-gemini-api", destinationRealmClass: "global", destinationProtocolProfile: "google_genai", destinationAuthKind: "registry_header", destinationJourneyKey: "google-genai-api-key", routeKey: "supply-route:official-api:google-genai", returnStateKey: "supply-return:source-card" },
  { policyKey: "official-migration:kimi-membership-to-platform@1", sourceProductId: "kimi-code-membership-api", blockedRightsStates: ["unknown", "forbidden"], providerIntentFamily: "provider-intent:kimi", destinationRequirementKey: "kimi.platform.chat", destinationProductId: "kimi-platform-cn", destinationRealmClass: "china_mainland", destinationProtocolProfile: "openai_chat_completions", destinationAuthKind: "bearer", destinationJourneyKey: "kimi-platform-api-key", routeKey: "supply-route:official-api:kimi-platform-cn", returnStateKey: "supply-return:source-card" },
  { policyKey: "official-migration:kimi-acp-to-platform@1", sourceProductId: "kimi-code-server-acp", blockedRightsStates: ["unknown", "forbidden"], providerIntentFamily: "provider-intent:kimi", destinationRequirementKey: "kimi.platform.chat", destinationProductId: "kimi-platform-cn", destinationRealmClass: "china_mainland", destinationProtocolProfile: "openai_chat_completions", destinationAuthKind: "bearer", destinationJourneyKey: "kimi-platform-api-key", routeKey: "supply-route:official-api:kimi-platform-cn", returnStateKey: "supply-return:source-card" },
  { policyKey: "official-migration:opencode-go-to-zen@1", sourceProductId: "opencode-go", blockedRightsStates: ["unknown", "forbidden"], providerIntentFamily: "provider-intent:opencode", destinationRequirementKey: "opencode.zen.chat", destinationProductId: "opencode-zen", destinationRealmClass: "global", destinationProtocolProfile: "openai_chat_completions", destinationAuthKind: "bearer", destinationJourneyKey: "opencode-zen-chat-api-key", routeKey: "supply-route:official-api:opencode-zen-chat", returnStateKey: "supply-return:source-card" },
  { policyKey: "official-migration:opencode-server-to-zen@1", sourceProductId: "opencode-server", blockedRightsStates: ["unknown", "forbidden"], providerIntentFamily: "provider-intent:opencode", destinationRequirementKey: "opencode.zen.chat", destinationProductId: "opencode-zen", destinationRealmClass: "global", destinationProtocolProfile: "openai_chat_completions", destinationAuthKind: "bearer", destinationJourneyKey: "opencode-zen-chat-api-key", routeKey: "supply-route:official-api:opencode-zen-chat", returnStateKey: "supply-return:source-card" },
  { policyKey: "official-migration:opencode-acp-to-zen@1", sourceProductId: "opencode-acp", blockedRightsStates: ["unknown", "forbidden"], providerIntentFamily: "provider-intent:opencode", destinationRequirementKey: "opencode.zen.chat", destinationProductId: "opencode-zen", destinationRealmClass: "global", destinationProtocolProfile: "openai_chat_completions", destinationAuthKind: "bearer", destinationJourneyKey: "opencode-zen-chat-api-key", routeKey: "supply-route:official-api:opencode-zen-chat", returnStateKey: "supply-return:source-card" },
] as const satisfies readonly OfficialApiMigrationPolicyRowV8[];

type OfficialApiMigrationPolicyV8 = (typeof OFFICIAL_API_MIGRATION_POLICY_ROWS_V8)[number];
type OfficialApiMigrationPolicyForSourceV8<P extends string> = Extract<
  OfficialApiMigrationPolicyV8,
  { readonly sourceProductId: P }
>;

declare const officialApiMigrationPolicySetBrandV8: unique symbol;

interface OfficialApiMigrationPolicySetReceiptV8 extends ReceiptRef<
  "receipt:official-api-migration-policy-set@8",
  typeof OFFICIAL_API_MIGRATION_POLICY_ROWS_V8
> {
  readonly [officialApiMigrationPolicySetBrandV8]: never;
  readonly rows: typeof OFFICIAL_API_MIGRATION_POLICY_ROWS_V8;
  readonly exactSourceProductPolicyKeys: readonly OfficialApiMigrationPolicyV8["sourceProductId"][];
  readonly duplicateSourceProductOrPolicyKeyCount: 0;
  readonly emptyIdentifierOrRouteCount: 0;
  readonly destinationRequirementFieldMismatchCount: 0;
}

declare function compileOfficialApiMigrationPolicySetV8(input: {
  readonly rows: typeof OFFICIAL_API_MIGRATION_POLICY_ROWS_V8;
  readonly referenceRequirements: typeof REFERENCE_REQUIREMENTS_V3;
}): DeepFrozenCommittedReceiptV1<OfficialApiMigrationPolicySetReceiptV8>;

type ExactOfficialApiDestinationAuthJourneyV8<R extends ReferenceRequirementRowV3> = {
  readonly authKind: R["authKind"];
  readonly journeyKey: R["journeyKey"];
  readonly requiredUserInputs: R["onboardingRecipe"]["fields"];
};

declare const officialApiDestinationJourneyQualificationBrandV8: unique symbol;

interface OfficialApiDestinationJourneyQualificationReceiptV8<
  R extends ReferenceRequirementRowV3,
  D extends string,
> extends ReceiptRef<
  "receipt:official-api-destination-journey-qualification@8",
  readonly [R["requirementKey"], D]
> {
  readonly [officialApiDestinationJourneyQualificationBrandV8]: never;
  readonly destinationRequirement: R;
  readonly destinationClaim: PublishedProductProtocolClaimForRowV6<R, D>;
  readonly destinationJourneyGate: GaJourneyRunGateReportReceipt;
  readonly exactAuthJourney: ExactOfficialApiDestinationAuthJourneyV8<R>;
  readonly testedDistributionArtifactDigest: D;
  readonly claimRequirementJourneyAuthOrDistributionMismatchCount: 0;
}

declare function qualifyOfficialApiDestinationJourneyV8<
  const R extends ReferenceRequirementRowV3,
  const D extends string,
>(input: {
  readonly destinationRequirement: R;
  readonly destinationClaim: PublishedProductProtocolClaimForRowV6<NoInfer<R>, NoInfer<D>>;
  readonly destinationJourneyGate: GaJourneyRunGateReportReceipt;
  readonly testedDistributionArtifactDigest: D;
}): DeepFrozenCommittedReceiptV1<OfficialApiDestinationJourneyQualificationReceiptV8<R, D>>;

declare const officialApiDestinationResolutionBrandV8: unique symbol;
declare const officialApiDestinationRuntimeQualificationBrandV9: unique symbol;

type BlockedRightsEvidenceForProductV9<
  P extends string,
  S extends RightsBlockedStateV8,
> = BlockedRightsDecisionReceiptV9<RightsSubjectV8<P>, S>;

type OfficialApiDestinationRuntimeQualificationReceiptV9<
  P extends string,
  S extends RightsBlockedStateV8,
  D extends string,
  E extends BlockedRightsEvidenceForProductV9<P, S>,
> = ReceiptRef<
  "receipt:official-api-destination-runtime-qualification@9",
  readonly [P, S, D, E]
> & {
  readonly [officialApiDestinationRuntimeQualificationBrandV9]: never;
  readonly sourceRightsEvidence: E;
  readonly sourceRightsSubject: E["subject"];
  readonly currentHardStopGeneration: E["hardStopGeneration"];
  readonly sourceRightsExpiresAt: E["expiresAt"];
  readonly testedDistributionArtifactDigest: D;
  readonly evaluatedAtMonotonicAnchorDigest: string;
} & (
  | {
      readonly outcome: "qualified_official_destination";
      readonly matchedPolicy: OfficialApiMigrationPolicyForSourceV8<P>;
      readonly currentDestinationClaim: PublishedProductProtocolClaimV6<D>;
      readonly currentDestinationRealm: ProviderRealmIdentityReceipt;
      readonly currentJourneyQualification: OfficialApiDestinationJourneyQualificationReceiptV8<
        ReferenceRequirementRowV3,
        D
      >;
      readonly absenceReason?: never;
    }
  | {
      readonly outcome: "no_qualified_official_destination";
      readonly matchedPolicy: OfficialApiMigrationPolicyForSourceV8<P> | "none_registered";
      readonly currentDestinationClaim?: never;
      readonly currentDestinationRealm?: never;
      readonly currentJourneyQualification?: never;
      readonly absenceReason:
        | "no_registered_policy"
        | "destination_claim_missing"
        | "destination_claim_expired"
        | "destination_realm_mismatch"
        | "destination_generation_mismatch"
        | "destination_distribution_mismatch"
        | "destination_auth_journey_unavailable"
        | "destination_product_sunset_or_not_releasable";
    }
);

declare function qualifyOfficialApiDestinationAtRuntimeV9<
  const P extends string,
  const S extends RightsBlockedStateV8,
  const D extends string,
  const E extends BlockedRightsEvidenceForProductV9<P, S>,
>(input: {
  readonly sourceRightsEvidence: E;
  readonly migrationPolicySet: OfficialApiMigrationPolicySetReceiptV8;
  readonly publishedSupportClaimSet: PublishedSupportClaimSetReceiptV6<D>;
  readonly currentProviderRealmCatalog: ReceiptRef<"receipt:provider-realm-catalog@8", D>;
  readonly currentHardStopGeneration: E["hardStopGeneration"];
  readonly monotonicExpiryValidation: ReceiptRef<
    "receipt:official-api-migration-expiry-validation@9",
    readonly [E, E["expiresAt"]]
  >;
  readonly completedJourneyQualifications: readonly OfficialApiDestinationJourneyQualificationReceiptV8<
    ReferenceRequirementRowV3,
    D
  >[];
  readonly destinationSunsetAndReleaseCatalog: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<OfficialApiDestinationRuntimeQualificationReceiptV9<P, S, D, E>>;

type OfficialApiDestinationResolutionReceiptV8<
  P extends string,
  S extends RightsBlockedStateV8,
  D extends string,
  E extends BlockedRightsEvidenceForProductV9<P, S>,
> = ReceiptRef<
  "receipt:official-api-destination-resolution@8",
  readonly [P, S, D, E]
> & {
  readonly [officialApiDestinationResolutionBrandV8]: never;
  readonly sourceRightsEvidence: E;
  readonly sourceProviderRealm: E["productEligibility"]["providerRealm"];
  readonly sourceHardStopGeneration: E["hardStopGeneration"];
  readonly sourceRightsExpiresAt: E["expiresAt"];
  readonly migrationPolicySet: OfficialApiMigrationPolicySetReceiptV8;
  readonly publishedSupportClaimSet: PublishedSupportClaimSetReceiptV6<D>;
  readonly testedDistributionArtifactDigest: D;
} & (
  | {
        readonly runtimeQualification: Extract<
          OfficialApiDestinationRuntimeQualificationReceiptV9<P, S, D, E>,
          { readonly outcome: "no_qualified_official_destination" }
        >;
        readonly resolution: "no_qualified_official_destination";
        readonly matchedPolicy?: never;
        readonly destinationRequirement?: never;
        readonly destinationClaim?: never;
        readonly destinationRealm?: never;
        readonly destinationJourneyQualification?: never;
        readonly exactAuthJourneys?: never;
        readonly preferredAuthJourneyKey?: never;
        readonly routeKey?: never;
        readonly returnStateKey?: never;
      }
  | (OfficialApiMigrationPolicyForSourceV8<P> extends never ? never : {
        readonly runtimeQualification: Extract<
          OfficialApiDestinationRuntimeQualificationReceiptV9<P, S, D, E>,
          { readonly outcome: "qualified_official_destination" }
        >;
        readonly resolution: "qualified_official_destination";
        readonly matchedPolicy: OfficialApiMigrationPolicyForSourceV8<P>;
        readonly destinationRequirement: ReferenceRowByKeyV3<
          OfficialApiMigrationPolicyForSourceV8<P>["destinationRequirementKey"]
        >;
        readonly destinationClaim: PublishedProductProtocolClaimForRowV6<
          ReferenceRowByKeyV3<OfficialApiMigrationPolicyForSourceV8<P>["destinationRequirementKey"]>,
          D
        >;
        readonly destinationRealm: ProviderRealmIdentityReceipt & {
          readonly providerProductId: OfficialApiMigrationPolicyForSourceV8<P>["destinationProductId"];
          readonly realmClass: OfficialApiMigrationPolicyForSourceV8<P>["destinationRealmClass"];
          readonly regionScope: ProviderRegionScope;
        };
        readonly destinationJourneyQualification: OfficialApiDestinationJourneyQualificationReceiptV8<
          ReferenceRowByKeyV3<OfficialApiMigrationPolicyForSourceV8<P>["destinationRequirementKey"]>,
          D
        >;
        readonly exactAuthJourneys: readonly [ExactOfficialApiDestinationAuthJourneyV8<
          ReferenceRowByKeyV3<OfficialApiMigrationPolicyForSourceV8<P>["destinationRequirementKey"]>
        >];
        readonly preferredAuthJourneyKey: OfficialApiMigrationPolicyForSourceV8<P>["destinationJourneyKey"];
        readonly routeKey: OfficialApiMigrationPolicyForSourceV8<P>["routeKey"];
        readonly returnStateKey: OfficialApiMigrationPolicyForSourceV8<P>["returnStateKey"];
      })
);

declare function compileOfficialApiDestinationResolutionV8<
  const P extends string,
  const S extends RightsBlockedStateV8,
  const D extends string,
  const E extends BlockedRightsEvidenceForProductV9<P, S>,
>(input: {
  readonly sourceRightsEvidence: E;
  readonly runtimeQualification: DeepFrozenCommittedReceiptV1<
    OfficialApiDestinationRuntimeQualificationReceiptV9<P, S, D, E>
  >;
  readonly migrationPolicySet: OfficialApiMigrationPolicySetReceiptV8;
  readonly publishedSupportClaimSet: PublishedSupportClaimSetReceiptV6<D>;
  readonly currentProviderRealmCatalog: ReceiptRef<"receipt:provider-realm-catalog@8", D>;
  readonly currentHardStopGeneration: E["hardStopGeneration"];
  readonly monotonicExpiryValidation: ReceiptRef<
    "receipt:official-api-migration-expiry-validation@8",
    readonly [E, E["expiresAt"]]
  >;
  readonly completedJourneyQualifications: readonly OfficialApiDestinationJourneyQualificationReceiptV8<
    ReferenceRequirementRowV3,
    D
  >[];
}): DeepFrozenCommittedReceiptV1<OfficialApiDestinationResolutionReceiptV8<P, S, D, E>>;

declare const officialApiMigrationJourneyBrandV8: unique symbol;

interface OfficialApiMigrationJourneyReceiptV8<
  P extends OfficialApiMigrationPolicyV8["sourceProductId"],
  S extends RightsBlockedStateV8,
  D extends string,
  E extends BlockedRightsEvidenceForProductV9<P, S>,
> extends ReceiptRef<"receipt:official-api-migration-journey@8", readonly [P, S, D, E]> {
  readonly [officialApiMigrationJourneyBrandV8]: never;
  readonly destinationResolution: Extract<
    OfficialApiDestinationResolutionReceiptV8<P, S, D, E>,
    { readonly resolution: "qualified_official_destination" }
  >;
  readonly sourceRightsEvidence: E;
  readonly sourceProviderRealm: E["productEligibility"]["providerRealm"];
  readonly sourceHardStopGeneration: E["hardStopGeneration"];
  readonly sourceRightsExpiresAt: E["expiresAt"];
  readonly destinationRequirement: OfficialApiMigrationJourneyReceiptV8<P, S, D, E>["destinationResolution"]["destinationRequirement"];
  readonly destinationClaim: OfficialApiMigrationJourneyReceiptV8<P, S, D, E>["destinationResolution"]["destinationClaim"];
  readonly destinationRealm: OfficialApiMigrationJourneyReceiptV8<P, S, D, E>["destinationResolution"]["destinationRealm"];
  readonly exactAuthJourneys: OfficialApiMigrationJourneyReceiptV8<P, S, D, E>["destinationResolution"]["exactAuthJourneys"];
  readonly preferredAuthJourneyKey: OfficialApiMigrationJourneyReceiptV8<P, S, D, E>["exactAuthJourneys"][number]["journeyKey"];
  readonly routeKey: OfficialApiMigrationJourneyReceiptV8<P, S, D, E>["destinationResolution"]["routeKey"];
  readonly returnStateKey: OfficialApiMigrationJourneyReceiptV8<P, S, D, E>["destinationResolution"]["returnStateKey"];
  readonly preservesProviderIntentButNotSubscriptionEntitlement: true;
}

declare function commitOfficialApiMigrationJourneyV8<
  const P extends OfficialApiMigrationPolicyV8["sourceProductId"],
  const S extends RightsBlockedStateV8,
  const D extends string,
  const E extends BlockedRightsEvidenceForProductV9<P, S>,
>(input: {
  readonly destinationResolution: Extract<
    OfficialApiDestinationResolutionReceiptV8<P, S, D, E>,
    { readonly resolution: "qualified_official_destination" }
  >;
}): DeepFrozenCommittedReceiptV1<OfficialApiMigrationJourneyReceiptV8<P, S, D, E>>;

declare const safeAlternativeSourcePickerJourneyBrandV8: unique symbol;

interface SafeAlternativeSourcePickerJourneyReceiptV8<
  P extends string,
  S extends RightsBlockedStateV8,
  D extends string,
  E extends BlockedRightsEvidenceForProductV9<P, S>,
> extends ReceiptRef<"receipt:safe-alternative-source-picker-journey@8", readonly [P, S, D, E]> {
  readonly [safeAlternativeSourcePickerJourneyBrandV8]: never;
  readonly destinationResolution: Extract<
    OfficialApiDestinationResolutionReceiptV8<P, S, D, E>,
    { readonly resolution: "no_qualified_official_destination" }
  >;
  readonly sourceRightsEvidence: E;
  readonly allowedAlternativeClaims: NonEmptyReadonly<PublishedSupportClaimV6<D>>;
  readonly blockedPrincipalDigest: E["subject"]["credentialPrincipalDigest"];
  readonly routeKey: SafeAlternativePickerRouteKeyV8;
  readonly returnStateKey: SupplyReturnStateKeyV8;
  readonly blockedProductPrincipalOrCredentialFamilyOccurrenceCount: 0;
}

declare function compileSafeAlternativeSourcePickerJourneyV8<
  const P extends string,
  const S extends RightsBlockedStateV8,
  const D extends string,
  const E extends BlockedRightsEvidenceForProductV9<P, S>,
>(input: {
  readonly destinationResolution: Extract<
    OfficialApiDestinationResolutionReceiptV8<P, S, D, E>,
    { readonly resolution: "no_qualified_official_destination" }
  >;
  readonly currentReadinessCatalog: ReceiptRef<"receipt:current-supply-readiness-catalog@8", D>;
  readonly deterministicAlternativeRankingPolicy: TufTargetAuthorizationReceipt;
}): DeepFrozenCommittedReceiptV1<SafeAlternativeSourcePickerJourneyReceiptV8<P, S, D, E>>;

declare const rightsBlockedPrimaryActionBrandV8: unique symbol;

type RightsBlockedPrimaryActionReceiptV8<
  P extends string,
  S extends RightsBlockedStateV8,
  D extends string,
  E extends BlockedRightsEvidenceForProductV9<P, S>,
> = ReceiptRef<"receipt:rights-blocked-primary-action@8", readonly [P, S, D, E]> & {
  readonly [rightsBlockedPrimaryActionBrandV8]: never;
  readonly sourceRightsEvidence: E;
  readonly labelKey: "supply.action.resolve_rights";
} & (
  | (P extends OfficialApiMigrationPolicyV8["sourceProductId"]
    ? {
        readonly actionId: "switch_to_official_api";
        readonly destinationJourney: OfficialApiMigrationJourneyReceiptV8<
          Extract<P, OfficialApiMigrationPolicyV8["sourceProductId"]>,
          S,
          D,
          Extract<E, BlockedRightsEvidenceForProductV9<
            Extract<P, OfficialApiMigrationPolicyV8["sourceProductId"]>,
            S
          >>
        >;
        readonly alternativePickerJourney?: never;
      }
    : never)
  | {
        readonly actionId: "choose_another_source";
        readonly destinationJourney?: never;
        readonly alternativePickerJourney: SafeAlternativeSourcePickerJourneyReceiptV8<P, S, D, E>;
      }
);

declare function resolveRightsBlockedPrimaryActionV8<
  const P extends OfficialApiMigrationPolicyV8["sourceProductId"],
  const S extends RightsBlockedStateV8,
  const D extends string,
  const E extends BlockedRightsEvidenceForProductV9<P, S>,
>(input: {
  readonly destinationResolution: Extract<
    OfficialApiDestinationResolutionReceiptV8<P, S, D, E>,
    { readonly resolution: "qualified_official_destination" }
  >;
  readonly destinationJourney: OfficialApiMigrationJourneyReceiptV8<P, S, D, E>;
}): DeepFrozenCommittedReceiptV1<RightsBlockedPrimaryActionReceiptV8<P, S, D, E>>;

declare function resolveRightsBlockedPrimaryActionV8<
  const P extends string,
  const S extends RightsBlockedStateV8,
  const D extends string,
  const E extends BlockedRightsEvidenceForProductV9<P, S>,
>(input: {
  readonly destinationResolution: Extract<
    OfficialApiDestinationResolutionReceiptV8<P, S, D, E>,
    { readonly resolution: "no_qualified_official_destination" }
  >;
  readonly alternativePickerJourney: SafeAlternativeSourcePickerJourneyReceiptV8<P, S, D, E>;
}): DeepFrozenCommittedReceiptV1<RightsBlockedPrimaryActionReceiptV8<P, S, D, E>>;

// ===== 来源:8. 交互与文案合同 / 8.2 状态词与提示模板 =====
// 原文档行 44263-46647 (共 2385 行)
type SupplyViewAutomaticStateV5 =
  | "detecting"
  | "candidate_safe_auto"
  | "connected_verified_waiting_solution"
  | "testing"
  | "quota_limited_waiting_reset";

type SupplyViewUserRequiredStateV5 =
  | "candidate_requires_review"
  | "action_required.login"
  | "action_required.key"
  | "action_required.start_local"
  | "action_required.inspect_containers"
  | "rights_unknown"
  | "rights_forbidden"
  | "custom_private_consent"
  | "staged_failed"
  | "paid_dispatch_locked"
  | "spend_consent"
  | "custom_protocol_probe";

type SupplyViewTerminalStartStateV5 = "conversation_ready" | "review_ready";

type SupplyViewOptionalControlV5 = {
  readonly controlId: string;
  readonly semanticRole: "secondary_action" | "details_link" | "cancel_control";
  readonly neverCountedAsPrimaryJourneyAction: true;
};

type SupplyViewStateIdV6 =
  | SupplyViewAutomaticStateV5
  | SupplyViewUserRequiredStateV5
  | SupplyViewTerminalStartStateV5;

type SupplyExecutablePrimaryActionIdV8 =
  | "review_candidate"
  | "open_login"
  | "connect_product"
  | "show_start_recipe"
  | "inspect_containers"
  | "review_custom_request"
  | "apply_prescription"
  | "authorize_once"
  | "confirm_conformance"
  | "confirm_protocol_probe"
  | "start_solution"
  | "start_review_ready_solution";

type SupplyDescriptorPrimaryActionIdV8 =
  | SupplyExecutablePrimaryActionIdV8
  | "resolve_rights";

interface SupplyPrimaryActionDestinationKindMapV8 {
  readonly review_candidate: "in_app_journey";
  readonly open_login: "provider_login_journey";
  readonly connect_product: "in_app_journey";
  readonly show_start_recipe: "local_runtime_recipe";
  readonly inspect_containers: "local_control_authorization";
  readonly resolve_rights: "compiled_rights_resolution";
  readonly review_custom_request: "in_app_journey";
  readonly apply_prescription: "in_app_journey";
  readonly authorize_once: "local_control_authorization";
  readonly confirm_conformance: "conformance_authorization";
  readonly confirm_protocol_probe: "conformance_authorization";
  readonly start_solution: "solution_start";
  readonly start_review_ready_solution: "solution_start";
}

interface SupplyPrimaryActionForStateMapV8 {
  readonly candidate_requires_review: "review_candidate";
  readonly "action_required.login": "open_login";
  readonly "action_required.key": "connect_product";
  readonly "action_required.start_local": "show_start_recipe";
  readonly "action_required.inspect_containers": "inspect_containers";
  readonly rights_unknown: "resolve_rights";
  readonly rights_forbidden: "resolve_rights";
  readonly custom_private_consent: "review_custom_request";
  readonly staged_failed: "apply_prescription";
  readonly paid_dispatch_locked: "authorize_once";
  readonly spend_consent: "confirm_conformance";
  readonly custom_protocol_probe: "confirm_protocol_probe";
  readonly conversation_ready: "start_solution";
  readonly review_ready: "start_review_ready_solution";
}

interface SupplyPrimaryActionLabelKeyMapV8 {
  readonly review_candidate: "supply.action.review_candidate";
  readonly open_login: "supply.action.open_login";
  readonly connect_product: "supply.action.connect_product";
  readonly show_start_recipe: "supply.action.show_start_recipe";
  readonly inspect_containers: "supply.action.inspect_containers";
  readonly resolve_rights: "supply.action.resolve_rights";
  readonly review_custom_request: "supply.action.review_custom_request";
  readonly apply_prescription: "supply.action.apply_prescription";
  readonly authorize_once: "supply.action.authorize_once";
  readonly confirm_conformance: "supply.action.confirm_conformance";
  readonly confirm_protocol_probe: "supply.action.confirm_protocol_probe";
  readonly start_solution: "supply.action.start_solution";
  readonly start_review_ready_solution: "supply.action.start_solution";
}

type SupplyViewActionableStateV8 =
  | SupplyViewUserRequiredStateV5
  | SupplyViewTerminalStartStateV5;

type SupplyViewNormalActionStateV8 = Exclude<
  SupplyViewActionableStateV8,
  "rights_unknown" | "rights_forbidden"
>;

type SupplyStaticPrimaryActionDescriptorForStateV8<
  S extends SupplyViewActionableStateV8,
  A extends SupplyPrimaryActionForStateMapV8[S] = SupplyPrimaryActionForStateMapV8[S],
> = DeepReadonlyV1<{
  readonly sourceState: S;
  readonly descriptorActionId: A;
  readonly labelKey: SupplyPrimaryActionLabelKeyMapV8[A];
  readonly destinationKind: SupplyPrimaryActionDestinationKindMapV8[A];
  readonly capabilityFactoryId: `supply-action-factory:${A}@8`;
}>;

const SUPPLY_VIEW_PRIMARY_ACTION_DESCRIPTORS_V8 = {
  candidate_requires_review: { sourceState: "candidate_requires_review", descriptorActionId: "review_candidate", labelKey: "supply.action.review_candidate", destinationKind: "in_app_journey", capabilityFactoryId: "supply-action-factory:review_candidate@8" },
  "action_required.login": { sourceState: "action_required.login", descriptorActionId: "open_login", labelKey: "supply.action.open_login", destinationKind: "provider_login_journey", capabilityFactoryId: "supply-action-factory:open_login@8" },
  "action_required.key": { sourceState: "action_required.key", descriptorActionId: "connect_product", labelKey: "supply.action.connect_product", destinationKind: "in_app_journey", capabilityFactoryId: "supply-action-factory:connect_product@8" },
  "action_required.start_local": { sourceState: "action_required.start_local", descriptorActionId: "show_start_recipe", labelKey: "supply.action.show_start_recipe", destinationKind: "local_runtime_recipe", capabilityFactoryId: "supply-action-factory:show_start_recipe@8" },
  "action_required.inspect_containers": { sourceState: "action_required.inspect_containers", descriptorActionId: "inspect_containers", labelKey: "supply.action.inspect_containers", destinationKind: "local_control_authorization", capabilityFactoryId: "supply-action-factory:inspect_containers@8" },
  rights_unknown: { sourceState: "rights_unknown", descriptorActionId: "resolve_rights", labelKey: "supply.action.resolve_rights", destinationKind: "compiled_rights_resolution", capabilityFactoryId: "supply-action-factory:resolve_rights@8" },
  rights_forbidden: { sourceState: "rights_forbidden", descriptorActionId: "resolve_rights", labelKey: "supply.action.resolve_rights", destinationKind: "compiled_rights_resolution", capabilityFactoryId: "supply-action-factory:resolve_rights@8" },
  custom_private_consent: { sourceState: "custom_private_consent", descriptorActionId: "review_custom_request", labelKey: "supply.action.review_custom_request", destinationKind: "in_app_journey", capabilityFactoryId: "supply-action-factory:review_custom_request@8" },
  staged_failed: { sourceState: "staged_failed", descriptorActionId: "apply_prescription", labelKey: "supply.action.apply_prescription", destinationKind: "in_app_journey", capabilityFactoryId: "supply-action-factory:apply_prescription@8" },
  paid_dispatch_locked: { sourceState: "paid_dispatch_locked", descriptorActionId: "authorize_once", labelKey: "supply.action.authorize_once", destinationKind: "local_control_authorization", capabilityFactoryId: "supply-action-factory:authorize_once@8" },
  spend_consent: { sourceState: "spend_consent", descriptorActionId: "confirm_conformance", labelKey: "supply.action.confirm_conformance", destinationKind: "conformance_authorization", capabilityFactoryId: "supply-action-factory:confirm_conformance@8" },
  custom_protocol_probe: { sourceState: "custom_protocol_probe", descriptorActionId: "confirm_protocol_probe", labelKey: "supply.action.confirm_protocol_probe", destinationKind: "conformance_authorization", capabilityFactoryId: "supply-action-factory:confirm_protocol_probe@8" },
  conversation_ready: { sourceState: "conversation_ready", descriptorActionId: "start_solution", labelKey: "supply.action.start_solution", destinationKind: "solution_start", capabilityFactoryId: "supply-action-factory:start_solution@8" },
  review_ready: { sourceState: "review_ready", descriptorActionId: "start_review_ready_solution", labelKey: "supply.action.start_solution", destinationKind: "solution_start", capabilityFactoryId: "supply-action-factory:start_review_ready_solution@8" },
} as const satisfies {
  readonly [S in SupplyViewActionableStateV8]: SupplyStaticPrimaryActionDescriptorForStateV8<S>;
};

type SupplyViewStateRegistryRowV8<S extends SupplyViewStateIdV6> =
  S extends SupplyViewAutomaticStateV5
    ? {
        readonly state: S;
        readonly transitionMode: "automatic";
        readonly messageKey: `supply.state.${string}`;
        readonly primaryActionDescriptor?: never;
        readonly optionalControls: readonly SupplyViewOptionalControlV5[];
      }
    : S extends SupplyViewTerminalStartStateV5
      ? {
          readonly state: S;
          readonly transitionMode: "terminal_start";
          readonly messageKey: `supply.state.${string}`;
          readonly primaryActionDescriptor: (typeof SUPPLY_VIEW_PRIMARY_ACTION_DESCRIPTORS_V8)[S];
          readonly optionalControls: readonly SupplyViewOptionalControlV5[];
        }
      : {
          readonly state: S;
          readonly transitionMode: "user_required";
          readonly messageKey: `supply.state.${string}`;
          readonly primaryActionDescriptor: (typeof SUPPLY_VIEW_PRIMARY_ACTION_DESCRIPTORS_V8)[Extract<S, SupplyViewActionableStateV8>];
          readonly optionalControls: readonly SupplyViewOptionalControlV5[];
        };

type SupplyViewStateRegistryContractV8 = {
  readonly [S in SupplyViewStateIdV6]: SupplyViewStateRegistryRowV8<S>;
};

const SUPPLY_VIEW_STATE_REGISTRY_V8 = {
  detecting: { state: "detecting", transitionMode: "automatic", messageKey: "supply.state.detecting", optionalControls: [{ controlId: "show_existing_results", semanticRole: "secondary_action", neverCountedAsPrimaryJourneyAction: true }] },
  candidate_safe_auto: { state: "candidate_safe_auto", transitionMode: "automatic", messageKey: "supply.state.candidate_safe_auto", optionalControls: [{ controlId: "connection_details", semanticRole: "details_link", neverCountedAsPrimaryJourneyAction: true }] },
  connected_verified_waiting_solution: { state: "connected_verified_waiting_solution", transitionMode: "automatic", messageKey: "supply.state.connected_verified_waiting_solution", optionalControls: [{ controlId: "connection_details", semanticRole: "details_link", neverCountedAsPrimaryJourneyAction: true }, { controlId: "view_solution_progress", semanticRole: "secondary_action", neverCountedAsPrimaryJourneyAction: true }] },
  testing: { state: "testing", transitionMode: "automatic", messageKey: "supply.state.testing", optionalControls: [{ controlId: "cancel_validation", semanticRole: "cancel_control", neverCountedAsPrimaryJourneyAction: true }, { controlId: "view_consumed_budget", semanticRole: "details_link", neverCountedAsPrimaryJourneyAction: true }] },
  quota_limited_waiting_reset: { state: "quota_limited_waiting_reset", transitionMode: "automatic", messageKey: "supply.state.quota_limited_waiting_reset", optionalControls: [{ controlId: "change_funding_policy", semanticRole: "secondary_action", neverCountedAsPrimaryJourneyAction: true }] },
  candidate_requires_review: { state: "candidate_requires_review", transitionMode: "user_required", messageKey: "supply.state.candidate_requires_review", primaryActionDescriptor: SUPPLY_VIEW_PRIMARY_ACTION_DESCRIPTORS_V8.candidate_requires_review, optionalControls: [{ controlId: "defer_candidate", semanticRole: "secondary_action", neverCountedAsPrimaryJourneyAction: true }] },
  "action_required.login": { state: "action_required.login", transitionMode: "user_required", messageKey: "supply.state.action_required.login", primaryActionDescriptor: SUPPLY_VIEW_PRIMARY_ACTION_DESCRIPTORS_V8["action_required.login"], optionalControls: [{ controlId: "choose_another_source", semanticRole: "secondary_action", neverCountedAsPrimaryJourneyAction: true }] },
  "action_required.key": { state: "action_required.key", transitionMode: "user_required", messageKey: "supply.state.action_required.key", primaryActionDescriptor: SUPPLY_VIEW_PRIMARY_ACTION_DESCRIPTORS_V8["action_required.key"], optionalControls: [{ controlId: "show_key_help", semanticRole: "details_link", neverCountedAsPrimaryJourneyAction: true }] },
  "action_required.start_local": { state: "action_required.start_local", transitionMode: "user_required", messageKey: "supply.state.action_required.start_local", primaryActionDescriptor: SUPPLY_VIEW_PRIMARY_ACTION_DESCRIPTORS_V8["action_required.start_local"], optionalControls: [{ controlId: "copy_start_command", semanticRole: "secondary_action", neverCountedAsPrimaryJourneyAction: true }] },
  "action_required.inspect_containers": { state: "action_required.inspect_containers", transitionMode: "user_required", messageKey: "supply.state.action_required.inspect_containers", primaryActionDescriptor: SUPPLY_VIEW_PRIMARY_ACTION_DESCRIPTORS_V8["action_required.inspect_containers"], optionalControls: [{ controlId: "inspect_containers_reason", semanticRole: "details_link", neverCountedAsPrimaryJourneyAction: true }] },
  rights_unknown: { state: "rights_unknown", transitionMode: "user_required", messageKey: "supply.state.rights_unknown", primaryActionDescriptor: SUPPLY_VIEW_PRIMARY_ACTION_DESCRIPTORS_V8.rights_unknown, optionalControls: [{ controlId: "view_official_rights_scope", semanticRole: "details_link", neverCountedAsPrimaryJourneyAction: true }] },
  rights_forbidden: { state: "rights_forbidden", transitionMode: "user_required", messageKey: "supply.state.rights_forbidden", primaryActionDescriptor: SUPPLY_VIEW_PRIMARY_ACTION_DESCRIPTORS_V8.rights_forbidden, optionalControls: [{ controlId: "rights_reason", semanticRole: "details_link", neverCountedAsPrimaryJourneyAction: true }] },
  custom_private_consent: { state: "custom_private_consent", transitionMode: "user_required", messageKey: "supply.state.custom_private_consent", primaryActionDescriptor: SUPPLY_VIEW_PRIMARY_ACTION_DESCRIPTORS_V8.custom_private_consent, optionalControls: [{ controlId: "data_destination", semanticRole: "details_link", neverCountedAsPrimaryJourneyAction: true }, { controlId: "advanced_configuration", semanticRole: "secondary_action", neverCountedAsPrimaryJourneyAction: true }] },
  staged_failed: { state: "staged_failed", transitionMode: "user_required", messageKey: "supply.state.staged_failed", primaryActionDescriptor: SUPPLY_VIEW_PRIMARY_ACTION_DESCRIPTORS_V8.staged_failed, optionalControls: [{ controlId: "technical_details", semanticRole: "details_link", neverCountedAsPrimaryJourneyAction: true }] },
  paid_dispatch_locked: { state: "paid_dispatch_locked", transitionMode: "user_required", messageKey: "supply.state.paid_dispatch_locked", primaryActionDescriptor: SUPPLY_VIEW_PRIMARY_ACTION_DESCRIPTORS_V8.paid_dispatch_locked, optionalControls: [{ controlId: "configure_persistent_budget", semanticRole: "secondary_action", neverCountedAsPrimaryJourneyAction: true }] },
  spend_consent: { state: "spend_consent", transitionMode: "user_required", messageKey: "supply.state.spend_consent", primaryActionDescriptor: SUPPLY_VIEW_PRIMARY_ACTION_DESCRIPTORS_V8.spend_consent, optionalControls: [{ controlId: "funding_evidence", semanticRole: "details_link", neverCountedAsPrimaryJourneyAction: true }] },
  custom_protocol_probe: { state: "custom_protocol_probe", transitionMode: "user_required", messageKey: "supply.state.custom_protocol_probe", primaryActionDescriptor: SUPPLY_VIEW_PRIMARY_ACTION_DESCRIPTORS_V8.custom_protocol_probe, optionalControls: [{ controlId: "select_protocol_manually", semanticRole: "secondary_action", neverCountedAsPrimaryJourneyAction: true }] },
  conversation_ready: { state: "conversation_ready", transitionMode: "terminal_start", messageKey: "supply.state.conversation_ready", primaryActionDescriptor: SUPPLY_VIEW_PRIMARY_ACTION_DESCRIPTORS_V8.conversation_ready, optionalControls: [{ controlId: "choose_another_solution", semanticRole: "secondary_action", neverCountedAsPrimaryJourneyAction: true }, { controlId: "advanced_configuration", semanticRole: "secondary_action", neverCountedAsPrimaryJourneyAction: true }] },
  review_ready: { state: "review_ready", transitionMode: "terminal_start", messageKey: "supply.state.review_ready", primaryActionDescriptor: SUPPLY_VIEW_PRIMARY_ACTION_DESCRIPTORS_V8.review_ready, optionalControls: [{ controlId: "independent_reviewer_sources", semanticRole: "details_link", neverCountedAsPrimaryJourneyAction: true }, { controlId: "choose_another_solution", semanticRole: "secondary_action", neverCountedAsPrimaryJourneyAction: true }] },
} as const satisfies SupplyViewStateRegistryContractV8;

type SupplyViewStateDefinitionV8 = (typeof SUPPLY_VIEW_STATE_REGISTRY_V8)[keyof typeof SUPPLY_VIEW_STATE_REGISTRY_V8];

const SUPPLY_STATIC_REGISTRY_FORBIDDEN_DYNAMIC_PROPERTIES_V8 = [
  "receiptKind",
  "id",
  "digest",
  "dependencyDomainDigest",
  "committedSequence",
  "localControlSession",
  "authoritativeDomainSubject",
  "authoritativeDomainReceipt",
  "exactDomainSubject",
  "controlEpoch",
  "singleUseActionNonce",
  "hardStopGeneration",
  "generation",
  "expiresAt",
] as const;

declare const supplyStaticRegistrySerializationGateBrandV8: unique symbol;

interface SupplyStaticRegistrySerializationGateReceiptV8 extends ReceiptRef<
  "receipt:supply-static-registry-serialization-gate@8",
  typeof SUPPLY_VIEW_STATE_REGISTRY_V8
> {
  readonly [supplyStaticRegistrySerializationGateBrandV8]: never;
  readonly canonicalStaticRegistryBytesDigest: string;
  readonly forbiddenPropertyOccurrenceCount: {
    readonly [K in (typeof SUPPLY_STATIC_REGISTRY_FORBIDDEN_DYNAMIC_PROPERTIES_V8)[number]]: 0;
  };
  readonly serializedReceiptReferenceCount: 0;
  readonly serializedSessionNonceGenerationOrExpiryCount: 0;
}

declare function gateSupplyStaticRegistrySerializationV8(input: {
  readonly registry: typeof SUPPLY_VIEW_STATE_REGISTRY_V8;
  readonly primaryActionDescriptors: typeof SUPPLY_VIEW_PRIMARY_ACTION_DESCRIPTORS_V8;
  readonly canonicalStaticRegistrySerializerArtifact: TufTargetAuthorizationReceipt;
  readonly forbiddenProperties: typeof SUPPLY_STATIC_REGISTRY_FORBIDDEN_DYNAMIC_PROPERTIES_V8;
}): DeepFrozenCommittedReceiptV1<SupplyStaticRegistrySerializationGateReceiptV8>;

declare const supplyViewStateRegistryBrandV8: unique symbol;

interface SupplyViewStateRegistryReceiptV8 extends ReceiptRef<
  "receipt:supply-view-state-registry@8",
  typeof SUPPLY_VIEW_STATE_REGISTRY_V8
> {
  readonly [supplyViewStateRegistryBrandV8]: never;
  readonly registry: typeof SUPPLY_VIEW_STATE_REGISTRY_V8;
  readonly primaryActionDescriptors: typeof SUPPLY_VIEW_PRIMARY_ACTION_DESCRIPTORS_V8;
  readonly staticSerializationGate: SupplyStaticRegistrySerializationGateReceiptV8;
  readonly exactStateKeys: readonly SupplyViewStateIdV6[];
  readonly automaticStateCount: 5;
  readonly userRequiredStateCount: 12;
  readonly terminalStartStateCount: 2;
  readonly missingDuplicateOrExtraStateCount: 0;
  readonly automaticPrimaryActionDescriptorCount: 0;
  readonly actionableStateWithoutDescriptorCount: 0;
}

declare function commitSupplyViewStateRegistryV8(input: {
  readonly registry: typeof SUPPLY_VIEW_STATE_REGISTRY_V8;
  readonly primaryActionDescriptors: typeof SUPPLY_VIEW_PRIMARY_ACTION_DESCRIPTORS_V8;
  readonly staticSerializationGate: SupplyStaticRegistrySerializationGateReceiptV8;
  readonly icuCatalogArtifact: ImportedOpaqueEvidenceLeafReceipt;
  readonly domAndAccessibilityProjectionArtifact: ImportedOpaqueEvidenceLeafReceipt;
  readonly journeyAndClickHandlerArtifact: TufTargetAuthorizationReceipt;
}): DeepFrozenCommittedReceiptV1<SupplyViewStateRegistryReceiptV8>;

declare const safeAutomaticCandidateBrandV8: unique symbol;

type SafeAutomaticCandidateReceiptV8 = ReceiptRef<"receipt:safe-automatic-candidate@8"> & {
  readonly [safeAutomaticCandidateBrandV8]: never;
  readonly candidateDigest: string;
  readonly discoveryMode: "static_filesystem" | "passive_loopback_metadata";
  readonly networkScope: "loopback_only";
  readonly credentialReadCap: 0;
  readonly paidOrUnknownBillingRequestCap: 0;
  readonly externalEffectCap: 0;
  readonly rightsState: "allowed";
  readonly activeValidationSequenceIsHostOwnedAndZeroUserAction: true;
};

type CandidateViewProjectionV8 =
  | {
      readonly state: "candidate_safe_auto";
      readonly automaticEligibility: SafeAutomaticCandidateReceiptV8;
      readonly reviewReason?: never;
    }
  | {
      readonly state: "candidate_requires_review";
      readonly automaticEligibility?: never;
      readonly reviewReason:
        | "credential_required"
        | "network_or_process_effect_requires_consent"
        | "rights_or_funding_requires_decision"
        | "custom_or_changed_identity";
    };

declare const supplyViewDomainSubjectBrandV8: unique symbol;
declare const supplyStateAuthoritativeReceiptBrandV9: unique symbol;

type SupplyStateAuthoritativeEvidenceForV9<S extends SupplyViewStateIdV6> =
  S extends "review_ready"
    ? DeepFrozenCommittedReceiptV1<ReviewReadySupplySolutionReceiptV5>
    : S extends "conversation_ready"
      ? SupplySolutionReceipt
      : S extends "rights_unknown"
        ? PreCredentialEligibilityStateReceiptV19 | BlockedRightsDecisionReceiptV9<RightsSubjectV8, "unknown">
        : S extends "rights_forbidden"
          ? PreCredentialEligibilityStateReceiptV19 | BlockedRightsDecisionReceiptV9<RightsSubjectV8, "forbidden">
          : S extends "candidate_safe_auto"
            ? SafeAutomaticCandidateReceiptV8
            : ReceiptRef<"receipt:supply-state-authoritative-evidence@9", S>;

type SupplyStateAuthoritativeReceiptV9<S extends SupplyViewStateIdV6> = ReceiptRef<
  "receipt:supply-state-authoritative-receipt@9",
  S
> & {
  readonly [supplyStateAuthoritativeReceiptBrandV9]: S;
  readonly targetState: S;
  readonly stateSpecificEvidence: SupplyStateAuthoritativeEvidenceForV9<S>;
  readonly evidenceDigest: SupplyStateAuthoritativeEvidenceForV9<S>["digest"];
  readonly sourceGeneration: number;
  readonly expiresAt: string;
  readonly stateSpecificProducerId: `supply-state-producer:${S}@9`;
  readonly generatedOnlyByTheExactStateSpecificReducerAndCannotBeCallerProjected: true;
};

type SupplyAuthoritativeDomainReceiptForStateV9<S extends SupplyViewStateIdV6> =
  SupplyStateAuthoritativeReceiptV9<S>;

type SupplyViewDomainSubjectV8<
  S extends SupplyViewStateIdV6,
  T extends SupplyAuthoritativeDomainReceiptForStateV9<S> = SupplyAuthoritativeDomainReceiptForStateV9<S>,
> = ReceiptRef<"receipt:supply-view-domain-subject@8", readonly [S, T]> & {
  readonly [supplyViewDomainSubjectBrandV8]: never;
  readonly targetState: S;
  readonly authoritativeDomainReceipt: T;
  readonly stateProjectionCompiler: ReceiptRef<
    "receipt:supply-domain-state-projection-compiler@8",
    readonly [T, S]
  >;
};

declare function compileSupplyViewDomainSubjectV8<
  const S extends SupplyViewStateIdV6,
  const T extends SupplyAuthoritativeDomainReceiptForStateV9<S>,
>(input: {
  readonly targetState: S;
  readonly authoritativeDomainReceipt: T;
  readonly stateProjectionCompilerArtifact: TufTargetAuthorizationReceipt;
}): DeepFrozenCommittedReceiptV1<SupplyViewDomainSubjectV8<S, T>>;

declare const supplyViewDomainEventBrandV8: unique symbol;

type SupplyViewDomainEventForStateV8<
  S extends SupplyViewStateIdV6,
  DS extends SupplyViewDomainSubjectV8<S>,
> = ReceiptRef<"receipt:supply-view-domain-event@8", readonly [S, DS]> & {
  readonly [supplyViewDomainEventBrandV8]: never;
  readonly targetState: S;
  readonly authoritativeDomainSubject: DS;
  readonly expectedRegistryRow: (typeof SUPPLY_VIEW_STATE_REGISTRY_V8)[S];
  readonly transitionGraphEdge: ReceiptRef<
    "receipt:supply-view-transition-edge@8",
    readonly [S, DS]
  >;
} & (S extends SupplyViewAutomaticStateV5
  ? {
      readonly automaticTransitionEvidence: ImportedOpaqueEvidenceLeafReceipt;
      readonly actionReadinessEvidence?: never;
    }
  : {
      readonly automaticTransitionEvidence?: never;
      readonly actionReadinessEvidence: ReceiptRef<
        "receipt:supply-action-readiness@8",
        readonly [S, DS]
      >;
    });

declare function commitSupplyViewDomainEventV8<
  const S extends SupplyViewStateIdV6,
  const DS extends SupplyViewDomainSubjectV8<S>,
>(input: {
  readonly targetState: S;
  readonly authoritativeDomainSubject: DS;
  readonly expectedRegistryRow: (typeof SUPPLY_VIEW_STATE_REGISTRY_V8)[S];
  readonly transitionGraphEdge: ReceiptRef<"receipt:supply-view-transition-edge@8", readonly [S, DS]>;
} & (S extends SupplyViewAutomaticStateV5
  ? {
      readonly automaticTransitionEvidence: ImportedOpaqueEvidenceLeafReceipt;
      readonly actionReadinessEvidence?: never;
    }
  : {
      readonly automaticTransitionEvidence?: never;
      readonly actionReadinessEvidence: ReceiptRef<"receipt:supply-action-readiness@8", readonly [S, DS]>;
    })): DeepFrozenCommittedReceiptV1<SupplyViewDomainEventForStateV8<S, DS>>;

declare const supplyExecutablePrimaryActionDestinationBrandV8: unique symbol;
declare const supplyExecutablePrimaryActionBrandV8: unique symbol;

type SupplyExecutablePrimaryActionDestinationV8<
  S extends SupplyViewNormalActionStateV8,
  DS extends SupplyViewDomainSubjectV8<S>,
> = ReceiptRef<"receipt:supply-primary-action-destination@8", readonly [S, DS]> & {
  readonly [supplyExecutablePrimaryActionDestinationBrandV8]: never;
  readonly sourceState: S;
  readonly exactDomainSubject: DS;
  readonly staticDescriptor: (typeof SUPPLY_VIEW_PRIMARY_ACTION_DESCRIPTORS_V8)[S];
  readonly actionRoute: ReceiptRef<
    "receipt:supply-primary-action-route@8",
    readonly [S, SupplyPrimaryActionForStateMapV8[S], DS]
  >;
  readonly journeyGraphOrCommandProfile: ReceiptRef<
    "receipt:supply-primary-action-handler-profile@8",
    readonly [S, SupplyPrimaryActionForStateMapV8[S]]
  >;
  readonly executableHandlerArtifact: TufTargetAuthorizationReceipt;
};

declare function compileSupplyExecutablePrimaryActionDestinationV8<
  const S extends SupplyViewNormalActionStateV8,
  const DS extends SupplyViewDomainSubjectV8<S>,
>(input: {
  readonly domainSubject: DS;
  readonly staticDescriptor: (typeof SUPPLY_VIEW_PRIMARY_ACTION_DESCRIPTORS_V8)[S];
  readonly actionRoute: ReceiptRef<
    "receipt:supply-primary-action-route@8",
    readonly [S, SupplyPrimaryActionForStateMapV8[S], DS]
  >;
  readonly journeyGraphOrCommandProfile: ReceiptRef<
    "receipt:supply-primary-action-handler-profile@8",
    readonly [S, SupplyPrimaryActionForStateMapV8[S]]
  >;
  readonly executableHandlerArtifact: TufTargetAuthorizationReceipt;
}): DeepFrozenCommittedReceiptV1<SupplyExecutablePrimaryActionDestinationV8<S, DS>>;

type SupplyExecutablePrimaryActionReceiptV8<
  S extends SupplyViewNormalActionStateV8,
  DS extends SupplyViewDomainSubjectV8<S>,
> = ReceiptRef<"receipt:supply-executable-primary-action@8", readonly [S, DS]> & {
  readonly [supplyExecutablePrimaryActionBrandV8]: never;
  readonly actionId: SupplyPrimaryActionForStateMapV8[S];
  readonly labelKey: SupplyPrimaryActionLabelKeyMapV8[SupplyPrimaryActionForStateMapV8[S]];
  readonly destination: SupplyExecutablePrimaryActionDestinationV8<S, DS>;
};

declare function commitSupplyExecutablePrimaryActionV8<
  const S extends SupplyViewNormalActionStateV8,
  const DS extends SupplyViewDomainSubjectV8<S>,
>(input: {
  readonly destination: SupplyExecutablePrimaryActionDestinationV8<S, DS>;
}): DeepFrozenCommittedReceiptV1<SupplyExecutablePrimaryActionReceiptV8<S, DS>>;

declare const supplyRightsBlockedExecutablePrimaryActionBrandV9: unique symbol;

type RightsStatusForSupplyStateV9<S extends "rights_unknown" | "rights_forbidden"> =
  S extends "rights_unknown" ? "unknown" : "forbidden";

type RightsBlockedPrimaryActionForSupplyStateV9<
  S extends "rights_unknown" | "rights_forbidden",
> =
  | {
      [P in OfficialApiMigrationPolicyV8["sourceProductId"]]: RightsBlockedPrimaryActionReceiptV8<
        P,
        RightsStatusForSupplyStateV9<S>,
        string,
        BlockedRightsEvidenceForProductV9<P, RightsStatusForSupplyStateV9<S>>
      >;
    }[OfficialApiMigrationPolicyV8["sourceProductId"]]
  | RightsBlockedPrimaryActionReceiptV8<
      string,
      RightsStatusForSupplyStateV9<S>,
      string,
      BlockedRightsEvidenceForProductV9<string, RightsStatusForSupplyStateV9<S>>
    >;

type SupplyRightsBlockedExecutablePrimaryActionReceiptV9<
  S extends "rights_unknown" | "rights_forbidden",
  DS extends SupplyViewDomainSubjectV8<S>,
  R extends RightsBlockedPrimaryActionForSupplyStateV9<S> = RightsBlockedPrimaryActionForSupplyStateV9<S>,
> = ReceiptRef<"receipt:supply-rights-blocked-executable-primary-action@9", readonly [S, DS, R]> & {
  readonly [supplyRightsBlockedExecutablePrimaryActionBrandV9]: never;
  readonly sourceState: S;
  readonly exactDomainSubject: DS;
  readonly resolvedRightsAction: R;
  readonly actionId: R["actionId"];
  readonly labelKey: "supply.action.resolve_rights";
  readonly sourceRightsEvidence: R["sourceRightsEvidence"];
  readonly executableDestination: R extends { readonly actionId: "switch_to_official_api" }
    ? R["destinationJourney"]
    : R extends { readonly actionId: "choose_another_source" }
      ? R["alternativePickerJourney"]
      : never;
  readonly executableHandlerArtifact: TufTargetAuthorizationReceipt;
};

declare function commitSupplyRightsBlockedExecutablePrimaryActionV9<
  const S extends "rights_unknown" | "rights_forbidden",
  const DS extends SupplyViewDomainSubjectV8<S>,
  const R extends RightsBlockedPrimaryActionForSupplyStateV9<S>,
>(input: {
  readonly domainSubject: DS;
  readonly resolvedRightsAction: R;
  readonly executableDestination: R extends { readonly actionId: "switch_to_official_api" }
    ? R["destinationJourney"]
    : R extends { readonly actionId: "choose_another_source" }
      ? R["alternativePickerJourney"]
      : never;
  readonly executableHandlerArtifact: TufTargetAuthorizationReceipt;
}): DeepFrozenCommittedReceiptV1<SupplyRightsBlockedExecutablePrimaryActionReceiptV9<S, DS, R>>;

type SupplyResolvedPrimaryActionShapeForStateV8<
  S extends SupplyViewActionableStateV8,
  DS extends SupplyViewDomainSubjectV8<S> = SupplyViewDomainSubjectV8<S>,
> =
  S extends SupplyViewNormalActionStateV8
    ? SupplyExecutablePrimaryActionReceiptV8<S, DS>
    : S extends "rights_unknown"
      ? SupplyRightsBlockedExecutablePrimaryActionReceiptV9<"rights_unknown", Extract<DS, SupplyViewDomainSubjectV8<"rights_unknown">>>
      : SupplyRightsBlockedExecutablePrimaryActionReceiptV9<"rights_forbidden", Extract<DS, SupplyViewDomainSubjectV8<"rights_forbidden">>>;

declare const supplyActionControlEpochBrandV8: unique symbol;

interface SupplyActionControlEpochReceiptV8<
  S extends SupplyViewActionableStateV8,
  DS extends SupplyViewDomainSubjectV8<S>,
  L extends LocalControlSessionReceipt,
> extends ReceiptRef<"receipt:supply-action-control-epoch@8", readonly [S, DS, L]> {
  readonly [supplyActionControlEpochBrandV8]: never;
  readonly sourceState: S;
  readonly exactDomainSubject: DS;
  readonly exactLocalControlSession: L;
  readonly currentHardStopGeneration: number;
  readonly expiresAt: string;
}

declare function observeSupplyActionControlEpochV8<
  const S extends SupplyViewActionableStateV8,
  const DS extends SupplyViewDomainSubjectV8<S>,
  const L extends LocalControlSessionReceipt,
>(input: {
  readonly domainSubject: DS;
  readonly localControlSession: L;
  readonly generationAuthority: ReceiptRef<"receipt:supply-control-generation-authority@8", S>;
  readonly monotonicClockEvidence: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<SupplyActionControlEpochReceiptV8<S, DS, L>>;

declare const supplyExecutablePrimaryActionCapabilityBrandV8: unique symbol;
declare const supplySingleUseActionNonceBrandV8: unique symbol;
declare const supplyLocalActionAuthorizationBrandV9: unique symbol;
declare const supplyRenderInstanceBrandV9: unique symbol;
declare const supplyRenderMintCommitBrandV9: unique symbol;

type SupplyExecutableDestinationForResolvedActionV9<R extends ReceiptRef> =
  R extends { readonly destination: infer D extends ReceiptRef }
    ? D
    : R extends { readonly executableDestination: infer D extends ReceiptRef }
      ? D
      : never;

interface SupplyLocalActionAuthorizationReceiptV9<
  S extends SupplyViewActionableStateV8,
  DS extends SupplyViewDomainSubjectV8<S>,
  L extends LocalControlSessionReceipt,
  R extends SupplyResolvedPrimaryActionShapeForStateV8<S, DS>,
> extends ReceiptRef<"receipt:supply-local-action-authorization@9", readonly [S, DS, L, R]> {
  readonly [supplyLocalActionAuthorizationBrandV9]: never;
  readonly sourceState: S;
  readonly exactDomainSubject: DS;
  readonly exactLocalControlSession: L;
  readonly exactResolvedAction: R;
  readonly exactExecutableDestination: SupplyExecutableDestinationForResolvedActionV9<R>;
  readonly exactHandlerArtifact: TufTargetAuthorizationReceipt;
  readonly hardStopGeneration: number;
  readonly expiresAt: string;
  readonly createdOnlyByTheExactDestinationHandlerAuthorizationProducer: true;
}

declare function authorizeSupplyLocalPrimaryActionV9<
  const S extends SupplyViewActionableStateV8,
  const DS extends SupplyViewDomainSubjectV8<S>,
  const L extends LocalControlSessionReceipt,
  const R extends SupplyResolvedPrimaryActionShapeForStateV8<S, DS>,
>(input: {
  readonly domainSubject: DS;
  readonly localControlSession: L;
  readonly resolvedAction: R;
  readonly exactExecutableDestination: SupplyExecutableDestinationForResolvedActionV9<R>;
  readonly exactHandlerArtifact: TufTargetAuthorizationReceipt;
  readonly controlEpoch: SupplyActionControlEpochReceiptV8<S, DS, L>;
}): DeepFrozenCommittedReceiptV1<SupplyLocalActionAuthorizationReceiptV9<S, DS, L, R>>;

interface SupplyRenderInstanceReceiptV9<
  S extends SupplyViewActionableStateV8,
  DS extends SupplyViewDomainSubjectV8<S>,
  L extends LocalControlSessionReceipt,
> extends ReceiptRef<"receipt:supply-render-instance@9", readonly [S, DS, L]> {
  readonly [supplyRenderInstanceBrandV9]: never;
  readonly sourceState: S;
  readonly exactDomainSubject: DS;
  readonly exactLocalControlSession: L;
  readonly renderInstanceId: string;
  readonly renderRevision: number;
  readonly stateRevision: number;
  readonly capabilityMintState: "unminted";
  readonly hardStopGeneration: number;
  readonly expiresAt: string;
}

declare function beginSupplyViewRenderV9<
  const S extends SupplyViewActionableStateV8,
  const DS extends SupplyViewDomainSubjectV8<S>,
  const L extends LocalControlSessionReceipt,
>(input: {
  readonly committedStateRegistry: SupplyViewStateRegistryReceiptV8;
  readonly domainSubject: DS;
  readonly localControlSession: L;
  readonly controlEpoch: SupplyActionControlEpochReceiptV8<S, DS, L>;
  readonly authoritativeStateRevision: number;
  readonly renderCursorAuthority: ReceiptRef<"receipt:supply-render-cursor-authority@9", readonly [S, DS, L]>;
}): DeepFrozenCommittedReceiptV1<SupplyRenderInstanceReceiptV9<S, DS, L>>;

interface SupplyRenderMintCommitReceiptV9<
  S extends SupplyViewActionableStateV8,
  DS extends SupplyViewDomainSubjectV8<S>,
  L extends LocalControlSessionReceipt,
  R extends SupplyResolvedPrimaryActionShapeForStateV8<S, DS>,
> extends ReceiptRef<"receipt:supply-render-mint-commit@9", readonly [S, DS, L, R]> {
  readonly [supplyRenderMintCommitBrandV9]: never;
  readonly renderInstance: SupplyRenderInstanceReceiptV9<S, DS, L>;
  readonly exactResolvedAction: R;
  readonly predecessorMintState: "unminted";
  readonly successorMintState: "minted";
  readonly renderScopedSingleSuccessorCasCommitted: true;
}

interface SupplySingleUseActionNonceReceiptV8<
  S extends SupplyViewActionableStateV8,
  DS extends SupplyViewDomainSubjectV8<S>,
  L extends LocalControlSessionReceipt,
  R extends SupplyResolvedPrimaryActionShapeForStateV8<S, DS>,
> extends ReceiptRef<"receipt:supply-single-use-action-nonce@8", readonly [S, DS, L, R]> {
  readonly [supplySingleUseActionNonceBrandV8]: never;
  readonly sourceState: S;
  readonly exactDomainSubject: DS;
  readonly exactLocalControlSession: L;
  readonly exactResolvedAction: R;
  readonly renderInstance: SupplyRenderInstanceReceiptV9<S, DS, L>;
  readonly nonceAuthority: ReceiptRef<"receipt:supply-action-nonce-authority@8", L>;
  readonly nonceState: "unused";
  readonly expiresAt: string;
}

interface SupplyExecutablePrimaryActionCapabilityV8<
  S extends SupplyViewActionableStateV8,
  DS extends SupplyViewDomainSubjectV8<S>,
  L extends LocalControlSessionReceipt,
  R extends SupplyResolvedPrimaryActionShapeForStateV8<S, DS>,
> extends ReceiptRef<"receipt:supply-executable-primary-action-capability@8", readonly [S, DS, L, R]> {
  readonly [supplyExecutablePrimaryActionCapabilityBrandV8]: never;
  readonly sourceState: S;
  readonly exactDomainSubject: DS;
  readonly exactLocalControlSession: L;
  readonly staticDescriptor: (typeof SUPPLY_VIEW_PRIMARY_ACTION_DESCRIPTORS_V8)[S];
  readonly exactResolvedAction: R;
  readonly controlEpoch: SupplyActionControlEpochReceiptV8<S, DS, L>;
  readonly renderInstance: SupplyRenderInstanceReceiptV9<S, DS, L>;
  readonly renderMintCommit: SupplyRenderMintCommitReceiptV9<S, DS, L, R>;
  readonly localActionAuthorization: SupplyLocalActionAuthorizationReceiptV9<S, DS, L, R>;
  readonly singleUseActionNonce: SupplySingleUseActionNonceReceiptV8<S, DS, L, R>;
  readonly capabilityFactoryArtifact: TufTargetAuthorizationReceipt;
  readonly hardStopGeneration: SupplyActionControlEpochReceiptV8<S, DS, L>["currentHardStopGeneration"];
  readonly expiresAt: SupplyActionControlEpochReceiptV8<S, DS, L>["expiresAt"];
}

declare function mintSupplyExecutablePrimaryActionCapabilityV8<
  const S extends SupplyViewActionableStateV8,
  const DS extends SupplyViewDomainSubjectV8<S>,
  const L extends LocalControlSessionReceipt,
  const R extends SupplyResolvedPrimaryActionShapeForStateV8<S, DS>,
>(input: {
  readonly committedStateRegistry: SupplyViewStateRegistryReceiptV8;
  readonly staticSerializationGate: SupplyStaticRegistrySerializationGateReceiptV8;
  readonly domainSubject: DS;
  readonly localControlSession: L;
  readonly controlEpoch: SupplyActionControlEpochReceiptV8<S, DS, L>;
  readonly renderInstance: SupplyRenderInstanceReceiptV9<S, DS, L>;
  readonly resolvedAction: R;
  readonly localActionAuthorization: SupplyLocalActionAuthorizationReceiptV9<S, DS, L, R>;
  readonly renderMintCasAuthority: ReceiptRef<
    "receipt:supply-render-mint-cas-authority@9",
    SupplyRenderInstanceReceiptV9<S, DS, L>
  >;
  readonly nonceAuthority: ReceiptRef<"receipt:supply-action-nonce-authority@8", L>;
  readonly capabilityFactoryArtifact: TufTargetAuthorizationReceipt;
}): DeepFrozenCommittedReceiptV1<SupplyExecutablePrimaryActionCapabilityV8<S, DS, L, R>>;

declare const supplyViewReducerArtifactBrandV8: unique symbol;

interface SupplyViewReducerArtifactV8 extends ReceiptRef<
  "receipt:supply-view-reducer@8",
  typeof SUPPLY_VIEW_STATE_REGISTRY_V8
> {
  readonly [supplyViewReducerArtifactBrandV8]: never;
  readonly committedStateRegistry: SupplyViewStateRegistryReceiptV8;
  readonly transitionGraphArtifact: TufTargetAuthorizationReceipt;
  readonly icuDomAndJourneyProjectionEvidence: NonEmptyReadonly<ImportedOpaqueEvidenceLeafReceipt>;
  readonly stateRegistry: typeof SUPPLY_VIEW_STATE_REGISTRY_V8;
  readonly everyReachableAutomaticStateHasZeroPrimaryActions: true;
  readonly everyReachableActionableStateHasExactlyOneDynamicCapabilityFactory: true;
  readonly staticRegistryContainsNoSessionSubjectNonceGenerationExpiryOrReceiptRef: true;
}

declare function commitSupplyViewReducerArtifactV8(input: {
  readonly committedStateRegistry: SupplyViewStateRegistryReceiptV8;
  readonly transitionGraphArtifact: TufTargetAuthorizationReceipt;
  readonly icuDomAndJourneyProjectionEvidence: NonEmptyReadonly<ImportedOpaqueEvidenceLeafReceipt>;
}): DeepFrozenCommittedReceiptV1<SupplyViewReducerArtifactV8>;

type SupplyViewModelForStateV8<
  S extends SupplyViewStateIdV6,
  DS extends SupplyViewDomainSubjectV8<S>,
  L extends LocalControlSessionReceipt = LocalControlSessionReceipt,
  R extends ReceiptRef = ReceiptRef,
> = DeepReadonlyV1<
  (typeof SUPPLY_VIEW_STATE_REGISTRY_V8)[S] & {
    readonly domainSubject: DS;
  } & (S extends SupplyViewAutomaticStateV5
    ? {
        readonly localControlSession?: never;
        readonly primaryActionCapability?: never;
      }
    : S extends SupplyViewActionableStateV8
      ? {
        readonly localControlSession: L;
        readonly renderInstance: SupplyRenderInstanceReceiptV9<
          S,
          Extract<DS, SupplyViewDomainSubjectV8<S>>,
          L
        >;
        readonly primaryActionCapability: SupplyExecutablePrimaryActionCapabilityV8<
          S,
          Extract<DS, SupplyViewDomainSubjectV8<S>>,
          L,
          Extract<R, SupplyResolvedPrimaryActionShapeForStateV8<S, Extract<DS, SupplyViewDomainSubjectV8<S>>>>
        >;
      }
      : never)
>;

type CandidateViewProjectionInputForStateV8<S extends SupplyViewStateIdV6> =
  S extends CandidateViewProjectionV8["state"]
    ? { readonly candidateProjection: Extract<CandidateViewProjectionV8, { readonly state: S }> }
    : { readonly candidateProjection?: never };

declare function reduceSupplyViewAutomaticStateV8<
  const S extends SupplyViewAutomaticStateV5,
  const DS extends SupplyViewDomainSubjectV8<S>,
>(input: {
  readonly reducer: SupplyViewReducerArtifactV8;
  readonly committedStateRegistry: SupplyViewStateRegistryReceiptV8;
  readonly predecessorState: SupplyViewStateDefinitionV8;
  readonly domainEvent: SupplyViewDomainEventForStateV8<S, DS>;
} & CandidateViewProjectionInputForStateV8<S>): SupplyViewModelForStateV8<S, DS>;

declare function reduceSupplyViewActionableStateV8<
  const S extends SupplyViewActionableStateV8,
  const DS extends SupplyViewDomainSubjectV8<S>,
  const L extends LocalControlSessionReceipt,
  const R extends SupplyResolvedPrimaryActionShapeForStateV8<S, DS>,
>(input: {
  readonly reducer: SupplyViewReducerArtifactV8;
  readonly committedStateRegistry: SupplyViewStateRegistryReceiptV8;
  readonly predecessorState: SupplyViewStateDefinitionV8;
  readonly domainEvent: SupplyViewDomainEventForStateV8<S, DS>;
  readonly localControlSession: L;
  readonly renderInstance: SupplyRenderInstanceReceiptV9<S, DS, L>;
  readonly primaryActionCapability: SupplyExecutablePrimaryActionCapabilityV8<S, DS, L, R>;
} & CandidateViewProjectionInputForStateV8<S>): SupplyViewModelForStateV8<S, DS, L, R>;

declare const supplyActionNonceConsumptionBrandV8: unique symbol;
declare const supplyRenderFreshnessValidationBrandV9: unique symbol;

interface SupplyRenderFreshnessValidationReceiptV9<
  S extends SupplyViewActionableStateV8,
  DS extends SupplyViewDomainSubjectV8<S>,
  L extends LocalControlSessionReceipt,
  R extends SupplyResolvedPrimaryActionShapeForStateV8<S, DS>,
> extends ReceiptRef<"receipt:supply-render-freshness-validation@9", readonly [S, DS, L, R]> {
  readonly [supplyRenderFreshnessValidationBrandV9]: never;
  readonly capability: SupplyExecutablePrimaryActionCapabilityV8<S, DS, L, R>;
  readonly currentRenderInstance: SupplyRenderInstanceReceiptV9<S, DS, L>;
  readonly currentAuthoritativeState: SupplyStateAuthoritativeReceiptV9<S>;
  readonly currentStateRevision: number;
  readonly capabilityRenderIdRevisionStateDomainSessionGenerationAndExpiryEqualCurrentRender: true;
  readonly validationCommittedImmediatelyBeforeEffect: true;
}

declare function validateSupplyRenderFreshnessBeforeEffectV9<
  const S extends SupplyViewActionableStateV8,
  const DS extends SupplyViewDomainSubjectV8<S>,
  const L extends LocalControlSessionReceipt,
  const R extends SupplyResolvedPrimaryActionShapeForStateV8<S, DS>,
>(input: {
  readonly capability: SupplyExecutablePrimaryActionCapabilityV8<S, DS, L, R>;
  readonly currentRenderInstance: SupplyRenderInstanceReceiptV9<S, DS, L>;
  readonly currentAuthoritativeState: SupplyStateAuthoritativeReceiptV9<S>;
  readonly currentStateRevision: number;
  readonly monotonicClockEvidence: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<SupplyRenderFreshnessValidationReceiptV9<S, DS, L, R>>;

interface SupplyActionNonceConsumptionReceiptV8<
  S extends SupplyViewActionableStateV8,
  DS extends SupplyViewDomainSubjectV8<S>,
  L extends LocalControlSessionReceipt,
  R extends SupplyResolvedPrimaryActionShapeForStateV8<S, DS>,
> extends ReceiptRef<"receipt:supply-action-nonce-consumption@8", readonly [S, DS, L, R]> {
  readonly [supplyActionNonceConsumptionBrandV8]: never;
  readonly capability: SupplyExecutablePrimaryActionCapabilityV8<S, DS, L, R>;
  readonly predecessorNonce: SupplySingleUseActionNonceReceiptV8<S, DS, L, R> & {
    readonly nonceState: "unused";
  };
  readonly successorNonceState: "consumed";
  readonly compareAndSwapCommitted: true;
}

interface SupplyPrimaryActionExecutionTerminalReceiptV8<
  S extends SupplyViewActionableStateV8,
  DS extends SupplyViewDomainSubjectV8<S>,
  L extends LocalControlSessionReceipt,
  R extends SupplyResolvedPrimaryActionShapeForStateV8<S, DS>,
> extends ReceiptRef<"receipt:supply-view-primary-action-execution-terminal@8", readonly [S, DS, L, R]> {
  readonly capability: SupplyExecutablePrimaryActionCapabilityV8<S, DS, L, R>;
  readonly renderFreshnessValidation: SupplyRenderFreshnessValidationReceiptV9<S, DS, L, R>;
  readonly nonceConsumption: SupplyActionNonceConsumptionReceiptV8<S, DS, L, R>;
  readonly terminalState: "dispatched_once" | "rejected_before_effect";
}

declare function executeSupplyViewPrimaryActionV8<
  const S extends SupplyViewActionableStateV8,
  const DS extends SupplyViewDomainSubjectV8<S>,
  const L extends LocalControlSessionReceipt,
  const R extends SupplyResolvedPrimaryActionShapeForStateV8<S, DS>,
>(input: {
  readonly capability: SupplyExecutablePrimaryActionCapabilityV8<S, DS, L, R>;
  readonly renderFreshnessValidation: SupplyRenderFreshnessValidationReceiptV9<S, DS, L, R>;
}): DeepFrozenCommittedReceiptV1<
  SupplyPrimaryActionExecutionTerminalReceiptV8<S, DS, L, R>
>;

// v19收口层是Phase 0真正允许导出的受信合同。上面的细粒度声明继续作为
// 语义fixture与生成器输入；未列入此导出图的ambient producer不得从
// @saydo/contracts/public或daemon consumer边界可见。
declare const publicAiSupplyContractBrandV19: unique symbol;
declare const generatedReceiptEdgeBrandV19: unique symbol;
declare const receiptEdgeManifestBrandV19: unique symbol;

const AI_SUPPLY_PUBLIC_PRODUCER_IDS_V19 = [
  "verifyJcsAndCommitDeepFrozenReceiptV6",
  "deserializeAndVerifyDeepFrozenReceiptV8",
  "compileAndCommitAiSupplyPublicContractV19",
  "compileAndCommitReceiptEdgeManifestV19",
  "commitPhysicalAttemptAuthorityBindingV19",
  "commitPhysicalAttemptSubjectV19",
  "commitExactPhysicalAttemptTerminalV19",
  "commitFallbackSubjectV19",
  "commitFallbackInitialCursorV19",
  "commitFallbackAttemptStartV19",
  "commitFallbackAdvanceV19",
  "commitFallbackTerminalV19",
  "commitPreCredentialEligibilityStateV19",
  "commitExactComputePolicySubjectV19",
  "commitComputePolicyComponentV19",
  "commitExactComputePolicyBindingV19",
  "normalizeAndCommitOwnerRequirementNamespaceV10",
  "compileOwnerAdditionalRequirementSetV7",
  "compileOwnerRequirementQualificationComponentsV19",
  "commitOwnerRequirementQualificationV19",
  "commitGaMigrationPositiveGateV19",
  "commitGaMigrationAbsenceGateV19",
  "commitDistributionArtifactIdentityV19",
  "commitGeneratedSupportArtifactSetV19",
  "commitGaAccessibilityReleaseClosureV19",
  "commitTypeContractCompileBaselineV10",
  "commitTypeContractCompileGateV1",
  "commitAiSupplySignedExpectedBomV19",
  "commitAiSupplyPassedStepTerminalV19",
  "commitAiSupplyFailedStepTerminalV19",
  "commitAiSupplyNotRunStepTerminalV19",
  "commitAiSupplyFailedOrchestratorTerminalV19",
  "commitAiSupplySuccessfulOrchestratorTerminalV19",
  "commitReleaseEcosystemBindingV19",
  "compileSupplyViewTransitionRegistryV19",
  "SUPPLY_STATE_SPECIFIC_PRODUCERS_V19",
  "commitReferenceGradeTrustRootsV19",
  "commitGaAccessibilityRequiredMatrixV19",
  "commitMfaWorstCaseDerivationV19",
  "commitInferencePluginActivationAuthorizationSubjectV10",
  "commitInferencePluginPolicyV10",
  "commitInferenceActivationPluginPolicyClosureV10",
  "commitInferencePluginRuntimeClosureV10",
  "commitRemoteWitnessObserverIdentityV10",
  "commitRemoteWitnessObserverPairwiseIndependenceV10",
  "commitMonotonicAnchorEnrollmentV10",
  "commitPlatformBoundMonotonicAnchorEnrollmentV10",
  "parseCodexCommandAuthConfigWithoutExecutionV19",
  "commitCodexCommandAuthCandidateV19",
  "commitCodexCommandAuthAuthorizationSubjectV19",
  "commitCodexCommandAuthProcessLeaseV19",
  "commitCodexCommandAuthPreIntentClosureV19",
  "commitCodexCommandAuthSendIntentV19",
  "executeAndCloseCodexCommandAuthProcessV19",
  "commitCodexCommandAuthCredentialV19",
] as const;

type AiSupplyPublicProducerIdV19 = (typeof AI_SUPPLY_PUBLIC_PRODUCER_IDS_V19)[number];

interface AiSupplyPublicContractCompilationReceiptV19 extends ReceiptRef<
  "receipt:ai-supply-public-contract-compilation@19",
  typeof AI_SUPPLY_PUBLIC_PRODUCER_IDS_V19
> {
  readonly [publicAiSupplyContractBrandV19]: never;
  readonly exactExportedProducerIds: typeof AI_SUPPLY_PUBLIC_PRODUCER_IDS_V19;
  readonly actualExportedProducerIds: typeof AI_SUPPLY_PUBLIC_PRODUCER_IDS_V19;
  readonly exportedProducerReturningUncommittedOrUnfrozenReceiptCount: 0;
  readonly exportedConsumerAcceptingUncommittedOrUnfrozenReceiptCount: 0;
  readonly legacyAmbientDeclarationExportCount: 0;
  readonly unregisteredBareReceiptRefAtExportedEdgeCount: 0;
  readonly exportedProducerAndConsumerGraphWasResolvedSemanticallyNotByNameSuffix: true;
  readonly exactExportMapAndResolvedCallSignatureGraphDigest: string;
  readonly everyExportedCallableOrExhaustiveRegistryBindingWasResolvedToItsActualDeclarationSymbol: true;
}

declare function compileAndCommitAiSupplyPublicContractV19(input: {
  readonly canonicalContractArtifact: CanonicalContractArtifactReceiptV3;
  readonly packagePublicExportMapBytes: ImportedOpaqueEvidenceLeafReceipt;
  readonly resolvedProducerCallableOrExhaustiveRegistryBindingGraph: ImportedOpaqueEvidenceLeafReceipt;
  readonly expectedPublicProducerIds: typeof AI_SUPPLY_PUBLIC_PRODUCER_IDS_V19;
  readonly compilerApiAndPackageExportResolverArtifact: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<AiSupplyPublicContractCompilationReceiptV19>;

interface GeneratedReceiptEdgeV19<
  O extends `receipt:${string}@${number}`,
  P extends `/${string}`,
  T extends `receipt:${string}@${number}`,
  S,
> extends ReceiptRef<T, S> {
  readonly [generatedReceiptEdgeBrandV19]: readonly [O, P, T, S];
}

interface ReceiptNodeEdgeSchemaV19 {
  readonly ownerReceiptKind: `receipt:${string}@${number}`;
  readonly ownerJsonPointer: `/${string}`;
  readonly targetReceiptKind: `receipt:${string}@${number}`;
  readonly cardinality: "one" | "optional_one" | "many" | "nonempty_many";
  readonly targetSubjectProjectionId: string;
  readonly opaqueLeaf: boolean;
  readonly ordering: "target_before_owner" | "same_atomic_commit";
  readonly singleSuccessorAuthority: "none" | "subject_cursor_cas";
}

const AI_SUPPLY_PUBLIC_RECEIPT_GRAPH_ROOT_KINDS_V19 = [
  "receipt:ai-supply-public-contract-compilation@19",
  "receipt:receipt-edge-manifest@19",
  "receipt:physical-attempt-authority-binding@19",
  "receipt:physical-attempt-subject@19",
  "receipt:exact-physical-attempt-terminal@19",
  "receipt:fallback-subject@19",
  "receipt:fallback-cursor@19",
  "receipt:fallback-attempt-start@19",
  "receipt:pre-credential-eligibility-state@19",
  "receipt:exact-compute-policy-subject@19",
  "receipt:compute-policy-component@19",
  "receipt:exact-compute-policy-binding@19",
  "receipt:owner-requirement-namespace@10",
  "receipt:owner-additional-requirement-set-compilation@7",
  "receipt:owner-requirement-qualification-component-set@19",
  "receipt:owner-journey-qualification@19",
  "receipt:owner-live_or_migration-qualification@19",
  "receipt:owner-funding-qualification@19",
  "receipt:owner-mutation-qualification@19",
  "receipt:owner-requirement-qualification@19",
  "receipt:ga-migration-positive-gate@19",
  "receipt:ga-migration-absence-gate@19",
  "receipt:distribution-artifact-identity@19",
  "receipt:generated-support-artifact-set@19",
  "receipt:reference-grade-trust-roots@19",
  "receipt:ga-accessibility-required-matrix@19",
  "receipt:ga-accessibility-release-closure@19",
  "receipt:mfa-worst-case-derivation@19",
  "receipt:type-contract-compile-baseline@10",
  "receipt:type-contract-compile-gate@1",
  "receipt:supply-view-transition-registry@19",
  "receipt:supply-state-authoritative-receipt@9",
  "receipt:inference-plugin-activation-authorization-subject@10",
  "receipt:inference-plugin-policy@1",
  "receipt:inference-activation-plugin-policy-closure@1",
  "receipt:inference-plugin-runtime-closure@1",
  "receipt:remote-witness-observer-identity@10",
  "receipt:remote-witness-observer-pairwise-independence@10",
  "receipt:monotonic-anchor-enrollment@10",
  "receipt:platform-bound-monotonic-anchor-enrollment@6",
  "receipt:codex-config-command-auth-snapshot@19",
  "receipt:codex-command-auth-candidate@19",
  "receipt:codex-command-auth-authorization-subject@19",
  "receipt:codex-command-auth-process-lease@19",
  "receipt:codex-command-auth-pre-intent-closure@19",
  "receipt:codex-command-auth-send-intent@19",
  "receipt:codex-command-auth-process-terminal@19",
  "receipt:codex-command-auth-credential@19",
  "receipt:ai-supply-signed-expected-bom@19",
  "receipt:ai-supply-step-terminal@19",
  "receipt:ai-supply-orchestrator-terminal@19",
  "receipt:ai-supply-orchestrator-failed-terminal@19",
  "receipt:release-ecosystem-binding@19",
] as const;

type AiSupplyPublicReceiptGraphRootKindV19 =
  (typeof AI_SUPPLY_PUBLIC_RECEIPT_GRAPH_ROOT_KINDS_V19)[number];

interface ReceiptEdgeManifestV19 extends ReceiptRef<
  "receipt:receipt-edge-manifest@19",
  typeof AI_SUPPLY_PUBLIC_RECEIPT_GRAPH_ROOT_KINDS_V19
> {
  readonly [receiptEdgeManifestBrandV19]: never;
  readonly exactRootReceiptKinds: typeof AI_SUPPLY_PUBLIC_RECEIPT_GRAPH_ROOT_KINDS_V19;
  readonly canonicalSchemaEntries: NonEmptyReadonly<ReceiptNodeEdgeSchemaV19>;
  readonly generatedRuntimeEntries: NonEmptyReadonly<ReceiptNodeEdgeSchemaV19>;
  readonly canonicalSchemaDigest: string;
  readonly generatedManifestDigest: string;
  readonly canonicalContractAndPublicExportGraphDigest: string;
  readonly traversedReceiptNodeCount: number;
  readonly traversedReceiptPropertyEdgeCount: number;
  readonly missingDuplicateExtraWildcardOrUnregisteredEdgeCount: 0;
  readonly publicRootMissingDuplicateOrExtraCount: 0;
  readonly bareReceiptRefWithDefaultKindCount: 0;
  readonly edgeMetadataWasGeneratedFromResolvedOwnerPropertyAndExactTargetTypeSymbols: true;
  readonly generatorFailsWhenTargetKindCannotBeRecoveredExactlyAndNeverGuessesFromAFieldName: true;
  readonly importedOpaqueLeavesUseTheSingleBrandedLeafKindAndHaveNoOutgoingEdges: true;
  readonly receiptCommitDeserializeDagVerifierAndReleaseGateUseThisSameManifestDigest: true;
}

declare function compileAndCommitReceiptEdgeManifestV19(input: {
  readonly exactRootReceiptKinds: typeof AI_SUPPLY_PUBLIC_RECEIPT_GRAPH_ROOT_KINDS_V19;
  readonly publicContractCompilation: AiSupplyPublicContractCompilationReceiptV19;
  readonly exactCanonicalContractArtifact: CanonicalContractArtifactReceiptV3;
  readonly compilerResolvedOwnerPropertyTargetTypeAndSubjectGraph: ImportedOpaqueEvidenceLeafReceipt;
  readonly schemaCompilerAndRuntimeManifestGeneratorArtifact: ImportedOpaqueEvidenceLeafReceipt;
  readonly transitionSubjectProjectionAndSingleSuccessorRegistry: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<ReceiptEdgeManifestV19>;

type PhysicalAttemptDomainV19 = "conformance" | "runtime_inference" | "execution_turn" | "execution_tool";

declare const physicalAttemptAuthorityBindingBrandV19: unique symbol;
declare const physicalAttemptSubjectBrandV19: unique symbol;

interface PhysicalAttemptAuthorityBindingReceiptV19<
  D extends PhysicalAttemptDomainV19 = PhysicalAttemptDomainV19,
  Dist extends string = string,
> extends ReceiptRef<"receipt:physical-attempt-authority-binding@19", readonly [D, Dist]> {
  readonly [physicalAttemptAuthorityBindingBrandV19]: never;
  readonly domain: D;
  readonly distributionArtifactDigest: Dist;
  readonly exactDomainLease: AuthorityInventoryBearingLease;
  readonly exactIntentOrPreIntentClosure: ReceiptRef<
    "receipt:physical-attempt-intent-or-pre-intent-closure@19",
    readonly [D, Dist]
  >;
  readonly exactDomainCursor: ReceiptRef<
    "receipt:physical-attempt-domain-cursor@19",
    readonly [D, Dist]
  >;
  readonly exactFundingAndEffectAuthority: ReceiptRef<
    "receipt:physical-attempt-funding-effect-authority@19",
    readonly [D, Dist]
  >;
  readonly exactLeaseIntentCursorFundingAndEffectCanonicalSubjectDigest: string;
  readonly crossDomainPhaseAttemptToolEffectOrDistributionAttachmentCount: 0;
}

declare function commitPhysicalAttemptAuthorityBindingV19<
  const D extends PhysicalAttemptDomainV19,
  const Dist extends string,
>(input: {
  readonly domain: D;
  readonly distributionArtifactDigest: Dist;
  readonly exactDomainLeaseIntentCursorFundingAndEffectGraph: ImportedOpaqueEvidenceLeafReceipt;
  readonly authorityLifecycleRegistryAndEdgeManifest: readonly [
    AuthorityLeaseRegistryGeneratedArtifactReceiptV6,
    ReceiptEdgeManifestV19,
  ];
}): DeepFrozenCommittedReceiptV1<PhysicalAttemptAuthorityBindingReceiptV19<D, Dist>>;

interface PhysicalAttemptSubjectV19<
  D extends PhysicalAttemptDomainV19 = PhysicalAttemptDomainV19,
  Dist extends string = string,
  State extends "before_send" | "after_send_intent" = "before_send" | "after_send_intent",
> extends ReceiptRef<"receipt:physical-attempt-subject@19", readonly [D, Dist]> {
  readonly [physicalAttemptSubjectBrandV19]: never;
  readonly domain: D;
  readonly distributionArtifactDigest: Dist;
  readonly logicalCallId: string;
  readonly physicalAttemptId: string;
  readonly phaseOrTurnOrdinal: number;
  readonly exactLeaseReceiptId: string;
  readonly exactSendIntentReceiptId: State extends "before_send" ? "none_before_send" : string;
  readonly exactCursorReceiptId: string;
  readonly exactEndpointIdentityDigest: string;
  readonly exactCanonicalRequestBodyDigest: string;
  readonly exactFundingSubjectDigest: string;
  readonly exactToolOrHostedEffectSubjectDigest: string | "not_applicable";
  readonly authorityBinding: PhysicalAttemptAuthorityBindingReceiptV19<D, Dist>;
  readonly sendState: State;
  readonly fallbackAttemptStart: ReceiptRef<"receipt:fallback-attempt-start@19"> | "not_applicable";
  readonly provesEveryIdentityFieldWasProjectedFromTheExactAuthorityBindingAndNotCallerSupplied: true;
}

declare function commitPhysicalAttemptSubjectV19<
  const D extends PhysicalAttemptDomainV19,
  const Dist extends string,
  const State extends "before_send" | "after_send_intent",
  const A extends PhysicalAttemptAuthorityBindingReceiptV19<D, Dist>,
>(input: {
  readonly authorityBinding: A;
  readonly sendState: State;
  readonly exactCanonicalRequestAndEndpointProjection: ImportedOpaqueEvidenceLeafReceipt;
  readonly fallbackAttemptStart: D extends "runtime_inference"
    ? ReceiptRef<"receipt:fallback-attempt-start@19"> | "not_applicable"
    : "not_applicable";
}): DeepFrozenCommittedReceiptV1<PhysicalAttemptSubjectV19<D, Dist, State>>;

type ExactPhysicalAttemptTerminalV19<S extends PhysicalAttemptSubjectV19> = ReceiptRef<
  "receipt:exact-physical-attempt-terminal@19",
  S
> & {
  readonly subject: S;
  readonly exactAuthorityInventoryAndClosure: GeneratedReceiptEdgeV19<
    "receipt:exact-physical-attempt-terminal@19",
    "/exactAuthorityInventoryAndClosure",
    "receipt:lease-authority-release@1",
    S
  >;
  readonly exactLedgerRange: AuthoritativeLedgerRangeReceipt;
  readonly exactAuthorityBinding: S["authorityBinding"];
  readonly blindRetryForbiddenAfterAnySendIntent: true;
} & (
  S["sendState"] extends "before_send"
    ? { readonly outcome: "failed_before_send"; readonly sent: false; readonly continuation: "retryable_with_fresh_lease"; readonly responseEvidence?: never }
    :
      | { readonly outcome: "succeeded"; readonly sent: true; readonly continuation: "terminal_success"; readonly responseEvidence: ImportedOpaqueEvidenceLeafReceipt }
      | { readonly outcome: "authoritatively_not_committed"; readonly sent: true; readonly continuation: "retryable_with_fresh_lease"; readonly responseEvidence: ImportedOpaqueEvidenceLeafReceipt }
      | { readonly outcome: "failed_after_send"; readonly sent: true; readonly continuation: "terminal_failure"; readonly responseEvidence: ImportedOpaqueEvidenceLeafReceipt }
      | { readonly outcome: "delivery_unknown"; readonly sent: true; readonly continuation: "terminal_unknown"; readonly responseEvidence: ImportedOpaqueEvidenceLeafReceipt }
);

type ExactPhysicalAttemptTerminalCommitInputV19<S extends PhysicalAttemptSubjectV19> = {
  readonly subject: S;
  readonly exactAuthorityBinding: NoInfer<S>["authorityBinding"];
  readonly exactLedgerRange: AuthoritativeLedgerRangeReceipt;
} & (S["sendState"] extends "before_send"
  ? {
      readonly outcome: "failed_before_send";
      readonly exactTransportOrProviderEvidence?: never;
      readonly exactPreIntentClosureEvidence: ImportedOpaqueEvidenceLeafReceipt;
    }
  : {
      readonly outcome: "succeeded" | "authoritatively_not_committed" | "failed_after_send" | "delivery_unknown";
      readonly exactTransportOrProviderEvidence: ImportedOpaqueEvidenceLeafReceipt;
      readonly exactPreIntentClosureEvidence?: never;
    });

declare function commitExactPhysicalAttemptTerminalV19<
  const S extends PhysicalAttemptSubjectV19,
>(input: ExactPhysicalAttemptTerminalCommitInputV19<S>): DeepFrozenCommittedReceiptV1<
  ExactPhysicalAttemptTerminalV19<S>
>;

declare const fallbackSubjectBrandV19: unique symbol;
declare const fallbackAttemptStartBrandV19: unique symbol;
declare const fallbackCursorBrandV19: unique symbol;

interface FallbackSubjectV19<K extends SupplySlotId = SupplySlotId, D extends string = string>
  extends ReceiptRef<"receipt:fallback-subject@19", readonly [K, D]> {
  readonly [fallbackSubjectBrandV19]: never;
  readonly invokedSlot: K;
  readonly distributionArtifactDigest: D;
  readonly invocationEnvelopeDigest: string;
  readonly fallbackPlanDigest: string;
  readonly exactOrderedAlternativeIds: NonEmptyReadonly<string>;
  readonly fundingAndDataBoundaryPolicyDigest: string;
}

declare function commitFallbackSubjectV19<
  const K extends SupplySlotId,
  const D extends string,
>(input: {
  readonly invokedSlot: K;
  readonly distributionArtifactIdentity: DistributionArtifactIdentityReceiptV19<D>;
  readonly invocationEnvelopeFallbackPlanOrderedAlternativesFundingAndDataBoundary: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<FallbackSubjectV19<K, D>>;

type FallbackCursorV19<S extends FallbackSubjectV19> = ReceiptRef<"receipt:fallback-cursor@19", S> & {
  readonly [fallbackCursorBrandV19]: never;
  readonly subject: S;
  readonly revision: number;
  readonly nextAlternativeOrdinal: number;
  readonly writerEpoch: number;
} & (
  | { readonly state: "ready"; readonly nextAlternativeId: string; readonly predecessorTerminal?: never; readonly terminalDisposition?: never }
  | { readonly state: "attempt_in_flight"; readonly activeAttemptStartId: string; readonly predecessorTerminal?: never; readonly terminalDisposition?: never }
  | { readonly state: "terminal"; readonly activeAttemptStartId?: never; readonly predecessorTerminal: ExactPhysicalAttemptTerminalV19<PhysicalAttemptSubjectV19>; readonly terminalDisposition: "physical_terminal" }
  | { readonly state: "terminal"; readonly activeAttemptStartId?: never; readonly predecessorTerminal?: never; readonly terminalDisposition: "cancelled_before_any_attempt" | "hard_stopped_before_any_attempt" | "deadline_before_any_attempt" }
);

interface FallbackAttemptLeaseV19<S extends FallbackSubjectV19> extends AuthorityInventoryBearingLease {
  readonly subject: S;
  readonly predecessorCursor: Extract<FallbackCursorV19<S>, { readonly state: "ready" }>;
  readonly alternativeOrdinal: S["exactOrderedAlternativeIds"][number] extends never ? never : number;
  readonly exactAlternativeId: string;
  readonly exactAdmissionFundingRightsDataAndBindingDigest: string;
  readonly singleUse: true;
}

interface FallbackAttemptStartCommitV19<S extends FallbackSubjectV19> extends ReceiptRef<
  "receipt:fallback-attempt-start@19",
  S
> {
  readonly [fallbackAttemptStartBrandV19]: never;
  readonly subject: S;
  readonly predecessorCursor: Extract<FallbackCursorV19<S>, { readonly state: "ready" }>;
  readonly attemptLease: FallbackAttemptLeaseV19<S>;
  readonly successorCursor: Extract<FallbackCursorV19<S>, { readonly state: "attempt_in_flight" }>;
  readonly exactAlternativeId: S["exactOrderedAlternativeIds"][number];
  readonly exactAlternativeOrdinal: number;
  readonly provesAlternativeEqualsTheExactPredecessorCursorTupleMemberAndCasSuccessor: true;
}

declare function commitFallbackInitialCursorV19<const S extends FallbackSubjectV19>(input: {
  readonly subject: S;
  readonly exactPlanEnvelopeAdmissionAndWriterFence: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<Extract<FallbackCursorV19<S>, { readonly state: "ready" }>>;

declare function commitFallbackAttemptStartV19<const S extends FallbackSubjectV19>(input: {
  readonly subject: S;
  readonly predecessorCursor: Extract<FallbackCursorV19<NoInfer<S>>, { readonly state: "ready" }>;
  readonly exactAlternativeAdmissionFundingRightsDataAndBinding: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<FallbackAttemptStartCommitV19<S>>;

declare function commitFallbackAdvanceV19<const S extends FallbackSubjectV19>(input: {
  readonly subject: S;
  readonly attemptStart: FallbackAttemptStartCommitV19<NoInfer<S>>;
  readonly inFlightCursor: NoInfer<FallbackAttemptStartCommitV19<S>>["successorCursor"];
  readonly terminal: Extract<ExactPhysicalAttemptTerminalV19<PhysicalAttemptSubjectV19<"runtime_inference", S["distributionArtifactDigest"]> & { readonly fallbackAttemptStart: NoInfer<FallbackAttemptStartCommitV19<S>> }>, { readonly continuation: "retryable_with_fresh_lease" }>;
  readonly nextAlternativeExists: true;
}): DeepFrozenCommittedReceiptV1<Extract<FallbackCursorV19<S>, { readonly state: "ready" }>>;

type FallbackTerminalCommitInputV19<S extends FallbackSubjectV19> =
  | {
      readonly subject: S;
      readonly predecessorCursor: Extract<FallbackCursorV19<S>, { readonly state: "attempt_in_flight" }>;
      readonly attemptStart: FallbackAttemptStartCommitV19<S>;
      readonly finalPhysicalTerminal: ExactPhysicalAttemptTerminalV19<PhysicalAttemptSubjectV19<"runtime_inference", S["distributionArtifactDigest"]> & { readonly fallbackAttemptStart: FallbackAttemptStartCommitV19<S> }>;
      readonly noNextAlternativeOrTerminalOutcomeEvidence: ImportedOpaqueEvidenceLeafReceipt;
      readonly zeroSolutionDisposition?: never;
      readonly exactAggregateLedgerRange: AuthoritativeLedgerRangeReceipt;
    }
  | {
      readonly subject: S;
      readonly predecessorCursor: Extract<FallbackCursorV19<S>, { readonly state: "ready" }>;
      readonly attemptStart?: never;
      readonly finalPhysicalTerminal?: never;
      readonly noNextAlternativeOrTerminalOutcomeEvidence?: never;
      readonly zeroSolutionDisposition: "cancelled_before_any_attempt" | "hard_stopped_before_any_attempt" | "deadline_before_any_attempt";
      readonly exactAggregateLedgerRange: AuthoritativeLedgerRangeReceipt;
    };

declare function commitFallbackTerminalV19<const S extends FallbackSubjectV19>(
  input: FallbackTerminalCommitInputV19<S>,
): DeepFrozenCommittedReceiptV1<Extract<FallbackCursorV19<S>, { readonly state: "terminal" }>>;

declare const preCredentialEligibilityStateBrandV19: unique symbol;

type PreCredentialEligibilityStateReceiptV19 = ReceiptRef<
  "receipt:pre-credential-eligibility-state@19",
  readonly [string, string, UseCaseIdV8]
> & {
  readonly [preCredentialEligibilityStateBrandV19]: never;
  readonly providerProductId: string;
  readonly providerRealmDigest: string;
  readonly useCase: UseCaseIdV8;
  readonly credentialPrincipalDigest?: never;
  readonly credentialInputPermitted: false;
  readonly productEligibility: Extract<ProductEligibilityReceipt, { readonly permitsCredentialInput: false }>;
} & (
  | { readonly state: "eligibility_unknown"; readonly primaryAction: "view_supported_alternative" }
  | { readonly state: "eligibility_forbidden"; readonly primaryAction: "use_official_api_or_choose_another_source" }
);

declare function commitPreCredentialEligibilityStateV19(input: {
  readonly productEligibility: Extract<ProductEligibilityReceipt, { readonly permitsCredentialInput: false }>;
  readonly exactCurrentProductRealmUseCaseAndDistributionPolicy: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<PreCredentialEligibilityStateReceiptV19>;

declare const exactComputePolicySubjectBrandV19: unique symbol;

interface ExactComputePolicySubjectV19<
  R extends RightsSubjectV8 = RightsSubjectV8,
> extends ReceiptRef<"receipt:exact-compute-policy-subject@19", R> {
  readonly [exactComputePolicySubjectBrandV19]: never;
  readonly rightsSubject: R;
  readonly principalDigest: R["credentialPrincipalDigest"];
  readonly providerProductId: R["providerProductId"];
  readonly providerRealmDigest: R["providerRealmDigest"];
  readonly surfaceId: R["surfaceId"];
  readonly operation: R["operation"];
  readonly useCase: R["useCase"];
  readonly resourceIdentityDigest: string;
  readonly effectiveRouteIdentityDigest: string;
  readonly distributionArtifactDigest: R["distributionIdentityDigest"];
  readonly provesDuplicatedSubjectFieldsAreCompilerProjectionsOfRightsSubjectAndNeverIndependentInputs: true;
}

declare function commitExactComputePolicySubjectV19<const R extends RightsSubjectV8>(input: {
  readonly rightsSubject: R;
  readonly resourceIdentityDigest: string;
  readonly effectiveRouteIdentityDigest: string;
  readonly exactRightsResourceRouteProjectionEvidence: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<ExactComputePolicySubjectV19<R>>;

interface ComputePolicyComponentV19<
  K extends "network" | "billing" | "data_boundary",
  S extends ExactComputePolicySubjectV19,
> extends ReceiptRef<"receipt:compute-policy-component@19", readonly [K, S]> {
  readonly componentKind: K;
  readonly subject: S;
  readonly authoritativeComponentEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly checkedAt: string;
  readonly expiresAt: string;
}

declare function commitComputePolicyComponentV19<
  const K extends "network" | "billing" | "data_boundary",
  const S extends ExactComputePolicySubjectV19,
>(input: {
  readonly componentKind: K;
  readonly subject: S;
  readonly authoritativeComponentEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly currentTimeAndExpiryEvidence: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<ComputePolicyComponentV19<K, S>>;

interface ExactComputePolicyBindingReceiptV19<S extends ExactComputePolicySubjectV19>
  extends ReceiptRef<"receipt:exact-compute-policy-binding@19", S> {
  readonly subject: S;
  readonly rights: AllowedRightsReceipt<S["rightsSubject"]>;
  readonly network: ComputePolicyComponentV19<"network", S>;
  readonly billing: ComputePolicyComponentV19<"billing", S>;
  readonly dataBoundary: ComputePolicyComponentV19<"data_boundary", S>;
  readonly canonicalSubjectBytesDigest: string;
  readonly provesAllFourComponentsHaveByteEqualPrincipalProductRealmSurfaceOperationUseCaseResourceRouteAndDistribution: true;
}

declare function commitExactComputePolicyBindingV19<
  const S extends ExactComputePolicySubjectV19,
>(input: {
  readonly subject: S;
  readonly rights: AllowedRightsReceipt<NoInfer<S>["rightsSubject"]>;
  readonly network: ComputePolicyComponentV19<"network", NoInfer<S>>;
  readonly billing: ComputePolicyComponentV19<"billing", NoInfer<S>>;
  readonly dataBoundary: ComputePolicyComponentV19<"data_boundary", NoInfer<S>>;
  readonly exactCanonicalSubjectProjectionAndByteEqualityEvidence: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<
  ExactComputePolicyBindingReceiptV19<S>
>;

declare const ownerRequirementQualificationBrandV19: unique symbol;
declare const ownerRequirementQualificationChildBrandV19: unique symbol;
declare const ownerRequirementQualificationComponentSetBrandV19: unique symbol;

type OwnerRequirementQualificationComponentKindV19 =
  | "journey"
  | "live_or_migration"
  | "funding"
  | "mutation";

interface OwnerRequirementQualificationChildReceiptV19<
  K extends OwnerRequirementQualificationComponentKindV19,
  R extends OwnerAdditionalRequirementV4,
  D extends string,
> extends ReceiptRef<`receipt:owner-${K}-qualification@19`, readonly [R, D]> {
  readonly [ownerRequirementQualificationChildBrandV19]: K;
  readonly componentKind: K;
  readonly ownerRequirement: R;
  readonly testedDistributionArtifactDigest: D;
  readonly exactTypedRunEvidence: NonEmptyReadonly<ImportedOpaqueEvidenceLeafReceipt>;
  readonly compilerArtifactDigest: string;
  readonly missingDuplicateExtraCrossRequirementOrCrossDistributionEvidenceCount: 0;
  readonly computedOutcome: "completed_pass";
}

type OwnerRequirementQualificationChildTupleV19<
  R extends OwnerAdditionalRequirementV4,
  D extends string,
> = readonly [
  OwnerRequirementQualificationChildReceiptV19<"journey", R, D>,
  OwnerRequirementQualificationChildReceiptV19<"live_or_migration", R, D>,
  OwnerRequirementQualificationChildReceiptV19<"funding", R, D>,
  OwnerRequirementQualificationChildReceiptV19<"mutation", R, D>,
];

interface OwnerRequirementQualificationComponentSetReceiptV19<
  R extends OwnerAdditionalRequirementV4,
  D extends string,
> extends ReceiptRef<"receipt:owner-requirement-qualification-component-set@19", readonly [R, D]> {
  readonly [ownerRequirementQualificationComponentSetBrandV19]: never;
  readonly ownerRequirement: R;
  readonly testedDistributionArtifactDigest: D;
  readonly exactOrderedComponents: OwnerRequirementQualificationChildTupleV19<R, D>;
  readonly expectedAndActualComponentKinds: readonly ["journey", "live_or_migration", "funding", "mutation"];
  readonly missingDuplicateExtraOrCallerSuppliedDerivedComponentCount: 0;
}

declare function compileOwnerRequirementQualificationComponentsV19<
  const R extends OwnerAdditionalRequirementV4,
  const D extends string,
>(input: {
  readonly ownerRequirement: R;
  readonly testedDistributionArtifactDigest: D;
  readonly exactTypedJourneyLiveOrMigrationFundingAndMutationRuns: NonEmptyReadonly<ImportedOpaqueEvidenceLeafReceipt>;
  readonly deterministicQualificationCompiler: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<OwnerRequirementQualificationComponentSetReceiptV19<R, D>>;

interface OwnerRequirementQualificationReceiptV19<
  R extends OwnerAdditionalRequirementV4,
  D extends string,
> extends ReceiptRef<"receipt:owner-requirement-qualification@19", readonly [R, D]> {
  readonly [ownerRequirementQualificationBrandV19]: never;
  readonly ownerRequirement: R;
  readonly testedDistributionArtifactDigest: D;
  readonly componentSet: OwnerRequirementQualificationComponentSetReceiptV19<R, D>;
  readonly journeyQualification: OwnerRequirementQualificationChildReceiptV19<"journey", R, D>;
  readonly liveOrMigrationQualification: OwnerRequirementQualificationChildReceiptV19<"live_or_migration", R, D>;
  readonly fundingQualification: OwnerRequirementQualificationChildReceiptV19<"funding", R, D>;
  readonly mutationQualification: OwnerRequirementQualificationChildReceiptV19<"mutation", R, D>;
  readonly missingDuplicateExtraOrCallerSuppliedProofCount: 0;
}

declare function commitOwnerRequirementQualificationV19<
  const R extends OwnerAdditionalRequirementV4,
  const D extends string,
>(input: {
  readonly ownerRequirement: R;
  readonly testedDistributionArtifactDigest: D;
  readonly componentSet: OwnerRequirementQualificationComponentSetReceiptV19<NoInfer<R>, NoInfer<D>>;
}): DeepFrozenCommittedReceiptV1<OwnerRequirementQualificationReceiptV19<R, D>>;

declare const gaMigrationAbsenceGateBrandV19: unique symbol;
declare const gaMigrationPositiveGateBrandV19: unique symbol;

type HunyuanMigrationRequirementV19 = ReferenceRowByKeyV3<"hunyuan.cn"> & {
  readonly onboardingAvailability: "existing_connection_migration_only";
  readonly journeyTier: "migration_only";
};

interface GaMigrationPositiveGateReceiptV19<D extends string> extends ReceiptRef<
  "receipt:ga-migration-positive-gate@19",
  readonly ["hunyuan.cn", D]
> {
  readonly [gaMigrationPositiveGateBrandV19]: never;
  readonly referenceRequirement: HunyuanMigrationRequirementV19;
  readonly exactReferenceBinding: GaExactReferenceRunSubjectBindingReceiptV4<HunyuanMigrationRequirementV19>;
  readonly exactReferenceBindingIndex: CommittedGaExactReferenceRunSubjectBindingIndexForRowV10<HunyuanMigrationRequirementV19>;
  readonly runGate: Extract<
    GaJourneyRunGateReportReceipt,
    { readonly expectedMigrationReadiness: "migration_disposition_committed" }
  > & { readonly testedDistributionArtifactDigest: D };
  readonly reportAttestation: GaJourneyReportAttestationReceipt;
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV19<D>;
  readonly expectedAndActualMigrationReadiness: "migration_disposition_committed";
  readonly freshPickerEntryCount: 0;
  readonly computedOutcome: "completed_pass";
}

declare function commitGaMigrationPositiveGateV19<const D extends string>(input: {
  readonly exactReferenceBinding: GaExactReferenceRunSubjectBindingReceiptV4<HunyuanMigrationRequirementV19>;
  readonly exactReferenceBindingIndex: CommittedGaExactReferenceRunSubjectBindingIndexForRowV10<HunyuanMigrationRequirementV19>;
  readonly runGate: Extract<
    GaJourneyRunGateReportReceipt,
    { readonly expectedMigrationReadiness: "migration_disposition_committed" }
  > & { readonly testedDistributionArtifactDigest: D };
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV19<NoInfer<D>>;
  readonly exactGateBindingAndFreshPickerEventInventory: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<GaMigrationPositiveGateReceiptV19<D>>;

interface GaMigrationAbsenceGateReceiptV19<D extends string> extends ReceiptRef<
  "receipt:ga-migration-absence-gate@19",
  readonly [GaReferenceMigrationOnlyAbsenceRunSubjectV8, D]
> {
  readonly [gaMigrationAbsenceGateBrandV19]: never;
  readonly runSubject: GaReferenceMigrationOnlyAbsenceRunSubjectV8;
  readonly report: ReceiptRef<"receipt:ga-migration-absence-report@19", GaReferenceMigrationOnlyAbsenceRunSubjectV8>;
  readonly attestation: ReceiptRef<"receipt:ga-migration-absence-attestation@19", GaReferenceMigrationOnlyAbsenceRunSubjectV8>;
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV19<D>;
  readonly freshPickerEntryCount: 0;
  readonly primaryActionCount: 1;
  readonly primaryAction: "choose_another_source_or_open_existing_connection_migration_help";
  readonly accountCredentialBillingNetworkAndProviderEffectCount: 0;
  readonly computedOutcome: "completed_pass";
}

declare function commitGaMigrationAbsenceGateV19<const D extends string>(input: {
  readonly runSubject: GaReferenceMigrationOnlyAbsenceRunSubjectV8;
  readonly exactUiNetworkCredentialBillingAndEffectEventInventory: ImportedOpaqueEvidenceLeafReceipt;
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV19<D>;
  readonly signedRunnerAndAttestationEvidence: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<GaMigrationAbsenceGateReceiptV19<D>>;

declare const distributionArtifactIdentityBrandV19: unique symbol;
declare const generatedSupportArtifactSetBrandV19: unique symbol;

type IsUnionV19<T, Whole = T> = T extends Whole
  ? ([Whole] extends [T] ? false : true)
  : never;

type SingleDistributionDigestIdentityV19<D extends string> =
  string extends D
    ? never
    : IsUnionV19<D> extends true
      ? never
      : D;

interface DistributionArtifactIdentityReceiptV19<D extends string = string> extends ReceiptRef<
  "receipt:distribution-artifact-identity@19",
  D
> {
  readonly [distributionArtifactIdentityBrandV19]: never;
  readonly distributionArtifactDigest: D;
  readonly exactArtifactBytes: ImportedOpaqueEvidenceLeafReceipt;
  readonly targetLength: number;
  readonly targetDigest: D;
  readonly tufTargetAuthorization: TufTargetAuthorizationReceipt;
  readonly unionDigestSubjectForbidden: true;
}

declare function commitDistributionArtifactIdentityV19<const D extends string>(input: {
  readonly distributionArtifactDigest: D & SingleDistributionDigestIdentityV19<D>;
  readonly exactArtifactBytes: ImportedOpaqueEvidenceLeafReceipt;
  readonly tufTargetAuthorization: TufTargetAuthorizationReceipt;
}): DeepFrozenCommittedReceiptV1<DistributionArtifactIdentityReceiptV19<D>>;

interface GeneratedSupportArtifactSetReceiptV19<D extends string> extends ReceiptRef<
  "receipt:generated-support-artifact-set@19",
  D
> {
  readonly [generatedSupportArtifactSetBrandV19]: never;
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV19<D>;
  readonly publishedSupportClaims: PublishedSupportClaimSetReceiptV6<D>;
  readonly artifacts: GeneratedSupportArtifactSetV4<D>;
  readonly exactClaimAndDistributionDigest: string;
}

declare function commitGeneratedSupportArtifactSetV19<const D extends string>(input: {
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV19<D>;
  readonly publishedSupportClaims: PublishedSupportClaimSetReceiptV6<NoInfer<D>>;
  readonly artifacts: GeneratedSupportArtifactSetV4<NoInfer<D>>;
}): DeepFrozenCommittedReceiptV1<GeneratedSupportArtifactSetReceiptV19<D>>;

declare const referenceGradeTrustRootsBrandV19: unique symbol;

interface ReferenceGradeTrustRootsReceiptV19<D extends string> extends ReceiptRef<
  "receipt:reference-grade-trust-roots@19",
  D
> {
  readonly [referenceGradeTrustRootsBrandV19]: never;
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV19<D>;
  readonly referenceGradeProfile: DeepFrozenCommittedReceiptV1<ReferenceGradeProfileV3 & ReceiptRef<"receipt:reference-grade-profile@19", D>>;
  readonly mandatoryBaseline: DeepFrozenCommittedReceiptV1<GaMandatoryBaselineV3 & ReceiptRef<"receipt:ga-mandatory-baseline@19", D>>;
  readonly ecosystemMatrixCore: DeepFrozenCommittedReceiptV1<GaEcosystemMatrixCoreV3 & ReceiptRef<"receipt:ga-ecosystem-matrix-core@19", D>>;
  readonly canonicalProfileBaselineMatrixBytesDigest: string;
  readonly exactTufTargetLengthHashPathAndDistributionEqual: true;
}

declare function commitReferenceGradeTrustRootsV19<const D extends string>(input: {
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV19<D>;
  readonly canonicalProfileBaselineAndMatrixBytes: readonly [ImportedOpaqueEvidenceLeafReceipt, ImportedOpaqueEvidenceLeafReceipt, ImportedOpaqueEvidenceLeafReceipt];
  readonly exactTufTargetAuthorizations: readonly [TufTargetAuthorizationReceipt, TufTargetAuthorizationReceipt, TufTargetAuthorizationReceipt];
  readonly deterministicRequirementsAndMatrixCompiler: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<ReferenceGradeTrustRootsReceiptV19<D>>;

declare const gaAccessibilityRequiredMatrixBrandV19: unique symbol;

const GA_ACCESSIBILITY_USER_LOCALES_V19 = ["zh-CN", "en-US", "ar-SA"] as const;
const GA_ACCESSIBILITY_PSEUDO_LOCALES_V19 = ["en-XA"] as const;
const GA_ACCESSIBILITY_PLATFORMS_V19 = ["macos_arm64", "linux_x64", "windows_x64"] as const;
const GA_ACCESSIBILITY_PRESENTATIONS_V19 = [
  "canonical_desktop_light",
  "canonical_desktop_dark",
  "canonical_mobile_paper",
] as const;
const GA_ACCESSIBILITY_VIEWPORTS_V19 = [
  "desktop_1440x900",
  "mobile_390x844",
  "narrow_320x568",
] as const;
const GA_ACCESSIBILITY_ZOOMS_V19 = [100, 200, 400] as const;
const GA_ACCESSIBILITY_MODALITIES_V19 = [
  "keyboard_only",
  "screen_reader_keyboard",
  "pointer",
] as const;

type GaAccessibilityLocaleV19 =
  | (typeof GA_ACCESSIBILITY_USER_LOCALES_V19)[number]
  | (typeof GA_ACCESSIBILITY_PSEUDO_LOCALES_V19)[number];
type GaAccessibilityScreenReaderForPlatformV19<P extends ReferencePlatformProfileV4> =
  P extends "macos_arm64" ? "voiceover"
    : P extends "linux_x64" ? "orca"
      : "nvda";
type GaAccessibilityRequiredCellKeyV19 = {
  [P in (typeof GA_ACCESSIBILITY_PLATFORMS_V19)[number]]:
    `${P}|${GaAccessibilityLocaleV19}|${(typeof GA_ACCESSIBILITY_PRESENTATIONS_V19)[number]}|${(typeof GA_ACCESSIBILITY_VIEWPORTS_V19)[number]}|${(typeof GA_ACCESSIBILITY_ZOOMS_V19)[number]}|${(typeof GA_ACCESSIBILITY_MODALITIES_V19)[number]}|${GaAccessibilityScreenReaderForPlatformV19<P>}`;
}[(typeof GA_ACCESSIBILITY_PLATFORMS_V19)[number]];

type GaAccessibilityExactRequiredCellMapV19 = {
  readonly [K in GaAccessibilityRequiredCellKeyV19]: ReceiptRef<
    "receipt:ga-accessibility-required-cell@19",
    K
  >;
};

interface GaAccessibilityRequiredMatrixReceiptV19 extends ReceiptRef<
  "receipt:ga-accessibility-required-matrix@19",
  readonly ["macos_arm64", "linux_x64", "windows_x64"]
> {
  readonly [gaAccessibilityRequiredMatrixBrandV19]: never;
  readonly userLocales: typeof GA_ACCESSIBILITY_USER_LOCALES_V19;
  readonly pseudoLocales: typeof GA_ACCESSIBILITY_PSEUDO_LOCALES_V19;
  readonly platforms: typeof GA_ACCESSIBILITY_PLATFORMS_V19;
  readonly presentations: typeof GA_ACCESSIBILITY_PRESENTATIONS_V19;
  readonly viewports: typeof GA_ACCESSIBILITY_VIEWPORTS_V19;
  readonly zooms: typeof GA_ACCESSIBILITY_ZOOMS_V19;
  readonly modalities: typeof GA_ACCESSIBILITY_MODALITIES_V19;
  readonly signedCanonicalPresentationMatrix: GaAccessibilityRequiredPresentationMatrixReceiptV6;
  readonly exactCartesianCells: GaAccessibilityExactRequiredCellMapV19;
  readonly exactCartesianCellKeys: readonly GaAccessibilityRequiredCellKeyV19[];
  readonly exactCartesianCellCount: 972;
  readonly missingDuplicateExtraOrCrossAxisCellCount: 0;
  readonly rtlRequiredForLocales: readonly ["ar-SA"];
}

declare function commitGaAccessibilityRequiredMatrixV19(input: {
  readonly canonicalIcuA11yAndRtlProfileBytes: ImportedOpaqueEvidenceLeafReceipt;
  readonly tufTargetAuthorization: TufTargetAuthorizationReceipt;
  readonly deterministicCartesianGenerator: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<GaAccessibilityRequiredMatrixReceiptV19>;

declare const gaAccessibilityReleaseClosureBrandV19: unique symbol;

type GaAccessibilityExactPassedCellMapV19<D extends string> = {
  readonly [K in GaAccessibilityRequiredCellKeyV19]: GaAccessibilityPassSnapshotReceiptV9 & {
    readonly testedDistributionArtifactDigest: D;
    readonly exactRequiredCellKey: K;
    readonly outcome: "pass";
  };
};

interface GaAccessibilityReleaseClosureV19<D extends string> extends ReceiptRef<
  "receipt:ga-accessibility-release-closure@19",
  D
> {
  readonly [gaAccessibilityReleaseClosureBrandV19]: never;
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV19<D>;
  readonly requiredMatrix: GaAccessibilityRequiredMatrixReceiptV19;
  readonly exactPassedCells: GaAccessibilityExactPassedCellMapV19<D>;
  readonly exactPassedCellCount: 972;
  readonly missingDuplicateExtraFailedCrossCellOrCrossDistributionCount: 0;
  readonly allRealLocalesPseudoLocaleRtlPresentationsViewportsZoomsModalitiesAndPlatformScreenReadersPassed: true;
}

declare function commitGaAccessibilityReleaseClosureV19<const D extends string>(input: {
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV19<D>;
  readonly requiredMatrix: GaAccessibilityRequiredMatrixReceiptV19;
  readonly exactPassedCells: GaAccessibilityExactPassedCellMapV19<NoInfer<D>>;
  readonly deterministicExactKeyedCartesianEvaluator: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<GaAccessibilityReleaseClosureV19<D>>;

interface MfaWorstCaseDerivationReceiptV19 extends ReceiptRef<"receipt:mfa-worst-case-derivation@19"> {
  readonly journeyGraphs: readonly [typeof JOURNEY_GRAPH_GUIDED_KEY_V3, typeof JOURNEY_GRAPH_OAUTH_V3];
  readonly guidedKeyMaximumNestedMfaTasks: 3;
  readonly guidedOauthMaximumNestedMfaTasks: 3;
  readonly signedClassLimits: readonly [
    Extract<GaReferenceUxClassLimitV3, { readonly limitClass: "guided_key" }>,
    Extract<GaReferenceUxClassLimitV3, { readonly limitClass: "guided_oauth_or_subscription" }>,
  ];
  readonly everyCartesianPathWasExhaustivelyFolded: true;
  readonly disclosedScalarAndPerClassLimitsEqualTheDerivedWorstCase: true;
}

declare function commitMfaWorstCaseDerivationV19(input: {
  readonly exactVersionedJourneyGraphs: readonly [typeof JOURNEY_GRAPH_GUIDED_KEY_V3, typeof JOURNEY_GRAPH_OAUTH_V3];
  readonly exhaustivePathFoldTranscript: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<MfaWorstCaseDerivationReceiptV19>;

declare const supplyStateEvidenceBrandV19: unique symbol;
declare const supplyStateAuthoritativeBrandV19: unique symbol;

interface SupplyStateEvidenceReceiptV19<S extends SupplyViewStateIdV6> extends ReceiptRef<
  "receipt:supply-state-evidence@19",
  S
> {
  readonly [supplyStateEvidenceBrandV19]: never;
  readonly state: S;
  readonly exactRegistryEvidence: S extends "rights_unknown" | "rights_forbidden"
    ? PreCredentialEligibilityStateReceiptV19 | BlockedRightsDecisionReceiptV9
    : ImportedOpaqueEvidenceLeafReceipt;
  readonly predecessorStateDigest: string | "genesis";
  readonly generation: number;
  readonly expiresAt: string;
}

interface SupplyStateAuthoritativeReceiptV19<S extends SupplyViewStateIdV6> extends ReceiptRef<
  "receipt:supply-state-authoritative@19",
  readonly [S, number]
> {
  readonly [supplyStateAuthoritativeBrandV19]: never;
  readonly state: S;
  readonly stateEvidence: SupplyStateEvidenceReceiptV19<S>;
  readonly generation: number;
  readonly predecessor?: SupplyStateAuthoritativeReceiptV19<SupplyViewStateIdV6>;
  readonly legalTransitionEdge: ReceiptRef<"receipt:supply-state-transition-edge@19", readonly [SupplyViewStateIdV6, S]>;
  readonly exactStateReducerArtifactDigest: string;
}

declare function commitSupplyStateEvidenceV19<const S extends SupplyViewStateIdV6>(input: {
  readonly state: S;
  readonly exactRegistryEvidence: SupplyStateEvidenceReceiptV19<NoInfer<S>>["exactRegistryEvidence"];
  readonly predecessorStateDigest: string | "genesis";
  readonly currentGenerationAndTimeEvidence: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<SupplyStateEvidenceReceiptV19<S>>;

declare function commitSupplyStateAuthoritativeV19<const S extends SupplyViewStateIdV6>(input: {
  readonly stateEvidence: SupplyStateEvidenceReceiptV19<S>;
  readonly predecessor?: SupplyStateAuthoritativeReceiptV19<SupplyViewStateIdV6>;
  readonly exactRegisteredTransitionEdge: ReceiptRef<"receipt:supply-state-transition-edge@19", readonly [SupplyViewStateIdV6, S]>;
  readonly stateReducerArtifact: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<SupplyStateAuthoritativeReceiptV19<S>>;

declare const supplyViewTransitionRegistryBrandV19: unique symbol;

interface SupplyViewTransitionRegistryReceiptV19 extends ReceiptRef<
  "receipt:supply-view-transition-registry@19",
  SupplyViewStateIdV6
> {
  readonly [supplyViewTransitionRegistryBrandV19]: never;
  readonly exactStateRegistry: typeof SUPPLY_VIEW_STATE_REGISTRY_V8;
  readonly exactStateKeys: readonly SupplyViewStateIdV6[];
  readonly legalPredecessorStatesByTarget: {
    readonly [S in SupplyViewStateIdV6]: readonly (SupplyViewStateIdV6 | "genesis")[];
  };
  readonly exactLegalTransitionEdges: NonEmptyReadonly<ReceiptRef<
    "receipt:supply-view-transition-edge@19",
    readonly [SupplyViewStateIdV6 | "genesis", SupplyViewStateIdV6]
  >>;
  readonly canonicalReducerArtifactDigest: string;
  readonly missingDuplicateExtraUnknownOrUnreachableStateCount: 0;
  readonly everyNonGenesisEdgeHasOneReducerTransitionAndEveryReducerTransitionHasOneEdge: true;
}

declare function compileSupplyViewTransitionRegistryV19(input: {
  readonly exactStateRegistry: typeof SUPPLY_VIEW_STATE_REGISTRY_V8;
  readonly signedCanonicalReducerAndTransitionBytes: ImportedOpaqueEvidenceLeafReceipt;
  readonly tufTargetAuthorization: TufTargetAuthorizationReceipt;
  readonly deterministicStateGraphCompiler: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<SupplyViewTransitionRegistryReceiptV19>;

type SupplyStateSpecificProducerInputV19<S extends SupplyViewStateIdV6> = {
  readonly targetState: S;
  readonly stateSpecificEvidence: SupplyStateAuthoritativeEvidenceForV9<S>;
  readonly transitionRegistry: SupplyViewTransitionRegistryReceiptV19;
  readonly currentTimeGenerationExpiryAndReducerEvidence: ImportedOpaqueEvidenceLeafReceipt;
} & (S extends "detecting"
  ? {
      readonly predecessor: SupplyStateAuthoritativeReceiptV9<SupplyViewStateIdV6> | "genesis";
      readonly exactRegisteredTransitionEdge: NoInfer<SupplyViewTransitionRegistryReceiptV19>["exactLegalTransitionEdges"][number] & ReceiptRef<
        "receipt:supply-view-transition-edge@19",
        readonly [SupplyViewStateIdV6 | "genesis", S]
      >;
    }
  : {
      readonly predecessor: SupplyStateAuthoritativeReceiptV9<SupplyViewStateIdV6>;
      readonly exactRegisteredTransitionEdge: NoInfer<SupplyViewTransitionRegistryReceiptV19>["exactLegalTransitionEdges"][number] & ReceiptRef<
        "receipt:supply-view-transition-edge@19",
        readonly [SupplyViewStateIdV6, S]
      >;
    });

interface SupplyStateSpecificProducerV19<S extends SupplyViewStateIdV6> {
  (input: SupplyStateSpecificProducerInputV19<S>): DeepFrozenCommittedReceiptV1<
    SupplyStateAuthoritativeReceiptV9<S>
  >;
}

declare const SUPPLY_STATE_SPECIFIC_PRODUCERS_V19: {
  readonly [S in SupplyViewStateIdV6]: SupplyStateSpecificProducerV19<S>;
};

type _V19SupplyStateProducerKeysExact = ContractAssert<ExactTypeEqualV7<
  keyof typeof SUPPLY_STATE_SPECIFIC_PRODUCERS_V19,
  keyof typeof SUPPLY_VIEW_STATE_REGISTRY_V8
>>;

type CodexCommandAuthRefreshModeV19 = "on_authentication_retry" | "fixed_interval";

type CodexCommandAuthDefinitionV19 = {
  readonly providerId: string;
  readonly executableAbsolutePath: string;
  readonly argv: readonly string[];
  readonly workingDirectoryPolicy: "empty_private_directory";
  readonly environmentAllowlist: readonly string[];
  readonly timeoutMillis: number;
  readonly maximumStdoutBytes: number;
} & (
  | { readonly refreshMode: "on_authentication_retry"; readonly refreshIntervalMillis?: never }
  | { readonly refreshMode: "fixed_interval"; readonly refreshIntervalMillis: number }
);

declare const codexConfigCommandAuthSnapshotBrandV19: unique symbol;
declare const codexCommandAuthCandidateBrandV19: unique symbol;
declare const codexCommandAuthAuthorizationSubjectBrandV19: unique symbol;
declare const codexCommandAuthProcessLeaseBrandV19: unique symbol;
declare const codexCommandAuthPreIntentClosureBrandV19: unique symbol;
declare const codexCommandAuthSendIntentBrandV19: unique symbol;

interface CodexConfigCommandAuthSnapshotReceiptV19 extends ReceiptRef<
  "receipt:codex-config-command-auth-snapshot@19"
> {
  readonly [codexConfigCommandAuthSnapshotBrandV19]: never;
  readonly exactCodexConfigBytesDigest: string;
  readonly commandAuthDefinitions: readonly CodexCommandAuthDefinitionV19[];
  readonly configSchemaAndCodexVersionDigest: string;
  readonly passiveDiscoveryExecutedCommandCount: 0;
  readonly secretValueCount: 0;
  readonly parserRejectedShellStringsRelativeExecutablesUnsafeEnvironmentAndUnboundedOutput: true;
}

declare function parseCodexCommandAuthConfigWithoutExecutionV19(input: {
  readonly exactCodexConfigBytes: ImportedOpaqueEvidenceLeafReceipt;
  readonly codexConfigSchemaAndBinaryIdentity: ImportedOpaqueEvidenceLeafReceipt;
  readonly staticPathEnvironmentAndLimitPolicy: TufTargetAuthorizationReceipt;
}): DeepFrozenCommittedReceiptV1<CodexConfigCommandAuthSnapshotReceiptV19>;

interface CodexCommandAuthCandidateReceiptV19 extends ReceiptRef<"receipt:codex-command-auth-candidate@19"> {
  readonly [codexCommandAuthCandidateBrandV19]: never;
  readonly configSnapshot: CodexConfigCommandAuthSnapshotReceiptV19;
  readonly exactDefinition: CodexCommandAuthDefinitionV19;
  readonly exactDefinitionIndex: number;
  readonly exactDefinitionIdentityDigest: string;
  readonly commandExecutableIdentityDigest: string;
  readonly argvDigest: string;
  readonly workingDirectoryPolicy: "empty_private_directory";
  readonly environmentAllowlistDigest: string;
  readonly timeoutMillis: number;
  readonly maximumStdoutBytes: number;
  readonly refreshMode: CodexCommandAuthRefreshModeV19;
  readonly refreshIntervalMillis: number | "on_authentication_retry";
  readonly selectedDefinitionWasProjectedByteExactlyFromTheCommittedConfigSnapshot: true;
  readonly refreshModeAndIntervalDiscriminantWasRecomputedFromThatExactDefinition: true;
  readonly passiveDiscoveryExecutedCommandCount: 0;
  readonly userMustExplicitlyApproveFirstExecution: true;
  readonly maturity: "candidate_requires_review";
}

interface CodexCommandAuthAuthorizationSubjectV19<
  C extends CodexCommandAuthCandidateReceiptV19 = CodexCommandAuthCandidateReceiptV19,
  D extends string = string,
> extends ReceiptRef<
  "receipt:codex-command-auth-authorization-subject@19",
  readonly [C, D]
> {
  readonly [codexCommandAuthAuthorizationSubjectBrandV19]: never;
  readonly candidate: C;
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV19<D>;
  readonly providerId: string;
  readonly testedDistributionArtifactDigest: D;
  readonly executableArgvWorkingDirectoryEnvironmentTimeoutOutputRefreshAndNetworkDigest: string;
  readonly oneExecutionOnly: true;
}

declare function commitCodexCommandAuthAuthorizationSubjectV19<
  const C extends CodexCommandAuthCandidateReceiptV19,
  const D extends string,
>(input: {
  readonly candidate: C;
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV19<D>;
  readonly exactCandidateProviderAndDistributionProjection: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<CodexCommandAuthAuthorizationSubjectV19<C, D>>;

type CodexCommandAuthAcceptedDecisionV19<
  S extends CodexCommandAuthAuthorizationSubjectV19 = CodexCommandAuthAuthorizationSubjectV19,
> = AcceptedUserDecisionReceipt & {
  readonly proposal: Extract<AuthorizationProposalReceipt, { readonly proposalKind: "codex_command_auth_import" }> & {
    readonly commandAuthSubject: S;
    readonly candidate: S["candidate"];
  };
  readonly disclosure: Extract<AuthorizationDisclosureReceipt, { readonly disclosureKind: "codex_command_auth_import" }> & {
    readonly commandAuthSubject: S;
  };
};

type CodexCommandAuthProcessLeaseReceiptV19<
  S extends CodexCommandAuthAuthorizationSubjectV19 = CodexCommandAuthAuthorizationSubjectV19,
> = AuthorityInventoryBearingLease<
  NonEmptyLeaseAuthorityInventoryTuple<readonly [
    "process_or_session",
    "network_admission",
    "broker_handle",
    "credential_or_signing",
    "exclusive_cursor_action",
  ]>
> & ReceiptRef<"receipt:codex-command-auth-process-lease@19", S> & {
  readonly [codexCommandAuthProcessLeaseBrandV19]: never;
  readonly subject: S;
  readonly acceptedDecision: CodexCommandAuthAcceptedDecisionV19<S>;
  readonly decisionConsumption: UserDecisionConsumptionCommitReceipt;
  readonly exactSandboxExecutableArgvWorkingDirectoryEnvironmentAndNetworkPolicyDigest: string;
  readonly expectedRefreshCursorRevision: number;
  readonly singleUse: true;
  readonly notAfter: string;
};

interface CodexCommandAuthPreIntentClosureReceiptV19<
  L extends CodexCommandAuthProcessLeaseReceiptV19 = CodexCommandAuthProcessLeaseReceiptV19,
> extends ReceiptRef<"receipt:codex-command-auth-pre-intent-closure@19", L> {
  readonly [codexCommandAuthPreIntentClosureBrandV19]: never;
  readonly processLease: L;
  readonly processSpawned: false;
  readonly applicationByteWritten: false;
  readonly exactAuthorityReleaseTuple: ExactLeaseAuthorityReleaseTuple<L>;
  readonly terminalReason: "cancelled_before_spawn" | "sandbox_preflight_failed" | "authorization_expired";
}

interface CodexCommandAuthSendIntentReceiptV19<
  L extends CodexCommandAuthProcessLeaseReceiptV19 = CodexCommandAuthProcessLeaseReceiptV19,
> extends ReceiptRef<"receipt:codex-command-auth-send-intent@19", L> {
  readonly [codexCommandAuthSendIntentBrandV19]: never;
  readonly processLease: L;
  readonly durableBeforeProcessSpawn: true;
  readonly exactExecutableImageArgvEnvironmentSandboxAndOutputPipeDigest: string;
  readonly expectedRefreshCursorRevision: L["expectedRefreshCursorRevision"];
}

type CodexCommandAuthProcessTerminalReceiptV19<
  L extends CodexCommandAuthProcessLeaseReceiptV19 = CodexCommandAuthProcessLeaseReceiptV19,
> = ReceiptRef<
  "receipt:codex-command-auth-process-terminal@19",
  L
> & {
  readonly processLease: L;
  readonly exactAuthorityReleaseTuple: ExactLeaseAuthorityReleaseTuple<L>;
  readonly stdoutWasNeverLoggedRenderedOrPersisted: true;
} & (
  | {
      readonly outcome: "not_started";
      readonly preIntentClosure: CodexCommandAuthPreIntentClosureReceiptV19<L>;
      readonly sendIntent?: never;
      readonly brokerImportTerminal?: never;
    }
  | {
      readonly outcome: "succeeded_and_imported";
      readonly preIntentClosure?: never;
      readonly sendIntent: CodexCommandAuthSendIntentReceiptV19<L>;
      readonly brokerImportTerminal: ReceiptRef<"receipt:codex-command-auth-broker-import-terminal@19", L>;
    }
  | {
      readonly outcome: "failed_or_invalid_output";
      readonly preIntentClosure?: never;
      readonly sendIntent: CodexCommandAuthSendIntentReceiptV19<L>;
      readonly brokerImportTerminal?: never;
    }
  | {
      readonly outcome: "delivery_unknown_secret_quarantined";
      readonly preIntentClosure?: never;
      readonly sendIntent: CodexCommandAuthSendIntentReceiptV19<L>;
      readonly brokerImportTerminal?: never;
    }
);

declare function commitCodexCommandAuthProcessLeaseV19<
  const S extends CodexCommandAuthAuthorizationSubjectV19,
>(input: {
  readonly subject: S;
  readonly acceptedDecision: CodexCommandAuthAcceptedDecisionV19<NoInfer<S>>;
  readonly decisionConsumption: UserDecisionConsumptionCommitReceipt;
  readonly exactSandboxExecutableArgvWorkingDirectoryEnvironmentNetworkAndRefreshCursor: ImportedOpaqueEvidenceLeafReceipt;
  readonly authorityInventory: NonEmptyLeaseAuthorityInventoryTuple<readonly [
    "process_or_session",
    "network_admission",
    "broker_handle",
    "credential_or_signing",
    "exclusive_cursor_action",
  ]>;
}): DeepFrozenCommittedReceiptV1<CodexCommandAuthProcessLeaseReceiptV19<S>>;

declare function commitCodexCommandAuthPreIntentClosureV19<
  const L extends CodexCommandAuthProcessLeaseReceiptV19,
>(input: {
  readonly processLease: L;
  readonly terminalReason: CodexCommandAuthPreIntentClosureReceiptV19<L>["terminalReason"];
  readonly exactPreSpawnSandboxDecisionAndAuthorityReleaseEvidence: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<CodexCommandAuthPreIntentClosureReceiptV19<L>>;

declare function commitCodexCommandAuthSendIntentV19<
  const L extends CodexCommandAuthProcessLeaseReceiptV19,
>(input: {
  readonly processLease: L;
  readonly exactExecutableImageArgvEnvironmentSandboxOutputPipeAndRefreshCursor: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<CodexCommandAuthSendIntentReceiptV19<L>>;

type CodexCommandAuthProcessExecutionInputV19<L extends CodexCommandAuthProcessLeaseReceiptV19> =
  | {
      readonly branch: "not_started";
      readonly processLease: L;
      readonly preIntentClosure: CodexCommandAuthPreIntentClosureReceiptV19<NoInfer<L>>;
      readonly sendIntent?: never;
      readonly sandboxProcessPipeAndBrokerEvidence?: never;
    }
  | {
      readonly branch: "started";
      readonly processLease: L;
      readonly preIntentClosure?: never;
      readonly sendIntent: CodexCommandAuthSendIntentReceiptV19<NoInfer<L>>;
      readonly sandboxProcessPipeAndBrokerEvidence: ImportedOpaqueEvidenceLeafReceipt;
    };

declare function executeAndCloseCodexCommandAuthProcessV19<
  const L extends CodexCommandAuthProcessLeaseReceiptV19,
>(input: CodexCommandAuthProcessExecutionInputV19<L>): DeepFrozenCommittedReceiptV1<
  CodexCommandAuthProcessTerminalReceiptV19<L>
>;

interface CodexCommandAuthCredentialReceiptV19<
  L extends CodexCommandAuthProcessLeaseReceiptV19 = CodexCommandAuthProcessLeaseReceiptV19,
> extends ReceiptRef<"receipt:codex-command-auth-credential@19", L> {
  readonly candidate: L["subject"]["candidate"];
  readonly subject: L["subject"];
  readonly processLease: L;
  readonly processTerminal: Extract<CodexCommandAuthProcessTerminalReceiptV19<L>, { readonly outcome: "succeeded_and_imported" }>;
  readonly acceptedDecision: L["acceptedDecision"];
  readonly decisionConsumption: UserDecisionConsumptionCommitReceipt;
  readonly exactSandboxAndExecutableAttestation: ImportedOpaqueEvidenceLeafReceipt;
  readonly brokeredBearerSecretVersionDigest: string;
  readonly stdoutTokenWasNeverPersistedLoggedOrRendered: true;
  readonly refreshCursorDigest: string;
  readonly expiresAt: string;
}

declare function commitCodexCommandAuthCandidateV19(input: {
  readonly configSnapshot: CodexConfigCommandAuthSnapshotReceiptV19;
  readonly exactDefinitionIndex: number;
  readonly exactDefinitionProjectionExecutableArgvRefreshAndStaticAttestation: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<CodexCommandAuthCandidateReceiptV19>;

declare function commitCodexCommandAuthCredentialV19<
  const L extends CodexCommandAuthProcessLeaseReceiptV19,
>(input: {
  readonly candidate: L["subject"]["candidate"];
  readonly subject: L["subject"];
  readonly processTerminal: Extract<
    CodexCommandAuthProcessTerminalReceiptV19<NoInfer<L>>,
    { readonly outcome: "succeeded_and_imported" }
  >;
  readonly exactCandidateSubjectLeaseIntentTerminalBrokerAndRefreshCursorProjection: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<CodexCommandAuthCredentialReceiptV19<L>>;

const AI_SUPPLY_RELEASE_SUITE_IDS_V19 = [
  "type-contract-compile-budget.model", "oauth-state-machine.tck", "receipt-dag-and-anchor.model",
  "pre-intent-authority-closure.model", "reference-monitor-writer-fence.model", "conformance-round-closure.model",
  "persistent-budget-ledger.model", "ledger-report-correction.model", "usage-dimension-fold.tck",
  "metadata-health-admission.tck", "provider-wire-auth-regression.tck", "capability-slot-funding.tck",
  "passive-loopback-peer.tck", "discovery-conformance.tck", "local-preload-state-machine.model",
  "local-product-journeys.tck", "execution-surface-chain.tck", "execution-tool-child-lease.model",
  "bridge-conformance.tck", "conformance-two-round-budget.model", "workload-identity-signing.tck",
  "plugin-budget-state-machine.tck", "platform-anchor-offline-mode.tck", "local-data-locality.tck",
  "evidence-orphan-recovery.chaos", "realm-and-ga-binding.tck", "provider-account-cleanup-operation-matrix.model",
  "tuf-root-role-rollback.tck", "runtime-route-terminal-fold.model", "owner-extension-fresh-consumer.tck",
  "accessibility-rtl-cartesian.tck", "release-distribution-cross-swap.model",
] as const;

type AiSupplyReleaseSuiteIdV19 = (typeof AI_SUPPLY_RELEASE_SUITE_IDS_V19)[number];

type AiSupplySuiteStepRowV19<
  I extends AiSupplyReleaseSuiteIdV19,
  P extends string,
> = {
  readonly stepId: `suite:${I}`;
  readonly kind: "suite";
  readonly argv: `pnpm exec vitest run e2e/smoke/${I}`;
  readonly predecessorStepId: P;
};

type AiSupplySuiteStepTupleV19<
  T extends readonly AiSupplyReleaseSuiteIdV19[],
  P extends string = "preflight_open",
> = T extends readonly [
  infer H extends AiSupplyReleaseSuiteIdV19,
  ...infer R extends readonly AiSupplyReleaseSuiteIdV19[],
]
  ? readonly [AiSupplySuiteStepRowV19<H, P>, ...AiSupplySuiteStepTupleV19<R, `suite:${H}`>]
  : readonly [];

type AiSupplyLastSuiteIdV19<T extends readonly AiSupplyReleaseSuiteIdV19[]> =
  T extends readonly [...readonly AiSupplyReleaseSuiteIdV19[], infer L extends AiSupplyReleaseSuiteIdV19]
    ? L
    : never;

type AiSupplyExactOrderedBomRowsV19 = readonly [
  {
    readonly stepId: "preflight_open";
    readonly kind: "preflight";
    readonly argv: "pnpm exec tsx scripts/ai-supply-preflight.ts --stage open";
    readonly predecessorStepId: "none";
  },
  ...AiSupplySuiteStepTupleV19<typeof AI_SUPPLY_RELEASE_SUITE_IDS_V19>,
  {
    readonly stepId: "preflight_close";
    readonly kind: "preflight";
    readonly argv: "pnpm exec tsx scripts/ai-supply-preflight.ts --stage close";
    readonly predecessorStepId: `suite:${AiSupplyLastSuiteIdV19<typeof AI_SUPPLY_RELEASE_SUITE_IDS_V19>}`;
  },
];

type AiSupplyCanonicalStepRowV19 = AiSupplyExactOrderedBomRowsV19[number];

type _V19ReleaseSuiteCountExactly32 = ContractAssert<ExactTypeEqualV7<
  typeof AI_SUPPLY_RELEASE_SUITE_IDS_V19["length"],
  32
>>;
type _V19BomRowsExactlyPreflightPlus32SuitesPlusClose = ContractAssert<ExactTypeEqualV7<
  AiSupplyExactOrderedBomRowsV19["length"],
  34
>>;

declare const aiSupplySignedExpectedBomBrandV19: unique symbol;

interface AiSupplySignedExpectedBomReceiptV19 extends ReceiptRef<"receipt:ai-supply-signed-expected-bom@19"> {
  readonly [aiSupplySignedExpectedBomBrandV19]: never;
  readonly canonicalSuiteIds: typeof AI_SUPPLY_RELEASE_SUITE_IDS_V19;
  readonly exactOrderedRows: AiSupplyExactOrderedBomRowsV19;
  readonly tufTargetAuthorization: TufTargetAuthorizationReceipt;
  readonly canonicalRowsDigest: string;
  readonly suiteIdMissingDuplicateOrExtraCount: 0;
  readonly preflightOpenAndCloseCount: 2;
  readonly exactOrderedRowCount: 34;
  readonly exactArgvAndPredecessorDagValidated: true;
}

declare function commitAiSupplySignedExpectedBomV19(input: {
  readonly canonicalSuiteIds: typeof AI_SUPPLY_RELEASE_SUITE_IDS_V19;
  readonly canonicalBomBytes: ImportedOpaqueEvidenceLeafReceipt;
  readonly tufTargetAuthorization: TufTargetAuthorizationReceipt;
  readonly deterministicExpansionAndDagVerifier: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<AiSupplySignedExpectedBomReceiptV19>;

declare const aiSupplyStepTerminalBrandV19: unique symbol;
declare const aiSupplySuccessfulOrchestratorTerminalBrandV19: unique symbol;
declare const aiSupplyFailedOrchestratorTerminalBrandV19: unique symbol;
declare const nonzeroExitCodeBrandV19: unique symbol;

type NonzeroExitCodeV19 = number & { readonly [nonzeroExitCodeBrandV19]: never };

type AiSupplyDeclaredPredecessorRowV19<R extends AiSupplyCanonicalStepRowV19> =
  R["predecessorStepId"] extends infer P extends string
    ? P extends "none"
      ? never
      : Extract<AiSupplyCanonicalStepRowV19, { readonly stepId: P }>
    : never;

type AiSupplyPassedPredecessorPointerV19<R extends AiSupplyCanonicalStepRowV19> =
  [AiSupplyDeclaredPredecessorRowV19<R>] extends [never]
    ? {
        readonly predecessorTerminal?: never;
        readonly genesisPreflightEvidence: ImportedOpaqueEvidenceLeafReceipt;
      }
    : {
        readonly predecessorTerminal: ReceiptRef<
          "receipt:ai-supply-step-terminal@19",
          AiSupplyDeclaredPredecessorRowV19<R>
        > & {
          readonly [aiSupplyStepTerminalBrandV19]: never;
          readonly row: AiSupplyDeclaredPredecessorRowV19<R>;
          readonly outcome: "passed";
          readonly exitCode: 0;
        };
        readonly genesisPreflightEvidence?: never;
      };

type AiSupplyFailedOrNotRunPredecessorPointerV19<R extends AiSupplyCanonicalStepRowV19> =
  [AiSupplyDeclaredPredecessorRowV19<R>] extends [never]
    ? never
    : {
        readonly predecessorTerminal: ReceiptRef<
          "receipt:ai-supply-step-terminal@19",
          AiSupplyDeclaredPredecessorRowV19<R>
        > & {
          readonly [aiSupplyStepTerminalBrandV19]: never;
          readonly row: AiSupplyDeclaredPredecessorRowV19<R>;
          readonly outcome: "failed" | "not_run_due_to_predecessor_failure";
        };
      };

type AiSupplyStepTerminalV19<R extends AiSupplyCanonicalStepRowV19> = ReceiptRef<
  "receipt:ai-supply-step-terminal@19",
  R
> & {
  readonly [aiSupplyStepTerminalBrandV19]: never;
  readonly row: R;
  readonly exactArgvDigest: string;
} & (
  | ({ readonly outcome: "passed"; readonly exitCode: 0 } & AiSupplyPassedPredecessorPointerV19<R>)
  | ({ readonly outcome: "failed"; readonly exitCode: NonzeroExitCodeV19 } & AiSupplyPassedPredecessorPointerV19<R>)
  | ({ readonly outcome: "not_run_due_to_predecessor_failure"; readonly exitCode?: never } & AiSupplyFailedOrNotRunPredecessorPointerV19<R>)
);

declare function commitAiSupplyPassedStepTerminalV19<
  const R extends AiSupplyCanonicalStepRowV19,
>(input: {
  readonly row: R;
  readonly exactSpawnArgvEnvironmentRunnerAndExitEvidence: ImportedOpaqueEvidenceLeafReceipt;
} & AiSupplyPassedPredecessorPointerV19<R>): DeepFrozenCommittedReceiptV1<
  Extract<AiSupplyStepTerminalV19<R>, { readonly outcome: "passed" }>
>;

declare function commitAiSupplyFailedStepTerminalV19<
  const R extends AiSupplyCanonicalStepRowV19,
>(input: {
  readonly row: R;
  readonly exactSpawnArgvEnvironmentRunnerAndNonzeroExitEvidence: ImportedOpaqueEvidenceLeafReceipt;
} & AiSupplyPassedPredecessorPointerV19<R>): DeepFrozenCommittedReceiptV1<
  Extract<AiSupplyStepTerminalV19<R>, { readonly outcome: "failed" }>
>;

declare function commitAiSupplyNotRunStepTerminalV19<
  const R extends AiSupplyCanonicalStepRowV19,
>(input: {
  readonly row: R;
  readonly provesNoProcessWasSpawnedForThisRow: ImportedOpaqueEvidenceLeafReceipt;
} & AiSupplyFailedOrNotRunPredecessorPointerV19<R>): DeepFrozenCommittedReceiptV1<
  Extract<AiSupplyStepTerminalV19<R>, { readonly outcome: "not_run_due_to_predecessor_failure" }>
>;

type AiSupplyPassedStepTupleV19<B extends AiSupplySignedExpectedBomReceiptV19> = {
  readonly [I in keyof B["exactOrderedRows"]]: B["exactOrderedRows"][I] extends AiSupplyCanonicalStepRowV19
    ? Extract<AiSupplyStepTerminalV19<B["exactOrderedRows"][I]>, { readonly outcome: "passed" }>
    : B["exactOrderedRows"][I];
};

interface AiSupplySuccessfulOrchestratorTerminalReceiptV19<
  B extends AiSupplySignedExpectedBomReceiptV19 = AiSupplySignedExpectedBomReceiptV19,
  D extends string = string,
> extends ReceiptRef<"receipt:ai-supply-orchestrator-terminal@19", readonly [B, D]> {
  readonly [aiSupplySuccessfulOrchestratorTerminalBrandV19]: never;
  readonly signedExpectedBom: B;
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV19<D>;
  readonly exactOrderedStepTerminals: AiSupplyPassedStepTupleV19<B>;
  readonly overallOutcome: "completed_pass";
  readonly passedStepCount: B["exactOrderedRows"]["length"];
  readonly failedOrNotRunStepCount: 0;
}

interface AiSupplyFailedOrchestratorTerminalReceiptV19<
  B extends AiSupplySignedExpectedBomReceiptV19 = AiSupplySignedExpectedBomReceiptV19,
  D extends string = string,
> extends ReceiptRef<"receipt:ai-supply-orchestrator-failed-terminal@19", readonly [B, D]> {
  readonly [aiSupplyFailedOrchestratorTerminalBrandV19]: never;
  readonly signedExpectedBom: B;
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV19<D>;
  readonly exactOrderedStepTerminals: {
    readonly [I in keyof B["exactOrderedRows"]]: B["exactOrderedRows"][I] extends AiSupplyCanonicalStepRowV19
      ? AiSupplyStepTerminalV19<B["exactOrderedRows"][I]>
      : B["exactOrderedRows"][I];
  };
  readonly overallOutcome: "completed_fail";
  readonly firstFailureRowId: AiSupplyCanonicalStepRowV19["stepId"];
  readonly passedPrefixThenOneFailureThenOnlyNotRunWasVerified: true;
  readonly releasePromotionEligible: false;
}

declare function commitAiSupplyFailedOrchestratorTerminalV19<
  const B extends AiSupplySignedExpectedBomReceiptV19,
  const D extends string,
>(input: {
  readonly signedExpectedBom: B;
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV19<D>;
  readonly exactOrderedStepTerminals: AiSupplyFailedOrchestratorTerminalReceiptV19<B, D>["exactOrderedStepTerminals"];
  readonly deterministicFirstFailureAndNoSuccessorSpawnVerification: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<AiSupplyFailedOrchestratorTerminalReceiptV19<B, D>>;

declare function commitAiSupplySuccessfulOrchestratorTerminalV19<
  const B extends AiSupplySignedExpectedBomReceiptV19,
  const D extends string,
>(input: {
  readonly signedExpectedBom: B;
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV19<D>;
  readonly exactOrderedStepTerminals: AiSupplyPassedStepTupleV19<NoInfer<B>>;
}): DeepFrozenCommittedReceiptV1<AiSupplySuccessfulOrchestratorTerminalReceiptV19<B, D>>;

interface ReleaseEcosystemBindingV19<D extends string> extends ReceiptRef<
  "receipt:release-ecosystem-binding@19",
  D
> {
  readonly distributionIdentity: DistributionArtifactIdentityReceiptV19<D>;
  readonly trustRoots: ReferenceGradeTrustRootsReceiptV19<D>;
  readonly releaseEvidenceSet: GaEcosystemReleaseEvidenceSetV3<D>;
  readonly publishedSupportClaimSet: PublishedSupportClaimSetReceiptV6<D>;
  readonly generatedSupportArtifacts: GeneratedSupportArtifactSetReceiptV19<D>;
  readonly migrationPositiveGate: GaMigrationPositiveGateReceiptV19<D>;
  readonly migrationAbsenceGate: GaMigrationAbsenceGateReceiptV19<D>;
  readonly platformSecurityProductionClosure: PlatformSecurityProductionClosureV6<D>;
  readonly accessibilityRequiredMatrix: GaAccessibilityRequiredMatrixReceiptV19;
  readonly accessibilityReleaseClosure: GaAccessibilityReleaseClosureV19<D>;
  readonly mfaWorstCaseDerivation: MfaWorstCaseDerivationReceiptV19;
  readonly typeContractCompileGate: DeepFrozenCommittedReceiptV1<TypeContractCompileGateReceiptV1>;
  readonly receiptEdgeManifest: ReceiptEdgeManifestV19;
  readonly publicContractCompilation: AiSupplyPublicContractCompilationReceiptV19;
  readonly orchestratorTerminal: AiSupplySuccessfulOrchestratorTerminalReceiptV19<AiSupplySignedExpectedBomReceiptV19, D>;
  readonly provesClaimsAreDownstreamOfRightsJourneysAndNeverAnInputToTheirPrerequisites: true;
  readonly provesAllReleaseCriticalInputsUseOneNonUnionDistributionIdentity: true;
  readonly provesMigrationPositiveAndAbsencePlatformAccessibilityAndCompileClosuresAreExactMembersOfTheReleaseEvidenceAndOrchestratorRun: true;
}

declare function commitReleaseEcosystemBindingV19<const D extends string>(input: {
  readonly distributionIdentity: [SingleDistributionDigestIdentityV19<D>] extends [never]
    ? never
    : DistributionArtifactIdentityReceiptV19<D>;
  readonly trustRoots: ReferenceGradeTrustRootsReceiptV19<NoInfer<D>>;
  readonly releaseEvidenceSet: GaEcosystemReleaseEvidenceSetV3<NoInfer<D>>;
  readonly publishedSupportClaimSet: PublishedSupportClaimSetReceiptV6<NoInfer<D>>;
  readonly generatedSupportArtifacts: GeneratedSupportArtifactSetReceiptV19<NoInfer<D>>;
  readonly migrationPositiveGate: GaMigrationPositiveGateReceiptV19<NoInfer<D>>;
  readonly migrationAbsenceGate: GaMigrationAbsenceGateReceiptV19<NoInfer<D>>;
  readonly platformSecurityProductionClosure: PlatformSecurityProductionClosureV6<NoInfer<D>>;
  readonly accessibilityRequiredMatrix: GaAccessibilityRequiredMatrixReceiptV19;
  readonly accessibilityReleaseClosure: GaAccessibilityReleaseClosureV19<NoInfer<D>>;
  readonly mfaWorstCaseDerivation: MfaWorstCaseDerivationReceiptV19;
  readonly typeContractCompileGate: DeepFrozenCommittedReceiptV1<TypeContractCompileGateReceiptV1>;
  readonly receiptEdgeManifest: ReceiptEdgeManifestV19;
  readonly publicContractCompilation: AiSupplyPublicContractCompilationReceiptV19;
  readonly orchestratorTerminal: AiSupplySuccessfulOrchestratorTerminalReceiptV19<
    AiSupplySignedExpectedBomReceiptV19,
    NoInfer<D>
  >;
}): DeepFrozenCommittedReceiptV1<ReleaseEcosystemBindingV19<D>>;

type _V19ApproveOwnerDecisionInputReachable = ContractAssert<ContractIsNonNever<
  Extract<GaOwnerDecisionAttestationInputV10<GaOwnerDecisionProposalReceipt>, { readonly decision: "approve" }>
>>;
type _V19MigrationRunGateReachable = ContractAssert<ContractIsNonNever<
  Extract<GaJourneyRunGateReportReceipt, { readonly expectedMigrationReadiness: "migration_disposition_committed" }>
>>;
type _V19ThreeRealLocalesAreDistinctFromPseudo = ContractAssert<ExactTypeEqualV7<
  GaJourneyDefinitionBaseV2["requiredUserLocales"],
  readonly ["zh-CN", "en-US", "ar-SA"]
>>;
type _V19PublicProducerCountExactly55 = ContractAssert<ExactTypeEqualV7<
  typeof AI_SUPPLY_PUBLIC_PRODUCER_IDS_V19["length"],
  55
>>;
type _V19PublicReceiptGraphRootCountExactly53 = ContractAssert<ExactTypeEqualV7<
  typeof AI_SUPPLY_PUBLIC_RECEIPT_GRAPH_ROOT_KINDS_V19["length"],
  53
>>;
type _V19EveryPublicProducerHasCanonicalCommittedProducerId = ContractAssert<ExactTypeEqualV7<
  Extract<CanonicalReceiptProducerIdV1, `ai_supply_v19:${string}`>,
  `ai_supply_v19:${AiSupplyPublicProducerIdV19}`
>>;
type _V19LegacyV9ReleaseProducerIsNotPublic = ContractAssert<ContractIsNever<
  Extract<AiSupplyPublicProducerIdV19, "commitReleaseEcosystemBindingV9">
>>;
type _V19LegacyV9BomProducerIsNotPublic = ContractAssert<ContractIsNever<
  Extract<AiSupplyPublicProducerIdV19, "commitAiSupplySignedExpectedPhaseBomV9">
>>;
type _V19TufRootCannotBeFinalTargetRole = ContractAssert<ContractIsNever<
  Extract<TufTargetRoleNameV10, "root" | "timestamp" | "snapshot">
>>;
type _V20CodexCommandAuthOnAuthenticationRetryCannotCarryFixedInterval = ContractAssert<ContractIsNever<
  Extract<CodexCommandAuthDefinitionV19, { readonly refreshMode: "on_authentication_retry"; readonly refreshIntervalMillis: number }>
>>;
type _V19CodexCommandAuthNotStartedCannotCarrySendIntent = ContractAssert<ContractIsNever<
  Extract<CodexCommandAuthProcessTerminalReceiptV19, { readonly outcome: "not_started"; readonly sendIntent: ReceiptRef }>
>>;
type _V19DeliveryUnknownCannotAdvanceFallback = ContractAssert<ContractIsNever<
  Extract<ExactPhysicalAttemptTerminalV19<PhysicalAttemptSubjectV19>, { readonly outcome: "delivery_unknown"; readonly continuation: "retryable_with_fresh_lease" }>
>>;
