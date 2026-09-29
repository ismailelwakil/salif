/* Build backend/.env from the local credentials file. Does not print secrets. */
const fs = require('fs');
const src = fs.readFileSync('/home/user/uploads/Salif.txt', 'utf8');
const want = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SENTRY_DSN'];
const out = [];
for (const key of want) {
  const m = src.match(new RegExp('^' + key + '=(.+)$', 'm'));
  if (!m) throw new Error('missing ' + key);
  let value = m[1].trim().replace(/^"|"$/g, '');
  out.push(key + '=' + value);
}
out.push('ALLOW_DEMO=true');
out.push('PORT=3000');
const dest = '/home/user/salif/backend/.env';
fs.writeFileSync(dest, out.join('\n') + '\n', { mode: 0o600 });
console.log('wrote', dest, 'keys', out.length);
