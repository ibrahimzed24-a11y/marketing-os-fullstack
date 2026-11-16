require('dotenv').config();
const db = require('./db');
const {hashPassword} = require('./auth');
const {v4: uuidv4} = require('uuid');
const { seedLogins } = require('./seedLogins');
(async()=>{
  db.prepare('DELETE FROM users').run();
  db.prepare('DELETE FROM projects').run();
  db.prepare('DELETE FROM tasks').run();
  db.prepare('DELETE FROM project_members').run();
  const users = [
    ['Super Admin','admin@marketingos.local','Admin123!','super_admin','Leadership'],
    ['Sara Manager','manager@marketingos.local','Manager123!','manager','Growth'],
    ['Omar Member','member@marketingos.local','Member123!','member','Content']
  ];
  const ids={};
  for(const [name,email,pass,role,dept] of users){
    const id=uuidv4(); ids[email]=id;
    db.prepare('INSERT INTO users (id,name,email,password_hash,role,department) VALUES (?,?,?,?,?,?)').run(id,name,email,await hashPassword(pass),role,dept);
  }
  const p1=uuidv4();
  db.prepare('INSERT INTO projects (id,name,client_name,goal,type,owner_id,status,progress) VALUES (?,?,?,?,?,?,?,?)').run(p1,'Nile Supplies - Lead Gen','Nile Supplies','Generate 50 qualified B2B leads / week','lead-research',ids['admin@marketingos.local'],'in_progress',68);
  db.prepare('INSERT INTO project_members (id,project_id,user_id,role_in_project) VALUES (?,?,?,?)').run(uuidv4(),p1,ids['manager@marketingos.local'],'manager');
  db.prepare('INSERT INTO project_members (id,project_id,user_id,role_in_project) VALUES (?,?,?,?)').run(uuidv4(),p1,ids['member@marketingos.local'],'member');
  const t1=uuidv4();
  db.prepare('INSERT INTO tasks (id,project_id,title,pipeline,description,status,assignee_id,created_by,priority,report_md) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(t1,p1,'Landing Page for Nile Supplies','landing-page','Build landing page from catalog + leads','in_review',ids['member@marketingos.local'],ids['admin@marketingos.local'],'high','# Admin Report\n\n**Verdict:** Ready to Deliver\n- Grounded in harness: Yes\n- Usable: Yes\n- Sellable: Yes\n\n**What shipped:** Hero, catalog section, lead form.\n**Next:** Approve to deliver to client.');

  // Seed 43-tool saved logins vault
  seedLogins();

  console.log('✅ Seeded. Logins in README.md');
})();
