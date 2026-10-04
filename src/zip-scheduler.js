// JSZip expects setImmediate for asynchronous ZIP processing. Modern Obsidian
// has timers; retain native scheduling where available and use a cancellable
// timer elsewhere. No legacy script-element scheduling or string execution.
export function installZipScheduler(target) {
  if (typeof target.setImmediate === "function") return;
  target.setImmediate = (callback, ...args) => {
    if (typeof callback !== "function") throw new TypeError("Expected a callback");
    return target.setTimeout(() => callback(...args), 0);
  };
  target.clearImmediate = handle => target.clearTimeout(handle);
}
// eslint-disable-next-line obsidianmd/no-global-this -- Polyfill targets the execution realm used by JSZip, not a popout document.
installZipScheduler(globalThis);
