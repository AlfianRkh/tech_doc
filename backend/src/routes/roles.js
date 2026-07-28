const express = require('express');
const db = require('../db');
const { authenticateToken, requirePermission } = require('../middleware/auth');

const router = express.Router();

// Get all roles with their permission keys
router.get('/', authenticateToken, requirePermission('roles:read'), async (_req, res) => {
  try {
    const result = await db.query(
      `SELECT r.id, r.name, r.description, r.is_system, r.created_at,
              COALESCE(
                json_agg(
                  json_build_object('id', p.id, 'key', p.key, 'name', p.name, 'module', p.module)
                ) FILTER (WHERE p.id IS NOT NULL), '[]'
              ) as permissions
       FROM roles r
       LEFT JOIN role_permissions rp ON r.id = rp.role_id
       LEFT JOIN permissions p ON rp.permission_id = p.id
       GROUP BY r.id
       ORDER BY r.id ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new role
router.post('/', authenticateToken, requirePermission('roles:write'), async (req, res) => {
  try {
    const { name, description, permission_ids = [] } = req.body;
    if (!name) return res.status(400).json({ error: 'Role name is required' });

    const insertRes = await db.query(
      `INSERT INTO roles (name, description) VALUES ($1, $2) RETURNING *`,
      [name.trim(), description || '']
    );
    const newRole = insertRes.rows[0];

    if (permission_ids.length > 0) {
      const values = permission_ids.map((pid, i) => `($1, $${i + 2})`).join(', ');
      await db.query(
        `INSERT INTO role_permissions (role_id, permission_id) VALUES ${values} ON CONFLICT DO NOTHING`,
        [newRole.id, ...permission_ids]
      );
    }

    res.status(201).json(newRole);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Role name already exists' });
    res.status(500).json({ error: err.message });
  }
});

// Update role permissions (replace all)
router.put('/:id', authenticateToken, requirePermission('roles:write'), async (req, res) => {
  try {
    const { name, description, permission_ids = [] } = req.body;

    const roleRes = await db.query('SELECT is_system FROM roles WHERE id = $1', [req.params.id]);
    if (!roleRes.rows.length) return res.status(404).json({ error: 'Role not found' });

    const updateRes = await db.query(
      `UPDATE roles SET
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [name, description, req.params.id]
    );

    await db.query('DELETE FROM role_permissions WHERE role_id = $1', [req.params.id]);
    if (permission_ids.length > 0) {
      const values = permission_ids.map((pid, i) => `($1, $${i + 2})`).join(', ');
      await db.query(
        `INSERT INTO role_permissions (role_id, permission_id) VALUES ${values} ON CONFLICT DO NOTHING`,
        [req.params.id, ...permission_ids]
      );
    }

    res.json(updateRes.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete role
router.delete('/:id', authenticateToken, requirePermission('roles:write'), async (req, res) => {
  try {
    const roleRes = await db.query('SELECT is_system FROM roles WHERE id = $1', [req.params.id]);
    if (!roleRes.rows.length) return res.status(404).json({ error: 'Role not found' });
    if (roleRes.rows[0].is_system) {
      return res.status(400).json({ error: 'Cannot delete system roles (Admin, Editor, Viewer)' });
    }

    await db.query('DELETE FROM roles WHERE id = $1', [req.params.id]);
    res.json({ message: 'Role deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
