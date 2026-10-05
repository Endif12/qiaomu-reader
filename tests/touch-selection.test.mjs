import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { parse } from "acorn";

const source = fs.readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
const ast = parse(source, { ecmaVersion: "latest", sourceType: "module" });
const wanted = new Set([
  "noteTouchSelStart",
  "noteTouchSelEnd",
  "flowSelKey",
  "touchPopupDelay",
  "TOUCH_SEL_STABLE_MS",
  "TOUCH_SEL_RECENT_MS",
  "TOUCH_SEL_END_QUIET_MS",
]);
const chunks = [];
for (const node of ast.body) {
  if (node.type === "FunctionDeclaration" && wanted.has(node.id.name)) {
    chunks.push(source.slice(node.start, node.end));
  } else if (node.type === "VariableDeclaration" && node.declarations.some((d) => wanted.has(d.id.name))) {
    chunks.push(source.slice(node.start, node.end));
  }
}
const code = chunks.join("\n");
assert.ok(code.includes("touchPopupDelay"), "gating helpers must exist in src/main.js");

function setup() {
  let fakeNow = 1_000_000;
  const sandbox = {};
  vm.createContext(sandbox);
  sandbox.Date = { now: () => fakeNow };
  sandbox.window = {
    clearTimeout: () => {},
    setTimeout: () => 0,
  };
  vm.runInContext(`${code}\nthis.__api = { noteTouchSelStart, noteTouchSelEnd, flowSelKey, touchPopupDelay, TOUCH_SEL_STABLE_MS, TOUCH_SEL_RECENT_MS, TOUCH_SEL_END_QUIET_MS };`, sandbox);
  return { api: sandbox.__api, advance: (ms) => { fakeNow += ms; }, now: () => fakeNow };
}

test("mouse selection keeps the fast path (no popup delay)", () => {
  const { api } = setup();
  assert.equal(api.touchPopupDelay({}, "key-a"), 0);
  // A touch long ago must not slow down the mouse either.
  const view = { _lastTouchAt: 1_000_000 - api.TOUCH_SEL_RECENT_MS - 1000 };
  assert.equal(api.touchPopupDelay(view, "key-a"), 0);
});

test("touch drag defers the popup until the finger lifts and text is stable", () => {
  const { api, advance, now } = setup();
  const view = { _hideHlPopup: () => {} };
  api.noteTouchSelStart(view);
  assert.equal(view._touchSelActive, true);
  // Finger still down: always deferred, never 0.
  assert.equal(api.touchPopupDelay(view, "hello"), api.TOUCH_SEL_STABLE_MS);

  api.noteTouchSelEnd(view);
  assert.equal(view._touchSelActive, false);
  // Right after lift there is a short quiet window, not a popup.
  const first = api.touchPopupDelay(view, "hello");
  assert.ok(first > 0 && first <= api.TOUCH_SEL_STABLE_MS, `expected deferred, got ${first}`);

  // Same text seen again too early: still deferred.
  advance(100);
  assert.ok(api.touchPopupDelay(view, "hello") > 0);

  // Same text after the stability window: popup allowed.
  advance(api.TOUCH_SEL_STABLE_MS);
  assert.equal(api.touchPopupDelay(view, "hello"), 0);
  void now;
});

test("changing the text mid-gesture restarts the stability window", () => {
  const { api, advance } = setup();
  const view = { _hideHlPopup: () => {} };
  api.noteTouchSelStart(view);
  api.noteTouchSelEnd(view);
  api.touchPopupDelay(view, "hello");
  advance(api.TOUCH_SEL_STABLE_MS + 10);
  assert.equal(api.touchPopupDelay(view, "hello"), 0);
  // User keeps dragging the handle: new text must defer again.
  assert.equal(api.touchPopupDelay(view, "hello world"), api.TOUCH_SEL_STABLE_MS);
});

test("flowSelKey distinguishes selections", () => {
  const { api } = setup();
  const a = [{ block: 3, text: "hello" }];
  const b = [{ block: 3, text: "hello world" }];
  const c = [{ block: 3, text: "hello" }];
  assert.equal(api.flowSelKey(a), api.flowSelKey(c));
  assert.notEqual(api.flowSelKey(a), api.flowSelKey(b));
});
