export type InstructionBlockKind =
  | 'behavior'
  | 'workflow'
  | 'safety'
  | 'style'
  | 'delegation';

export interface InstructionBlock {
  kind: InstructionBlockKind;
  title?: string;
  content: string;
}

export const INSTRUCTION_BLOCK_KINDS: InstructionBlockKind[] = [
  'behavior',
  'workflow',
  'safety',
  'style',
  'delegation',
];

export function normalizeInstructionBlocks(blocks: InstructionBlock[] | undefined): InstructionBlock[] {
  if (!blocks?.length) return [];

  return blocks
    .map((block) => ({
      kind: block.kind,
      title: block.title?.trim() || undefined,
      content: block.content.trim(),
    }))
    .filter((block) => block.content.length > 0);
}

export function renderInstructionBlocks(blocks: InstructionBlock[] | undefined): string | undefined {
  const normalized = normalizeInstructionBlocks(blocks);
  if (normalized.length === 0) return undefined;

  return normalized
    .map((block) => {
      if (!block.title) {
        return block.content;
      }

      return `## ${block.title}\n\n${block.content}`;
    })
    .join('\n\n')
    .trim();
}
