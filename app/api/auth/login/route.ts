import { NextRequest, NextResponse } from 'next/server';
import { checkCredentials, createSessionToken, setSessionCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { username, password } = body;

  if (!checkCredentials(username, password)) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const token = await createSessionToken();
  await setSessionCookie(token);

  return NextResponse.json({ success: true });
}
