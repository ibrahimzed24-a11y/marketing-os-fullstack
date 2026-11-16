const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./db');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
function signToken(user){
  return jwt.sign({id:user.id, email:user.email, role:user.role, name:user.name}, JWT_SECRET, {expiresIn: process.env.JWT_EXPIRES_IN || '7d'});
}
function authMiddleware(req,res,next){
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if(!token) return res.status(401).json({error:'No token'});
  try{ req.user = jwt.verify(token, JWT_SECRET); next(); } catch(e){ return res.status(401).json({error:'Invalid token'}); }
}
function requireRole(...roles){
  return (req,res,next)=>{
    if(!req.user || !roles.includes(req.user.role)) return res.status(403).json({error:'Forbidden: need '+roles.join(',')});
    next();
  };
}
async function hashPassword(p){ return bcrypt.hash(p, 10); }
async function verifyPassword(p, hash){ return bcrypt.compare(p, hash); }
module.exports = {signToken, authMiddleware, requireRole, hashPassword, verifyPassword};
