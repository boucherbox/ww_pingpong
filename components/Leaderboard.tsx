'use client';

import { Tournament, Player, MatchWithNames } from '@/lib/db';

interface Props {
  tournament: Tournament;
  matches: MatchWithNames[];
  players: Player[];
}

interface Standing {
  player: Player;
  wins: number;
  losses: number;
  winPct: number;
  eliminatedRound: number | null;
  maxRound: number;
}

export default function Leaderboard({ tournament, matches, players }: Props) {
  const isElim = tournament.format === 'single_elim' || tournament.format === 'double_elim';
  const standings = computeStandings(players, matches, isElim);

  if (isElim) {
    return <EliminationLeaderboard standings={standings} tournament={tournament} />;
  }

  return <StandingsTable standings={standings} />;
}

function EliminationLeaderboard({
  standings,
  tournament,
}: {
  standings: Standing[];
  tournament: Tournament;
}) {
  const sorted = [...standings].sort((a, b) => {
    // Higher max round = better performance
    if (b.maxRound !== a.maxRound) return b.maxRound - a.maxRound;
    return a.player.name.localeCompare(b.player.name);
  });

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      <div className="px-4 py-3 bg-slate-700/30 border-b border-slate-700">
        <h3 className="font-medium text-slate-300">Player Rankings</h3>
        <p className="text-xs text-slate-500 mt-0.5">Sorted by furthest round reached</p>
      </div>
      <div className="divide-y divide-slate-700">
        {sorted.map((s, index) => {
          const isChampion = index === 0 && tournament.status === 'complete';
          return (
            <div
              key={s.player.id}
              className={`px-4 py-3 flex items-center gap-4 ${isChampion ? 'bg-yellow-900/10' : ''}`}
            >
              <div className="w-8 text-center font-bold text-slate-400">
                {isChampion ? '🏆' : index + 1}
              </div>
              <div className="flex-1">
                <div className={`font-medium ${isChampion ? 'text-yellow-400' : 'text-white'}`}>
                  {s.player.name}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Reached Round {s.maxRound}
                  {s.wins > 0 && ` · ${s.wins}W ${s.losses}L`}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-slate-300">{s.wins}W</div>
                <div className="text-xs text-slate-500">{s.losses}L</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StandingsTable({ standings }: { standings: Standing[] }) {
  const sorted = [...standings].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.winPct !== a.winPct) return b.winPct - a.winPct;
    return a.player.name.localeCompare(b.player.name);
  });

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700 text-slate-400">
            <th className="px-4 py-3 text-left font-medium w-12">Rank</th>
            <th className="px-4 py-3 text-left font-medium">Player</th>
            <th className="px-4 py-3 text-center font-medium">W</th>
            <th className="px-4 py-3 text-center font-medium">L</th>
            <th className="px-4 py-3 text-center font-medium">Win %</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700">
          {sorted.map((s, index) => {
            const isFirst = index === 0 && s.wins > 0;
            return (
              <tr
                key={s.player.id}
                className={`hover:bg-slate-700/30 transition-colors ${isFirst ? 'bg-green-900/10' : ''}`}
              >
                <td className="px-4 py-3 font-bold text-slate-400">
                  {index === 0 && s.wins > 0 ? '🥇' : index === 1 && s.wins > 0 ? '🥈' : index === 2 && s.wins > 0 ? '🥉' : index + 1}
                </td>
                <td className="px-4 py-3">
                  <span className={`font-medium ${isFirst ? 'text-green-400' : 'text-white'}`}>
                    {s.player.name}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-green-400 font-medium">{s.wins}</td>
                <td className="px-4 py-3 text-center text-red-400">{s.losses}</td>
                <td className="px-4 py-3 text-center text-slate-300">
                  {s.wins + s.losses === 0 ? '—' : `${Math.round(s.winPct * 100)}%`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function computeStandings(players: Player[], matches: MatchWithNames[], isElim: boolean): Standing[] {
  const wins = new Map<number, number>();
  const losses = new Map<number, number>();
  const maxRound = new Map<number, number>();

  for (const p of players) {
    wins.set(p.id, 0);
    losses.set(p.id, 0);
    maxRound.set(p.id, 0);
  }

  for (const m of matches) {
    if (m.status !== 'complete' || !m.winner_id) continue;

    const loserId = m.player1_id === m.winner_id ? m.player2_id : m.player1_id;

    wins.set(m.winner_id, (wins.get(m.winner_id) ?? 0) + 1);
    if (loserId) {
      losses.set(loserId, (losses.get(loserId) ?? 0) + 1);
    }

    // Track max round for elimination formats
    if (isElim) {
      const currentMax = maxRound.get(m.winner_id) ?? 0;
      if (m.round > currentMax) maxRound.set(m.winner_id, m.round);
    }
  }

  return players.map((p) => {
    const w = wins.get(p.id) ?? 0;
    const l = losses.get(p.id) ?? 0;
    return {
      player: p,
      wins: w,
      losses: l,
      winPct: w + l > 0 ? w / (w + l) : 0,
      eliminatedRound: null,
      maxRound: maxRound.get(p.id) ?? 0,
    };
  });
}
