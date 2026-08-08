import fs from 'node:fs';
import { env } from '../config/env.js';

/** Deletes the embedded database directory so the next migrate starts clean. */
if (fs.existsSync(env.databaseDir)) {
  fs.rmSync(env.databaseDir, { recursive: true, force: true });
  console.log(`Removed ${env.databaseDir}`);
} else {
  console.log('Nothing to remove — database directory does not exist.');
}
process.exit(0);
