import { resolve as pathResolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';

const projectRoot = pathResolve(dirname(fileURLToPath(import.meta.url)), '../..');
const backendNodeModules = pathResolve(projectRoot, 'backend/node_modules');

export async function resolve(specifier, context, nextResolve) {
  // Bare specifier re-routing to backend/node_modules
  if (specifier === 'axios' || specifier === 'zustand' || specifier === 'framer-motion' || specifier === 'react-hot-toast') {
    const candidate = pathResolve(backendNodeModules, specifier);
    if (fs.existsSync(candidate)) {
      try {
        return await nextResolve(pathToFileURL(candidate).href, context);
      } catch {
        // try package.json
        const pkg = JSON.parse(fs.readFileSync(pathResolve(candidate, 'package.json'), 'utf8'));
        const main = pkg.main || 'index.js';
        return {
          shortCircuit: true,
          url: pathToFileURL(pathResolve(candidate, main)).href,
          format: 'commonjs',
        };
      }
    }
  }

  // Relative path without extension
  if (specifier.startsWith('.') || specifier.startsWith('file://')) {
    try {
      return await nextResolve(specifier, context);
    } catch (err) {
      for (const ext of ['.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.js']) {
        try {
          return await nextResolve(specifier + ext, context);
        } catch {}
      }
      throw err;
    }
  }

  // Alias @/ -> frontend/src/
  if (specifier.startsWith('@/')) {
    const sub = specifier.slice(2);
    const resolvedPath = pathResolve(projectRoot, 'frontend/src', sub);
    for (const ext of ['', '.ts', '.tsx', '.js', '/index.ts', '/index.js']) {
      if (fs.existsSync(resolvedPath + ext)) {
        return {
          shortCircuit: true,
          url: pathToFileURL(resolvedPath + ext).href,
          format: 'module',
        };
      }
    }
  }

  return nextResolve(specifier, context);
}
