import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticatedFromRequest } from '@/lib/auth';
import { updateTournamentStatus, getDb } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticatedFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const tournamentId = Number(id);

  const pending = getDb()
    .prepare("SELECT COUNT(*) as cnt FROM match WHERE tournament_id = ? AND status != 'complete'")
    .get(tournamentId) as { cnt: number };

  if (pending.cnt > 0) {
    return NextResponse.json({ error: 'Not all matches are complete' }, { status: 400 });
  }

  updateTournamentStatus(tournamentId, 'complete');
  return NextResponse.json({ success: true });
}
