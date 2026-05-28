const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/dashboard
router.get('/', async (req, res) => {
  try {
    const [flows, sims, success, avgDuration, recentActivity] = await Promise.all([
      db.query('SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status=\'active\')::int AS active FROM flows'),
      db.query('SELECT COUNT(*)::int AS total FROM simulations'),
      db.query(`
        SELECT
          COUNT(*) FILTER (WHERE status='completed')::int AS completed,
          COUNT(*) FILTER (WHERE status='failed')::int AS failed,
          ROUND(
            COUNT(*) FILTER (WHERE status='completed') * 100.0 / NULLIF(COUNT(*),0), 1
          ) AS success_rate
        FROM simulations WHERE status IN ('completed','failed')
      `),
      db.query(`
        SELECT ROUND(AVG(total_duration_ms))::int AS avg_ms
        FROM simulations WHERE status='completed' AND total_duration_ms IS NOT NULL
      `),
      db.query(`
        SELECT f.name AS flow_name, f.status,
          COUNT(s.id)::int AS executions,
          ROUND(
            COUNT(s.id) FILTER (WHERE s.status='completed') * 100.0 / NULLIF(COUNT(s.id),0), 1
          ) AS success_rate,
          MAX(s.created_at) AS last_run
        FROM flows f
        LEFT JOIN simulations s ON s.flow_id = f.id
        GROUP BY f.id, f.name, f.status
        ORDER BY executions DESC
        LIMIT 10
      `),
    ]);

    // Simulations per day (last 7 days)
    const weeklyRes = await db.query(`
      SELECT
        DATE_TRUNC('day', created_at) AS day,
        COUNT(*)::int AS count
      FROM simulations
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY 1 ORDER BY 1
    `);

    res.json({
      stats: {
        total_flows: flows.rows[0].total,
        active_flows: flows.rows[0].active,
        total_simulations: sims.rows[0].total,
        completed_simulations: success.rows[0].completed,
        failed_simulations: success.rows[0].failed,
        success_rate: parseFloat(success.rows[0].success_rate) || 0,
        avg_duration_ms: avgDuration.rows[0].avg_ms || 0,
      },
      weekly_simulations: weeklyRes.rows,
      recent_activity: recentActivity.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
