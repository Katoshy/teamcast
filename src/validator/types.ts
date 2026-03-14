import type { CoreTeam } from '../core/types.js';

export type Severity = 'error' | 'warning' | 'info';

export type ValidationPhase =
  | 'registry'
  | 'traits'
  | 'capabilities'
  | 'policies'
  | 'capability-policy'
  | 'skills'
  | 'instructions'
  | 'team-graph'
  | 'environment'
  | 'mcp';

export interface ValidationResult {
  severity: Severity;
  category: string;
  message: string;
  agent?: string;
  phase?: ValidationPhase;
  code?: string;
}

export type Checker = (team: CoreTeam) => ValidationResult[];
