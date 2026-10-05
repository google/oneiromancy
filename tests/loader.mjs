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

import path from 'node:path';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { isMainThread } from 'node:worker_threads';
import { register } from 'node:module';

if (isMainThread && !globalThis.__ONEIROMANCY_LOADER_REGISTERED__) {
  globalThis.__ONEIROMANCY_LOADER_REGISTERED__ = true;
  try {
    register(import.meta.url);
  } catch {
    // Already registered via --experimental-loader
  }
}

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(testsDir, '..');

const defaultDistDir = process.env.TEST_TMPDIR
  ? path.join(process.env.TEST_TMPDIR, 'oneiromancy_dist')
  : path.join('/tmp', `oneiromancy_dist_${process.pid}`);

export const distDir = process.env.ONEIROMANCY_DIST_DIR || defaultDistDir;

export function ensureCompiled() {
  if (!fs.existsSync(path.join(distDir, 'core', 'lib', 'sleeper.js'))) {
    fs.mkdirSync(distDir, { recursive: true });
    const tscPaths = [
      path.join(clientRoot, 'node_modules/typescript/bin/tsc'),
      '/google/src/files/head/depot/google3/third_party/javascript/node_modules/typescript/v6_0_3/lib/tsc.js',
    ];
    const tscPath = tscPaths.find((p) => fs.existsSync(p));
    if (tscPath) {
      try {
        execSync(`node "${tscPath}" -p "${path.join(testsDir, 'tsconfig.json')}" --outDir "${distDir}"`, {
          cwd: clientRoot,
          stdio: 'pipe',
        });
      } catch (e) {
        // Fallback or ignore if compilation error handled upstream
      }
    }
  }
}

ensureCompiled();

function findPath(basePath) {
  if (basePath.startsWith(distDir)) {
    if (fs.existsSync(basePath) && !fs.statSync(basePath).isDirectory()) {
      return basePath;
    }
    const jsPath = basePath.replace(/\.tsx?$/, '.js');
    if (fs.existsSync(jsPath) && !fs.statSync(jsPath).isDirectory()) {
      return jsPath;
    }
  }

  if (basePath.startsWith(clientRoot)) {
    const rel = path.relative(clientRoot, basePath);
    const inDist = path.join(distDir, rel);
    const inDistJs = inDist.replace(/\.tsx?$/, '.js');
    if (fs.existsSync(inDistJs) && !fs.statSync(inDistJs).isDirectory()) {
      return inDistJs;
    }
  }

  const baseNoExt = basePath.replace(/\.tsx?$/, '');
  for (const ext of ['.js', '.mjs']) {
    if (fs.existsSync(baseNoExt + ext)) {
      return baseNoExt + ext;
    }
  }

  if (fs.existsSync(basePath) && !fs.statSync(basePath).isDirectory() && !basePath.endsWith('.ts') && !basePath.endsWith('.tsx')) {
    return basePath;
  }

  const indexJs = path.join(basePath, 'index.js');
  if (fs.existsSync(indexJs)) {
    return indexJs;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (
    [
      'react',
      'react/jsx-runtime',
      'react-dom',
      'react-dom/server',
      'react-dom/client',
      'lucide-react',
      'clsx',
      'tailwind-merge',
    ].includes(specifier)
  ) {
    return {
      url: pathToFileURL(path.join(testsDir, 'helpers/react_shim.mjs')).href,
      shortCircuit: true,
    };
  }

  const queryIdx = specifier.indexOf('?');
  const cleanSpecifier = queryIdx !== -1 ? specifier.slice(0, queryIdx) : specifier;
  const querySuffix = queryIdx !== -1 ? specifier.slice(queryIdx) : '';

  if (cleanSpecifier.startsWith('@core/')) {
    const rel = cleanSpecifier.slice(6);
    const candidates = [
      path.join(distDir, 'core', rel),
      path.join(distDir, rel),
      path.join(clientRoot, 'core', rel),
    ];
    for (const c of candidates) {
      const found = findPath(c);
      if (found) {
        return { url: pathToFileURL(found).href + querySuffix, shortCircuit: true };
      }
    }
  }

  if (cleanSpecifier.startsWith('@/')) {
    const rel = cleanSpecifier.slice(2);
    const candidates = [
      path.join(distDir, 'core', rel),
      path.join(distDir, rel),
      path.join(clientRoot, 'core', rel),
      path.join(clientRoot, rel),
    ];
    if (rel.startsWith('core/')) {
      const coreRel = rel.slice(5);
      candidates.unshift(path.join(distDir, coreRel));
    }
    for (const c of candidates) {
      const found = findPath(c);
      if (found) {
        return { url: pathToFileURL(found).href + querySuffix, shortCircuit: true };
      }
    }
  }

  if (cleanSpecifier.startsWith('.') && context.parentURL) {
    const parentDir = path.dirname(fileURLToPath(context.parentURL));
    const resolvedPath = path.resolve(parentDir, cleanSpecifier);
    const relToDist = path.relative(distDir, resolvedPath);
    const relToClient = path.relative(clientRoot, resolvedPath);

    let distNormalized = cleanSpecifier.replace(/^\.\//, '').replace(/^\.\.\//, '');
    if (distNormalized.includes('dist/')) {
      distNormalized = distNormalized.replace(/.*dist\//, '');
    }
    if (distNormalized.startsWith('lib/')) {
      distNormalized = 'core/' + distNormalized;
    } else if (distNormalized.startsWith('types/')) {
      distNormalized = 'core/' + distNormalized;
    }

    const candidates = [
      resolvedPath,
      path.join(distDir, distNormalized),
      path.join(distDir, 'core', distNormalized),
      path.join(distDir, relToClient),
      path.join(clientRoot, relToDist),
      path.join(clientRoot, distNormalized),
      path.join(clientRoot, 'core', distNormalized),
      resolvedPath.replace('/lib/', '/core/lib/'),
      resolvedPath.replace('/types/', '/core/types/'),
      resolvedPath.replace('/tests/dist/lib/', '/core/lib/'),
      resolvedPath.replace('/tests/dist/', '/'),
    ];
    for (const c of candidates) {
      const found = findPath(c);
      if (found) {
        return { url: pathToFileURL(found).href + querySuffix, shortCircuit: true };
      }
    }
  }

  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    const user = process.env.USER || 'default';
    const fallbackNodeModules = [
      `/tmp/oneiromancy_runner_${user}/node_modules`,
      path.resolve(clientRoot, 'node_modules'),
    ];
    for (const nm of fallbackNodeModules) {
      const pkgDir = path.join(nm, cleanSpecifier);
      const pkgJsonPath = path.join(pkgDir, 'package.json');
      if (fs.existsSync(pkgJsonPath)) {
        const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
        const entry = pkgJson.module || pkgJson.main || 'index.js';
        const resolvedEntry = path.resolve(pkgDir, typeof entry === 'string' ? entry : 'index.js');
        if (fs.existsSync(resolvedEntry)) {
          return { url: pathToFileURL(resolvedEntry).href + querySuffix, shortCircuit: true };
        }
      }
      const directFound = findPath(pkgDir);
      if (directFound) {
        return { url: pathToFileURL(directFound).href + querySuffix, shortCircuit: true };
      }
    }
    throw err;
  }
}
