import * as projectBackend from '$lib/modules/projects/backend';
import * as reviewBackend from '$lib/modules/review/backend';
import * as runtimeBackend from '$lib/modules/runtime/backend';
import * as settingsBackend from '$lib/modules/settings/backend';

export const api = {
  ...settingsBackend,
  ...projectBackend,
  ...reviewBackend,
  ...runtimeBackend
};
