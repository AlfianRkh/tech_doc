const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/metrics
router.get('/', async (req, res) => {
  try {
    const [totals, errorBreakdown, topFlows, execTimeSeries] = await Promise.all([
      db.query(`
        SELECT
          COUNT(*)::int AS total_executions,
          COUNT(*) FILTER (WHERE status='failed')::int AS failed_executions,
          ROUND(AVG(total_duration_ms))::int AS avg_duration_ms,
          ROUND(
            COUNT(*) / NULLIF(EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) / 60, 0), 1
          ) AS throughput_per_min
        FROM simulations WHERE created_at >= NOW() - INTERVAL '7 days'
      `),
      db.query(`
        SELECT
          ne.node_type,
          COUNT(*)::int AS error_count,
          f.name AS flow_name,
          MAX(ne.executed_at) AS last_occurred
        FROM node_executions ne
        JOIN simulations s ON s.id = ne.simulation_id
        JOIN flows f ON f.id = s.flow_id
        WHERE ne.status = 'failed'
          AND ne.executed_at >= NOW() - INTERVAL '7 days'
        GROUP BY ne.node_type, f.name
        ORDER BY error_count DESC
        LIMIT 10
      `),
      db.query(`
        SELECT
          f.name,
          COUNT(s.id)::int AS execution_count
        FROM flows f
        LEFT JOIN simulations s ON s.flow_id = f.id
        GROUP BY f.id, f.name
        ORDER BY execution_count DESC
        LIMIT 5
      `),
      db.query(`
        SELECT
          DATE_TRUNC('hour', started_at) AS hour,
          ROUND(AVG(total_duration_ms))::int AS avg_ms,
          COUNT(*)::int AS count
        FROM simulations
        WHERE started_at >= NOW() - INTERVAL '7 days' AND status='completed'
        GROUP BY 1 ORDER BY 1
      `),
    ]);

    const maxExec = Math.max(...topFlows.rows.map((f) => f.execution_count), 1);

    res.json({
      totals: totals.rows[0],
      error_breakdown: errorBreakdown.rows,
      top_flows: topFlows.rows.map((f) => ({
        ...f,
        pct: Math.round((f.execution_count / maxExec) * 100),
      })),
      exec_time_series: execTimeSeries.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
