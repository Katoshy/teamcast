import type { TargetContext } from './target-context.js';
import { createClaudeTarget } from './claude/index.js';
import { createCodexTarget } from './codex/index.js';

export type TargetFactory = () => TargetContext;

const registry = new Map<string, TargetFactory>();
let defaultTargetName = 'claude';
let builtinsRegistered = false;

export function ensureBuiltinTargetsRegistered(): void {
  if (builtinsRegistered) {
    return;
  }

  if (!registry.has('claude')) {
    registry.set('claude', createClaudeTarget);
  }
  if (!registry.has('codex')) {
    registry.set('codex', createCodexTarget);
  }

  builtinsRegistered = true;
}

export function registerTarget(name: string, factory: TargetFactory): void {
  registry.set(name, factory);
}

export function getTarget(name: string): TargetContext {
  ensureBuiltinTargetsRegistered();
  const factory = registry.get(name);
  if (!factory) {
    throw new Error(`Target renderer not found: ${name}`);
  }
  return factory();
}

export function getDefaultTarget(): TargetContext {
  return getTarget(defaultTargetName);
}

export function setDefaultTargetName(name: string): void {
  defaultTargetName = name;
}

export function getRegisteredTargetNames(): string[] {
  ensureBuiltinTargetsRegistered();
  return Array.from(registry.keys());
}
