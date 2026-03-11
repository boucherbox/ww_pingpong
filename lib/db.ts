import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'tournament.db');

// Ensure data directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tournament (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      format TEXT NOT NULL CHECK(format IN ('single_elim', 'double_elim', 'round_robin', 'swiss')),
      status TEXT NOT NULL DEFAULT 'setup' CHECK(status IN ('setup', 'active', 'complete')),
      swiss_rounds INTEGER DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS player (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL REFERENCES tournament(id),
      name TEXT NOT NULL,
      seed INTEGER DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS match (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL REFERENCES tournament(id),
      round INTEGER NOT NULL,
      match_number INTEGER NOT NULL,
      player1_id INTEGER REFERENCES player(id),
      player2_id INTEGER REFERENCES player(id),
      winner_id INTEGER REFERENCES player(id),
      bracket_side TEXT DEFAULT NULL CHECK(bracket_side IN ('winners', 'losers', NULL)),
      scheduled_time TEXT DEFAULT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'complete')),
      next_match_id INTEGER REFERENCES match(id),
      next_match_slot INTEGER DEFAULT NULL CHECK(next_match_slot IN (1, 2, NULL))
    );
  `);
}

// Tournament queries
export function getTournament(id: number) {
  return getDb().prepare('SELECT * FROM tournament WHERE id = ?').get(id) as Tournament | undefined;
}

export function getActiveTournament() {
  return getDb().prepare("SELECT * FROM tournament WHERE status != 'complete' ORDER BY id DESC LIMIT 1").get() as Tournament | undefined;
}

export function getAllTournaments() {
  return getDb().prepare('SELECT * FROM tournament ORDER BY created_at DESC').all() as Tournament[];
}

export function createTournament(name: string, format: string, swissRounds?: number) {
  const stmt = getDb().prepare(
    'INSERT INTO tournament (name, format, status, swiss_rounds) VALUES (?, ?, ?, ?)'
  );
  const result = stmt.run(name, format, 'setup', swissRounds ?? null);
  return result.lastInsertRowid as number;
}

export function updateTournamentStatus(id: number, status: string) {
  getDb().prepare('UPDATE tournament SET status = ? WHERE id = ?').run(status, id);
}

// Player queries
export function getPlayers(tournamentId: number) {
  return getDb().prepare('SELECT * FROM player WHERE tournament_id = ? ORDER BY seed ASC, id ASC').all(tournamentId) as Player[];
}

export function createPlayer(tournamentId: number, name: string, seed?: number) {
  const stmt = getDb().prepare('INSERT INTO player (tournament_id, name, seed) VALUES (?, ?, ?)');
  const result = stmt.run(tournamentId, name, seed ?? null);
  return result.lastInsertRowid as number;
}

// Match queries
export function getMatches(tournamentId: number) {
  return getDb().prepare(`
    SELECT m.*,
      p1.name as player1_name,
      p2.name as player2_name,
      pw.name as winner_name
    FROM match m
    LEFT JOIN player p1 ON m.player1_id = p1.id
    LEFT JOIN player p2 ON m.player2_id = p2.id
    LEFT JOIN player pw ON m.winner_id = pw.id
    WHERE m.tournament_id = ?
    ORDER BY m.round ASC, m.bracket_side ASC, m.match_number ASC
  `).all(tournamentId) as MatchWithNames[];
}

export function getMatch(id: number) {
  return getDb().prepare(`
    SELECT m.*,
      p1.name as player1_name,
      p2.name as player2_name,
      pw.name as winner_name
    FROM match m
    LEFT JOIN player p1 ON m.player1_id = p1.id
    LEFT JOIN player p2 ON m.player2_id = p2.id
    LEFT JOIN player pw ON m.winner_id = pw.id
    WHERE m.id = ?
  `).get(id) as MatchWithNames | undefined;
}

export function createMatch(data: {
  tournamentId: number;
  round: number;
  matchNumber: number;
  player1Id?: number | null;
  player2Id?: number | null;
  bracketSide?: string | null;
  nextMatchId?: number | null;
  nextMatchSlot?: number | null;
}) {
  const stmt = getDb().prepare(`
    INSERT INTO match (tournament_id, round, match_number, player1_id, player2_id, bracket_side, next_match_id, next_match_slot)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    data.tournamentId,
    data.round,
    data.matchNumber,
    data.player1Id ?? null,
    data.player2Id ?? null,
    data.bracketSide ?? null,
    data.nextMatchId ?? null,
    data.nextMatchSlot ?? null
  );
  return result.lastInsertRowid as number;
}

export function updateMatch(id: number, updates: Partial<{
  player1Id: number | null;
  player2Id: number | null;
  winnerId: number | null;
  status: string;
  scheduledTime: string | null;
}>) {
  const fields: string[] = [];
  const values: unknown[] = [];

  if ('player1Id' in updates) { fields.push('player1_id = ?'); values.push(updates.player1Id ?? null); }
  if ('player2Id' in updates) { fields.push('player2_id = ?'); values.push(updates.player2Id ?? null); }
  if ('winnerId' in updates) { fields.push('winner_id = ?'); values.push(updates.winnerId ?? null); }
  if ('status' in updates) { fields.push('status = ?'); values.push(updates.status); }
  if ('scheduledTime' in updates) { fields.push('scheduled_time = ?'); values.push(updates.scheduledTime ?? null); }

  if (fields.length === 0) return;
  values.push(id);
  getDb().prepare(`UPDATE match SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteMatchesForTournament(tournamentId: number) {
  getDb().prepare('DELETE FROM match WHERE tournament_id = ?').run(tournamentId);
}

export function deletePlayersForTournament(tournamentId: number) {
  getDb().prepare('DELETE FROM player WHERE tournament_id = ?').run(tournamentId);
}

// Types
export interface Tournament {
  id: number;
  name: string;
  format: 'single_elim' | 'double_elim' | 'round_robin' | 'swiss';
  status: 'setup' | 'active' | 'complete';
  swiss_rounds: number | null;
  created_at: string;
}

export interface Player {
  id: number;
  tournament_id: number;
  name: string;
  seed: number | null;
}

export interface Match {
  id: number;
  tournament_id: number;
  round: number;
  match_number: number;
  player1_id: number | null;
  player2_id: number | null;
  winner_id: number | null;
  bracket_side: 'winners' | 'losers' | null;
  scheduled_time: string | null;
  status: 'pending' | 'in_progress' | 'complete';
  next_match_id: number | null;
  next_match_slot: number | null;
}

export interface MatchWithNames extends Match {
  player1_name: string | null;
  player2_name: string | null;
  winner_name: string | null;
}
