import fs from 'node:fs/promises';
import { pool } from '../db.js';
import { ensureBucket } from '../storage.js';

const sql = await fs.readFile(new URL('../../sql/schema.sql', import.meta.url), 'utf8');
await pool.query(sql);
console.log('✔ database schema ready');
await ensureBucket();
console.log('✔ bucket ready');
await pool.end();
