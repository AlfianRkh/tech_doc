const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/nodes
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM node_templates ORDER BY node_type ASC, name ASC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/nodes/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM node_templates WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/nodes
router.post('/', async (req, res) => {
  const {
    name, node_type = 'Process', description = '', icon = '⚙', color = '#3b82f6',
    default_input_params = {}, default_validation = '',
    default_process_logic = '', default_output_template = {},
  } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const result = await db.query(
      `INSERT INTO node_templates
        (name, node_type, description, icon, color,
         default_input_params, default_validation, default_process_logic, default_output_template)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [name, node_type, description, icon, color,
       JSON.stringify(default_input_params), default_validation,
       default_process_logic, JSON.stringify(default_output_template)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/nodes/:id
router.put('/:id', async (req, res) => {
  const {
    name, node_type, description, icon, color,
    default_input_params, default_validation,
    default_process_logic, default_output_template,
  } = req.body;
  try {
    const result = await db.query(
      `UPDATE node_templates SET
        name = COALESCE($1, name),
        node_type = COALESCE($2, node_type),
        description = COALESCE($3, description),
        icon = COALESCE($4, icon),
        color = COALESCE($5, color),
        default_input_params = COALESCE($6, default_input_params),
        default_validation = COALESCE($7, default_validation),
        default_process_logic = COALESCE($8, default_process_logic),
        default_output_template = COALESCE($9, default_output_template),
        updated_at = NOW()
       WHERE id = $10
       RETURNING *`,
      [name, node_type, description, icon, color,
       default_input_params ? JSON.stringify(default_input_params) : null,
       default_validation,
       default_process_logic,
       default_output_template ? JSON.stringify(default_output_template) : null,
       req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/nodes/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM node_templates WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
