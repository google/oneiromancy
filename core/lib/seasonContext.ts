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

import type { SleeperMatchup } from '../types/oneiromancy';

export interface SeasonContext {
  season: string;
  leagueId: string;
  currentWeek: number;
  lastRegularWeek: number;
  byeWeeks: Record<string, number>;
  weekDates: Record<number, string>;
  matchupsByWeek: Record<number, SleeperMatchup[]>;
}

let seasonContext: SeasonContext | null = null;

export function setSeasonContextState(ctx: SeasonContext | null): void {
  seasonContext = ctx;
}

export function getSeasonContext(): SeasonContext | null {
  return seasonContext;
}
