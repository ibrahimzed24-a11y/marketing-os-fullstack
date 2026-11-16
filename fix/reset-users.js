require('dotenv').config();
const path = require('path');
const db = require('../server/db');
const { hashPassword } = require('../server/auth');
const { v4: uuidv4 } = require('uuid');

(async () => {
  console.log('🔄 [fix/reset-users] Resetting user accounts and re-linking project memberships...');
  try {
    db.pragma('foreign_keys = OFF');

    const defaultUsers = [
      { name: 'Super Admin', email: 'admin@marketingos.local', pass: 'Admin123!', role: 'super_admin', dept: 'Leadership' },
      { name: 'Sara Manager', email: 'manager@marketingos.local', pass: 'Manager123!', role: 'manager', dept: 'Growth' },
      { name: 'Omar Member', email: 'member@marketingos.local', pass: 'Member123!', role: 'member', dept: 'Content' },
      { name: 'Nile Client', email: 'client@marketingos.local', pass: 'Client123!', role: 'client', dept: 'Client' },
    ];

    // Find existing projects before deleting users
    const firstProject = db.prepare('SELECT id FROM projects ORDER BY created_at ASC LIMIT 1').get();

    // Remove old users & old memberships
    db.prepare('DELETE FROM project_members').run();
    db.prepare('DELETE FROM users').run();

    const createdUsers = {};
    for (const u of defaultUsers) {
      const id = uuidv4();
      const hash = await hashPassword(u.pass);
      db.prepare('INSERT INTO users (id, name, email, password_hash, role, department, status) VALUES (?,?,?,?,?,?,?)')
        .run(id, u.name, u.email.toLowerCase(), hash, u.role, u.dept, 'active');
      createdUsers[u.email] = { id, role: u.role, name: u.name, pass: u.pass };
      console.log(`  ✅ User seeded: ${u.email} [${u.role}] (Password: ${u.pass})`);
    }

    // Update project owner & re-attach users to first project if exists
    if (firstProject) {
      const adminId = createdUsers['admin@marketingos.local'].id;
      db.prepare('UPDATE projects SET owner_id=? WHERE id=?').run(adminId, firstProject.id);

      for (const [email, u] of Object.entries(createdUsers)) {
        const roleInProj = u.role === 'super_admin' ? 'owner' : u.role;
        db.prepare('INSERT OR REPLACE INTO project_members (id, project_id, user_id, role_in_project) VALUES (?,?,?,?)')
          .run(uuidv4(), firstProject.id, u.id, roleInProj);
      }

      // Update tasks assignee and creator
      const memberId = createdUsers['member@marketingos.local'].id;
      db.prepare('UPDATE tasks SET assignee_id=?, created_by=? WHERE project_id=?').run(memberId, adminId, firstProject.id);
      console.log(`  🔗 Re-attached all 4 users to project ${firstProject.id}`);
    }

    db.pragma('foreign_keys = ON');

    console.log('\n======================================================');
    console.log('✅ All 4 seed users successfully reset & ready to login:');
    console.log('   1. Super Admin : admin@marketingos.local   / Admin123!');
    console.log('   2. Manager     : manager@marketingos.local / Manager123!');
    console.log('   3. Member      : member@marketingos.local  / Member123!');
    console.log('   4. Client      : client@marketingos.local  / Client123!');
    console.log('======================================================');
  } catch (err) {
    console.error('❌ Error during user reset:', err);
    process.exit(1);
  }
})();
