import { getPresetRecord } from '../../presets/index.js';
import type { TeamCastPlugin } from '../types.js';

export const corePresetsPlugin: TeamCastPlugin = {
  scope: 'core-catalog',
  name: 'core-presets',
  version: '1.0.0',
  description: 'Built-in TeamCast preset catalog',
  get presets() {
    return getPresetRecord();
  },
};
