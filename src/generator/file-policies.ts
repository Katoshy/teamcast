export function isUserEditableGeneratedFile(path: string): boolean {
  return path.startsWith('.claude/skills/');
}
