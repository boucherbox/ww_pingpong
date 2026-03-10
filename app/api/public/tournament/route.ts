import { NextResponse } from 'next/server';
import { getActiveTournament, getMatches, getPlayers } from '@/lib/db';

export async function GET() {
  const tournament = getActiveTournament();
  if (!tournament) {
    return NextResponse.json({ tournament: null, matches: [], players: [] });
  }

  const matches = getMatches(tournament.id);
  const players = getPlayers(tournament.id);

  return NextResponse.json({ tournament, matches, players });
}
