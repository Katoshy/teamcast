export type { PlatformRenderer, RenderedFile, TeamRenderSpec } from './types.js';
export type { TargetContext } from './target-context.js';
export { registerTarget, getTarget, getDefaultTarget, setDefaultTargetName } from './registry.js';

import { registerTarget } from './registry.js';
import { createClaudeTarget } from './claude/index.js';
import { createCodexTarget } from './codex/index.js';

registerTarget('claude', createClaudeTarget);
registerTarget('codex', createCodexTarget);
export { ClaudeRenderer } from './claude/index.js';
export { CodexRenderer } from './codex/index.js';
