const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'techflow-secret-key-2026';

async function fetchUserPermissions(userId) {
  const result = await db.query(
    `SELECT u.id, u.name, u.email, u.role_id, r.name as role_name, r.is_system,
            COALESCE(
              json_agg(p.key) FILTER (WHERE p.key IS NOT NULL), '[]'
            ) as permissions
     FROM users u
     LEFT JOIN roles r ON u.role_id = r.id
     LEFT JOIN role_permissions rp ON r.id = rp.role_id
     LEFT JOIN permissions p ON rp.permission_id = p.id
     WHERE u.id = $1
     GROUP BY u.id, r.name, r.is_system`,
    [userId]
  );
  if (result.rows.length === 0) return null;
  const user = result.rows[0];
  user.permissions = Array.isArray(user.permissions) ? user.permissions : JSON.parse(user.permissions || '[]');
  return user;
}

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await fetchUserPermissions(decoded.id);

    if (!user) {
      return res.status(401).json({ error: 'User account not found' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function optionalAuth(req, _res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    fetchUserPermissions(decoded.id).then((user) => {
      if (user) req.user = user;
      next();
    }).catch(() => next());
  } catch {
    next();
  }
}

function requirePermission(permissionKey) {
  return (req, res, next) => {
    console.log('=== DEBUG req.user ===');
    console.log(req.user);
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    // Admin has master access
    if (req.user.role_name === 'Admin' || (req.user.permissions && req.user.permissions.includes(permissionKey))) {
      return next();
    }
    return res.status(403).json({
      error: `Access denied. Requires permission: '${permissionKey}'`
    });
  };
}

module.exports = {
  JWT_SECRET,
  fetchUserPermissions,
  authenticateToken,
  optionalAuth,
  requirePermission,
};
