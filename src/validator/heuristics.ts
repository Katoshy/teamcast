import type { CapabilityId, CapabilityToolMap } from '../registry/types.js';
import { agentHasCapability } from '../core/capability-resolver.js';

export interface ContradictionPattern {
  pattern: RegExp;
  /** If the pattern says "don't do X", the agent has this capability but shouldn't */
  deniedCapability?: CapabilityId;
  /** If the pattern says "do X", the agent should have this capability */
  requiredCapability?: CapabilityId;
}

export interface ContradictionResult {
  pattern: string;
  capability: CapabilityId;
  type: 'denied' | 'required';
}

const CONTRADICTION_PATTERNS: ContradictionPattern[] = [
  {
    pattern: /do not (modify|edit|write|change) files/i,
    deniedCapability: 'write_files',
  },
  {
    pattern: /run (tests|the test suite|npm test|pytest)/i,
    requiredCapability: 'execute',
  },
  {
    pattern: /search the web|look up|find documentation online/i,
    requiredCapability: 'web',
  },
  {
    pattern: /delegate to \w+/i,
    requiredCapability: 'delegate',
  },
];

const AGENT_REFERENCE_PATTERNS: RegExp[] = [
  /delegate to (\w+)/gi,
  /hand off to (\w+)/gi,
  /ask (?:the )?(\w+) to/gi,
];

/**
 * Common English words that should not be treated as agent names.
 * These appear naturally in instruction prose and are not agent identifiers.
 */
const STOPWORDS = new Set([
  'the', 'a', 'an', 'your', 'my', 'our', 'their', 'its',
  'this', 'that', 'these', 'those',
  'appropriate', 'relevant', 'correct', 'right',
  'user', 'human', 'team', 'it', 'them',
]);

/**
 * Find contradictions between instruction text and agent capabilities.
 * - "denied" means instruction says not to do X but agent HAS the capability
 * - "required" means instruction says to do X but agent LACKS the capability
 */
export function findContradictions(
  content: string,
  agentTools: string[],
  skillMap: CapabilityToolMap,
): ContradictionResult[] {
  const results: ContradictionResult[] = [];

  for (const entry of CONTRADICTION_PATTERNS) {
    if (!entry.pattern.test(content)) continue;

    if (entry.deniedCapability) {
      // Instruction says "don't do X" — flag if agent HAS the capability
      if (agentHasCapability(agentTools, entry.deniedCapability, skillMap)) {
        results.push({
          pattern: entry.pattern.source,
          capability: entry.deniedCapability,
          type: 'denied',
        });
      }
    }

    if (entry.requiredCapability) {
      // Instruction says "do X" — flag if agent LACKS the capability
      if (!agentHasCapability(agentTools, entry.requiredCapability, skillMap)) {
        results.push({
          pattern: entry.pattern.source,
          capability: entry.requiredCapability,
          type: 'required',
        });
      }
    }
  }

  return results;
}

/**
 * Extract agent names referenced in instruction content.
 * Returns lowercased unique names, excluding common English stopwords.
 */
export function findReferencedAgents(content: string): string[] {
  const names = new Set<string>();

  for (const pattern of AGENT_REFERENCE_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      const name = match[1].toLowerCase();
      if (!STOPWORDS.has(name)) {
        names.add(name);
      }
    }
  }

  return [...names];
}
