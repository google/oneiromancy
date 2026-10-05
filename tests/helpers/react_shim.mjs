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
 * Oneiromancy - Universal React & JSX Shim for Node.js 22
 * 
 * Provides hermetic runtime implementations of React, JSX runtime,
 * lucide-react, clsx, and tailwind-merge so that all Next.js React components
 * in oneiromancy can be imported, evaluated, and tested directly
 * within Node.js without requiring external node_modules or browser runtime.
 */

// JSX Runtime primitives
export const Fragment = Symbol.for('react.fragment');

export function jsx(type, props, ...extra) {
  const finalProps = { ...props };
  if (finalProps.children === undefined && extra.length > 0) {
    finalProps.children = extra.length === 1 ? extra[0] : extra;
  } else if (extra.length === 1 && typeof extra[0] === 'string' && finalProps.key === undefined) {
    finalProps.key = extra[0];
  }
  return {
    $$typeof: Symbol.for('react.element'),
    type,
    props: finalProps,
    key: finalProps.key !== undefined ? finalProps.key : null,
  };
}

export const jsxs = jsx;
export const jsxDEV = jsx;

// React Hook Store & Re-render Dispatcher
let currentInstance = null;
let currentHookIndex = 0;
let reRenderListener = null;
const hookStores = new Map();
let activeCleanups = [];

let pendingEffects = [];

export function setReRenderListener(listener) {
  reRenderListener = listener;
}

export function withComponentInstance(instanceId, fn) {
  const prevInstance = currentInstance;
  const prevIndex = currentHookIndex;
  currentInstance = instanceId;
  currentHookIndex = 0;
  try {
    return fn();
  } finally {
    currentInstance = prevInstance;
    currentHookIndex = prevIndex;
  }
}

function getHookStore(instanceId) {
  if (!hookStores.has(instanceId)) {
    hookStores.set(instanceId, []);
  }
  return hookStores.get(instanceId);
}

export function clearHookStores() {
  hookStores.clear();
  pendingEffects = [];
  cleanupEffects();
}

function depsEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) return false;
  }
  return true;
}

// React Hooks & State Primitives
export function createContext(defaultValue) {
  const context = {
    $$typeof: Symbol.for('react.context'),
    _currentValue: defaultValue,
    Provider: function Provider({ value, children }) {
      context._currentValue = value !== undefined ? value : defaultValue;
      return {
        $$typeof: Symbol.for('react.element'),
        type: 'Provider',
        props: { value, children },
        _context: context,
      };
    },
    Consumer: function Consumer({ children }) {
      return children(context._currentValue);
    },
  };
  return context;
}

export function useContext(context) {
  return context?._currentValue;
}

export function useState(initial) {
  if (!currentInstance) {
    let val = typeof initial === 'function' ? initial() : initial;
    const setter = (next) => {
      val = typeof next === 'function' ? next(val) : next;
      if (reRenderListener) reRenderListener();
    };
    return [val, setter];
  }
  const store = getHookStore(currentInstance);
  const hookIdx = currentHookIndex++;
  if (store[hookIdx] === undefined) {
    store[hookIdx] = typeof initial === 'function' ? initial() : initial;
  }
  const setter = (next) => {
    store[hookIdx] = typeof next === 'function' ? next(store[hookIdx]) : next;
    if (reRenderListener) reRenderListener();
  };
  return [store[hookIdx], setter];
}

export function useEffect(callback, deps) {
  if (!currentInstance) {
    try {
      const cleanup = callback();
      if (typeof cleanup === 'function') activeCleanups.push(cleanup);
    } catch {}
    return;
  }
  const store = getHookStore(currentInstance);
  const hookIdx = currentHookIndex++;
  const prev = store[hookIdx];
  if (!prev || !deps || !depsEqual(prev.deps, deps)) {
    pendingEffects.push({
      store,
      hookIdx,
      callback,
      deps,
      prevCleanup: prev?.cleanup,
    });
  }
}

export function flushPendingEffects() {
  if (pendingEffects.length === 0) return false;
  const effectsToRun = [...pendingEffects];
  pendingEffects = [];
  for (const eff of effectsToRun) {
    if (eff.prevCleanup && typeof eff.prevCleanup === 'function') {
      try { eff.prevCleanup(); } catch {}
    }
    try {
      const cleanup = eff.callback();
      eff.store[eff.hookIdx] = { cleanup, deps: eff.deps };
      if (typeof cleanup === 'function') activeCleanups.push(cleanup);
    } catch (e) {
      eff.store[eff.hookIdx] = { cleanup: null, deps: eff.deps };
      throw e;
    }
  }
  return true;
}

export function cleanupEffects() {
  for (const cleanup of activeCleanups) {
    try {
      cleanup();
    } catch {}
  }
  activeCleanups = [];
}

export function useLayoutEffect(callback, deps) {
  return useEffect(callback, deps);
}

export function useRef(initial) {
  if (!currentInstance) {
    return { current: initial };
  }
  const store = getHookStore(currentInstance);
  const hookIdx = currentHookIndex++;
  if (store[hookIdx] === undefined) {
    store[hookIdx] = { current: initial };
  }
  return store[hookIdx];
}

export function useMemo(factory, deps) {
  if (!currentInstance) {
    return factory();
  }
  const store = getHookStore(currentInstance);
  const hookIdx = currentHookIndex++;
  const prev = store[hookIdx];
  if (!prev || !deps || !depsEqual(prev.deps, deps)) {
    const value = factory();
    store[hookIdx] = { value, deps };
    return value;
  }
  return prev.value;
}

export function useCallback(callback, deps) {
  return useMemo(() => callback, deps);
}

export function memo(component) {
  return component;
}

export function forwardRef(render) {
  return function ForwardRefComponent(props) {
    return render(props, null);
  };
}

export function createElement(type, props, ...children) {
  const processedChildren = children.length === 0 ? undefined : children.length === 1 ? children[0] : children;
  return jsx(type, { ...props, children: processedChildren });
}

// Utility styling functions (clsx, tailwind-merge)
export function clsx(...args) {
  return args
    .flat(Infinity)
    .filter((x) => typeof x === 'string' && x.length > 0)
    .join(' ');
}

export function twMerge(...args) {
  return clsx(...args);
}

// Lucide icon helper
function createLucideIcon(name) {
  return function LucideIcon(props) {
    return jsx('svg', { 'data-lucide': name, ...props });
  };
}

export const Sparkles = createLucideIcon('sparkles');
export const LayoutGrid = createLucideIcon('layout-grid');
export const Compass = createLucideIcon('compass');
export const Scale = createLucideIcon('scale');
export const Settings = createLucideIcon('settings');
export const Swords = createLucideIcon('swords');
export const Trophy = createLucideIcon('trophy');
export const Zap = createLucideIcon('zap');
export const Check = createLucideIcon('check');
export const CheckCircle2 = createLucideIcon('check-circle-2');
export const Crown = createLucideIcon('crown');
export const AlertCircle = createLucideIcon('alert-circle');
export const ChevronDown = createLucideIcon('chevron-down');
export const ChevronUp = createLucideIcon('chevron-up');
export const ChevronRight = createLucideIcon('chevron-right');
export const ChevronLeft = createLucideIcon('chevron-left');
export const X = createLucideIcon('x');
export const Shield = createLucideIcon('shield');
export const ArrowRightLeft = createLucideIcon('arrow-right-left');
export const ArrowUpRight = createLucideIcon('arrow-up-right');
export const ArrowRight = createLucideIcon('arrow-right');
export const ArrowLeft = createLucideIcon('arrow-left');
export const ArrowDown = createLucideIcon('arrow-down');
export const ArrowUp = createLucideIcon('arrow-up');
export const ArrowUpDown = createLucideIcon('arrow-up-down');
export const SlidersHorizontal = createLucideIcon('sliders-horizontal');
export const RefreshCw = createLucideIcon('refresh-cw');
export const Globe = createLucideIcon('globe');
export const ExternalLink = createLucideIcon('external-link');
export const TrendingUp = createLucideIcon('trending-up');
export const TrendingDown = createLucideIcon('trending-down');
export const BarChart2 = createLucideIcon('bar-chart-2');
export const Flame = createLucideIcon('flame');
export const Droplet = createLucideIcon('droplet');
export const Wind = createLucideIcon('wind');
export const Mountain = createLucideIcon('mountain');
export const Layers = createLucideIcon('layers');
export const Eye = createLucideIcon('eye');
export const Activity = createLucideIcon('activity');
export const AlertTriangle = createLucideIcon('alert-triangle');
export const Search = createLucideIcon('search');
export const Calendar = createLucideIcon('calendar');
export const Moon = createLucideIcon('moon');
export const Sun = createLucideIcon('sun');
export const Clock = createLucideIcon('clock');
export const MapPin = createLucideIcon('map-pin');
export const BookOpen = createLucideIcon('book-open');
export const Orbit = createLucideIcon('orbit');
export const Brain = createLucideIcon('brain');
export const Hash = createLucideIcon('hash');
export const Info = createLucideIcon('info');
export const Users = createLucideIcon('users');
export const User = createLucideIcon('user');
export const Star = createLucideIcon('star');
export const HelpCircle = createLucideIcon('help-circle');
export const ZapOff = createLucideIcon('zap-off');

export default {
  Fragment,
  jsx,
  jsxs,
  jsxDEV,
  createContext,
  useContext,
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
  useCallback,
  memo,
  forwardRef,
  createElement,
  clsx,
  twMerge,
};
