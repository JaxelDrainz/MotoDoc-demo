// The formatting locale follows the language switch: Finnish formats (1 234,50 €, 16.11.2026)
// in Finnish, and English with Finnish conventions (€1,234.50, 16 Nov 2026) in English.
export const loc = () => (document.documentElement.lang === 'fi' ? 'fi-FI' : 'en-FI');
