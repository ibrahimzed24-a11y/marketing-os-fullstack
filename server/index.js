require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const {v4: uuidv4} = require('uuid');
const db = require('./db');
const {signToken, authMiddleware, requireRole, hashPassword, verifyPassword} = require('./auth');
const {triggerN8n} = require('./n8n');
const {generateLocalDeliverable} = require('./localRunner');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors({origin: process.env.CORS_ORIGIN || true}));
app.use(express.json({limit:'10mb'}));
app.use(express.urlencoded({extended:true}));
const uploadDir = process.env.UPLOAD_DIR || './uploads';
fs.mkdirSync(uploadDir, {recursive:true});
const upload = multer({dest: uploadDir, limits:{fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB||'20')*1024*1024)}});
app.use('/uploads', express.static(path.join(__dirname,'../uploads')));
app.use(express.static(path.join(__dirname,'../public')));

// Health endpoint
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// --- AUTH ---
app.post('/api/auth/register', async (req,res)=>{
  const {name,email,password,role='member'} = req.body;
  if(!name||!email||!password) return res.status(400).json({error:'name, email, password required'});
  const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  let finalRole = 'member';
  if(count===0) finalRole='super_admin';
  else if(['admin','manager','member','client'].includes(role) && req.headers['x-admin-setup']==='allow') finalRole=role;
  const hash = await hashPassword(password.trim());
  try{
    const id = uuidv4();
    db.prepare('INSERT INTO users (id,name,email,password_hash,role) VALUES (?,?,?,?,?)').run(id,name,email.trim().toLowerCase(),hash,finalRole);
    const user = {id, name, email: email.trim().toLowerCase(), role: finalRole};
    res.json({user, token: signToken(user)});
  }catch(e){ res.status(400).json({error:'Email already exists'}); }
});

app.post('/api/auth/login', async (req,res)=>{
  const {email,password} = req.body;
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPass = (password || '').trim();
  const user = db.prepare('SELECT * FROM users WHERE email=?').get(cleanEmail);
  if(!user) return res.status(401).json({error:'Invalid credentials'});
  const ok = await verifyPassword(cleanPass, user.password_hash);
  if(!ok) return res.status(401).json({error:'Invalid credentials'});
  const safe = {id:user.id, name:user.name, email:user.email, role:user.role, department:user.department};
  res.json({user:safe, token: signToken(safe)});
});

// DEV endpoint for emergency password reset
app.post('/api/auth/reset-password-dev', async (req,res)=>{
  const {email, newPassword, devKey} = req.body;
  const expectedKey = process.env.OS_API_KEY || 'local-dev-key-change-me';
  if(devKey !== expectedKey) return res.status(401).json({error:'Unauthorized: Invalid devKey'});
  if(!email || !newPassword) return res.status(400).json({error:'email and newPassword required'});
  const user = db.prepare('SELECT id FROM users WHERE email=?').get(email.trim().toLowerCase());
  if(!user) return res.status(404).json({error:'User not found'});
  const hash = await hashPassword(newPassword.trim());
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash, user.id);
  res.json({ok:true, message:`Password reset successfully for ${email}`});
});

app.get('/api/auth/me', authMiddleware, (req,res)=>{
  const u = db.prepare('SELECT id,name,email,role,department,status,created_at FROM users WHERE id=?').get(req.user.id);
  res.json({user:u});
});

// --- USERS (Admin only) ---
app.get('/api/users', authMiddleware, requireRole('super_admin','admin'), (req,res)=>{
  const users = db.prepare('SELECT id,name,email,role,department,status,created_at FROM users ORDER BY created_at DESC').all();
  res.json({users});
});

app.post('/api/users', authMiddleware, requireRole('super_admin','admin'), async (req,res)=>{
  const {name,email,password,role='member',department=''} = req.body;
  const hash = await hashPassword((password || 'Temp123!').trim());
  const id = uuidv4();
  try{
    db.prepare('INSERT INTO users (id,name,email,password_hash,role,department) VALUES (?,?,?,?,?,?)').run(id,name,email.trim().toLowerCase(),hash,role,department);
    res.json({id, name, email: email.trim().toLowerCase(), role, department});
  }catch(e){ res.status(400).json({error:'Email exists'}); }
});

app.patch('/api/users/:id', authMiddleware, requireRole('super_admin','admin'), (req,res)=>{
  const {role, status, department} = req.body;
  db.prepare('UPDATE users SET role=COALESCE(?,role), status=COALESCE(?,status), department=COALESCE(?,department) WHERE id=?').run(role, status, department, req.params.id);
  res.json({ok:true});
});

// --- PROJECTS ---
function canAccessProject(user, projectId){
  if(['super_admin','admin'].includes(user.role)) return true;
  const m = db.prepare('SELECT * FROM project_members WHERE project_id=? AND user_id=?').get(projectId, user.id);
  const p = db.prepare('SELECT * FROM projects WHERE id=? AND owner_id=?').get(projectId, user.id);
  return !!(m||p);
}

app.get('/api/projects', authMiddleware, (req,res)=>{
  let projects;
  if(['super_admin','admin'].includes(req.user.role)) {
    projects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
  } else {
    projects = db.prepare(`SELECT p.* FROM projects p JOIN project_members pm ON pm.project_id=p.id WHERE pm.user_id=? GROUP BY p.id ORDER BY p.created_at DESC`).all(req.user.id);
  }
  // attach counts
  projects = projects.map(p=>({
    ...p,
    task_count: db.prepare('SELECT COUNT(*) c FROM tasks WHERE project_id=?').get(p.id).c,
    delivered: db.prepare("SELECT COUNT(*) c FROM tasks WHERE project_id=? AND status='delivered'").get(p.id).c
  }));
  res.json({projects});
});

app.post('/api/projects', authMiddleware, requireRole('super_admin','admin','manager'), (req,res)=>{
  const {name, client_name='', goal='', type='content-seo'} = req.body;
  if(!name) return res.status(400).json({error:'name required'});
  const id = uuidv4();
  db.prepare('INSERT INTO projects (id,name,client_name,goal,type,owner_id,status) VALUES (?,?,?,?,?,?,?)').run(id,name,client_name,goal,type,req.user.id,'draft');
  db.prepare('INSERT INTO project_members (id,project_id,user_id,role_in_project) VALUES (?,?,?,?)').run(uuidv4(), id, req.user.id, 'owner');
  res.json({id, name, status:'draft'});
});

app.get('/api/projects/:id', authMiddleware, (req,res)=>{
  if(!canAccessProject(req.user, req.params.id)) return res.status(403).json({error:'No access to project'});
  const p = db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id);
  if(!p) return res.status(404).json({error:'Not found'});
  
  const members = db.prepare(`SELECT u.id,u.name,u.email,u.role, pm.role_in_project FROM project_members pm JOIN users u ON u.id=pm.user_id WHERE pm.project_id=?`).all(req.params.id);
  
  // Clients can ONLY see delivered tasks
  let taskQuery = 'SELECT * FROM tasks WHERE project_id=? ORDER BY created_at DESC';
  if (req.user.role === 'client') {
    taskQuery = "SELECT * FROM tasks WHERE project_id=? AND status='delivered' ORDER BY created_at DESC";
  }
  const tasks = db.prepare(taskQuery).all(req.params.id);
  const files = db.prepare('SELECT * FROM harness_files WHERE project_id=? ORDER BY created_at DESC').all(req.params.id);
  res.json({project:p, members, tasks, files});
});

app.post('/api/projects/:id/members', authMiddleware, requireRole('super_admin','admin','manager'), (req,res)=>{
  db.prepare('INSERT OR IGNORE INTO project_members (id,project_id,user_id,role_in_project) VALUES (?,?,?,?)').run(uuidv4(), req.params.id, req.body.user_id, req.body.role_in_project||'member');
  res.json({ok:true});
});

// --- HARNESS UPLOAD ---
const harnessUpload = upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'harness', maxCount: 1 },
  { name: 'attachment', maxCount: 1 }
]);

app.post('/api/projects/:id/harness', authMiddleware, (req, res) => {
  harnessUpload(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!canAccessProject(req.user, req.params.id)) return res.status(403).json({ error: 'No access' });
    const uploadedFile = req.file || (req.files && (req.files.file?.[0] || req.files.harness?.[0] || req.files.attachment?.[0]));
    if (!uploadedFile) return res.status(400).json({ error: 'No file uploaded (expected field: file, harness, or attachment)' });
    const id = uuidv4();
    db.prepare('INSERT INTO harness_files (id,project_id,filename,original_name,mime,size,uploaded_by,parsed_summary) VALUES (?,?,?,?,?,?,?,?)')
      .run(id, req.params.id, uploadedFile.filename, uploadedFile.originalname, uploadedFile.mimetype, uploadedFile.size, req.user.id, `Uploaded ${uploadedFile.originalname} - ready for agents.`);
    res.json({ id, filename: uploadedFile.originalname, size: uploadedFile.size });
  });
});

// --- TASKS / PIPELINES ---
const PIPELINES = {
  'content-seo': {name:'Content + SEO', squad:['coordinator','browser-researcher','software-engineer','master-reporting-agent']},
  'social-content': {name:'Social Content', squad:['coordinator','browser-researcher','master-reporting-agent']},
  'ads-creative': {name:'Ads Creative', squad:['coordinator','software-engineer','master-reporting-agent']},
  'email-campaign': {name:'Email Campaign', squad:['coordinator','browser-researcher','master-reporting-agent']},
  'lead-research': {name:'Lead Research', squad:['coordinator','browser-researcher','master-reporting-agent']},
  'landing-page': {name:'Landing Page Factory', squad:['coordinator','software-engineer','master-reporting-agent']},
  'market-intel': {name:'Market Intelligence', squad:['coordinator','browser-researcher','master-reporting-agent']},
  'brand-kit': {name:'Brand Kit', squad:['coordinator','software-engineer','master-reporting-agent']},
};
app.get('/api/pipelines', authMiddleware, (req,res)=> res.json({pipelines: PIPELINES}));

app.post('/api/projects/:id/tasks', authMiddleware, (req,res)=>{
  if(!canAccessProject(req.user, req.params.id)) return res.status(403).json({error:'No access'});
  const {title, pipeline='content-seo', description='', assignee_id=null, priority='medium', input={}} = req.body;
  if(!title) return res.status(400).json({error:'title required'});
  if(!PIPELINES[pipeline]) return res.status(400).json({error:'Unknown pipeline'});
  const id = uuidv4();
  db.prepare('INSERT INTO tasks (id,project_id,title,pipeline,description,assignee_id,created_by,priority,input_json,status) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(id, req.params.id, title, pipeline, description, assignee_id, req.user.id, priority, JSON.stringify(input), 'draft');
  db.prepare('INSERT INTO activity (id,project_id,task_id,user_id,action) VALUES (?,?,?,?,?)').run(uuidv4(), req.params.id, id, req.user.id, 'task_created');
  res.json({id, title, pipeline, status:'draft'});
});

// RUN TASK with LOCAL FALLBACK (Factory Never Blocks)
app.post('/api/tasks/:id/run', authMiddleware, async (req,res)=>{
  const task = db.prepare('SELECT * FROM tasks WHERE id=?').get(req.params.id);
  if(!task) return res.status(404).json({error:'Task not found'});
  if(!canAccessProject(req.user, task.project_id)) return res.status(403).json({error:'No access'});
  
  const project = db.prepare('SELECT * FROM projects WHERE id=?').get(task.project_id);
  const harness = db.prepare('SELECT * FROM harness_files WHERE project_id=?').all(task.project_id);
  
  // 1. Try n8n first
  console.log(`[task-runner] Attempting n8n run for task ${task.id} (${task.pipeline})...`);
  db.prepare("UPDATE tasks SET status='queued', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(task.id);
  const result = await triggerN8n(task, project, harness);
  
  if(result.ok){
    db.prepare("UPDATE tasks SET status='running', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(task.id);
    return res.json({
      ok: true,
      mode: 'n8n',
      n8n: result,
      message: 'Executed via n8n'
    });
  }

  // 2. n8n failed or offline — execute LOCALLY immediately! Factory never blocks!
  console.log(`[task-runner] n8n offline (${result.error}). Executing task locally...`);
  const { outputJson, reportMd } = generateLocalDeliverable(task.pipeline, task, project, harness, result.error);

  db.prepare("UPDATE tasks SET status='in_review', output_json=?, report_md=?, updated_at=CURRENT_TIMESTAMP WHERE id=?")
    .run(JSON.stringify(outputJson), reportMd, task.id);

  db.prepare('INSERT INTO reports (id,task_id,project_id,title,content_md,verdict,created_by) VALUES (?,?,?,?,?,?,?)')
    .run(uuidv4(), task.id, task.project_id, `Admin Report - ${task.title}`, reportMd, 'pending', 'local-agent');

  db.prepare('INSERT INTO activity (id,project_id,task_id,user_id,action) VALUES (?,?,?,?,?)')
    .run(uuidv4(), task.project_id, task.id, req.user.id, `executed_locally:${task.pipeline}`);

  return res.json({
    ok: true,
    mode: 'local',
    message: 'Executed LOCALLY - n8n offline',
    task_id: task.id,
    status: 'in_review',
    n8n_error: result.error
  });
});

app.post('/api/tasks/:id/retry', authMiddleware, async (req,res)=>{
  req.url = `/api/tasks/${req.params.id}/run`;
  res.redirect(307, `/api/tasks/${req.params.id}/run`);
});

app.patch('/api/tasks/:id', authMiddleware, (req,res)=>{
  const task = db.prepare('SELECT * FROM tasks WHERE id=?').get(req.params.id);
  if(!task) return res.status(404).json({error:'Not found'});
  if(!canAccessProject(req.user, task.project_id)) return res.status(403).json({error:'No access'});
  let {status, report_md} = req.body;
  
  if (Array.isArray(status)) status = status[0];
  if (status && typeof status !== 'string') return res.status(400).json({error:'Invalid status format'});
  const VALID_STATUSES = ['draft','queued','running','in_review','needs_fix','delivered'];
  if (status && !VALID_STATUSES.includes(status)) return res.status(400).json({error:'Unknown status'});

  // Strict RBAC: Only super_admin, admin, manager can approve & deliver
  if(status === 'delivered' && !['super_admin','admin','manager'].includes(req.user.role)) {
    return res.status(403).json({error:'Only admin/manager can deliver'});
  }
  
  if(status) {
    db.prepare('UPDATE tasks SET status=?, report_md=COALESCE(?,report_md), updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .run(status, report_md||null, task.id);
    
    // Update report verdict to approved if delivering
    if(status === 'delivered') {
      db.prepare("UPDATE reports SET verdict='approved' WHERE task_id=?").run(task.id);
      db.prepare('INSERT INTO activity (id,project_id,task_id,user_id,action) VALUES (?,?,?,?,?)')
        .run(uuidv4(), task.project_id, task.id, req.user.id, 'task_approved_delivered');
    }
  }
  res.json({ok:true, status});
});

app.get('/api/tasks/:id', authMiddleware, (req,res)=>{
  const t = db.prepare('SELECT * FROM tasks WHERE id=?').get(req.params.id);
  if(!t) return res.status(404).json({error:'Not found'});
  if(!canAccessProject(req.user, t.project_id)) return res.status(403).json({error:'No access'});
  if(req.user.role === 'client' && t.status !== 'delivered') {
    return res.status(403).json({error:'Clients can only view delivered deliverables'});
  }
  res.json({task:t});
});

// --- n8n CALLBACK (Real agents report back) ---
app.post('/api/webhooks/n8n', (req,res)=>{
  const apiKey = req.headers['x-os-api-key'] || req.body.api_key;
  if(apiKey !== (process.env.OS_API_KEY || 'local-dev-key-change-me')) return res.status(401).json({error:'Bad API key'});
  const {task_id, status='in_review', output={}, report_md='', n8n_execution_id=''} = req.body;
  const task = db.prepare('SELECT * FROM tasks WHERE id=?').get(task_id);
  if(!task) return res.status(404).json({error:'Task not found'});
  db.prepare('UPDATE tasks SET status=?, output_json=?, report_md=?, n8n_execution_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(status, JSON.stringify(output), report_md, n8n_execution_id, task_id);
  if(report_md){
    db.prepare('INSERT INTO reports (id,task_id,project_id,title,content_md,verdict,created_by) VALUES (?,?,?,?,?,?,?)')
      .run(uuidv4(), task_id, task.project_id, `Admin Report - ${task.title}`, report_md, 'pending', 'system-n8n');
  }
  db.prepare('INSERT INTO activity (id,project_id,task_id,user_id,action) VALUES (?,?,?,?,?)').run(uuidv4(), task.project_id, task_id, 'system-n8n', `agent_finished:${status}`);
  res.json({ok:true});
});

// --- DASHBOARD STATS (role-aware) ---
app.get('/api/dashboard', authMiddleware, (req,res)=>{
  const isAdmin = ['super_admin','admin'].includes(req.user.role);
  const where = isAdmin ? '' : `WHERE project_id IN (SELECT project_id FROM project_members WHERE user_id='${req.user.id}')`;
  const totalTasks = db.prepare(`SELECT COUNT(*) c FROM tasks ${where}`).get().c;
  const delivered = db.prepare(`SELECT COUNT(*) c FROM tasks ${where ? where + " AND" : "WHERE"} status='delivered'`).get().c;
  const inReview = db.prepare(`SELECT COUNT(*) c FROM tasks ${where ? where + " AND" : "WHERE"} status='in_review'`).get().c;
  const running = db.prepare(`SELECT COUNT(*) c FROM tasks ${where ? where + " AND" : "WHERE"} status IN ('running','queued')`).get().c;
  
  let projectsCount = 0;
  if (isAdmin) {
    projectsCount = db.prepare(`SELECT COUNT(*) c FROM projects`).get().c;
  } else {
    projectsCount = db.prepare(`SELECT COUNT(DISTINCT project_id) c FROM project_members WHERE user_id='${req.user.id}'`).get().c;
  }

  let recentQuery = `SELECT t.*, p.name as project_name FROM tasks t JOIN projects p ON p.id=t.project_id ORDER BY t.updated_at DESC LIMIT 8`;
  if (!isAdmin) {
    const statusFilter = req.user.role === 'client' ? "AND t.status='delivered'" : "";
    recentQuery = `SELECT t.*, p.name as project_name FROM tasks t JOIN projects p ON p.id=t.project_id WHERE p.id IN (SELECT project_id FROM project_members WHERE user_id='${req.user.id}') ${statusFilter} ORDER BY t.updated_at DESC LIMIT 8`;
  }
  const recent = db.prepare(recentQuery).all();
  res.json({stats:{totalTasks, delivered, inReview, running, projects: projectsCount}, recent});
});

app.get('/api/activity', authMiddleware, (req,res)=>{
  const rows = db.prepare('SELECT * FROM activity ORDER BY created_at DESC LIMIT 50').all();
  res.json({activity: rows});
});

app.get('*', (req,res)=> res.sendFile(path.join(__dirname,'../public/index.html')));

app.listen(PORT, ()=> console.log(`\n✅ Marketing OS running at http://localhost:${PORT}\n   Seed: npm run seed\n   n8n webhook: ${process.env.N8N_WEBHOOK_TASK}\n`));
