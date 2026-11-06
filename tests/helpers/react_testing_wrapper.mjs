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
 * Hermetic React Component Testing Environment for Node.js backed by genuine
 * React 19 (`react`, `react/jsx-runtime`, `react-dom/client`, `react-dom/server`)
 * and a W3C DOM node implementation (`document`, `Element`, `Text`, `Comment`, `Event`).
 */

import assert from 'node:assert/strict';
import React, { act as reactAct } from 'react';
import { jsx as realJsx, Fragment as realFragment } from 'react/jsx-runtime';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

export const Fragment = realFragment;
export const StrictMode = React.StrictMode;
export { React };

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

function runWithUnrefTimers(fn) {
  const origSetInterval = globalThis.setInterval;
  const origSetTimeout = globalThis.setTimeout;
  globalThis.setInterval = (...args) => {
    const t = origSetInterval(...args);
    if (t && typeof t.unref === 'function') t.unref();
    return t;
  };
  globalThis.setTimeout = (cb, delay, ...rest) => {
    const t = origSetTimeout(cb, delay, ...rest);
    if (Number(delay) >= 1000 && t && typeof t.unref === 'function') t.unref();
    return t;
  };
  try {
    return fn();
  } finally {
    globalThis.setInterval = origSetInterval;
    globalThis.setTimeout = origSetTimeout;
  }
}

// ============================================================================
// Lightweight W3C DOM Node Implementation for React 19 `react-dom/client`
// ============================================================================

export class DOMEvent {
  constructor(type, init = {}) {
    this.type = String(type);
    this.bubbles = Boolean(init.bubbles ?? true);
    this.cancelable = Boolean(init.cancelable ?? true);
    this.defaultPrevented = false;
    this.target = null;
    this.currentTarget = null;
    this.eventPhase = 0;
    this._propagationStopped = false;
    this._immediatePropagationStopped = false;
    for (const [k, v] of Object.entries(init)) {
      if (!(k in this)) this[k] = v;
    }
  }

  preventDefault() {
    if (this.cancelable) this.defaultPrevented = true;
  }

  stopPropagation() {
    this._propagationStopped = true;
  }

  stopImmediatePropagation() {
    this._propagationStopped = true;
    this._immediatePropagationStopped = true;
  }
}

function linkSiblings(parent) {
  const kids = parent.childNodes;
  for (let i = 0; i < kids.length; i++) {
    kids[i].parentNode = parent;
    kids[i].previousSibling = i > 0 ? kids[i - 1] : null;
    kids[i].nextSibling = i < kids.length - 1 ? kids[i + 1] : null;
  }
}

export class DOMNode {
  constructor(nodeType, nodeName, ownerDocument = null) {
    this.nodeType = nodeType;
    this.nodeName = nodeName;
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
    this.childNodes = [];
    this.previousSibling = null;
    this.nextSibling = null;
    this._listeners = new Map();
  }

  get parentElement() {
    return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null;
  }

  get firstChild() {
    return this.childNodes[0] || null;
  }

  get lastChild() {
    return this.childNodes[this.childNodes.length - 1] || null;
  }

  get children() {
    return this.childNodes.filter((c) => c.nodeType === 1);
  }

  get isConnected() {
    let curr = this;
    while (curr) {
      if (curr === this.ownerDocument) return true;
      curr = curr.parentNode;
    }
    return false;
  }

  contains(other) {
    let curr = other;
    while (curr) {
      if (curr === this) return true;
      curr = curr.parentNode;
    }
    return false;
  }

  _removeSingleChild(child) {
    const idx = this.childNodes.indexOf(child);
    if (idx === -1) return child;
    this.childNodes.splice(idx, 1);
    child.parentNode = null;
    child.previousSibling = null;
    child.nextSibling = null;
    linkSiblings(this);
    return child;
  }

  appendChild(child) {
    return this.insertBefore(child, null);
  }

  insertBefore(newChild, refChild) {
    if (!newChild) return newChild;
    if (newChild.nodeType === 11) {
      const fragmentKids = [...newChild.childNodes];
      for (const k of fragmentKids) {
        this.insertBefore(k, refChild);
      }
      return newChild;
    }
    if (newChild.parentNode) {
      newChild.parentNode._removeSingleChild(newChild);
    }
    let insertIdx = this.childNodes.length;
    if (refChild) {
      const refIdx = this.childNodes.indexOf(refChild);
      if (refIdx !== -1) insertIdx = refIdx;
    }
    this.childNodes.splice(insertIdx, 0, newChild);
    linkSiblings(this);
    return newChild;
  }

  removeChild(child) {
    if (!child || child.parentNode !== this) return child;
    return this._removeSingleChild(child);
  }

  replaceChild(newChild, oldChild) {
    const ref = oldChild?.nextSibling || null;
    this.removeChild(oldChild);
    this.insertBefore(newChild, ref);
    return oldChild;
  }

  addEventListener(type, listener, options) {
    if (typeof listener !== 'function') return;
    const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
    const once = typeof options === 'object' && Boolean(options?.once);
    if (!this._listeners.has(type)) this._listeners.set(type, []);
    const list = this._listeners.get(type);
    const exists = list.some((entry) => entry.listener === listener && entry.capture === capture);
    if (!exists) {
      list.push({ listener, capture, once });
    }
  }

  removeEventListener(type, listener, options) {
    const list = this._listeners.get(type);
    if (!list) return;
    const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].listener === listener && list[i].capture === capture) {
        list.splice(i, 1);
      }
    }
  }

  _invokeListeners(type, event, isCapturePhase, isTargetPhase) {
    const list = this._listeners.get(type);
    if (!list || list.length === 0) return;
    for (const entry of [...list]) {
      if (event._immediatePropagationStopped) break;
      const shouldFire = isTargetPhase
        ? entry.capture === isCapturePhase
        : entry.capture === isCapturePhase;
      if (!shouldFire) continue;
      if (entry.once) {
        this.removeEventListener(type, entry.listener, entry.capture);
      }
      entry.listener.call(this, event);
    }
  }

  dispatchEvent(event) {
    if (!event) return true;
    event.target = this;
    const prevWindowEvent = globalThis.window ? globalThis.window.event : undefined;
    if (globalThis.window) {
      globalThis.window.event = event;
    }
    try {
      const path = [];
      let curr = this;
      while (curr) {
        path.push(curr);
        curr = curr.parentNode || (curr === this.ownerDocument ? null : null);
      }
      if (this.ownerDocument && path[path.length - 1] !== this.ownerDocument) {
        path.push(this.ownerDocument);
      }

      // Capture phase (top -> down)
      for (let i = path.length - 1; i > 0; i--) {
        if (event._propagationStopped) break;
        event.currentTarget = path[i];
        event.eventPhase = 1;
        path[i]._invokeListeners(event.type, event, true, false);
      }

      // Target phase
      if (!event._propagationStopped) {
        event.currentTarget = this;
        event.eventPhase = 2;
        this._invokeListeners(event.type, event, true, true);
        if (!event._immediatePropagationStopped) {
          this._invokeListeners(event.type, event, false, true);
        }
      }

      // Bubble phase (bottom -> up)
      if (event.bubbles) {
        for (let i = 1; i < path.length; i++) {
          if (event._propagationStopped) break;
          event.currentTarget = path[i];
          event.eventPhase = 3;
          path[i]._invokeListeners(event.type, event, false, false);
        }
      }

      event.currentTarget = null;
      event.eventPhase = 0;
      return !event.defaultPrevented;
    } finally {
      if (globalThis.window) {
        globalThis.window.event = prevWindowEvent;
      }
    }
  }
}

export class DOMText extends DOMNode {
  constructor(text = '', ownerDocument = null) {
    super(3, '#text', ownerDocument);
    this._data = text == null ? '' : String(text);
  }

  get data() {
    return this._data;
  }

  set data(v) {
    this._data = v == null ? '' : String(v);
  }

  get nodeValue() {
    return this._data;
  }

  set nodeValue(v) {
    this._data = v == null ? '' : String(v);
  }

  get textContent() {
    return this._data;
  }

  set textContent(v) {
    this._data = v == null ? '' : String(v);
  }
}

export class DOMComment extends DOMNode {
  constructor(data = '', ownerDocument = null) {
    super(8, '#comment', ownerDocument);
    this._data = data == null ? '' : String(data);
  }

  get data() {
    return this._data;
  }

  set data(v) {
    this._data = v == null ? '' : String(v);
  }

  get nodeValue() {
    return this._data;
  }

  set nodeValue(v) {
    this._data = v == null ? '' : String(v);
  }

  get textContent() {
    return '';
  }

  set textContent(v) {
    this._data = v == null ? '' : String(v);
  }
}

function createStyleProxy() {
  const store = Object.create(null);
  return new Proxy(store, {
    get(target, prop) {
      if (prop === 'setProperty') {
        return (k, v) => {
          target[k] = v == null ? '' : String(v);
        };
      }
      if (prop === 'removeProperty') {
        return (k) => {
          const prev = target[k] ?? '';
          delete target[k];
          return prev;
        };
      }
      if (prop === 'getPropertyValue') {
        return (k) => target[k] ?? '';
      }
      if (prop === 'cssText') {
        return Object.entries(target)
          .map(([k, v]) => `${k}: ${v}`)
          .join('; ');
      }
      return target[prop] ?? '';
    },
    set(target, prop, value) {
      if (prop === 'cssText') {
        for (const k of Object.keys(target)) delete target[k];
        if (typeof value === 'string') {
          for (const decl of value.split(';')) {
            const idx = decl.indexOf(':');
            if (idx > 0) {
              target[decl.slice(0, idx).trim()] = decl.slice(idx + 1).trim();
            }
          }
        }
        return true;
      }
      target[prop] = value == null ? '' : String(value);
      return true;
    },
  });
}

function normalizeAttrKey(name) {
  const lower = String(name).toLowerCase();
  if (lower === 'classname') return 'class';
  if (lower === 'htmlfor') return 'for';
  return lower;
}

function matchesSingleSelector(node, sel) {
  if (!node || node.nodeType !== 1) return false;
  let rest = sel.trim();
  if (!rest) return false;

  // Match optional leading tag name
  const tagMatch = rest.match(/^([a-zA-Z0-9_-]+)/);
  if (tagMatch) {
    if (node.localName !== tagMatch[1].toLowerCase()) return false;
    rest = rest.slice(tagMatch[1].length);
  }

  while (rest.length > 0) {
    if (rest.startsWith('#')) {
      const m = rest.match(/^#([a-zA-Z0-9_-]+)/);
      if (!m || node.id !== m[1]) return false;
      rest = rest.slice(m[0].length);
    } else if (rest.startsWith('.')) {
      const m = rest.match(/^\.([a-zA-Z0-9_-]+)/);
      if (!m || !node.className.split(/\s+/).filter(Boolean).includes(m[1])) return false;
      rest = rest.slice(m[0].length);
    } else if (rest.startsWith('[')) {
      const m = rest.match(/^\[([\w:-]+)(?:=["']?([^"'\]]*)["']?)?\]/);
      if (!m) return false;
      const [, attr, expected] = m;
      const actual = node.getAttribute(attr);
      if (expected !== undefined ? actual !== expected : actual === null) return false;
      rest = rest.slice(m[0].length);
    } else {
      return false;
    }
  }
  return true;
}

function querySelectorAllFrom(root, selector) {
  const results = [];
  const selectors = String(selector)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 1) {
        if (selectors.some((s) => matchesSingleSelector(child, s))) {
          results.push(child);
        }
        walk(child);
      }
    }
  };
  walk(root);
  return results;
}

export class DOMElement extends DOMNode {
  constructor(tagName, ownerDocument = null, namespaceURI = 'http://www.w3.org/1999/xhtml') {
    const upper = String(tagName).toUpperCase();
    super(1, upper, ownerDocument);
    this.tagName = upper;
    this.localName = String(tagName).toLowerCase();
    this.tag = this.localName;
    this.namespaceURI = namespaceURI;
    this._attrs = new Map();
    this._value = undefined;
    this._checked = false;
    this._disabled = false;
    this._selected = false;
    this.oninput = null;
    this.onchange = null;
    this.onclick = null;
    this.onsubmit = null;
    this.onkeydown = null;
    this.onkeyup = null;
    this.style = createStyleProxy();
    this.dataset = new Proxy(this, {
      get(el, prop) {
        if (typeof prop !== 'string') return undefined;
        const kebab = prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
        return el._attrs.get(`data-${kebab}`);
      },
      set(el, prop, val) {
        if (typeof prop !== 'string') return false;
        const kebab = prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
        el._attrs.set(`data-${kebab}`, val == null ? '' : String(val));
        return true;
      },
    });
  }

  get id() {
    return this._attrs.get('id') ?? '';
  }

  set id(v) {
    if (v === '' || v == null) this._attrs.delete('id');
    else this._attrs.set('id', String(v));
  }

  get className() {
    return this._attrs.get('class') ?? '';
  }

  set className(v) {
    if (v == null || v === '') this._attrs.delete('class');
    else this._attrs.set('class', String(v));
  }

  get classList() {
    const el = this;
    return {
      contains(cls) {
        return el.className.split(/\s+/).filter(Boolean).includes(cls);
      },
      add(...clsList) {
        const set = new Set(el.className.split(/\s+/).filter(Boolean));
        for (const c of clsList) set.add(c);
        el.className = Array.from(set).join(' ');
      },
      remove(...clsList) {
        const removeSet = new Set(clsList);
        el.className = el.className
          .split(/\s+/)
          .filter((c) => c && !removeSet.has(c))
          .join(' ');
      },
      toggle(cls) {
        if (this.contains(cls)) {
          this.remove(cls);
          return false;
        }
        this.add(cls);
        return true;
      },
    };
  }

  get htmlFor() {
    return this._attrs.get('for') ?? '';
  }

  set htmlFor(v) {
    if (v == null || v === '') this._attrs.delete('for');
    else this._attrs.set('for', String(v));
  }

  get tabIndex() {
    const raw = this._attrs.get('tabindex');
    return raw !== undefined ? Number(raw) : -1;
  }

  set tabIndex(v) {
    this._attrs.set('tabindex', String(v));
  }

  get type() {
    const explicit = this._attrs.get('type');
    if (explicit !== undefined) return String(explicit).toLowerCase();
    if (this.localName === 'select') {
      return this.multiple ? 'select-multiple' : 'select-one';
    }
    if (this.localName === 'textarea') return 'textarea';
    if (this.localName === 'button') return 'submit';
    if (this.localName === 'input') return 'text';
    return '';
  }

  set type(v) {
    if (v == null || v === '') this._attrs.delete('type');
    else this._attrs.set('type', String(v));
  }

  get options() {
    return this.localName === 'select' ? this.querySelectorAll('option') : [];
  }

  get multiple() {
    return this._attrs.has('multiple');
  }

  set multiple(v) {
    if (v) this._attrs.set('multiple', '');
    else this._attrs.delete('multiple');
  }

  get selectedIndex() {
    if (this.localName !== 'select') return -1;
    const opts = this.options;
    const explicitIdx = opts.findIndex((o) => o.selected);
    if (explicitIdx !== -1) return explicitIdx;
    return opts.findIndex((o) => !o.disabled);
  }

  get value() {
    if (this._value !== undefined) return this._value;
    if (this._attrs.has('value')) return this._attrs.get('value') ?? '';
    if (this.localName === 'option') return this.textContent;
    if (this.localName === 'select') {
      const opts = this.options;
      const chosen = opts.find((o) => o.selected) || opts.find((o) => !o.disabled);
      return chosen ? chosen.value : '';
    }
    return '';
  }

  set value(v) {
    const str = v == null ? '' : String(v);
    this._value = str;
    this._attrs.set('value', str);
    if (this.localName === 'select') {
      for (const opt of this.options) {
        opt._selected = opt.value === str;
      }
    }
  }

  get defaultValue() {
    return this._attrs.get('value') ?? '';
  }

  set defaultValue(v) {
    const str = v == null ? '' : String(v);
    this._attrs.set('value', str);
    if (this._value === undefined) this._value = str;
  }

  get checked() {
    return this._checked;
  }

  set checked(v) {
    this._checked = Boolean(v);
    if (this._checked) this._attrs.set('checked', '');
    else this._attrs.delete('checked');
  }

  get defaultChecked() {
    return this._attrs.has('checked');
  }

  set defaultChecked(v) {
    this.checked = v;
  }

  get disabled() {
    return this._disabled || this._attrs.has('disabled');
  }

  set disabled(v) {
    this._disabled = Boolean(v);
    if (this._disabled) this._attrs.set('disabled', '');
    else this._attrs.delete('disabled');
  }

  get selected() {
    if (this._selected !== undefined) return this._selected;
    return this._attrs.has('selected');
  }

  set selected(v) {
    this._selected = Boolean(v);
  }

  get defaultSelected() {
    return this._attrs.has('selected');
  }

  set defaultSelected(v) {
    if (v) {
      this._attrs.set('selected', '');
      this._selected = true;
    } else {
      this._attrs.delete('selected');
      this._selected = false;
    }
  }

  setAttribute(name, value) {
    const key = normalizeAttrKey(name);
    const str = value == null ? '' : String(value);
    this._attrs.set(key, str);
    if (key === 'value') this._value = str;
    if (key === 'disabled') this._disabled = true;
    if (key === 'checked') this._checked = true;
    if (key === 'selected') this._selected = true;
    if (key.startsWith('on') && key.length > 2) {
      this[key] = () => {};
    }
  }

  setAttributeNS(_ns, qualifiedName, value) {
    const raw = String(qualifiedName);
    const local = raw.includes(':') ? raw.split(':').pop() : raw;
    this.setAttribute(local, value);
  }

  getAttribute(name) {
    const key = normalizeAttrKey(name);
    return this._attrs.has(key) ? this._attrs.get(key) : null;
  }

  hasAttribute(name) {
    return this._attrs.has(normalizeAttrKey(name));
  }

  removeAttribute(name) {
    const key = normalizeAttrKey(name);
    this._attrs.delete(key);
    if (key === 'value') this._value = undefined;
    if (key === 'disabled') this._disabled = false;
    if (key === 'checked') this._checked = false;
    if (key === 'selected') this._selected = false;
  }

  get textContent() {
    let text = '';
    for (const child of this.childNodes) {
      if (child.nodeType === 1 || child.nodeType === 3) {
        text += child.textContent;
      }
    }
    return text;
  }

  set textContent(v) {
    while (this.childNodes.length > 0) {
      this._removeSingleChild(this.childNodes[this.childNodes.length - 1]);
    }
    if (v !== '' && v !== null && v !== undefined) {
      this.appendChild(new DOMText(String(v), this.ownerDocument));
    }
  }

  get innerHTML() {
    let html = '';
    for (const child of this.childNodes) {
      if (child.nodeType === 3) {
        html += child.textContent;
      } else if (child.nodeType === 1) {
        html += `<${child.localName}>${child.innerHTML}</${child.localName}>`;
      }
    }
    return html;
  }

  set innerHTML(v) {
    while (this.childNodes.length > 0) {
      this._removeSingleChild(this.childNodes[this.childNodes.length - 1]);
    }
    if (typeof v === 'string' && v.length > 0 && !v.includes('<')) {
      this.appendChild(new DOMText(v, this.ownerDocument));
    }
  }

  focus() {
    if (this.ownerDocument) {
      this.ownerDocument.activeElement = this;
    }
  }

  blur() {
    if (this.ownerDocument && this.ownerDocument.activeElement === this) {
      this.ownerDocument.activeElement = this.ownerDocument.body;
    }
  }

  click() {
    this.dispatchEvent(new DOMEvent('click', { bubbles: true, cancelable: true }));
  }

  querySelector(selector) {
    const all = querySelectorAllFrom(this, selector);
    return all.length > 0 ? all[0] : null;
  }

  querySelectorAll(selector) {
    return querySelectorAllFrom(this, selector);
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
      if (node.nodeType === 1) {
        if (isMatch(node.textContent)) {
          let childMatches = false;
          for (const c of node.children) {
            if (isMatch(c.textContent)) {
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
      if (node.nodeType === 1) {
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

export class DOMHTMLIFrameElement extends DOMElement {}

export class DOMDocumentFragment extends DOMElement {
  constructor(ownerDocument = null) {
    super('#document-fragment', ownerDocument);
    this.nodeType = 11;
    this.nodeName = '#document-fragment';
    this.tagName = undefined;
  }
}

export class DOMDocument extends DOMNode {
  constructor() {
    super(9, '#document', null);
    this.ownerDocument = this;
    this.visibilityState = 'visible';
    this.oninput = null;
    this.onchange = null;
    this.onclick = null;
    this.onsubmit = null;
    this.onkeydown = null;
    this.onkeyup = null;
    this.documentElement = new DOMElement('html', this);
    this.head = new DOMElement('head', this);
    this.body = new DOMElement('body', this);
    this.activeElement = this.body;
    super.insertBefore(this.documentElement, null);
    this.documentElement.appendChild(this.head);
    this.documentElement.appendChild(this.body);
  }

  get defaultView() {
    return globalThis.window;
  }

  createElement(tagName) {
    return new DOMElement(tagName, this);
  }

  createElementNS(namespaceURI, qualifiedName) {
    return new DOMElement(qualifiedName, this, namespaceURI);
  }

  createTextNode(text) {
    return new DOMText(text, this);
  }

  createComment(data) {
    return new DOMComment(data, this);
  }

  createDocumentFragment() {
    return new DOMDocumentFragment(this);
  }

  getElementById(id) {
    return this.querySelector(`#${id}`);
  }

  querySelector(selector) {
    return this.documentElement.querySelector(selector);
  }

  querySelectorAll(selector) {
    return this.documentElement.querySelectorAll(selector);
  }
}

function createDefaultWindow(doc) {
  const listeners = new Map();
  const storageMap = new Map();
  const historyEntries = [{ state: null, url: 'http://127.0.0.1:3000/' }];
  let historyIndex = 0;

  const win = {
    document: doc,
    event: undefined,
    location: {
      origin: 'http://127.0.0.1:3000',
      protocol: 'http:',
      host: '127.0.0.1:3000',
      hostname: '127.0.0.1',
      port: '3000',
      pathname: '/',
      search: '',
      hash: '',
      href: 'http://127.0.0.1:3000/',
    },
    history: {
      get length() {
        return historyEntries.length;
      },
      get state() {
        return historyEntries[historyIndex]?.state ?? null;
      },
      pushState(state, _title, url = '') {
        historyEntries.splice(historyIndex + 1);
        historyEntries.push({ state: state ?? null, url: String(url || '') });
        historyIndex = historyEntries.length - 1;
      },
      replaceState(state, _title, url = '') {
        historyEntries[historyIndex] = {
          state: state ?? null,
          url: String(url || historyEntries[historyIndex]?.url || ''),
        };
      },
      back() {
        if (historyIndex > 0) {
          historyIndex -= 1;
          win.dispatchEvent(
            new DOMEvent('popstate', {
              bubbles: false,
              cancelable: false,
              state: historyEntries[historyIndex]?.state ?? null,
            }),
          );
        }
      },
      forward() {
        if (historyIndex < historyEntries.length - 1) {
          historyIndex += 1;
          win.dispatchEvent(
            new DOMEvent('popstate', {
              bubbles: false,
              cancelable: false,
              state: historyEntries[historyIndex]?.state ?? null,
            }),
          );
        }
      },
      go(delta = 0) {
        const nextIdx = Math.max(0, Math.min(historyEntries.length - 1, historyIndex + Number(delta)));
        if (nextIdx !== historyIndex) {
          historyIndex = nextIdx;
          win.dispatchEvent(
            new DOMEvent('popstate', {
              bubbles: false,
              cancelable: false,
              state: historyEntries[historyIndex]?.state ?? null,
            }),
          );
        }
      },
    },
    navigator: { userAgent: 'Mozilla/5.0 (X11; Linux x86_64) OneiromancyTest/1.0' },
    localStorage: {
      get length() {
        return storageMap.size;
      },
      key(i) {
        return Array.from(storageMap.keys())[i] ?? null;
      },
      getItem(k) {
        const key = String(k);
        return storageMap.has(key) ? storageMap.get(key) : null;
      },
      setItem(k, v) {
        storageMap.set(String(k), String(v));
      },
      removeItem(k) {
        storageMap.delete(String(k));
      },
      clear() {
        storageMap.clear();
      },
    },
    innerWidth: 1280,
    innerHeight: 800,
    scrollX: 0,
    scrollY: 0,
    scrollTo() {},
    requestAnimationFrame(cb) {
      const id = setTimeout(() => cb(Date.now()), 0);
      if (id && typeof id.unref === 'function') id.unref();
      return id;
    },
    cancelAnimationFrame(id) {
      clearTimeout(id);
    },
    matchMedia(query) {
      return {
        matches: false,
        media: String(query || ''),
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() {
          return true;
        },
      };
    },
    getComputedStyle() {
      return createStyleProxy();
    },
    addEventListener(type, listener, options) {
      if (typeof listener !== 'function') return;
      const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
      if (!listeners.has(type)) listeners.set(type, []);
      const list = listeners.get(type);
      if (!list.some((e) => e.listener === listener && e.capture === capture)) {
        list.push({ listener, capture });
      }
    },
    removeEventListener(type, listener, options) {
      const list = listeners.get(type);
      if (!list) return;
      const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i].listener === listener && list[i].capture === capture) {
          list.splice(i, 1);
        }
      }
    },
    dispatchEvent(event) {
      if (!event) return true;
      event.target = win;
      event.currentTarget = win;
      const prevEvent = win.event;
      win.event = event;
      try {
        const list = listeners.get(event.type);
        if (list) {
          for (const entry of [...list]) {
            if (event._immediatePropagationStopped) break;
            entry.listener.call(win, event);
          }
        }
        return !event.defaultPrevented;
      } finally {
        win.event = prevEvent;
      }
    },
    Node: DOMNode,
    Element: DOMElement,
    HTMLElement: DOMElement,
    HTMLIFrameElement: DOMHTMLIFrameElement,
    SVGElement: DOMElement,
    Text: DOMText,
    Comment: DOMComment,
    DocumentFragment: DOMDocumentFragment,
    Document: DOMDocument,
    Event: DOMEvent,
    CustomEvent: DOMEvent,
  };
  win.window = win;
  win.self = win;
  win.top = win;
  win.parent = win;
  return win;
}

function installDomGlobals() {
  if (!globalThis.document || typeof globalThis.document.createElement !== 'function') {
    globalThis.document = new DOMDocument();
  }
  for (const evtProp of ['oninput', 'onchange', 'onclick', 'onsubmit', 'onkeydown', 'onkeyup']) {
    if (!(evtProp in globalThis.document)) {
      globalThis.document[evtProp] = null;
    }
  }
  if (!globalThis.window || typeof globalThis.window !== 'object') {
    globalThis.window = createDefaultWindow(globalThis.document);
  } else {
    if (!globalThis.window.document) globalThis.window.document = globalThis.document;
    if (typeof globalThis.window.dispatchEvent !== 'function') {
      globalThis.window.dispatchEvent = () => true;
    }
    if (globalThis.window.self === undefined) globalThis.window.self = globalThis.window;
    if (globalThis.window.top === undefined) globalThis.window.top = globalThis.window;
    if (globalThis.window.Node === undefined) globalThis.window.Node = DOMNode;
    if (globalThis.window.Element === undefined) globalThis.window.Element = DOMElement;
    if (globalThis.window.HTMLElement === undefined) globalThis.window.HTMLElement = DOMElement;
    if (globalThis.window.HTMLIFrameElement === undefined) {
      globalThis.window.HTMLIFrameElement = DOMHTMLIFrameElement;
    }
    if (globalThis.window.SVGElement === undefined) globalThis.window.SVGElement = DOMElement;
    if (globalThis.window.Event === undefined) globalThis.window.Event = DOMEvent;
  }
  if (globalThis.Node === undefined) globalThis.Node = DOMNode;
  if (globalThis.Element === undefined) globalThis.Element = DOMElement;
  if (globalThis.HTMLElement === undefined) globalThis.HTMLElement = DOMElement;
  if (globalThis.HTMLIFrameElement === undefined) {
    globalThis.HTMLIFrameElement = DOMHTMLIFrameElement;
  }
  if (globalThis.SVGElement === undefined) globalThis.SVGElement = DOMElement;
  if (globalThis.Text === undefined) globalThis.Text = DOMText;
  if (globalThis.Comment === undefined) globalThis.Comment = DOMComment;
  if (globalThis.DocumentFragment === undefined) {
    globalThis.DocumentFragment = DOMDocumentFragment;
  }
  if (globalThis.Document === undefined) globalThis.Document = DOMDocument;
  if (globalThis.Event === undefined) globalThis.Event = DOMEvent;
  if (globalThis.CustomEvent === undefined) globalThis.CustomEvent = DOMEvent;
  if (globalThis.navigator === undefined) {
    globalThis.navigator = globalThis.window.navigator || {
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) OneiromancyTest/1.0',
    };
  }
  if (globalThis.localStorage === undefined && globalThis.window.localStorage) {
    globalThis.localStorage = globalThis.window.localStorage;
  }
  if (globalThis.requestAnimationFrame === undefined && globalThis.window.requestAnimationFrame) {
    globalThis.requestAnimationFrame = globalThis.window.requestAnimationFrame;
  }
  if (globalThis.cancelAnimationFrame === undefined && globalThis.window.cancelAnimationFrame) {
    globalThis.cancelAnimationFrame = globalThis.window.cancelAnimationFrame;
  }
}

installDomGlobals();

const { createRoot } = await import('react-dom/client');
const {
  renderToStaticMarkup: realRenderToStaticMarkup,
  renderToString: realRenderToString,
} = await import('react-dom/server');

export const renderToStaticMarkup = realRenderToStaticMarkup;
export const renderToString = realRenderToString;

// ============================================================================
// Active React 19 Root Lifecycle (createRoot + React.act)
// ============================================================================

let currentContainer = null;
let currentRoot = null;

function teardownActiveRoot() {
  if (currentRoot) {
    const rootToUnmount = currentRoot;
    currentRoot = null;
    runWithUnrefTimers(() => {
      reactAct(() => {
        rootToUnmount.unmount();
      });
    });
  }
  if (currentContainer && currentContainer.parentNode) {
    currentContainer.parentNode.removeChild(currentContainer);
  }
  currentContainer = null;
}

/**
 * Standard RTL render method backed by React 19 `createRoot` and `React.act`
 */
export function render(ui, _options = {}) {
  installDomGlobals();
  teardownActiveRoot();

  const container = globalThis.document.createElement('div');
  globalThis.document.body.appendChild(container);
  currentContainer = container;

  const root = createRoot(container);
  currentRoot = root;

  runWithUnrefTimers(() => {
    reactAct(() => {
      root.render(ui);
    });
  });

  return {
    get container() {
      return container;
    },
    getByTestId: (id) => {
      const el = container.findByTestId(id);
      assert.ok(el, 'Unable to find element with data-testid="' + id + '"');
      return el;
    },
    queryByTestId: (id) => container.findByTestId(id),
    getAllByTestId: (id) => container.findAllByTestId(id) || [],
    getByText: (text) => {
      const el = container.findByText(text);
      assert.ok(el, 'Unable to find element containing text: ' + text);
      return el;
    },
    queryByText: (text) => container.findByText(text),
    getByPlaceholderText: (text) => {
      const el = container.findByPlaceholderText(text);
      assert.ok(el, 'Unable to find element with placeholder matching: ' + text);
      return el;
    },
    queryByPlaceholderText: (text) => container.findByPlaceholderText(text),
    getByRole: (role, opts = {}) => {
      const els = container.querySelectorAll(role);
      const withRole = container.querySelectorAll('[role="' + role + '"]');
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
      runWithUnrefTimers(() => {
        reactAct(() => {
          root.render(newUi);
        });
      });
    },
    unmount: () => {
      if (currentRoot === root) {
        teardownActiveRoot();
      } else {
        runWithUnrefTimers(() => {
          reactAct(() => {
            root.unmount();
          });
        });
        if (container.parentNode) {
          container.parentNode.removeChild(container);
        }
      }
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

function dispatchDomValueEvent(element, eventName, eventData = {}) {
  const prevValue = element.value;
  if (eventData.target && typeof eventData.target === 'object') {
    for (const [k, v] of Object.entries(eventData.target)) {
      element[k] = v;
    }
  }
  const nextValue = element.value;
  if (element._valueTracker && typeof element._valueTracker.setValue === 'function') {
    element._valueTracker.setValue(prevValue !== nextValue ? prevValue : '__forced_change__');
  }
  const inputType = String(element.getAttribute?.('type') ?? '').toLowerCase();
  const isTextControl =
    eventName === 'change' &&
    (element.localName === 'textarea' ||
      (element.localName === 'input' && inputType !== 'checkbox' && inputType !== 'radio'));
  runWithUnrefTimers(() => {
    reactAct(() => {
      if (isTextControl) {
        element.dispatchEvent(
          new DOMEvent('input', {
            bubbles: true,
            cancelable: true,
            ...eventData,
          }),
        );
      }
      element.dispatchEvent(
        new DOMEvent(eventName, {
          bubbles: true,
          cancelable: true,
          ...eventData,
        }),
      );
    });
  });
}

/**
 * Standard RTL fireEvent dispatching W3C DOM events through React 19 event delegation
 */
export const fireEvent = {
  click: (element) => {
    assert.ok(element, 'fireEvent.click called on null/undefined element');
    runWithUnrefTimers(() => {
      reactAct(() => {
        const evt = new DOMEvent('click', { bubbles: true, cancelable: true });
        element.dispatchEvent(evt);
        if (element.tagName === 'LABEL' && !evt.defaultPrevented) {
          const control = element.querySelector('input, button, select, textarea');
          if (control && control !== element) {
            control.dispatchEvent(new DOMEvent('click', { bubbles: true, cancelable: true }));
          }
        }
      });
    });
  },
  change: (element, eventData = {}) => {
    assert.ok(element, 'fireEvent.change called on null/undefined element');
    dispatchDomValueEvent(element, 'change', eventData);
  },
  input: (element, eventData = {}) => {
    assert.ok(element, 'fireEvent.input called on null/undefined element');
    dispatchDomValueEvent(element, 'input', eventData);
  },
};

/**
 * Standard RTL act method backed by `React.act`
 */
export function act(callback) {
  return runWithUnrefTimers(() => reactAct(callback));
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
  teardownActiveRoot();
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
