// `just backup` 入口:对 ~/.saydo 跑一次快照备份。
// 保留期读 [params].backup_retention_days，与每日定时备份口径一致。

import { existsSync } from "node:fs";
import { join } from "node:path";
import { createLogger } from "../obs/logger.js";
import { openDb } from "../storage/db.js";
import { ensureManagedWorkspaceRoot, saydoStateRoot } from "../projects/workspace.js";
import { backupRetentionDays, backupTranscriptPersistence } from "./config.js";
import {
  productionBaseSources,
  productionWorkspaceSourcesFromSnapshot,
  runSnapshotBackup
} from "./snapshot.js";

const saydoHome = saydoStateRoot();
ensureManagedWorkspaceRoot();
const log = createLogger({ dir: join(saydoHome, "logs"), name: "backup" });
const dbPath = join(saydoHome, "saydo.db");
if (!existsSync(dbPath)) throw new Error(`生产备份缺少 SQLite:${dbPath}`);
const db = openDb(dbPath);
const retentionDays = backupRetentionDays(saydoHome);

const result = await (async () => {
  try {
    return await runSnapshotBackup({
      backupRoot: join(saydoHome, "backups"),
      sources: productionBaseSources(saydoHome),
      sqlite: [{ db, destName: "saydo.db" }],
      resolveSources: (stagingDir) => productionWorkspaceSourcesFromSnapshot(stagingDir),
      requiredRoles: ["sqlite", "global_sessions"],
      transcriptPersistence: backupTranscriptPersistence(saydoHome),
      retentionDays
    });
  } finally {
    db.close();
  }
})();

log.info("snapshot backup done", {
  snapshotDir: result.snapshotDir,
  copied: result.copied.length,
  skipped: result.skipped.length,
  pruned: result.pruned.length
});
