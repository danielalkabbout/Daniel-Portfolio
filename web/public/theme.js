// Runs before the page paints, so the saved theme applies without a flash. Kept as a file (not inline)
// so the Content-Security-Policy can forbid inline scripts.
try {
  document.documentElement.dataset.theme = localStorage.getItem('theme') || 'dark';
} catch (e) {
  document.documentElement.dataset.theme = 'dark';
}
