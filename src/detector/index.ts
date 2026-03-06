import { readFileSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { parse } from 'yaml';

export interface ProjectContext {
  name?: string;
  stack?: 'nodejs' | 'rust' | 'python' | 'unknown';
  hasExistingClaude?: boolean;
}

export function detectProjectContext(cwd: string): ProjectContext {
  const ctx: ProjectContext = {};

  // Detect Node.js
  const pkgPath = join(cwd, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      ctx.name = pkg.name ?? basename(cwd);
      ctx.stack = 'nodejs';
    } catch {
      // ignore
    }
  }

  // Detect Rust
  if (!ctx.stack) {
    const cargoPath = join(cwd, 'Cargo.toml');
    if (existsSync(cargoPath)) {
      try {
        const raw = readFileSync(cargoPath, 'utf-8');
        const match = raw.match(/^\s*name\s*=\s*"([^"]+)"/m);
        if (match) ctx.name = match[1];
        ctx.stack = 'rust';
      } catch {
        // ignore
      }
    }
  }

  // Detect Python
  if (!ctx.stack) {
    const pyprojectPath = join(cwd, 'pyproject.toml');
    if (existsSync(pyprojectPath)) {
      try {
        const raw = readFileSync(pyprojectPath, 'utf-8');
        const match = raw.match(/^\s*name\s*=\s*"([^"]+)"/m);
        if (match) ctx.name = match[1];
        ctx.stack = 'python';
      } catch {
        // ignore
      }
    }
  }

  if (!ctx.stack) {
    ctx.name = ctx.name ?? basename(cwd);
    ctx.stack = 'unknown';
  }

  // Check for existing .claude directory
  ctx.hasExistingClaude = existsSync(join(cwd, '.claude'));

  return ctx;
}
