import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import console from 'node:console';

const defaultBackend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const stamp = (ms) => new Date(ms).toISOString().replace(/[-:T]/g, '').slice(0, 14);

// File-only handoff. This utility NEVER connects to or migrates a database.
export function stageMigrations(backendDir = defaultBackend) {
  const sourceDir = path.join(backendDir, 'drizzle');
  const targetDir = path.resolve(backendDir, '../supabase/migrations');
  const mapPath = path.join(backendDir, 'migration-map.json');
  const lockPath = path.join(backendDir, '.stage.lock');
  const lock = fs.openSync(lockPath, 'wx');
  try {
    const journal = JSON.parse(fs.readFileSync(path.join(sourceDir, 'meta/_journal.json'), 'utf8'));
    const map = fs.existsSync(mapPath) ? JSON.parse(fs.readFileSync(mapPath, 'utf8')) : { version: 1, entries: [] };
    if (map.version !== 1 || !Array.isArray(map.entries)) throw new Error('Invalid migration handoff map');
    if (map.entries.length > journal.entries.length) throw new Error('Previously staged journal entries were removed');
    let previousMs = 0;
    const planned = [];
    const targets = new Set();
    for (const [position, entry] of journal.entries.entries()) {
      if (entry.idx !== position || !/^[0-9]+_[A-Za-z0-9_]+$/.test(entry.tag) || !Number.isSafeInteger(entry.when)) {
        throw new Error('Unsupported Drizzle journal entry');
      }
      const source = `${entry.tag}.sql`;
      const raw = fs.readFileSync(path.join(sourceDir, source), 'utf8');
      const hash = sha256(raw);
      const ms = Math.max(entry.when, previousMs + 1000);
      previousMs = ms;
      const suffix = entry.tag.replace(/^[0-9]+_/, '');
      const target = `${stamp(ms)}_${suffix}.sql`;
      const expected = { source, target, sha256: hash };
      if (targets.has(target)) throw new Error('Duplicate migration timestamp/name');
      targets.add(target);
      const existing = map.entries[position];
      if (existing && (existing.source !== source || existing.target !== target || existing.sha256 !== hash)) {
        throw new Error(`Previously staged migration changed: ${source}. Add a new migration instead.`);
      }
      // Explicit transactions keep multi-statement custom security changes atomic.
      // drizzle-kit statement boundaries are comments to PostgreSQL/Supabase CLI.
      const content = `-- Source: backend/drizzle/${source}\n-- Source SHA256: ${hash}\nBEGIN;\nSET LOCAL search_path = public, pg_catalog;\n${raw.trim()}\nCOMMIT;\n`;
      const targetPath = path.join(targetDir, target);
      if (fs.existsSync(targetPath) && fs.readFileSync(targetPath, 'utf8') !== content) {
        throw new Error(`Refusing to overwrite changed Supabase migration: ${target}`);
      }
      planned.push({ expected, targetPath, content });
    }
    const sourceSql = fs.readdirSync(sourceDir).filter((name) => name.endsWith('.sql')).sort();
    if (sourceSql.length !== planned.length || sourceSql.some((name) => !planned.some((p) => p.expected.source === name))) {
      throw new Error('Untracked SQL file in Drizzle output; use the Drizzle custom migration command');
    }
    if (fs.existsSync(targetDir)) {
      const unknown = fs.readdirSync(targetDir).filter((name) => name.endsWith('.sql') && !targets.has(name));
      if (unknown.length) throw new Error('Untracked Supabase migrations found; reconcile the single handoff history first');
    }
    // All checks above are read-only. Existing migration files are never rewritten.
    fs.mkdirSync(targetDir, { recursive: true });
    for (const item of planned) {
      if (!fs.existsSync(item.targetPath)) fs.writeFileSync(item.targetPath, item.content, { flag: 'wx' });
    }
    fs.writeFileSync(`${mapPath}.tmp`, JSON.stringify({ version: 1, entries: planned.map((p) => p.expected) }, null, 2) + '\n');
    fs.renameSync(`${mapPath}.tmp`, mapPath);
    return planned.map((p) => p.expected.target);
  } finally {
    fs.closeSync(lock);
    fs.unlinkSync(lockPath);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const names = stageMigrations();
  console.log(`Validated ${names.length} migration handoffs. No database connection was used.`);
  for (const name of names) console.log(name);
}
