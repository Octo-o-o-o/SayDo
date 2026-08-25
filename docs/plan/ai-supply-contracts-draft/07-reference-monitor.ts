// ===== 来源:4. 目标架构 / 4.16.1 Reference monitor 与单次消费链 =====
// 原文档行 26294-27489 (共 1196 行)
type RuntimeChildRegistryMigrationStateV5 =
  | "legacy_json_only"
  | "dual_read_shadow_write"
  | "reconciled_dual_write"
  | "sqlite_authoritative_dual_write"
  | "sqlite_only";

interface LegacyRuntimeChildOwnershipRecordV1 {
  readonly version: 1;
  readonly pid: number;
  readonly kind: string;
  readonly binary: string;
  readonly processStart: string | null;
  readonly ownerPid: number;
  readonly ownerInstanceId: string;
  readonly commandToken?: string;
  readonly jobName?: string;
}

type LegacyRuntimeChildLiftFailureReasonV6 =
  | "process_start_missing_or_unverifiable"
  | "command_token_missing_or_mismatch"
  | "binary_identity_unverifiable"
  | "process_containment_identity_unverifiable"
  | "owner_instance_or_writer_epoch_unresolvable"
  | "pid_reused_or_process_absent"
  | "legacy_record_schema_or_integrity_invalid"
  | "legacy_record_unreadable";

interface RuntimeChildOperationIdentityV5 {
  readonly operationId: string;
  readonly pid: number;
  readonly processBirthIdentityDigest: string;
  readonly commandTokenDigest: string;
  readonly ownerInstanceId: string;
  readonly writerEpoch: number;
  readonly processContainmentIdentity:
    | { readonly kind: "posix_process_group"; readonly pgid: number }
    | { readonly kind: "windows_named_job"; readonly jobIdentityDigest: string };
  readonly binaryArtifactIdentityDigest: string;
  readonly spawnIntentDigest: string;
  readonly identityDigest: string;
}

type LegacyRuntimeChildRawReadEnvelopeV20 =
  | {
      readonly sourcePathDigest: string;
      readonly rawBytesDigest: string;
      readonly readOutcome: "read";
      readonly decodeOutcome: {
        readonly kind: "valid_v1";
        readonly record: LegacyRuntimeChildOwnershipRecordV1;
        readonly canonicalRecordJcsDigest: string;
      };
    }
  | {
      readonly sourcePathDigest: string;
      readonly rawBytesDigest: string;
      readonly readOutcome: "read";
      readonly decodeOutcome: {
        readonly kind: "schema_or_integrity_invalid";
        readonly record?: never;
        readonly decoderDiagnosticDigest: string;
      };
    }
  | {
      readonly sourcePathDigest: string;
      readonly rawBytesDigest?: never;
      readonly readOutcome: "unreadable";
      readonly decodeOutcome?: never;
      readonly readFailureDiagnosticDigest: string;
    };

type LegacyRuntimeChildValidRawReadEnvelopeV20 = Extract<
  LegacyRuntimeChildRawReadEnvelopeV20,
  {
    readonly readOutcome: "read";
    readonly decodeOutcome: { readonly kind: "valid_v1" };
  }
>;

type LegacyRuntimeChildOwnershipLiftedResultV20<
  E extends LegacyRuntimeChildValidRawReadEnvelopeV20 = LegacyRuntimeChildValidRawReadEnvelopeV20,
> = {
      readonly outcome: "lifted";
      readonly rawEnvelope: E;
      readonly rawRecord: LegacyRuntimeChildOwnershipRecordV1;
      readonly rawRecordJcsDigest: string;
      readonly operationIdentity: RuntimeChildOperationIdentityV5;
      readonly liveProcessBirthAndCommandTokenEvidence: ImportedOpaqueEvidenceLeafReceipt;
      readonly binaryFileAndInvocationTargetIdentityEvidence: ImportedOpaqueEvidenceLeafReceipt;
      readonly processGroupOrWindowsJobIdentityEvidence: ImportedOpaqueEvidenceLeafReceipt;
      readonly ownerInstanceToWriterEpochMigrationEvidence: ImportedOpaqueEvidenceLeafReceipt;
      readonly provesEveryV5IdentityFieldWasReadFromV1OrIndependentlyObservedBeforeSignalSpawnDeleteOrAuthorityUse: true;
    };

type LegacyRuntimeChildQuarantineResultForEnvelopeV20<
  E extends LegacyRuntimeChildRawReadEnvelopeV20 = LegacyRuntimeChildRawReadEnvelopeV20,
> = {
      readonly outcome: "unliftable_quarantined";
      readonly rawEnvelope: E;
      readonly quarantineId: string;
      readonly operationIdentity?: never;
      readonly signalSpawnDeleteAndAuthorityAdvanceForbidden: true;
      readonly operatorResolutionOrProcessNaturalExitRequired: true;
    } & (
      E extends LegacyRuntimeChildValidRawReadEnvelopeV20
        ? {
            readonly rawRecord?: LegacyRuntimeChildOwnershipRecordV1;
            readonly rawRecordJcsDigest?: string;
            readonly failureReasons: NonEmptyReadonly<Exclude<
              LegacyRuntimeChildLiftFailureReasonV6,
              "legacy_record_schema_or_integrity_invalid" | "legacy_record_unreadable"
            >>;
          }
        : E extends {
              readonly readOutcome: "read";
              readonly decodeOutcome: { readonly kind: "schema_or_integrity_invalid" };
            }
          ? {
              readonly rawRecord?: never;
              readonly rawRecordJcsDigest?: never;
              readonly failureReasons: NonEmptyReadonly<"legacy_record_schema_or_integrity_invalid">;
            }
          : {
              readonly rawRecord?: never;
              readonly rawRecordJcsDigest?: never;
              readonly failureReasons: NonEmptyReadonly<"legacy_record_unreadable">;
            }
    );

type LegacyRuntimeChildOwnershipLiftResultForEnvelopeV20<
  E extends LegacyRuntimeChildRawReadEnvelopeV20,
> = E extends LegacyRuntimeChildValidRawReadEnvelopeV20
  ? LegacyRuntimeChildOwnershipLiftedResultV20<E> | LegacyRuntimeChildQuarantineResultForEnvelopeV20<E>
  : LegacyRuntimeChildQuarantineResultForEnvelopeV20<E>;

type LegacyRuntimeChildOwnershipLiftResultV6 = LegacyRuntimeChildOwnershipLiftResultForEnvelopeV20<
  LegacyRuntimeChildRawReadEnvelopeV20
>;

declare const legacyRuntimeChildInventoryLiftBrandV6: unique symbol;

interface LegacyRuntimeChildInventoryLiftReceiptV6<
  RI extends readonly LegacyRuntimeChildRawReadEnvelopeV20[] = readonly LegacyRuntimeChildRawReadEnvelopeV20[],
> extends ReceiptRef<
  "receipt:legacy-runtime-child-inventory-lift@20",
  RI
> {
  readonly [legacyRuntimeChildInventoryLiftBrandV6]: never;
  readonly exactRawInventory: RI;
  readonly orderedLiftResults: {
    readonly [I in keyof RI]: RI[I] extends LegacyRuntimeChildRawReadEnvelopeV20
      ? LegacyRuntimeChildOwnershipLiftResultForEnvelopeV20<RI[I]>
      : RI[I];
  };
  readonly rawInventoryDigest: string;
  readonly liftedOperationIdentitySetDigest: string;
  readonly quarantinedRawRecordDigestSetDigest: string;
  readonly duplicateRawRecordOrLiftedOperationIdentityCount: 0;
  readonly provesEveryReadEnvelopeHasExactlyOneLiftedOrQuarantineTerminalAndInvalidOrUnreadableInputNeedsNoParsedV1OrV5Identity: true;
}

declare function liftLegacyRuntimeChildInventoryV6<
  const RI extends readonly LegacyRuntimeChildRawReadEnvelopeV20[],
>(input: {
  readonly exactRawInventory: RI;
  readonly currentProcessAndContainmentObservations: readonly ImportedOpaqueEvidenceLeafReceipt[];
  readonly currentWriterLease: ReferenceMonitorWriterLeaseReceipt;
}): DeepFrozenCommittedReceiptV1<LegacyRuntimeChildInventoryLiftReceiptV6<RI>>;

type RuntimeChildRegistryProjectionBaseV6 = ReceiptRef & {
  readonly operationIdentity: RuntimeChildOperationIdentityV5;
  readonly lifecycleState: "pending" | "established" | "terminal" | "released";
  readonly lifecycleRevision: number;
  readonly terminalDispositionDigest?: string;
  readonly canonicalProjectionDigest: string;
  readonly durableCommitEvidence: ImportedOpaqueEvidenceLeafReceipt;
};

type RuntimeChildRegistryProjectionV5 = RuntimeChildRegistryProjectionBaseV6 &
  (
    | {
        readonly storeKind: "legacy_json_v1";
        readonly legacyLiftResult: Extract<
          LegacyRuntimeChildOwnershipLiftResultV6,
          { readonly outcome: "lifted" }
        >;
        readonly provesOperationIdentityEqualsLiftResultIdentity: true;
      }
    | {
        readonly storeKind: "sqlite_v2";
        readonly legacyLiftResult?: never;
      }
  );

type RuntimeChildRegistryReconciliationLineV5 =
  | {
      readonly outcome: "exact_match";
      readonly operationIdentity: RuntimeChildOperationIdentityV5;
      readonly legacyProjection: RuntimeChildRegistryProjectionV5 & { readonly storeKind: "legacy_json_v1" };
      readonly sqliteProjection: RuntimeChildRegistryProjectionV5 & { readonly storeKind: "sqlite_v2" };
      readonly provesIdentityLifecycleRevisionStateAndTerminalDispositionEqual: true;
    }
  | {
      readonly outcome: "legacy_only_shadow_import_required";
      readonly operationIdentity: RuntimeChildOperationIdentityV5;
      readonly legacyProjection: RuntimeChildRegistryProjectionV5 & { readonly storeKind: "legacy_json_v1" };
      readonly sqliteProjection?: never;
      readonly executionAuthorityRemainsLegacy: true;
    }
  | {
      readonly outcome: "conflict_quarantined";
      readonly operationIdentity: RuntimeChildOperationIdentityV5;
      readonly legacyProjection?: RuntimeChildRegistryProjectionV5 & { readonly storeKind: "legacy_json_v1" };
      readonly sqliteProjection?: RuntimeChildRegistryProjectionV5 & { readonly storeKind: "sqlite_v2" };
      readonly conflictEvidence: ImportedOpaqueEvidenceLeafReceipt;
      readonly signalSpawnDeleteAndAuthorityAdvanceForbidden: true;
    };

declare const runtimeChildRegistryReconciliationBrandV5: unique symbol;

type RuntimeChildRegistryReconciliationReceiptV5 = ReceiptRef & {
  readonly schemaVersion: "saydo.dev/runtime-child-registry-reconciliation/v5";
  readonly legacyInventoryDigest: string;
  readonly legacyInventoryLift: LegacyRuntimeChildInventoryLiftReceiptV6;
  readonly unliftableQuarantineLines: readonly Extract<
    LegacyRuntimeChildOwnershipLiftResultV6,
    { readonly outcome: "unliftable_quarantined" }
  >[];
  readonly sqliteInventoryDigest: string;
  readonly orderedLines: readonly RuntimeChildRegistryReconciliationLineV5[];
  readonly exactMatchCount: number;
  readonly legacyOnlyCount: number;
  readonly conflictCount: 0;
  readonly duplicateOperationIdentityCount: 0;
  readonly provesLinesEqualTheExactSortedUnionOfBothStoresWithoutOmissionOrExtra: true;
  readonly [runtimeChildRegistryReconciliationBrandV5]: "runtime_child_registry_reconciler";
};

declare function reconcileRuntimeChildRegistriesV5(input: {
  readonly legacyInventoryLift: LegacyRuntimeChildInventoryLiftReceiptV6;
  readonly sqliteInventory: readonly RuntimeChildRegistryProjectionV5[];
  readonly currentWriterLease: ReferenceMonitorWriterLeaseReceipt;
}): RuntimeChildRegistryReconciliationReceiptV5;

interface RuntimeChildRegistryMigrationCursorReceiptV5 extends ReceiptRef {
  readonly schemaVersion: "saydo.dev/runtime-child-registry-migration-cursor/v5";
  readonly migrationId: "runtime-child-registry-v1-to-v2";
  readonly state: RuntimeChildRegistryMigrationStateV5;
  readonly revision: number;
  readonly writerEpoch: number;
  readonly reconciliation: RuntimeChildRegistryReconciliationReceiptV5;
  readonly rollbackWindowNotAfter: string;
  readonly previousReleaseBinaryDigest: string;
  readonly previousReleaseDowngradeQualification?: ReceiptRef;
  readonly predecessorCursor?: RuntimeChildRegistryMigrationCursorReceiptV5;
  readonly migrationJournalDigest: string;
  readonly recoverableJournalHead: RuntimeChildRegistryMigrationRecoveryJournalEntryV6 | null;
  readonly provesRevisionIncrementsExactlyOnceAndOnlyTheRegisteredNextStateCanBeCommitted: true;
}

type RuntimeChildRegistryMigrationRecoveryJournalEntryV6 = ReceiptRef & {
  readonly migrationId: "runtime-child-registry-v1-to-v2";
  readonly operationIdentity: RuntimeChildOperationIdentityV5;
  readonly intendedLifecycleRevision: number;
  readonly sharedCommitOrdinal: number;
  readonly predecessorJournalEntry?: RuntimeChildRegistryMigrationRecoveryJournalEntryV6;
  readonly legacyWriteState: "not_started" | "temp_fsynced" | "renamed" | "directory_fsynced";
  readonly sqliteWriteState: "not_started" | "transaction_prepared" | "transaction_committed" | "wal_fsynced";
  readonly publicationState: "blocked" | "both_durable_permit_releasable" | "published";
  readonly recoveryDisposition:
    | "resume_missing_legacy_step"
    | "resume_missing_sqlite_step"
    | "verify_both_then_publish"
    | "quarantine_conflict"
    | "terminally_published";
  readonly spawnSignalDeleteAndLifecycleAdvanceForbiddenUnlessBothStoresDurableAndExact: true;
};

declare const runtimeChildDualWriteBrandV5: unique symbol;

type RuntimeChildDualWriteCommitReceiptV5 = ReceiptRef & {
  readonly schemaVersion: "saydo.dev/runtime-child-registry-dual-write/v5";
  readonly migrationCursor: RuntimeChildRegistryMigrationCursorReceiptV5 & {
    readonly state: "reconciled_dual_write" | "sqlite_authoritative_dual_write";
  };
  readonly operationIdentity: RuntimeChildOperationIdentityV5;
  readonly lifecycleRevision: number;
  readonly legacyJsonProjection: RuntimeChildRegistryProjectionV5 & { readonly storeKind: "legacy_json_v1" };
  readonly sqliteProjection: RuntimeChildRegistryProjectionV5 & { readonly storeKind: "sqlite_v2" };
  readonly sharedCommitOrdinal: number;
  readonly recoveryJournalTerminal: RuntimeChildRegistryMigrationRecoveryJournalEntryV6 & {
    readonly legacyWriteState: "directory_fsynced";
    readonly sqliteWriteState: "wal_fsynced";
    readonly publicationState: "published";
    readonly recoveryDisposition: "terminally_published";
  };
  readonly bothStoresFsyncedBeforeSpawnPermitOrLifecyclePublication: true;
  readonly [runtimeChildDualWriteBrandV5]: "runtime_child_dual_store_commit_coordinator";
};

declare function commitRuntimeChildDualWriteV5(input: {
  readonly migrationCursor: RuntimeChildRegistryMigrationCursorReceiptV5 & {
    readonly state: "reconciled_dual_write" | "sqlite_authoritative_dual_write";
  };
  readonly operationIdentity: RuntimeChildOperationIdentityV5;
  readonly nextLifecycleState: RuntimeChildRegistryProjectionV5["lifecycleState"];
  readonly terminalDispositionDigest?: string;
  readonly writerLease: ReferenceMonitorWriterLeaseReceipt;
}): RuntimeChildDualWriteCommitReceiptV5;

type RuntimeChildRegistryMigrationOperationV7 =
  | "inventory_lift_and_genesis"
  | "enter_dual_read_shadow_write"
  | "shadow_import"
  | "reconcile_exact_union"
  | "repair_shadow_or_quarantine"
  | "advance_reconciled_dual_write"
  | "commit_dual_store_lifecycle"
  | "repair_dual_store_journal"
  | "cutover_sqlite_authority"
  | "qualify_previous_release_downgrade"
  | "rollback_execution_authority_within_window"
  | "reestablish_sqlite_execution_authority"
  | "close_signed_rollback_window"
  | "advance_sqlite_only"
  | "cleanup_legacy_projection"
  | "resolve_quarantined_legacy_record"
  | "verify_sqlite_only_steady_state";

interface RuntimeChildRegistryMigrationOperationByStateV7 {
  readonly legacy_json_only:
    | "inventory_lift_and_genesis"
    | "enter_dual_read_shadow_write";
  readonly dual_read_shadow_write:
    | "shadow_import"
    | "reconcile_exact_union"
    | "repair_shadow_or_quarantine"
    | "advance_reconciled_dual_write";
  readonly reconciled_dual_write:
    | "commit_dual_store_lifecycle"
    | "repair_dual_store_journal"
    | "cutover_sqlite_authority";
  readonly sqlite_authoritative_dual_write:
    | "commit_dual_store_lifecycle"
    | "repair_dual_store_journal"
    | "qualify_previous_release_downgrade"
    | "rollback_execution_authority_within_window"
    | "reestablish_sqlite_execution_authority"
    | "close_signed_rollback_window"
    | "advance_sqlite_only";
  readonly sqlite_only:
    | "cleanup_legacy_projection"
    | "resolve_quarantined_legacy_record"
    | "verify_sqlite_only_steady_state";
}

type RuntimeChildRegistryMigrationNextStateV7<
  S extends RuntimeChildRegistryMigrationStateV5,
  O extends RuntimeChildRegistryMigrationOperationByStateV7[S],
> = O extends "enter_dual_read_shadow_write"
  ? "dual_read_shadow_write"
  : O extends "advance_reconciled_dual_write"
    ? "reconciled_dual_write"
    : O extends "cutover_sqlite_authority"
      ? "sqlite_authoritative_dual_write"
      : O extends "advance_sqlite_only"
        ? "sqlite_only"
        : S;

type RuntimeChildRegistryMigrationKillPointV7 =
  | "before_legacy_temp_write"
  | "after_legacy_temp_write_before_file_fsync"
  | "after_legacy_file_fsync_before_rename"
  | "after_legacy_rename_before_directory_fsync"
  | "after_legacy_directory_fsync"
  | "before_sqlite_prepare"
  | "after_sqlite_prepare_before_commit"
  | "after_sqlite_commit_before_wal_fsync"
  | "after_sqlite_wal_fsync"
  | "after_one_store_durable_before_other_store"
  | "after_both_stores_durable_before_permit"
  | "after_permit_commit_before_publication"
  | "after_publication_before_cursor_successor"
  | "during_cutover_cursor_cas"
  | "during_rollback_authority_cas"
  | "during_sqlite_only_cursor_cas"
  | "during_legacy_projection_cleanup";

const RUNTIME_CHILD_REGISTRY_MIGRATION_TRANSITION_TABLE_V7 = {
  legacy_json_only: {
    operations: ["inventory_lift_and_genesis", "enter_dual_read_shadow_write"],
    forwardState: "dual_read_shadow_write",
    executionAuthority: "legacy_json_v1",
  },
  dual_read_shadow_write: {
    operations: ["shadow_import", "reconcile_exact_union", "repair_shadow_or_quarantine", "advance_reconciled_dual_write"],
    forwardState: "reconciled_dual_write",
    executionAuthority: "legacy_json_v1",
  },
  reconciled_dual_write: {
    operations: ["commit_dual_store_lifecycle", "repair_dual_store_journal", "cutover_sqlite_authority"],
    forwardState: "sqlite_authoritative_dual_write",
    executionAuthority: "dual_store_permit_after_both_durable",
  },
  sqlite_authoritative_dual_write: {
    operations: ["commit_dual_store_lifecycle", "repair_dual_store_journal", "qualify_previous_release_downgrade", "rollback_execution_authority_within_window", "reestablish_sqlite_execution_authority", "close_signed_rollback_window", "advance_sqlite_only"],
    forwardState: "sqlite_only",
    executionAuthority: "sqlite_v2_with_typed_in_place_rollback_subcursor",
  },
  sqlite_only: {
    operations: ["cleanup_legacy_projection", "resolve_quarantined_legacy_record", "verify_sqlite_only_steady_state"],
    forwardState: "sqlite_only",
    executionAuthority: "sqlite_v2",
  },
} as const satisfies {
  readonly [S in RuntimeChildRegistryMigrationStateV5]: {
    readonly operations: readonly RuntimeChildRegistryMigrationOperationByStateV7[S][];
    readonly forwardState: RuntimeChildRegistryMigrationStateV5;
    readonly executionAuthority:
      | "legacy_json_v1"
      | "dual_store_permit_after_both_durable"
      | "sqlite_v2_with_typed_in_place_rollback_subcursor"
      | "sqlite_v2";
  };
};

const MIGRATION_CONTROL_CAS_STEPS_V9 = ["after_publication_before_cursor_successor"] as const;
const MIGRATION_LEGACY_WRITE_STEPS_V9 = [
  "before_legacy_temp_write", "after_legacy_temp_write_before_file_fsync",
  "after_legacy_file_fsync_before_rename", "after_legacy_rename_before_directory_fsync",
  "after_legacy_directory_fsync", "after_publication_before_cursor_successor",
] as const;
const MIGRATION_SQLITE_WRITE_STEPS_V9 = [
  "before_sqlite_prepare", "after_sqlite_prepare_before_commit",
  "after_sqlite_commit_before_wal_fsync", "after_sqlite_wal_fsync",
  "after_publication_before_cursor_successor",
] as const;
const MIGRATION_DUAL_STORE_STEPS_V9 = [
  ...MIGRATION_LEGACY_WRITE_STEPS_V9, ...MIGRATION_SQLITE_WRITE_STEPS_V9,
  "after_one_store_durable_before_other_store", "after_both_stores_durable_before_permit",
  "after_permit_commit_before_publication",
] as const;

const RUNTIME_CHILD_REGISTRY_MIGRATION_OPERATION_STEP_TABLE_V7 = {
  legacy_json_only: {
    inventory_lift_and_genesis: MIGRATION_CONTROL_CAS_STEPS_V9,
    enter_dual_read_shadow_write: MIGRATION_CONTROL_CAS_STEPS_V9,
  },
  dual_read_shadow_write: {
    shadow_import: MIGRATION_SQLITE_WRITE_STEPS_V9,
    reconcile_exact_union: MIGRATION_CONTROL_CAS_STEPS_V9,
    repair_shadow_or_quarantine: MIGRATION_SQLITE_WRITE_STEPS_V9,
    advance_reconciled_dual_write: MIGRATION_CONTROL_CAS_STEPS_V9,
  },
  reconciled_dual_write: {
    commit_dual_store_lifecycle: MIGRATION_DUAL_STORE_STEPS_V9,
    repair_dual_store_journal: MIGRATION_DUAL_STORE_STEPS_V9,
    cutover_sqlite_authority: ["during_cutover_cursor_cas", "after_publication_before_cursor_successor"],
  },
  sqlite_authoritative_dual_write: {
    commit_dual_store_lifecycle: MIGRATION_DUAL_STORE_STEPS_V9,
    repair_dual_store_journal: MIGRATION_DUAL_STORE_STEPS_V9,
    qualify_previous_release_downgrade: MIGRATION_CONTROL_CAS_STEPS_V9,
    rollback_execution_authority_within_window: ["during_rollback_authority_cas", "after_publication_before_cursor_successor"],
    reestablish_sqlite_execution_authority: ["during_cutover_cursor_cas", "after_publication_before_cursor_successor"],
    close_signed_rollback_window: MIGRATION_CONTROL_CAS_STEPS_V9,
    advance_sqlite_only: ["during_sqlite_only_cursor_cas", "after_publication_before_cursor_successor"],
  },
  sqlite_only: {
    cleanup_legacy_projection: ["during_legacy_projection_cleanup", "after_publication_before_cursor_successor"],
    resolve_quarantined_legacy_record: MIGRATION_CONTROL_CAS_STEPS_V9,
    verify_sqlite_only_steady_state: MIGRATION_CONTROL_CAS_STEPS_V9,
  },
} as const satisfies {
  readonly [S in RuntimeChildRegistryMigrationStateV5]: {
    readonly [O in RuntimeChildRegistryMigrationOperationByStateV7[S]]: NonEmptyReadonly<RuntimeChildRegistryMigrationKillPointV7>;
  };
};

type RuntimeChildMigrationPrerequisiteKindV9 =
  | "legacy_inventory_lift_closed" | "shadow_import_journal_closed" | "quarantine_or_repair_terminal"
  | "exact_reconciliation_zero_conflict" | "dual_store_both_durable" | "recovery_journal_authoritative"
  | "sqlite_authority_active" | "signed_rollback_window_open" | "previous_release_downgrade_qualified"
  | "rollback_authority_terminal" | "signed_rollback_window_closed" | "legacy_compatibility_expired"
  | "zero_in_flight" | "zero_unresolved_quarantine" | "zero_unresolved_journal"
  | "operator_or_natural_exit_resolution";

const RUNTIME_CHILD_MIGRATION_PREREQUISITE_TABLE_V9 = {
  legacy_json_only: {
    inventory_lift_and_genesis: ["legacy_inventory_lift_closed"],
    enter_dual_read_shadow_write: ["legacy_inventory_lift_closed"],
  },
  dual_read_shadow_write: {
    shadow_import: ["legacy_inventory_lift_closed"],
    reconcile_exact_union: ["shadow_import_journal_closed"],
    repair_shadow_or_quarantine: ["quarantine_or_repair_terminal"],
    advance_reconciled_dual_write: ["exact_reconciliation_zero_conflict", "zero_unresolved_journal"],
  },
  reconciled_dual_write: {
    commit_dual_store_lifecycle: ["exact_reconciliation_zero_conflict"],
    repair_dual_store_journal: ["recovery_journal_authoritative"],
    cutover_sqlite_authority: ["exact_reconciliation_zero_conflict", "dual_store_both_durable", "zero_in_flight"],
  },
  sqlite_authoritative_dual_write: {
    commit_dual_store_lifecycle: ["sqlite_authority_active"],
    repair_dual_store_journal: ["recovery_journal_authoritative"],
    qualify_previous_release_downgrade: ["sqlite_authority_active"],
    rollback_execution_authority_within_window: ["signed_rollback_window_open", "previous_release_downgrade_qualified"],
    reestablish_sqlite_execution_authority: ["rollback_authority_terminal"],
    close_signed_rollback_window: ["previous_release_downgrade_qualified", "zero_in_flight"],
    advance_sqlite_only: ["previous_release_downgrade_qualified", "signed_rollback_window_closed", "legacy_compatibility_expired", "zero_in_flight", "zero_unresolved_quarantine", "zero_unresolved_journal", "exact_reconciliation_zero_conflict"],
  },
  sqlite_only: {
    cleanup_legacy_projection: ["signed_rollback_window_closed", "legacy_compatibility_expired", "zero_in_flight", "zero_unresolved_quarantine", "zero_unresolved_journal"],
    resolve_quarantined_legacy_record: ["operator_or_natural_exit_resolution"],
    verify_sqlite_only_steady_state: ["sqlite_authority_active", "zero_in_flight", "zero_unresolved_journal"],
  },
} as const satisfies {
  readonly [S in RuntimeChildRegistryMigrationStateV5]: {
    readonly [O in RuntimeChildRegistryMigrationOperationByStateV7[S]]: NonEmptyReadonly<RuntimeChildMigrationPrerequisiteKindV9>;
  };
};

type RuntimeChildMigrationLookupV9<M, O extends PropertyKey> = O extends keyof M ? M[O] : never;

type RuntimeChildMigrationStepTupleV9<
  S extends RuntimeChildRegistryMigrationStateV5,
  O extends PropertyKey,
> = S extends "legacy_json_only" ? RuntimeChildMigrationLookupV9<typeof RUNTIME_CHILD_REGISTRY_MIGRATION_OPERATION_STEP_TABLE_V7.legacy_json_only, O>
  : S extends "dual_read_shadow_write" ? RuntimeChildMigrationLookupV9<typeof RUNTIME_CHILD_REGISTRY_MIGRATION_OPERATION_STEP_TABLE_V7.dual_read_shadow_write, O>
  : S extends "reconciled_dual_write" ? RuntimeChildMigrationLookupV9<typeof RUNTIME_CHILD_REGISTRY_MIGRATION_OPERATION_STEP_TABLE_V7.reconciled_dual_write, O>
  : S extends "sqlite_authoritative_dual_write" ? RuntimeChildMigrationLookupV9<typeof RUNTIME_CHILD_REGISTRY_MIGRATION_OPERATION_STEP_TABLE_V7.sqlite_authoritative_dual_write, O>
  : S extends "sqlite_only" ? RuntimeChildMigrationLookupV9<typeof RUNTIME_CHILD_REGISTRY_MIGRATION_OPERATION_STEP_TABLE_V7.sqlite_only, O>
  : never;

type RuntimeChildMigrationPrerequisiteKindTupleV9<
  S extends RuntimeChildRegistryMigrationStateV5,
  O extends PropertyKey,
> = S extends "legacy_json_only" ? RuntimeChildMigrationLookupV9<typeof RUNTIME_CHILD_MIGRATION_PREREQUISITE_TABLE_V9.legacy_json_only, O>
  : S extends "dual_read_shadow_write" ? RuntimeChildMigrationLookupV9<typeof RUNTIME_CHILD_MIGRATION_PREREQUISITE_TABLE_V9.dual_read_shadow_write, O>
  : S extends "reconciled_dual_write" ? RuntimeChildMigrationLookupV9<typeof RUNTIME_CHILD_MIGRATION_PREREQUISITE_TABLE_V9.reconciled_dual_write, O>
  : S extends "sqlite_authoritative_dual_write" ? RuntimeChildMigrationLookupV9<typeof RUNTIME_CHILD_MIGRATION_PREREQUISITE_TABLE_V9.sqlite_authoritative_dual_write, O>
  : S extends "sqlite_only" ? RuntimeChildMigrationLookupV9<typeof RUNTIME_CHILD_MIGRATION_PREREQUISITE_TABLE_V9.sqlite_only, O>
  : never;

type RuntimeChildMigrationStepV9<S extends RuntimeChildRegistryMigrationStateV5, O extends PropertyKey> =
  RuntimeChildMigrationStepTupleV9<S, O> extends readonly (infer K extends RuntimeChildRegistryMigrationKillPointV7)[] ? K : never;

declare const runtimeChildMigrationOperationLeaseBrandV7: unique symbol;
declare const runtimeChildMigrationOperationIntentBrandV7: unique symbol;
declare const runtimeChildMigrationOperationTerminalBrandV7: unique symbol;
declare const runtimeChildMigrationRecoveryAuthorityBrandV7: unique symbol;
declare const runtimeChildMigrationRecoveryLeaseBrandV7: unique symbol;
declare const runtimeChildMigrationRecoveryIntentBrandV7: unique symbol;
declare const runtimeChildMigrationRecoveryTerminalBrandV7: unique symbol;
declare const runtimeChildMigrationSuccessorCursorBrandV7: unique symbol;
declare const runtimeChildQuarantineResolutionBrandV7: unique symbol;
declare const runtimeChildQuarantineOperatorDecisionBrandV7: unique symbol;
declare const runtimeChildQuarantineNaturalExitBrandV7: unique symbol;
declare const legacyRuntimeChildQuarantineSubjectBrandV7: unique symbol;
declare const runtimeChildMigrationCompletionBrandV7: unique symbol;
declare const runtimeChildMigrationPrerequisiteBrandV9: unique symbol;
declare const runtimeChildMigrationKillOracleBrandV9: unique symbol;

type RuntimeChildMigrationPrerequisiteFactsV9<K extends RuntimeChildMigrationPrerequisiteKindV9> =
  K extends "previous_release_downgrade_qualified" ? {
    readonly previousReleaseBinaryRanAgainstCopiedRealHome: true;
    readonly spawnDaemonKillRestartReapAndDowngradeRecoveryPassed: true;
  } : K extends "signed_rollback_window_open" ? {
    readonly windowState: "open"; readonly trustedTimeBeforeNotAfter: true;
  } : K extends "signed_rollback_window_closed" ? {
    readonly windowState: "closed"; readonly trustedTimeAtOrAfterNotAfter: true;
  } : K extends "legacy_compatibility_expired" ? {
    readonly compatibilityCommitmentState: "expired"; readonly signedExpiryVerified: true;
  } : K extends "zero_in_flight" ? {
    readonly inFlightOperationCount: 0; readonly inFlightLeaseCount: 0;
  } : K extends "zero_unresolved_quarantine" ? {
    readonly unresolvedQuarantineCount: 0;
  } : K extends "zero_unresolved_journal" ? {
    readonly unresolvedRecoveryJournalCount: 0;
  } : K extends "exact_reconciliation_zero_conflict" ? {
    readonly reconciliationConflictCount: 0; readonly duplicateOperationIdentityCount: 0;
  } : K extends "dual_store_both_durable" ? {
    readonly nonDurableLegacyProjectionCount: 0; readonly nonDurableSqliteProjectionCount: 0;
  } : { readonly prerequisiteSpecificInvariantVerified: true };

type RuntimeChildMigrationPrerequisiteReceiptV9<
  K extends RuntimeChildMigrationPrerequisiteKindV9,
  C extends RuntimeChildRegistryMigrationCursorReceiptV5,
> = ReceiptRef<"receipt:runtime-child-migration-prerequisite@9", readonly [K, C]> & {
  readonly [runtimeChildMigrationPrerequisiteBrandV9]: never;
  readonly prerequisiteKind: K;
  readonly exactMigrationCursor: C;
  readonly exactAuthoritativeStoreProcessLeaseQuarantineAndTrustedTimeEvidence: NonEmptyReadonly<ImportedOpaqueEvidenceLeafReceipt>;
  readonly derivedByRegisteredPrerequisiteVerifierNotCallerAssertion: true;
} & RuntimeChildMigrationPrerequisiteFactsV9<K>;

type RuntimeChildMigrationPrerequisiteTupleV9<
  S extends RuntimeChildRegistryMigrationStateV5,
  O extends RuntimeChildRegistryMigrationOperationByStateV7[S],
  C extends RuntimeChildRegistryMigrationCursorReceiptV5 & { readonly state: S },
> = RuntimeChildMigrationPrerequisiteKindTupleV9<S, O> extends infer T extends readonly RuntimeChildMigrationPrerequisiteKindV9[]
  ? { readonly [I in keyof T]: RuntimeChildMigrationPrerequisiteReceiptV9<T[I], C> }
  : never;

declare function commitRuntimeChildMigrationPrerequisiteV9<
  const K extends RuntimeChildMigrationPrerequisiteKindV9,
  const C extends RuntimeChildRegistryMigrationCursorReceiptV5,
>(input: {
  readonly prerequisiteKind: K;
  readonly exactMigrationCursor: C;
  readonly rawAuthoritativeStoreProcessLeaseQuarantineAndTrustedTimeEvidence: NonEmptyReadonly<ImportedOpaqueEvidenceLeafReceipt>;
  readonly verifierProfile: ReceiptRef<"receipt:runtime-child-migration-prerequisite-verifier@9", K>;
}): DeepFrozenCommittedReceiptV1<RuntimeChildMigrationPrerequisiteReceiptV9<K, C>>;

type RuntimeChildRegistryMigrationOperationLeaseV7<
  S extends RuntimeChildRegistryMigrationStateV5 = RuntimeChildRegistryMigrationStateV5,
  O extends RuntimeChildRegistryMigrationOperationByStateV7[S] = RuntimeChildRegistryMigrationOperationByStateV7[S],
  C extends RuntimeChildRegistryMigrationCursorReceiptV5 & { readonly state: S } = RuntimeChildRegistryMigrationCursorReceiptV5 & { readonly state: S },
> = AuthorityInventoryBearingLease<
  LeaseAuthorityInventoryTuple<readonly ["resource_reservation", "exclusive_cursor_action"]>
> & {
  readonly [runtimeChildMigrationOperationLeaseBrandV7]: never;
  readonly migrationCursor: C;
  readonly operation: O;
  readonly exactTransitionTable: typeof RUNTIME_CHILD_REGISTRY_MIGRATION_TRANSITION_TABLE_V7;
  readonly exactOperationStepSequence: RuntimeChildMigrationStepTupleV9<S, O>;
  readonly exactCommittedPrerequisites: RuntimeChildMigrationPrerequisiteTupleV9<S, O, C>;
  readonly writerLease: ReferenceMonitorWriterLeaseReceipt;
  readonly writerEpoch: RuntimeChildRegistryMigrationCursorReceiptV5["writerEpoch"];
  readonly sharedCommitOrdinal: number;
  readonly operationSubjectDigest: string;
  readonly commitTokenDigest: string;
  readonly permitsProcessSignalSpawnDeleteOrLifecyclePublicationBeforeOperationTerminal: false;
};

declare function issueRuntimeChildRegistryMigrationOperationLeaseV7<
  const S extends RuntimeChildRegistryMigrationStateV5,
  const O extends RuntimeChildRegistryMigrationOperationByStateV7[S],
  const C extends RuntimeChildRegistryMigrationCursorReceiptV5 & { readonly state: S },
>(input: {
  readonly migrationCursor: C;
  readonly operation: O;
  readonly currentWriterLease: ReferenceMonitorWriterLeaseReceipt;
  readonly currentSecurityAnchor: SecurityMonotonicAnchorReceipt;
  readonly exactObservedLegacyAndSqliteProjectionSet: readonly RuntimeChildRegistryProjectionV5[];
  readonly operationSubject: ReceiptRef<"receipt:runtime-child-migration-operation-subject@7", readonly [S, O]>;
  readonly exactCommittedPrerequisites: RuntimeChildMigrationPrerequisiteTupleV9<S, O, C>;
}): DeepFrozenCommittedReceiptV1<RuntimeChildRegistryMigrationOperationLeaseV7<S, O, C>>;

type RuntimeChildRegistryMigrationOperationIntentV7<
  S extends RuntimeChildRegistryMigrationStateV5,
  O extends RuntimeChildRegistryMigrationOperationByStateV7[S],
  L extends RuntimeChildRegistryMigrationOperationLeaseV7<S, O> = RuntimeChildRegistryMigrationOperationLeaseV7<S, O>,
> = ReceiptRef<"receipt:runtime-child-migration-operation-intent@7", L> & {
  readonly [runtimeChildMigrationOperationIntentBrandV7]: never;
  readonly operationLease: L;
  readonly predecessorCursor: L["migrationCursor"];
  readonly operation: O;
  readonly sharedCommitOrdinal: L["sharedCommitOrdinal"];
  readonly exactExpectedLegacyAndSqliteProjectionSetDigest: string;
  readonly exactPlannedWriteAndPermitStepSequence: RuntimeChildMigrationStepTupleV9<S, O>;
  readonly persistedBeforeFirstJsonSqlitePermitCutoverRollbackOrCleanupByte: true;
};

declare function commitRuntimeChildRegistryMigrationOperationIntentV7<
  const S extends RuntimeChildRegistryMigrationStateV5,
  const O extends RuntimeChildRegistryMigrationOperationByStateV7[S],
  const L extends RuntimeChildRegistryMigrationOperationLeaseV7<S, O>,
>(input: Omit<
  RuntimeChildRegistryMigrationOperationIntentV7<S, O, L>,
  keyof ReceiptRef | typeof runtimeChildMigrationOperationIntentBrandV7
>): DeepFrozenCommittedReceiptV1<RuntimeChildRegistryMigrationOperationIntentV7<S, O, L>>;

type RuntimeChildRegistryMigrationOperationTerminalV7<
  S extends RuntimeChildRegistryMigrationStateV5 = RuntimeChildRegistryMigrationStateV5,
  O extends RuntimeChildRegistryMigrationOperationByStateV7[S] = RuntimeChildRegistryMigrationOperationByStateV7[S],
  L extends RuntimeChildRegistryMigrationOperationLeaseV7<S, O> = RuntimeChildRegistryMigrationOperationLeaseV7<S, O>,
> = ReceiptRef<"receipt:runtime-child-migration-operation-terminal@7", L> & {
  readonly [runtimeChildMigrationOperationTerminalBrandV7]: never;
  readonly operationLease: L;
  readonly operationIntent: RuntimeChildRegistryMigrationOperationIntentV7<S, O, L>;
  readonly operation: O;
  readonly observedLegacyWriteState: RuntimeChildRegistryMigrationRecoveryJournalEntryV6["legacyWriteState"];
  readonly observedSqliteWriteState: RuntimeChildRegistryMigrationRecoveryJournalEntryV6["sqliteWriteState"];
  readonly rawDurabilityAndAuthorityEvidence: NonEmptyReadonly<ImportedOpaqueEvidenceLeafReceipt>;
  readonly authorityReleases: ExactLeaseAuthorityReleaseTuple<L>;
  readonly provesEveryOperationLeaseAuthorityWasReleasedExactlyOnceAtThisTerminal: true;
  readonly oldWriterOrStaleEpochSuccessfulMutationCount: 0;
} &
  (
    | {
        readonly outcome: "completed";
        readonly resultingState: RuntimeChildRegistryMigrationNextStateV7<S, O>;
        readonly completedProjectionOrControlArtifact: ReceiptRef<
          "receipt:runtime-child-migration-completed-artifact@7",
          readonly [S, O, RuntimeChildRegistryMigrationNextStateV7<S, O>]
        >;
        readonly bothRequiredStoresDurableBeforePermit: true;
        readonly unresolvedRecoveryOrQuarantineCount: 0;
        readonly interruptedAt?: never;
      }
    | {
        readonly outcome: "retryable_interrupted";
        readonly resultingState: S;
        readonly interruptedAt: RuntimeChildMigrationStepV9<S, O>;
        readonly completedProjectionOrControlArtifact?: never;
        readonly permitPublicationOrAuthorityAdvanceCount: 0;
        readonly exactMissingStepSuffix: NonEmptyReadonly<RuntimeChildMigrationStepV9<S, O>>;
      }
    | {
        readonly outcome: "quarantined";
        readonly resultingState: S;
        readonly interruptedAt: RuntimeChildMigrationStepV9<S, O>;
        readonly completedProjectionOrControlArtifact?: never;
        readonly quarantineEvidence: ImportedOpaqueEvidenceLeafReceipt;
        readonly processSignalSpawnDeletePermitAndAuthorityAdvanceCount: 0;
      }
  );

declare function commitRuntimeChildRegistryMigrationOperationTerminalV7<
  const S extends RuntimeChildRegistryMigrationStateV5,
  const O extends RuntimeChildRegistryMigrationOperationByStateV7[S],
  const L extends RuntimeChildRegistryMigrationOperationLeaseV7<S, O>,
>(input: DistributiveOmitV1<
  RuntimeChildRegistryMigrationOperationTerminalV7<S, O, L>,
  keyof ReceiptRef | typeof runtimeChildMigrationOperationTerminalBrandV7
>): DeepFrozenCommittedReceiptV1<RuntimeChildRegistryMigrationOperationTerminalV7<S, O, L>>;

type RuntimeChildRegistryMigrationRecoveryAuthorityV7<
  S extends RuntimeChildRegistryMigrationStateV5 = RuntimeChildRegistryMigrationStateV5,
  O extends RuntimeChildRegistryMigrationOperationByStateV7[S] = RuntimeChildRegistryMigrationOperationByStateV7[S],
  T extends Extract<
    RuntimeChildRegistryMigrationOperationTerminalV7<S, O>,
    { readonly outcome: "retryable_interrupted" }
  > = Extract<
    RuntimeChildRegistryMigrationOperationTerminalV7<S, O>,
    { readonly outcome: "retryable_interrupted" }
  >,
  P extends ReceiptRef<"receipt:runtime-child-migration-recovery-terminal@7"> | null = null,
> = ReceiptRef<"receipt:runtime-child-migration-recovery-authority@7", readonly [T, P]> & {
  readonly [runtimeChildMigrationRecoveryAuthorityBrandV7]: never;
  readonly interruptedTerminal: T;
  readonly predecessorRecoveryTerminal: P;
  readonly exactMissingStepSuffix: P extends {
    readonly outcome: "still_interrupted";
    readonly nextMissingStepSuffix: infer M;
  }
    ? M
    : T["exactMissingStepSuffix"];
  readonly recoveryCursorRevision: number;
  readonly recoveryAttemptOrdinal: number;
  readonly commitTokenDigest: string;
  readonly permitsOnlyIdempotentVerificationOrTheExactMissingSuffix: true;
  readonly originalOperationCannotBeStartedAgain: true;
};

declare function issueRuntimeChildRegistryMigrationRecoveryAuthorityV7<
  const S extends RuntimeChildRegistryMigrationStateV5,
  const O extends RuntimeChildRegistryMigrationOperationByStateV7[S],
  const T extends Extract<
    RuntimeChildRegistryMigrationOperationTerminalV7<S, O>,
    { readonly outcome: "retryable_interrupted" }
  >,
>(input: {
  readonly interruptedTerminal: T;
  readonly currentWriterLease: ReferenceMonitorWriterLeaseReceipt;
  readonly exactObservedStoreAndPermitState: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<RuntimeChildRegistryMigrationRecoveryAuthorityV7<S, O, T, null>>;

type RuntimeChildRegistryMigrationRecoveryLeaseV7<
  S extends RuntimeChildRegistryMigrationStateV5 = RuntimeChildRegistryMigrationStateV5,
  O extends RuntimeChildRegistryMigrationOperationByStateV7[S] = RuntimeChildRegistryMigrationOperationByStateV7[S],
  T extends Extract<
    RuntimeChildRegistryMigrationOperationTerminalV7<S, O>,
    { readonly outcome: "retryable_interrupted" }
  > = Extract<RuntimeChildRegistryMigrationOperationTerminalV7<S, O>, { readonly outcome: "retryable_interrupted" }>,
  A extends RuntimeChildRegistryMigrationRecoveryAuthorityV7<
    S,
    O,
    T,
    ReceiptRef<"receipt:runtime-child-migration-recovery-terminal@7"> | null
  > = RuntimeChildRegistryMigrationRecoveryAuthorityV7<
    S,
    O,
    T,
    ReceiptRef<"receipt:runtime-child-migration-recovery-terminal@7"> | null
  >,
> = AuthorityInventoryBearingLease<
  LeaseAuthorityInventoryTuple<readonly ["resource_reservation", "exclusive_cursor_action"]>
> & {
  readonly [runtimeChildMigrationRecoveryLeaseBrandV7]: never;
  readonly recoveryAuthority: A;
  readonly interruptedTerminal: T;
  readonly currentWriterLease: ReferenceMonitorWriterLeaseReceipt;
  readonly recoveryCursorRevision: A["recoveryCursorRevision"];
  readonly recoveryAttemptOrdinal: A["recoveryAttemptOrdinal"];
  readonly exactMissingStepSuffix: A["exactMissingStepSuffix"];
  readonly permitsStartingTheOriginalOperationAgain: false;
};

declare function issueRuntimeChildRegistryMigrationRecoveryLeaseV7<
  const S extends RuntimeChildRegistryMigrationStateV5,
  const O extends RuntimeChildRegistryMigrationOperationByStateV7[S],
  const T extends Extract<RuntimeChildRegistryMigrationOperationTerminalV7<S, O>, { readonly outcome: "retryable_interrupted" }>,
  const A extends RuntimeChildRegistryMigrationRecoveryAuthorityV7<
    S,
    O,
    T,
    ReceiptRef<"receipt:runtime-child-migration-recovery-terminal@7"> | null
  >,
>(input: {
  readonly recoveryAuthority: A;
  readonly currentWriterLease: ReferenceMonitorWriterLeaseReceipt;
  readonly currentSecurityAnchor: SecurityMonotonicAnchorReceipt;
}): DeepFrozenCommittedReceiptV1<RuntimeChildRegistryMigrationRecoveryLeaseV7<S, O, T, A>>;

type RuntimeChildRegistryMigrationRecoveryIntentV7<
  S extends RuntimeChildRegistryMigrationStateV5 = RuntimeChildRegistryMigrationStateV5,
  O extends RuntimeChildRegistryMigrationOperationByStateV7[S] = RuntimeChildRegistryMigrationOperationByStateV7[S],
  T extends Extract<
    RuntimeChildRegistryMigrationOperationTerminalV7<S, O>,
    { readonly outcome: "retryable_interrupted" }
  > = Extract<RuntimeChildRegistryMigrationOperationTerminalV7<S, O>, { readonly outcome: "retryable_interrupted" }>,
  A extends RuntimeChildRegistryMigrationRecoveryAuthorityV7<
    S,
    O,
    T,
    ReceiptRef<"receipt:runtime-child-migration-recovery-terminal@7"> | null
  > = RuntimeChildRegistryMigrationRecoveryAuthorityV7<
    S,
    O,
    T,
    ReceiptRef<"receipt:runtime-child-migration-recovery-terminal@7"> | null
  >,
  L extends RuntimeChildRegistryMigrationRecoveryLeaseV7<S, O, T, A> = RuntimeChildRegistryMigrationRecoveryLeaseV7<S, O, T, A>,
> = ReceiptRef<"receipt:runtime-child-migration-recovery-intent@7", L> & {
  readonly [runtimeChildMigrationRecoveryIntentBrandV7]: never;
  readonly recoveryLease: L;
  readonly interruptedTerminal: T;
  readonly exactMissingStepSuffix: L["exactMissingStepSuffix"];
  readonly exactObservedStoreAndPermitStateBeforeRecovery: ImportedOpaqueEvidenceLeafReceipt;
  readonly persistedBeforeFirstRecoveryVerificationOrWriteByte: true;
};

declare function commitRuntimeChildRegistryMigrationRecoveryIntentV7<
  const S extends RuntimeChildRegistryMigrationStateV5,
  const O extends RuntimeChildRegistryMigrationOperationByStateV7[S],
  const T extends Extract<RuntimeChildRegistryMigrationOperationTerminalV7<S, O>, { readonly outcome: "retryable_interrupted" }>,
  const A extends RuntimeChildRegistryMigrationRecoveryAuthorityV7<
    S,
    O,
    T,
    ReceiptRef<"receipt:runtime-child-migration-recovery-terminal@7"> | null
  >,
  const L extends RuntimeChildRegistryMigrationRecoveryLeaseV7<S, O, T, A>,
>(input: Omit<
  RuntimeChildRegistryMigrationRecoveryIntentV7<S, O, T, A, L>,
  keyof ReceiptRef | typeof runtimeChildMigrationRecoveryIntentBrandV7
>): DeepFrozenCommittedReceiptV1<RuntimeChildRegistryMigrationRecoveryIntentV7<S, O, T, A, L>>;

type RuntimeChildRegistryMigrationRecoveryTerminalV7<
  S extends RuntimeChildRegistryMigrationStateV5 = RuntimeChildRegistryMigrationStateV5,
  O extends RuntimeChildRegistryMigrationOperationByStateV7[S] = RuntimeChildRegistryMigrationOperationByStateV7[S],
  T extends Extract<
    RuntimeChildRegistryMigrationOperationTerminalV7<S, O>,
    { readonly outcome: "retryable_interrupted" }
  > = Extract<RuntimeChildRegistryMigrationOperationTerminalV7<S, O>, { readonly outcome: "retryable_interrupted" }>,
  A extends RuntimeChildRegistryMigrationRecoveryAuthorityV7<
    S,
    O,
    T,
    ReceiptRef<"receipt:runtime-child-migration-recovery-terminal@7"> | null
  > = RuntimeChildRegistryMigrationRecoveryAuthorityV7<
    S,
    O,
    T,
    ReceiptRef<"receipt:runtime-child-migration-recovery-terminal@7"> | null
  >,
  L extends RuntimeChildRegistryMigrationRecoveryLeaseV7<S, O, T, A> = RuntimeChildRegistryMigrationRecoveryLeaseV7<S, O, T, A>,
  I extends RuntimeChildRegistryMigrationRecoveryIntentV7<S, O, T, A, L> = RuntimeChildRegistryMigrationRecoveryIntentV7<S, O, T, A, L>,
> = ReceiptRef<"receipt:runtime-child-migration-recovery-terminal@7", I> & {
  readonly [runtimeChildMigrationRecoveryTerminalBrandV7]: never;
  readonly recoveryAuthority: A;
  readonly recoveryLease: L;
  readonly recoveryIntent: I;
  readonly interruptedTerminal: T;
  readonly predecessorRecoveryCursorRevision: A["recoveryCursorRevision"];
  readonly exactVerifiedOrExecutedStepSuffix: A["exactMissingStepSuffix"];
  readonly rawRecoveryEvidence: NonEmptyReadonly<ImportedOpaqueEvidenceLeafReceipt>;
  readonly authorityReleases: ExactLeaseAuthorityReleaseTuple<L>;
  readonly provesEveryRecoveryLeaseAuthorityWasReleasedExactlyOnceAtThisTerminal: true;
  readonly provesObservedProgressAndAnyNextSuffixAreTheExactAuthorizedPrefixSuffixPartition: true;
  readonly recoveryCursorSingleSuccessorCasCommitted: true;
} &
  (
    | {
        readonly outcome: "recovered_completed";
        readonly resultingState: RuntimeChildRegistryMigrationNextStateV7<S, O>;
        readonly bothRequiredStoresDurableBeforePermit: true;
        readonly unresolvedStepCount: 0;
      }
    | {
        readonly outcome: "still_interrupted";
        readonly resultingState: S;
        readonly nextMissingStepSuffix: NonEmptyReadonly<RuntimeChildRegistryMigrationKillPointV7>;
      }
    | {
        readonly outcome: "recovery_quarantined";
        readonly resultingState: S;
        readonly quarantineEvidence: ImportedOpaqueEvidenceLeafReceipt;
        readonly processSignalSpawnDeletePermitAndAuthorityAdvanceCount: 0;
      }
  );

declare function commitRuntimeChildRegistryMigrationRecoveryTerminalV7<
  const S extends RuntimeChildRegistryMigrationStateV5,
  const O extends RuntimeChildRegistryMigrationOperationByStateV7[S],
  const T extends Extract<RuntimeChildRegistryMigrationOperationTerminalV7<S, O>, { readonly outcome: "retryable_interrupted" }>,
  const A extends RuntimeChildRegistryMigrationRecoveryAuthorityV7<
    S,
    O,
    T,
    ReceiptRef<"receipt:runtime-child-migration-recovery-terminal@7"> | null
  >,
  const L extends RuntimeChildRegistryMigrationRecoveryLeaseV7<S, O, T, A>,
  const I extends RuntimeChildRegistryMigrationRecoveryIntentV7<S, O, T, A, L>,
>(input: DistributiveOmitV1<
  RuntimeChildRegistryMigrationRecoveryTerminalV7<S, O, T, A, L, I>,
  keyof ReceiptRef | typeof runtimeChildMigrationRecoveryTerminalBrandV7
>): DeepFrozenCommittedReceiptV1<RuntimeChildRegistryMigrationRecoveryTerminalV7<S, O, T, A, L, I>>;

declare function issueRuntimeChildRegistryMigrationSuccessorRecoveryAuthorityV7<
  const S extends RuntimeChildRegistryMigrationStateV5,
  const O extends RuntimeChildRegistryMigrationOperationByStateV7[S],
  const T extends Extract<RuntimeChildRegistryMigrationOperationTerminalV7<S, O>, { readonly outcome: "retryable_interrupted" }>,
  const R extends Extract<RuntimeChildRegistryMigrationRecoveryTerminalV7<S, O, T>, { readonly outcome: "still_interrupted" }>,
>(input: {
  readonly priorRecoveryTerminal: R;
  readonly currentWriterLease: ReferenceMonitorWriterLeaseReceipt;
  readonly exactObservedStoreAndPermitState: ImportedOpaqueEvidenceLeafReceipt;
}): DeepFrozenCommittedReceiptV1<RuntimeChildRegistryMigrationRecoveryAuthorityV7<S, O, T, R>>;

type RuntimeChildRegistryMigrationAdvanceEvidenceV7<
  S extends RuntimeChildRegistryMigrationStateV5,
  O extends RuntimeChildRegistryMigrationOperationByStateV7[S],
> =
  | Extract<RuntimeChildRegistryMigrationOperationTerminalV7<S, O>, { readonly outcome: "completed" }>
  | Extract<
      RuntimeChildRegistryMigrationRecoveryTerminalV7<
        S,
        O,
        Extract<RuntimeChildRegistryMigrationOperationTerminalV7<S, O>, { readonly outcome: "retryable_interrupted" }>,
        RuntimeChildRegistryMigrationRecoveryAuthorityV7<
          S,
          O,
          Extract<RuntimeChildRegistryMigrationOperationTerminalV7<S, O>, { readonly outcome: "retryable_interrupted" }>,
          ReceiptRef<"receipt:runtime-child-migration-recovery-terminal@7"> | null
        >
      >,
      { readonly outcome: "recovered_completed" }
    >;

type RuntimeChildRegistryMigrationSuccessorCursorV7<
  S extends RuntimeChildRegistryMigrationStateV5 = RuntimeChildRegistryMigrationStateV5,
  O extends RuntimeChildRegistryMigrationOperationByStateV7[S] = RuntimeChildRegistryMigrationOperationByStateV7[S],
> = RuntimeChildRegistryMigrationCursorReceiptV5 & {
  readonly [runtimeChildMigrationSuccessorCursorBrandV7]: never;
  readonly state: RuntimeChildRegistryMigrationNextStateV7<S, O>;
  readonly predecessorCursor: RuntimeChildRegistryMigrationCursorReceiptV5 & { readonly state: S };
  readonly predecessorAdvanceEvidence: RuntimeChildRegistryMigrationAdvanceEvidenceV7<S, O>;
  readonly provesOnePredecessorRevisionHasExactlyOneCursorSuccessorAndStateMatchesTheTransitionTable: true;
};

declare function commitRuntimeChildRegistryMigrationSuccessorV7<
  const S extends RuntimeChildRegistryMigrationStateV5,
  const O extends RuntimeChildRegistryMigrationOperationByStateV7[S],
>(input: {
  readonly predecessorCursor: RuntimeChildRegistryMigrationCursorReceiptV5 & { readonly state: S };
  readonly advanceEvidence: RuntimeChildRegistryMigrationAdvanceEvidenceV7<S, O>;
  readonly currentWriterLease: ReferenceMonitorWriterLeaseReceipt;
}): DeepFrozenCommittedReceiptV1<RuntimeChildRegistryMigrationSuccessorCursorV7<S, O>>;

interface LegacyRuntimeChildQuarantineSubjectReceiptV7<
  I extends LegacyRuntimeChildInventoryLiftReceiptV6 = LegacyRuntimeChildInventoryLiftReceiptV6,
  N extends number = number,
  Q extends Extract<
    I["orderedLiftResults"][N],
    { readonly outcome: "unliftable_quarantined" }
  > = Extract<I["orderedLiftResults"][N], { readonly outcome: "unliftable_quarantined" }>,
> extends ReceiptRef<
  "receipt:legacy-runtime-child-quarantine-subject@7",
  readonly [ExactReceiptPointerForV20<I>, N, Q]
> {
  readonly [legacyRuntimeChildQuarantineSubjectBrandV7]: never;
  readonly inventoryLift: I;
  readonly quarantinedResult: Q;
  readonly exactOrderedLiftResultIndex: N;
  readonly provesResultIsTheExactIndexedMemberOfTheCommittedInventoryLift: true;
}

declare function commitLegacyRuntimeChildQuarantineSubjectV7<
  const I extends LegacyRuntimeChildInventoryLiftReceiptV6,
  const N extends number,
  const Q extends Extract<
    I["orderedLiftResults"][N],
    { readonly outcome: "unliftable_quarantined" }
  >,
>(input: {
  readonly inventoryLift: I;
  readonly quarantinedResult: Q;
  readonly exactOrderedLiftResultIndex: N;
  readonly exactCanonicalIndexedMemberEqualityVerifier: ImportedOpaqueEvidenceLeafReceipt;
  readonly provesResultIsTheExactIndexedMemberOfTheCommittedInventoryLift: true;
}): DeepFrozenCommittedReceiptV1<LegacyRuntimeChildQuarantineSubjectReceiptV7<I, N, Q>>;

type RuntimeChildQuarantineSubjectV7 =
  | LegacyRuntimeChildQuarantineSubjectReceiptV7
  | Extract<RuntimeChildRegistryMigrationOperationTerminalV7, { readonly outcome: "quarantined" }>
  | Extract<RuntimeChildRegistryMigrationRecoveryTerminalV7, { readonly outcome: "recovery_quarantined" }>;

interface RuntimeChildQuarantineOperatorDecisionReceiptV7<
  Q extends RuntimeChildQuarantineSubjectV7 = RuntimeChildQuarantineSubjectV7,
> extends ReceiptRef<
  "receipt:runtime-child-quarantine-operator-decision@7",
  Q
> {
  readonly [runtimeChildQuarantineOperatorDecisionBrandV7]: never;
  readonly quarantinedSubject: Q;
  readonly localControlSession: LocalControlSessionReceipt;
  readonly immutableProposal: ReceiptRef<"receipt:runtime-child-quarantine-resolution-proposal@7">;
  readonly renderedDisclosure: ReceiptRef<"receipt:runtime-child-quarantine-resolution-disclosure@7">;
  readonly acceptedDecision: AcceptedUserDecisionReceipt;
  readonly decisionConsumption: UserDecisionConsumptionCommitReceipt;
  readonly actionNonceDigest: string;
  readonly decision: "permanently_block_and_archive_without_signal";
  readonly exactQuarantineProposalDisclosureDecisionConsumptionSessionNonceAndExpiry: true;
}

declare function commitRuntimeChildQuarantineOperatorDecisionV7<
  const Q extends RuntimeChildQuarantineSubjectV7,
>(input: Omit<
  RuntimeChildQuarantineOperatorDecisionReceiptV7<Q>,
  keyof ReceiptRef | typeof runtimeChildQuarantineOperatorDecisionBrandV7
>): DeepFrozenCommittedReceiptV1<RuntimeChildQuarantineOperatorDecisionReceiptV7<Q>>;

interface RuntimeChildQuarantineNaturalExitObservationReceiptV7<
  Q extends RuntimeChildQuarantineSubjectV7 = RuntimeChildQuarantineSubjectV7,
> extends ReceiptRef<"receipt:runtime-child-quarantine-natural-exit-observation@7", Q> {
  readonly [runtimeChildQuarantineNaturalExitBrandV7]: never;
  readonly quarantinedSubject: Q;
  readonly currentWriterLease: ReferenceMonitorWriterLeaseReceipt;
  readonly independentProcessInventoryObservation: ImportedOpaqueEvidenceLeafReceipt;
  readonly observedProcessBirthOrLegacyRecordIdentityDigest: string;
  readonly signalAttemptCount: 0;
  readonly processIdentityAbsentAtTwoMonotonicObservations: true;
  readonly provesObservationSubjectEqualsTheExactQuarantineSubject: true;
}

declare function commitRuntimeChildQuarantineNaturalExitObservationV7<
  const Q extends RuntimeChildQuarantineSubjectV7,
>(input: Omit<
  RuntimeChildQuarantineNaturalExitObservationReceiptV7<Q>,
  keyof ReceiptRef | typeof runtimeChildQuarantineNaturalExitBrandV7
>): DeepFrozenCommittedReceiptV1<RuntimeChildQuarantineNaturalExitObservationReceiptV7<Q>>;

type RuntimeChildQuarantineResolutionReceiptV7<
  Q extends RuntimeChildQuarantineSubjectV7 = RuntimeChildQuarantineSubjectV7,
> = ReceiptRef<
  "receipt:runtime-child-quarantine-resolution@7",
  Q
> & {
  readonly [runtimeChildQuarantineResolutionBrandV7]: never;
  readonly quarantinedLiftOrMigrationTerminal: Q;
  readonly signalOrUnverifiedDeleteCount: 0;
  readonly exactQuarantineResolutionRecordCommittedOnce: true;
} &
  (
    | {
        readonly disposition: "independently_observed_process_natural_exit";
        readonly naturalExitEvidence: RuntimeChildQuarantineNaturalExitObservationReceiptV7<Q>;
        readonly operatorDecision?: never;
        readonly provesProcessBirthIdentityIsAbsentWithoutSendingASignal: true;
        readonly exactQuarantineEntryTombstonedAfterNaturalExitOnce: true;
      }
    | {
        readonly disposition: "operator_approved_permanent_block_and_archive_without_signal";
        readonly naturalExitEvidence?: never;
        readonly operatorDecision: RuntimeChildQuarantineOperatorDecisionReceiptV7<Q>;
        readonly provesOperatorDecisionSubjectEqualsTheExactQuarantineSubject: true;
        readonly exactPermanentDenyTombstoneAndArchiveCommittedOnce: true;
        readonly migrationCanAdvanceButNoSignalDeleteSpawnOrLifecycleAuthorityCanEverBeIssuedForThisIdentity: true;
      }
  );

declare function commitRuntimeChildQuarantineResolutionV7<
  const Q extends RuntimeChildQuarantineSubjectV7,
>(input: DistributiveOmitV1<
  RuntimeChildQuarantineResolutionReceiptV7<Q>,
  keyof ReceiptRef | typeof runtimeChildQuarantineResolutionBrandV7
>): DeepFrozenCommittedReceiptV1<RuntimeChildQuarantineResolutionReceiptV7<Q>>;

type RuntimeChildMigrationOperationKillOracleReceiptV9<
  S extends RuntimeChildRegistryMigrationStateV5,
  O extends RuntimeChildRegistryMigrationOperationByStateV7[S],
  K extends RuntimeChildMigrationStepV9<S, O>,
> = ReceiptRef<"receipt:runtime-child-migration-operation-kill-oracle@9", readonly [S, O, K]> & {
  readonly [runtimeChildMigrationKillOracleBrandV9]: never;
  readonly predecessorState: S;
  readonly operation: O;
  readonly killPoint: K;
  readonly exactLiteralStepSequence: RuntimeChildMigrationStepTupleV9<S, O>;
  readonly injectedCrashEvidence: ImportedOpaqueEvidenceLeafReceipt;
  readonly interruptedTerminal: RuntimeChildRegistryMigrationOperationTerminalV7<S, O> & {
    readonly outcome: "retryable_interrupted" | "quarantined";
    readonly interruptedAt: K;
  };
  readonly uniqueRecoverySuccessor: RuntimeChildRegistryMigrationRecoveryTerminalV7<S, O> | RuntimeChildQuarantineResolutionReceiptV7;
  readonly duplicateOperationStartCount: 0;
  readonly unsafePermitSignalDeleteOrAuthorityAdvanceCount: 0;
  readonly provesThisExactOperationKillPairHasOneSafeDurableSuccessor: true;
};

type RuntimeChildMigrationOperationKillOracleMatrixV9 = {
  readonly [S in RuntimeChildRegistryMigrationStateV5]: {
    readonly [O in RuntimeChildRegistryMigrationOperationByStateV7[S]]: {
      readonly [K in RuntimeChildMigrationStepV9<S, O>]:
        RuntimeChildMigrationOperationKillOracleReceiptV9<S, O, K>;
    };
  };
};

declare function commitRuntimeChildMigrationOperationKillOracleV9<
  const S extends RuntimeChildRegistryMigrationStateV5,
  const O extends RuntimeChildRegistryMigrationOperationByStateV7[S],
  const K extends RuntimeChildMigrationStepV9<S, O>,
>(input: Omit<
  RuntimeChildMigrationOperationKillOracleReceiptV9<S, O, K>,
  keyof ReceiptRef | typeof runtimeChildMigrationKillOracleBrandV9
>): DeepFrozenCommittedReceiptV1<RuntimeChildMigrationOperationKillOracleReceiptV9<S, O, K>>;

type RuntimeChildRegistryMigrationClosureLedgerEntryV7 =
  | RuntimeChildRegistryMigrationOperationTerminalV7
  | RuntimeChildRegistryMigrationRecoveryTerminalV7
  | RuntimeChildRegistryMigrationSuccessorCursorV7
  | RuntimeChildQuarantineResolutionReceiptV7;

interface RuntimeChildRegistryMigrationCompletionReceiptV7 extends ReceiptRef<
  "receipt:runtime-child-registry-migration-completion@7"
> {
  readonly [runtimeChildMigrationCompletionBrandV7]: never;
  readonly exactTransitionTable: typeof RUNTIME_CHILD_REGISTRY_MIGRATION_TRANSITION_TABLE_V7;
  readonly genesisCursor: RuntimeChildRegistryMigrationCursorReceiptV5 & { readonly state: "legacy_json_only" };
  readonly terminalCursor: RuntimeChildRegistryMigrationSuccessorCursorV7<
    "sqlite_authoritative_dual_write",
    "advance_sqlite_only"
  > & { readonly state: "sqlite_only" };
  readonly fullOperationAndRecoveryLedger: NonEmptyReadonly<RuntimeChildRegistryMigrationClosureLedgerEntryV7>;
  readonly exactClosureLedgerDigest: string;
  readonly stateTransitionAndSameStateOperationEvidence: NonEmptyReadonly<RuntimeChildRegistryMigrationSuccessorCursorV7<RuntimeChildRegistryMigrationStateV5, RuntimeChildRegistryMigrationOperationByStateV7[RuntimeChildRegistryMigrationStateV5]>>;
  readonly rollbackAndReestablishAuthorityEvidence: NonEmptyReadonly<ImportedOpaqueEvidenceLeafReceipt>;
  readonly legacyProjectionCleanupTerminals: readonly RuntimeChildRegistryMigrationOperationTerminalV7<"sqlite_only", "cleanup_legacy_projection">[];
  readonly quarantineResolutions: readonly RuntimeChildQuarantineResolutionReceiptV7[];
  readonly killPointCorpus: { readonly [K in RuntimeChildRegistryMigrationKillPointV7]: ImportedOpaqueEvidenceLeafReceipt };
  readonly exactOperationByKillPointOracle: RuntimeChildMigrationOperationKillOracleMatrixV9;
  readonly sqliteOnlyCutoverPrerequisites: RuntimeChildMigrationPrerequisiteTupleV9<
    "sqlite_authoritative_dual_write",
    "advance_sqlite_only",
    RuntimeChildRegistryMigrationCursorReceiptV5 & { readonly state: "sqlite_authoritative_dual_write" }
  >;
  readonly provesSqliteOnlyCutoverPrerequisitesEqualTheExactAdvanceLeasePrerequisites: true;
  readonly everyKillPointHasExactlyOneSafeRecoverySuccessor: true;
  readonly everyRecoverableRunEventuallyReachedSqliteOnlyUnderFairRetry: true;
  readonly oldWriterMutationPermitSignalDeleteOrAuthorityAdvanceCount: 0;
  readonly unverifiedSignalOrDeleteCount: 0;
  readonly unresolvedNonQuarantinedJournalCount: 0;
  readonly provesEveryLeaseIntentTerminalRecoverySuccessorAndQuarantineSubjectHasExactlyOneTypedClosurePath: true;
  readonly provesLiftShadowReconcileDualWriteRepairCutoverRollbackDowngradeCleanupAndQuarantineResolutionAllUseTheSameTypedStateMachine: true;
}

declare function commitRuntimeChildRegistryMigrationCompletionV7(input: {
  readonly transitionTable: typeof RUNTIME_CHILD_REGISTRY_MIGRATION_TRANSITION_TABLE_V7;
  readonly genesisCursor: RuntimeChildRegistryMigrationCursorReceiptV5 & { readonly state: "legacy_json_only" };
  readonly terminalCursor: RuntimeChildRegistryMigrationSuccessorCursorV7<"sqlite_authoritative_dual_write", "advance_sqlite_only">;
  readonly fullOperationAndRecoveryLedger: NonEmptyReadonly<RuntimeChildRegistryMigrationClosureLedgerEntryV7>;
  readonly killPointCorpus: { readonly [K in RuntimeChildRegistryMigrationKillPointV7]: ImportedOpaqueEvidenceLeafReceipt };
  readonly exactOperationByKillPointOracle: RuntimeChildMigrationOperationKillOracleMatrixV9;
  readonly sqliteOnlyCutoverPrerequisites: RuntimeChildMigrationPrerequisiteTupleV9<
    "sqlite_authoritative_dual_write",
    "advance_sqlite_only",
    RuntimeChildRegistryMigrationCursorReceiptV5 & { readonly state: "sqlite_authoritative_dual_write" }
  >;
  readonly quarantineResolutions: readonly RuntimeChildQuarantineResolutionReceiptV7[];
}): DeepFrozenCommittedReceiptV1<RuntimeChildRegistryMigrationCompletionReceiptV7>;
