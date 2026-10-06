import React, { useState, useEffect, useRef } from 'react';
import { useChat } from './hooks/useChat';
import { api } from './api/client';
import {
  MessageSquare,
  UploadCloud,
  BookOpen,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Send,
  Sparkles,
  FileText,
  BrainCircuit,
} from './components/Icons';
import appLogo from './assets/main.png';

export default function App() {
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'ingest' | 'quizzes'

  // Chat hook
  const {
    messages,
    isLoading: chatLoading,
    error: chatError,
    sendMessage,
    clearHistory,
    clearError,
    retryLastMessage,
  } = useChat();

  const [inputQuery, setInputQuery] = useState('');
  const [expandedSource, setExpandedSource] = useState(null);
  const chatBottomRef = useRef(null);

  // Ingest state
  const [documents, setDocuments] = useState([]);
  const [docLoading, setDocLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null); // { type: 'success'|'error'|'uploading', message: string }
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Quiz state
  const [quizTopic, setQuizTopic] = useState('');
  const [numQuestions, setNumQuestions] = useState(5);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState(null);
  const [quizData, setQuizData] = useState(null);
  const [userAnswers, setUserAnswers] = useState({}); // { [questionId]: selectedOption }

  // Auto-scroll chat
  useEffect(() => {
    if (activeTab === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, chatLoading, activeTab]);

  // Load documents on mount or tab change to ingest
  const fetchDocuments = async () => {
    try {
      setDocLoading(true);
      const res = await api.listDocuments();
      setDocuments(res.documents || []);
    } catch (e) {
      // Ignore or display
    } finally {
      setDocLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [activeTab]);

  // Handlers for Chat
  const handleSend = (e) => {
    e?.preventDefault();
    if (!inputQuery.trim() || chatLoading) return;
    sendMessage(inputQuery);
    setInputQuery('');
  };

  const handleSuggestion = (prompt) => {
    sendMessage(prompt);
  };

  // Handlers for Ingestion
  const handleFileUpload = async (file) => {
    if (!file) return;

    // Check file size (25MB limit)
    if (file.size > 25 * 1024 * 1024) {
      setUploadStatus({
        type: 'error',
        message: 'File exceeds 25MB maximum allowed limit.',
      });
      return;
    }

    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'txt', 'md', 'markdown'].includes(ext)) {
      setUploadStatus({
        type: 'error',
        message: 'Unsupported format. Only .pdf, .txt, and .md files are supported.',
      });
      return;
    }

    try {
      setUploadStatus({
        type: 'uploading',
        message: `Uploading and indexing "${file.name}" into ChromaDB vector store...`,
      });
      const res = await api.uploadDocument(file);
      setUploadStatus({
        type: 'success',
        message: `Indexed "${res.filename}" into ${res.total_chunks} vector chunks!`,
      });
      fetchDocuments();
    } catch (err) {
      setUploadStatus({
        type: 'error',
        message: err.message || 'Upload failed. Please try again.',
      });
    }
  };

  const handleDeleteDoc = async (docId, filename) => {
    if (!window.confirm(`Delete "${filename}" and its vector chunks from knowledge base?`)) return;
    try {
      await api.deleteDocument(docId);
      fetchDocuments();
    } catch (err) {
      alert(`Error deleting document: ${err.message}`);
    }
  };

  // Handlers for Quizzes
  const handleGenerateQuiz = async (e) => {
    e?.preventDefault();
    if (!quizTopic.trim() || quizLoading) return;

    setQuizLoading(true);
    setQuizError(null);
    setQuizData(null);
    setUserAnswers({});

    try {
      const res = await api.generateQuiz(quizTopic.trim(), numQuestions);
      setQuizData(res);
    } catch (err) {
      setQuizError(err.message || 'Failed to generate quiz. Try another topic or check server connection.');
    } finally {
      setQuizLoading(false);
    }
  };

  const handleSelectAnswer = (qId, option) => {
    if (userAnswers[qId] !== undefined) return; // Answered already
    setUserAnswers((prev) => ({ ...prev, [qId]: option }));
  };

  // Helper to render markdown-like text
  const renderFormattedText = (text) => {
    if (!text) return null;

    // Simple robust paragraph and code formatting
    const lines = text.split('\n');
    return lines.map((line, i) => {
      // Heading
      if (line.startsWith('### ')) {
        return <h3 key={i} style={{ fontSize: '1.15rem', margin: '14px 0 6px', color: '#fff' }}>{line.replace('### ', '')}</h3>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={i} style={{ fontSize: '1.25rem', margin: '16px 0 8px', color: '#fff' }}>{line.replace('## ', '')}</h2>;
      }
      if (line.startsWith('# ')) {
        return <h1 key={i} style={{ fontSize: '1.4rem', margin: '18px 0 10px', color: '#fff' }}>{line.replace('# ', '')}</h1>;
      }
      // Bullet list
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        return (
          <li key={i} style={{ marginLeft: '20px', marginBottom: '4px' }}>
            {line.trim().substring(2)}
          </li>
        );
      }
      // Numbered list
      const numMatch = line.trim().match(/^(\d+)\.\s+(.*)/);
      if (numMatch) {
        return (
          <div key={i} style={{ marginLeft: '12px', marginBottom: '6px' }}>
            <span style={{ fontWeight: 600, color: 'var(--accent-light)' }}>{numMatch[1]}. </span>
            <span>{numMatch[2]}</span>
          </div>
        );
      }
      // Empty line
      if (!line.trim()) {
        return <div key={i} style={{ height: '8px' }} />;
      }
      return <p key={i} style={{ marginBottom: '8px' }}>{line}</p>;
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', maxWidth: '1400px', margin: '0 auto', padding: '16px' }}>
      {/* Top Header / Navigation Bar */}
      <header
        className="glass-card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 24px',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(56, 189, 248, 0.25)',
              backgroundColor: '#0f172a',
              border: '1px solid rgba(56, 189, 248, 0.3)',
            }}
          >
            <img
              src={appLogo}
              alt="App Icon"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Lecta AI</h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Full-Stack RAG System &bull; Semantic Notes &amp; Adaptive Quizzes</p>
          </div>
        </div>

        {/* View Tabs */}
        <nav style={{ display: 'flex', gap: '8px', background: 'rgba(0, 0, 0, 0.3)', padding: '4px', borderRadius: '12px' }}>
          <button
            onClick={() => setActiveTab('chat')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 18px',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.9rem',
              background: activeTab === 'chat' ? 'var(--accent)' : 'transparent',
              color: activeTab === 'chat' ? '#ffffff' : 'var(--text-secondary)',
            }}
          >
            <MessageSquare size={17} />
            Chat &amp; Tutor
          </button>

          <button
            onClick={() => setActiveTab('ingest')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 18px',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.9rem',
              background: activeTab === 'ingest' ? 'var(--accent)' : 'transparent',
              color: activeTab === 'ingest' ? '#ffffff' : 'var(--text-secondary)',
            }}
          >
            <UploadCloud size={17} />
            Ingest Notes {documents.length > 0 && `(${documents.length})`}
          </button>

          <button
            onClick={() => setActiveTab('quizzes')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 18px',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.9rem',
              background: activeTab === 'quizzes' ? 'var(--accent)' : 'transparent',
              color: activeTab === 'quizzes' ? '#ffffff' : 'var(--text-secondary)',
            }}
          >
            <BookOpen size={17} />
            Quizzes
          </button>
        </nav>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {/* ==================================================================== */}
        {/* TAB 1: Chat & Tutor */}
        {/* ==================================================================== */}
        {activeTab === 'chat' && (
          <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Chat Sub-header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 20px',
                borderBottom: '1px solid var(--border-color)',
                background: 'rgba(0, 0, 0, 0.2)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} color="var(--accent-light)" />
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Active Dialogue Session</span>
              </div>
              <button onClick={clearHistory} className="btn-secondary" style={{ fontSize: '0.82rem', padding: '5px 12px' }}>
                <RefreshCw size={14} /> Clear History
              </button>
            </div>

            {/* Error Banner Recovery */}
            {chatError && (
              <div
                style={{
                  background: 'var(--danger-bg)',
                  borderBottom: '1px solid var(--danger)',
                  padding: '10px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  color: '#fca5a5',
                  fontSize: '0.88rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={18} color="var(--danger)" />
                  <span>{chatError}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={retryLastMessage} style={{ background: 'var(--danger)', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem' }}>
                    Retry
                  </button>
                  <button onClick={clearError} style={{ background: 'transparent', color: '#fca5a5', padding: '4px 8px' }}>
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* Messages Scroll View */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isUser ? 'flex-end' : 'flex-start',
                      width: '100%',
                    }}
                  >
                    <div
                      style={{
                        maxWidth: '82%',
                        padding: '14px 18px',
                        borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        background: isUser ? 'var(--accent-gradient)' : 'rgba(255, 255, 255, 0.05)',
                        border: isUser ? 'none' : '1px solid var(--border-color)',
                        color: '#ffffff',
                        boxShadow: isUser ? '0 4px 14px rgba(99, 102, 241, 0.25)' : 'none',
                      }}
                    >
                      <div className="markdown-body">{renderFormattedText(msg.content)}</div>

                      {/* Source Citation Chips */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                            Grounding Sources &amp; Citations:
                          </span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {msg.sources.map((src, sIdx) => {
                              const scorePct = Math.round(src.score * 100);
                              return (
                                <button
                                  key={sIdx}
                                  onClick={() => setExpandedSource(src)}
                                  style={{
                                    background: 'rgba(99, 102, 241, 0.2)',
                                    border: '1px solid rgba(99, 102, 241, 0.4)',
                                    color: '#c7d2fe',
                                    borderRadius: '6px',
                                    padding: '3px 8px',
                                    fontSize: '0.75rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                  }}
                                  title="Click to view grounding excerpt"
                                >
                                  <FileText size={12} />
                                  <span>{src.filename}</span>
                                  <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: '4px', padding: '1px 4px', fontSize: '0.7rem', fontWeight: 700 }}>
                                    {scorePct}%
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Loading Indicator */}
              {chatLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                  <div className="spinner" style={{ animation: 'spin 1s linear infinite' }}>
                    <RefreshCw size={16} />
                  </div>
                  <span>Academic Tutor is analyzing notes and formulating response...</span>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Quick Prompt Suggestions */}
            <div
              style={{
                padding: '8px 20px',
                borderTop: '1px solid var(--border-color)',
                background: 'rgba(0, 0, 0, 0.15)',
                display: 'flex',
                gap: '8px',
                overflowX: 'auto',
              }}
            >
              {[
                'Summarize the core concepts in my uploaded notes',
                'Explain the most challenging topic simply with an analogy',
                'Identify key definitions and formulas',
                'What are potential exam questions based on these materials?',
              ].map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestion(suggestion)}
                  disabled={chatLoading}
                  style={{
                    whiteSpace: 'nowrap',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                    borderRadius: '20px',
                    padding: '5px 12px',
                    fontSize: '0.78rem',
                  }}
                >
                  &ldquo;{suggestion}&rdquo;
                </button>
              ))}
            </div>

            {/* Chat Input Bar */}
            <form
              onSubmit={handleSend}
              style={{
                display: 'flex',
                gap: '10px',
                padding: '14px 20px',
                borderTop: '1px solid var(--border-color)',
                background: 'rgba(0, 0, 0, 0.3)',
              }}
            >
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="Ask any question about your course materials or study concepts..."
                disabled={chatLoading}
                style={{
                  flex: 1,
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  color: '#ffffff',
                  fontSize: '0.95rem',
                  outline: 'none',
                }}
              />
              <button type="submit" disabled={!inputQuery.trim() || chatLoading} className="btn-primary">
                <Send size={18} />
                <span>Send</span>
              </button>
            </form>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 2: Ingest Notes */}
        {/* ==================================================================== */}
        {activeTab === 'ingest' && (
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', overflowY: 'auto' }}>
            {/* Left Column: Drag & Drop Zone */}
            <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '8px' }}>Upload Study Materials</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                Upload .pdf, .txt, or .md files up to 25MB. Files are extracted, parsed, token-chunked (500 tokens), and vectorized into ChromaDB.
              </p>

              {/* Drag and Drop Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  flex: 1,
                  minHeight: '220px',
                  border: `2px dashed ${isDragging ? 'var(--accent)' : 'rgba(255, 255, 255, 0.2)'}`,
                  background: isDragging ? 'rgba(99, 102, 241, 0.1)' : 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: '24px',
                  textAlign: 'center',
                  transition: 'all 0.2s ease',
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                  accept=".pdf,.txt,.md"
                  style={{ display: 'none' }}
                />
                <div
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: 'rgba(99, 102, 241, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '16px',
                  }}
                >
                  <UploadCloud size={30} color="var(--accent-light)" />
                </div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '6px' }}>Drag &amp; Drop study file here</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>or click to browse your computer</p>
                <span style={{ marginTop: '12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Supported: PDF, TXT, Markdown (Max 25MB)</span>
              </div>

              {/* Upload Status Feedback */}
              {uploadStatus && (
                <div
                  style={{
                    marginTop: '16px',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    fontSize: '0.88rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    background:
                      uploadStatus.type === 'success'
                        ? 'var(--success-bg)'
                        : uploadStatus.type === 'error'
                        ? 'var(--danger-bg)'
                        : 'rgba(99, 102, 241, 0.15)',
                    color:
                      uploadStatus.type === 'success'
                        ? '#34d399'
                        : uploadStatus.type === 'error'
                        ? '#fca5a5'
                        : '#c7d2fe',
                    border: `1px solid ${
                      uploadStatus.type === 'success'
                        ? 'var(--success)'
                        : uploadStatus.type === 'error'
                        ? 'var(--danger)'
                        : 'var(--accent)'
                    }`,
                  }}
                >
                  {uploadStatus.type === 'success' && <CheckCircle2 size={18} />}
                  {uploadStatus.type === 'error' && <XCircle size={18} />}
                  {uploadStatus.type === 'uploading' && <RefreshCw size={18} className="spinner" />}
                  <span>{uploadStatus.message}</span>
                </div>
              )}
            </div>

            {/* Right Column: Active Knowledge Base Document Manager */}
            <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Active Knowledge Base</h2>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    {documents.length} document{documents.length !== 1 ? 's' : ''} indexed for this session
                  </p>
                </div>
                <button onClick={fetchDocuments} className="btn-secondary" style={{ fontSize: '0.8rem', padding: '4px 10px' }}>
                  <RefreshCw size={14} /> Refresh
                </button>
              </div>

              {docLoading && (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  Loading knowledge base records...
                </div>
              )}

              {!docLoading && documents.length === 0 && (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '40px',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                  }}
                >
                  <FileText size={40} />
                  <p style={{ marginTop: '12px', fontSize: '0.9rem' }}>No documents ingested in this session yet.</p>
                  <span style={{ fontSize: '0.8rem' }}>Upload your first lecture slide or note to get started!</span>
                </div>
              )}

              {!docLoading && documents.length > 0 && (
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {documents.map((doc) => (
                    <div
                      key={doc.doc_id}
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        padding: '12px 16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '8px',
                            background: 'rgba(99, 102, 241, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <FileText size={18} color="var(--accent-light)" />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {doc.filename}
                          </p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {doc.chunk_count} vector chunk{doc.chunk_count !== 1 ? 's' : ''} &bull; ID: {doc.doc_id.substring(0, 8)}...
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteDoc(doc.doc_id, doc.filename)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          color: '#f87171',
                          borderRadius: '8px',
                          padding: '6px 10px',
                        }}
                        title="Delete document"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 3: Quizzes */}
        {/* ==================================================================== */}
        {activeTab === 'quizzes' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
            {/* Quiz Configuration Panel */}
            <div className="glass-card" style={{ padding: '20px' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '6px' }}>Interactive Quiz Generator</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Test your mastery! The AI retrieves relevant chunks from your notes and synthesizes rigorous multiple-choice questions with instant feedback.
              </p>

              <form onSubmit={handleGenerateQuiz} style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={quizTopic}
                  onChange={(e) => setQuizTopic(e.target.value)}
                  placeholder="Enter a topic or chapter name (e.g., Photosynthesis, QuickSort, Machine Learning)..."
                  disabled={quizLoading}
                  style={{
                    flex: 1,
                    minWidth: '280px',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                />

                {/* Question Count Selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Questions:</span>
                  {[3, 5, 10].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setNumQuestions(num)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '8px',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        background: numQuestions === num ? 'var(--accent)' : 'rgba(255, 255, 255, 0.05)',
                        color: numQuestions === num ? '#fff' : 'var(--text-secondary)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      {num}
                    </button>
                  ))}
                </div>

                <button type="submit" disabled={!quizTopic.trim() || quizLoading} className="btn-primary">
                  <Sparkles size={16} />
                  <span>{quizLoading ? 'Generating Quiz...' : 'Generate Quiz'}</span>
                </button>
              </form>
            </div>

            {/* Error Message */}
            {quizError && (
              <div
                style={{
                  background: 'var(--danger-bg)',
                  border: '1px solid var(--danger)',
                  padding: '14px',
                  borderRadius: '12px',
                  color: '#fca5a5',
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <AlertCircle size={20} color="var(--danger)" />
                <span>{quizError}</span>
              </div>
            )}

            {/* Quiz Content Cards */}
            {quizData && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 16px',
                    background: 'rgba(99, 102, 241, 0.1)',
                    borderRadius: '10px',
                    border: '1px solid rgba(99, 102, 241, 0.25)',
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Topic: {quizData.topic}</span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Progress: {Object.keys(userAnswers).length} / {quizData.questions.length} answered
                  </span>
                </div>

                {quizData.questions.map((q, idx) => {
                  const selected = userAnswers[q.id];
                  const hasAnswered = selected !== undefined;
                  const isCorrect = selected === q.correct_answer;

                  return (
                    <div key={q.id} className="glass-card" style={{ padding: '20px' }}>
                      <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                        <span
                          style={{
                            background: 'rgba(255, 255, 255, 0.1)',
                            borderRadius: '6px',
                            padding: '2px 8px',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            height: 'fit-content',
                          }}
                        >
                          Q{idx + 1}
                        </span>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#fff' }}>{q.question}</h3>
                      </div>

                      {/* Options */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                        {q.options.map((opt, oIdx) => {
                          let optBg = 'rgba(255, 255, 255, 0.04)';
                          let optBorder = 'var(--border-color)';
                          let optColor = 'var(--text-primary)';

                          if (hasAnswered) {
                            if (opt === q.correct_answer) {
                              optBg = 'var(--success-bg)';
                              optBorder = 'var(--success)';
                              optColor = '#34d399';
                            } else if (opt === selected) {
                              optBg = 'var(--danger-bg)';
                              optBorder = 'var(--danger)';
                              optColor = '#f87171';
                            }
                          }

                          return (
                            <button
                              key={oIdx}
                              onClick={() => handleSelectAnswer(q.id, opt)}
                              disabled={hasAnswered}
                              style={{
                                background: optBg,
                                border: `1px solid ${optBorder}`,
                                color: optColor,
                                borderRadius: '10px',
                                padding: '12px 16px',
                                textAlign: 'left',
                                fontSize: '0.88rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                cursor: hasAnswered ? 'default' : 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <span style={{ fontWeight: 700, opacity: 0.7 }}>
                                {String.fromCharCode(65 + oIdx)}.
                              </span>
                              <span>{opt}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Explanation Breakdown */}
                      {hasAnswered && (
                        <div
                          style={{
                            padding: '12px 16px',
                            borderRadius: '10px',
                            background: isCorrect ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                            borderLeft: `4px solid ${isCorrect ? 'var(--success)' : 'var(--danger)'}`,
                            fontSize: '0.85rem',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, marginBottom: '4px' }}>
                            {isCorrect ? (
                              <>
                                <CheckCircle2 size={16} color="var(--success)" />
                                <span style={{ color: 'var(--success)' }}>Correct!</span>
                              </>
                            ) : (
                              <>
                                <XCircle size={16} color="var(--danger)" />
                                <span style={{ color: 'var(--danger)' }}>Incorrect</span>
                              </>
                            )}
                          </div>
                          <p style={{ color: 'var(--text-secondary)' }}>{q.explanation}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Grounding Source Snippet Modal */}
      {expandedSource && (
        <div
          onClick={() => setExpandedSource(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: '20px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass-card"
            style={{ width: '100%', maxWidth: '600px', padding: '24px', background: '#0f172a' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={20} color="var(--accent-light)" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{expandedSource.filename}</h3>
              </div>
              <button onClick={() => setExpandedSource(null)} style={{ background: 'transparent', color: 'var(--text-secondary)' }}>
                <XCircle size={20} />
              </button>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              Relevance Score: {Math.round(expandedSource.score * 100)}% &bull; Chunk Index: {expandedSource.chunk_index}
            </div>
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '14px',
                fontSize: '0.88rem',
                lineHeight: 1.6,
                maxHeight: '300px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                color: '#e2e8f0',
              }}
            >
              {expandedSource.content}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

