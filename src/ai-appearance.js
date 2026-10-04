const APPEARANCE_KEYS = ["theme", "einkMode", "fontFamily", "customFontFamily", "customFontId", "fontSize", "lineHeight"];

export function aiReadingAppearance(settings) {
  const custom = settings.aiAppearance;
  const effective = { ...settings };
  if (custom && typeof custom === "object" && !Array.isArray(custom)) {
    for (const key of APPEARANCE_KEYS) if (custom[key] !== undefined) effective[key] = custom[key];
  }
  effective.fontSize = Math.min(32, Math.max(12, Number(effective.fontSize) || 18));
  effective.lineHeight = Math.min(2.2, Math.max(1.4, Number(effective.lineHeight) || 1.8));
  return effective;
}

export function setAiAppearanceFollowing(settings, follow) {
  if (follow) settings.aiAppearance = null;
  else {
    const effective = aiReadingAppearance(settings);
    settings.aiAppearance = Object.fromEntries(APPEARANCE_KEYS.map(key => [key, effective[key]]));
  }
}

// Font selections are independent; imported files share the reader's library.
export function editableAiAppearance(settings) {
  return new Proxy(settings.aiAppearance, {
    get(target, key) { return key === "importedFonts" ? settings.importedFonts : target[key]; },
    set(target, key, value) {
      if (key === "importedFonts") settings.importedFonts = value;
      else target[key] = value;
      return true;
    },
  });
}
