export type AccessStatus = 'indexed' | 'unavailable';

export type StudyMode = 'short_notes' | 'detailed' | 'exam_style';

export interface Book {
  id: string;
  title: string;
  author: string;
  edition?: string;
  year?: number;
  subject: string;
  field: string;
  source_url?: string;
  licence?: string;
  access_status: AccessStatus;
  library: string;
}

export interface Passage {
  chunk_id: number;
  book_id: string;
  page: number;
  section: string;
  text: string;
  short_excerpt: string;
}

export interface AskResponse {
  book_id: string;
  mode: StudyMode;
  answer: string;
  retrieved_passages: Passage[];
  is_grounded: boolean;
}

export interface HistoryPassage {
  page: number;
  section: string;
  short_excerpt: string;
}

export interface HistoryEntry {
  id: number;
  book_id: string;
  book_title: string;
  library: string;
  question: string;
  mode: StudyMode;
  answer: string;
  is_grounded: boolean;
  passages_json: string; // JSON string of HistoryPassage[]
  created_at: string;
}
