'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Tournament, Player, MatchWithNames } from '@/lib/db';
import AdminBracketView from '@/components/AdminBracketView';

interface Props {
  activeTournament: Tournament | null;
  allTournaments: Tournament[];
  matches: MatchWithNames[];
  players: Player[];
}

export default function AdminDashboard({ activeTournament, matches, players }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [view, setView] = useState<'setup' | 'bracket'>('setup');

  // Create tournament form
  const [tournamentName, setTournamentName] = useState('');
  const [format, setFormat] = useState<string>('single_elim');
  const [swissRounds, setSwissRounds] = useState(4);
  const [playerNames, setPlayerNames] = useState('');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Winner modal
  const [winnerModal, setWinnerModal] = useState<MatchWithNames | null>(null);
  const [settingWinner, setSettingWinner] = useState(false);

  async function handleCreateTournament() {
    setCreateError('');
    setCreating(true);

    // Parse player names
    const names = playerNames
      .split(/[\n,]+/)
      .map((n) => n.trim())
      .filter(Boolean);

    if (names.length < 2) {
      setCreateError('Enter at least 2 player names.');
      setCreating(false);
      return;
    }

    if (!tournamentName.trim()) {
      setCreateError('Tournament name is required.');
      setCreating(false);
      return;
    }

    // Create tournament
    const tRes = await fetch('/api/tournament', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: tournamentName, format, swissRounds: format === 'swiss' ? swissRounds : undefined }),
    });

    if (!tRes.ok) {
      const data = await tRes.json();
      setCreateError(data.error || 'Failed to create tournament');
      setCreating(false);
      return;
    }

    const { id: tournamentId } = await tRes.json();

    // Add players
    const pRes = await fetch(`/api/tournament/${tournamentId}/players`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ names }),
    });

    if (!pRes.ok) {
      const data = await pRes.json();
      setCreateError(data.error || 'Failed to add players');
      setCreating(false);
      return;
    }

    setCreating(false);
    setGenerating(true);

    // Generate bracket
    const gRes = await fetch(`/api/tournament/${tournamentId}/generate`, { method: 'POST' });
    setGenerating(false);

    if (!gRes.ok) {
      const data = await gRes.json();
      setCreateError(data.error || 'Failed to generate bracket');
      return;
    }

    startTransition(() => router.refresh());
    setView('bracket');
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/admin/login');
  }

  async function handleMarkWinner(winnerId: number) {
    if (!winnerModal) return;
    setSettingWinner(true);

    const res = await fetch(`/api/matches/${winnerModal.id}/winner`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ winnerId }),
    });

    setSettingWinner(false);
    setWinnerModal(null);

    if (res.ok) {
      startTransition(() => router.refresh());
    }
  }

  async function handleCompleteTournament() {
    if (!activeTournament) return;
    const res = await fetch(`/api/tournament/${activeTournament.id}/complete`, { method: 'POST' });
    if (res.ok) {
      startTransition(() => router.refresh());
    }
  }

  const pendingMatches = matches.filter((m) => m.status !== 'complete' && m.player1_id && m.player2_id);
  const allMatchesDone = matches.length > 0 && matches.every((m) => m.status === 'complete');

  const formatLabel = {
    single_elim: 'Single Elimination',
    double_elim: 'Double Elimination',
    round_robin: 'Round Robin',
    swiss: 'Swiss',
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏓</span>
            <div>
              <h1 className="text-xl font-bold text-white">Ping Pong Tournament</h1>
              <p className="text-slate-400 text-sm">Admin Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a href="/" target="_blank" className="text-slate-400 hover:text-green-400 text-sm transition-colors">
              View Public Page →
            </a>
            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-red-400 text-sm transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Active tournament banner */}
        {activeTournament && (
          <div className="bg-green-900/30 border border-green-700/50 rounded-xl p-4 mb-6 flex items-center justify-between">
            <div>
              <span className="text-green-400 font-semibold">{activeTournament.name}</span>
              <span className="text-slate-400 ml-2 text-sm">
                {formatLabel[activeTournament.format]} · {activeTournament.status}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setView('setup')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === 'setup' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Setup
              </button>
              <button
                onClick={() => setView('bracket')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === 'bracket' ? 'bg-green-700 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Manage Bracket
              </button>
            </div>
          </div>
        )}

        {/* Setup view */}
        {view === 'setup' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Create Tournament */}
            <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
              <h2 className="text-lg font-semibold mb-4">
                {activeTournament ? 'Active Tournament Running' : 'Create New Tournament'}
              </h2>

              {activeTournament ? (
                <div className="text-slate-400 text-sm">
                  <p>A tournament is currently in progress. Complete or manage it from the bracket view.</p>
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between">
                      <span>Name:</span>
                      <span className="text-white">{activeTournament.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Format:</span>
                      <span className="text-white">{formatLabel[activeTournament.format]}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Players:</span>
                      <span className="text-white">{players.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Matches:</span>
                      <span className="text-white">{matches.length} total, {pendingMatches.length} pending</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setView('bracket')}
                    className="mt-4 w-full bg-green-700 hover:bg-green-600 text-white py-2 rounded-lg font-medium transition-colors"
                  >
                    Manage Bracket
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Tournament Name</label>
                    <input
                      value={tournamentName}
                      onChange={(e) => setTournamentName(e.target.value)}
                      placeholder="e.g. Spring Championship 2025"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Format</label>
                    <select
                      value={format}
                      onChange={(e) => setFormat(e.target.value)}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="single_elim">Single Elimination</option>
                      <option value="double_elim">Double Elimination</option>
                      <option value="round_robin">Round Robin</option>
                      <option value="swiss">Swiss System</option>
                    </select>
                  </div>

                  {format === 'swiss' && (
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Number of Rounds</label>
                      <input
                        type="number"
                        min={2}
                        max={12}
                        value={swissRounds}
                        onChange={(e) => setSwissRounds(Number(e.target.value))}
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Player Names (one per line or comma-separated)</label>
                    <textarea
                      value={playerNames}
                      onChange={(e) => setPlayerNames(e.target.value)}
                      rows={8}
                      placeholder="Alice&#10;Bob&#10;Charlie&#10;Diana"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500 font-mono text-sm"
                    />
                  </div>

                  {createError && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-red-400 text-sm">
                      {createError}
                    </div>
                  )}

                  <button
                    onClick={handleCreateTournament}
                    disabled={creating || generating}
                    className="w-full bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
                  >
                    {creating ? 'Creating...' : generating ? 'Generating Bracket...' : 'Generate Bracket'}
                  </button>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
              <h2 className="text-lg font-semibold mb-4">Format Guide</h2>
              <div className="space-y-4 text-sm text-slate-400">
                <div>
                  <h3 className="text-white font-medium mb-1">Single Elimination</h3>
                  <p>Each player is eliminated after one loss. Best for quick tournaments. Byes are handled automatically for non-power-of-2 player counts.</p>
                </div>
                <div>
                  <h3 className="text-white font-medium mb-1">Double Elimination</h3>
                  <p>Players must lose twice to be eliminated. Features a Winners Bracket and a Losers Bracket with a Grand Final.</p>
                </div>
                <div>
                  <h3 className="text-white font-medium mb-1">Round Robin</h3>
                  <p>Every player plays every other player once. Final standings determined by total wins.</p>
                </div>
                <div>
                  <h3 className="text-white font-medium mb-1">Swiss System</h3>
                  <p>Players are paired with others who have similar records. Configurable number of rounds. Great for large groups.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bracket management view */}
        {view === 'bracket' && activeTournament && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">{activeTournament.name} — Bracket</h2>
              {allMatchesDone && activeTournament.status !== 'complete' && (
                <button
                  onClick={handleCompleteTournament}
                  className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  Complete Tournament
                </button>
              )}
              {activeTournament.status === 'complete' && (
                <span className="bg-green-700/30 text-green-400 px-4 py-2 rounded-lg text-sm font-medium border border-green-700/50">
                  Tournament Complete
                </span>
              )}
            </div>

            <AdminBracketView
              matches={matches}
              players={players}
              tournament={activeTournament}
              onMarkWinner={(match) => setWinnerModal(match)}
            />
          </div>
        )}
      </main>

      {/* Winner Modal */}
      {winnerModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-sm border border-slate-700 shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-2">Mark Winner</h3>
            <p className="text-slate-400 text-sm mb-4">
              Round {winnerModal.round} · Match {winnerModal.match_number}
            </p>

            <div className="space-y-3">
              {winnerModal.player1_id && (
                <button
                  onClick={() => handleMarkWinner(winnerModal.player1_id!)}
                  disabled={settingWinner}
                  className="w-full bg-slate-700 hover:bg-green-700 text-white py-3 rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  {winnerModal.player1_name}
                </button>
              )}
              {winnerModal.player2_id && (
                <button
                  onClick={() => handleMarkWinner(winnerModal.player2_id!)}
                  disabled={settingWinner}
                  className="w-full bg-slate-700 hover:bg-green-700 text-white py-3 rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  {winnerModal.player2_name}
                </button>
              )}
            </div>

            <button
              onClick={() => setWinnerModal(null)}
              className="mt-4 w-full text-slate-500 hover:text-slate-300 py-2 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
