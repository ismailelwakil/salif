/* Dump runtime dictionaries to lib/i18n/{en,ar}.json */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '../frontend/js/i18n.js'), 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(src, sandbox);
const dir = path.join(__dirname, '../frontend/i18n');
fs.mkdirSync(dir, { recursive: true });
for (const lang of ['en', 'ar']) {
  fs.writeFileSync(path.join(dir, lang + '.json'), JSON.stringify(sandbox.window.I18N[lang], null, 2) + '\n');
  console.log(lang, Object.keys(sandbox.window.I18N[lang]).length, 'keys');
}
