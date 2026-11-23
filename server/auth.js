const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./db');

const IS_PROD = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

function resolveJwtSecret() {
  const configured = (process.env.JWT_SECRET || '').trim();
  if (IS_PROD) {
    if (!configured || configured === 'dev-secret-change-me' || configured.length < 32) {
      throw new Error(
        '[FATAL SECURITY] JWT_SECRET must be set to a strong secret (>= 32 chars) in production.'
      );
    }
    return configured;
  }
  if (!configured || configured === 'dev-secret-change-me') {
    console.warn('[SECURITY WARN] Using development JWT_SECRET fallback (blocked in production).');
    return 'local-dev-only-jwt-secret-not-for-production';
  }
  return configured;
}

const JWT_SECRET = resolveJwtSecret();

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name, department: user.department },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function authMiddleware(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      // Reject tokens whose account has since been suspended or is still pending approval.
      try {
        const u = db.prepare('SELECT status FROM users WHERE id=?').get(payload.id);
        if (u && u.status && u.status !== 'active') {
          return res.status(403).json({ error: u.status === 'pending' ? 'Account awaiting administrator approval.' : 'Account suspended.' });
        }
      } catch (_) {}
      req.user = payload;
      return next();
    } catch (e) {
      // Token expired or invalid, check fallback
    }
  }

  // Session role fallback ONLY for local automated test suites when NODE_ENV === 'test'
  if (process.env.NODE_ENV === 'test') {
    const sessionRole = req.headers['x-session-role'] || req.headers['x-role'];
    if (sessionRole) {
      try {
        const searchRole = sessionRole === 'admin' ? 'super_admin' : sessionRole;
        const u = db.prepare('SELECT id, name, email, role, department FROM users WHERE role=? LIMIT 1').get(searchRole);
        if (u) {
          req.user = u;
          return next();
        }
      } catch (dbErr) {}
    }
  }

  // Dev mode local fallback (strictly disabled in production; must be explicitly opted-in locally)
  if (!IS_PROD && process.env.ALLOW_ANONYMOUS_DEV_ADMIN === 'true') {
    try {
      const defaultUser = db.prepare('SELECT id, name, email, role, department FROM users WHERE role = ? LIMIT 1').get('super_admin');
      if (defaultUser) {
        req.user = defaultUser;
        return next();
      }
    } catch (err) {
      console.error('[auth] Dev fallback lookup failed:', err.message);
    }
  }

  return res.status(401).json({ error: 'No token or authorized session found' });
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No user session found' });
    }
    const userRole = req.user.role;
    // Owner and Super Admin have root access across all endpoints
    if (userRole === 'owner' || userRole === 'super_admin') {
      return next();
    }
    const effectiveRoles = roles.flatMap(r => {
      if (r === 'admin') return ['admin', 'super_admin', 'owner'];
      if (r === 'super_admin') return ['super_admin', 'owner'];
      return [r];
    });
    if (effectiveRoles.includes(userRole)) {
      return next();
    }
    return res.status(403).json({ error: 'Forbidden: Requires role ' + roles.join(' or ') });
  };
}

async function hashPassword(p) {
  return bcrypt.hash(p, 10);
}

async function verifyPassword(p, hash) {
  return bcrypt.compare(p, hash);
}

module.exports = { signToken, authMiddleware, requireRole, hashPassword, verifyPassword };
