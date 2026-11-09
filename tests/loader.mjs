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
import { register, createRequire } from 'node:module';

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

const isInheritedDistDir = Boolean(process.env.ONEIROMANCY_DIST_DIR);
export const distDir = process.env.ONEIROMANCY_DIST_DIR || defaultDistDir;
process.env.ONEIROMANCY_DIST_DIR = distDir;

// Only clean up if this process generated its own unshared temporary PID dist directory.
// Never delete an inherited ONEIROMANCY_DIST_DIR (managed exclusively by the parent runner process).
if (!isInheritedDistDir) {
  process.on('exit', () => {
    try {
      if (fs.existsSync(distDir)) {
        fs.rmSync(distDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore exit cleanup error
    }
  });
}

export function ensureCompiled() {
  if (!fs.existsSync(path.join(distDir, 'core', 'lib', 'sleeper.js'))) {
    fs.mkdirSync(distDir, { recursive: true });
    const user = process.env.USER || 'default';
    const tscPaths = [
      path.join(clientRoot, 'node_modules/typescript/bin/tsc'),
      ...(process.env.TEST_TMPDIR
        ? [path.join(process.env.TEST_TMPDIR, 'node_modules/typescript/bin/tsc')]
        : [
            `/tmp/oneiromancy_runner_${user}/node_modules/typescript/bin/tsc`,
            '/google/src/files/head/depot/google3/third_party/javascript/node_modules/typescript/v6_0_3/lib/tsc.js',
          ]),
    ];
    const tscPath = tscPaths.find((p) => fs.existsSync(p));
    if (!tscPath) {
      throw new Error(`TypeScript compiler (tsc) not found in any of: ${tscPaths.join(', ')}`);
    }
    execSync(`node "${tscPath}" -p "${path.join(testsDir, 'tsconfig.json')}" --outDir "${distDir}"`, {
      cwd: clientRoot,
      stdio: 'inherit',
    });
  }
}

ensureCompiled();

function getFallbackPackageBases() {
  const user = process.env.USER || process.env.LOGNAME || 'default';
  const bases = [path.resolve(clientRoot, 'package.json')];
  if (process.env.TEST_TMPDIR) {
    const resolvedTmp = path.resolve(process.env.TEST_TMPDIR);
    bases.push(path.join(resolvedTmp, 'package.json'));
    if (process.env.ONEIROMANCY_SANDBOX_DIR) {
      const resolvedSandbox = path.resolve(process.env.ONEIROMANCY_SANDBOX_DIR);
      if (resolvedSandbox === resolvedTmp || resolvedSandbox.startsWith(resolvedTmp + path.sep)) {
        bases.push(path.join(resolvedSandbox, 'package.json'));
      }
    }
    return bases;
  }
  if (process.env.ONEIROMANCY_SANDBOX_DIR) {
    bases.push(path.join(process.env.ONEIROMANCY_SANDBOX_DIR, 'package.json'));
  }
  bases.push(`/tmp/oneiromancy_runner_${user}/package.json`);
  return bases;
}

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


  if (!cleanSpecifier.startsWith('.') && !cleanSpecifier.startsWith('/') && !cleanSpecifier.startsWith('node:')) {
    const fallbackBases = getFallbackPackageBases();
    for (const basePkg of fallbackBases) {
      if (fs.existsSync(basePkg) && fs.existsSync(path.join(path.dirname(basePkg), 'node_modules'))) {
        try {
          const req = createRequire(basePkg);
          const resolved = req.resolve(cleanSpecifier);
          if (fs.existsSync(resolved)) {
            return { url: pathToFileURL(resolved).href + querySuffix, shortCircuit: true };
          }
        } catch {
          // Try next base
        }
      }
    }
  }

  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (cleanSpecifier === 'lucide-react') {
      const fallbackPath = path.join(testsDir, 'helpers', 'lucide_react_fallback.mjs');
      if (fs.existsSync(fallbackPath)) {
        return { url: pathToFileURL(fallbackPath).href + querySuffix, shortCircuit: true };
      }
    }
    const fallbackBases = getFallbackPackageBases();
    for (const basePkg of fallbackBases) {
      if (fs.existsSync(basePkg) && fs.existsSync(path.join(path.dirname(basePkg), 'node_modules'))) {
        try {
          const req = createRequire(basePkg);
          const resolved = req.resolve(cleanSpecifier);
          return { url: pathToFileURL(resolved).href + querySuffix, shortCircuit: true };
        } catch {
          // Try next base
        }
      }
    }
    throw err;
  }
}
