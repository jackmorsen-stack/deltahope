import { migrate, createSeedUser, db } from './db.js';

migrate();
createSeedUser();

const users = db.prepare('SELECT id, username, role FROM users').all();
console.log('[seed] Users:', users.map((u) => `${u.username} (${u.role})`).join(', '));
console.log('[seed] Database ready at', db.name);
process.exit(0);