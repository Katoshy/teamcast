export type { PlatformRenderer, RenderedFile, TeamRenderSpec } from './types.js';
export type { TargetContext } from './target-context.js';
export {
  ensureBuiltinTargetsRegistered,
  registerTarget,
  getTarget,
  getDefaultTarget,
  setDefaultTargetName,
} from './registry.js';
export { ClaudeRenderer } from './claude/index.js';
export { CodexRenderer } from './codex/index.js';
