"""
VERITY Database Layer
Manages SQLite schema, FTS5 virtual tables, BM25-ranked keyword searches,
study history, and book library assignment.
"""

import sqlite3
import os
import re
import json
from typing import List, Dict, Any, Optional

DEFAULT_DB_PATH = os.path.join(os.path.dirname(__file__), "verity.db")


def get_db_connection(db_path: Optional[str] = None) -> sqlite3.Connection:
    path = db_path or os.getenv("DATABASE_PATH", DEFAULT_DB_PATH)
    if not os.path.isabs(path):
        path = os.path.join(os.path.dirname(__file__), path)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(db_path: Optional[str] = None) -> None:
    conn = get_db_connection(db_path)
    cur = conn.cursor()

    # Books catalog table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS books (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            author TEXT NOT NULL,
            edition TEXT,
            year INTEGER,
            subject TEXT NOT NULL,
            field TEXT NOT NULL,
            source_url TEXT,
            licence TEXT,
            access_status TEXT NOT NULL CHECK(access_status IN ('indexed', 'unavailable')),
            library TEXT NOT NULL DEFAULT 'Science Samples'
        );
    """)

    # Add library column to existing databases (safe migration)
    try:
        cur.execute("ALTER TABLE books ADD COLUMN library TEXT NOT NULL DEFAULT 'Science Samples';")
    except Exception:
        pass  # Column already exists

    # Chunks content table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS chunks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            book_id TEXT NOT NULL,
            page_number INTEGER NOT NULL,
            section_heading TEXT,
            text TEXT NOT NULL,
            word_count INTEGER,
            FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE CASCADE
        );
    """)

    # FTS5 Virtual Table for full-text search
    cur.execute("""
        CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
            text,
            section_heading,
            content='chunks',
            content_rowid='id',
            tokenize='porter unicode61'
        );
    """)

    # Study history table — auto-saves every Q&A session
    cur.execute("""
        CREATE TABLE IF NOT EXISTS study_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            book_id TEXT NOT NULL,
            book_title TEXT NOT NULL,
            library TEXT NOT NULL DEFAULT '',
            question TEXT NOT NULL,
            mode TEXT NOT NULL,
            answer TEXT NOT NULL,
            is_grounded INTEGER NOT NULL DEFAULT 1,
            passages_json TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
    """)

    # Indexes
    cur.execute("CREATE INDEX IF NOT EXISTS idx_chunks_book_id ON chunks (book_id);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_history_book_id ON study_history (book_id);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_history_created_at ON study_history (created_at DESC);")

    conn.commit()
    conn.close()


def sanitize_fts5_query(raw_query: str) -> str:
    """
    Cleans raw user query into safe FTS5 query tokens.
    """
    tokens = re.findall(r'[A-Za-z0-9_]+', raw_query)
    if not tokens:
        return ""

    stop_words = {
        'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'in', 'of',
        'for', 'to', 'with', 'by', 'as', 'what', 'how', 'why', 'who', 'when',
        'where', 'explain', 'describe', 'tell', 'me', 'about', 'does', 'do',
        'are', 'can', 'from', 'this', 'that', 'these', 'those'
    }

    meaningful = [t for t in tokens if t.lower() not in stop_words and len(t) > 1]

    if not meaningful:
        meaningful = tokens

    quoted = [f'"{token}"' for token in meaningful]
    return " OR ".join(quoted)


def make_short_excerpt(text: str, query_tokens: List[str], max_words: int = 50) -> str:
    """
    Extracts a concise snippet (~50 words) around the best matching keyword.
    """
    words = text.split()
    if len(words) <= max_words:
        return text.strip()

    best_idx = -1
    lower_words = [w.lower().strip(".,;:?!()[]\"'") for w in words]
    for q in query_tokens:
        q_clean = q.lower().strip(".,;:?!()[]\"'")
        if q_clean in lower_words:
            best_idx = lower_words.index(q_clean)
            break

    if best_idx == -1:
        start = 0
    else:
        start = max(0, best_idx - 15)

    end = min(len(words), start + max_words)
    snippet = " ".join(words[start:end])

    if start > 0:
        snippet = "..." + snippet
    if end < len(words):
        snippet = snippet + "..."

    return snippet


def search_chunks(book_id: str, query: str, top_k: int = 5, db_path: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Retrieves the top K chunks for a specific book only, ranked by FTS5 BM25.
    """
    conn = get_db_connection(db_path)
    cur = conn.cursor()

    fts_query = sanitize_fts5_query(query)
    if not fts_query:
        conn.close()
        return []

    try:
        sql = """
            SELECT c.id, c.book_id, c.page_number, c.section_heading, c.text, bm25(chunks_fts) as rank
            FROM chunks c
            JOIN chunks_fts f ON c.id = f.rowid
            WHERE c.book_id = ? AND chunks_fts MATCH ?
            ORDER BY rank ASC
            LIMIT ?;
        """
        cur.execute(sql, (book_id, fts_query, top_k))
        rows = cur.fetchall()
    except Exception as e:
        print(f"[search_chunks] FTS error: {e}. Falling back to token matching.")
        keywords = re.findall(r'[A-Za-z0-9_]+', query)
        if not keywords:
            conn.close()
            return []
        primary_kw = keywords[0]
        cur.execute(
            "SELECT id, book_id, page_number, section_heading, text, 0 as rank FROM chunks WHERE book_id = ? AND text LIKE ? LIMIT ?",
            (book_id, f"%{primary_kw}%", top_k)
        )
        rows = cur.fetchall()

    query_tokens = re.findall(r'[A-Za-z0-9_]+', query)
    results = []
    for r in rows:
        text = r["text"]
        short_excerpt = make_short_excerpt(text, query_tokens, max_words=55)
        results.append({
            "chunk_id": r["id"],
            "book_id": r["book_id"],
            "page": r["page_number"],
            "section": r["section_heading"] or "General Content",
            "text": text,
            "short_excerpt": short_excerpt
        })

    conn.close()
    return results


# ─────────────────────────────────────────────────────────
# Study History Functions
# ─────────────────────────────────────────────────────────

def save_history_entry(
    book_id: str,
    book_title: str,
    library: str,
    question: str,
    mode: str,
    answer: str,
    is_grounded: bool,
    passages: List[Dict[str, Any]],
    db_path: Optional[str] = None
) -> int:
    """Save a Q&A session to study history. Returns the new entry id."""
    conn = get_db_connection(db_path)
    cur = conn.cursor()
    passages_json = json.dumps(passages)
    cur.execute("""
        INSERT INTO study_history (book_id, book_title, library, question, mode, answer, is_grounded, passages_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (book_id, book_title, library, question, mode, answer, 1 if is_grounded else 0, passages_json))
    entry_id = cur.lastrowid
    conn.commit()
    conn.close()
    return entry_id


def get_history(
    book_id: Optional[str] = None,
    library: Optional[str] = None,
    keyword: Optional[str] = None,
    limit: int = 100,
    db_path: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Retrieve study history with optional filters."""
    conn = get_db_connection(db_path)
    cur = conn.cursor()
    parts = ["SELECT * FROM study_history WHERE 1=1"]
    params: List[Any] = []
    if book_id:
        parts.append("AND book_id = ?")
        params.append(book_id)
    if library:
        parts.append("AND library = ?")
        params.append(library)
    if keyword and keyword.strip():
        parts.append("AND (question LIKE ? OR answer LIKE ?)")
        kw = f"%{keyword.strip()}%"
        params.extend([kw, kw])
    parts.append("ORDER BY created_at DESC LIMIT ?")
    params.append(limit)
    cur.execute(" ".join(parts), params)
    rows = cur.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_history_entry(entry_id: int, db_path: Optional[str] = None) -> None:
    """Delete a single history entry by id."""
    conn = get_db_connection(db_path)
    cur = conn.cursor()
    cur.execute("DELETE FROM study_history WHERE id = ?", (entry_id,))
    conn.commit()
    conn.close()


def delete_all_history(db_path: Optional[str] = None) -> None:
    """Delete all history entries."""
    conn = get_db_connection(db_path)
    cur = conn.cursor()
    cur.execute("DELETE FROM study_history")
    conn.commit()
    conn.close()
