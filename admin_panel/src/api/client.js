/**
 * Structured error class representing backend API exceptions.
 */
export class APIError extends Error {
  constructor(message, status, errorType = null, errors = null) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.errorType = errorType;
    this.errors = errors;
  }
}

/**
 * Retrieve or generate persistent session identifier for tenant isolation.
 */
export function getSessionId() {
  const STORAGE_KEY = 'study_assistant_session_id';
  let sessionId = localStorage.getItem(STORAGE_KEY);
  if (!sessionId) {
    sessionId = 'session_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
    localStorage.setItem(STORAGE_KEY, sessionId);
  }
  return sessionId;
}

const API_BASE = '';

/**
 * Centralized request helper with error parsing and standard headers.
 */
async function apiRequest(endpoint, options = {}) {
  const sessionId = getSessionId();
  const headers = {
    'X-Session-ID': sessionId,
    'Authorization': 'Bearer mock_jwt_student_token',
    ...(options.headers || {}),
  };

  const config = {
    ...options,
    headers,
  };

  let response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, config);
  } catch (netErr) {
    throw new APIError('Network connection failed. Please check if the backend is running.', 0, 'NetworkError');
  }

  let data;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = { detail: await response.text() };
  }

  if (!response.ok) {
    const message = data?.detail || data?.message || `Request failed with status ${response.status}`;
    const errorType = data?.error_type || null;
    const validationErrors = data?.errors || null;
    throw new APIError(message, response.status, errorType, validationErrors);
  }

  return data;
}

export const api = {
  /**
   * Health check diagnostic
   */
  async checkHealth() {
    return apiRequest('/health');
  },

  /**
   * Ingest document (.pdf, .txt, .md) up to 25MB
   */
  async uploadDocument(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('session_id', getSessionId());

    return apiRequest('/upload', {
      method: 'POST',
      body: formData,
    });
  },

  /**
   * List ingested documents for active session
   */
  async listDocuments() {
    return apiRequest('/documents');
  },

  /**
   * Remove ingested document
   */
  async deleteDocument(docId) {
    return apiRequest(`/documents/${encodeURIComponent(docId)}`, {
      method: 'DELETE',
    });
  },

  /**
   * Send chat query to academic tutor RAG pipeline
   */
  async sendChatMessage(message, history = []) {
    return apiRequest('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        history,
        session_id: getSessionId(),
      }),
    });
  },

  /**
   * Generate multiple choice quiz on topic
   */
  async generateQuiz(topic, numQuestions = 5) {
    return apiRequest('/quiz/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic,
        num_questions: numQuestions,
        session_id: getSessionId(),
      }),
    });
  },
};

