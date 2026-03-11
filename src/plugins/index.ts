import { PluginRegistry } from './registry.js';
import { coreToolsPlugin } from './core/tools-plugin.js';
import { coreModelsPlugin } from './core/models-plugin.js';
import { nodeEnvPlugin } from './environments/node-env-plugin.js';
import { pythonEnvPlugin } from './environments/python-env-plugin.js';

export const defaultRegistry = new PluginRegistry();

// Register built-in plugins
defaultRegistry.register(coreToolsPlugin);
defaultRegistry.register(coreModelsPlugin);
defaultRegistry.register(nodeEnvPlugin);
defaultRegistry.register(pythonEnvPlugin);

// TODO: Register core-presets-plugin once presets are migrated
