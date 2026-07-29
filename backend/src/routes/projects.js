const express = require('express');
const db = require('../db');
const { optionalAuth, authenticateToken, requirePermission } = require('../middleware/auth');

const router = express.Router();

// Get all projects with flow count stats
router.get('/', optionalAuth, async (_req, res) => {
  try {
    const result = await db.query(
      `SELECT p.*,
              COUNT(f.id)::int as flow_count
       FROM projects p
       LEFT JOIN flows f ON p.id = f.project_id
       GROUP BY p.id
       ORDER BY p.id ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single project
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT p.*, COUNT(f.id)::int as flow_count
       FROM projects p
       LEFT JOIN flows f ON p.id = f.project_id
       WHERE p.id = $1
       GROUP BY p.id`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new project folder
router.post('/', authenticateToken, requirePermission('projects:write'), async (req, res) => {
  try {
    const { name, code, description, color, icon } = req.body;
    if (!name || !code) {
      return res.status(400).json({ error: 'Project name and code are required' });
    }

    const insertRes = await db.query(
      `INSERT INTO projects (name, code, description, color, icon)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        name.trim(),
        code.trim().toUpperCase(),
        description || '',
        color || '#3b82f6',
        icon || '📁'
      ]
    );

    res.status(201).json(insertRes.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Project code already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Update project folder
router.put('/:id', authenticateToken, requirePermission('projects:write'), async (req, res) => {
  try {
    const { name, code, description, color, icon } = req.body;
    const updateRes = await db.query(
      `UPDATE projects
       SET name = COALESCE($1, name),
           code = COALESCE($2, code),
           description = COALESCE($3, description),
           color = COALESCE($4, color),
           icon = COALESCE($5, icon),
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [name, code ? code.toUpperCase() : null, description, color, icon, req.params.id]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(updateRes.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete project folder
router.delete('/:id', authenticateToken, requirePermission('projects:delete'), async (req, res) => {
  try {
    const deleteRes = await db.query('DELETE FROM projects WHERE id = $1 RETURNING *', [req.params.id]);
    if (deleteRes.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ message: 'Project deleted successfully', project: deleteRes.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
