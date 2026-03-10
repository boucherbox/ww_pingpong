'use client';

import { Tournament, MatchWithNames } from '@/lib/db';

interface Props {
  matches: MatchWithNames[];
  tournament: Tournament;
  currentRound: number;
}

export default function BracketTree({ matches, tournament, currentRound }: Props) {
  const isDoubleElim = tournament.format === 'double_elim';

  if (tournament.format === 'round_robin' || tournament.format === 'swiss') {
    return <RoundRobinView matches={matches} currentRound={currentRound} />;
  }

  const winnerMatches = matches.filter((m) => m.bracket_side === 'winners' || !m.bracket_side);
  const loserMatches = matches.filter((m) => m.bracket_side === 'losers');

  return (
    <div className="space-y-10">
      <div>
        {isDoubleElim && (
          <h3 className="text-green-400 font-semibold text-lg mb-4">Winners Bracket</h3>
        )}
        <EliminationBracket matches={winnerMatches} currentRound={currentRound} />
      </div>
      {isDoubleElim && loserMatches.length > 0 && (
        <div>
          <h3 className="text-orange-400 font-semibold text-lg mb-4">Losers Bracket</h3>
          <EliminationBracket matches={loserMatches} currentRound={currentRound} />
        </div>
      )}
    </div>
  );
}

function EliminationBracket({
  matches,
  currentRound,
}: {
  matches: MatchWithNames[];
  currentRound: number;
}) {
  const rounds = groupByRound(matches);
  const totalRounds = rounds.length;

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-0 min-w-max">
        {rounds.map(([round, roundMatches], roundIndex) => {
          const isCurrentRound = round === currentRound;
          const matchesPerRound = roundMatches.length;
          const firstRoundCount = rounds[0]?.[1]?.length ?? 1;
          // Spacing grows as rounds progress
          const itemHeight = Math.max(80, (firstRoundCount / matchesPerRound) * 80);

          return (
            <div key={round} className="flex flex-col" style={{ minWidth: 200 }}>
              {/* Round header */}
              <div className={`text-center text-sm font-medium pb-3 mx-2 border-b ${
                isCurrentRound ? 'text-green-400 border-green-600' : 'text-slate-400 border-slate-700'
              }`}>
                {getRoundLabel(round, totalRounds)}
                {isCurrentRound && (
                  <span className="ml-2 inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse align-middle" />
                )}
              </div>

              {/* Matches */}
              <div className="flex flex-col mt-3 relative">
                {roundMatches.map((match, matchIndex) => (
                  <div
                    key={match.id}
                    className="relative flex items-center"
                    style={{ height: itemHeight, minHeight: 80 }}
                  >
                    {/* Connector lines */}
                    {roundIndex > 0 && (
                      <div
                        className="absolute left-0 top-1/2 w-4 border-t border-slate-600"
                        style={{ transform: 'translateY(-50%)' }}
                      />
                    )}
                    {roundIndex < rounds.length - 1 && (
                      <>
                        {/* Right connector */}
                        <div
                          className="absolute right-0 top-1/2 w-4 border-t border-slate-600"
                          style={{ transform: 'translateY(-50%)' }}
                        />
                        {/* Vertical connector (for pairs) */}
                        {matchIndex % 2 === 0 && roundMatches[matchIndex + 1] && (
                          <div
                            className="absolute border-l border-slate-600"
                            style={{
                              right: 0,
                              top: '50%',
                              height: itemHeight,
                            }}
                          />
                        )}
                      </>
                    )}

                    <div className="flex-1 mx-4">
                      <PublicMatchCard
                        match={match}
                        isCurrentRound={isCurrentRound}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PublicMatchCard({
  match,
  isCurrentRound,
}: {
  match: MatchWithNames;
  isCurrentRound: boolean;
}) {
  const borderColor = isCurrentRound && match.status !== 'complete'
    ? 'border-green-500/60 shadow-green-900/20 shadow-md'
    : match.status === 'complete'
    ? 'border-slate-600'
    : 'border-slate-700';

  return (
    <div className={`bg-slate-800 rounded-xl border ${borderColor} p-3 transition-all`}>
      <PublicPlayerSlot
        name={match.player1_name}
        isWinner={match.winner_id === match.player1_id && match.status === 'complete'}
        isLoser={match.winner_id === match.player2_id && match.status === 'complete'}
      />
      <div className="border-t border-slate-700 my-1" />
      <PublicPlayerSlot
        name={match.player2_name}
        isWinner={match.winner_id === match.player2_id && match.status === 'complete'}
        isLoser={match.winner_id === match.player1_id && match.status === 'complete'}
      />
    </div>
  );
}

function PublicPlayerSlot({
  name,
  isWinner,
  isLoser,
}: {
  name: string | null;
  isWinner: boolean;
  isLoser: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 px-1 py-1 rounded text-sm ${
      isWinner ? 'text-green-400 font-semibold' : isLoser ? 'text-slate-500' : name ? 'text-white' : 'text-slate-600 italic'
    }`}>
      {isWinner && <span className="text-green-400">▶</span>}
      <span className="truncate">{name || 'TBD'}</span>
    </div>
  );
}

function RoundRobinView({
  matches,
  currentRound,
}: {
  matches: MatchWithNames[];
  currentRound: number;
}) {
  const rounds = groupByRound(matches);

  return (
    <div className="space-y-6">
      {rounds.map(([round, roundMatches]) => {
        const isCurrentRound = round === currentRound;
        return (
          <div
            key={round}
            className={`bg-slate-800 rounded-xl border overflow-hidden ${
              isCurrentRound ? 'border-green-600' : 'border-slate-700'
            }`}
          >
            <div className={`px-4 py-3 border-b ${isCurrentRound ? 'bg-green-900/20 border-green-700' : 'bg-slate-700/30 border-slate-700'} flex items-center gap-2`}>
              <h3 className={`font-medium ${isCurrentRound ? 'text-green-400' : 'text-slate-300'}`}>
                Round {round}
              </h3>
              {isCurrentRound && (
                <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              )}
            </div>
            <div className="divide-y divide-slate-700">
              {roundMatches.map((match) => (
                <div key={match.id} className="px-4 py-3 flex items-center gap-4">
                  <div className="flex-1 flex items-center gap-2 text-sm">
                    <span className={`font-medium ${match.winner_id === match.player1_id ? 'text-green-400' : 'text-white'}`}>
                      {match.player1_name || 'TBD'}
                    </span>
                    <span className="text-slate-600">vs</span>
                    <span className={`font-medium ${match.winner_id === match.player2_id ? 'text-green-400' : 'text-white'}`}>
                      {match.player2_name || 'TBD'}
                    </span>
                  </div>
                  <div className="text-sm">
                    {match.status === 'complete' ? (
                      <span className="text-green-400">Winner: {match.winner_name}</span>
                    ) : (
                      <span className="text-slate-500 capitalize">{match.status.replace('_', ' ')}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
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
  if (fromEnd === 0) return 'Grand Final';
  if (fromEnd === 1) return 'Semifinal';
  if (fromEnd === 2) return 'Quarterfinal';
  return `Round ${round}`;
}
