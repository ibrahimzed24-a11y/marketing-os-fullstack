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
      ['Nile Client', 'client@marketingos.local', hash('Client123!'), 'client', 'Client']
    ];

    const userIds = {};
    const insertUser = db.prepare('INSERT INTO users (id, name, email, password_hash, role, department) VALUES (?, ?, ?, ?, ?, ?)');
    for (const [name, email, passHash, role, dept] of users) {
      const id = uuidv4();
      userIds[email] = id;
      insertUser.run(id, name, email, passHash, role, dept);
    }

    // Seed default Project
    const p1 = uuidv4();
    db.prepare(`
      INSERT INTO projects (id, name, client_name, goal, type, owner_id, status, progress, guidelines, custom_rules)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      p1,
      'Nile Supplies - Lead Gen',
      'Nile Supplies',
      'Generate 50 qualified B2B leads / week',
      'lead-research',
      userIds['admin@marketingos.local'],
      'in_progress',
      68,
      'Brand Spec Brief: Nile Enterprise Supplies verified grounded assets. Target B2B procurement managers.',
      'Always include lead score and verified email.'
    );

    // Attach Project Members
    const insertMember = db.prepare('INSERT INTO project_members (id, project_id, user_id, role_in_project) VALUES (?, ?, ?, ?)');
    insertMember.run(uuidv4(), p1, userIds['manager@marketingos.local'], 'manager');
    insertMember.run(uuidv4(), p1, userIds['member@marketingos.local'], 'member');
    insertMember.run(uuidv4(), p1, userIds['client@marketingos.local'], 'client');

    // Seed Initial Task
    const t1 = uuidv4();
    db.prepare(`
      INSERT INTO tasks (id, project_id, title, pipeline, description, status, assignee_id, created_by, priority, report_md)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      t1,
      p1,
      'Landing Page for Nile Supplies',
      'landing-page',
      'Build landing page from catalog + leads with lead capture form.',
      'in_review',
      userIds['member@marketingos.local'],
      userIds['admin@marketingos.local'],
      'high',
      '# Admin Report\n\n**Verdict:** Ready to Deliver\n- Grounded in harness: Yes\n- Usable: Yes\n- Sellable: Yes\n\n**What shipped:** Hero, catalog section, lead form.\n**Next:** Approve to deliver to client.'
    );

    // Seed 43-tool saved logins vault
    seedLogins();

    console.log('[autoSeed] Database successfully bootstrapped with default accounts and workspace.');
  } catch (err) {
    console.warn('[autoSeed] Auto-seeding notice:', err.message);
  }
}

module.exports = { autoSeedIfEmpty };
