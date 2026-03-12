import type { ManifestTargetName } from '../manifest/targets.js';
import { claudeImportHandler, importFromClaudeDir } from './claude.js';
import { codexImportHandler, importFromCodexDir } from './codex.js';
import type { ImportHandler, ImportResult, ImportWarning } from './types.js';

const registry = new Map<ManifestTargetName, ImportHandler>();
let builtinsRegistered = false;

function ensureBuiltinImportHandlersRegistered(): void {
  if (builtinsRegistered) {
    return;
  }

  registry.set('claude', claudeImportHandler);
  registry.set('codex', codexImportHandler);
  builtinsRegistered = true;
}

export function registerImportHandler(handler: ImportHandler): void {
  ensureBuiltinImportHandlersRegistered();
  if (registry.has(handler.targetName)) {
    throw new Error(`Importer for target "${handler.targetName}" is already registered`);
  }
  registry.set(handler.targetName, handler);
}

export function getImportHandler(targetName: ManifestTargetName): ImportHandler | undefined {
  ensureBuiltinImportHandlersRegistered();
  return registry.get(targetName);
}

export function getImportHandlers(): ImportHandler[] {
  ensureBuiltinImportHandlersRegistered();
  return Array.from(registry.values());
}

export function getDetectedImportHandlers(cwd: string): ImportHandler[] {
  return getImportHandlers().filter((handler) => handler.detect(cwd));
}

export function importTargetFromDir(
  targetName: ManifestTargetName,
  cwd: string,
  projectName: string,
): ImportResult {
  const handler = getImportHandler(targetName);
  if (!handler) {
    throw new Error(`Importer not found for target "${targetName}"`);
  }
  return handler.importFromDir(cwd, projectName);
}

export { importFromClaudeDir, importFromCodexDir };
export type { ImportHandler, ImportResult, ImportWarning };
