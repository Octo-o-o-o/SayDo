// §19：只存效果指纹和源端回执；个人正文不进入本账本。
export const PERSONAL_CONTEXT_DDL = `
CREATE TABLE personal_context_clock (
  singleton INTEGER PRIMARY KEY CHECK(singleton=1),
  high_water INTEGER NOT NULL CHECK(high_water>=0)
);
INSERT INTO personal_context_clock(singleton,high_water) VALUES(1,0);
CREATE TABLE personal_context_operations (
  installation_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  connection_id TEXT NOT NULL,
  connection_epoch INTEGER NOT NULL CHECK(connection_epoch>0),
  method TEXT NOT NULL CHECK(method IN ('compile/request','candidate/propose','event/ingest','request/respond')),
  operation_id TEXT NOT NULL,
  payload_digest TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('pending','unknown','applied','rejected','expired')),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  observed_at INTEGER NOT NULL,
  receipt_digest TEXT,
  PRIMARY KEY(installation_id,node_id,connection_id,connection_epoch,method,operation_id),
  CHECK(state!='applied' OR receipt_digest IS NOT NULL)
);
`;
