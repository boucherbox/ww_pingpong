import { getActiveTournament, getAllTournaments, getMatches, getPlayers } from '@/lib/db';
import AdminDashboard from './AdminDashboard';

export const dynamic = 'force-dynamic';

export default function AdminPage() {
  const activeTournament = getActiveTournament();
  const allTournaments = getAllTournaments();
  const matches = activeTournament ? getMatches(activeTournament.id) : [];
  const players = activeTournament ? getPlayers(activeTournament.id) : [];

  return (
    <AdminDashboard
      activeTournament={activeTournament ?? null}
      allTournaments={allTournaments}
      matches={matches}
      players={players}
    />
  );
}
