// StarMath — preset de Tailwind para la fase 2 (esqueleto de la PWA).
// Uso: en tailwind.config.js → presets: [require('./tailwind.tokens.js')]
module.exports = {
  theme: {
    extend: {
      colors: {
        navy: '#0A1230',
        card: { DEFAULT: '#12275F', raised: '#1B3680' },
        gold: { DEFAULT: '#FFC933', deep: '#E0A200', ink: '#3A2A00' },
        bone: '#F7F7FA',
        muted: '#A9B6E0',
        line: '#2A4390',
        ok: '#3DDC97',
        softfail: '#FF8A5B',
        shield: '#9AA8FF',
      },
      fontFamily: {
        sans: ['Lexend', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        display: ['56px', { lineHeight: '1.05', fontWeight: '800' }],
        h1: ['40px', { lineHeight: '1.1', fontWeight: '800' }],
        h2: ['28px', { lineHeight: '1.2', fontWeight: '700' }],
        question: ['44px', { lineHeight: '1.15', fontWeight: '700' }],
        body: ['20px', { lineHeight: '1.5' }],
        small: ['16px', { lineHeight: '1.5' }],
        caption: ['14px', { lineHeight: '1.4' }],
      },
      borderRadius: { sm: '12px', DEFAULT: '16px', lg: '24px' },
      minHeight: { touch: '56px' },
      minWidth: { touch: '56px' },
      transitionDuration: { fast: '150ms', DEFAULT: '280ms', slow: '700ms' },
    },
  },
};
