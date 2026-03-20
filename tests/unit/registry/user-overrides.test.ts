import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { ResourceLoader } from '../../../src/registry/resource-loader.js';

const TEST_ENV_YAML = `
id: custom-env
description: "Custom test environment"
detect_files:
  - custom.config.js
policy_rules:
  sandbox:
    enabled: true
  allow:
    - "Bash(custom-tool *)"
instruction_fragments:
  custom_patterns:
    content: "This is a custom environment."
    requires_capabilities:
      - read_files
`;

const NODE_OVERRIDE_YAML = `
id: node
description: "Custom Node.js override with extra tools"
detect_files:
  - package.json
policy_rules:
  sandbox:
    enabled: true
  allow:
    - "Bash(npm run *)"
    - "Bash(pnpm *)"
instruction_fragments:
  node_custom:
    content: "Use pnpm instead of npm."
    requires_capabilities:
      - read_files
`;

describe('user resource overrides', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `agentforge-test-${Date.now()}`);
    mkdirSync(join(tempDir, '.agentforge', 'environments'), { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('loads a custom user environment', () => {
    writeFileSync(join(tempDir, '.agentforge', 'environments', 'custom-env.yaml'), TEST_ENV_YAML);

    const loader = new ResourceLoader();
    loader.loadUserResources(tempDir);

    expect(loader.hasEnvironment('custom-env')).toBe(true);
    const env = loader.getEnvironment('custom-env')!;
    expect(env.description).toBe('Custom test environment');
    expect(env.policyRules.allow).toContain('Bash(custom-tool *)');
  });

  it('user environment can override a builtin', () => {
    writeFileSync(join(tempDir, '.agentforge', 'environments', 'node.yaml'), NODE_OVERRIDE_YAML);

    const loader = new ResourceLoader();
    // First load builtins
    loader.loadEnvironmentsFromDir(join(tempDir, 'fake-builtins'));
    // Then load user overrides
    loader.loadUserResources(tempDir);

    const env = loader.getEnvironment('node')!;
    expect(env.description).toBe('Custom Node.js override with extra tools');
    expect(env.policyRules.allow).toContain('Bash(pnpm *)');
  });

  it('does nothing when .agentforge directory does not exist', () => {
    const loader = new ResourceLoader();
    const emptyDir = join(tmpdir(), `agentforge-empty-${Date.now()}`);
    mkdirSync(emptyDir, { recursive: true });

    expect(() => loader.loadUserResources(emptyDir)).not.toThrow();
    expect(loader.listEnvironments()).toHaveLength(0);

    rmSync(emptyDir, { recursive: true, force: true });
  });

  it('loadUserResources is idempotent', () => {
    writeFileSync(join(tempDir, '.agentforge', 'environments', 'custom-env.yaml'), TEST_ENV_YAML);

    const loader = new ResourceLoader();
    loader.loadUserResources(tempDir);
    loader.loadUserResources(tempDir); // second call should be no-op

    expect(loader.listEnvironments()).toHaveLength(1);
  });

  it('detects custom environments by cwd', () => {
    writeFileSync(join(tempDir, '.agentforge', 'environments', 'custom-env.yaml'), TEST_ENV_YAML);
    writeFileSync(join(tempDir, 'custom.config.js'), '// marker');

    const loader = new ResourceLoader();
    loader.loadUserResources(tempDir);

    const detected = loader.detectEnvironments(tempDir);
    expect(detected).toContain('custom-env');
  });
});
