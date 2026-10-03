import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

export function readServiceEnvironment(app, pid, parse, procRoot = '/proc') {
  const file = path.join(app, '.env');
  const values = fs.existsSync(file) ? parse(fs.readFileSync(file)) : {};
  // systemd's environment overrides dotenv. Read it without printing secrets.
  for (const entry of fs.readFileSync(path.join(procRoot, String(pid), 'environ'), 'utf8').split('\0')) {
    const equals = entry.indexOf('=');
    if (equals > 0) values[entry.slice(0, equals)] = entry.slice(equals + 1);
  }
  return values;
}

export function deploymentState(app, env) {
  const secret = env.JWT_SECRET;
  if (!secret || secret.length < 32 || ['dev-secret-change-me', 'replace-with-a-long-random-string'].includes(secret)) {
    throw new Error('Configure um JWT_SECRET próprio de pelo menos 32 caracteres na instalação antes do deploy.');
  }
  const port = Number(env.PORT || 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT inválida na instalação.');
  const database = path.resolve(app, env.SQLITE_PATH || 'server/data.sqlite');
  if (!fs.existsSync(database)) throw new Error('Banco existente não encontrado; o deploy não criará um banco vazio.');
  return { database, port };
}

export function snapshot(database, destination) {
  const db = new DatabaseSync(database, { readOnly: true });
  try {
    const integrity = db.prepare('PRAGMA integrity_check').all();
    if (integrity.length !== 1 || Object.values(integrity[0])[0] !== 'ok') throw new Error('Banco existente falhou na verificação de integridade.');
    db.exec(`VACUUM INTO '${destination.replace(/'/g, "''")}'`);
  } finally { db.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [mode, app, release, argument] = process.argv.slice(2);
  if (mode === 'prepare') {
    const require = createRequire(path.join(release, 'package.json'));
    const env = readServiceEnvironment(app, argument, require('dotenv').parse, process.env.ROTA_PROC_ROOT || '/proc');
    const state = deploymentState(app, env);
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', "await import('./server/auth.js')"], {
      cwd: release, env: { ...env, NODE_ENV: 'production' }, encoding: 'utf8',
    });
    if (result.status !== 0) throw new Error('A nova API não passou na validação da configuração de autenticação.');
    fs.writeFileSync(path.join(release, 'deploy-state.json'), JSON.stringify(state), { mode: 0o600 });
  } else if (mode === 'snapshot') {
    const state = JSON.parse(fs.readFileSync(path.join(release, 'deploy-state.json')));
    snapshot(state.database, argument);
  } else { throw new Error('Modo de deploy desconhecido.'); }
}
