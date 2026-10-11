"""
VERITY Ingestion Pipeline
Extracts text page-by-page with PyMuPDF, splits into ~200-300 word chunks
(never crossing page boundaries), extracts section headings, and populates
SQLite tables and the FTS5 full-text search index.
"""

import os
import json
import re
import pymupdf as fitz
from database import get_db_connection, init_db

def detect_section_heading(text: str, default_heading: str = "") -> str:
    """
    Detects section or chapter headings from the text content.
    Matches patterns like 'Chapter X: ...' or 'Section X.Y: ...'
    or prominent header lines.
    """
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    for line in lines[:5]:  # Look at the first few lines of the page
        # Match 'Section 5.1: ...' or 'Chapter 4: ...'
        if re.match(r'^(Section|Chapter)\s+[\d\.\w]+[:\-\s]', line, re.IGNORECASE):
            return line
        # Match short heading without trailing period
        if len(line) < 60 and re.match(r'^[A-Z0-9][A-Za-z0-9\s\:\-\–]+$', line) and not line.endswith('.'):
            if any(k in line.lower() for k in ['section', 'chapter', 'introduction', 'overview', 'law', 'structure', 'cycle']):
                return line
    return default_heading or "Main Chapter Content"


def chunk_page_text(text: str, target_min_words: int = 200, target_max_words: int = 300) -> list[str]:
    """
    Splits text on a single page into chunks of approximately 200-300 words.
    Crucially: NEVER crosses page boundaries.
    """
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    if not paragraphs:
        paragraphs = [p.strip() for p in text.split("\n") if p.strip()]

    chunks = []
    current_chunk = []
    current_word_count = 0

    for para in paragraphs:
        para_words = para.split()
        para_word_count = len(para_words)

        if not para_words:
            continue

        # If adding this paragraph exceeds target_max_words and we already have enough words
        if current_word_count + para_word_count > target_max_words and current_word_count >= target_min_words:
            chunks.append(" ".join(current_chunk))
            current_chunk = [para]
            current_word_count = para_word_count
        elif para_word_count > target_max_words:
            # If a single paragraph is larger than target_max_words, break by sentences
            sentences = re.split(r'(?<=[.!?])\s+', para)
            for sentence in sentences:
                sent_words = sentence.split()
                if not sent_words:
                    continue
                if current_word_count + len(sent_words) > target_max_words and current_word_count >= target_min_words:
                    chunks.append(" ".join(current_chunk))
                    current_chunk = [sentence]
                    current_word_count = len(sent_words)
                else:
                    current_chunk.append(sentence)
                    current_word_count += len(sent_words)
        else:
            current_chunk.append(para)
            current_word_count += para_word_count

    if current_chunk:
        chunks.append(" ".join(current_chunk))

    # Clean and filter empty chunks
    cleaned_chunks = [c.strip() for c in chunks if len(c.strip().split()) >= 10]
    # If text had content but was under 10 words, still retain it
    if not cleaned_chunks and text.strip():
        cleaned_chunks = [text.strip()]

    return cleaned_chunks


def run_ingestion(books_dir: str = "../books", manifest_filename: str = "books.json"):
    # Ensure database tables exist
    init_db()

    conn = get_db_connection()
    cur = conn.cursor()

    manifest_path = os.path.join(books_dir, manifest_filename)
    if not os.path.exists(manifest_path):
        # Check current directory
        manifest_path = os.path.join("books", manifest_filename)
        if not os.path.exists(manifest_path):
            raise FileNotFoundError(f"Manifest not found at {manifest_path}")
        books_dir = "books"

    with open(manifest_path, "r", encoding="utf-8") as f:
        books_data = json.load(f)

    print(f"\n==================================================")
    print(f"VERITY INGESTION PIPELINE")
    print(f"Loading {len(books_data)} book manifests from: {manifest_path}")
    print(f"==================================================")

    total_chunks_indexed = 0

    for book in books_data:
        book_id = book["id"]
        title = book["title"]
        author = book["author"]
        edition = book.get("edition", "")
        year = book.get("year", None)
        subject = book["subject"]
        field = book["field"]
        source_url = book.get("source_url", "")
        licence = book.get("licence", "")
        access_status = book.get("access_status", "unavailable")
        library = book.get("library", "Science Samples")

        # Upsert book record (including library)
        cur.execute("""
            INSERT INTO books (id, title, author, edition, year, subject, field, source_url, licence, access_status, library)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                title=excluded.title,
                author=excluded.author,
                edition=excluded.edition,
                year=excluded.year,
                subject=excluded.subject,
                field=excluded.field,
                source_url=excluded.source_url,
                licence=excluded.licence,
                access_status=excluded.access_status,
                library=excluded.library;
        """, (book_id, title, author, edition, year, subject, field, source_url, licence, access_status, library))

        # Clear existing chunks for this book if re-ingesting
        cur.execute("DELETE FROM chunks WHERE book_id = ?;", (book_id,))
        # Re-sync FTS index
        cur.execute("DELETE FROM chunks_fts;")
        cur.execute("INSERT INTO chunks_fts(rowid, text, section_heading) SELECT id, text, section_heading FROM chunks;")

        if access_status != "indexed":
            print(f"[INGEST] Book '{title}' ({book_id}): Access status is '{access_status}'. Skipped indexing as required.")
            continue

        pdf_path = os.path.join(books_dir, f"{book_id}.pdf")
        if not os.path.exists(pdf_path):
            print(f"[INGEST WARNING] PDF not found for indexed book: {pdf_path}")
            continue

        doc = fitz.open(pdf_path)
        book_chunks_count = 0
        current_section = "Introduction"

        for page_index in range(len(doc)):
            page = doc[page_index]
            page_number = page_index + 1
            page_text = page.get_text("text").strip()

            if not page_text:
                continue

            # Detect section heading
            current_section = detect_section_heading(page_text, current_section)

            # Chunk page text into ~200-300 words without crossing page boundaries
            chunks = chunk_page_text(page_text, target_min_words=180, target_max_words=320)

            for chunk_text in chunks:
                words = chunk_text.split()
                word_count = len(words)

                cur.execute("""
                    INSERT INTO chunks (book_id, page_number, section_heading, text, word_count)
                    VALUES (?, ?, ?, ?, ?);
                """, (book_id, page_number, current_section, chunk_text, word_count))

                chunk_id = cur.lastrowid
                # Insert into FTS5 index
                cur.execute("""
                    INSERT INTO chunks_fts (rowid, text, section_heading)
                    VALUES (?, ?, ?);
                """, (chunk_id, chunk_text, current_section))

                book_chunks_count += 1

        conn.commit()
        total_chunks_indexed += book_chunks_count
        print(f"[INGEST] Book '{title}' ({book_id}): {len(doc)} pages processed -> {book_chunks_count} chunks indexed into FTS5.")

    conn.commit()
    conn.close()

    print(f"==================================================")
    print(f"Ingestion complete. Total chunks indexed: {total_chunks_indexed}")
    print(f"==================================================\n")


if __name__ == "__main__":
    import sys
    # Handle paths relative to project root or backend folder
    if os.path.exists("books"):
        run_ingestion("books", "books.json")
    elif os.path.exists("../books"):
        run_ingestion("../books", "books.json")
    else:
        run_ingestion()
