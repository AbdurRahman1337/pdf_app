import { useState, useCallback, useEffect } from 'react';
import { api, APIError } from '../api/client';

const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  content: "Hello! I'm your AI Academic Study Assistant. You can upload lecture notes, textbooks, or research papers in the **Ingest Notes** tab, or ask me any questions directly here. How can I help you study today?",
  sources: [],
  timestamp: new Date().toISOString(),
};

export function useChat() {
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('study_assistant_chat_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      // Ignore parse errors
    }
    return [WELCOME_MESSAGE];
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUserMessage, setLastUserMessage] = useState(null);

  // Sync to local storage
  useEffect(() => {
    try {
      localStorage.setItem('study_assistant_chat_history', JSON.stringify(messages));
    } catch (e) {
      // Ignore quota errors
    }
  }, [messages]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearHistory = useCallback(() => {
    setMessages([WELCOME_MESSAGE]);
    setError(null);
    setLastUserMessage(null);
    try {
      localStorage.removeItem('study_assistant_chat_history');
    } catch (e) {}
  }, []);

  const sendMessage = useCallback(async (content) => {
    if (!content || !content.trim() || isLoading) return;

    const trimmed = content.trim();
    const userMsgId = 'user_' + Date.now();
    const newUserMsg = {
      id: userMsgId,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    // 1. Optimistic UI update: immediately display user message
    setMessages((prev) => [...prev, newUserMsg]);
    setIsLoading(true);
    setError(null);
    setLastUserMessage(trimmed);

    // Prepare history payload (exclude welcome placeholder and source details)
    const historyPayload = messages
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    try {
      // 2. Call backend RAG pipeline
      const response = await api.sendChatMessage(trimmed, historyPayload);

      const assistantMsg = {
        id: 'assistant_' + Date.now(),
        role: 'assistant',
        content: response.answer,
        sources: response.sources || [],
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setLastUserMessage(null);
    } catch (err) {
      const errMsg = err instanceof APIError ? err.message : 'An unexpected error occurred while generating answer.';
      setError(errMsg);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading]);

  const retryLastMessage = useCallback(() => {
    if (lastUserMessage) {
      // Remove last failed user message from UI if needed and re-send
      sendMessage(lastUserMessage);
    }
  }, [lastUserMessage, sendMessage]);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearHistory,
    clearError,
    retryLastMessage,
  };
}

