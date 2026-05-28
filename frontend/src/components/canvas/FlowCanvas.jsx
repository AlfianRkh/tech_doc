import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import NodeShortcutsPanel from './NodeShortcutsPanel';
import NodeInspector from './NodeInspector';
import ExecutionLogs from './ExecutionLogs';
import Badge from '../shared/Badge';

const TYPE_COLOR = {
  Process: '#3b82f6', Validation: '#10b981', Database: '#8b5cf6',
  API: '#f59e0b', Logic: '#06b6d4', Finance: '#ec4899',
  Decision: '#ef4444', Start: '#10b981', End: '#ef4444', Custom: '#f97316', Loop: '#f97316',
};

const STATUS_COLOR = {
  success: '#10b981', running: '#3b82f6', waiting: '#5a7090',
  error: '#ef4444', skipped: '#3a4a5a',
};

const NODE_W = 90;
const NODE_H = 72;

function dist(p1, p2) {
  return Math.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2);
}

function getBestPorts(src, tgt) {
  const sOuts = [
    { x: src.pos_x + NODE_W / 2 + 8, y: src.pos_y, dir: 'top' },
    { x: src.pos_x + NODE_W / 2 + 8, y: src.pos_y + NODE_H, dir: 'bottom' },
    { x: src.pos_x, y: src.pos_y + NODE_H / 2 + 8, dir: 'left' },
    { x: src.pos_x + NODE_W, y: src.pos_y + NODE_H / 2 + 8, dir: 'right' }
  ];
  const tIns = [
    { x: tgt.pos_x + NODE_W / 2 - 8, y: tgt.pos_y, dir: 'top' },
    { x: tgt.pos_x + NODE_W / 2 - 8, y: tgt.pos_y + NODE_H, dir: 'bottom' },
    { x: tgt.pos_x, y: tgt.pos_y + NODE_H / 2 - 8, dir: 'left' },
    { x: tgt.pos_x + NODE_W, y: tgt.pos_y + NODE_H / 2 - 8, dir: 'right' }
  ];
  
  const pairs = [];
  for (const s of sOuts) {
    for (const t of tIns) {
      pairs.push({ s, t, dist: dist(s, t) });
    }
  }
  pairs.sort((a, b) => a.dist - b.dist);
  return pairs[0];
}

function dynamicConnectionPath(p1, p2) {
  let c1x = p1.x, c1y = p1.y;
  let c2x = p2.x, c2y = p2.y;
  const offset = 45;
  
  if (p1.dir === 'right') c1x += offset;
  else if (p1.dir === 'bottom') c1y += offset;
  else if (p1.dir === 'left') c1x -= offset;
  else if (p1.dir === 'top') c1y -= offset;
  
  if (p2.dir === 'left') c2x -= offset;
  else if (p2.dir === 'top') c2y -= offset;
  else if (p2.dir === 'right') c2x += offset;
  else if (p2.dir === 'bottom') c2y += offset;
  
  return `M${p1.x} ${p1.y} C${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
}

export default function FlowCanvas({ nodeTemplates }) {
  const { flowId } = useParams();
  const navigate = useNavigate();

  const [flow, setFlow] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [connections, setConnections] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [execLogs, setExecLogs] = useState([]);
  const [simStatus, setSimStatus] = useState('idle'); // idle | running | completed
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 60, y: 40 });
  const [shortcutsCollapsed, setShortcutsCollapsed] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [connectingLine, setConnectingLine] = useState(null); // {fromX,fromY,toX,toY}
  const [dataPopup, setDataPopup] = useState(null); // log entry
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);

  const canvasRef = useRef(null);
  const draggingRef = useRef(null);  // {nodeId, startX, startY, origX, origY}
  const panningRef = useRef(null);   // {startX, startY}
  const connectingRef = useRef(null); // {sourceId, fromX, fromY}
  const sseRef = useRef(null);

  // ── Load flow ───────────────────────────────────────────────
  const loadFlow = useCallback(async (id) => {
    setLoading(true);
    try {
      const data = await api.getFlow(id);
      setFlow(data.flow);
      setNodes(data.nodes.map((n) => ({ ...n, status: 'waiting', outputData: null, inputData: null })));
      setConnections(data.connections);
      if (data.nodes.length > 0) setSelectedNode(data.nodes[0]);
    } catch (err) {
      showToast('Failed to load flow: ' + err.message, 'error');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (flowId) loadFlow(flowId);
  }, [flowId, loadFlow]);

  // ── Toast helper ────────────────────────────────────────────
  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  // ── Simulation ──────────────────────────────────────────────
  async function runSimulation() {
    if (!flow) return;
    if (sseRef.current) sseRef.current.close();

    setSimStatus('running');
    setExecLogs([]);
    setNodes((prev) => prev.map((n) => ({ ...n, status: 'waiting', outputData: null, inputData: null, duration: null })));

    try {
      const sim = await api.createSimulation(flow.id);
      const sse = new EventSource(`/api/simulations/${sim.id}/stream`);

      sse.onmessage = (e) => {
        const event = JSON.parse(e.data);
        if (event.type === 'node_update') {
          setNodes((prev) => prev.map((n) =>
            n.id === event.nodeId
              ? { ...n, status: event.status, outputData: event.outputData, inputData: event.inputData, duration: event.duration }
              : n
          ));
          setExecLogs((prev) => [...prev, {
            time: new Date().toLocaleTimeString('id-ID'),
            nodeId: event.nodeId,
            nodeLabel: event.label,
            nodeType: event.nodeType,
            status: event.status,
            message: event.message,
            duration: event.duration,
            outputData: event.outputData,
            inputData: event.inputData,
          }]);
          // Auto-select running node
          if (event.status === 'running') {
            setNodes((prev) => {
              const n = prev.find((x) => x.id === event.nodeId);
              if (n) setSelectedNode(n);
              return prev;
            });
          }
        } else if (event.type === 'complete') {
          setSimStatus('completed');
          showToast(`Flow completed in ${event.totalDuration}ms`);
          sse.close();
        } else if (event.type === 'error') {
          setSimStatus('idle');
          showToast('Simulation error: ' + event.message, 'error');
          sse.close();
        }
      };
      sse.onerror = () => {
        setSimStatus('completed');
        sse.close();
      };
      sseRef.current = sse;
    } catch (err) {
      setSimStatus('idle');
      showToast('Failed to start simulation: ' + err.message, 'error');
    }
  }

  function stopSimulation() {
    sseRef.current?.close();
    setSimStatus('idle');
  }

  // ── Drag nodes ──────────────────────────────────────────────
  function handleNodeMouseDown(e, nodeId) {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (connectingRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    draggingRef.current = {
      nodeId,
      startX: (e.clientX - rect.left - offset.x) / zoom,
      startY: (e.clientY - rect.top - offset.y) / zoom,
      origX: node.pos_x,
      origY: node.pos_y,
    };
  }

  // ── Pan canvas ──────────────────────────────────────────────
  function handleCanvasMouseDown(e) {
    if (e.button !== 0) return;
    if (connectingRef.current || draggingRef.current) return;
    panningRef.current = {
      startX: e.clientX - offset.x,
      startY: e.clientY - offset.y,
    };
    setSelectedNode(null);
  }

  function handleMouseMove(e) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = (e.clientX - rect.left - offset.x) / zoom;
    const my = (e.clientY - rect.top - offset.y) / zoom;

    if (connectingRef.current) {
      setConnectingLine({
        fromX: connectingRef.current.fromX,
        fromY: connectingRef.current.fromY,
        dir: connectingRef.current.dir,
        toX: mx, toY: my,
      });
    }

    if (draggingRef.current) {
      const dx = mx - draggingRef.current.startX;
      const dy = my - draggingRef.current.startY;
      setNodes((prev) => prev.map((n) =>
        n.id === draggingRef.current.nodeId
          ? { ...n, pos_x: draggingRef.current.origX + dx, pos_y: draggingRef.current.origY + dy }
          : n
      ));
    }

    if (panningRef.current) {
      setOffset({
        x: e.clientX - panningRef.current.startX,
        y: e.clientY - panningRef.current.startY,
      });
    }
  }

  function handleMouseUp() {
    if (draggingRef.current) {
      const node = nodes.find((n) => n.id === draggingRef.current.nodeId);
      if (node) api.updateFlowNode(flow.id, node.id, { pos_x: node.pos_x, pos_y: node.pos_y }).catch(() => {});
      draggingRef.current = null;
    }
    if (panningRef.current) panningRef.current = null;
    if (connectingRef.current) {
      connectingRef.current = null;
      setConnectingLine(null);
    }
  }

  function handleWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    setZoom((z) => Math.max(0.3, Math.min(2.5, z + delta)));
  }

  // ── Connection port drag ─────────────────────────────────────
  function handlePortMouseDown(e, sourceId, fromX, fromY, dir = 'right') {
    e.stopPropagation();
    connectingRef.current = { sourceId, fromX, fromY, dir };
    setConnectingLine({ fromX, fromY, toX: fromX, toY: fromY, dir });
  }

  async function handleNodeMouseUp(e, targetId) {
    if (!connectingRef.current) return;
    e.stopPropagation();
    const { sourceId } = connectingRef.current;
    connectingRef.current = null;
    setConnectingLine(null);
    if (sourceId === targetId) return;

    // Check if connection already exists
    const exists = connections.find(
      (c) => c.source_node_id === sourceId && c.target_node_id === targetId
    );
    if (exists) return showToast('Connection already exists', 'error');

    // For Decision or Loop source, ask for branch label
    const sourceNode = nodes.find((n) => n.id === sourceId);
    let branchLabel = null;
    if (sourceNode?.node_type === 'Decision') {
      branchLabel = prompt('Branch label for this connection (true / false):');
      if (!branchLabel) return;
    } else if (sourceNode?.node_type === 'Loop') {
      branchLabel = prompt('Branch label for this connection (body / next):');
      if (!branchLabel) return;
    }

    try {
      const conn = await api.addConnection(flow.id, {
        source_node_id: sourceId,
        target_node_id: targetId,
        branch_label: branchLabel,
      });
      setConnections((prev) => [...prev, conn]);
      
      // Auto-fill target node input_params based on source node output_template
      let outSchema = {};
      try {
        outSchema = typeof sourceNode.output_template === 'string' 
          ? JSON.parse(sourceNode.output_template) 
          : (sourceNode.output_template || {});
      } catch(err) {}

      const targetNode = nodes.find(n => n.id === targetId);
      if (targetNode && Object.keys(outSchema).length > 0) {
        const newInputParams = {};
        for (const [key, val] of Object.entries(outSchema)) {
          let type = typeof val;
          if (Array.isArray(val)) type = 'array';
          else if (val === null) type = 'string';
          else if (type === 'number') type = 'numeric';
          
          newInputParams[key] = {
            desc: `Auto-mapped from ${sourceNode.label} output`,
            type: type,
            value: type === 'array' || type === 'object' ? JSON.stringify(val) : val,
            required: true
          };
        }
        
        let existingParams = {};
        try {
          existingParams = typeof targetNode.input_params === 'string'
            ? JSON.parse(targetNode.input_params)
            : (targetNode.input_params || {});
        } catch(err) {}

        const finalInputParams = { ...existingParams, ...newInputParams };
        
        setNodes(prev => prev.map(n => 
          n.id === targetId ? { ...n, input_params: finalInputParams } : n
        ));
        
        await api.updateFlowNode(flow.id, targetId, { input_params: finalInputParams });
        showToast('Connection created & inputs mapped');
      } else {
        showToast('Connection created');
      }
    } catch (err) {
      showToast('Connection failed: ' + err.message, 'error');
    }
  }

  async function deleteConnection(connId) {
    try {
      await api.deleteConnection(flow.id, connId);
      setConnections((prev) => prev.filter((c) => c.id !== connId));
    } catch (err) {
      showToast('Delete failed: ' + err.message, 'error');
    }
  }

  // ── Rename node ─────────────────────────────────────────────
  function startRename(node) {
    setEditingId(node.id);
    setEditLabel(node.label);
  }

  async function applyRename(nodeId) {
    if (editLabel.trim()) {
      setNodes((prev) => prev.map((n) => n.id === nodeId ? { ...n, label: editLabel } : n));
      await api.updateFlowNode(flow.id, nodeId, { label: editLabel }).catch(() => {});
    }
    setEditingId(null);
  }

  // ── Add node from shortcut ───────────────────────────────────
  async function addNodeFromTemplate(template) {
    if (!flow) return;
    // Place to right of last node
    const lastNode = [...nodes].sort((a, b) => b.pos_x - a.pos_x)[0];
    const pos_x = lastNode ? lastNode.pos_x + NODE_W + 40 : 200;
    const pos_y = 100;

    try {
      const newNode = await api.addFlowNode(flow.id, {
        template_id: template.id,
        label: template.name,
        node_type: template.node_type,
        icon: template.icon,
        color: template.color,
        pos_x, pos_y,
        input_params: template.default_input_params || {},
        validation_rules: template.default_validation || '',
        process_logic: template.default_process_logic || '',
        output_template: template.default_output_template || {},
      });
      setNodes((prev) => [...prev, { ...newNode, status: 'waiting', outputData: null, inputData: null }]);
      setSelectedNode(newNode);
      showToast(`Added "${template.name}"`);
    } catch (err) {
      showToast('Failed to add node: ' + err.message, 'error');
    }
  }

  async function deleteNode(nodeId) {
    if (!confirm('Delete this node? Its connections will also be removed.')) return;
    try {
      await api.deleteFlowNode(flow.id, nodeId);
      setNodes((prev) => prev.filter((n) => n.id !== nodeId));
      setConnections((prev) => prev.filter((c) => c.source_node_id !== nodeId && c.target_node_id !== nodeId));
      if (selectedNode?.id === nodeId) setSelectedNode(null);
    } catch (err) {
      showToast('Delete failed: ' + err.message, 'error');
    }
  }

  // ── Refresh after node config save ──────────────────────────
  async function handleNodeUpdated() {
    await loadFlow(flow.id);
    showToast('Node config saved');
  }

  // ── Render ──────────────────────────────────────────────────
  if (!flowId) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 12, color: 'var(--text3)',
      }}>
        <div style={{ fontSize: 48 }}>⬡</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text2)' }}>No flow selected</div>
        <button
          onClick={() => navigate('/flows')}
          style={{
            padding: '8px 20px', background: 'rgba(59,130,246,0.2)', color: '#3b82f6',
            border: '1px solid rgba(59,130,246,0.4)', borderRadius: 8, fontSize: 12,
          }}
        >Open Flows →</button>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>
        Loading flow...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '10px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'var(--bg2)', flexShrink: 0,
      }}>
        <button
          onClick={() => navigate('/flows')}
          style={{ background: 'transparent', color: 'var(--text3)', fontSize: 12, padding: '2px 6px' }}
        >← Flows</button>
        <span style={{ color: 'var(--text3)' }}>›</span>
        <span style={{ color: 'var(--text)', fontWeight: 600 }}>{flow?.name}</span>
        {flow && <Badge status={flow.status} />}
        <span style={{
          padding: '2px 8px', background: 'rgba(59,130,246,0.15)', color: '#3b82f6',
          borderRadius: 4, fontSize: 11, border: '1px solid rgba(59,130,246,0.3)',
        }}>{flow?.version}</span>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{nodes.length} nodes · {connections.length} connections</span>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Zoom */}
          <button onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))} style={{ padding: '4px 8px', background: 'transparent', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 5, fontSize: 12 }}>−</button>
          <span style={{ fontSize: 11, color: 'var(--text2)', minWidth: 46, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(2.5, z + 0.1))} style={{ padding: '4px 8px', background: 'transparent', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 5, fontSize: 12 }}>+</button>
          <button onClick={() => { setZoom(1); setOffset({ x: 60, y: 40 }); }} style={{ padding: '4px 10px', background: 'transparent', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 5, fontSize: 11 }}>Reset</button>

          {simStatus === 'running' ? (
            <button onClick={stopSimulation} style={{
              padding: '5px 14px', background: 'rgba(239,68,68,0.2)', color: '#ef4444',
              border: '1px solid rgba(239,68,68,0.4)', borderRadius: 6, fontSize: 11, fontWeight: 600,
            }}>⏹ Stop</button>
          ) : (
            <button onClick={runSimulation} style={{
              padding: '5px 14px', background: 'rgba(16,185,129,0.2)', color: '#10b981',
              border: '1px solid rgba(16,185,129,0.4)', borderRadius: 6, fontSize: 11, fontWeight: 600,
            }}>▶ Run Simulation</button>
          )}

          {simStatus === 'running' && (
            <span style={{
              fontSize: 11, background: 'rgba(59,130,246,0.12)', color: '#3b82f6',
              padding: '4px 10px', borderRadius: 20, border: '1px solid rgba(59,130,246,0.3)',
              animation: 'pulse 1.5s infinite',
            }}>⚡ Running...</span>
          )}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Shortcuts panel */}
        <NodeShortcutsPanel
          templates={nodeTemplates}
          onAddNode={addNodeFromTemplate}
          collapsed={shortcutsCollapsed}
          setCollapsed={setShortcutsCollapsed}
        />

        {/* Canvas area */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>

          {/* Toast */}
          {toast && (
            <div className="toast" style={{
              position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
              background: toast.type === 'error' ? 'rgba(239,68,68,0.9)' : 'rgba(16,185,129,0.9)',
              color: '#fff', padding: '6px 16px', borderRadius: 20,
              fontSize: 12, fontWeight: 600, zIndex: 100, pointerEvents: 'none',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            }}>{toast.msg}</div>
          )}

          {/* Canvas */}
          <div
            ref={canvasRef}
            style={{ flex: 1, overflow: 'hidden', background: 'var(--bg)', position: 'relative', cursor: panningRef.current ? 'grabbing' : 'default' }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            <div className="canvas-grid" />

            <div style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              position: 'absolute',
              top: 0, left: 0,
              width: 3000, height: 1800,
            }}>
              {/* SVG connections */}
              <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
                <defs>
                  <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="6" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#2a3a5a" />
                  </marker>
                  <marker id="arrowhead-success" markerWidth="8" markerHeight="6" refX="6" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#10b981" />
                  </marker>
                  <marker id="arrowhead-running" markerWidth="8" markerHeight="6" refX="6" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#3b82f6" />
                  </marker>
                </defs>

                {connections.map((conn) => {
                  const src = nodes.find((n) => n.id === conn.source_node_id);
                  const tgt = nodes.find((n) => n.id === conn.target_node_id);
                  if (!src || !tgt) return null;

                  const best = getBestPorts(src, tgt);

                  const srcStatus = src.status || 'waiting';
                  const col = srcStatus === 'success' ? '#10b981'
                    : srcStatus === 'running' ? '#3b82f6'
                    : '#2a3a5a';
                  const isAnimated = srcStatus === 'running';
                  const arrowId = srcStatus === 'success' ? 'arrowhead-success' : srcStatus === 'running' ? 'arrowhead-running' : 'arrowhead';

                  const midX = (best.s.x + best.t.x) / 2;
                  const midY = (best.s.y + best.t.y) / 2;

                  return (
                    <g key={conn.id} style={{ pointerEvents: 'all', cursor: 'pointer' }}
                      onClick={() => { if (confirm('Delete this connection?')) deleteConnection(conn.id); }}>
                      <path
                        d={dynamicConnectionPath(best.s, best.t)}
                        fill="none" stroke="transparent" strokeWidth={12}
                      />
                      <path
                        d={dynamicConnectionPath(best.s, best.t)}
                        fill="none" stroke={col} strokeWidth={srcStatus === 'running' ? 2 : 1.5}
                        strokeDasharray={srcStatus === 'waiting' || srcStatus === 'skipped' ? '5,4' : 'none'}
                        markerEnd={`url(#${arrowId})`}
                        style={isAnimated ? { animation: 'dash-flow 0.4s linear infinite', strokeDasharray: '6,4' } : {}}
                        strokeOpacity={srcStatus === 'skipped' ? 0.3 : 1}
                      />
                      {conn.branch_label && (
                        <text x={midX} y={midY - 6} textAnchor="middle" fontSize="10"
                          fill={conn.branch_label === 'true' ? '#10b981' : '#ef4444'}
                          style={{ fontFamily: 'var(--mono)', pointerEvents: 'none' }}>
                          {conn.branch_label}
                        </text>
                      )}
                      {srcStatus === 'success' && (
                        <circle cx={midX} cy={midY} r={3} fill={col} />
                      )}
                    </g>
                  );
                })}

                {/* Temp connection line while dragging */}
                {connectingLine && (
                  <path
                    d={dynamicConnectionPath(
                      { x: connectingLine.fromX, y: connectingLine.fromY, dir: connectingLine.dir },
                      { x: connectingLine.toX, y: connectingLine.toY, dir: connectingLine.toY > connectingLine.fromY ? 'top' : 'left' }
                    )}
                    fill="none" stroke="#3b82f6" strokeWidth={1.5}
                    strokeDasharray="6,3" opacity={0.8}
                  />
                )}
              </svg>

              {/* Nodes */}
              {nodes.map((node, idx) => {
                const isSelected = selectedNode?.id === node.id;
                const typeCol = TYPE_COLOR[node.node_type] || '#3b82f6';
                const sc = STATUS_COLOR[node.status] || '#5a7090';
                const isRunning = node.status === 'running';
                const isSkipped = node.status === 'skipped';

                return (
                  <div
                    key={node.id}
                    style={{ position: 'absolute', left: node.pos_x, top: node.pos_y }}
                    onMouseDown={(e) => { if (!connectingRef.current) handleNodeMouseDown(e, node.id); }}
                    onMouseUp={(e) => handleNodeMouseUp(e, node.id)}
                    onClick={(e) => { e.stopPropagation(); setSelectedNode(node); }}
                    onDoubleClick={(e) => { e.stopPropagation(); startRename(node); }}
                  >
                    {/* Pulse ring for running state */}
                    {isRunning && (
                      <div style={{
                        position: 'absolute', inset: -6,
                        borderRadius: 14, border: '2px solid #3b82f6',
                        animation: 'pulse-ring 1.2s ease-out infinite',
                        pointerEvents: 'none',
                      }} />
                    )}

                    <div style={{
                      width: NODE_W, minHeight: NODE_H,
                      background: isSkipped ? 'var(--bg3)' : 'var(--bg3)',
                      border: `1.5px solid ${isSelected ? typeCol : isRunning ? '#3b82f6' : '#1e2a3a'}`,
                      borderRadius: 10,
                      cursor: draggingRef.current?.nodeId === node.id ? 'grabbing' : 'pointer',
                      transition: 'box-shadow 0.15s, border-color 0.15s',
                      boxShadow: isSelected ? `0 0 14px ${typeCol}44` : isRunning ? '0 0 12px rgba(59,130,246,0.4)' : '0 2px 8px rgba(0,0,0,0.3)',
                      position: 'relative',
                      opacity: isSkipped ? 0.35 : 1,
                      padding: '8px 10px 6px',
                      userSelect: 'none',
                    }}>
                      {/* Step badge */}
                      {idx > 0 && idx < nodes.length - 1 && (
                        <div style={{
                          position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)',
                          width: 17, height: 17, borderRadius: '50%', background: sc,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, fontWeight: 700, color: '#000', border: '2px solid var(--bg)',
                        }}>{idx}</div>
                      )}

                      {/* Status dot */}
                      {node.status && node.status !== 'waiting' && (
                        <div style={{
                          position: 'absolute', top: -5, right: -5,
                          width: 13, height: 13, borderRadius: '50%', background: sc,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 8, border: '2px solid var(--bg)',
                        }}>
                          {node.status === 'success' ? '✓' : node.status === 'running' ? '●' : node.status === 'error' ? '!' : ''}
                        </div>
                      )}

                      {/* Icon */}
                      <div style={{ fontSize: 18, textAlign: 'center', marginBottom: 2 }}>{node.icon}</div>

                      {/* Label — editable */}
                      {editingId === node.id ? (
                        <input
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          onBlur={() => applyRename(node.id)}
                          onKeyDown={(e) => { if (e.key === 'Enter') applyRename(node.id); if (e.key === 'Escape') setEditingId(null); }}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            width: 72, fontSize: 10, textAlign: 'center',
                            padding: '2px 4px', background: 'var(--bg4)',
                            border: `1px solid ${typeCol}`, borderRadius: 3, color: 'var(--text)',
                          }}
                        />
                      ) : (
                        <div style={{
                          fontSize: 10, fontWeight: 600, textAlign: 'center',
                          color: isSkipped ? 'var(--text3)' : node.status === 'waiting' ? 'var(--text3)' : 'var(--text)',
                          maxWidth: NODE_W - 20, wordBreak: 'break-word', lineHeight: 1.3,
                        }}>{node.label}</div>
                      )}

                      {/* Duration */}
                      {node.duration && (
                        <div style={{ fontSize: 9, textAlign: 'center', color: 'var(--text3)', marginTop: 2 }}>
                          {node.duration}ms
                        </div>
                      )}
                    </div>

                    {/* --- TOP PORTS --- */}
                    {/* Top In */}
                    <div style={{
                      position: 'absolute', left: NODE_W / 2 - 8, top: 0,
                      width: 14, height: 14, borderRadius: '50%',
                      background: 'var(--bg4)', border: `2px solid ${typeCol}`,
                      pointerEvents: 'none', transform: 'translate(-50%, -50%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 8, fontWeight: 800, color: typeCol,
                    }}>I</div>
                    {/* Top Out */}
                    <div title="Drag to connect"
                      onMouseDown={(e) => handlePortMouseDown(e, node.id, node.pos_x + NODE_W / 2 + 8, node.pos_y, 'top')}
                      style={{
                        position: 'absolute', left: NODE_W / 2 + 8, top: 0,
                        width: 14, height: 14, borderRadius: '50%',
                        background: typeCol, border: '2px solid var(--bg3)', cursor: 'crosshair', zIndex: 10,
                        transform: 'translate(-50%, -50%)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 8, fontWeight: 800, color: '#fff', transition: 'transform 0.1s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.4)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)'}
                    >O</div>

                    {/* --- BOTTOM PORTS --- */}
                    {/* Bottom In */}
                    <div style={{
                      position: 'absolute', left: NODE_W / 2 - 8, top: NODE_H,
                      width: 14, height: 14, borderRadius: '50%',
                      background: 'var(--bg4)', border: `2px solid ${typeCol}`,
                      pointerEvents: 'none', transform: 'translate(-50%, -50%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 8, fontWeight: 800, color: typeCol,
                    }}>I</div>
                    {/* Bottom Out */}
                    <div title="Drag to connect"
                      onMouseDown={(e) => handlePortMouseDown(e, node.id, node.pos_x + NODE_W / 2 + 8, node.pos_y + NODE_H, 'bottom')}
                      style={{
                        position: 'absolute', left: NODE_W / 2 + 8, top: NODE_H,
                        width: 14, height: 14, borderRadius: '50%',
                        background: typeCol, border: '2px solid var(--bg3)', cursor: 'crosshair', zIndex: 10,
                        transform: 'translate(-50%, -50%)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 8, fontWeight: 800, color: '#fff', transition: 'transform 0.1s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.4)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)'}
                    >O</div>

                    {/* --- LEFT PORTS --- */}
                    {/* Left In */}
                    <div style={{
                      position: 'absolute', left: 0, top: NODE_H / 2 - 8,
                      width: 14, height: 14, borderRadius: '50%',
                      background: 'var(--bg4)', border: `2px solid ${typeCol}`,
                      pointerEvents: 'none', transform: 'translate(-50%, -50%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 8, fontWeight: 800, color: typeCol,
                    }}>I</div>
                    {/* Left Out */}
                    <div title="Drag to connect"
                      onMouseDown={(e) => handlePortMouseDown(e, node.id, node.pos_x, node.pos_y + NODE_H / 2 + 8, 'left')}
                      style={{
                        position: 'absolute', left: 0, top: NODE_H / 2 + 8,
                        width: 14, height: 14, borderRadius: '50%',
                        background: typeCol, border: '2px solid var(--bg3)', cursor: 'crosshair', zIndex: 10,
                        transform: 'translate(-50%, -50%)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 8, fontWeight: 800, color: '#fff', transition: 'transform 0.1s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.4)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)'}
                    >O</div>

                    {/* --- RIGHT PORTS --- */}
                    {/* Right In */}
                    <div style={{
                      position: 'absolute', left: NODE_W, top: NODE_H / 2 - 8,
                      width: 14, height: 14, borderRadius: '50%',
                      background: 'var(--bg4)', border: `2px solid ${typeCol}`,
                      pointerEvents: 'none', transform: 'translate(-50%, -50%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 8, fontWeight: 800, color: typeCol,
                    }}>I</div>
                    {/* Right Out */}
                    <div title="Drag to connect"
                      onMouseDown={(e) => handlePortMouseDown(e, node.id, node.pos_x + NODE_W, node.pos_y + NODE_H / 2 + 8, 'right')}
                      style={{
                        position: 'absolute', left: NODE_W, top: NODE_H / 2 + 8,
                        width: 14, height: 14, borderRadius: '50%',
                        background: typeCol, border: '2px solid var(--bg3)', cursor: 'crosshair', zIndex: 10,
                        transform: 'translate(-50%, -50%)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 8, fontWeight: 800, color: '#fff', transition: 'transform 0.1s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.4)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)'}
                    >O</div>

                    {/* Delete button (on hover) */}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteNode(node.id); }}
                      style={{
                        position: 'absolute', top: -8, left: -8,
                        width: 16, height: 16, borderRadius: '50%',
                        background: 'rgba(239,68,68,0.8)', color: '#fff',
                        fontSize: 10, display: 'none',
                        alignItems: 'center', justifyContent: 'center',
                        border: '1px solid rgba(239,68,68,0.5)',
                      }}
                      className="node-delete-btn"
                    >×</button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Data popup */}
          {dataPopup && (
            <div style={{
              position: 'absolute', top: 60, right: 340, zIndex: 50,
              background: '#0f1a2a', border: '1px solid #1e3a5f', borderRadius: 10,
              padding: '12px 14px', minWidth: 240, maxWidth: 360,
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)' }}>{dataPopup.nodeLabel}</span>
                  <span style={{ marginLeft: 8 }}><Badge status={dataPopup.status} /></span>
                </div>
                <button onClick={() => setDataPopup(null)} style={{ background: 'transparent', color: 'var(--text3)', fontSize: 16 }}>×</button>
              </div>
              {dataPopup.inputData && (
                <>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4, letterSpacing: '0.06em' }}>INPUT</div>
                  <pre style={{
                    fontSize: 11, fontFamily: 'var(--mono)', color: '#f59e0b',
                    lineHeight: 1.5, marginBottom: 8, maxHeight: 120, overflow: 'auto',
                  }}>{JSON.stringify(dataPopup.inputData, null, 2)}</pre>
                </>
              )}
              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4, letterSpacing: '0.06em' }}>OUTPUT</div>
              <pre style={{
                fontSize: 11, fontFamily: 'var(--mono)', color: '#10b981',
                lineHeight: 1.5, maxHeight: 180, overflow: 'auto',
              }}>{JSON.stringify(dataPopup.outputData, null, 2)}</pre>
            </div>
          )}

          {/* Execution Logs */}
          <ExecutionLogs
            logs={execLogs}
            onViewData={(log) => setDataPopup(log)}
          />
        </div>

        {/* Node Inspector */}
        <NodeInspector
          node={selectedNode ? nodes.find((n) => n.id === selectedNode.id) || selectedNode : null}
          flowId={flow?.id}
          execLogs={execLogs}
          onNodeUpdated={handleNodeUpdated}
        />
      </div>
    </div>
  );
}
