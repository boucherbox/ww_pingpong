import {
  createMatch,
  createPlayer,
  updateMatch,
  updateTournamentStatus,
  getMatches,
  getPlayers,
  deleteMatchesForTournament,
  getDb,
  type Player,
} from './db';

// ───────────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────────

function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function shuffleSeeded(players: Player[]): Player[] {
  // Sort seeded players first, unseeded shuffled at the end
  const seeded = players.filter((p) => p.seed !== null).sort((a, b) => (a.seed! - b.seed!));
  const unseeded = players.filter((p) => p.seed === null).sort(() => Math.random() - 0.5);
  return [...seeded, ...unseeded];
}

// Standard single-elim seeding positions (1 vs last, 2 vs second-to-last, etc.)
function buildBracketOrder(players: Player[], size: number): (Player | null)[] {
  const slots: (Player | null)[] = Array(size).fill(null);
  // Position mapping for standard tournament seeding
  const positions = getSeededPositions(size);
  for (let i = 0; i < players.length; i++) {
    slots[positions[i]] = players[i];
  }
  return slots;
}

function getSeededPositions(size: number): number[] {
  if (size === 1) return [0];
  const half = size / 2;
  const top = getSeededPositions(half);
  const bottom = top.map((p) => size - 1 - p);
  const result: number[] = [];
  for (let i = 0; i < top.length; i++) {
    result.push(top[i], bottom[i]);
  }
  return result;
}

// ───────────────────────────────────────────────────────────────────────────────
// Single Elimination
// ───────────────────────────────────────────────────────────────────────────────

export function generateSingleElim(tournamentId: number, players: Player[]): void {
  const ordered = shuffleSeeded(players);
  const size = nextPowerOf2(ordered.length);
  const slots = buildBracketOrder(ordered, size);

  const totalRounds = Math.log2(size);
  // Map: round -> match_number -> match DB id
  const matchMap: Map<string, number> = new Map();

  // Create all matches round by round
  for (let round = 1; round <= totalRounds; round++) {
    const matchesInRound = size / Math.pow(2, round);
    for (let m = 1; m <= matchesInRound; m++) {
      const id = createMatch({
        tournamentId,
        round,
        matchNumber: m,
        bracketSide: 'winners',
      });
      matchMap.set(`${round}-${m}`, id);
    }
  }

  // Wire up round 1 with players (byes handled automatically — null player = bye)
  for (let m = 1; m <= size / 2; m++) {
    const p1 = slots[(m - 1) * 2];
    const p2 = slots[(m - 1) * 2 + 1];
    const matchId = matchMap.get(`1-${m}`)!;

    if (p1 && !p2) {
      // Bye — p1 advances immediately with no opponent
      updateMatch(matchId, { player1Id: p1.id, player2Id: null, winnerId: p1.id, status: 'complete' });
    } else {
      updateMatch(matchId, { player1Id: p1?.id ?? null, player2Id: p2?.id ?? null });
    }
  }

  // Wire next_match_id links
  for (let round = 1; round < totalRounds; round++) {
    const matchesInRound = size / Math.pow(2, round);
    for (let m = 1; m <= matchesInRound; m++) {
      const currentId = matchMap.get(`${round}-${m}`)!;
      const nextMatchNum = Math.ceil(m / 2);
      const nextId = matchMap.get(`${round + 1}-${nextMatchNum}`)!;
      const slot = m % 2 === 1 ? 1 : 2;
      getDb().prepare('UPDATE match SET next_match_id = ?, next_match_slot = ? WHERE id = ?').run(nextId, slot, currentId);
    }
  }

  // Advance bye winners to round 2
  for (let m = 1; m <= size / 2; m++) {
    const matchId = matchMap.get(`1-${m}`)!;
    const match = getDb().prepare('SELECT * FROM match WHERE id = ?').get(matchId) as { winner_id: number | null; next_match_id: number | null; next_match_slot: number | null } | undefined;
    if (match?.winner_id && match.next_match_id) {
      advancePlayerToMatch(match.winner_id, match.next_match_id, match.next_match_slot as 1 | 2);
    }
  }

  updateTournamentStatus(tournamentId, 'active');
}

// ───────────────────────────────────────────────────────────────────────────────
// Double Elimination
// ───────────────────────────────────────────────────────────────────────────────

export function generateDoubleElim(tournamentId: number, players: Player[]): void {
  const ordered = shuffleSeeded(players);
  const size = nextPowerOf2(ordered.length);
  const slots = buildBracketOrder(ordered, size);
  const totalWinnerRounds = Math.log2(size);

  // Winners bracket matches: rounds 1..totalWinnerRounds
  // Losers bracket: roughly 2*(totalWinnerRounds-1) rounds
  // Grand final: 1 match (potentially 2 if losers bracket winner wins)

  const wMatchMap: Map<string, number> = new Map();
  const lMatchMap: Map<string, number> = new Map();

  // --- Winners bracket ---
  for (let r = 1; r <= totalWinnerRounds; r++) {
    const count = size / Math.pow(2, r);
    for (let m = 1; m <= count; m++) {
      const id = createMatch({ tournamentId, round: r, matchNumber: m, bracketSide: 'winners' });
      wMatchMap.set(`${r}-${m}`, id);
    }
  }

  // Round 1 players
  for (let m = 1; m <= size / 2; m++) {
    const p1 = slots[(m - 1) * 2];
    const p2 = slots[(m - 1) * 2 + 1];
    const matchId = wMatchMap.get(`1-${m}`)!;
    if (p1 && !p2) {
      updateMatch(matchId, { player1Id: p1.id, player2Id: null, winnerId: p1.id, status: 'complete' });
    } else {
      updateMatch(matchId, { player1Id: p1?.id ?? null, player2Id: p2?.id ?? null });
    }
  }

  // Wire winners bracket next_match links
  for (let r = 1; r < totalWinnerRounds; r++) {
    const count = size / Math.pow(2, r);
    for (let m = 1; m <= count; m++) {
      const cid = wMatchMap.get(`${r}-${m}`)!;
      const nextM = Math.ceil(m / 2);
      const nextId = wMatchMap.get(`${r + 1}-${nextM}`)!;
      const slot = m % 2 === 1 ? 1 : 2;
      getDb().prepare('UPDATE match SET next_match_id = ?, next_match_slot = ? WHERE id = ?').run(nextId, slot, cid);
    }
  }

  // --- Losers bracket ---
  // Structure: L rounds alternate between "drop-in" rounds (from W losers) and "consolidation" rounds
  // For n winners rounds, losers bracket has 2*(n-1) rounds
  const lRounds = 2 * (totalWinnerRounds - 1);

  for (let r = 1; r <= lRounds; r++) {
    // number of matches in each losers round
    const count = Math.max(1, size / Math.pow(2, Math.ceil(r / 2) + 1));
    for (let m = 1; m <= count; m++) {
      const id = createMatch({ tournamentId, round: r, matchNumber: m, bracketSide: 'losers' });
      lMatchMap.set(`${r}-${m}`, id);
    }
  }

  // Wire losers bracket next_match links (consolidation: losers of winners bracket -> odd losers rounds)
  for (let r = 1; r < lRounds; r++) {
    const count = Math.max(1, size / Math.pow(2, Math.ceil(r / 2) + 1));
    for (let m = 1; m <= count; m++) {
      const cid = lMatchMap.get(`${r}-${m}`)!;
      const nextM = r % 2 === 1 ? m : Math.ceil(m / 2);
      const nextId = lMatchMap.get(`${r + 1}-${nextM}`)!;
      const slot = (r % 2 === 1 || m % 2 === 1) ? 1 : 2;
      getDb().prepare('UPDATE match SET next_match_id = ?, next_match_slot = ? WHERE id = ?').run(nextId, slot, cid);
    }
  }

  // Feed W round 1 losers into L round 1
  {
    const wR1Count = size / 2;
    for (let m = 1; m <= wR1Count; m++) {
      const wId = wMatchMap.get(`1-${m}`)!;
      // Loser of w match m goes to losers round 1, match m
      // We store this association loosely — advancement logic reads it
      // For now just store drop references in DB meta via a convention
      getDb().prepare('UPDATE match SET next_match_id = ?, next_match_slot = ? WHERE id = ? AND winner_id IS NULL').run(
        null, null, wId
      );
    }
  }

  // Grand Final
  const gfId = createMatch({ tournamentId, round: totalWinnerRounds + lRounds + 1, matchNumber: 1, bracketSide: 'winners' });

  // Wire W final -> GF slot 1
  const wFinalId = wMatchMap.get(`${totalWinnerRounds}-1`)!;
  getDb().prepare('UPDATE match SET next_match_id = ?, next_match_slot = ? WHERE id = ?').run(gfId, 1, wFinalId);

  // Wire L final -> GF slot 2
  const lFinalId = lMatchMap.get(`${lRounds}-1`)!;
  getDb().prepare('UPDATE match SET next_match_id = ?, next_match_slot = ? WHERE id = ?').run(gfId, 2, lFinalId);

  // Advance bye winners
  for (let m = 1; m <= size / 2; m++) {
    const matchId = wMatchMap.get(`1-${m}`)!;
    const match = getDb().prepare('SELECT * FROM match WHERE id = ?').get(matchId) as { winner_id: number | null; next_match_id: number | null; next_match_slot: number | null } | undefined;
    if (match?.winner_id && match.next_match_id) {
      advancePlayerToMatch(match.winner_id, match.next_match_id, match.next_match_slot as 1 | 2);
    }
  }

  updateTournamentStatus(tournamentId, 'active');
}

// ───────────────────────────────────────────────────────────────────────────────
// Round Robin
// ───────────────────────────────────────────────────────────────────────────────

export function generateRoundRobin(tournamentId: number, players: Player[]): void {
  const n = players.length;
  // Use circle method to generate rounds
  const list = [...players];
  if (n % 2 !== 0) list.push({ id: -1, name: 'BYE', tournament_id: tournamentId, seed: null });

  const rounds = list.length - 1;
  const half = list.length / 2;

  let matchNum = 1;
  const fixed = list[0];
  const rotating = list.slice(1);

  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < half; i++) {
      const p1 = i === 0 ? fixed : rotating[i - 1];
      const p2 = rotating[rotating.length - i];
      if (p1.id === -1 || p2?.id === -1) {
        matchNum++;
        continue; // skip bye matches
      }
      const id = createMatch({
        tournamentId,
        round: r + 1,
        matchNumber: matchNum++,
        player1Id: p1.id,
        player2Id: p2?.id ?? null,
      });
      // Auto-complete if one is a bye
      void id;
    }
    // Rotate
    rotating.unshift(rotating.pop()!);
  }

  updateTournamentStatus(tournamentId, 'active');
}

// ───────────────────────────────────────────────────────────────────────────────
// Swiss
// ───────────────────────────────────────────────────────────────────────────────

export function generateSwiss(tournamentId: number, players: Player[], totalRounds: number): void {
  // Generate only round 1 — subsequent rounds are generated after each round completes
  generateSwissRound(tournamentId, players, 1, totalRounds);
  updateTournamentStatus(tournamentId, 'active');
}

export function generateSwissRound(
  tournamentId: number,
  players: Player[],
  round: number,
  _totalRounds: number
): void {
  // Calculate current standings
  const matches = getMatches(tournamentId);
  const wins: Map<number, number> = new Map();
  const opponents: Map<number, Set<number>> = new Map();

  for (const p of players) {
    wins.set(p.id, 0);
    opponents.set(p.id, new Set());
  }

  for (const m of matches) {
    if (m.status === 'complete' && m.winner_id) {
      wins.set(m.winner_id, (wins.get(m.winner_id) ?? 0) + 1);
      if (m.player1_id && m.player2_id) {
        opponents.get(m.player1_id)?.add(m.player2_id);
        opponents.get(m.player2_id)?.add(m.player1_id);
      }
    }
  }

  // Sort by wins descending, shuffle within same record
  const sorted = [...players].sort((a, b) => {
    const diff = (wins.get(b.id) ?? 0) - (wins.get(a.id) ?? 0);
    return diff !== 0 ? diff : Math.random() - 0.5;
  });

  // Pair adjacent players, avoiding rematches
  const paired = new Set<number>();
  const pairs: [Player, Player | null][] = [];

  for (let i = 0; i < sorted.length; i++) {
    if (paired.has(sorted[i].id)) continue;
    let found = false;
    for (let j = i + 1; j < sorted.length; j++) {
      if (paired.has(sorted[j].id)) continue;
      if (!opponents.get(sorted[i].id)?.has(sorted[j].id)) {
        pairs.push([sorted[i], sorted[j]]);
        paired.add(sorted[i].id);
        paired.add(sorted[j].id);
        found = true;
        break;
      }
    }
    if (!found) {
      // Pair with anyone available (rematch if necessary)
      for (let j = i + 1; j < sorted.length; j++) {
        if (!paired.has(sorted[j].id)) {
          pairs.push([sorted[i], sorted[j]]);
          paired.add(sorted[i].id);
          paired.add(sorted[j].id);
          found = true;
          break;
        }
      }
      if (!found) {
        // Bye
        pairs.push([sorted[i], null]);
        paired.add(sorted[i].id);
      }
    }
  }

  let matchNum = 1;
  for (const [p1, p2] of pairs) {
    const id = createMatch({
      tournamentId,
      round,
      matchNumber: matchNum++,
      player1Id: p1.id,
      player2Id: p2?.id ?? null,
    });
    if (!p2) {
      // Bye — auto win
      updateMatch(id, { winnerId: p1.id, status: 'complete' });
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// Bracket Advancement
// ───────────────────────────────────────────────────────────────────────────────

export function advancePlayerToMatch(playerId: number, matchId: number, slot: 1 | 2) {
  if (slot === 1) {
    updateMatch(matchId, { player1Id: playerId });
  } else {
    updateMatch(matchId, { player2Id: playerId });
  }
}

export function markWinner(
  matchId: number,
  winnerId: number,
  tournamentId: number
): { tournamentComplete: boolean; nextSwissRound?: boolean } {
  const db = getDb();
  const match = db.prepare('SELECT * FROM match WHERE id = ?').get(matchId) as {
    id: number;
    player1_id: number;
    player2_id: number;
    next_match_id: number | null;
    next_match_slot: number | null;
    bracket_side: string | null;
    round: number;
    tournament_id: number;
  } | undefined;

  if (!match) throw new Error('Match not found');

  const loserId = match.player1_id === winnerId ? match.player2_id : match.player1_id;

  updateMatch(matchId, { winnerId, status: 'complete' });

  // Advance winner to next match
  if (match.next_match_id && match.next_match_slot) {
    advancePlayerToMatch(winnerId, match.next_match_id, match.next_match_slot as 1 | 2);
  }

  // For double elim, route loser to losers bracket
  const tournament = db.prepare('SELECT * FROM tournament WHERE id = ?').get(tournamentId) as { format: string; swiss_rounds: number | null } | undefined;
  if (tournament?.format === 'double_elim' && loserId && match.bracket_side === 'winners') {
    routeLoserToLosersBracket(db, matchId, loserId, tournamentId, match.round);
  }

  // Check if tournament is complete
  const pendingMatches = db.prepare(
    "SELECT COUNT(*) as cnt FROM match WHERE tournament_id = ? AND status != 'complete'"
  ).get(tournamentId) as { cnt: number };

  if (pendingMatches.cnt === 0) {
    updateTournamentStatus(tournamentId, 'complete');
    return { tournamentComplete: true };
  }

  // Swiss: check if current round is complete and generate next round
  if (tournament?.format === 'swiss') {
    const allMatches = db.prepare('SELECT * FROM match WHERE tournament_id = ?').all(tournamentId) as { round: number; status: string }[];
    const maxRound = Math.max(...allMatches.map((m) => m.round));
    const currentRoundDone = allMatches.filter((m) => m.round === maxRound).every((m) => m.status === 'complete');
    const totalRounds = tournament.swiss_rounds ?? Math.ceil(Math.log2(getPlayers(tournamentId).length));

    if (currentRoundDone && maxRound < totalRounds) {
      const players = getPlayers(tournamentId);
      generateSwissRound(tournamentId, players, maxRound + 1, totalRounds);
      return { tournamentComplete: false, nextSwissRound: true };
    }

    if (currentRoundDone && maxRound >= totalRounds) {
      updateTournamentStatus(tournamentId, 'complete');
      return { tournamentComplete: true };
    }
  }

  return { tournamentComplete: false };
}

function routeLoserToLosersBracket(
  db: ReturnType<typeof getDb>,
  _winnerMatchId: number,
  loserId: number,
  tournamentId: number,
  winnerRound: number
) {
  // Find an open slot in the appropriate losers bracket round
  // Losers from winners round R go into losers round (2*R - 1) (drop-in rounds)
  const lRound = 2 * winnerRound - 1;
  const openMatch = db.prepare(`
    SELECT * FROM match
    WHERE tournament_id = ? AND bracket_side = 'losers' AND round = ?
    AND (player1_id IS NULL OR player2_id IS NULL)
    ORDER BY match_number ASC
    LIMIT 1
  `).get(tournamentId, lRound) as { id: number; player1_id: number | null; player2_id: number | null } | undefined;

  if (openMatch) {
    if (!openMatch.player1_id) {
      db.prepare('UPDATE match SET player1_id = ? WHERE id = ?').run(loserId, openMatch.id);
    } else {
      db.prepare('UPDATE match SET player2_id = ? WHERE id = ?').run(loserId, openMatch.id);
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// Main entry point
// ───────────────────────────────────────────────────────────────────────────────

export function generateBracket(tournamentId: number): void {
  const db = getDb();
  const tournament = db.prepare('SELECT * FROM tournament WHERE id = ?').get(tournamentId) as { format: string; swiss_rounds: number | null } | undefined;
  if (!tournament) throw new Error('Tournament not found');

  const players = getPlayers(tournamentId);
  if (players.length < 2) throw new Error('Need at least 2 players');

  // Clear existing matches
  deleteMatchesForTournament(tournamentId);

  switch (tournament.format) {
    case 'single_elim':
      generateSingleElim(tournamentId, players);
      break;
    case 'double_elim':
      generateDoubleElim(tournamentId, players);
      break;
    case 'round_robin':
      generateRoundRobin(tournamentId, players);
      break;
    case 'swiss': {
      const totalRounds = tournament.swiss_rounds ?? Math.ceil(Math.log2(players.length));
      generateSwiss(tournamentId, players, totalRounds);
      break;
    }
    default:
      throw new Error(`Unknown format: ${tournament.format}`);
  }
}
