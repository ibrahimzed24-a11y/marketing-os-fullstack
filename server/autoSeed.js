const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

function autoSeedIfEmpty(db) {
  try {
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get()?.count || 0;
    if (userCount > 0) return;

    const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
    const hash = (p) => bcrypt.hashSync(p, 10);
    const insertUser = db.prepare(
      'INSERT INTO users (id, name, email, password_hash, role, department) VALUES (?, ?, ?, ?, ?, ?)'
    );

    if (isProd) {
      const initEmail = (process.env.INITIAL_ADMIN_EMAIL || '').trim().toLowerCase();
      const initPass = (process.env.INITIAL_ADMIN_PASSWORD || '').trim();
      if (initEmail && initPass.length >= 12) {
        insertUser.run(uuidv4(), 'Workspace Owner', initEmail, hash(initPass), 'super_admin', 'Leadership');
        console.log(`[autoSeed] Production bootstrap: created initial super_admin (${initEmail}).`);
      } else {
        console.warn(
          '[autoSeed] Production mode: default weak credentials disabled. Set INITIAL_ADMIN_EMAIL & INITIAL_ADMIN_PASSWORD (>=12 chars) or hydrate from Turso.'
        );
      }
      return;
    }

    console.log('[autoSeed] Development/test mode: seeding local test accounts...');

    const users = [
      ['Super Admin', 'admin@marketingos.local', hash('Admin123!'), 'super_admin', 'Leadership'],
      ['Sara Manager', 'manager@marketingos.local', hash('Manager123!'), 'manager', 'Growth'],
      ['Omar Member', 'member@marketingos.local', hash('Member123!'), 'member', 'Content'],
      ['Test Client (RBAC Gate)', 'client@marketingos.local', hash('Client123!'), 'client', 'Client'],
      ['Sales Lead', 'sales@marketingos.local', hash('Admin123!'), 'manager', 'Sales'],
      ['Creative Specialist', 'creative@marketingos.local', hash('Admin123!'), 'member', 'Creative'],
      ['Clinic Client', 'client@clinic.local', hash('Client123!'), 'client', 'Client']
    ];

    for (const [name, email, passHash, role, dept] of users) {
      insertUser.run(uuidv4(), name, email, passHash, role, dept);
    }

    console.log('[autoSeed] Local development/test accounts initialized (zero fake tool logins seeded).');
  } catch (err) {
    console.error('[autoSeed] Auto-seeding error:', err.message);
  }
}

module.exports = { autoSeedIfEmpty };
