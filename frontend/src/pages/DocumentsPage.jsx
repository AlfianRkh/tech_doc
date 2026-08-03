/**
 * DocumentsPage.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * AI Code Documentation Agent — Main Page
 * Layout: Left panel (doc list) | Right panel (input + result tabs)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { aiApi } from '../api/aiClient';
import { useProject } from '../context/ProjectContext';
import CallGraphViewer from '../components/docs/CallGraphViewer';

const LANGUAGES = [
  { value: 'php',    label: 'PHP',    icon: '🐘' },
  { value: 'golang', label: 'Go',     icon: '🐹' },
];

const STATUS_CFG = {
  pending:   { color: '#6b7280', bg: 'rgba(107,114,128,0.12)', label: 'Pending',   icon: '⏳' },
  analyzing: { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  label: 'Analyzing', icon: '◌' },
  done:      { color: '#10b981', bg: 'rgba(16,185,129,0.12)',  label: 'Done',      icon: '✅' },
  failed:    { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   label: 'Failed',    icon: '✕' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.pending;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px',
      borderRadius: 4, fontSize: 10, fontWeight: 700, color: cfg.color,
      background: cfg.bg, border: `1px solid ${cfg.color}30`,
    }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function OllamaStatusBadge({ health }) {
  if (!health) return (
    <span style={{ fontSize: 10, color: '#6b7280' }}>Checking Ollama…</span>
  );
  const ok = health.status === 'ollama_ok';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
      <div style={{
        width: 7, height: 7, borderRadius: '50%',
        background: ok ? '#10b981' : '#ef4444',
        boxShadow: ok ? '0 0 6px #10b981' : '0 0 6px #ef4444',
      }} />
      <span style={{ color: ok ? '#10b981' : '#ef4444', fontWeight: 600 }}>
        {ok ? `Ollama OK — ${health.default_model}` : 'Ollama Offline'}
      </span>
      {ok && health.available_models?.length > 0 && (
        <span style={{ color: '#6b7280' }}>
          ({health.available_models.length} model{health.available_models.length !== 1 ? 's' : ''})
        </span>
      )}
    </div>
  );
}

/**
 * Simple Markdown renderer — converts bold, tables, code, headings to styled HTML.
 * Lightweight, no external dependency.
 */
function MarkdownView({ content }) {
  if (!content) return (
    <div style={{ color: 'var(--text3)', padding: 24, textAlign: 'center', fontSize: 13 }}>
      No documentation yet.
    </div>
  );

  const lines = content.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // H1
    if (line.startsWith('# ')) {
      elements.push(<h1 key={i} style={{ fontSize: 18, fontWeight: 700, color: '#e8edf4', margin: '0 0 8px', paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>{line.slice(2)}</h1>);
    }
    // H2
    else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} style={{ fontSize: 14, fontWeight: 700, color: '#93c5fd', margin: '16px 0 6px' }}>{line.slice(3)}</h2>);
    }
    // H3
    else if (line.startsWith('### ')) {
      elements.push(<h3 key={i} style={{ fontSize: 12, fontWeight: 700, color: '#c4b5fd', margin: '12px 0 4px' }}>{line.slice(4)}</h3>);
    }
    // HR
    else if (line === '---') {
      elements.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '12px 0' }} />);
    }
    // Code block
    else if (line.startsWith('```')) {
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre key={i} style={{
          background: '#090d16', border: '1px solid var(--border)', borderRadius: 6,
          padding: 10, fontSize: 11, fontFamily: 'monospace', color: '#38bdf8',
          overflowX: 'auto', whiteSpace: 'pre', margin: '6px 0',
        }}>
          {codeLines.join('\n')}
        </pre>
      );
    }
    // Table
    else if (line.startsWith('|')) {
      const tableLines = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      elements.push(
        <div key={i} style={{ overflowX: 'auto', margin: '6px 0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <tbody>
              {tableLines
                .filter((tl) => !tl.match(/^\|[-| ]+\|$/))
                .map((tl, ti) => (
                  <tr key={ti} style={{ background: ti === 0 ? 'rgba(59,130,246,0.07)' : 'transparent' }}>
                    {tl.split('|').filter((_, ci) => ci > 0 && ci < tl.split('|').length - 1).map((cell, ci) => (
                      <td key={ci} style={{
                        padding: '4px 10px', border: '1px solid var(--border)',
                        color: ti === 0 ? '#93c5fd' : 'var(--text2)',
                        fontWeight: ti === 0 ? 700 : 400,
                        fontFamily: cell.trim().startsWith('`') ? 'monospace' : 'inherit',
                      }}>
                        {cell.trim().replace(/`([^`]+)`/g, (_, m) => m)}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }
    // Bullet
    else if (line.startsWith('- ')) {
      elements.push(
        <div key={i} style={{ display: 'flex', gap: 6, margin: '2px 0', fontSize: 12, color: 'var(--text2)' }}>
          <span style={{ color: '#3b82f6', flexShrink: 0 }}>•</span>
          <span dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/`([^`]+)`/g, '<code style="background:#1e293b;padding:1px 4px;border-radius:3px;font-family:monospace;font-size:10px;color:#38bdf8">$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>') }} />
        </div>
      );
    }
    // Bold key-value pairs like **Label:** value
    else if (line.includes('**')) {
      elements.push(
        <p key={i} style={{ margin: '2px 0', fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}
          dangerouslySetInnerHTML={{ __html: line.replace(/`([^`]+)`/g, '<code style="background:#1e293b;padding:1px 4px;border-radius:3px;font-family:monospace;font-size:10px;color:#38bdf8">$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong style="color:var(--text1)">$1</strong>') }}
        />
      );
    }
    // Normal paragraph
    else if (line.trim()) {
      elements.push(
        <p key={i} style={{ margin: '2px 0', fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}
          dangerouslySetInnerHTML={{ __html: line.replace(/`([^`]+)`/g, '<code style="background:#1e293b;padding:1px 4px;border-radius:3px;font-family:monospace;font-size:10px;color:#38bdf8">$1</code>') }}
        />
      );
    }
    else {
      elements.push(<div key={i} style={{ height: 4 }} />);
    }

    i++;
  }

  return <div style={{ lineHeight: 1.7 }}>{elements}</div>;
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const navigate = useNavigate();
  const { activeProject } = useProject();

  // Ollama health
  const [health, setHealth] = useState(null);

  // Saved documents list
  const [docs, setDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState(null);

  // Input form
  const [language, setLanguage] = useState('php');
  const [title, setTitle] = useState('');
  const [sourceCode, setSourceCode] = useState('');
  const [model, setModel] = useState('deepseek-coder:6.7b');

  // Analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [streamTokens, setStreamTokens] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [activeTab, setActiveTab] = useState('markdown');
  const [generatingFlow, setGeneratingFlow] = useState(false);

  // Enkripsi status
  const [encReady, setEncReady] = useState(false); // true jika RSA key sudah di-cache

  const esRef = useRef(null);
  const tokenScrollRef = useRef(null);

  // ── Load health + docs on mount, pre-warm enkripsi
  useEffect(() => {
    aiApi.checkHealth().then(setHealth).catch(() => setHealth({ status: 'ollama_unavailable', available_models: [] }));
    loadDocs();
    // Pre-fetch RSA public key agar request pertama tidak ada delay
    aiApi.encryptionReady().then(setEncReady).catch(() => setEncReady(false));
  }, []);

  useEffect(() => {
    loadDocs();
  }, [activeProject?.id]);

  function loadDocs() {
    setDocsLoading(true);
    aiApi.listDocuments({ project_id: activeProject?.id })
      .then(setDocs)
      .catch(console.error)
      .finally(() => setDocsLoading(false));
  }

  // ── Open saved doc
  async function openDoc(id) {
    setSelectedDocId(id);
    try {
      const doc = await aiApi.getDocument(id);
      setSourceCode(doc.source_code || '');
      setTitle(doc.title || '');
      setLanguage(doc.language || 'php');
      setModel(doc.ai_model || 'deepseek-coder:6.7b');
      if (doc.analysis_result && doc.analysis_result.functions) {
        setAnalysisResult({
          analysis: doc.analysis_result,
          markdown: doc.doc_markdown,
          docId: doc.id,
        });
        setActiveTab('markdown');
      } else {
        setAnalysisResult(null);
      }
    } catch (err) {
      alert('Failed to load document: ' + err.message);
    }
  }

  // ── Delete doc
  async function deleteDoc(id, e) {
    e.stopPropagation();
    if (!confirm('Delete this analysis?')) return;
    await aiApi.deleteDocument(id);
    if (selectedDocId === id) {
      setSelectedDocId(null);
      setAnalysisResult(null);
    }
    loadDocs();
  }

  // ── Parse only (no AI)
  async function handleParseOnly() {
    if (!sourceCode.trim()) return alert('Paste source code first.');
    setAnalyzing(true);
    setStreamTokens('');
    try {
      const res = await aiApi.parseOnly({ source_code: sourceCode, language });
      setAnalysisResult({ analysis: res.analysis, markdown: res.markdown, dsl: res.dsl, docId: null });
      setActiveTab('markdown');
    } catch (err) {
      alert('Parse error: ' + err.message);
    } finally {
      setAnalyzing(false);
    }
  }

  // ── AI Analyze
  async function handleAnalyze() {
    if (!sourceCode.trim()) return alert('Paste source code first.');
    if (esRef.current) esRef.current.close();

    setAnalyzing(true);
    setStreamTokens('');
    setAnalysisResult(null);

    try {
      const { id } = await aiApi.analyze({
        source_code: sourceCode,
        language,
        title: title || 'Untitled Analysis',
        project_id: activeProject?.id || null,
        model,
        save_to_db: true,
      });

      // Open SSE stream
      esRef.current = aiApi.streamAnalysis(id, {
        onToken: (token) => {
          setStreamTokens((prev) => prev + token);
          if (tokenScrollRef.current) {
            tokenScrollRef.current.scrollTop = tokenScrollRef.current.scrollHeight;
          }
        },
        onComplete: (event) => {
          setAnalyzing(false);
          setStreamTokens('');
          setAnalysisResult({
            analysis: event.analysis,
            markdown: event.markdown,
            dsl: event.dsl,
            docId: event.docId,
          });
          setActiveTab('markdown');
          loadDocs();
        },
        onError: (msg) => {
          setAnalyzing(false);
          alert('Analysis failed: ' + msg);
          loadDocs();
        },
      });
    } catch (err) {
      setAnalyzing(false);
      alert('Failed to start analysis: ' + err.message);
    }
  }

  // ── Generate flow from completed analysis (Parse Only atau AI Analyze)
  async function handleGenerateFlow() {
    if (!analysisResult?.analysis) return;
    setGeneratingFlow(true);
    try {
      let flow_id;
      if (analysisResult.docId) {
        // Hasil AI Analyze — sudah tersimpan di DB, gunakan endpoint doc
        ({ flow_id } = await aiApi.generateFlow(analysisResult.docId));
      } else {
        // Hasil Parse Only — kirim analysis langsung ke endpoint direct
        ({ flow_id } = await aiApi.generateFlowDirect({
          analysis: analysisResult.analysis,
          dsl: analysisResult.dsl,
          title: title || analysisResult.analysis.title || 'Generated Flow',
          project_id: activeProject?.id || null,
        }));
      }
      navigate(`/canvas/${flow_id}`);
    } catch (err) {
      alert('Gagal generate flow: ' + err.message);
    } finally {
      setGeneratingFlow(false);
    }
  }

  const tabs = [
    { id: 'markdown', label: '📄 Markdown Doc' },
    { id: 'callgraph', label: '📊 Call Graph' },
    { id: 'json', label: '💾 Raw JSON' },
  ];

  // ── Styles
  const s = {
    container: { display: 'flex', height: '100%', overflow: 'hidden', fontFamily: 'var(--font)' },
    leftPanel: { width: 230, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--bg2)' },
    rightPanel: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    topBar: { height: 46, padding: '0 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg2)', flexShrink: 0, gap: 12 },
    contentArea: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    inputSection: { padding: 16, borderBottom: '1px solid var(--border)', background: 'var(--bg1)', flexShrink: 0 },
    resultSection: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    btn: (primary) => ({
      background: primary ? 'linear-gradient(135deg,#3b82f6,#8b5cf6)' : 'var(--bg3)',
      border: primary ? 'none' : '1px solid var(--border)',
      borderRadius: 6, padding: '7px 14px', fontSize: 12, fontWeight: 600,
      color: primary ? '#fff' : 'var(--text2)', cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', gap: 6,
      opacity: analyzing ? 0.6 : 1,
    }),
    input: { width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', fontSize: 12, color: 'var(--text1)', outline: 'none', boxSizing: 'border-box' },
    select: { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: 'var(--text1)', outline: 'none', cursor: 'pointer' },
    tabBtn: (active) => ({
      padding: '7px 14px', fontSize: 11, fontWeight: active ? 700 : 400,
      color: active ? '#3b82f6' : 'var(--text3)', background: 'none', border: 'none',
      borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
      cursor: 'pointer', whiteSpace: 'nowrap',
    }),
  };

  return (
    <div style={s.container}>
      {/* ── LEFT: Document List ── */}
      <div style={s.leftPanel}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', letterSpacing: '0.06em' }}>SAVED ANALYSES</span>
          <button onClick={loadDocs} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13 }} title="Refresh">↻</button>
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {docsLoading && (
            <div style={{ textAlign: 'center', padding: 20, fontSize: 11, color: 'var(--text3)' }}>Loading…</div>
          )}
          {!docsLoading && docs.length === 0 && (
            <div style={{ textAlign: 'center', padding: 24, fontSize: 11, color: 'var(--text3)' }}>
              No analyses yet.<br />Paste code and click Analyze.
            </div>
          )}
          {docs.map((doc) => (
            <div
              key={doc.id}
              onClick={() => openDoc(doc.id)}
              style={{
                padding: '10px 14px', cursor: 'pointer',
                background: selectedDocId === doc.id ? 'rgba(59,130,246,0.1)' : 'transparent',
                borderLeft: selectedDocId === doc.id ? '2px solid #3b82f6' : '2px solid transparent',
                borderBottom: '1px solid var(--border)',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4, marginBottom: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {doc.title || 'Untitled'}
                </div>
                <button
                  onClick={(e) => deleteDoc(doc.id, e)}
                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12, flexShrink: 0, opacity: 0.6 }}
                  title="Delete"
                >
                  ✕
                </button>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 9, color: '#6b7280', background: 'rgba(107,114,128,0.12)', padding: '1px 5px', borderRadius: 3 }}>
                  {LANGUAGES.find((l) => l.value === doc.language)?.icon} {doc.language?.toUpperCase()}
                </span>
                <StatusBadge status={doc.status} />
              </div>
              {doc.markdown_preview && (
                <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {doc.markdown_preview.replace(/[#*`|]/g, '').trim()}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* New Analysis Button */}
        <div style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => { setSelectedDocId(null); setAnalysisResult(null); setSourceCode(''); setTitle(''); setStreamTokens(''); }}
            style={{ ...s.btn(true), width: '100%', justifyContent: 'center' }}
          >
            + New Analysis
          </button>
        </div>
      </div>

      {/* ── RIGHT: Main Content ── */}
      <div style={s.rightPanel}>
        {/* Top bar */}
        <div style={s.topBar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text1)' }}>🤖 AI Docs Agent</span>
            <OllamaStatusBadge health={health} />
            {/* Enkripsi badge */}
            <span title={encReady ? 'Source code dienkripsi RSA-OAEP+AES-256-GCM sebelum dikirim' : 'Menginisialisasi enkripsi…'} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
              background: encReady ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)',
              color: encReady ? '#10b981' : '#64748b',
              border: `1px solid ${encReady ? 'rgba(16,185,129,0.3)' : 'rgba(100,116,139,0.3)'}`,
              cursor: 'default',
            }}>
              {encReady ? '🔒 E2E Encrypted' : '🔓 Initializing…'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {analysisResult?.analysis && (
              <button
                onClick={handleGenerateFlow}
                disabled={generatingFlow}
                style={{
                  background: 'linear-gradient(135deg,#10b981,#3b82f6)',
                  border: 'none', borderRadius: 6, padding: '7px 16px',
                  fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  opacity: generatingFlow ? 0.6 : 1,
                  boxShadow: '0 0 12px rgba(59,130,246,0.3)',
                  transition: 'all 0.2s',
                }}
              >
                {generatingFlow
                  ? <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>◌</span> Generating…</>
                  : <>🔀 Generate to Canvas</>
                }
              </button>
            )}
          </div>
        </div>

        <div style={s.contentArea}>
          {/* ── INPUT SECTION ── */}
          <div style={s.inputSection}>
            {/* Row 1: controls */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
              <input
                style={{ ...s.input, maxWidth: 260 }}
                placeholder="Title / Feature Name"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <select style={s.select} value={language} onChange={(e) => setLanguage(e.target.value)}>
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>{l.icon} {l.label}</option>
                ))}
              </select>
              <select style={s.select} value={model} onChange={(e) => setModel(e.target.value)}>
                {(health?.available_models?.length > 0 ? health.available_models : [model]).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <button onClick={handleAnalyze} disabled={analyzing || !sourceCode.trim()} style={s.btn(true)}>
                {analyzing ? '◌ Analyzing…' : '🤖 Analyze with AI'}
              </button>
              <button onClick={handleParseOnly} disabled={analyzing || !sourceCode.trim()} style={s.btn(false)}>
                ⚡ Parse Only
              </button>
            </div>

            {/* Code textarea */}
            <textarea
              value={sourceCode}
              onChange={(e) => setSourceCode(e.target.value)}
              placeholder={`Paste your ${language === 'golang' ? 'Go' : 'PHP'} source code here...\n\nContoh: paste isi controller, model, library, atau function yang ingin didokumentasikan.`}
              spellCheck={false}
              style={{
                width: '100%', height: 180, background: '#090d16',
                border: '1px solid var(--border)', borderRadius: 8,
                padding: 12, fontSize: 12, fontFamily: 'monospace',
                color: '#e2e8f0', outline: 'none', resize: 'vertical',
                boxSizing: 'border-box', lineHeight: 1.6,
              }}
            />

            {/* Live token stream while analyzing */}
            {analyzing && streamTokens && (
              <div
                ref={tokenScrollRef}
                style={{
                  marginTop: 8, padding: 10, background: '#090d16',
                  border: '1px solid rgba(59,130,246,0.2)', borderRadius: 6,
                  fontSize: 10, fontFamily: 'monospace', color: '#38bdf8',
                  maxHeight: 90, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                }}
              >
                {streamTokens}
                <span style={{ animation: 'blink 1s step-start infinite', color: '#60a5fa' }}>▌</span>
              </div>
            )}
            {analyzing && !streamTokens && (
              <div style={{ marginTop: 8, fontSize: 11, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>◌</span>
                Sending code to deepseek-coder model…
              </div>
            )}
          </div>

          {/* ── RESULT TABS ── */}
          {analysisResult ? (
            <div style={s.resultSection}>
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', flexShrink: 0, overflow: 'auto' }}>
                {tabs.map((tab) => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={s.tabBtn(activeTab === tab.id)}>
                    {tab.label}
                  </button>
                ))}
                {analysisResult.analysis && (
                  <div style={{ marginLeft: 'auto', padding: '0 12px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 10, color: 'var(--text3)', flexShrink: 0 }}>
                    <span>🔵 {analysisResult.analysis.functions?.length || 0} functions</span>
                    <span>🔴 {analysisResult.analysis.functions?.reduce((a, f) => a + (f.db_operations?.length || 0), 0) || 0} DB ops</span>
                    <span>🟡 {analysisResult.analysis.functions?.reduce((a, f) => a + (f.api_calls?.length || 0), 0) || 0} API calls</span>
                  </div>
                )}
              </div>

              <div style={{ flex: 1, overflow: 'auto', padding: activeTab === 'callgraph' ? 0 : 16 }}>
                {/* TAB: Markdown */}
                {activeTab === 'markdown' && (
                  <MarkdownView content={analysisResult.markdown} />
                )}

                {/* TAB: Call Graph */}
                {activeTab === 'callgraph' && (
                  <div style={{ height: '100%' }}>
                    <CallGraphViewer analysis={analysisResult.analysis} />
                  </div>
                )}

                {/* TAB: Raw JSON */}
                {activeTab === 'json' && (
                  <pre style={{
                    fontSize: 11, fontFamily: 'monospace', color: '#38bdf8',
                    background: '#090d16', padding: 14, borderRadius: 8,
                    border: '1px solid var(--border)', whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}>
                    {JSON.stringify(analysisResult.analysis, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', gap: 12 }}>
              <div style={{ fontSize: 48 }}>🤖</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text2)' }}>AI Documentation Agent</div>
              <div style={{ fontSize: 12, maxWidth: 380, textAlign: 'center', lineHeight: 1.7 }}>
                Paste source code PHP atau Go di atas, lalu klik <strong style={{ color: '#3b82f6' }}>Analyze with AI</strong> untuk menghasilkan dokumentasi otomatis lengkap dengan Call Graph dan alur tiap function.
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11 }}>
                <div style={{ textAlign: 'center', color: 'var(--text3)' }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>📄</div>Markdown Doc
                </div>
                <div style={{ textAlign: 'center', color: 'var(--text3)' }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>📊</div>Call Graph
                </div>
                <div style={{ textAlign: 'center', color: 'var(--text3)' }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>🔀</div>Flow Diagram
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      `}</style>
    </div>
  );
}
