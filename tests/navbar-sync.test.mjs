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

function setup(calls) {
  const sandbox = {};
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
  return { api, view, sync: api.readerNavbarSync(view) };
}

const touch = (y) => ({ touches: [{ clientX: 10, clientY: y }] });

test("no navbar means no crash and no calls", () => {
  const { api } = setup([]);
  assert.doesNotThrow(() => api.setReaderNavbarHidden({}, true));
  assert.doesNotThrow(() => api.setReaderNavbarHidden(null, false));
});

test("scroll down hides, scroll up shows", () => {
  const calls = [];
  const { sync } = setup(calls);
  sync.onTouchStart(touch(500));
  sync.onTouchMove(touch(497)); // 3px jitter: nothing
  assert.deepEqual(calls, []);
  sync.onTouchMove(touch(480)); // -20: hide
  assert.deepEqual(calls, ["hide"]);
  sync.onTouchMove(touch(400)); // further up: hide again is fine
  assert.deepEqual(calls, ["hide", "hide"]);
  sync.onTouchMove(touch(420)); // +20: show
  assert.deepEqual(calls, ["hide", "hide", "show"]);
});

test("wheel and tap drive the bar", () => {
  const calls = [];
  const { sync } = setup(calls);
  sync.onWheel({ deltaY: 120 });
  sync.onWheel({ deltaY: -120 });
  sync.onTap();
  assert.deepEqual(calls, ["hide", "show", "show"]);
});

test("multi-touch never toggles the bar", () => {
  const calls = [];
  const { sync } = setup(calls);
  sync.onTouchStart({ touches: [{ clientX: 1, clientY: 500 }, { clientX: 2, clientY: 500 }] });
  sync.onTouchMove({ touches: [{ clientX: 1, clientY: 100 }, { clientX: 2, clientY: 100 }] });
  assert.deepEqual(calls, []);
});
