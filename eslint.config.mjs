// Code checks (audit C4): warnings only for now; CI prints them without blocking.
// Run: npm install --no-save eslint@9 globals@15 && npx eslint js sw.js
import globals from 'globals';
export default [
  {
    files: ['js/**/*.js', 'sw.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.browser, ...globals.serviceworker,
        // libraries loaded on demand, and the app's own globals shared between files
        XLSX: 'readonly', ExcelJS: 'readonly', Tesseract: 'readonly', PptxGenJS: 'readonly', FR_MAP: 'writable', FR_MAP_HD: 'writable' }
    },
    rules: {
      'no-undef': 'warn',
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
      'no-dupe-keys': 'warn',
      'no-unreachable': 'warn',
      'no-self-assign': 'warn',
      eqeqeq: ['warn', 'smart'],
      complexity: ['warn', 15],
      'max-depth': ['warn', 4]
    }
  }
];
