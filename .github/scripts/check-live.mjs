import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';

const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const probes = new Set(['index.html', 'offline-list.json', 'sw.js']);

export async function verifyLive(expected, {
  base = 'https://chaeyeon96.github.io/notes-35e3d5aad6/',
  fetchFile = fetch,
  wait = ms => new Promise(resolve => setTimeout(resolve, ms)),
  now = Date.now,
  log = console.log,
  probeTimeout = 120000,
  timeout = 600000,
  previousFiles = null,
} = {}) {
  const query = '?deployment=' + encodeURIComponent(process.env.GITHUB_RUN_ID || 'verification');
  let checked = 0, bytes = 0;
  async function compare(items) {
    const failed = [];
    let next = 0;
    await Promise.all(Array.from({length: 6}, async () => {
      while (next < items.length) {
        const item = items[next++];
        try {
          const response = await fetchFile(base + item.rel + query, {cache: 'no-store', signal: AbortSignal.timeout(12000)});
          if (!response.ok) throw Error('HTTP ' + response.status);
          const data = Buffer.from(await response.arrayBuffer());
          if (hash(data) !== item.sha) throw Error('SHA256 mismatch');
          checked++;
          bytes += data.length;
        } catch (error) {
          failed.push({...item, reason: error.message});
        }
      }
    }));
    return failed;
  }
  async function retry(items, duration, label) {
    let pending = items;
    const deadline = now() + duration;
    do {
      pending = await compare(pending);
      if (!pending.length) return;
      log(label + ': ' + pending.length + ' pending; ' + pending.slice(0, 3).map(x => x.rel + ' (' + x.reason + ')').join(', '));
      if (now() >= deadline) break;
      await wait(10000);
    } while (now() < deadline);
    throw Error(label + ' failed: ' + pending.length + ' files do not match this artifact.');
  }
  const first = expected.filter(item => probes.has(item.rel));
  if (first.length !== probes.size) throw Error('Missing deployment probe files');
  // A stale deployment must not cause repeated downloads of every encrypted image.
  await retry(first, probeTimeout, 'New deployment visibility');
  const changed = expected.filter(item => !probes.has(item.rel) && item.sha !== previousFiles?.[item.rel]);
  log('New deployment is visible; checking ' + changed.length + ' changed files.');
  await retry(changed, timeout, 'Live ciphertext verification');
  return {files: checked, bytes, totalFiles: expected.length, reusedFiles: expected.length - checked};
}

async function main() {
  const root = path.resolve('encrypted-site');
  const expected = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile()) {
        const rel = path.relative(root, file).split(path.sep).join('/');
        if (rel !== '.nojekyll') expected.push({rel, sha: hash(fs.readFileSync(file))});
      } else throw Error('Invalid deployed file');
    }
  }
  walk(root);
  let previousFiles = null;
  try {
    const saved = JSON.parse(fs.readFileSync('.verified-live.json', 'utf8'));
    if (saved.v === 1 && saved.files && Object.values(saved.files).every(sha => /^[a-f0-9]{64}$/.test(sha))) previousFiles = saved.files;
  } catch {}
  const result = await verifyLive(expected, {previousFiles});
  fs.writeFileSync('.verified-live.json', JSON.stringify({v:1,files:Object.fromEntries(expected.map(item => [item.rel,item.sha]))}));
  console.log('Live site matches verified artifact: ' + JSON.stringify(result));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    'Live ciphertext/static file SHA256 comparison passed: ' + result.files + ' files. No decryption or password used on the public runner.\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
