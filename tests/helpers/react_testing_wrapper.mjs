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
 * Lightweight, hermetic React Component Testing Environment for Node.js 22.
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
import {
  cleanupEffects,
  clearHookStores,
  flushPendingEffects,
  setReRenderListener,
  withComponentInstance,
} from './react_shim.mjs';

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
    const instanceKey = `${type.name || 'Component'}_${depth}_${props?.key || props?.['data-testid'] || pathKey}`;
    const componentOutput = withComponentInstance(instanceKey, () => type(mergedProps));
    return evaluateElement(componentOutput, contextValue, depth + 1, `${pathKey}.fn`);
  }

  // Context Provider or Consumer
  if (type && typeof type === 'object' && ('_context' in type || 'Provider' in type)) {
    const nextContext = mergedProps.value !== undefined ? mergedProps.value : contextValue;
    return evaluateElement(rawChildren, nextContext, depth, `${pathKey}.ctx`);
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
  clearHookStores();
  currentRootUI = ui;
  currentRenderOptions = options;
  setReRenderListener(doReRender);

  doReRender();
  const container = currentContainer;

  return {
    container,
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
  cleanupEffects();
  clearHookStores();
  currentContainer = null;
  currentRootUI = null;
  currentRenderOptions = null;
}
