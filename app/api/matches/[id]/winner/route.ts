import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticatedFromRequest } from '@/lib/auth';
import { markWinner } from '@/lib/bracket';
import { getMatch } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticatedFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const matchId = Number(id);
  const body = await req.json();
  const { winnerId } = body;

  const match = getMatch(matchId);
  if (!match) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  }

  if (winnerId !== match.player1_id && winnerId !== match.player2_id) {
    return NextResponse.json({ error: 'Winner must be one of the match players' }, { status: 400 });
  }

  try {
    const result = markWinner(matchId, winnerId, match.tournament_id);
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
