/**
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
 * tests/helpers/lucide_react_fallback.mjs
 * Hermetic fallback module for lucide-react in offline and clean sandbox test environments.
 * Exports lightweight SVG React components for all icons imported in the codebase.
 */

import React from 'react';

function createIcon(name) {
  const Component = (props) => {
    const { size = 24, color = 'currentColor', strokeWidth = 2, className, ...rest } = props || {};
    return React.createElement('svg', {
      xmlns: 'http://www.w3.org/2000/svg',
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: color,
      strokeWidth,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      className: className ? `lucide lucide-${name.toLowerCase()} ${className}` : `lucide lucide-${name.toLowerCase()}`,
      ...rest,
    });
  };
  Component.displayName = name;
  return Component;
}

export const AlertCircle = createIcon('AlertCircle');
export const AlertTriangle = createIcon('AlertTriangle');
export const ArrowRightLeft = createIcon('ArrowRightLeft');
export const ArrowUpDown = createIcon('ArrowUpDown');
export const BarChart2 = createIcon('BarChart2');
export const BookOpen = createIcon('BookOpen');
export const Calendar = createIcon('Calendar');
export const Check = createIcon('Check');
export const CheckCircle2 = createIcon('CheckCircle2');
export const ChevronDown = createIcon('ChevronDown');
export const ChevronUp = createIcon('ChevronUp');
export const Clock = createIcon('Clock');
export const Compass = createIcon('Compass');
export const Crown = createIcon('Crown');
export const Droplet = createIcon('Droplet');
export const ExternalLink = createIcon('ExternalLink');
export const Flame = createIcon('Flame');
export const Globe = createIcon('Globe');
export const HelpCircle = createIcon('HelpCircle');
export const Info = createIcon('Info');
export const Layers = createIcon('Layers');
export const MapPin = createIcon('MapPin');
export const Moon = createIcon('Moon');
export const Mountain = createIcon('Mountain');
export const Orbit = createIcon('Orbit');
export const RefreshCw = createIcon('RefreshCw');
export const RotateCcw = createIcon('RotateCcw');
export const Scale = createIcon('Scale');
export const Search = createIcon('Search');
export const Settings = createIcon('Settings');
export const Shield = createIcon('Shield');
export const Sparkles = createIcon('Sparkles');
export const Swords = createIcon('Swords');
export const TrendingUp = createIcon('TrendingUp');
export const Trophy = createIcon('Trophy');
export const User = createIcon('User');
export const Users = createIcon('Users');
export const Wind = createIcon('Wind');
export const X = createIcon('X');
export const Zap = createIcon('Zap');

export default new Proxy({}, {
  get: (_target, prop) => {
    if (typeof prop === 'string') {
      return createIcon(prop);
    }
    return undefined;
  },
});
