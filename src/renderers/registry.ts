import type { TargetContext } from './target-context.js';

export type TargetFactory = () => TargetContext;

const registry = new Map<string, TargetFactory>();
let defaultTargetName = 'claude';

export function registerTarget(name: string, factory: TargetFactory): void {
  registry.set(name, factory);
}

export function getTarget(name: string): TargetContext {
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
  return Array.from(registry.keys());
}
