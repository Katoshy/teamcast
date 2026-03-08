import { describe, it, expect } from 'vitest';
import { AGENT_SKILLS, isAgentSkill } from '../../../src/core/skills.js';
import { CLAUDE_SKILL_MAP, expandSkillsToTools } from '../../../src/renderers/claude/skill-map.js';

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
