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

'use client';

import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { OraclePlaceholderInfo } from '@/lib/oracle';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export interface TooltipRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface TooltipDimensions {
  width: number;
  height: number;
}

export interface ComputedTooltipPosition {
  top: number;
  left: number;
  placement: 'top' | 'bottom';
}

const EDGE_MARGIN = 8;
const TOOLTIP_GAP = 6;
const HEADER_CLEARANCE = 56;
const DEFAULT_TOOLTIP_SIZE: TooltipDimensions = { width: 240, height: 84 };

const peerCloseCallbacks = new Set<() => void>();

/**
 * Computes fixed viewport coordinates for a portaled placeholder tooltip,
 * clamping horizontally within 8px viewport edges and flipping below when
 * placing above would collide with top headers or the upper viewport edge.
 */
export function computeTooltipPosition(
  anchorRect: TooltipRect,
  viewport: ViewportSize,
  tooltipSize: TooltipDimensions = DEFAULT_TOOLTIP_SIZE,
): ComputedTooltipPosition {
  const width = Math.max(0, Math.min(tooltipSize.width || DEFAULT_TOOLTIP_SIZE.width, Math.max(120, viewport.width - EDGE_MARGIN * 2)));
  const height = Math.max(0, tooltipSize.height || DEFAULT_TOOLTIP_SIZE.height);
  const anchorCenterX = anchorRect.left + anchorRect.width / 2;
  const maxLeft = Math.max(EDGE_MARGIN, viewport.width - width - EDGE_MARGIN);
  const left = Math.max(EDGE_MARGIN, Math.min(maxLeft, anchorCenterX - width / 2));

  const maxTopFloor = Math.max(EDGE_MARGIN, viewport.height - height - EDGE_MARGIN);
  const minTop = Math.min(HEADER_CLEARANCE, maxTopFloor);
  const maxTop = Math.max(minTop, maxTopFloor);

  const candidateTopAbove = anchorRect.top - height - TOOLTIP_GAP;
  const fitsAbove = candidateTopAbove >= HEADER_CLEARANCE;
  const candidateTopBelow = anchorRect.bottom + TOOLTIP_GAP;
  const fitsBelow = candidateTopBelow + height <= viewport.height - EDGE_MARGIN;

  if (fitsAbove || !fitsBelow) {
    const placement: 'top' | 'bottom' = fitsAbove ? 'top' : 'bottom';
    const rawTop = placement === 'top' ? candidateTopAbove : candidateTopBelow;
    return {
      top: Math.max(minTop, Math.min(maxTop, rawTop)),
      left,
      placement,
    };
  }

  return {
    top: Math.max(minTop, Math.min(maxTop, candidateTopBelow)),
    left,
    placement: 'bottom',
  };
}

export interface OraclePlaceholderMarkerProps {
  placeholder: OraclePlaceholderInfo;
  kind?: 'oracle' | 'stats';
  className?: string;
}

const ZERO_RECT: TooltipRect = {
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: 0,
  height: 0,
};

/**
 * Interactive placeholder badge (`~`) explaining why an Oracle score (or adjacent
 * 0.0 Stats cell) falls back to season average projections when weekly stats are 0.0.
 */
export const OraclePlaceholderMarker: React.FC<OraclePlaceholderMarkerProps> = ({
  placeholder,
  kind = 'oracle',
  className = '',
}) => {
  const [mounted, setMounted] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focusVisible, setFocusVisible] = useState(false);
  const [pos, setPos] = useState<ComputedTooltipPosition>({ top: 0, left: 8, placement: 'top' });

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const tooltipRef = useRef<HTMLSpanElement | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipId = useId();

  const isOpen = pinned || hovered || focusVisible;

  const clearHoverTimer = useCallback(() => {
    if (hoverTimerRef.current !== null) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);

  const dismissAll = useCallback(() => {
    clearHoverTimer();
    setPinned(false);
    setHovered(false);
    setFocusVisible(false);
  }, [clearHoverTimer]);

  const closePeers = useCallback(() => {
    peerCloseCallbacks.forEach((cb) => {
      if (cb !== dismissAll) cb();
    });
  }, [dismissAll]);

  const scheduleHoverClose = useCallback(() => {
    clearHoverTimer();
    hoverTimerRef.current = setTimeout(() => {
      setHovered(false);
    }, 80);
  }, [clearHoverTimer]);

  useEffect(() => {
    setMounted(true);
    return () => clearHoverTimer();
  }, [clearHoverTimer]);

  useEffect(() => {
    peerCloseCallbacks.add(dismissAll);
    return () => {
      peerCloseCallbacks.delete(dismissAll);
    };
  }, [dismissAll]);

  const updatePosition = useCallback(() => {
    if (typeof window === 'undefined') return;
    const rawRect =
      triggerRef.current && typeof triggerRef.current.getBoundingClientRect === 'function'
        ? triggerRef.current.getBoundingClientRect()
        : ZERO_RECT;
    const anchorRect: TooltipRect = {
      top: rawRect.top ?? 0,
      left: rawRect.left ?? 0,
      right: rawRect.right ?? 0,
      bottom: rawRect.bottom ?? 0,
      width: rawRect.width ?? 0,
      height: rawRect.height ?? 0,
    };
    const tipRect =
      tooltipRef.current && typeof tooltipRef.current.getBoundingClientRect === 'function'
        ? tooltipRef.current.getBoundingClientRect()
        : null;
    const tooltipSize: TooltipDimensions =
      tipRect && tipRect.width > 0 && tipRect.height > 0
        ? { width: tipRect.width, height: tipRect.height }
        : DEFAULT_TOOLTIP_SIZE;
    const viewport: ViewportSize = {
      width: window.innerWidth || 1280,
      height: window.innerHeight || 800,
    };
    setPos(computeTooltipPosition(anchorRect, viewport, tooltipSize));
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;
    updatePosition();
    const raf =
      typeof window.requestAnimationFrame === 'function'
        ? window.requestAnimationFrame(() => updatePosition())
        : null;

    const handleOutsidePointerDown = (event: Event) => {
      const target = event.target as Node | null;
      if (
        target &&
        !triggerRef.current?.contains(target) &&
        !tooltipRef.current?.contains(target)
      ) {
        dismissAll();
      }
    };

    const handleEscapeCapture = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        dismissAll();
      }
    };

    const isAnchorHiddenInViewport = (): boolean => {
      const el = triggerRef.current;
      if (!el || typeof el.getBoundingClientRect !== 'function') return false;
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth || 1280;
      const vh = window.innerHeight || 800;
      const hasBox = r.width > 0 || r.height > 0;
      if (!hasBox) return false;
      if (r.bottom <= HEADER_CLEARANCE || r.top >= vh || r.right <= 0 || r.left >= vw) {
        return true;
      }
      let parent = el.parentElement;
      while (parent && parent !== document.body && parent !== document.documentElement) {
        const style = typeof window.getComputedStyle === 'function' ? window.getComputedStyle(parent) : null;
        const ovY = style?.overflowY || '';
        const ovX = style?.overflowX || '';
        if (
          (ovY === 'auto' || ovY === 'scroll' || ovX === 'auto' || ovX === 'scroll') &&
          typeof parent.getBoundingClientRect === 'function'
        ) {
          const pr = parent.getBoundingClientRect();
          if (pr.width > 0 || pr.height > 0) {
            if (r.bottom <= pr.top || r.top >= pr.bottom || r.right <= pr.left || r.left >= pr.right) {
              return true;
            }
          }
        }
        parent = parent.parentElement;
      }
      return false;
    };

    const handleScroll = () => {
      if (isAnchorHiddenInViewport()) {
        dismissAll();
        return;
      }
      updatePosition();
    };

    const handleResize = () => {
      updatePosition();
    };

    window.addEventListener('pointerdown', handleOutsidePointerDown, true);
    window.addEventListener('keydown', handleEscapeCapture, true);
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    window.addEventListener('resize', handleResize);

    return () => {
      if (raf !== null && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(raf);
      }
      window.removeEventListener('pointerdown', handleOutsidePointerDown, true);
      window.removeEventListener('keydown', handleEscapeCapture, true);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen, updatePosition, dismissAll]);

  if (!placeholder.hasPlaceholder) return null;

  const testId = kind === 'stats' ? 'stats-placeholder-marker' : 'oracle-placeholder-marker';
  const ariaLabel =
    kind === 'stats'
      ? 'Explain zero weekly stats placeholder'
      : 'Explain estimated Oracle placeholder';
  const explainerText =
    kind === 'stats'
      ? placeholder.statsMarkerExplainerText || placeholder.statsTooltipText
      : placeholder.markerExplainerText || placeholder.tooltipText;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-testid={testId}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-describedby={isOpen ? tooltipId : undefined}
        onPointerEnter={(e: React.PointerEvent<HTMLButtonElement>) => {
          if (e.pointerType === 'mouse') {
            clearHoverTimer();
            closePeers();
            setHovered(true);
          }
        }}
        onPointerLeave={(e: React.PointerEvent<HTMLButtonElement>) => {
          if (e.pointerType === 'mouse') {
            scheduleHoverClose();
          }
        }}
        onFocus={(e: React.FocusEvent<HTMLButtonElement>) => {
          try {
            if (e.currentTarget.matches?.(':focus-visible')) {
              closePeers();
              setFocusVisible(true);
            }
          } catch {
            // Ignore environments without :focus-visible selector support
          }
        }}
        onBlur={() => {
          setFocusVisible(false);
        }}
        onPointerDown={(e: React.PointerEvent<HTMLButtonElement>) => {
          e.stopPropagation();
        }}
        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
          e.preventDefault();
          e.stopPropagation();
          clearHoverTimer();
          if (pinned) {
            setPinned(false);
            setHovered(false);
            setFocusVisible(false);
          } else {
            closePeers();
            setPinned(true);
          }
        }}
        onKeyDown={(e: React.KeyboardEvent<HTMLButtonElement>) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation();
          }
        }}
        className={`relative inline-flex items-center justify-center ml-0.5 p-0 m-0 border-0 bg-transparent text-amber-300 font-bold cursor-help leading-none rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 before:content-[''] before:absolute before:-inset-1 ${className}`.trim()}
      >
        ~
      </button>
      {mounted &&
        isOpen &&
        typeof document !== 'undefined' &&
        document.body &&
        createPortal(
          <span
            ref={tooltipRef}
            id={tooltipId}
            role="tooltip"
            data-testid="oracle-placeholder-tooltip"
            style={{ top: `${pos.top}px`, left: `${pos.left}px` }}
            onClick={(e: React.MouseEvent<HTMLSpanElement>) => e.stopPropagation()}
            onPointerDown={(e: React.PointerEvent<HTMLSpanElement>) => e.stopPropagation()}
            onKeyDown={(e: React.KeyboardEvent<HTMLSpanElement>) => e.stopPropagation()}
            onPointerEnter={(e: React.PointerEvent<HTMLSpanElement>) => {
              if (e.pointerType === 'mouse') {
                clearHoverTimer();
                setHovered(true);
              }
            }}
            onPointerLeave={(e: React.PointerEvent<HTMLSpanElement>) => {
              if (e.pointerType === 'mouse') {
                scheduleHoverClose();
              }
            }}
            className="fixed z-[70] w-60 max-w-[calc(100vw-16px)] rounded-lg bg-slate-900/95 border border-amber-500/40 px-2.5 py-2 text-[11px] font-sans font-normal leading-snug text-slate-200 shadow-2xl backdrop-blur-md whitespace-normal text-left"
          >
            {explainerText}
          </span>,
          document.body,
        )}
    </>
  );
};

export default OraclePlaceholderMarker;
