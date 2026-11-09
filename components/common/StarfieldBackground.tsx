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

import React, { useEffect, useRef } from 'react';

export type OrientationPermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported';

/**
 * Checks whether the current runtime environment requires an explicit user gesture
 * to request device orientation permissions (e.g. iOS 13+ Safari).
 */
export function isOrientationPermissionRequired(): boolean {
  if (typeof window === 'undefined') return false;
  const doe = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: unknown } })
    .DeviceOrientationEvent;
  return typeof doe?.requestPermission === 'function';
}

/**
 * Returns the current device orientation permission status.
 * Distinguishes iOS gated permissions from non-iOS granted state and reduced-motion unsupported state.
 */
export function getOrientationPermissionStatus(): OrientationPermissionState {
  if (typeof window === 'undefined') return 'unsupported';
  if (
    typeof window.matchMedia === 'function' &&
    Boolean(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  ) {
    return 'unsupported';
  }
  if (!isOrientationPermissionRequired()) {
    const hasOrientation =
      'DeviceOrientationEvent' in window || 'ondeviceorientation' in window;
    return hasOrientation ? 'granted' : 'unsupported';
  }
  try {
    const stored = localStorage.getItem('oneiromancy_orientation_permission');
    if (stored === 'granted' || stored === 'denied') {
      return stored;
    }
    if (sessionStorage.getItem('oneiromancy_orientation_permission_denied') === 'true') {
      return 'denied';
    }
  } catch {
    // Ignore storage access failures
  }
  return 'prompt';
}

/**
 * Requests DeviceOrientationEvent permission from iOS Safari within a user gesture.
 * Persists the resulting state, dispatches an event for starfield canvas, and never
 * permanently locks out users on transient exceptions.
 */
export async function requestOrientationPermission(): Promise<OrientationPermissionState> {
  if (typeof window === 'undefined') return 'unsupported';
  if (!isOrientationPermissionRequired()) {
    return getOrientationPermissionStatus();
  }
  try {
    const doe = (
      window as unknown as {
        DeviceOrientationEvent: { requestPermission: () => Promise<string> };
      }
    ).DeviceOrientationEvent;
    const result = await doe.requestPermission();
    const state: OrientationPermissionState = result === 'granted' ? 'granted' : 'denied';
    try {
      localStorage.setItem('oneiromancy_orientation_permission', state);
      if (state === 'granted') {
        sessionStorage.removeItem('oneiromancy_orientation_permission_denied');
      } else {
        sessionStorage.setItem('oneiromancy_orientation_permission_denied', 'true');
      }
    } catch {
      // Ignore storage access failures
    }
    window.dispatchEvent(
      new CustomEvent('oneiromancy:orientation-permission-changed', {
        detail: { state },
      })
    );
    return state;
  } catch {
    // Transient or gesture error: set session denied but allow future session retry
    const state: OrientationPermissionState = 'denied';
    try {
      sessionStorage.setItem('oneiromancy_orientation_permission_denied', 'true');
    } catch {
      // Ignore storage access failures
    }
    window.dispatchEvent(
      new CustomEvent('oneiromancy:orientation-permission-changed', {
        detail: { state },
      })
    );
    return state;
  }
}

function getNow(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

interface Star {
  x: number;
  y: number;
  radius: number;
  baseAlpha: number;
  depth: number;
  vx: number;
  vy: number;
  color: string;
  twinkleSpeed: number;
  twinklePhase: number;
}

const STARFIELD_CONFIG = {
  minStars: 55,
  maxStars: 175,
  pxPerStar: 13000,
  minRadius: 0.6,
  maxRadius: 2.2,
  minAlpha: 0.18,
  maxAlpha: 0.90,
  twinkleProbability: 0.40,
  twinkleMinSpeedRadPerMs: Math.PI / 2000, // 4.0s period
  twinkleMaxSpeedRadPerMs: Math.PI / 1000, // 2.0s period
  tiltOffsetPx: 24,
  tiltDampingFactor: 0.08,
  accelHorizontalSpeed: 1.8,
  scrollParallaxFactor: 0.25,
  scrollDampingFactor: 0.18,
  layers: {
    background: { depth: 0.3, minRadius: 0.6, maxRadius: 1.0, minAlpha: 0.22, maxAlpha: 0.40 },
    midground: { depth: 0.6, minRadius: 1.0, maxRadius: 1.6, minAlpha: 0.38, maxAlpha: 0.60 },
    foreground: { depth: 1.0, minRadius: 1.4, maxRadius: 2.2, minAlpha: 0.60, maxAlpha: 0.85 },
  },
} as const;

function wrapCoord(value: number, max: number): number {
  if (!Number.isFinite(max) || max <= 0 || !Number.isFinite(value)) return 0;
  const wrapped = value % max;
  const pos = wrapped < 0 ? wrapped + max : wrapped;
  return pos >= max || pos === 0 ? 0 : pos;
}

function getPositiveFinite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function getTargetStarCount(width: number, height: number): number {
  const { minStars, maxStars, pxPerStar } = STARFIELD_CONFIG;
  return Math.max(minStars, Math.min(maxStars, Math.floor((width * height) / pxPerStar)));
}

function createStar(width: number, height: number): Star {
  const rDepth = Math.random();
  const layer =
    rDepth < 0.55
      ? STARFIELD_CONFIG.layers.background
      : rDepth < 0.80
        ? STARFIELD_CONFIG.layers.midground
        : STARFIELD_CONFIG.layers.foreground;
  const depth = layer.depth;
  const rawRadius = layer.minRadius + Math.random() * (layer.maxRadius - layer.minRadius);
  const radius = Math.max(STARFIELD_CONFIG.minRadius, Math.min(STARFIELD_CONFIG.maxRadius, rawRadius));
  const baseAlpha = layer.minAlpha + Math.random() * (layer.maxAlpha - layer.minAlpha);
  const rColor = Math.random();
  const palette =
    rColor < 0.70
      ? '241, 245, 249' // 70% soft silver
      : rColor < 0.88
        ? '165, 243, 252' // 18% cosmic cyan
        : '216, 180, 254'; // 12% subtle violet
  const twinkleRange = STARFIELD_CONFIG.twinkleMaxSpeedRadPerMs - STARFIELD_CONFIG.twinkleMinSpeedRadPerMs;
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    radius,
    baseAlpha,
    depth,
    vx: (0.08 + 0.12 * Math.random()) * depth,
    vy: (0.03 + 0.06 * Math.random()) * depth,
    color: palette,
    twinkleSpeed:
      Math.random() < STARFIELD_CONFIG.twinkleProbability
        ? STARFIELD_CONFIG.twinkleMinSpeedRadPerMs + Math.random() * twinkleRange
        : 0,
    twinklePhase: Math.random() * Math.PI * 2,
  };
}

/**
 * Initializes canvas 2D celestial starfield particle drift, scroll parallax, and damped orientation tilt.
 * Returns a teardown cleanup function that unregisters all listeners and halts animation frames.
 */
export function initStarfield(canvas: HTMLCanvasElement): () => void {
  if (typeof window === 'undefined') return () => {};

  if (!canvas || typeof canvas.getContext !== 'function') return () => {};

  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  const prefersReducedMotion =
    typeof window.matchMedia === 'function' &&
    Boolean(window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  let dpr = Math.min(getPositiveFinite(window.devicePixelRatio, 1), 2);
  let width = getPositiveFinite(window.innerWidth, 800);
  let height = getPositiveFinite(window.innerHeight, 600);

  const starCount = getTargetStarCount(width, height);
  const stars: Star[] = [];
  for (let i = 0; i < starCount; i++) {
    stars.push(createStar(width, height));
  }

  let hasOrientationData = false;
  let targetTiltX = 0;
  let targetTiltY = 0;
  let currentTiltX = 0;
  let currentTiltY = 0;

  const getScrollY = (): number => {
    const rawY =
      typeof window.scrollY === 'number'
        ? window.scrollY
        : typeof window.pageYOffset === 'number'
          ? window.pageYOffset
          : 0;
    return Number.isFinite(rawY) ? rawY : 0;
  };
  let targetScrollY = prefersReducedMotion ? 0 : getScrollY();
  let currentScrollY = targetScrollY;

  const getScreenAngle = (): number => {
    const legacyOrientation = (window as Window & { orientation?: unknown }).orientation;
    const rawAngle =
      typeof window.screen?.orientation?.angle === 'number'
        ? window.screen.orientation.angle
        : typeof legacyOrientation === 'number'
          ? legacyOrientation
          : 0;
    if (!Number.isFinite(rawAngle)) return 0;
    return (((Math.round(rawAngle / 90) * 90) % 360) + 360) % 360;
  };
  let screenAngle = getScreenAngle();

  const handleOrientationChange = () => {
    screenAngle = getScreenAngle();
    targetTiltX = 0;
    targetTiltY = 0;
  };

  const handleOrientation = (e: DeviceOrientationEvent) => {
    if (Number.isFinite(e.gamma) && Number.isFinite(e.beta)) {
      hasOrientationData = true;
      const gamma = e.gamma as number;
      const beta = e.beta as number;
      let screenXDeg = gamma;
      let screenYDeg = beta;
      if (screenAngle === 90) {
        // W3C 90 deg CCW landscape: screen top is +x (raising +x yields negative gamma)
        screenXDeg = beta;
        screenYDeg = -gamma;
      } else if (screenAngle === 180) {
        screenXDeg = -gamma;
        screenYDeg = -beta;
      } else if (screenAngle === 270) {
        screenXDeg = -beta;
        screenYDeg = gamma;
      }
      targetTiltX =
        Math.abs(screenXDeg) < 2.5 ? 0 : Math.max(-1, Math.min(1, screenXDeg / 30));
      targetTiltY = Math.max(-1, Math.min(1, (screenYDeg - 45) / 30));
    }
  };

  const handleDeviceMotion = (e: DeviceMotionEvent) => {
    if (hasOrientationData) return;
    const acc = e.accelerationIncludingGravity;
    if (!acc) return;

    let rawAccX: number | null = null;
    let rawAccY: number | null = null;
    if (screenAngle === 0) {
      // W3C DeviceMotionEvent in portrait: tilting right yields negative acc.x
      rawAccX = Number.isFinite(acc.x) ? -(acc.x as number) : null;
      rawAccY = Number.isFinite(acc.y) ? (acc.y as number) : null;
    } else if (screenAngle === 90) {
      rawAccX = Number.isFinite(acc.y) ? (acc.y as number) : null;
      rawAccY = Number.isFinite(acc.x) ? (acc.x as number) : null;
    } else if (screenAngle === 180) {
      rawAccX = Number.isFinite(acc.x) ? (acc.x as number) : null;
      rawAccY = Number.isFinite(acc.y) ? -(acc.y as number) : null;
    } else if (screenAngle === 270) {
      rawAccX = Number.isFinite(acc.y) ? -(acc.y as number) : null;
      rawAccY = Number.isFinite(acc.x) ? -(acc.x as number) : null;
    }

    if (rawAccX !== null) {
      const scaledX = rawAccX / 5;
      targetTiltX = Math.abs(scaledX) < 0.08 ? 0 : Math.max(-1, Math.min(1, scaledX));
    }
    if (rawAccY !== null) {
      targetTiltY = Math.max(-1, Math.min(1, (rawAccY - 4.9) / 5));
    }
  };

  const handleScroll = () => {
    targetScrollY = getScrollY();
  };

  let animationFrameId: number | undefined;
  let isHidden = typeof document !== 'undefined' ? Boolean(document.hidden) : false;
  let lastTime = getNow();

  const render = () => {
    ctx.clearRect(0, 0, width, height);

    const now = getNow();
    const dt = Math.min(Math.max((now - lastTime) / 16.67, 0.1), 3.0);
    lastTime = now;

    // Linear interpolation damping for tilt parallax (~0.08 factor at 60fps)
    const damping = 1 - Math.pow(1 - STARFIELD_CONFIG.tiltDampingFactor, dt);
    currentTiltX += (targetTiltX - currentTiltX) * damping;
    currentTiltY += (targetTiltY - currentTiltY) * damping;

    // Smooth vertical scroll parallax interpolation
    const scrollDamping = 1 - Math.pow(1 - STARFIELD_CONFIG.scrollDampingFactor, dt);
    currentScrollY += (targetScrollY - currentScrollY) * scrollDamping;

    for (const s of stars) {
      if (!prefersReducedMotion) {
        const accelDriftX = currentTiltX * STARFIELD_CONFIG.accelHorizontalSpeed * s.depth;
        s.x = wrapCoord(s.x + (s.vx + accelDriftX) * dt, width);
        s.y = wrapCoord(s.y + s.vy * dt, height);
      }

      const renderX = wrapCoord(
        s.x + currentTiltX * STARFIELD_CONFIG.tiltOffsetPx * s.depth,
        width
      );
      const renderY = wrapCoord(
        s.y -
          currentScrollY * STARFIELD_CONFIG.scrollParallaxFactor * s.depth +
          currentTiltY * STARFIELD_CONFIG.tiltOffsetPx * s.depth,
        height
      );

      const rawAlpha =
        s.twinkleSpeed > 0 && !prefersReducedMotion
          ? s.baseAlpha * (0.55 + 0.45 * Math.sin(now * s.twinkleSpeed + s.twinklePhase))
          : s.baseAlpha;
      const alpha = Math.max(
        STARFIELD_CONFIG.minAlpha,
        Math.min(STARFIELD_CONFIG.maxAlpha, rawAlpha)
      );

      if (s.depth === 1.0) {
        ctx.shadowBlur = 6;
        ctx.shadowColor = `rgba(${s.color}, 0.65)`;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.fillStyle = `rgba(${s.color}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(renderX, renderY, s.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    if (!prefersReducedMotion && !isHidden && typeof requestAnimationFrame === 'function') {
      animationFrameId = requestAnimationFrame(render);
    }
  };

  const resize = () => {
    dpr = Math.min(getPositiveFinite(window.devicePixelRatio, 1), 2);
    const newWidth = getPositiveFinite(window.innerWidth, 800);
    const newHeight = getPositiveFinite(window.innerHeight, 600);
    if (newWidth !== width || newHeight !== height) {
      const scaleX = newWidth / (width || 1);
      const scaleY = newHeight / (height || 1);
      width = newWidth;
      height = newHeight;
      for (const s of stars) {
        s.x = s.x * scaleX;
        s.y = s.y * scaleY;
      }
      const targetCount = getTargetStarCount(width, height);
      while (stars.length < targetCount) {
        stars.push(createStar(width, height));
      }
      if (stars.length > targetCount) {
        stars.length = targetCount;
      }
    }

    const backingWidth = Math.floor(width * dpr);
    const backingHeight = Math.floor(height * dpr);
    if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
      canvas.width = backingWidth;
      canvas.height = backingHeight;
    }
    if (typeof ctx.setTransform === 'function') {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    // Canvas dimensions change clears buffer; under reduced motion, immediately redraw static frame
    if (prefersReducedMotion) {
      render();
    }
  };
  resize();

  const screenOrientation =
    typeof window.screen !== 'undefined' ? window.screen?.orientation : undefined;

  let isOrientationAttached = false;
  const attachOrientation = () => {
    if (
      !isOrientationAttached &&
      typeof window !== 'undefined' &&
      typeof window.addEventListener === 'function'
    ) {
      window.addEventListener('deviceorientation', handleOrientation);
      isOrientationAttached = true;
    }
  };
  const detachOrientation = () => {
    if (
      isOrientationAttached &&
      typeof window !== 'undefined' &&
      typeof window.removeEventListener === 'function'
    ) {
      window.removeEventListener('deviceorientation', handleOrientation);
      isOrientationAttached = false;
    }
  };

  const handlePermissionChange = (e: Event) => {
    const customEvent = e as CustomEvent<{ state: OrientationPermissionState }>;
    if (customEvent.detail?.state === 'granted') {
      attachOrientation();
    } else if (customEvent.detail?.state === 'denied') {
      targetTiltX = 0;
      targetTiltY = 0;
    }
  };

  if (typeof window.addEventListener === 'function') {
    if (!prefersReducedMotion) {
      // Attach orientation listener by default; browsers that withhold sensor
      // events cleanly fall back to autonomous celestial drift.
      attachOrientation();
      window.addEventListener('devicemotion', handleDeviceMotion);
      window.addEventListener('scroll', handleScroll, { passive: true });
      window.addEventListener('orientationchange', handleOrientationChange);
      if (screenOrientation && typeof screenOrientation.addEventListener === 'function') {
        screenOrientation.addEventListener('change', handleOrientationChange);
      }
      window.addEventListener(
        'oneiromancy:orientation-permission-changed',
        handlePermissionChange as EventListener
      );
    }
    window.addEventListener('resize', resize);
  }

  const handleVisibility = () => {
    if (typeof document === 'undefined') return;
    const wasHidden = isHidden;
    isHidden = Boolean(document.hidden);
    if (isHidden) {
      // Tab hidden: freeze animation loop to conserve battery
      if (animationFrameId !== undefined && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = undefined;
      }
    } else if (wasHidden && !prefersReducedMotion) {
      // Tab restored: resume animation loop with fresh timestamp
      lastTime = getNow();
      if (typeof requestAnimationFrame === 'function') {
        animationFrameId = requestAnimationFrame(render);
      }
    }
  };

  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', handleVisibility);
  }

  // Under reduced motion, resize() has already executed static render().
  if (!prefersReducedMotion && !isHidden && typeof requestAnimationFrame === 'function') {
    animationFrameId = requestAnimationFrame(render);
  }

  return () => {
    detachOrientation();
    if (typeof window.removeEventListener === 'function') {
      window.removeEventListener('devicemotion', handleDeviceMotion);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener(
        'oneiromancy:orientation-permission-changed',
        handlePermissionChange as EventListener
      );
      window.removeEventListener('resize', resize);
    }
    if (screenOrientation && typeof screenOrientation.removeEventListener === 'function') {
      screenOrientation.removeEventListener('change', handleOrientationChange);
    }
    if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
      document.removeEventListener('visibilitychange', handleVisibility);
    }
    if (animationFrameId !== undefined && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = undefined;
    }
  };
}

export const StarfieldBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    return initStarfield(canvasRef.current);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      data-testid="starfield-canvas"
      aria-hidden="true"
      tabIndex={-1}
      className="fixed inset-0 pointer-events-none -z-10 w-full h-full"
    />
  );
};

export default StarfieldBackground;
