'use client';

import { Tournament, Player, MatchWithNames } from '@/lib/db';

interface Props {
  matches: MatchWithNames[];
  players: Player[];
  tournament: Tournament;
  onMarkWinner: (match: MatchWithNames) => void;
}

export default function AdminBracketView({ matches, tournament, onMarkWinner }: Props) {
  const isElim = tournament.format === 'single_elim' || tournament.format === 'double_elim';
  const isDoubleElim = tournament.format === 'double_elim';

  if (isElim) {
    const winnerMatches = matches.filter((m) => m.bracket_side === 'winners' || !m.bracket_side);
    const loserMatches = matches.filter((m) => m.bracket_side === 'losers');

    return (
      <div className="space-y-8">
        <BracketSection
          title={isDoubleElim ? 'Winners Bracket' : 'Bracket'}
          matches={winnerMatches}
          onMarkWinner={onMarkWinner}
          highlightColor="green"
        />
        {isDoubleElim && loserMatches.length > 0 && (
          <BracketSection
            title="Losers Bracket"
            matches={loserMatches}
            onMarkWinner={onMarkWinner}
            highlightColor="orange"
          />
        )}
      </div>
    );
  }

  // Round Robin / Swiss - table view
  return (
    <div className="space-y-6">
      {groupByRound(matches).map(([round, roundMatches]) => (
        <div key={round} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="px-4 py-3 bg-slate-700/50 border-b border-slate-700">
            <h3 className="font-medium text-slate-300">Round {round}</h3>
          </div>
          <div className="divide-y divide-slate-700">
            {roundMatches.map((match) => (
              <MatchRow key={match.id} match={match} onMarkWinner={onMarkWinner} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function BracketSection({
  title,
  matches,
  onMarkWinner,
  highlightColor,
}: {
  title: string;
  matches: MatchWithNames[];
  onMarkWinner: (m: MatchWithNames) => void;
  highlightColor: 'green' | 'orange';
}) {
  const rounds = groupByRound(matches);
  const colorClass = highlightColor === 'green' ? 'text-green-400' : 'text-orange-400';

  return (
    <div>
      <h3 className={`text-lg font-semibold mb-4 ${colorClass}`}>{title}</h3>
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-6 min-w-max">
          {rounds.map(([round, roundMatches]) => (
            <div key={round} className="flex flex-col gap-4 min-w-[200px]">
              <div className="text-center text-sm text-slate-400 font-medium pb-1 border-b border-slate-700">
                {getRoundLabel(round, rounds.length)}
              </div>
              <div className="flex flex-col justify-around gap-3 flex-1">
                {roundMatches.map((match) => (
                  <AdminMatchCard
                    key={match.id}
                    match={match}
                    onMarkWinner={onMarkWinner}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AdminMatchCard({
  match,
  onMarkWinner,
}: {
  match: MatchWithNames;
  onMarkWinner: (m: MatchWithNames) => void;
}) {
  const canMark = match.status !== 'complete' && match.player1_id && match.player2_id;

  return (
    <div className={`bg-slate-800 rounded-xl border p-3 ${
      match.status === 'complete' ? 'border-slate-600' : 'border-slate-600 hover:border-green-600'
    } transition-colors`}>
      <PlayerSlot
        name={match.player1_name}
        isWinner={match.winner_id === match.player1_id}
        isComplete={match.status === 'complete'}
      />
      <div className="text-center text-slate-600 text-xs my-1">vs</div>
      <PlayerSlot
        name={match.player2_name}
        isWinner={match.winner_id === match.player2_id}
        isComplete={match.status === 'complete'}
      />
      {canMark && (
        <button
          onClick={() => onMarkWinner(match)}
          className="mt-2 w-full text-xs bg-green-700 hover:bg-green-600 text-white py-1.5 rounded-lg transition-colors font-medium"
        >
          Mark Winner
        </button>
      )}
      {match.status === 'complete' && (
        <div className="mt-2 text-center text-xs text-green-400">Complete</div>
      )}
    </div>
  );
}

function PlayerSlot({
  name,
  isWinner,
  isComplete,
}: {
  name: string | null;
  isWinner: boolean;
  isComplete: boolean;
}) {
  return (
    <div className={`px-2 py-1 rounded text-sm font-medium ${
      isWinner
        ? 'bg-green-800/40 text-green-300'
        : isComplete && name
        ? 'text-slate-500'
        : name
        ? 'text-white'
        : 'text-slate-600 italic'
    }`}>
      {name || 'TBD'}
    </div>
  );
}

function MatchRow({
  match,
  onMarkWinner,
}: {
  match: MatchWithNames;
  onMarkWinner: (m: MatchWithNames) => void;
}) {
  const canMark = match.status !== 'complete' && match.player1_id && match.player2_id;

  return (
    <div className="px-4 py-3 flex items-center gap-4">
      <span className="text-slate-500 text-sm w-16">#{match.match_number}</span>
      <div className="flex-1 flex items-center gap-2">
        <span className={`font-medium ${match.winner_id === match.player1_id ? 'text-green-400' : 'text-white'}`}>
          {match.player1_name || 'TBD'}
        </span>
        <span className="text-slate-600">vs</span>
        <span className={`font-medium ${match.winner_id === match.player2_id ? 'text-green-400' : 'text-white'}`}>
          {match.player2_name || 'TBD'}
        </span>
      </div>
      <div className="flex items-center gap-3">
        {match.status === 'complete' ? (
          <span className="text-green-400 text-sm">
            Winner: {match.winner_name}
          </span>
        ) : (
          <span className="text-slate-500 text-sm capitalize">{match.status}</span>
        )}
        {canMark && (
          <button
            onClick={() => onMarkWinner(match)}
            className="text-xs bg-green-700 hover:bg-green-600 text-white px-3 py-1 rounded-lg transition-colors"
          >
            Mark Winner
          </button>
        )}
      </div>
    </div>
  );
}

function groupByRound(matches: MatchWithNames[]): [number, MatchWithNames[]][] {
  const map = new Map<number, MatchWithNames[]>();
  for (const m of matches) {
    if (!map.has(m.round)) map.set(m.round, []);
    map.get(m.round)!.push(m);
  }
  return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
}

function getRoundLabel(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return 'Final';
  if (fromEnd === 1) return 'Semifinal';
  if (fromEnd === 2) return 'Quarterfinal';
  return `Round ${round}`;
}
