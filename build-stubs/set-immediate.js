// JSZip only schedules function callbacks. Older upstream fallbacks accept
// source strings and inject script tags; neither is needed by Obsidian.
if (typeof globalThis.setImmediate !== "function") {
  globalThis.setImmediate = (callback, ...args) => {
    if (typeof callback !== "function") throw new TypeError("Expected a function callback");
    return globalThis.setTimeout(() => callback(...args), 0);
  };
  globalThis.clearImmediate = (id) => globalThis.clearTimeout(id);
}
