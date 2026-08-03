/**
 * routes/flowGeneratorHelper.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared helper that takes a TechFlow DSL string and persists it as a flow
 * in the database. This is extracted from /api/flows/generate-text so both
 * the flows route and the AI route can reuse the same transaction logic.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const db = require('../db');

/**
 * Auto-layout node positions using topological sort (same as flows.js).
 */
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

  let roots = [];
  for (const nodeName of uniqueNodes.keys()) {
    if (nodeName.toLowerCase().includes('start')) roots.push(nodeName);
  }
  if (roots.length === 0) {
    for (const nodeName of uniqueNodes.keys()) {
      if (inDegree[nodeName] === 0) roots.push(nodeName);
    }
  }
  if (roots.length === 0) roots = [Array.from(uniqueNodes.keys())[0]];

  const ranks = {};
  for (const nodeName of uniqueNodes.keys()) ranks[nodeName] = 0;

  const visited = new Set();
  const recStack = new Set();

  function dfs(node, currentRank) {
    visited.add(node);
    recStack.add(node);
    ranks[node] = Math.max(ranks[node], currentRank);
    for (const neighbor of adj[node]) {
      if (recStack.has(neighbor)) continue;
      dfs(neighbor, currentRank + 1);
    }
    recStack.delete(node);
  }

  for (const root of roots) {
    visited.clear();
    recStack.clear();
    dfs(root, 0);
  }
  for (const nodeName of uniqueNodes.keys()) {
    if (!visited.has(nodeName)) {
      visited.clear();
      recStack.clear();
      dfs(nodeName, 0);
    }
  }

  const cols = {};
  for (const [nodeName, rank] of Object.entries(ranks)) {
    if (!cols[rank]) cols[rank] = [];
    cols[rank].push(nodeName);
  }

  const originalOrder = Array.from(uniqueNodes.keys());
  for (const rank of Object.keys(cols)) {
    cols[rank].sort((a, b) => originalOrder.indexOf(a) - originalOrder.indexOf(b));
  }

  const hSpacing = 200;
  const vSpacing = 130;
  const startX = 60;
  const middleY = 240;
  const positions = {};

  for (const [rankStr, nodesInCol] of Object.entries(cols)) {
    const col = parseInt(rankStr, 10);
    const N = nodesInCol.length;
    const totalHeight = (N - 1) * vSpacing;
    const startYForCol = middleY - totalHeight / 2;

    for (let i = 0; i < N; i++) {
      positions[nodesInCol[i]] = {
        x: startX + col * hSpacing,
        y: Math.round(startYForCol + i * vSpacing),
      };
    }
  }

  let minY = Infinity;
  for (const pos of Object.values(positions)) if (pos.y < minY) minY = pos.y;
  if (minY < 60) {
    const shift = 60 - minY;
    for (const pos of Object.values(positions)) pos.y += shift;
  }

  return positions;
}

/**
 * Parses TechFlow DSL text and creates a complete flow (nodes + connections)
 * inside a single DB transaction.
 *
 * @param {string} dslText   - TechFlow DSL format
 * @param {number|null} projectId
 * @returns {Promise<number>} The new flow ID
 */
async function createFlowFromDSL(dslText, projectId = null) {
  const client = await db.connect();

  try {
    let flowName = 'AI Generated Flow';
    let flowDesc = 'Auto-generated from AI code analysis';
    const uniqueNodes = new Map();
    const parsedConnections = [];

    const lines = dslText.split('\n');
    let currentNode = null;
    let currentProp = null;
    let inConnections = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      if (line.toLowerCase().startsWith('flow:')) {
        flowName = line.substring(5).trim();
      } else if (line.toLowerCase().startsWith('description:')) {
        flowDesc = line.substring(12).trim();
      } else if (line.toLowerCase() === 'connections' || line.toLowerCase().startsWith('connections:')) {
        inConnections = true;
        currentNode = null;
        currentProp = null;
      } else if (line.match(/^\[Node:(.+)\]/i)) {
        const nodeName = line.match(/^\[Node:(.+)\]/i)[1].trim();
        currentNode = nodeName;
        currentProp = null;
        if (!uniqueNodes.has(nodeName)) {
          uniqueNodes.set(nodeName, { name: nodeName, inputParams: '', validationRules: '', processLogic: '', outputTemplate: '' });
        }
      } else if (inConnections && line.includes('->')) {
        const labelMatch = line.match(/(.+?)\s*--(.+?)-->\s*(.+)/);
        if (labelMatch) {
          const source = labelMatch[1].trim();
          const branchLabel = labelMatch[2].trim();
          const target = labelMatch[3].trim();
          if (!uniqueNodes.has(source)) uniqueNodes.set(source, { name: source, inputParams: '', validationRules: '', processLogic: '', outputTemplate: '' });
          if (!uniqueNodes.has(target)) uniqueNodes.set(target, { name: target, inputParams: '', validationRules: '', processLogic: '', outputTemplate: '' });
          parsedConnections.push({ source, target, branchLabel });
        } else {
          const parts = line.split('->').map((p) => p.trim());
          if (parts.length >= 2) {
            const source = parts[0];
            const target = parts[1];
            if (!uniqueNodes.has(source)) uniqueNodes.set(source, { name: source, inputParams: '', validationRules: '', processLogic: '', outputTemplate: '' });
            if (!uniqueNodes.has(target)) uniqueNodes.set(target, { name: target, inputParams: '', validationRules: '', processLogic: '', outputTemplate: '' });
            parsedConnections.push({ source, target, branchLabel: null });
          }
        }
      } else if (currentNode) {
        const lowerLine = line.toLowerCase();
        if (lowerLine.startsWith('proses:') || lowerLine.startsWith('logic:') || lowerLine.startsWith('api:')) {
          currentProp = 'processLogic';
          uniqueNodes.get(currentNode).processLogic += line + '\n';
        } else if (lowerLine.startsWith('output:')) {
          currentProp = 'outputTemplate';
          uniqueNodes.get(currentNode).outputTemplate += line.substring(7).trim() + '\n';
        } else if (currentProp) {
          uniqueNodes.get(currentNode)[currentProp] += rawLine + '\n';
        }
      }
    }

    if (uniqueNodes.size === 0) throw new Error('No nodes found in DSL text');

    await client.query('BEGIN');

    // Create flow record
    const flowRes = await client.query(
      'INSERT INTO flows (name, description, status, project_id) VALUES ($1,$2,$3,$4) RETURNING id',
      [flowName, flowDesc, 'draft', projectId]
    );
    const flowId = flowRes.rows[0].id;

    // Compute positions
    const nodePositions = computeNodePositions(uniqueNodes, parsedConnections);
    const nodeMap = {};
    let orderIndex = 0;

    // Insert nodes
    for (const [nodeName, nodeConfig] of uniqueNodes.entries()) {
      // Determine node type from name conventions
      let nodeType = 'Process';
      let icon = '⚙';
      let color = '#3b82f6';

      const nameLower = nodeName.toLowerCase();
      if (nameLower.includes('start')) { nodeType = 'Start'; icon = '▶'; color = '#10b981'; }
      else if (nameLower.includes('end')) { nodeType = 'End'; icon = '■'; color = '#ef4444'; }
      else if (nameLower.startsWith('db:')) { nodeType = 'Database'; icon = '🗄'; color = '#8b5cf6'; }
      else if (nameLower.includes('api') || nameLower.includes('http')) { nodeType = 'API'; icon = '🌐'; color = '#f59e0b'; }
      else if (nameLower.includes('valid')) { nodeType = 'Validation'; icon = '✔'; color = '#10b981'; }
      else if (nameLower.includes('lib') || nameLower.includes('helper')) { nodeType = 'Process'; icon = '📦'; color = '#06b6d4'; }

      // Try to match existing template
      const tplRes = await client.query(
        'SELECT id, node_type, icon, color FROM node_templates WHERE name ILIKE $1 LIMIT 1',
        [`%${nodeName.replace('::', ' ')}%`]
      );
      if (tplRes.rows.length > 0) {
        const tpl = tplRes.rows[0];
        nodeType = tpl.node_type;
        icon = tpl.icon;
        color = tpl.color;
      }

      const pos = nodePositions[nodeName] || { x: 200, y: 100 };
      let outputTemplate = '{}';
      if (nodeConfig.outputTemplate && nodeConfig.outputTemplate.trim()) {
        try { JSON.parse(nodeConfig.outputTemplate.trim()); outputTemplate = nodeConfig.outputTemplate.trim(); }
        catch { outputTemplate = '{}'; }
      }

      const insertRes = await client.query(
        `INSERT INTO flow_nodes
           (flow_id, label, node_type, icon, color, pos_x, pos_y,
            process_logic, output_template, order_index)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [flowId, nodeName, nodeType, icon, color, pos.x, pos.y,
         nodeConfig.processLogic || '', outputTemplate, orderIndex++]
      );

      nodeMap[nodeName] = insertRes.rows[0].id;
    }

    // Insert connections
    for (const conn of parsedConnections) {
      const srcId = nodeMap[conn.source];
      const tgtId = nodeMap[conn.target];
      if (srcId && tgtId && srcId !== tgtId) {
        await client.query(
          'INSERT INTO flow_connections (flow_id, source_node_id, target_node_id, branch_label) VALUES ($1,$2,$3,$4)',
          [flowId, srcId, tgtId, conn.branchLabel || null]
        );
      }
    }

    await client.query('COMMIT');
    client.release();
    return flowId;
  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    throw err;
  }
}

module.exports = { createFlowFromDSL };
