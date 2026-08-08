import { createApp } from './app.js';
import { env } from './config/env.js';
import { getDatabase } from './database/client.js';
import { runMigrations } from './database/migrate.js';

const db = await getDatabase();

// Embedded PostgreSQL: migrations are applied on boot so `npm run dev` is the
// only command needed to get a working API.
const report = await runMigrations(db);
if (report.applied.length > 0) {
  console.log(`Applied ${report.applied.length} migration(s): ${report.applied.join(', ')}`);
}

const app = createApp(db);

app.listen(env.port, () => {
  console.log(`RideSync API listening on http://localhost:${env.port}`);
  console.log(`  health   http://localhost:${env.port}/api/health`);
  console.log(`  database ${env.databaseDir}`);
});
