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

import React from 'react';

export type GlassGlowColor = 'cyan' | 'purple' | 'gold' | 'green' | 'none';
export type GlassVariant = 'panel' | 'surface' | 'gradient';

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  glowColor?: GlassGlowColor;
  variant?: GlassVariant;
  interactive?: boolean;
  className?: string;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  glowColor = 'none',
  variant = 'panel',
  interactive = false,
  className = '',
  ...rest
}) => {
  const variantClass =
    variant === 'gradient'
      ? 'glow-gradient-card'
      : variant === 'surface'
      ? 'glass-surface'
      : 'glass-panel';

  const glowClass =
    glowColor === 'cyan'
      ? 'glow-cyan'
      : glowColor === 'purple'
      ? 'glow-purple'
      : glowColor === 'gold'
      ? 'glow-gold'
      : glowColor === 'green'
      ? 'glow-green'
      : '';

  const interactiveClass = interactive
    ? 'cursor-pointer transition-all duration-200 hover:border-white/20 hover:shadow-[0_12px_36px_-6px_rgba(0,0,0,0.7)] active:scale-[0.99]'
    : '';

  return (
    <div
      className={`rounded-xl p-4 transition-colors ${variantClass} ${glowClass} ${interactiveClass} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
};

export default GlassCard;
