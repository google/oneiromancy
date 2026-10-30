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
 * Oneiromancy - React Testing Library (RTL) Execution Wrapper
 *
 * Lightweight, hermetic React Component Testing Environment for Node.js 22
 * backed by real React 18 (`react`, `react/jsx-runtime`, `react-dom/server`).
 * Evaluates compiled React functional components, unwinds subtrees, resolves
 * JSX structures and OneiromancyContext, and builds an inspectable Virtual DOM tree.
 *
 * Implements standard RTL & Jest testing primitives:
 * - render(ui, options)
 * - screen.getByTestId(id), screen.queryByTestId(id)
 * - screen.getByText(textOrRegex), screen.queryByText(textOrRegex)
 * - screen.getByRole(role, options), screen.getAllByRole(role)
 * - fireEvent.click(element), fireEvent.change(element, eventData)
 * - waitFor(callback, options)
 * - act(callback)
 */

import assert from 'node:assert/strict';
import React from 'react';
import { jsx as realJsx, jsxs as realJsxs, Fragment as realFragment } from 'react/jsx-runtime';
import {
  renderToStaticMarkup as realRenderToStaticMarkup,
  renderToString as realRenderToString,
} from 'react-dom/server';

export const Fragment = realFragment;

export function jsx(type, props, ...extra) {
  const finalProps = { ...props };
  if (finalProps.children === undefined && extra.length > 0) {
    finalProps.children = extra.length === 1 ? extra[0] : extra;
  }
  const key =
    finalProps.key !== undefined
      ? finalProps.key
      : extra.length === 1 &&
          (typeof extra[0] === 'string' || typeof extra[0] === 'number') &&
          props?.children !== undefined
        ? extra[0]
        : undefined;
  delete finalProps.key;
  return realJsx(type, finalProps, key);
}

export const jsxs = jsx;
export const jsxDEV = jsx;
export const createElement = React.createElement;
export const renderToStaticMarkup = realRenderToStaticMarkup;
export const renderToString = realRenderToString;

// React Hook Store & Re-render Dispatcher for interactive VNode evaluation
let currentInstance = null;
let currentHookIndex = 0;
let reRenderListener = null;
let renderGeneration = 0;
const hookStores = new Map();
let activeCleanups = [];
let activeTimers = [];
let pendingEffects = [];

function runWithUnrefTimers(fn) {
  const origSetInterval = globalThis.setInterval;
  const origSetTimeout = globalThis.setTimeout;
  globalThis.setInterval = (...args) => {
    const t = origSetInterval(...args);
    if (t && typeof t.unref === 'function') t.unref();
    activeTimers.push({ type: 'interval', id: t });
    return t;
  };
  globalThis.setTimeout = (...args) => {
    const t = origSetTimeout(...args);
    if (t && typeof t.unref === 'function') t.unref();
    activeTimers.push({ type: 'timeout', id: t });
    return t;
  };
  try {
    return fn();
  } finally {
    globalThis.setInterval = origSetInterval;
    globalThis.setTimeout = origSetTimeout;
  }
}

export function setReRenderListener(listener) {
  reRenderListener = listener;
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
  if (!(hookIdx in store)) {
    store[hookIdx] = typeof initial === 'function' ? initial() : initial;
  }
  const gen = renderGeneration;
  const setter = (next) => {
    if (gen !== renderGeneration) return;
    store[hookIdx] = typeof next === 'function' ? next(store[hookIdx]) : next;
    if (reRenderListener) reRenderListener();
  };
  return [store[hookIdx], setter];
}

export function useReducer(reducer, initialArg, init) {
  const [state, setState] = useState(() => (typeof init === 'function' ? init(initialArg) : initialArg));
  const dispatch = (action) => {
    setState((prev) => reducer(prev, action));
  };
  return [state, dispatch];
}

export function useEffect(callback, deps) {
  if (!currentInstance) {
    const cleanup = callback();
    if (typeof cleanup === 'function') activeCleanups.push(cleanup);
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
      eff.prevCleanup();
    }
    const cleanup = runWithUnrefTimers(() => eff.callback());
    eff.store[eff.hookIdx] = { cleanup, deps: eff.deps };
    if (typeof cleanup === 'function') activeCleanups.push(cleanup);
  }
  return true;
}

export function cleanupEffects() {
  const cleanups = [...activeCleanups];
  activeCleanups = [];
  for (const cleanup of cleanups) {
    if (typeof cleanup === 'function') {
      cleanup();
    }
  }
  const timers = [...activeTimers];
  activeTimers = [];
  for (const t of timers) {
    if (t.type === 'interval') clearInterval(t.id);
    else clearTimeout(t.id);
  }
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
  if (!(hookIdx in store)) {
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

const interactiveDispatcher = {
  useState,
  useReducer,
  useEffect,
  useLayoutEffect,
  useInsertionEffect: useEffect,
  useRef,
  useMemo,
  useCallback,
  useContext,
  useId: () => ':r0:',
  useTransition: () => [false, (fn) => fn()],
  useDeferredValue: (v) => v,
  useSyncExternalStore: (_sub, getSnapshot) => getSnapshot(),
  useImperativeHandle: () => {},
  useDebugValue: () => {},
};

const reactSharedInternals =
  React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?.ReactCurrentDispatcher;

export function withComponentInstance(instanceId, fn) {
  const prevInstance = currentInstance;
  const prevIndex = currentHookIndex;
  const prevDispatcher = reactSharedInternals ? reactSharedInternals.current : null;
  currentInstance = instanceId;
  currentHookIndex = 0;
  if (reactSharedInternals) {
    reactSharedInternals.current = interactiveDispatcher;
  }
  try {
    return fn();
  } finally {
    if (reactSharedInternals) {
      reactSharedInternals.current = prevDispatcher;
    }
    currentInstance = prevInstance;
    currentHookIndex = prevIndex;
  }
}

// Global state tracking rendered trees
let currentContainer = null;
let currentRootUI = null;
let currentRenderOptions = null;

export class VNode {
  constructor(tag, props = {}, children = []) {
    this.tag = tag;
    this.props = props || {};
    this.children = children || [];
    this.parentNode = null;

    for (const child of this.children) {
      if (child instanceof VNode) {
        child.parentNode = this;
      }
    }
  }

  get id() {
    return this.props.id || '';
  }

  get className() {
    return this.props.className || '';
  }

  getAttribute(name) {
    if (name === 'class' || name === 'className') return this.props.className || null;
    if (name === 'data-testid') return this.props['data-testid'] || null;
    return this.props[name] !== undefined ? String(this.props[name]) : null;
  }

  hasAttribute(name) {
    return this.getAttribute(name) !== null;
  }

  get textContent() {
    let text = '';
    for (const child of this.children) {
      if (typeof child === 'string' || typeof child === 'number') {
        text += String(child);
      } else if (child instanceof VNode) {
        text += child.textContent;
      }
    }
    return text;
  }

  querySelector(selector) {
    const results = this.querySelectorAll(selector);
    return results.length > 0 ? results[0] : null;
  }

  querySelectorAll(selector) {
    const results = [];
    const walk = (node) => {
      if (node instanceof VNode) {
        let matches = false;
        if (selector.startsWith('#')) {
          const targetId = selector.slice(1);
          if (node.props.id === targetId) matches = true;
        } else if (selector.startsWith('.')) {
          const targetClass = selector.slice(1);
          if (node.className.split(/\s+/).includes(targetClass)) matches = true;
        } else if (selector.startsWith('[')) {
          const attrMatch = selector.match(/^\[([\w-]+)(?:=["']?([^"'\]]+)["']?)?\]$/);
          if (attrMatch) {
            const [, attr, val] = attrMatch;
            const attrVal = node.getAttribute(attr);
            if (val !== undefined ? attrVal === val : attrVal !== null) {
              matches = true;
            }
          }
        } else if (node.tag === selector) {
          matches = true;
        }

        if (matches) results.push(node);

        for (const c of node.children) {
          walk(c);
        }
      }
    };

    for (const child of this.children) {
      walk(child);
    }
    return results;
  }

  findByTestId(testId) {
    return this.querySelector('[data-testid="' + testId + '"]');
  }

  findAllByTestId(testId) {
    return this.querySelectorAll('[data-testid="' + testId + '"]');
  }

  findByText(textOrRegex) {
    const isMatch = (str) =>
      textOrRegex instanceof RegExp ? textOrRegex.test(str) : str.includes(textOrRegex);

    let match = null;
    const walk = (node) => {
      if (match) return;
      if (node instanceof VNode) {
        if (isMatch(node.textContent)) {
          let childMatches = false;
          for (const c of node.children) {
            if (c instanceof VNode && isMatch(c.textContent)) {
              childMatches = true;
              break;
            }
          }
          if (!childMatches) {
            match = node;
            return;
          }
        }
        for (const c of node.children) {
          walk(c);
        }
      }
    };
    walk(this);
    return match;
  }

  findByPlaceholderText(textOrRegex) {
    const isMatch = (str) =>
      textOrRegex instanceof RegExp ? textOrRegex.test(str) : (str || '').includes(textOrRegex);

    let match = null;
    const walk = (node) => {
      if (match) return;
      if (node instanceof VNode) {
        const ph = node.getAttribute('placeholder');
        if (ph && isMatch(ph)) {
          match = node;
          return;
        }
        for (const c of node.children) {
          walk(c);
        }
      }
    };
    walk(this);
    return match;
  }
}

/**
 * Evaluates React element tree recursively into VNode tree without swallowing render errors.
 */
export function evaluateElement(element, contextValue = null, depth = 0, pathKey = 'root') {
  if (element === null || element === undefined || typeof element === 'boolean') {
    return null;
  }

  if (typeof element === 'string' || typeof element === 'number') {
    return String(element);
  }

  if (Array.isArray(element)) {
    return element
      .map((c, i) => evaluateElement(c, contextValue, depth, `${pathKey}.${i}`))
      .filter((c) => c !== null);
  }

  if (typeof element !== 'object') {
    return null;
  }

  const { type, props } = element;
  const mergedProps = { ...props };
  const rawChildren = props?.children;

  // React Fragment
  if (typeof type === 'symbol' || type === '' || type === undefined) {
    const children = evaluateElement(rawChildren, contextValue, depth, `${pathKey}.frag`);
    return Array.isArray(children) ? children : children ? [children] : [];
  }

  // Functional Component: run within instance scope and fail immediately on render exception
  if (typeof type === 'function') {
    const instanceKey = `${type.name || 'Component'}_${depth}_${element.key || props?.key || props?.['data-testid'] || pathKey}`;
    const componentOutput = withComponentInstance(instanceKey, () => type(mergedProps));
    return evaluateElement(componentOutput, contextValue, depth + 1, `${pathKey}.fn`);
  }

  // React.forwardRef
  if (type && typeof type === 'object' && type.$$typeof === Symbol.for('react.forward_ref')) {
    const instanceKey = `${type.displayName || type.render?.name || 'ForwardRef'}_${depth}_${element.key || props?.key || pathKey}`;
    const componentOutput = withComponentInstance(instanceKey, () =>
      type.render(mergedProps, element.ref || null)
    );
    return evaluateElement(componentOutput, contextValue, depth + 1, `${pathKey}.fwd`);
  }

  // React.memo
  if (type && typeof type === 'object' && type.$$typeof === Symbol.for('react.memo')) {
    return evaluateElement({ ...element, type: type.type }, contextValue, depth, `${pathKey}.memo`);
  }

  // Context Provider
  if (type && typeof type === 'object' && type.$$typeof === Symbol.for('react.provider')) {
    const ctx = type._context;
    const prevValue = ctx._currentValue;
    ctx._currentValue = mergedProps.value !== undefined ? mergedProps.value : prevValue;
    try {
      return evaluateElement(rawChildren, mergedProps.value, depth, `${pathKey}.ctx`);
    } finally {
      ctx._currentValue = prevValue;
    }
  }

  // Context Consumer
  if (
    type &&
    typeof type === 'object' &&
    (type.$$typeof === Symbol.for('react.context') || type.$$typeof === Symbol.for('react.consumer'))
  ) {
    const ctx = type._context || type;
    const renderFn = typeof rawChildren === 'function' ? rawChildren : null;
    if (renderFn) {
      return evaluateElement(renderFn(ctx._currentValue), contextValue, depth, `${pathKey}.cons`);
    }
    return evaluateElement(rawChildren, contextValue, depth, `${pathKey}.cons`);
  }

  // Intrinsic DOM elements (div, button, span, etc.)
  const tag = typeof type === 'string' ? type : 'div';
  let processedChildren = [];
  if (rawChildren !== undefined) {
    const evaluated = evaluateElement(rawChildren, contextValue, depth, `${pathKey}.dom`);
    if (Array.isArray(evaluated)) {
      processedChildren = evaluated.flat(Infinity);
    } else if (evaluated !== null) {
      processedChildren = [evaluated];
    }
  }

  return new VNode(tag, mergedProps, processedChildren);
}

let isRendering = false;
let reRenderScheduled = false;
const MAX_RENDER_PASSES = 10;

function doReRender() {
  if (isRendering) {
    reRenderScheduled = true;
    return;
  }
  if (!currentRootUI) return;

  isRendering = true;
  try {
    let pass = 0;
    while (pass < MAX_RENDER_PASSES) {
      pass++;
      reRenderScheduled = false;
      const vnode = evaluateElement(currentRootUI, currentRenderOptions?.context || null);
      const container = new VNode('div', { id: '__test_container__' }, Array.isArray(vnode) ? vnode : [vnode]);
      currentContainer = container;
      const hadEffects = flushPendingEffects();
      if (!hadEffects && !reRenderScheduled) {
        break;
      }
    }
  } finally {
    isRendering = false;
  }
}

/**
 * Standard RTL render method with reactive stateful re-rendering
 */
export function render(ui, options = {}) {
  renderGeneration++;
  clearHookStores();
  currentRootUI = ui;
  currentRenderOptions = options;
  setReRenderListener(doReRender);

  doReRender();
  return {
    get container() {
      return currentContainer;
    },
    getByTestId: (id) => {
      const el = currentContainer.findByTestId(id);
      assert.ok(el, 'Unable to find element with data-testid="' + id + '"');
      return el;
    },
    queryByTestId: (id) => currentContainer?.findByTestId(id),
    getAllByTestId: (id) => currentContainer?.findAllByTestId(id) || [],
    getByText: (text) => {
      const el = currentContainer.findByText(text);
      assert.ok(el, 'Unable to find element containing text: ' + text);
      return el;
    },
    queryByText: (text) => currentContainer?.findByText(text),
    getByPlaceholderText: (text) => {
      const el = currentContainer.findByPlaceholderText(text);
      assert.ok(el, 'Unable to find element with placeholder matching: ' + text);
      return el;
    },
    queryByPlaceholderText: (text) => currentContainer?.findByPlaceholderText(text),
    getByRole: (role, opts = {}) => {
      const els = currentContainer.querySelectorAll(role);
      const withRole = currentContainer.querySelectorAll('[role="' + role + '"]');
      const all = [...els, ...withRole];
      if (opts.name) {
        const matching = all.find((el) => {
          const name = el.getAttribute('aria-label') || el.textContent;
          return typeof opts.name === 'string' ? name.includes(opts.name) : opts.name.test(name);
        });
        assert.ok(matching, 'Unable to find role="' + role + '" with name matching: ' + opts.name);
        return matching;
      }
      assert.ok(all.length > 0, 'Unable to find element with role="' + role + '"');
      return all[0];
    },
    rerender: (newUi) => {
      currentRootUI = newUi;
      doReRender();
    },
    unmount: () => {
      setReRenderListener(null);
      cleanupEffects();
      clearHookStores();
      currentContainer = null;
      currentRootUI = null;
    },
  };
}

/**
 * Standard RTL screen selectors
 */
export const screen = {
  getByTestId: (id) => {
    assert.ok(currentContainer, 'No rendered container found. Call render() first.');
    const el = currentContainer.findByTestId(id);
    assert.ok(el, 'Unable to find element with data-testid="' + id + '"');
    return el;
  },
  queryByTestId: (id) => currentContainer?.findByTestId(id) || null,
  getAllByTestId: (id) => currentContainer?.findAllByTestId(id) || [],
  getByText: (text) => {
    assert.ok(currentContainer, 'No rendered container found. Call render() first.');
    const el = currentContainer.findByText(text);
    assert.ok(el, 'Unable to find element containing text: ' + text);
    return el;
  },
  queryByText: (text) => currentContainer?.findByText(text) || null,
  getByPlaceholderText: (text) => {
    assert.ok(currentContainer, 'No rendered container found. Call render() first.');
    const el = currentContainer.findByPlaceholderText(text);
    assert.ok(el, 'Unable to find element with placeholder matching: ' + text);
    return el;
  },
  queryByPlaceholderText: (text) => currentContainer?.findByPlaceholderText(text) || null,
  getByRole: (role, opts = {}) => {
    assert.ok(currentContainer, 'No rendered container found. Call render() first.');
    const els = currentContainer.querySelectorAll(role);
    const withRole = currentContainer.querySelectorAll('[role="' + role + '"]');
    const all = [...els, ...withRole];
    if (opts.name) {
      const matching = all.find((el) => {
        const name = el.getAttribute('aria-label') || el.textContent;
        return typeof opts.name === 'string' ? name.includes(opts.name) : opts.name.test(name);
      });
      assert.ok(matching, 'Unable to find role="' + role + '" with name matching: ' + opts.name);
      return matching;
    }
    assert.ok(all.length > 0, 'Unable to find element with role="' + role + '"');
    return all[0];
  },
  getAllByRole: (role) => {
    if (!currentContainer) return [];
    const els = currentContainer.querySelectorAll(role);
    const withRole = currentContainer.querySelectorAll('[role="' + role + '"]');
    return [...els, ...withRole];
  },
};

/**
 * Standard RTL fireEvent
 */
export const fireEvent = {
  click: (element) => {
    assert.ok(element, 'fireEvent.click called on null/undefined element');
    let curr = element;
    while (curr) {
      if (typeof curr.props?.onClick === 'function') {
        curr.props.onClick({
          preventDefault: () => {},
          stopPropagation: () => {},
          target: element,
          currentTarget: curr,
        });
        break;
      }
      curr = curr.parentNode;
    }
  },
  change: (element, eventData = {}) => {
    assert.ok(element, 'fireEvent.change called on null/undefined element');
    if (typeof element.props?.onChange === 'function') {
      element.props.onChange({
        preventDefault: () => {},
        stopPropagation: () => {},
        target: { ...element, ...(eventData.target || {}) },
        currentTarget: element,
        ...eventData,
      });
    }
  },
  input: (element, eventData = {}) => {
    assert.ok(element, 'fireEvent.input called on null/undefined element');
    if (typeof element.props?.onInput === 'function') {
      element.props.onInput({
        preventDefault: () => {},
        stopPropagation: () => {},
        target: { ...element, ...(eventData.target || {}) },
        currentTarget: element,
        ...eventData,
      });
    }
  },
};

/**
 * Standard RTL act method
 */
export async function act(callback) {
  const result = callback();
  if (result instanceof Promise) {
    await result;
  }
  doReRender();
  return result;
}

/**
 * Standard RTL waitFor method
 */
export async function waitFor(callback, { timeout = 2000, interval = 50 } = {}) {
  const startTime = Date.now();
  let lastError = null;

  while (Date.now() - startTime < timeout) {
    try {
      const res = callback();
      if (res !== false) {
        return res;
      }
    } catch (err) {
      lastError = err;
    }
    await new Promise((r) => setTimeout(r, interval));
  }

  throw lastError || new Error(`waitFor timed out after ${timeout}ms`);
}

/**
 * Standard RTL cleanup method
 */
export function cleanup() {
  renderGeneration++;
  setReRenderListener(null);
  cleanupEffects();
  clearHookStores();
  currentContainer = null;
  currentRootUI = null;
  currentRenderOptions = null;
}

export default {
  Fragment,
  jsx,
  jsxs,
  jsxDEV,
  createElement,
  renderToStaticMarkup,
  renderToString,
  render,
  screen,
  fireEvent,
  act,
  waitFor,
  cleanup,
};
