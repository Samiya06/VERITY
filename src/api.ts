import { Book, AskResponse, StudyMode, HistoryEntry } from './types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function fetchCatalogue(params?: {
  q?: string;
  field?: string;
  subject?: string;
  library?: string;
}): Promise<Book[]> {
  const url = new URL(`${API_BASE_URL}/catalogue`);
  if (params?.q) url.searchParams.set('q', params.q);
  if (params?.field) url.searchParams.set('field', params.field);
  if (params?.subject) url.searchParams.set('subject', params.subject);
  if (params?.library) url.searchParams.set('library', params.library);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to load textbook catalogue (${res.status})`);
  return res.json();
}

export async function fetchLibraries(): Promise<string[]> {
  const res = await fetch(`${API_BASE_URL}/libraries`);
  if (!res.ok) throw new Error(`Failed to load libraries (${res.status})`);
  return res.json();
}

export async function askQuestion(
  bookId: string,
  question: string,
  mode: StudyMode = 'detailed'
): Promise<AskResponse> {
  const res = await fetch(`${API_BASE_URL}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ book_id: bookId, question, mode }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Server error (${res.status})`);
  }

  return res.json();
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────
// History API
// ─────────────────────────────────────────────

export async function fetchHistory(params?: {
  keyword?: string;
  book_id?: string;
  library?: string;
}): Promise<HistoryEntry[]> {
  const url = new URL(`${API_BASE_URL}/history`);
  if (params?.keyword) url.searchParams.set('keyword', params.keyword);
  if (params?.book_id) url.searchParams.set('book_id', params.book_id);
  if (params?.library) url.searchParams.set('library', params.library);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Failed to load history (${res.status})`);
  return res.json();
}

export async function deleteHistoryEntry(id: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/history/${id}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) throw new Error(`Failed to delete history entry`);
}

export async function deleteAllHistory(): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/history`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) throw new Error(`Failed to clear history`);
}
