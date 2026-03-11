'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tournament, Player, MatchWithNames } from '@/lib/db';
import BracketTree from './BracketTree';
import Leaderboard from './Leaderboard';

interface TournamentData {
  tournament: Tournament | null;
  matches: MatchWithNames[];
  players: Player[];
}

type Tab = 'bracket' | 'schedule' | 'leaderboard';

export default function PublicView() {
  const [data, setData] = useState<TournamentData>({ tournament: null, matches: [], players: [] });
  const [tab, setTab] = useState<Tab>('bracket');
  const [loading, setLoading] = useState(true);

  // Schedule filter state
  const [filterRound, setFilterRound] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const fetchData = useCallback(async () => {
    const res = await fetch('/api/public/tournament', { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      setData(json);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const { tournament, matches, players } = data;

  const statusColor = {
    setup: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
    active: 'text-green-400 bg-green-400/10 border-green-400/30',
    complete: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  };

  const statusLabel = {
    setup: 'Setting Up',
    active: 'In Progress',
    complete: 'Complete',
  };

  const formatLabel: Record<string, string> = {
    single_elim: 'Single Elimination',
    double_elim: 'Double Elimination',
    round_robin: 'Round Robin',
    swiss: 'Swiss System',
  };

  // Current round info
  const currentRound = matches.length > 0
    ? Math.min(...matches.filter((m) => m.status !== 'complete').map((m) => m.round).filter((r) => r > 0))
    : 0;
  const maxRound = matches.length > 0 ? Math.max(...matches.map((m) => m.round)) : 0;

  // Schedule filter
  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
  const filteredMatches = matches.filter((m) => {
    if (filterRound !== 'all' && m.round !== Number(filterRound)) return false;
    if (filterStatus !== 'all' && m.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🏓</span>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {tournament?.name || 'Ping Pong Tournament'}
                </h1>
                {tournament && (
                  <p className="text-slate-400 text-sm mt-0.5">
                    {formatLabel[tournament.format]}
                    {tournament.status === 'active' && currentRound > 0 && isFinite(currentRound) && (
                      <span className="ml-2">· Round {currentRound} of {maxRound} in progress</span>
                    )}
                  </p>
                )}
              </div>
            </div>
            {tournament && (
              <div className={`self-start sm:self-auto px-3 py-1 rounded-full text-sm font-medium border ${statusColor[tournament.status]}`}>
                {statusLabel[tournament.status]}
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-6">
            {(['bracket', 'schedule', 'leaderboard'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                  tab === t
                    ? 'bg-green-700 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                {t === 'bracket' ? 'Live Bracket' : t === 'schedule' ? 'Match Schedule' : 'Leaderboard'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-slate-400">Loading tournament data...</div>
          </div>
        ) : !tournament ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="text-6xl mb-4">🏓</div>
            <h2 className="text-2xl font-bold text-white mb-2">No Active Tournament</h2>
            <p className="text-slate-400">Check back soon or visit the admin dashboard to create one.</p>
          </div>
        ) : (
          <>
            {/* Bracket Tab */}
            {tab === 'bracket' && (
              <BracketTree
                matches={matches}
                tournament={tournament}
                currentRound={currentRound}
              />
            )}

            {/* Schedule Tab */}
            {tab === 'schedule' && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Round</label>
                    <select
                      value={filterRound}
                      onChange={(e) => setFilterRound(e.target.value)}
                      className="bg-slate-700 border border-slate-600 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-500"
                    >
                      <option value="all">All Rounds</option>
                      {rounds.map((r) => (
                        <option key={r} value={r}>Round {r}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Status</label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="bg-slate-700 border border-slate-600 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-500"
                    >
                      <option value="all">All Statuses</option>
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="complete">Complete</option>
                    </select>
                  </div>
                </div>

                <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700 text-slate-400">
                        <th className="px-4 py-3 text-left font-medium">Round</th>
                        <th className="px-4 py-3 text-left font-medium">Match</th>
                        <th className="px-4 py-3 text-left font-medium">Players</th>
                        <th className="px-4 py-3 text-left font-medium">Status</th>
                        <th className="px-4 py-3 text-left font-medium">Winner</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {filteredMatches.map((match) => (
                        <tr key={match.id} className="hover:bg-slate-700/30 transition-colors">
                          <td className="px-4 py-3 text-slate-400">
                            {match.round}
                            {match.bracket_side && (
                              <span className={`ml-1 text-xs ${match.bracket_side === 'losers' ? 'text-orange-400' : 'text-green-400'}`}>
                                ({match.bracket_side})
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-400">#{match.match_number}</td>
                          <td className="px-4 py-3">
                            <span className={match.winner_id === match.player1_id && match.status === 'complete' ? 'text-green-400 font-medium' : 'text-white'}>
                              {match.player1_name || 'TBD'}
                            </span>
                            <span className="text-slate-600 mx-2">vs</span>
                            <span className={match.winner_id === match.player2_id && match.status === 'complete' ? 'text-green-400 font-medium' : 'text-white'}>
                              {match.player2_name || 'TBD'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={match.status} />
                          </td>
                          <td className="px-4 py-3 text-green-400 font-medium">
                            {match.winner_name || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredMatches.length === 0 && (
                    <div className="text-center py-8 text-slate-500">No matches match your filter.</div>
                  )}
                </div>
              </div>
            )}

            {/* Leaderboard Tab */}
            {tab === 'leaderboard' && (
              <Leaderboard
                tournament={tournament}
                matches={matches}
                players={players}
              />
            )}
          </>
        )}

        {/* Auto-refresh indicator */}
        <div className="text-center mt-8 text-slate-600 text-xs">
          Auto-refreshes every 10 seconds
        </div>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-slate-700 text-slate-300',
    in_progress: 'bg-yellow-700/30 text-yellow-400',
    complete: 'bg-green-700/30 text-green-400',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${styles[status] || ''}`}>
      {status.replace('_', ' ')}
    </span>
  );
}
