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
