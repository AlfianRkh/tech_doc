const express = require('express');
const db = require('../db');
const { authenticateToken, requirePermission } = require('../middleware/auth');

const router = express.Router();

// Get all permissions grouped by module
router.get('/', authenticateToken, requirePermission('roles:read'), async (_req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM permissions ORDER BY module ASC, key ASC`
    );

    const grouped = {};
    result.rows.forEach((p) => {
      if (!grouped[p.module]) grouped[p.module] = [];
      grouped[p.module].push(p);
    });

    res.json({ permissions: result.rows, grouped });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add new feature permission to registry
router.post('/', authenticateToken, requirePermission('permissions:manage'), async (req, res) => {
  try {
    const { key, name, module, description } = req.body;
    if (!key || !name) {
      return res.status(400).json({ error: 'Permission key and name are required' });
    }

    const insertRes = await db.query(
      `INSERT INTO permissions (key, name, module, description)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [key.trim().toLowerCase(), name.trim(), module || 'General', description || '']
    );

    res.status(201).json(insertRes.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Permission key already exists' });
    res.status(500).json({ error: err.message });
  }
});

// Update permission details
router.put('/:id', authenticateToken, requirePermission('permissions:manage'), async (req, res) => {
  try {
    const { key, name, module, description } = req.body;

    const updateRes = await db.query(
      `UPDATE permissions
       SET key = COALESCE($1, key),
           name = COALESCE($2, name),
           module = COALESCE($3, module),
           description = COALESCE($4, description)
       WHERE id = $5 RETURNING *`,
      [key ? key.trim().toLowerCase() : null, name, module, description, req.params.id]
    );

    if (!updateRes.rows.length) return res.status(404).json({ error: 'Permission not found' });
    res.json(updateRes.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete permission
router.delete('/:id', authenticateToken, requirePermission('permissions:manage'), async (req, res) => {
  try {
    const deleteRes = await db.query('DELETE FROM permissions WHERE id = $1 RETURNING *', [req.params.id]);
    if (!deleteRes.rows.length) return res.status(404).json({ error: 'Permission not found' });
    res.json({ message: 'Permission deleted successfully', permission: deleteRes.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
