import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const { Client } = pg;

const query = process.argv[2];

if (!query) {
  console.error('Usage: node scripts/db-query.js "SELECT * FROM table LIMIT 5"');
  process.exit(1);
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

try {
  await client.connect();
  const result = await client.query(query);

  if (result.rows.length === 0) {
    console.log('No rows returned');
  } else {
    console.table(result.rows);
  }
} catch (error) {
  console.error('Error:', error.message);
} finally {
  await client.end();
}
