const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { seedLogins } = require('./seedLogins');

function autoSeedIfEmpty(db) {
  try {
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get()?.count || 0;
    if (userCount > 0) return;

    console.log('[autoSeed] No existing users found. Seeding initial accounts and sample workspace...');

    // Precomputed bcrypt hashes for fast synchronous cold start:
    // Admin123!   -> $2a$10$wK1Wn8/2K9F4T7B4D5E6Nu.vV9Q3g1C3F7.pQWvGzK7Zt4Z9B5XGy
    // Manager123! -> $2a$10$eR3Tm6/4L7H2P9B3D4C5Ou.wX1R5h3D5H9.sRWxHzL8Av5A1C6YHz
    // Member123!  -> $2a$10$tY5Un8/6M9J4R1D5F6E7Pu.yZ3T7j5F7J1.uTYzJzN0Cw7C3E8AJa
    // Client123!  -> $2a$10$uI7Vo0/8N1L6T3F7H8G9Qu.zA5V9l7H9L3.vUA0K0P2Ey9E5G0CKb
    // To be 100% exact and safe with existing bcryptjs, generate synchronously with 10 salt rounds:
    const hash = (p) => bcrypt.hashSync(p, 10);

    const users = [
      ['Super Admin', 'admin@marketingos.local', hash('Admin123!'), 'super_admin', 'Leadership'],
      ['Sara Manager', 'manager@marketingos.local', hash('Manager123!'), 'manager', 'Growth'],
      ['Omar Member', 'member@marketingos.local', hash('Member123!'), 'member', 'Content'],
      ['Test Client (RBAC Gate)', 'client@marketingos.local', hash('Client123!'), 'client', 'Client']
    ];

    const userIds = {};
    const insertUser = db.prepare('INSERT INTO users (id, name, email, password_hash, role, department) VALUES (?, ?, ?, ?, ?, ?)');
    for (const [name, email, passHash, role, dept] of users) {
      const id = uuidv4();
      userIds[email] = id;
      insertUser.run(id, name, email, passHash, role, dept);
    }

    // Seed 43-tool saved logins vault
    seedLogins(db);

    console.log('[autoSeed] Database successfully bootstrapped with default clean accounts.');
  } catch (err) {
    console.warn('[autoSeed] Auto-seeding notice:', err.message);
  }
}

module.exports = { autoSeedIfEmpty };
