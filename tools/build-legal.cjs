// One layout for separate product statements, and one footer policy template.
// Run: node tools/build-legal.cjs [--check]
const fs = require('node:fs');
const path = require('node:path');
const { footer, page } = require('./legal-template.cjs');
const root = path.join(__dirname, '..');
const check = process.argv.includes('--check');
function save(file, text) {
  const target = path.join(root, file);
  if (fs.existsSync(target) && fs.readFileSync(target, 'utf8') === text) return;
  if (check) throw Error(`Generated legal content is out of date: ${file}`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
}
for (const data of require('./legal-content.cjs')) save(data.path, page(data));
for (const [file, product] of [['index.html','studio'],['calendar/index.html','calendar'],['calendar/meet/index.html','calendar']]) {
  let text = fs.readFileSync(path.join(root, file), 'utf8');
  const markup = footer(product);
  const marker = /<!-- shared-legal-footer:start -->[\s\S]*?<!-- shared-legal-footer:end -->/;
  if (marker.test(text)) text = text.replace(marker, markup);
  else if (file === 'index.html') text = text.replace(/<div class="copy"[^>]*>[\s\S]*?<\/nav>/, markup);
  else if (file === 'calendar/index.html') text = text.replace(/<div class="footer-base">[\s\S]*?<\/div>/, markup);
  else text = text.replace('</body>', `<footer>${markup}</footer></body>`);
  if (file === 'calendar/index.html') text = text.replace('<a href="/legal/">Privacy &amp; legal</a>', '<a href="/legal/">Studio policies</a>').replace('<a href="/#contact">Contact us</a>', '<a href="/calendar/legal/#support">Calendar support</a>');
  save(file, text);
}
