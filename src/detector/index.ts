import { readFileSync, existsSync } from 'fs';
import { join, basename } from 'path';

export interface ProjectContext {
  name?: string;
}

export function detectProjectContext(cwd: string): ProjectContext {
  const ctx: ProjectContext = {};

  // Detect Node.js
  const pkgPath = join(cwd, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      ctx.name = pkg.name ?? basename(cwd);
    } catch {
      // ignore
    }
  }

  // Detect Rust
  if (!ctx.name) {
    const cargoPath = join(cwd, 'Cargo.toml');
    if (existsSync(cargoPath)) {
      try {
        const raw = readFileSync(cargoPath, 'utf-8');
        const match = raw.match(/^\s*name\s*=\s*"([^"]+)"/m);
        if (match) ctx.name = match[1];
      } catch {
        // ignore
      }
    }
  }

  // Detect Python
  if (!ctx.name) {
    const pyprojectPath = join(cwd, 'pyproject.toml');
    if (existsSync(pyprojectPath)) {
      try {
        const raw = readFileSync(pyprojectPath, 'utf-8');
        const match = raw.match(/^\s*name\s*=\s*"([^"]+)"/m);
        if (match) ctx.name = match[1];
      } catch {
        // ignore
      }
    }
  }

  if (!ctx.name) {
    ctx.name = basename(cwd);
  }

  return ctx;
}
