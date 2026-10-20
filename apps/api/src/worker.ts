import { setTimeout } from 'node:timers/promises';
import { readConfig } from './config.js';
import { workerClient } from './supabase.js';
import { createAI } from './ai.js';
import { processNextJob } from './jobs.js';
const config = readConfig();
if (!config.supabaseUrl || !config.secretKey || !config.openaiKey || !config.model) {
  console.error('Worker setup required: set SUPABASE_URL, SUPABASE_SECRET_KEY, OPENAI_API_KEY, and OPENAI_MODEL in apps/api/.env. See README.md.');
  process.exitCode = 1;
} else {
  const db = workerClient(config); const ai = createAI(config);
  let running = true;
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { running = false; });
  console.info('Wardrobe worker polling persistent ai_tag_jobs. Press Ctrl+C to stop.');
  while (running) {
    try { if (!await processNextJob(db, ai)) await setTimeout(2000); }
    catch { console.error('Worker could not reach the job database. Check the migration and credentials. Retrying in 5 seconds.'); await setTimeout(5000); }
  }
}
