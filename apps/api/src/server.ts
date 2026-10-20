import { createApp } from './app.js';
import { readConfig, missingSetup } from './config.js';
const config = readConfig();
const server = createApp({ config }).listen(config.port, '127.0.0.1', () => {
  console.info(`Wardrobe API: http://127.0.0.1:${config.port}`);
  const missing = missingSetup(config);
  if (missing.length) console.info(`Setup required in apps/api/.env: ${missing.join(', ')}. See README.md.`);
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => server.close(() => process.exit(0)));
