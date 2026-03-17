import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";

const DB_RELATIVE_PATH = path.join("state", "actions.sqlite");

export function openDatabase(): Database.Database {
  const dbDir = path.join(process.cwd(), "state");
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = path.join(process.cwd(), DB_RELATIVE_PATH);
  const db = new Database(dbPath);
  db.defaultSafeIntegers(true);

  db.pragma("journal_mode = WAL");

  // NOTE: This initializer assumes a fresh DB (delete `state/actions.sqlite` to reset).
  // We keep no migrations here to avoid complexity.
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      tx_id TEXT PRIMARY KEY,
      block_number INTEGER NOT NULL,
      tx_origin TEXT NOT NULL,
      paid_vtho_raw INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS relayer_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      round_id INTEGER NOT NULL,
      relayer TEXT NOT NULL,
      action_count INTEGER NOT NULL,
      weight INTEGER NOT NULL,
      tx_id TEXT NOT NULL,
      gas_paid_raw INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_relayer_actions_round
      ON relayer_actions (round_id);
    CREATE INDEX IF NOT EXISTS idx_relayer_actions_relayer_round
      ON relayer_actions (relayer, round_id);

    CREATE TABLE IF NOT EXISTS voting_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      round_id INTEGER NOT NULL,
      voter TEXT NOT NULL,
      skipped INTEGER NOT NULL,
      tx_id TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_voting_events_round
      ON voting_events (round_id);
    CREATE INDEX IF NOT EXISTS idx_voting_events_round_voter
      ON voting_events (round_id, voter);

    CREATE TABLE IF NOT EXISTS claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      round_id INTEGER NOT NULL,
      relayer TEXT NOT NULL,
      voter TEXT NOT NULL,
      tx_id TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_claims_round
      ON claims (round_id);
    CREATE INDEX IF NOT EXISTS idx_claims_relayer_round
      ON claims (relayer, round_id);

    CREATE TABLE IF NOT EXISTS reduced_users_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      round_id INTEGER NOT NULL,
      user_count INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_reduced_users_round
      ON reduced_users_events (round_id);

    CREATE TABLE IF NOT EXISTS relayer_rewards_claimed (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      round_id INTEGER NOT NULL,
      relayer TEXT NOT NULL,
      amount_raw INTEGER NOT NULL,
      tx_id TEXT,
      block_number INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_relayer_rewards_claimed_round
      ON relayer_rewards_claimed (round_id);
    CREATE INDEX IF NOT EXISTS idx_relayer_rewards_claimed_block
      ON relayer_rewards_claimed (block_number);

    CREATE TABLE IF NOT EXISTS relayer_claimable_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      round_id INTEGER NOT NULL,
      relayer TEXT NOT NULL,
      claimable_raw INTEGER NOT NULL,
      UNIQUE (round_id, relayer)
    );

    CREATE TABLE IF NOT EXISTS rounds (
      round_id INTEGER PRIMARY KEY,
      snapshot_block INTEGER,
      deadline_block INTEGER,
      is_round_ended INTEGER,
      rewards_snapshot_finalized INTEGER,
      last_rewards_snapshot_at TEXT,
      num_relayers INTEGER,
      auto_voting_users_count INTEGER,
      contract_auto_voting_users_count INTEGER,
      reduced_users_count INTEGER,
      expected_actions INTEGER,
      completed_actions INTEGER,
      missed_users_count INTEGER,
      total_relayer_rewards_raw INTEGER,
      estimated_relayer_rewards_raw INTEGER
    );
  `);

  return db;
}

export function getMeta(db: Database.Database, key: string): string | null {
  const row = db
    .prepare("SELECT value FROM meta WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setMeta(
  db: Database.Database,
  key: string,
  value: string,
): void {
  db.prepare(
    "INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)",
  ).run(key, value);
}

