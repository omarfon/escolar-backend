import fs from 'fs';
import path from 'path';

const src = path.join(process.cwd(), 'src');
const modules = [];

function walk(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory() && !f.name.startsWith('.')) walk(p);
    else if (f.name.endsWith('.module.ts')) modules.push(p);
  }
}

walk(src);

const edges = [];
const entityCrossRefs = [];

for (const mp of modules) {
  const t = fs.readFileSync(mp, 'utf8');
  const realMatch = t.match(/export class (\w+Module)/);
  const exported = realMatch ? realMatch[1] : path.basename(mp, '.module.ts');
  const folder = path.relative(src, path.dirname(mp)).replace(/\\/g, '/');

  const importRe = /import\s*\{[^}]*\}\s*from\s*['"](\.\.\/[^'"]+)['"]/g;
  let m;
  const seen = new Set();
  while ((m = importRe.exec(t)) !== null) {
    const imp = m[1];
    if (imp.includes('.entity')) {
      const entity = path.basename(imp, '.entity.ts');
      const owner = imp.split('/')[1] ?? imp;
      entityCrossRefs.push({ module: exported, folder, entity, fromModule: owner });
      continue;
    }
    if (!imp.endsWith('.module')) continue;
    const targetPath = imp.replace('../', '');
    const target = targetPath.replace('.module.ts', '').split('/').pop();
    const key = `${exported}->${target}`;
    if (!seen.has(key)) {
      seen.add(key);
      edges.push({ from: exported, fromFolder: folder, to: target });
    }
  }

  const fwdRe = /forwardRef\(\(\)\s*=>\s*(\w+Module)\)/g;
  while ((m = fwdRe.exec(t)) !== null) {
    const key = `${exported}->${m[1]} (forwardRef)`;
    if (!seen.has(key)) {
      seen.add(key);
      edges.push({ from: exported, fromFolder: folder, to: `${m[1]} (forwardRef)` });
    }
  }
}

const serviceDeps = [];
for (const mp of modules) {
  const folder = path.relative(src, path.dirname(mp)).replace(/\\/g, '/');
  const services = fs
    .readdirSync(path.dirname(mp))
    .filter((f) => f.endsWith('.service.ts') && !f.includes('.spec'));
  for (const sf of services) {
    const st = fs.readFileSync(path.join(path.dirname(mp), sf), 'utf8');
    const injRe = /private readonly (\w+):\s*(\w+)/g;
    let m;
    while ((m = injRe.exec(st)) !== null) {
      if (m[2].endsWith('Service') && !m[2].includes('Repository')) {
        serviceDeps.push({
          file: `${folder}/${sf}`,
          injects: m[2],
          var: m[1],
        });
      }
    }
  }
}

console.log(JSON.stringify({ edges, entityCrossRefs, serviceDeps }, null, 2));
