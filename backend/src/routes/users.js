const express = require('express');
const db = require('../db');
const { authenticateToken, requirePermission } = require('../middleware/auth');

const router = express.Router();

// List all users
router.get('/', authenticateToken, requirePermission('users:read'), async (_req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.name, u.email, u.role_id, r.name as role_name, u.created_at
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       ORDER BY u.id ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user role
router.put('/:id/role', authenticateToken, requirePermission('users:write'), async (req, res) => {
  try {
    const { role_id } = req.body;
    if (!role_id) {
      return res.status(400).json({ error: 'role_id is required' });
    }

    const updateRes = await db.query(
      `UPDATE users
       SET role_id = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, name, email, role_id`,
      [role_id, req.params.id]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(updateRes.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user
router.delete('/:id', authenticateToken, requirePermission('users:write'), async (req, res) => {
  try {
    const deleteRes = await db.query('DELETE FROM users WHERE id = $1 RETURNING id, email', [req.params.id]);
    if (deleteRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User deleted successfully', user: deleteRes.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
