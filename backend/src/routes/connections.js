const express = require('express');
const router = express.Router();
const db = require('../db');
const { optionalAuth } = require('../middleware/auth');

/**
 * GET /api/connections
 * Returns all flow_connections enriched with:
 *  - source node label + type + color
 *  - target node label + type + color
 *  - flow name, flow status
 *  - project name, code, color, icon
 *
 * Query params:
 *  ?project_id=X   — filter to a specific project
 *  ?flow_id=X      — filter to a specific flow
 *  ?search=text    — filter by node label or flow name (case-insensitive)
 */
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { project_id, flow_id, search } = req.query;

    const params = [];
    const conditions = [];

    if (project_id) {
      params.push(project_id);
      conditions.push(`f.project_id = $${params.length}`);
    }
    if (flow_id) {
      params.push(flow_id);
      conditions.push(`fc.flow_id = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      const n = params.length;
      conditions.push(
        `(sn.label ILIKE $${n} OR tn.label ILIKE $${n} OR f.name ILIKE $${n})`
      );
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const queryText = `
      SELECT
        fc.id,
        fc.flow_id,
        fc.branch_label,
        fc.created_at,

        -- source node
        fc.source_node_id,
        sn.label          AS source_label,
        sn.node_type      AS source_type,
        sn.icon           AS source_icon,
        sn.color          AS source_color,

        -- target node
        fc.target_node_id,
        tn.label          AS target_label,
        tn.node_type      AS target_type,
        tn.icon           AS target_icon,
        tn.color          AS target_color,

        -- flow
        f.name            AS flow_name,
        f.status          AS flow_status,
        f.version         AS flow_version,

        -- project
        p.id              AS project_id,
        p.name            AS project_name,
        p.code            AS project_code,
        p.color           AS project_color,
        p.icon            AS project_icon

      FROM flow_connections fc
      JOIN flow_nodes  sn ON sn.id = fc.source_node_id
      JOIN flow_nodes  tn ON tn.id = fc.target_node_id
      JOIN flows        f ON  f.id = fc.flow_id
      LEFT JOIN projects p ON  p.id = f.project_id
      ${whereClause}
      ORDER BY f.project_id NULLS LAST, f.name, fc.id
    `;

    const result = await db.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
