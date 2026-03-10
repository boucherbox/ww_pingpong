import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticatedFromRequest } from '@/lib/auth';
import { createTournament, getActiveTournament, getAllTournaments } from '@/lib/db';

export async function GET() {
  const tournaments = getAllTournaments();
  return NextResponse.json(tournaments);
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticatedFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const active = getActiveTournament();
  if (active) {
    return NextResponse.json({ error: 'A tournament is already active' }, { status: 400 });
  }

  const body = await req.json();
  const { name, format, swissRounds } = body;

  if (!name || !format) {
    return NextResponse.json({ error: 'Name and format are required' }, { status: 400 });
  }

  const validFormats = ['single_elim', 'double_elim', 'round_robin', 'swiss'];
  if (!validFormats.includes(format)) {
    return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
  }

  const id = createTournament(name, format, swissRounds);
  return NextResponse.json({ id, success: true });
}
