export interface GeneratedFile {
  /** Path relative to project root, e.g. ".claude/agents/developer.md" */
  path: string;
  content: string;
}

export interface GeneratorOptions {
  cwd: string;
  /** If true, skip writing to disk (used by diff) */
  dryRun?: boolean;
}
