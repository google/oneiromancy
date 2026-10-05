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

'use client';

/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect } from 'react';
import { getAvatarFromCache, resolveSleeperAvatarUrl } from '@/lib/sleeper';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface UserAvatarProps {
  src?: string | null;
  alt?: string;
  fallbackText?: string;
  size?: AvatarSize;
  isUser?: boolean;
  className?: string;
  testId?: string;
  'data-testid'?: string;
}

const SIZE_CLASSES: Record<AvatarSize, { container: string; text: string }> = {
  xs: { container: 'w-4 h-4', text: 'text-[9px]' },
  sm: { container: 'w-6 h-6', text: 'text-[10px]' },
  md: { container: 'w-9 h-9', text: 'text-xs' },
  lg: { container: 'w-12 h-12', text: 'text-base' },
  xl: { container: 'w-14 h-14', text: 'text-xl font-bold' },
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  src,
  alt = 'Manager avatar',
  fallbackText = 'Seeker',
  size = 'md',
  isUser = false,
  className = '',
  testId,
  'data-testid': dataTestId,
}) => {
  const [hasError, setHasError] = useState<boolean>(false);
  const [isMounted, setIsMounted] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const baseSrc =
    typeof src === 'string' &&
    (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('/'))
      ? src
      : resolveSleeperAvatarUrl(src);

  // Intermediate cache lookup prior to direct network fetch, deferred until post-hydration
  const cachedUrl = isMounted ? (getAvatarFromCache(src) || getAvatarFromCache(fallbackText)) : null;
  const effectiveSrc = cachedUrl || baseSrc;

  useEffect(() => {
    setHasError(false);
  }, [src, effectiveSrc]);

  const sizeCfg = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const initial = (fallbackText || alt || 'Seeker').trim().charAt(0).toUpperCase() || 'S';

  const userRing = isUser
    ? 'ring-1 ring-purple-400/80 shadow-[0_0_8px_rgba(168,85,247,0.4)]'
    : 'ring-1 ring-white/10';

  const showImage = Boolean(effectiveSrc) && !hasError;

  return (
    <div
      data-testid={testId}
      className={`relative rounded-full overflow-hidden flex items-center justify-center shrink-0 bg-purple-950/50 ${sizeCfg.container} ${userRing} ${className}`}
    >
      {showImage ? (
        <img
          src={effectiveSrc as string}
          alt={alt}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)}
          className="w-full h-full object-cover rounded-full"
        />
      ) : (
        <span
          className={`w-full h-full flex items-center justify-center font-serif font-bold select-none ${sizeCfg.text} ${
            isUser ? 'text-purple-200' : 'text-slate-300'
          }`}
        >
          {initial}
        </span>
      )}
    </div>
  );
};

export default UserAvatar;
