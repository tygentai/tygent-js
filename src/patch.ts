/**
 * Central patch installer for Tygent integrations.
 */

/* eslint-disable @typescript-eslint/no-var-requires */

const DEFAULT_MODULES = [
  './integrations/google-ai',
  './integrations/crewai',
  './integrations/langflow',
];

/**
 * Attempt to load integration modules and run their exported `patch` functions.
 * Missing modules or patch failures are ignored to mirror Python's forgiving
 * installer.
 */
export function install(modules?: string[]): void {
  const targets = modules && modules.length ? modules : DEFAULT_MODULES;

  for (const mod of targets) {
    try {
      // eslint-disable-next-line global-require
      const imported = require(mod);
      const patchFn = imported?.patch;
      if (typeof patchFn === 'function') {
        try {
          patchFn();
        } catch (error) {
          // Ignore integration-specific patch errors to keep install resilient.
        }
      }
    } catch (error) {
      // Ignore missing modules or require errors to mimic Python behaviour.
    }
  }
}
