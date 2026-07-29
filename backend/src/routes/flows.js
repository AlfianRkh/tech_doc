const express = require('express');
const router = express.Router();
const db = require('../db');
const { optionalAuth } = require('../middleware/auth');

function computeNodePositions(uniqueNodes, parsedConnections) {
  const adj = {};
  const inDegree = {};
  for (const nodeName of uniqueNodes.keys()) {
    adj[nodeName] = [];
    inDegree[nodeName] = 0;
  }
  for (const conn of parsedConnections) {
    if (adj[conn.source] && adj[conn.target]) {
      adj[conn.source].push(conn.target);
      inDegree[conn.target]++;
    }
  }

  // Find roots (prioritize Start node, then nodes with 0 incoming degree)
  let roots = [];
  for (const nodeName of uniqueNodes.keys()) {
    if (nodeName.toLowerCase().includes('start')) {
      roots.push(nodeName);
    }
  }
  if (roots.length === 0) {
    for (const nodeName of uniqueNodes.keys()) {
      if (inDegree[nodeName] === 0) {
        roots.push(nodeName);
      }
    }
  }
  if (roots.length === 0) {
    roots = [Array.from(uniqueNodes.keys())[0]];
  }

  const ranks = {};
  for (const nodeName of uniqueNodes.keys()) {
    ranks[nodeName] = 0;
  }

  const visited = new Set();
  const recStack = new Set();

  function dfs(node, currentRank) {
    visited.add(node);
    recStack.add(node);
    ranks[node] = Math.max(ranks[node], currentRank);

    for (const neighbor of adj[node]) {
      if (recStack.has(neighbor)) continue; // cycle break
      dfs(neighbor, currentRank + 1);
    }
    recStack.delete(node);
  }

  for (const root of roots) {
    visited.clear();
    recStack.clear();
    dfs(root, 0);
  }

  // Handle unreached nodes
  for (const nodeName of uniqueNodes.keys()) {
    if (!visited.has(nodeName)) {
      visited.clear();
      recStack.clear();
      dfs(nodeName, 0);
    }
  }

  // Group by rank (column)
  const cols = {};
  for (const [nodeName, rank] of Object.entries(ranks)) {
    if (!cols[rank]) cols[rank] = [];
    cols[rank].push(nodeName);
  }

  // Sort nodes in each column by their original declaration order in uniqueNodes
  const originalOrder = Array.from(uniqueNodes.keys());
  for (const rank of Object.keys(cols)) {
    cols[rank].sort((a, b) => originalOrder.indexOf(a) - originalOrder.indexOf(b));
  }

  // Layout parameters
  const hSpacing = 180;
  const vSpacing = 120;
  const startX = 60;
  const middleY = 200;

  const positions = {};
  for (const [rankStr, nodesInCol] of Object.entries(cols)) {
    const col = parseInt(rankStr, 10);
    const N = nodesInCol.length;
    const totalHeight = (N - 1) * vSpacing;
    const startYForCol = middleY - totalHeight / 2;

    for (let i = 0; i < N; i++) {
      const nodeName = nodesInCol[i];
      positions[nodeName] = {
        x: startX + col * hSpacing,
        y: Math.round(startYForCol + i * vSpacing)
      };
    }
  }

  // Shift Y to avoid negative or too small coords
  let minY = Infinity;
  for (const pos of Object.values(positions)) {
    if (pos.y < minY) minY = pos.y;
  }
  const minAllowedY = 60;
  if (minY < minAllowedY) {
    const shiftY = minAllowedY - minY;
    for (const pos of Object.values(positions)) {
      pos.y += shiftY;
    }
  }

  return positions;
}

// GET /api/flows  (supports ?project_id=X for isolation)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { project_id } = req.query;
    let queryText = `
      SELECT f.*,
        p.name AS project_name, p.code AS project_code, p.color AS project_color, p.icon AS project_icon,
        COUNT(fn.id)::int AS node_count,
        (SELECT COUNT(*) FROM simulations s WHERE s.flow_id = f.id)::int AS sim_count
      FROM flows f
      LEFT JOIN projects p ON f.project_id = p.id
      LEFT JOIN flow_nodes fn ON fn.flow_id = f.id
    `;
    const params = [];
    if (project_id) {
      queryText += ` WHERE f.project_id = $1`;
      params.push(project_id);
    }
    queryText += ` GROUP BY f.id, p.name, p.code, p.color, p.icon ORDER BY f.updated_at DESC`;
    const result = await db.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/flows/:id — full flow with nodes and connections
router.get('/:id', async (req, res) => {
  try {
    const flowRes = await db.query('SELECT * FROM flows WHERE id = $1', [req.params.id]);
    if (!flowRes.rows.length) return res.status(404).json({ error: 'Not found' });

    const nodesRes = await db.query(
      'SELECT * FROM flow_nodes WHERE flow_id = $1 ORDER BY order_index ASC, id ASC',
      [req.params.id]
    );
    const connsRes = await db.query(
      'SELECT * FROM flow_connections WHERE flow_id = $1',
      [req.params.id]
    );

    res.json({
      flow: flowRes.rows[0],
      nodes: nodesRes.rows,
      connections: connsRes.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/flows
router.post('/', optionalAuth, async (req, res) => {
  const { name, description = '', version = 'v1.0', status = 'draft', project_id = null } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const result = await db.query(
      'INSERT INTO flows (name, description, version, status, project_id) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [name, description, version, status, project_id]
    );
    const flow = result.rows[0];

    // Auto-create Start and End nodes
    await db.query(
      `INSERT INTO flow_nodes (flow_id, label, node_type, icon, color, pos_x, pos_y, output_template, order_index)
       VALUES
         ($1, 'Start', 'Start', '▶', '#10b981', 40, 120, '{"trigger":"manual"}', 0),
         ($1, 'End', 'End', '■', '#ef4444', 280, 120, '{"status":"completed"}', 1)`,
      [flow.id]
    );

    res.status(201).json(flow);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/flows/:id
router.put('/:id', async (req, res) => {
  const { name, description, version, status } = req.body;
  try {
    const result = await db.query(
      `UPDATE flows SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        version = COALESCE($3, version),
        status = COALESCE($4, status),
        updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [name, description, version, status, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/flows/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM flows WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// Flow Nodes CRUD
// ============================================================

// POST /api/flows/:id/nodes
router.post('/:id/nodes', async (req, res) => {
  const flowId = req.params.id;
  const {
    label, node_type = 'Process', icon = '⚙', color = '#3b82f6',
    pos_x = 200, pos_y = 100, template_id,
    input_params = {}, validation_rules = '',
    process_logic = '', output_template = {},
    condition_expression = null,
  } = req.body;

  if (!label) return res.status(400).json({ error: 'label is required' });

  try {
    // Get max order_index
    const maxRes = await db.query(
      'SELECT COALESCE(MAX(order_index), -1) AS max FROM flow_nodes WHERE flow_id = $1',
      [flowId]
    );
    const orderIndex = maxRes.rows[0].max + 1;

    const result = await db.query(
      `INSERT INTO flow_nodes
        (flow_id, template_id, label, node_type, icon, color, pos_x, pos_y,
         input_params, validation_rules, process_logic, output_template,
         condition_expression, order_index)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [flowId, template_id || null, label, node_type, icon, color, pos_x, pos_y,
       JSON.stringify(input_params), validation_rules, process_logic,
       JSON.stringify(output_template), condition_expression, orderIndex]
    );

    // Update template used_count
    if (template_id) {
      await db.query(
        'UPDATE node_templates SET used_count = used_count + 1 WHERE id = $1',
        [template_id]
      );
    }

    // Update flow updated_at
    await db.query('UPDATE flows SET updated_at = NOW() WHERE id = $1', [flowId]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/flows/:id/nodes/:nodeId
router.put('/:id/nodes/:nodeId', async (req, res) => {
  const { label, node_type, icon, color, pos_x, pos_y,
          input_params, validation_rules, process_logic,
          output_template, condition_expression, order_index } = req.body;
  try {
    const result = await db.query(
      `UPDATE flow_nodes SET
        label = COALESCE($1, label),
        node_type = COALESCE($2, node_type),
        icon = COALESCE($3, icon),
        color = COALESCE($4, color),
        pos_x = COALESCE($5, pos_x),
        pos_y = COALESCE($6, pos_y),
        input_params = COALESCE($7, input_params),
        validation_rules = COALESCE($8, validation_rules),
        process_logic = COALESCE($9, process_logic),
        output_template = COALESCE($10, output_template),
        condition_expression = COALESCE($11, condition_expression),
        order_index = COALESCE($12, order_index),
        updated_at = NOW()
       WHERE id = $13 AND flow_id = $14
       RETURNING *`,
      [label, node_type, icon, color,
       pos_x !== undefined ? pos_x : null,
       pos_y !== undefined ? pos_y : null,
       input_params ? JSON.stringify(input_params) : null,
       validation_rules, process_logic,
       output_template ? JSON.stringify(output_template) : null,
       condition_expression, order_index,
       req.params.nodeId, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    await db.query('UPDATE flows SET updated_at = NOW() WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/flows/:id/nodes/:nodeId
router.delete('/:id/nodes/:nodeId', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM flow_nodes WHERE id = $1 AND flow_id = $2 RETURNING id',
      [req.params.nodeId, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    await db.query('UPDATE flows SET updated_at = NOW() WHERE id = $1', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// Flow Connections CRUD
// ============================================================

// POST /api/flows/:id/connections
router.post('/:id/connections', async (req, res) => {
  const { source_node_id, target_node_id, branch_label = null } = req.body;
  if (!source_node_id || !target_node_id) {
    return res.status(400).json({ error: 'source_node_id and target_node_id are required' });
  }
  try {
    // Prevent self-loops
    if (source_node_id === target_node_id) {
      return res.status(400).json({ error: 'Cannot connect node to itself' });
    }
    const result = await db.query(
      `INSERT INTO flow_connections (flow_id, source_node_id, target_node_id, branch_label)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.params.id, source_node_id, target_node_id, branch_label]
    );
    await db.query('UPDATE flows SET updated_at = NOW() WHERE id = $1', [req.params.id]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/flows/:id/connections/:connId
router.delete('/:id/connections/:connId', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM flow_connections WHERE id = $1 AND flow_id = $2 RETURNING id',
      [req.params.connId, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    await db.query('UPDATE flows SET updated_at = NOW() WHERE id = $1', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// Text Parser (DSL) Generate Flow
// ============================================================

function extractJson(text) {
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      const jsonStr = text.substring(start, end + 1);
      JSON.parse(jsonStr); // test
      return jsonStr;
    }
  } catch (e) { }
  return null;
}

// POST /api/flows/generate-text
router.post('/generate-text', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });

  const client = await db.connect();
  try {
    let flowName = 'Generated Flow';
    let flowDesc = 'Generated automatically from text template';
    
    const uniqueNodes = new Map(); // Simpan detail per node
    const parsedConnections = [];

    const lines = text.split('\n');
    let currentNode = null;
    let currentProp = null;

    // 1. Parsing Line by Line
    let inConnections = false;
    for (let rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      if (line.toLowerCase().startsWith('flow:')) {
        flowName = line.substring(5).trim();
        currentProp = null;
      } else if (line.toLowerCase().startsWith('description:')) {
        flowDesc = line.substring(12).trim();
        currentProp = null;
      } else if (line.toLowerCase() === 'connections' || line.toLowerCase().startsWith('connections:')) {
        inConnections = true;
        currentNode = null;
        currentProp = null;
      } else if (line.match(/^\[Node:(.+)\]/i)) {
        const match = line.match(/^\[Node:(.+)\]/i);
        const nodeName = match[1].trim();
        currentNode = nodeName;
        currentProp = null;
        if (!uniqueNodes.has(nodeName)) {
           uniqueNodes.set(nodeName, { name: nodeName, inputParams: '', validationRules: '', processLogic: '', outputTemplate: '' });
        }
      } else if (inConnections && line.includes('->')) {
        let source = '', target = '', branchLabel = null;
        
        // Cek format dengan label: nodeA --label--> nodeB
        const labelMatch = line.match(/(.+?)\s*--(.+?)-->\s*(.+)/);
        if (labelMatch) {
          source = labelMatch[1].trim();
          branchLabel = labelMatch[2].trim();
          target = labelMatch[3].trim();
        } else {
          // Format biasa: nodeA -> nodeB
          const parts = line.split('->').map(p => p.trim());
          if (parts.length >= 2) {
            source = parts[0];
            target = parts[1];
          }
        }

        if (source && target) {
          if (!uniqueNodes.has(source)) uniqueNodes.set(source, { name: source, inputParams: '', validationRules: '', processLogic: '', outputTemplate: '' });
          if (!uniqueNodes.has(target)) uniqueNodes.set(target, { name: target, inputParams: '', validationRules: '', processLogic: '', outputTemplate: '' });
          parsedConnections.push({ source, target, branchLabel });
        }
      } else if (currentNode) {
        // Deteksi property
        const lowerLine = line.toLowerCase();
        if (lowerLine.startsWith('input:') || lowerLine.startsWith('input fields:')) {
          currentProp = 'inputParams';
          uniqueNodes.get(currentNode).inputParams += line.substring(line.indexOf(':') + 1).trim() + '\n';
        } else if (lowerLine.startsWith('validation:') || lowerLine.startsWith('cek:') || lowerLine.startsWith('kondisi:')) {
          currentProp = 'validationRules';
          uniqueNodes.get(currentNode).validationRules += line.substring(line.indexOf(':') + 1).trim() + '\n';
        } else if (lowerLine.startsWith('logic:') || lowerLine.startsWith('proses:') || lowerLine.startsWith('formula:') || lowerLine.startsWith('event:') || lowerLine.startsWith('api:')) {
          currentProp = 'processLogic';
          uniqueNodes.get(currentNode).processLogic += line + '\n';
        } else if (lowerLine.startsWith('output:')) {
          currentProp = 'outputTemplate';
          uniqueNodes.get(currentNode).outputTemplate += line.substring(7).trim() + '\n';
        } else if (line.match(/^[A-Z\s]+$/) && !line.includes(':')) {
          // Abaikan section header seperti 'VALIDASI', 'LOAD ONGKIR', 'OUTPUT AKHIR'
          currentProp = null;
        } else if (currentProp) {
          // Akumulasi baris baru untuk nilai multi-line
          uniqueNodes.get(currentNode)[currentProp] += rawLine + '\n';
        }
      }
    }

    if (uniqueNodes.size === 0) {
      client.release();
      return res.status(400).json({ error: 'No nodes or connections found. Use format "nodeA -> nodeB"' });
    }

    await client.query('BEGIN');

    // 2. Create Flow Induk
    const { project_id: projectIdBody } = req.body;
    const flowRes = await client.query(
      'INSERT INTO flows (name, description, status, project_id) VALUES ($1, $2, $3, $4) RETURNING id',
      [flowName, flowDesc, 'draft', projectIdBody || null]
    );
    const flowId = flowRes.rows[0].id;

    // 3. Create Nodes
    const nodeMap = {}; 
    const computedPositions = computeNodePositions(uniqueNodes, parsedConnections);
    let orderIndex = 0;

    for (const [nodeName, nodeConfig] of uniqueNodes.entries()) {
      const cleanSearchName = nodeName.replace(/_/g, ' ');
      
      const isControlNode = ['start', 'end'].includes(cleanSearchName.toLowerCase());
      let tplRes = { rows: [] };
      if (!isControlNode) {
        tplRes = await client.query(
          'SELECT id, node_type, icon, color, default_input_params, default_validation, default_process_logic, default_output_template FROM node_templates WHERE name ILIKE $1 LIMIT 1',
          [`%${cleanSearchName}%`]
        );
      }

      let templateId = null;
      let nodeType = 'Process';
      let icon = '⚙';
      let color = '#3b82f6';
      
      let inputParams = nodeConfig.inputParams;
      let validationRules = nodeConfig.validationRules;
      let processLogic = nodeConfig.processLogic;
      let outputTemplate = nodeConfig.outputTemplate;

      if (tplRes.rows.length > 0) {
        const tpl = tplRes.rows[0];
        templateId = tpl.id;
        nodeType = tpl.node_type;
        icon = tpl.icon;
        color = tpl.color;
        
        if (!inputParams) inputParams = tpl.default_input_params ? JSON.stringify(tpl.default_input_params) : '{}';
        if (!validationRules) validationRules = tpl.default_validation || '';
        if (!processLogic) processLogic = tpl.default_process_logic || '';
        if (!outputTemplate) outputTemplate = tpl.default_output_template ? JSON.stringify(tpl.default_output_template) : '{}';
      } else {
        if (!inputParams) inputParams = '{}';
        if (!outputTemplate) outputTemplate = '{}';
        
        if (nodeName.toLowerCase().includes('start')) {
           nodeType = 'Start'; icon = '▶'; color = '#10b981';
        } else if (nodeName.toLowerCase().includes('end')) {
           nodeType = 'End'; icon = '■'; color = '#ef4444';
        } else if (nodeName.toLowerCase().includes('loop')) {
           nodeType = 'Loop'; icon = '🔁'; color = '#f97316';
        }
      }

      // Pastikan JSON fields valid, kalau tidak jadikan fallback
      const validInput = extractJson(inputParams);
      inputParams = validInput || '{}';
      
      const validOutput = extractJson(outputTemplate);
      outputTemplate = validOutput || '{}';

      const nodePos = computedPositions[nodeName] || { x: 200, y: 100 };

      const insertRes = await client.query(
        `INSERT INTO flow_nodes 
         (flow_id, template_id, label, node_type, icon, color, pos_x, pos_y, input_params, validation_rules, process_logic, output_template, order_index)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
        [flowId, templateId, nodeName, nodeType, icon, color, nodePos.x, nodePos.y, inputParams, validationRules, processLogic, outputTemplate, orderIndex]
      );
      
      nodeMap[nodeName] = insertRes.rows[0].id;
      orderIndex++;
    }

    // 4. Create Connections antar Node
    for (const conn of parsedConnections) {
      const sourceId = nodeMap[conn.source];
      const targetId = nodeMap[conn.target];
      
      if (sourceId && targetId && sourceId !== targetId) {
        await client.query(
          'INSERT INTO flow_connections (flow_id, source_node_id, target_node_id, branch_label) VALUES ($1, $2, $3, $4)',
          [flowId, sourceId, targetId, conn.branchLabel || null]
        );
      }
    }

    await client.query('COMMIT');
    client.release();
    
    res.status(201).json({ id: flowId, name: flowName, message: 'Flow generated successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
