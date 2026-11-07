// Scaffold a new audit: npm run new -- <slug>
const fs = require('fs');
const path = require('path');
const { AUDITS, SAFE } = require('./audits');

const slug = process.argv[2];
if (!slug || !SAFE.test(slug)) { console.error('Usage: npm run new -- <slug>   (letters, numbers, dots, dashes)'); process.exit(1); }
const dir = path.join(AUDITS, slug);
if (fs.existsSync(dir)) { console.error(`audits/${slug} already exists.`); process.exit(1); }

fs.mkdirSync(path.join(dir, 'shots'), { recursive: true });
const template = fs.readFileSync(path.join(__dirname, 'template-audit.json'), 'utf8').replace(/__SLUG__/g, slug);
fs.writeFileSync(path.join(dir, 'audit.json'), template);
console.log(`Created audits/${slug}/audit.json and audits/${slug}/shots/.\nPreview it with: npm run dev`);
