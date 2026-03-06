import type { AgentForgeManifest } from '../types/manifest.js';

export type Severity = 'error' | 'warning' | 'info';

export interface ValidationResult {
  severity: Severity;
  category: string;
  message: string;
  agent?: string;
}

export type Checker = (manifest: AgentForgeManifest) => ValidationResult[];
