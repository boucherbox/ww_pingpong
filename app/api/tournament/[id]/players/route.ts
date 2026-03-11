import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticatedFromRequest } from '@/lib/auth';
import { getPlayers, createPlayer } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const players = getPlayers(Number(id));
  return NextResponse.json(players);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticatedFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { names } = body; // array of strings

  if (!Array.isArray(names) || names.length < 2) {
    return NextResponse.json({ error: 'At least 2 player names required' }, { status: 400 });
  }

  const ids: number[] = [];
  names.forEach((name: string, index: number) => {
    const playerId = createPlayer(Number(id), name.trim(), index + 1);
    ids.push(playerId);
  });

  return NextResponse.json({ ids, success: true });
}
