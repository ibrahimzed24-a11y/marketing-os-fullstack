require('dotenv').config();
const db = require('./db');
const {hashPassword} = require('./auth');
const {v4: uuidv4} = require('uuid');
const { seedLogins } = require('./seedLogins');
(async()=>{
  db.prepare('DELETE FROM tasks').run();
  db.prepare('DELETE FROM harness_files').run();
  db.prepare('DELETE FROM reports').run();
  db.prepare('DELETE FROM rag_chunks').run();
  db.prepare('DELETE FROM project_members').run();
  db.prepare('DELETE FROM projects').run();
  db.prepare('DELETE FROM users').run();
  const users = [
    ['Super Admin','admin@marketingos.local','Admin123!','super_admin','Leadership'],
    ['Sara Manager','manager@marketingos.local','Manager123!','manager','Growth'],
    ['Omar Member','member@marketingos.local','Member123!','member','Content'],
    ['Test Client (RBAC Gate)','client@marketingos.local','Client123!','client','Client'],
    ['Sales Lead','sales@marketingos.local','Admin123!','manager','Sales'],
    ['Creative Specialist','creative@marketingos.local','Admin123!','member','Creative'],
    ['Clinic Client','client@clinic.local','Client123!','client','Client']
  ];
  const ids={};
  for(const [name,email,pass,role,dept] of users){
    const id=uuidv4(); ids[email]=id;
    db.prepare('INSERT INTO users (id,name,email,password_hash,role,department) VALUES (?,?,?,?,?,?)').run(id,name,email,await hashPassword(pass),role,dept);
  }
  // Seed 43-tool saved logins vault
  seedLogins(db);

  console.log('✅ Clean accounts seeded successfully.');

  // --- rebuild the Helm knowledge base so a full seed leaves KB content intact ---
  // NOTE: the seed wipes projects, so ensure the helm system project row exists first
  // (autoSeedProjectHarness scopes KB docs to proj.id === 'helm' and FKs to projects(id)).
  try {
    const projRow = db.prepare("SELECT id FROM projects WHERE id = ?").get('helm');
    if (!projRow) {
      db.prepare(
        `INSERT INTO projects (id, name, client_name, goal, type, status, department, knowledge_notes, pipelines, deliverables)
         VALUES (?, ?, ?, ?, 'helm_system', 'delivered', 'coordination', '', '[]', '[]')
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, status=excluded.status`
      ).run('helm', 'Helm System Knowledge Base', 'Helm Operations', 'Platform-grade marketing operations kernel');
    }
    // eslint-disable-next-line import/no-unresolved
    const { autoSeedProjectHarness } = require('./rag');
    autoSeedProjectHarness();
    console.log('✅ Helm knowledge base re-seeded.');
  } catch (seedErr) {
    console.warn(`⚠️  KB re-seed skipped: ${seedErr.message}`);
  }
})();
