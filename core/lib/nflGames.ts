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
 * Real NFL games for the matchup cards: kickoff, venue and opponent, plus the
 * moon and planetary hour at that kickoff. Sleeper's schedule has dates and
 * home/away teams only, so kickoffs and venues come from ESPN's public
 * scoreboard (CORS-open). If ESPN is unavailable, cards fall back to Sleeper's
 * date and the home team's stadium, with the time shown as TBA. Nothing here is
 * invented per player: everyone in the same game shares the same values.
 */

export interface NflGame {
  week: number;
  home: string;
  away: string;
  /** ISO kickoff in UTC, when known. */
  kickoff: string | null;
  /** Sleeper's YYYY-MM-DD date, used when the kickoff time is unknown. */
  date: string | null;
  venue: { name: string; city: string; state?: string; indoor?: boolean } | null;
  neutral: boolean;
}

// ESPN abbreviations that differ from Sleeper's.
const ESPN_TO_SLEEPER: Record<string, string> = { WSH: 'WAS', LA: 'LAR', JAC: 'JAX' };
const toSleeper = (abbr: string) => ESPN_TO_SLEEPER[abbr] ?? abbr;

const gamesByWeek = new Map<number, Map<string, NflGame>>();

/** Register a week's games (replaces that week). Keyed by both teams. */
export function setWeekGames(week: number, games: NflGame[]): void {
  const byTeam = new Map<string, NflGame>();
  for (const g of games) {
    byTeam.set(g.home, g);
    byTeam.set(g.away, g);
  }
  gamesByWeek.set(week, byTeam);
}

export function clearNflGames(): void {
  gamesByWeek.clear();
}

/** The team's game that week; undefined on a bye or when unknown. */
export function teamGame(week: number, team?: string | null): NflGame | undefined {
  if (!team) return undefined;
  return gamesByWeek.get(week)?.get(team);
}

const espnCache = new Map<string, { at: number; games: Promise<NflGame[] | null> }>();
const ESPN_TTL_MS = 5 * 60 * 1000;

/** ESPN scoreboard for one regular-season week; null on any failure. */
export function fetchEspnWeek(season: string, week: number, final = false): Promise<NflGame[] | null> {
  const key = `${season}:${week}`;
  const hit = espnCache.get(key);
  if (hit && (final || Date.now() - hit.at < ESPN_TTL_MS)) return hit.games;
  const games = (async (): Promise<NflGame[] | null> => {
    try {
      const res = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${season}&seasontype=2&week=${week}`,
      );
      if (!res.ok) return null;
      const data = await res.json();
      const out: NflGame[] = [];
      for (const e of data?.events ?? []) {
        const c = e?.competitions?.[0];
        const home = c?.competitors?.find((t: any) => t.homeAway === 'home')?.team?.abbreviation;
        const away = c?.competitors?.find((t: any) => t.homeAway === 'away')?.team?.abbreviation;
        if (!home || !away) continue;
        out.push({
          week,
          home: toSleeper(home),
          away: toSleeper(away),
          kickoff: typeof e.date === 'string' ? e.date : null,
          date: typeof e.date === 'string' ? e.date.slice(0, 10) : null,
          venue: c?.venue?.fullName
            ? {
                name: c.venue.fullName,
                city: c.venue.address?.city ?? '',
                state: c.venue.address?.state,
                indoor: typeof c.venue.indoor === 'boolean' ? c.venue.indoor : undefined,
              }
            : null,
          neutral: Boolean(c?.neutralSite),
        });
      }
      return out.length ? out : null;
    } catch {
      return null;
    }
  })();
  espnCache.set(key, { at: Date.now(), games });
  games.then((g) => {
    if (!g) espnCache.delete(key);
  });
  return games;
}

/** Coordinates of international / neutral-site venues ESPN reports by name. */
const NEUTRAL_VENUES: [string, number, number][] = [
  ['Tottenham', 51.6043, -0.0664],
  ['Wembley', 51.556, -0.2796],
  ['Allianz Arena', 48.2188, 11.6247],
  ['Deutsche Bank Park', 50.0686, 8.6455],
  ['Olympiastadion', 52.5147, 13.2395],
  ['Azteca', 19.3029, -99.1505],
  ['Banorte', 19.3029, -99.1505],
  ['Neo Química', -23.5453, -46.4742],
  ['Bernabéu', 40.4531, -3.6883],
  ['Croke Park', 53.3607, -6.2512],
  ['Melbourne Cricket Ground', -37.82, 144.983],
];

export function neutralVenueCoords(name?: string | null): { lat: number; lon: number } | null {
  if (!name) return null;
  const hit = NEUTRAL_VENUES.find(([n]) => name.includes(n));
  return hit ? { lat: hit[1], lon: hit[2] } : null;
}

// ---------------------------------------------------------------------------
// Kickoff text
// ---------------------------------------------------------------------------

/** "Sun, Oct 11 · 1:00 PM ET", or "Sun, Oct 11 · time TBA" without a time. */
export function kickoffLabel(game: NflGame): string {
  if (game.kickoff) {
    const d = new Date(game.kickoff);
    const day = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(d);
    const time = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
    }).format(d);
    return `${day} · ${time} ET`;
  }
  if (game.date) {
    const d = new Date(`${game.date}T12:00:00Z`);
    const day = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(d);
    return `${day} · time TBA`;
  }
  return 'Time TBA';
}

// ---------------------------------------------------------------------------
// Moon and planetary hour at kickoff
// ---------------------------------------------------------------------------

const SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];
const DAY_MS = 86400000;
const J2000 = Date.UTC(2000, 0, 1, 12);
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
const SYNODIC = 29.530588853;

/** Moon phase and sign, e.g. "Waxing Gibbous in Scorpio" (low-precision ephemeris). */
export function moonAt(when: Date): string {
  const age = ((((when.getTime() - KNOWN_NEW_MOON) / DAY_MS) % SYNODIC) + SYNODIC) % SYNODIC;
  const phase =
    age < 1.85 ? 'New Moon' :
    age < 5.54 ? 'Waxing Crescent' :
    age < 9.23 ? 'First Quarter' :
    age < 12.92 ? 'Waxing Gibbous' :
    age < 16.61 ? 'Full Moon' :
    age < 20.3 ? 'Waning Gibbous' :
    age < 23.99 ? 'Last Quarter' :
    age < 27.68 ? 'Waning Crescent' : 'New Moon';
  const d = (when.getTime() - J2000) / DAY_MS;
  const rad = Math.PI / 180;
  const L = 218.316 + 13.176396 * d;
  const M = 134.963 + 13.064993 * d;
  const lon = (((L + 6.289 * Math.sin(M * rad)) % 360) + 360) % 360;
  return `${phase} in ${SIGNS[Math.floor(lon / 30)]}`;
}

const CHALDEAN = ['Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon'];
// Index in CHALDEAN of each weekday's ruler, Sunday first.
const DAY_RULER = [3, 6, 2, 5, 1, 4, 0];
const HOUR_FLAVOR: Record<string, string> = {
  Saturn: 'Trench Resilience',
  Jupiter: 'Expansion & Vision',
  Mars: 'Kinetic Power',
  Sun: 'Radiant Command',
  Venus: 'Harmonic Precision',
  Mercury: 'Audible Velocity',
  Moon: 'Tidal Intuition',
};

/**
 * Planetary hour at kickoff, Chaldean order from the day's ruler. Uses local
 * solar time from the stadium's longitude and 12 equal hours from 6:00 solar
 * time (an approximation of sunrise).
 */
export function planetaryHourAt(when: Date, longitude: number): string {
  const solar = new Date(when.getTime() + (longitude / 15) * 3600000);
  let hoursSinceRise = solar.getUTCHours() + solar.getUTCMinutes() / 60 - 6;
  let weekday = solar.getUTCDay();
  if (hoursSinceRise < 0) {
    hoursSinceRise += 24;
    weekday = (weekday + 6) % 7;
  }
  const planet = CHALDEAN[(DAY_RULER[weekday] + Math.floor(hoursSinceRise)) % 7];
  return `Hour of ${planet} (${HOUR_FLAVOR[planet]})`;
}
