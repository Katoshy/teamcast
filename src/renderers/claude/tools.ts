export type CanonicalTool =
  | 'Read'
  | 'Write'
  | 'Edit'
  | 'MultiEdit'
  | 'Grep'
  | 'Glob'
  | 'Bash'
  | 'WebFetch'
  | 'WebSearch'
  | 'Agent'
  | 'AskUserQuestion'
  | 'TodoWrite'
  | 'TodoRead'
  | 'NotebookEdit';

export const CLAUDE_CODE_TOOLS: CanonicalTool[] = [
  'Read', 'Write', 'Edit', 'MultiEdit',
  'Grep', 'Glob',
  'Bash',
  'WebFetch', 'WebSearch',
  'Agent',
  'AskUserQuestion', 'TodoWrite', 'TodoRead',
  'NotebookEdit',
];

// Extended set that includes the legacy 'Task' alias used in older manifests.
export const COMPAT_CLAUDE_CODE_TOOLS: Array<CanonicalTool | 'Task'> = [...CLAUDE_CODE_TOOLS, 'Task'];
