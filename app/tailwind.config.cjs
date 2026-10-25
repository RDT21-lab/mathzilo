// Tokens de diseño de la fase 1 (kit/tokens) como preset de Tailwind.
module.exports = {
  presets: [require('./tailwind.tokens.cjs')],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  corePlugins: { preflight: false }
};
