'use strict';

// Live demo launcher. Ours, written after the run; not part of any stage.
// It starts the band's stage-4 service unchanged (src/main.js, copied from stage-4/), loads the
// sample data through the service's own POST /_test/reset, and loads it again whenever the sample
// restaurants are missing — after a restart, or after a visitor reset the service.

const { spawn } = require('node:child_process');
const path = require('node:path');
const { demoFixture, RESTAURANTS } = require('./fixture');

const PORT = process.env.PORT || '8080';
const BASE = `http://127.0.0.1:${PORT}`;
const CHECK_EVERY_MS = 60000;

const service = spawn(process.execPath, [path.join(__dirname, '..', 'src', 'main.js')], { stdio: 'inherit' });
service.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => service.kill(signal));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function seeded() {
  const response = await fetch(`${BASE}/restaurants`);
  if (!response.ok) return false;
  const { restaurants = [] } = await response.json();
  const present = new Set(restaurants.map((r) => `${r.id}\u0000${r.name}`));
  return restaurants.length === RESTAURANTS.length && RESTAURANTS.every((r) => present.has(`${r.id}\u0000${r.name}`));
}

async function seed() {
  const response = await fetch(`${BASE}/_test/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(demoFixture()),
  });
  if (response.status !== 204) throw new Error(`reset answered ${response.status}: ${await response.text()}`);
  console.log(`demo: sample data loaded ${new Date().toISOString()}`);
}

async function main() {
  for (;;) {
    try {
      if (!(await seeded())) await seed();
    } catch (error) {
      console.log(`demo: ${error.message}`);
      await sleep(1000);
      continue;
    }
    await sleep(CHECK_EVERY_MS);
  }
}

main();
