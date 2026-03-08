import type { CoreTeam } from '../core/types.js';

export type Severity = 'error' | 'warning' | 'info';

export interface ValidationResult {
  severity: Severity;
  category: string;
  message: string;
  agent?: string;
}

export type Checker = (team: CoreTeam) => ValidationResult[];
