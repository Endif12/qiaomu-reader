import test from "node:test";
import assert from "node:assert/strict";
import { aiReadingAppearance, editableAiAppearance, setAiAppearanceFollowing } from "../src/ai-appearance.js";

test("legacy settings follow book changes without copying reading state", () => {
  const settings = { theme: "paper", fontFamily: "zhuque", fontSize: 18, lineHeight: 1.8 };
  assert.equal(aiReadingAppearance(settings).theme, "paper");
  settings.theme = "night"; settings.fontSize = 22;
  assert.equal(aiReadingAppearance(settings).theme, "night");
  assert.equal(aiReadingAppearance(settings).fontSize, 22);
});
test("independent appearance survives save/load and does not change the book", () => {
  const settings = { theme: "paper", fontFamily: "zhuque", fontSize: 18, lineHeight: 1.8, importedFonts: [] };
  setAiAppearanceFollowing(settings, false);
  const editable = editableAiAppearance(settings);
  editable.theme = "black"; editable.fontSize = 24; editable.fontFamily = "custom"; editable.customFontFamily = "Songti SC";
  assert.equal(settings.theme, "paper"); assert.equal(settings.fontSize, 18);
  settings.theme = "warm";
  const restored = JSON.parse(JSON.stringify(settings));
  assert.equal(aiReadingAppearance(restored).theme, "black");
  assert.equal(aiReadingAppearance(restored).fontSize, 24);
  assert.equal(aiReadingAppearance(restored).customFontFamily, "Songti SC");
  setAiAppearanceFollowing(restored, true);
  assert.equal(aiReadingAppearance(restored).theme, "warm");
});
test("imported font library is shared while custom font selection stays separate", () => {
  const settings = { fontFamily: "zhuque", customFontId: "book-font", importedFonts: [{ id: "book-font" }] };
  setAiAppearanceFollowing(settings, false);
  const editable = editableAiAppearance(settings);
  editable.importedFonts = [...editable.importedFonts, { id: "chat-font" }];
  editable.customFontId = "chat-font";
  assert.equal(settings.importedFonts.length, 2);
  assert.equal(settings.customFontId, "book-font");
  assert.equal(aiReadingAppearance(settings).customFontId, "chat-font");
  assert.equal(aiReadingAppearance(settings).importedFonts, settings.importedFonts);
});
test("malformed stored sizes are constrained without changing persisted settings", () => {
  const settings = { fontSize: 18, lineHeight: 1.8, aiAppearance: { fontSize: 999, lineHeight: -1 } };
  assert.equal(aiReadingAppearance(settings).fontSize, 32);
  assert.equal(aiReadingAppearance(settings).lineHeight, 1.4);
  assert.equal(settings.aiAppearance.fontSize, 999);
});
