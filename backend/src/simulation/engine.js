const db = require('../db');

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

function evalCondition(expression, context) {
  if (!expression) return true;
  try {
    const keys = Object.keys(context);
    const vals = Object.values(context);
    const fn = new Function(...keys, `"use strict"; return Boolean(${expression});`);
    return fn(...vals);
  } catch {
    return false;
  }
}

/**
 * Normalize a branch label to a canonical group.
 * Returns 'true', 'false', or the original lowercase label.
 */
function normalizeBranchLabel(label) {
  const l = (label || '').toLowerCase().trim();
  const trueGroup  = ['ya', 'yes', 'true', 'ok', 'berhasil', 'valid', 'success',
                      'ada', 'ditemukan', 'tersedia', 'selesai', 'completed', 'found'];
  const falseGroup = ['tidak', 'no', 'false', 'gagal', 'invalid', 'error',
                      'kosong', 'skip', 'failed', 'not found', 'tidak ada', 'tidak tersedia'];
  if (trueGroup.includes(l)) return 'true';
  if (falseGroup.includes(l)) return 'false';
  return l;
}

/**
 * Determine which branch label to take based on node output values.
 *
 * Resolution priority:
 *  1. Explicit `_branch` key in output  → e.g. { "_branch": "Pickup" }
 *  2. String value in output that exactly matches a branch label (case-insensitive)
 *  3. Semantic boolean field  (is_*, has_*, *_valid, *_found, *_success, etc.)
 *  4. Any single boolean field in output
 *
 * Returns the matched label string, or null if undetermined.
 */
function resolveBranchFromOutput(output, availableLabels) {
  if (!output || typeof output !== 'object' || availableLabels.length === 0) return null;

  // 1. Explicit _branch key
  if (output._branch !== undefined) {
    const target = String(output._branch).toLowerCase().trim();
    for (const lbl of availableLabels) {
      if (lbl.toLowerCase().trim() === target || normalizeBranchLabel(lbl) === target) return lbl;
    }
  }

  // 2. String value in output that exactly matches a branch label
  for (const [, v] of Object.entries(output)) {
    if (typeof v === 'string') {
      const vLower = v.toLowerCase().trim();
      for (const lbl of availableLabels) {
        if (lbl.toLowerCase().trim() === vLower) return lbl;
      }
    }
  }

  // 3. Semantic boolean field (is_*, has_*, *_valid, *_found, *_success, etc.)
  const semanticPatterns = [
    /^is_/, /^has_/, /_valid$/, /_found$/, /_success$/, /_available$/,
    /_ready$/, /_completed$/, /_active$/, /_exist$/, /_exist$/,
  ];
  const semanticBools = Object.entries(output).filter(([k, v]) =>
    typeof v === 'boolean' && semanticPatterns.some((p) => p.test(k))
  );
  if (semanticBools.length > 0) {
    const boolVal = semanticBools[0][1];
    const targetGroup = boolVal ? 'true' : 'false';
    for (const lbl of availableLabels) {
      if (normalizeBranchLabel(lbl) === targetGroup) return lbl;
    }
  }

  // 4. Any single boolean field in output
  const boolFields = Object.entries(output).filter(([, v]) => typeof v === 'boolean');
  if (boolFields.length === 1) {
    const boolVal = boolFields[0][1];
    const targetGroup = boolVal ? 'true' : 'false';
    for (const lbl of availableLabels) {
      if (normalizeBranchLabel(lbl) === targetGroup) return lbl;
    }
  }

  // 5. Semantic array field (e.g. *_list, *_items, addresses, items, data, results, etc.)
  //    non-empty array → 'true' branch, empty array → 'false' branch
  const semanticArrayPatterns = [
    /^items$/, /^list$/, /^data$/, /^results$/, /^records$/,
    /_list$/, /_items$/, /_data$/, /_results$/, /^addresses$/,
  ];
  const semanticArrays = Object.entries(output).filter(([k, v]) =>
    Array.isArray(v) && semanticArrayPatterns.some((p) => p.test(k))
  );
  if (semanticArrays.length > 0) {
    const arrVal = semanticArrays[0][1];
    const targetGroup = arrVal.length > 0 ? 'true' : 'false';
    for (const lbl of availableLabels) {
      if (normalizeBranchLabel(lbl) === targetGroup) return lbl;
    }
  }

  // 6. Any single array field in output
  //    non-empty → 'true', empty → 'false'
  const arrayFields = Object.entries(output).filter(([, v]) => Array.isArray(v));
  if (arrayFields.length === 1) {
    const arrVal = arrayFields[0][1];
    const targetGroup = arrVal.length > 0 ? 'true' : 'false';
    for (const lbl of availableLabels) {
      if (normalizeBranchLabel(lbl) === targetGroup) return lbl;
    }
  }

  return null; // Cannot determine → caller will run all branches (safe fallback)
}

function generateOutput(node, context) {
  const template = node.output_template;
  if (!template || typeof template !== 'object') return {};
  const output = {};
  for (const [key, val] of Object.entries(template)) {
    if (val !== null && val !== undefined) {
      output[key] = val;
    }
  }
  return output;
}

const NODE_MESSAGES = {
  Process:    { running: 'Processing...', success: 'Process completed successfully', skipped: 'Skipped' },
  Validation: { running: 'Validating inputs...', success: 'Validation passed', skipped: 'Skipped' },
  Database:   { running: 'Executing query...', success: 'Query executed successfully', skipped: 'Skipped' },
  API:        { running: 'Calling external API...', success: 'API call successful', skipped: 'Skipped' },
  Logic:      { running: 'Evaluating business logic...', success: 'Logic evaluated', skipped: 'Skipped' },
  Finance:    { running: 'Processing financial transaction...', success: 'Transaction recorded', skipped: 'Skipped' },
  Decision:   { running: 'Evaluating condition...', success: 'Decision: branch taken', skipped: 'Skipped' },
  Start:      { running: 'Starting flow...', success: 'Flow started', skipped: 'Skipped' },
  End:        { running: 'Completing flow...', success: 'Flow completed', skipped: 'Skipped' },
  Loop:       { running: 'Running loop iteration...', success: 'Loop completed successfully', skipped: 'Skipped' },
};

function msg(nodeType, status) {
  return (NODE_MESSAGES[nodeType] || NODE_MESSAGES.Process)[status] || status;
}

async function runSimulation(simulationId, onUpdate) {
  const simRes = await db.query('SELECT * FROM simulations WHERE id = $1', [simulationId]);
  const sim = simRes.rows[0];
  if (!sim) throw new Error('Simulation not found');

  await db.query(
    'UPDATE simulations SET status=$1, started_at=NOW() WHERE id=$2',
    ['running', simulationId]
  );

  const nodesRes = await db.query(
    'SELECT * FROM flow_nodes WHERE flow_id = $1 ORDER BY order_index ASC, id ASC',
    [sim.flow_id]
  );
  const connsRes = await db.query(
    'SELECT * FROM flow_connections WHERE flow_id = $1',
    [sim.flow_id]
  );

  const nodes = nodesRes.rows;
  const connections = connsRes.rows;

  if (nodes.length === 0) {
    await db.query('UPDATE simulations SET status=$1, completed_at=NOW() WHERE id=$2', ['completed', simulationId]);
    onUpdate({ type: 'complete', simulationId });
    return;
  }

  // Build adjacency graph
  const outgoing = new Map(); // nodeId → [{targetId, label}]
  const incoming = new Map(); // nodeId → [sourceId]
  for (const n of nodes) { outgoing.set(n.id, []); incoming.set(n.id, []); }
  for (const c of connections) {
    const src = outgoing.get(c.source_node_id);
    const tgt = incoming.get(c.target_node_id);
    if (src) src.push({ targetId: c.target_node_id, label: c.branch_label });
    if (tgt) tgt.push(c.source_node_id);
  }

  const nodeMap       = new Map(nodes.map((n) => [n.id, n]));
  const executionCounts = new Map(); // nodeId → execution count (for infinite loop guard)
  const skippedSet    = new Set();   // nodes that are on a skipped branch
  const completedSet  = new Set();   // nodes that have successfully completed (prevents double-execution)
  const context       = { ...(sim.input_data || {}) };
  const startTime     = Date.now();

  /**
   * Recursively mark a branch as skipped.
   * Convergence nodes (multiple incoming edges) are NOT marked — they may still
   * be reachable from the non-skipped branch.
   */
  function markBranchSkipped(nodeId, execCounts, skipped, reason) {
    if (completedSet.has(nodeId) || execCounts.has(nodeId) || skipped.has(nodeId)) return;

    // Convergence node: has more than one parent → might still be reached via another branch
    const incomingSrcs = incoming.get(nodeId) || [];
    if (incomingSrcs.length > 1) return;

    skipped.add(nodeId);

    // Emit skipped status immediately so the UI updates
    const node = nodeMap.get(nodeId);
    if (node) {
      onUpdate({
        type: 'node_update', simulationId, nodeId,
        status: 'skipped', label: node.label, nodeType: node.node_type,
        message: reason || 'Skipped — branch not taken',
        inputData: null, outputData: null, duration: null,
      });
    }

    // Propagate recursively to downstream nodes
    for (const edge of outgoing.get(nodeId) || []) {
      markBranchSkipped(edge.targetId, execCounts, skipped, reason);
    }
  }

  /**
   * Execute a single node.
   *
   * @param {number}  nodeId
   * @param {object}  currentContext  - mutable shared execution context
   * @param {Map}     execCounts      - execution count per node (loop guard)
   * @param {Set}     skipped         - set of skipped node IDs
   * @param {Set}     localCompleted  - completed set for this execution scope
   *                                   (allows loop iterations to use isolated sets)
   */
  async function executeNode(nodeId, currentContext, execCounts, skipped, localCompleted = completedSet) {
    const node = nodeMap.get(nodeId);
    if (!node) return;

    // Convergence protection: don't re-execute nodes already completed in this scope
    if (localCompleted.has(nodeId)) return;

    // Skip nodes that were marked by markBranchSkipped (already emitted, just stop)
    if (skipped.has(nodeId)) {
      execCounts.set(nodeId, (execCounts.get(nodeId) || 0) + 1);
      return;
    }

    const count = execCounts.get(nodeId) || 0;
    if (count > 15) {
      onUpdate({
        type: 'node_update', simulationId, nodeId, status: 'error',
        label: node.label, nodeType: node.node_type,
        message: 'Error: Infinite loop detected (Max 15 executions)',
        inputData: null, outputData: null, duration: null,
      });
      return;
    }

    const nodeStart    = Date.now();
    const inputSnapshot = { ...currentContext };

    // ── Loop node ────────────────────────────────────────────────────────────
    if (node.node_type === 'Loop') {
      let loopArray  = null;
      let loopOverKey = 'items';
      let itemVar    = 'item';

      try {
        const inputParams = typeof node.input_params === 'string'
          ? JSON.parse(node.input_params)
          : (node.input_params || {});
        loopOverKey = inputParams.loop_over?.value || 'items';
        itemVar     = inputParams.item_var?.value  || 'item';

        if (Array.isArray(currentContext[loopOverKey])) {
          loopArray = currentContext[loopOverKey];
        } else if (inputParams.loop_array && Array.isArray(inputParams.loop_array.value)) {
          loopArray = inputParams.loop_array.value;
        } else if (typeof inputParams.loop_array?.value === 'string') {
          try {
            const parsed = JSON.parse(inputParams.loop_array.value);
            if (Array.isArray(parsed)) loopArray = parsed;
          } catch (_) {}
        }
      } catch (_) {}

      // Empty array → succeed and take 'next'
      if (!loopArray || !Array.isArray(loopArray) || loopArray.length === 0) {
        const loopOutput = { loop_completed: true };
        const message    = `Loop: Array '${loopOverKey}' is empty or not found`;
        onUpdate({
          type: 'node_update', simulationId, nodeId, status: 'success',
          label: node.label, nodeType: node.node_type,
          message, inputData: inputSnapshot, outputData: loopOutput, duration: 0,
        });
        await db.query(
          `INSERT INTO node_executions
            (simulation_id, flow_node_id, node_label, node_type, status, input_data, executed_at)
           VALUES ($1,$2,$3,$4,$5,$6,NOW())`,
          [simulationId, nodeId, node.label, node.node_type, 'running', JSON.stringify(inputSnapshot)]
        );
        await db.query(
          `UPDATE node_executions SET status=$1, output_data=$2, message=$3, duration_ms=$4
           WHERE simulation_id=$5 AND flow_node_id=$6`,
          ['success', JSON.stringify(loopOutput), message, 0, simulationId, nodeId]
        );
        execCounts.set(nodeId, count + 1);
        localCompleted.add(nodeId);
        const edges = outgoing.get(nodeId) || [];
        const nextTargets = edges.filter((e) => !e.label || e.label.toLowerCase() !== 'body').map((e) => e.targetId);
        await Promise.all(nextTargets.map((id) => executeNode(id, currentContext, execCounts, skipped, localCompleted)));
        return;
      }

      // Start loop
      await db.query(
        `INSERT INTO node_executions
          (simulation_id, flow_node_id, node_label, node_type, status, input_data, executed_at)
         VALUES ($1,$2,$3,$4,$5,$6,NOW())`,
        [simulationId, nodeId, node.label, node.node_type, 'running', JSON.stringify(inputSnapshot)]
      );

      let totalDuration = 0;
      let finalOutput   = {};
      const edges       = outgoing.get(nodeId) || [];
      const bodyTargets = edges.filter((e) =>  e.label && e.label.toLowerCase() === 'body').map((e) => e.targetId);
      const nextTargets = edges.filter((e) => !e.label || e.label.toLowerCase() !== 'body').map((e) => e.targetId);

      for (let i = 0; i < loopArray.length; i++) {
        const item        = loopArray[i];
        const iterContext = { ...currentContext, [itemVar]: item };

        onUpdate({
          type: 'node_update', simulationId, nodeId, status: 'running',
          label: node.label, nodeType: node.node_type,
          message: `Processing item ${i + 1}/${loopArray.length} in loop...`,
          inputData: { ...inputSnapshot, [itemVar]: item }, outputData: null, duration: null,
        });

        const processingMs = 500 + Math.floor(Math.random() * 500);
        await delay(processingMs);
        totalDuration += processingMs;

        // Each iteration gets its own isolated scope (execCounts, skipped, completed)
        const iterExecCounts = new Map(execCounts);
        const iterSkippedSet = new Set(skipped);
        const iterCompleted  = new Set(); // fresh scope per iteration — body nodes can re-run
        iterExecCounts.set(nodeId, (iterExecCounts.get(nodeId) || 0) + 1);

        if (bodyTargets.length > 0) {
          await Promise.all(
            bodyTargets.map((targetId) =>
              executeNode(targetId, iterContext, iterExecCounts, iterSkippedSet, iterCompleted)
            )
          );
        }

        // Aggregate body outputs back
        for (const [k, v] of Object.entries(iterContext)) {
          if (k !== itemVar && currentContext[k] !== v) {
            if (!finalOutput[k]) finalOutput[k] = [];
            finalOutput[k].push(v);
          }
        }
      }

      Object.assign(currentContext, finalOutput);
      currentContext.loop_completed = true;

      const duration = totalDuration;
      const message  = `Loop: Processed ${loopArray.length} items successfully`;

      await db.query(
        `UPDATE node_executions SET status=$1, output_data=$2, message=$3, duration_ms=$4
         WHERE simulation_id=$5 AND flow_node_id=$6`,
        ['success', JSON.stringify(finalOutput), message, duration, simulationId, nodeId]
      );
      execCounts.set(nodeId, count + 1);
      localCompleted.add(nodeId);

      onUpdate({
        type: 'node_update', simulationId, nodeId, status: 'success',
        label: node.label, nodeType: node.node_type,
        message, inputData: inputSnapshot, outputData: finalOutput, duration,
      });

      if (nextTargets.length > 0) {
        await Promise.all(
          nextTargets.map((targetId) => executeNode(targetId, currentContext, execCounts, skipped, localCompleted))
        );
      }
      return;
    }

    // ── Standard node ────────────────────────────────────────────────────────
    await db.query(
      `INSERT INTO node_executions
        (simulation_id, flow_node_id, node_label, node_type, status, input_data, executed_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW())`,
      [simulationId, nodeId, node.label, node.node_type, 'running', JSON.stringify(inputSnapshot)]
    );

    onUpdate({
      type: 'node_update', simulationId, nodeId, status: 'running',
      label: node.label, nodeType: node.node_type,
      message: msg(node.node_type, 'running'),
      inputData: inputSnapshot, outputData: null, duration: null,
    });

    const processingMs = 1000 + Math.floor(Math.random() * 1500);
    await delay(processingMs);

    const output  = generateOutput(node, currentContext);
    Object.assign(currentContext, output);

    const duration = Date.now() - nodeStart;
    const message  = msg(node.node_type, 'success');

    await db.query(
      `UPDATE node_executions SET status=$1, output_data=$2, message=$3, duration_ms=$4
       WHERE simulation_id=$5 AND flow_node_id=$6`,
      ['success', JSON.stringify(output), message, duration, simulationId, nodeId]
    );

    execCounts.set(nodeId, count + 1);
    localCompleted.add(nodeId);

    onUpdate({
      type: 'node_update', simulationId, nodeId, status: 'success',
      label: node.label, nodeType: node.node_type,
      message, inputData: inputSnapshot, outputData: output, duration,
    });

    await findAndRunNext(nodeId, node, currentContext, execCounts, skipped, output, localCompleted);
  }

  /**
   * After a node completes, determine which downstream nodes to execute.
   *
   * Branch resolution order:
   *  1. Decision node  → evalCondition() → 'true'/'false'
   *  2. Smart detection from nodeOutput → resolveBranchFromOutput()
   *  3. Fallback → run all downstream nodes
   */
  async function findAndRunNext(nodeId, node, currentContext, execCounts, skipped, nodeOutput, localCompleted = completedSet) {
    const edges = outgoing.get(nodeId) || [];
    if (edges.length === 0) return;

    const labeledEdges = edges.filter((e) => e.label);
    let activeEdgeTargets = [];

    if (labeledEdges.length === 0) {
      // No branch labels → run all
      activeEdgeTargets = edges.map((e) => e.targetId);

    } else if (node && node.node_type === 'Decision') {
      // Decision node: evaluate JavaScript condition expression
      const condResult = evalCondition(node.condition_expression, currentContext);
      const taken = condResult ? 'true' : 'false';

      for (const edge of edges) {
        const edgeLabel = (edge.label || 'true').toLowerCase();
        if (edgeLabel === taken) {
          activeEdgeTargets.push(edge.targetId);
        } else {
          markBranchSkipped(
            edge.targetId, execCounts, skipped,
            `Skipped — condition evaluated to ${taken}`
          );
        }
      }

    } else {
      // Smart branch detection: resolve from actual output values
      const availableLabels = labeledEdges.map((e) => e.label);
      const takenLabel = resolveBranchFromOutput(nodeOutput, availableLabels);

      if (takenLabel !== null) {
        for (const edge of edges) {
          if (!edge.label) {
            // Unlabeled edge → always runs
            activeEdgeTargets.push(edge.targetId);
          } else if (edge.label.toLowerCase().trim() === takenLabel.toLowerCase().trim()) {
            activeEdgeTargets.push(edge.targetId);
          } else {
            markBranchSkipped(
              edge.targetId, execCounts, skipped,
              `Skipped — branch "${takenLabel}" taken based on output`
            );
          }
        }
      } else {
        // Cannot determine from output → safe fallback: run all branches
        activeEdgeTargets = edges.map((e) => e.targetId);
      }
    }

    // Filter out nodes already skipped or completed in this scope
    const ready = activeEdgeTargets.filter(
      (targetId) => !skipped.has(targetId) && !localCompleted.has(targetId)
    );

    await Promise.all(ready.map((id) => executeNode(id, currentContext, execCounts, skipped, localCompleted)));
  }

  // ── Simulation kick-off ───────────────────────────────────────────────────

  // Emit 'waiting' for all nodes
  for (const node of nodes) {
    onUpdate({
      type: 'node_update', simulationId, nodeId: node.id, status: 'waiting',
      label: node.label, nodeType: node.node_type,
      message: 'Waiting...', inputData: null, outputData: null, duration: null,
    });
  }

  // Start execution from entry nodes (no incoming connections)
  const startNodes = nodes.filter((n) => (incoming.get(n.id) || []).length === 0);
  await Promise.all(startNodes.map((n) => executeNode(n.id, context, executionCounts, skippedSet, completedSet)));

  // Final cleanup: emit 'skipped' for any node in skippedSet that was never actually processed
  for (const node of nodes) {
    if (skippedSet.has(node.id) && !executionCounts.has(node.id)) {
      onUpdate({
        type: 'node_update', simulationId, nodeId: node.id, status: 'skipped',
        label: node.label, nodeType: node.node_type,
        message: 'Skipped — branch not taken',
        inputData: null, outputData: null, duration: null,
      });
    }
  }

  const totalDuration = Date.now() - startTime;
  await db.query(
    'UPDATE simulations SET status=$1, completed_at=NOW(), total_duration_ms=$2 WHERE id=$3',
    ['completed', totalDuration, simulationId]
  );

  onUpdate({ type: 'complete', simulationId, totalDuration });
}

module.exports = { runSimulation };
