#!/usr/bin/env node
/**
 * Local development startup script.
 * Boots an embedded PostgreSQL instance (no system install needed),
 * runs Drizzle schema migrations, then starts the app with `tsx server/index.ts`.
 */
import EmbeddedPostgres from 'embedded-postgres';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const PG_PORT = 5433;
const PG_USER = 'empwr';
const PG_PASSWORD = 'empwr_dev';
const PG_DATABASE = 'empwr';
const PG_DATA_DIR = path.join(ROOT, 'data', 'pgdata');

const DATABASE_URL = `postgresql://${PG_USER}:${PG_PASSWORD}@localhost:${PG_PORT}/${PG_DATABASE}`;

async function main() {
  fs.mkdirSync(PG_DATA_DIR, { recursive: true });

  console.log('[dev-start] Starting embedded PostgreSQL...');
  const pg = new EmbeddedPostgres({
    databaseDir: PG_DATA_DIR,
    user: PG_USER,
    password: PG_PASSWORD,
    port: PG_PORT,
    persistent: true,
  });

  const alreadyInitialized = fs.existsSync(path.join(PG_DATA_DIR, 'PG_VERSION'));
  if (!alreadyInitialized) {
    await pg.initialise();
  }

  // Remove stale postmaster.pid if postgres isn't actually running
  const pidFile = path.join(PG_DATA_DIR, 'postmaster.pid');
  if (fs.existsSync(pidFile)) {
    const pid = parseInt(fs.readFileSync(pidFile, 'utf8').split('\n')[0]);
    try {
      process.kill(pid, 0); // Check if process exists
      console.log(`[dev-start] PostgreSQL already running (PID ${pid}), reusing.`);
    } catch {
      console.log('[dev-start] Removing stale postmaster.pid...');
      fs.rmSync(pidFile);
    }
  }

  await pg.start();
  console.log(`[dev-start] PostgreSQL running on port ${PG_PORT}`);

  // Create the app database if it doesn't exist yet
  try {
    const client = pg.getPgClient();
    await client.connect();
    const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = '${PG_DATABASE}'`);
    if (res.rowCount === 0) {
      await client.query(`CREATE DATABASE ${PG_DATABASE}`);
      console.log(`[dev-start] Created database "${PG_DATABASE}"`);
    } else {
      console.log(`[dev-start] Database "${PG_DATABASE}" already exists`);
    }
    await client.end();
  } catch (err) {
    console.error('[dev-start] DB creation error:', err.message);
  }

  // Write a .env.local so the app and drizzle-kit can pick up DATABASE_URL
  const envPath = path.join(ROOT, '.env');
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  if (!envContent.includes('DATABASE_URL=')) {
    fs.appendFileSync(envPath, `\nDATABASE_URL=${DATABASE_URL}\n`);
    console.log('[dev-start] Wrote DATABASE_URL to .env');
  } else {
    // Update existing DATABASE_URL line
    envContent = envContent.replace(/DATABASE_URL=.*/g, `DATABASE_URL=${DATABASE_URL}`);
    fs.writeFileSync(envPath, envContent);
    console.log('[dev-start] Updated DATABASE_URL in .env');
  }

  // Run drizzle-kit push to apply schema
  console.log('[dev-start] Running schema migrations (drizzle-kit push)...');
  await runCommand('npx', ['drizzle-kit', 'push', '--force'], {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL },
  });

  // Free port 5000 if something is already using it
  try {
    const { execSync } = await import('child_process');
    execSync('fuser -k 5000/tcp 2>/dev/null || true', { stdio: 'ignore' });
    await new Promise(r => setTimeout(r, 500));
  } catch { /* ignore */ }

  // Start the app
  console.log('[dev-start] Starting app server...');
  const appProcess = spawn(
    'npx',
    ['tsx', 'server/index.ts'],
    {
      cwd: ROOT,
      env: { ...process.env, DATABASE_URL },
      stdio: 'inherit',
    }
  );

  const shutdown = async () => {
    console.log('\n[dev-start] Shutting down...');
    appProcess.kill();
    await pg.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  appProcess.on('exit', async (code) => {
    console.log(`[dev-start] App exited with code ${code}`);
    await pg.stop();
    process.exit(code ?? 0);
  });
}

function runCommand(cmd, args, options) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { ...options, stdio: 'inherit' });
    proc.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
  });
}

main().catch((err) => {
  console.error('[dev-start] Fatal error:', err);
  process.exit(1);
});
