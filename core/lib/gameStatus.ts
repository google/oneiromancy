/**
 * @license
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * NFL game status for the current week, by team, from Sleeper's schedule.
 * sleeper.ts registers it on each sync; oracle.ts reads it so lineup, waiver
 * and trade advice never move a player whose game has already started.
 */

export type GameStatus = 'pre_game' | 'in_game' | 'complete';

let current: { week: number; byTeam: Record<string, GameStatus> } | null = null;

export function setGameStatus(week: number, byTeam: Record<string, GameStatus>): void {
  current = { week, byTeam };
}

export function clearGameStatus(): void {
  current = null;
}

/** Status of a team's game this week; undefined when unknown (mock mode, byes). */
export function teamGameStatus(team?: string | null): GameStatus | undefined {
  if (!current || !team) return undefined;
  return current.byTeam[team];
}

/** Sleeper locks a player once his game kicks off. */
export function isLocked(player?: { team?: string | null } | null): boolean {
  const s = teamGameStatus(player?.team);
  return s === 'in_game' || s === 'complete';
}
