/**
 * Seed script: creates a sample 8-player single-elimination tournament.
 * Run with: npx tsx scripts/seed.ts
 */

import path from 'path';
import fs from 'fs';

// Set up DB path before importing db module
process.env.DATABASE_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'tournament.db');

// Ensure data directory exists
const dbDir = path.dirname(process.env.DATABASE_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

import { createTournament, createPlayer } from '../lib/db';
import { generateBracket } from '../lib/bracket';

const PLAYERS = [
  'Alice Chen',
  'Bob Smith',
  'Carlos Rivera',
  'Diana Patel',
  'Erik Johnson',
  'Fatima Al-Zahra',
  'George Lee',
  'Hannah Kim',
];

async function seed() {
  console.log('Seeding database...\n');

  // Create tournament
  const tournamentId = createTournament('Dev Seed Tournament', 'single_elim');
  console.log(`Created tournament ID: ${tournamentId}`);

  // Add players with seeds
  for (let i = 0; i < PLAYERS.length; i++) {
    const playerId = createPlayer(tournamentId, PLAYERS[i], i + 1);
    console.log(`  Player ${i + 1}: ${PLAYERS[i]} (ID: ${playerId})`);
  }

  // Generate bracket
  generateBracket(tournamentId);
  console.log('\nBracket generated!');
  console.log('\nRun `npm run dev` to start the server.');
  console.log('Admin login: http://localhost:3000/admin/login');
  console.log('Public view: http://localhost:3000');
  console.log(`\nUsername: ${process.env.ADMIN_USERNAME || 'admin'}`);
  console.log(`Password: ${process.env.ADMIN_PASSWORD || 'admin123'}`);
}

seed().catch(console.error);
