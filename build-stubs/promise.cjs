// All supported Obsidian WebViews have native Promise. Use it directly rather
// than bundling the pre-ES6 fallback's script-based scheduling machinery.
module.exports = Promise;
