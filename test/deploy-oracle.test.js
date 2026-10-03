import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { deploymentState, snapshot } from '../scripts/oracle-state.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rota-deploy-validation-'));
test('deployment preflight rejects weak secrets and a missing database', () => {
  try {
    assert.throws(() => deploymentState(root, { JWT_SECRET: 'short' }), /JWT_SECRET/);
    assert.throws(() => deploymentState(root, { JWT_SECRET: 'a'.repeat(48) }), /Banco existente/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('read-only deployment snapshot retains existing account data', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'rota-deploy-snapshot-'));
  try {
    const database = path.join(folder, 'live.sqlite');
    const live = new DatabaseSync(database);
    live.exec("CREATE TABLE users (email TEXT); INSERT INTO users VALUES ('demo@example.com')");
    live.close();
    snapshot(database, path.join(folder, 'snapshot.sqlite'));
    const backup = new DatabaseSync(path.join(folder, 'snapshot.sqlite'), { readOnly: true });
    assert.equal(backup.prepare('SELECT email FROM users').get().email, 'demo@example.com');
    backup.close();
  } finally { fs.rmSync(folder, { recursive: true, force: true }); }
});

for (const fail of [false, true]) {
  test(`Oracle deploy ${fail ? 'returns to previous code on unhealthy release' : 'publishes a healthy release'} and preserves data/config`, async () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'rota-deploy-flow-'));
    const app = path.join(folder, 'app'), release = path.join(folder, 'release'), bin = path.join(folder, 'bin');
    for (const base of [app, release]) {
      for (const dir of ['dist', 'src', 'server', 'node_modules/dotenv', 'scripts']) fs.mkdirSync(path.join(base, dir), { recursive: true });
      fs.writeFileSync(path.join(base, 'package.json'), '{"type":"module"}');
      fs.writeFileSync(path.join(base, 'package-lock.json'), '{}');
      fs.writeFileSync(path.join(base, 'dist/index.html'), base === app ? 'OLD' : 'NEW');
      fs.writeFileSync(path.join(base, 'dist/deploy-version.json'), JSON.stringify({ commit: base === app ? 'old' : 'new' }));
      fs.writeFileSync(path.join(base, 'src/marker'), base === app ? 'OLD' : 'NEW');
      fs.writeFileSync(path.join(base, 'server/auth.js'), 'export default {};');
      fs.writeFileSync(path.join(base, 'node_modules/dotenv/index.js'), "exports.parse = b => Object.fromEntries(b.toString().trim().split('\\n').map(x => [x.slice(0,x.indexOf('=')),x.slice(x.indexOf('=')+1)]));");
    }
    fs.copyFileSync('scripts/deploy-oracle.sh', path.join(release, 'scripts/deploy-oracle.sh'));
    fs.copyFileSync('scripts/oracle-state.mjs', path.join(release, 'scripts/oracle-state.mjs'));
    const database = new DatabaseSync(path.join(app, 'server/data.sqlite'));
    database.exec("CREATE TABLE users (email TEXT); INSERT INTO users VALUES ('demo@example.com')"); database.close();
    fs.mkdirSync(path.join(app, 'server/backups'));
    fs.writeFileSync(path.join(app, 'server/backups/existing.sqlite'), 'KEEP');
    const proc = path.join(folder, 'proc'); fs.mkdirSync(path.join(proc, String(process.pid)), { recursive: true });
    fs.writeFileSync(path.join(proc, String(process.pid), 'environ'), 'NODE_ENV=production\0');
    const active = path.join(folder, 'active'); fs.writeFileSync(active, 'yes');
    const server = http.createServer((req, res) => {
      const version = fs.readFileSync(path.join(app, 'dist/deploy-version.json'));
      if (fs.readFileSync(active, 'utf8').trim() !== 'yes' || (fail && JSON.parse(version).commit === 'new')) { res.writeHead(503); res.end(); return; }
      if (req.url === '/api/me') { res.writeHead(401); res.end('{}'); } else { res.end(version); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const config = `JWT_SECRET=${'a'.repeat(48)}\nPORT=${server.address().port}\n`;
    fs.writeFileSync(path.join(app, '.env'), config);
    fs.mkdirSync(bin);
    const executable = (name, contents) => fs.writeFileSync(path.join(bin, name), '#!/bin/bash\n'+contents, { mode: 0o755 });
    executable('npm', 'exit 0\n'); executable('sleep', 'exit 0\n');
    executable('sudo', '[[ "$1" = -n ]] && shift\nexec "$@"\n');
    executable('systemctl', `case "$1" in
show) case "$4" in WorkingDirectory) echo "$ROTA_APP_DIR";; MainPID) echo ${process.pid};; esac;;
is-active) [[ $(cat "$FAKE_ACTIVE") = yes ]];;
stop) echo no > "$FAKE_ACTIVE";;
start) echo yes > "$FAKE_ACTIVE";;
*) exit 1;; esac\n`);
    try {
      const child = spawn('bash', [path.join(release, 'scripts/deploy-oracle.sh')], {
        env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, ROTA_APP_DIR: app, ROTA_NODE: process.execPath, ROTA_BACKUP_DIR: path.join(folder, 'backups'), FAKE_ACTIVE: active, ROTA_PROC_ROOT: proc },
      });
      let output = ''; child.stdout.on('data', b => { output += b; }); child.stderr.on('data', b => { output += b; });
      const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
      assert.equal(code, fail ? 1 : 0, output);
      assert.equal(fs.readFileSync(path.join(app, 'src/marker'), 'utf8'), fail ? 'OLD' : 'NEW');
      assert.equal(fs.readFileSync(path.join(app, '.env'), 'utf8'), config);
      assert.equal(fs.readFileSync(path.join(app, 'server/backups/existing.sqlite'), 'utf8'), 'KEEP');
      assert.equal(fs.readFileSync(active, 'utf8').trim(), 'yes');
      const db = new DatabaseSync(path.join(app, 'server/data.sqlite'), { readOnly: true });
      assert.equal(db.prepare('SELECT email FROM users').get().email, 'demo@example.com'); db.close();
      const snapshotFolder = fs.readdirSync(path.join(folder, 'backups')).find(x => x.startsWith('release-'));
      assert.ok(fs.existsSync(path.join(folder, 'backups', snapshotFolder, 'data.sqlite')));
    } finally { await new Promise(resolve => server.close(resolve)); fs.rmSync(folder, { recursive: true, force: true }); }
  });
}
