import { describe, it, expect } from 'vitest';
import { AGENT_SKILLS, isAgentSkill } from '../../../src/core/skills.js';
import { CLAUDE_SKILL_MAP, expandSkillsToTools, reverseMapToolsToSkills } from '../../../src/renderers/claude/skill-map.js';

describe('AGENT_SKILLS', () => {
  it('contains all expected skill names', () => {
    expect(AGENT_SKILLS).toContain('read_files');
    expect(AGENT_SKILLS).toContain('write_files');
    expect(AGENT_SKILLS).toContain('execute');
    expect(AGENT_SKILLS).toContain('search');
    expect(AGENT_SKILLS).toContain('web');
    expect(AGENT_SKILLS).toContain('delegate');
    expect(AGENT_SKILLS).toContain('interact');
    expect(AGENT_SKILLS).toContain('notebook');
  });
});

describe('CLAUDE_SKILL_MAP', () => {
  it('has an entry for every AgentSkill in AGENT_SKILLS', () => {
    for (const skill of AGENT_SKILLS) {
      expect(CLAUDE_SKILL_MAP[skill]).toBeDefined();
    }
  });

  it('each AgentSkill maps to a non-empty CanonicalTool array', () => {
    for (const skill of AGENT_SKILLS) {
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

  it('maps a full skill set to its AgentSkill', () => {
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
    const skills: Array<import('../../../src/core/skills.js').AgentSkill> = ['read_files', 'write_files', 'execute', 'delegate'];
    const tools = expandSkillsToTools(skills);
    const { skills: recovered, remainingTools } = reverseMapToolsToSkills(tools);
    expect(remainingTools).toEqual([]);
    expect(recovered).toEqual(expect.arrayContaining(skills));
    expect(recovered.length).toBe(skills.length);
  });
});

describe('isAgentSkill', () => {
  it('returns true for a valid AgentSkill', () => {
    expect(isAgentSkill('read_files')).toBe(true);
    expect(isAgentSkill('write_files')).toBe(true);
    expect(isAgentSkill('execute')).toBe(true);
    expect(isAgentSkill('search')).toBe(true);
    expect(isAgentSkill('web')).toBe(true);
    expect(isAgentSkill('delegate')).toBe(true);
    expect(isAgentSkill('interact')).toBe(true);
    expect(isAgentSkill('notebook')).toBe(true);
  });

  it('returns false for a CanonicalTool name (not an AgentSkill)', () => {
    expect(isAgentSkill('Read')).toBe(false);
    expect(isAgentSkill('Write')).toBe(false);
    expect(isAgentSkill('Bash')).toBe(false);
    expect(isAgentSkill('Agent')).toBe(false);
  });

  it('returns false for unknown strings', () => {
    expect(isAgentSkill('unknown')).toBe(false);
    expect(isAgentSkill('')).toBe(false);
    expect(isAgentSkill('READ_FILES')).toBe(false);
  });
});
