import Database from 'better-sqlite3';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const dbPath = join(process.cwd(), 'data', 'cinema.db');
const schemaPath = join(process.cwd(), 'data', 'schema.sql');

if (!existsSync(join(process.cwd(), 'data'))) {
    mkdirSync(join(process.cwd(), 'data'));
}

const db = new Database(dbPath);

const schema = readFileSync(schemaPath, 'utf-8');

try {
    db.exec(schema);
    console.log('Database initialized successfully with schema at', dbPath);
} catch (err) {
    console.error('Error initializing database:', err);
    process.exit(1);
} finally {
    db.close();
}
