import { describe, it, expect } from 'vitest';
import { CAPABILITY_IDS, isCapability } from '../../../src/registry/capabilities.js';
import { CLAUDE_SKILL_MAP, expandSkillsToTools, reverseMapToolsToSkills } from '../../../src/renderers/claude/skill-map.js';

describe('CAPABILITY_IDS', () => {
  it('contains all expected skill names', () => {
    expect(CAPABILITY_IDS).toContain('read_files');
    expect(CAPABILITY_IDS).toContain('write_files');
    expect(CAPABILITY_IDS).toContain('execute');
    expect(CAPABILITY_IDS).toContain('search');
    expect(CAPABILITY_IDS).toContain('web');
    expect(CAPABILITY_IDS).toContain('delegate');
    expect(CAPABILITY_IDS).toContain('interact');
    expect(CAPABILITY_IDS).toContain('notebook');
  });
});

describe('CLAUDE_SKILL_MAP', () => {
  it('has an entry for every CapabilityId in CAPABILITY_IDS', () => {
    for (const skill of CAPABILITY_IDS) {
      expect(CLAUDE_SKILL_MAP[skill]).toBeDefined();
    }
  });

  it('each CapabilityId maps to a non-empty CanonicalTool array', () => {
    for (const skill of CAPABILITY_IDS) {
      expect(CLAUDE_SKILL_MAP[skill].length).toBeGreaterThan(0);
    }
  });

  it('read_files maps to Read, Grep, Glob', () => {
    expect(CLAUDE_SKILL_MAP.read_files).toEqual(['Read', 'Grep', 'Glob']);
  });

  it('write_files maps to Write, Edit, MultiEdit', () => {
    expect(CLAUDE_SKILL_MAP.write_files).toEqual(['Write', 'Edit', 'MultiEdit']);
  });

  it('execute maps to Bash', () => {
    expect(CLAUDE_SKILL_MAP.execute).toEqual(['Bash']);
  });

  it('delegate maps to Agent', () => {
    expect(CLAUDE_SKILL_MAP.delegate).toEqual(['Agent']);
  });

  it('notebook maps to NotebookEdit', () => {
    expect(CLAUDE_SKILL_MAP.notebook).toEqual(['NotebookEdit']);
  });
});

describe('expandSkillsToTools', () => {
  it('returns empty array for empty input', () => {
    expect(expandSkillsToTools([])).toEqual([]);
  });

  it('expands read_files correctly', () => {
    expect(expandSkillsToTools(['read_files'])).toEqual(['Read', 'Grep', 'Glob']);
  });

  it('expands execute correctly', () => {
    expect(expandSkillsToTools(['execute'])).toEqual(['Bash']);
  });

  it('expands read_files and execute without duplicates', () => {
    const result = expandSkillsToTools(['read_files', 'execute']);
    expect(result).toEqual(expect.arrayContaining(['Read', 'Grep', 'Glob', 'Bash']));
    expect(result.length).toBe(4);
  });

  it('deduplicates overlapping tools when read_files and search are combined', () => {
    // read_files: [Read, Grep, Glob], search: [Glob, Grep] — Glob and Grep overlap
    const result = expandSkillsToTools(['read_files', 'search']);
    // Each tool should appear only once
    const unique = new Set(result);
    expect(unique.size).toBe(result.length);
    expect(result).toEqual(expect.arrayContaining(['Read', 'Grep', 'Glob']));
    // Deduplication: total is 3, not 5
    expect(result.length).toBe(3);
  });

  it('expands delegate to Agent tool', () => {
    const result = expandSkillsToTools(['delegate']);
    expect(result).toEqual(['Agent']);
  });

  it('expands web to WebFetch and WebSearch', () => {
    const result = expandSkillsToTools(['web']);
    expect(result).toEqual(['WebFetch', 'WebSearch']);
  });

  it('expands interact to AskUserQuestion, TodoWrite, TodoRead', () => {
    const result = expandSkillsToTools(['interact']);
    expect(result).toEqual(['AskUserQuestion', 'TodoWrite', 'TodoRead']);
  });
});

describe('reverseMapToolsToSkills', () => {
  it('returns empty skills and empty remainingTools for empty input', () => {
    expect(reverseMapToolsToSkills([])).toEqual({ skills: [], remainingTools: [] });
  });

  it('maps a full skill set to its CapabilityId', () => {
    const result = reverseMapToolsToSkills(['Read', 'Grep', 'Glob']);
    expect(result).toEqual({ skills: ['read_files'], remainingTools: [] });
  });

  it('maps execute (single-tool skill) correctly', () => {
    const result = reverseMapToolsToSkills(['Bash']);
    expect(result).toEqual({ skills: ['execute'], remainingTools: [] });
  });

  it('maps multiple full skills and leaves no remaining tools', () => {
    const result = reverseMapToolsToSkills(['Read', 'Glob', 'Grep', 'Write', 'Edit', 'MultiEdit', 'Bash']);
    expect(result.skills).toEqual(expect.arrayContaining(['read_files', 'write_files', 'execute']));
    expect(result.remainingTools).toEqual([]);
  });

  it('leaves partial tool sets as remainingTools', () => {
    // read_files needs Read+Glob+Grep; only Read present, no full match
    const result = reverseMapToolsToSkills(['Read', 'Bash']);
    expect(result.skills).toEqual(['execute']);
    expect(result.remainingTools).toEqual(['Read']);
  });

  it('prefers larger skills over smaller overlapping ones (greedy)', () => {
    // read_files: [Read, Grep, Glob] (3 tools), search: [Glob, Grep] (2 tools)
    // read_files should be matched first, consuming Glob and Grep so search cannot match
    const result = reverseMapToolsToSkills(['Read', 'Grep', 'Glob']);
    expect(result.skills).toEqual(['read_files']);
    expect(result.remainingTools).toEqual([]);
  });

  it('maps delegate skill', () => {
    const result = reverseMapToolsToSkills(['Agent']);
    expect(result).toEqual({ skills: ['delegate'], remainingTools: [] });
  });

  it('maps web skill', () => {
    const result = reverseMapToolsToSkills(['WebFetch', 'WebSearch']);
    expect(result).toEqual({ skills: ['web'], remainingTools: [] });
  });

  it('maps interact skill', () => {
    const result = reverseMapToolsToSkills(['AskUserQuestion', 'TodoWrite', 'TodoRead']);
    expect(result).toEqual({ skills: ['interact'], remainingTools: [] });
  });

  it('maps notebook skill', () => {
    const result = reverseMapToolsToSkills(['NotebookEdit']);
    expect(result).toEqual({ skills: ['notebook'], remainingTools: [] });
  });

  it('handles unknown tool names as remainingTools', () => {
    const result = reverseMapToolsToSkills(['SomeFutureTool', 'AnotherTool']);
    expect(result.skills).toEqual([]);
    expect(result.remainingTools).toEqual(expect.arrayContaining(['SomeFutureTool', 'AnotherTool']));
  });

  it('round-trips through expandSkillsToTools', () => {
    const skills: Array<import('../../../src/registry/types.js').CapabilityId> = ['read_files', 'write_files', 'execute', 'delegate'];
    const tools = expandSkillsToTools(skills);
    const { skills: recovered, remainingTools } = reverseMapToolsToSkills(tools);
    expect(remainingTools).toEqual([]);
    expect(recovered).toEqual(expect.arrayContaining(skills));
    expect(recovered.length).toBe(skills.length);
  });
});

describe('isCapability', () => {
  it('returns true for a valid CapabilityId', () => {
    expect(isCapability('read_files')).toBe(true);
    expect(isCapability('write_files')).toBe(true);
    expect(isCapability('execute')).toBe(true);
    expect(isCapability('search')).toBe(true);
    expect(isCapability('web')).toBe(true);
    expect(isCapability('delegate')).toBe(true);
    expect(isCapability('interact')).toBe(true);
    expect(isCapability('notebook')).toBe(true);
  });

  it('returns false for a CanonicalTool name (not an CapabilityId)', () => {
    expect(isCapability('Read')).toBe(false);
    expect(isCapability('Write')).toBe(false);
    expect(isCapability('Bash')).toBe(false);
    expect(isCapability('Agent')).toBe(false);
  });

  it('returns false for unknown strings', () => {
    expect(isCapability('unknown')).toBe(false);
    expect(isCapability('')).toBe(false);
    expect(isCapability('READ_FILES')).toBe(false);
  });
});
