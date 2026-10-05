import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { parse } from "acorn";

const source = fs.readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
const ast = parse(source, { ecmaVersion: "latest", sourceType: "module" });
const wanted = new Set(["setReaderNavbarHidden", "readerNavbarSync"]);
const code = ast.body
  .filter((n) => n.type === "FunctionDeclaration" && wanted.has(n.id.name))
  .map((n) => source.slice(n.start, n.end))
  .join("\n");
assert.ok(code.includes("readerNavbarSync"), "navbar sync helpers must exist in src/main.js");

function setup() {
  const calls = [];
  let fakeNow = 1_000_000;
  const sandbox = { Date: { now: () => fakeNow } };
  vm.createContext(sandbox);
  vm.runInContext(
    `${code}\nthis.__api = { setReaderNavbarHidden, readerNavbarSync };`,
    sandbox,
  );
  const api = sandbox.__api;
  const view = { app: { mobileNavbar: {
    hide: () => calls.push("hide"),
    show: () => calls.push("show"),
  } } };
  return {
    api, view, calls,
    sync: api.readerNavbarSync(view),
    advance: (ms) => { fakeNow += ms; },
  };
}

const touch = (x, y, n = 1) => ({
  touches: Array.from({ length: n }, () => ({ clientX: x, clientY: y })),
});

test("no navbar means no crash and no calls", () => {
  const { api } = setup();
  assert.doesNotThrow(() => api.setReaderNavbarHidden({}, true));
  assert.doesNotThrow(() => api.setReaderNavbarHidden(null, false));
});

test("scroll down hides, scroll up shows, jitter does nothing", () => {
  const { sync, calls } = setup();
  sync.onTouchStart(touch(10, 500));
  sync.onTouchMove(touch(10, 497)); // 3px jitter: nothing
  sync.onTouchMove(touch(12, 490)); // still under 24px: nothing
  assert.deepEqual(calls, []);
  sync.onTouchMove(touch(10, 470)); // -30: hide
  assert.deepEqual(calls, ["hide"]);
  sync.onTouchMove(touch(10, 380)); // further up: hide again is fine
  assert.deepEqual(calls, ["hide", "hide"]);
  sync.onTouchMove(touch(10, 410)); // +30: show
  assert.deepEqual(calls, ["hide", "hide", "show"]);
});

test("a real tap shows, a scroll-release does not", () => {
  const { sync, calls, advance } = setup();
  // Tap: short and stationary.
  sync.onTouchStart(touch(10, 500));
  advance(120);
  sync.onTouchEnd({ touches: [] });
  assert.deepEqual(calls, ["show"]);
  // Scroll then release: no tap-show.
  calls.length = 0;
  sync.onTouchStart(touch(10, 500));
  sync.onTouchMove(touch(10, 300));
  advance(900);
  sync.onTouchEnd({ touches: [] });
  assert.deepEqual(calls, ["hide"]);
});

test("click right after touch is the same gesture, mouse click still shows", () => {
  const { sync, calls, advance } = setup();
  sync.onTouchStart(touch(10, 500));
  sync.onTouchEnd({ touches: [] });
  assert.deepEqual(calls, ["show"]);
  calls.length = 0;
  sync.onTap(); // phantom click after the touch: ignored
  assert.deepEqual(calls, []);
  advance(900);
  sync.onTap(); // genuine later click (e.g. mouse): shows
  assert.deepEqual(calls, ["show"]);
});

test("wheel and multi-touch behave", () => {
  const { sync, calls } = setup();
  sync.onWheel({ deltaY: 120 });
  sync.onWheel({ deltaY: -120 });
  assert.deepEqual(calls, ["hide", "show"]);
  calls.length = 0;
  sync.onTouchStart(touch(1, 500, 2));
  sync.onTouchMove(touch(1, 100, 2));
  sync.onTouchEnd({ touches: [] });
  assert.deepEqual(calls, []);
});
