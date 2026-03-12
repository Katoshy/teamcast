import type { ManifestTargetName } from '../manifest/targets.js';
import type { TeamCastManifest } from '../manifest/types.js';

export interface ImportWarning {
  file: string;
  message: string;
}

export interface ImportResult {
  team: TeamCastManifest;
  warnings: ImportWarning[];
}

export interface ImportHandler {
  targetName: ManifestTargetName;
  detect(cwd: string): boolean;
  importFromDir(cwd: string, projectName: string): ImportResult;
}
