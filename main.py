"""
VERITY Backend API
FastAPI application providing:
- GET /catalogue: Search & list textbooks, optionally filtered by library.
- GET /libraries: List all distinct library names.
- POST /ask: Retrieve top 5 FTS5 chunks and generate grounded answers. Auto-saves to history.
- GET /health: System health and index status.
- GET /history: Retrieve study history with keyword/book/library filters.
- DELETE /history/{id}: Delete one history entry.
- DELETE /history: Delete all history entries.
"""

import os
from typing import Optional, List, Any
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from contextlib import asynccontextmanager

load_dotenv()

from database import (
    get_db_connection, search_chunks, init_db,
    save_history_entry, get_history, delete_history_entry, delete_all_history
)
from llm_client import generate_grounded_answer, LLMException, GROUNDED_REFUSAL


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(
    title="VERITY Textbook Grounding API",
    description="Academic study assistant grounded strictly in verified textbook passages.",
    version="1.1.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────
# Pydantic Models
# ─────────────────────────────────────────────────────────

class BookModel(BaseModel):
    id: str
    title: str
    author: str
    edition: Optional[str] = None
    year: Optional[int] = None
    subject: str
    field: str
    source_url: Optional[str] = None
    licence: Optional[str] = None
    access_status: str
    library: str = "Science Samples"


class AskRequest(BaseModel):
    book_id: str = Field(..., description="Unique ID of the textbook")
    question: str = Field(..., min_length=1, description="Student study question")
    mode: str = Field("detailed", description="Mode: 'short_notes', 'detailed', or 'exam_style'")


class PassageModel(BaseModel):
    chunk_id: int
    book_id: str
    page: int
    section: str
    text: str
    short_excerpt: str


class AskResponse(BaseModel):
    book_id: str
    mode: str
    answer: str
    retrieved_passages: List[PassageModel]
    is_grounded: bool


class HistoryEntryModel(BaseModel):
    id: int
    book_id: str
    book_title: str
    library: str
    question: str
    mode: str
    answer: str
    is_grounded: bool
    passages_json: str
    created_at: str


# ─────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT count(*) as count FROM books;")
    book_count = cur.fetchone()["count"]
    cur.execute("SELECT count(*) as count FROM chunks;")
    chunk_count = cur.fetchone()["count"]
    cur.execute("SELECT count(*) as count FROM study_history;")
    history_count = cur.fetchone()["count"]
    conn.close()
    return {
        "status": "healthy",
        "app": "VERITY",
        "total_books": book_count,
        "indexed_chunks": chunk_count,
        "history_entries": history_count
    }


@app.get("/libraries")
def get_libraries():
    """Return distinct library names that have at least one book."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT DISTINCT library FROM books ORDER BY library ASC;")
    rows = cur.fetchall()
    conn.close()
    return [r["library"] for r in rows]


@app.get("/catalogue", response_model=List[BookModel])
def get_catalogue(
    q: Optional[str] = Query(None, description="Search across title, author, or subject"),
    field: Optional[str] = Query(None),
    subject: Optional[str] = Query(None),
    library: Optional[str] = Query(None, description="Filter by library name")
):
    """List and search books with optional library filter."""
    conn = get_db_connection()
    cur = conn.cursor()

    query_parts = ["SELECT * FROM books WHERE 1=1"]
    params: List[Any] = []

    if library:
        query_parts.append("AND library = ?")
        params.append(library)

    if field:
        query_parts.append("AND field = ?")
        params.append(field)

    if subject:
        query_parts.append("AND subject = ?")
        params.append(subject)

    if q and q.strip():
        search_pattern = f"%{q.strip()}%"
        query_parts.append("AND (title LIKE ? OR author LIKE ? OR subject LIKE ?)")
        params.extend([search_pattern, search_pattern, search_pattern])

    query_parts.append("ORDER BY access_status DESC, title ASC")
    cur.execute(" ".join(query_parts), params)
    rows = cur.fetchall()
    conn.close()

    return [
        BookModel(
            id=r["id"],
            title=r["title"],
            author=r["author"],
            edition=r["edition"],
            year=r["year"],
            subject=r["subject"],
            field=r["field"],
            source_url=r["source_url"],
            licence=r["licence"],
            access_status=r["access_status"],
            library=r["library"] if r["library"] else "Science Samples"
        )
        for r in rows
    ]


@app.post("/ask", response_model=AskResponse)
async def ask_textbook(req: AskRequest):
    """
    Retrieve the top 5 chunks from the selected book only via FTS5 BM25.
    Sends ONLY those chunks to the LLM under strict grounding rules.
    Auto-saves the Q&A session to study history.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM books WHERE id = ?;", (req.book_id,))
    book = cur.fetchone()
    conn.close()

    if not book:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Book with id '{req.book_id}' not found in catalogue."
        )

    if book["access_status"] == "unavailable":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unavailable: not indexed (permission or licence required)"
        )

    valid_modes = ["short_notes", "detailed", "exam_style"]
    mode = req.mode if req.mode in valid_modes else "detailed"

    question_clean = req.question.strip()
    if not question_clean:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Question cannot be empty.")

    passages = search_chunks(book_id=req.book_id, query=question_clean, top_k=5)

    if not passages:
        answer = GROUNDED_REFUSAL
        is_grounded = False
        passage_models = []
    else:
        try:
            answer = await generate_grounded_answer(
                question=question_clean,
                passages=passages,
                mode=mode
            )
        except LLMException as e:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"LLM synthesis failed: {str(e)}")
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Internal error: {str(e)}")

        is_grounded = (answer.strip() != GROUNDED_REFUSAL)

        passage_models = [
            PassageModel(
                chunk_id=p["chunk_id"],
                book_id=p["book_id"],
                page=p["page"],
                section=p["section"],
                text=p["text"],
                short_excerpt=p["short_excerpt"]
            )
            for p in passages
        ]

    # Auto-save to study history
    try:
        book_library = book["library"] if book["library"] else "Science Samples"
        passages_for_save = [
            {"page": p["page"], "section": p["section"], "short_excerpt": p["short_excerpt"]}
            for p in passages
        ] if passages else []
        save_history_entry(
            book_id=req.book_id,
            book_title=book["title"],
            library=book_library,
            question=question_clean,
            mode=mode,
            answer=answer,
            is_grounded=is_grounded,
            passages=passages_for_save
        )
    except Exception as e:
        # History save failure must never break the main response
        print(f"[history] Save failed (non-fatal): {e}")

    return AskResponse(
        book_id=req.book_id,
        mode=mode,
        answer=answer,
        retrieved_passages=passage_models,
        is_grounded=is_grounded
    )


# ─────────────────────────────────────────────────────────
# History Endpoints
# ─────────────────────────────────────────────────────────

@app.get("/history", response_model=List[HistoryEntryModel])
def list_history(
    keyword: Optional[str] = Query(None, description="Search keyword in question or answer"),
    book_id: Optional[str] = Query(None),
    library: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500)
):
    """Return study history, newest first. Supports keyword search and filters."""
    entries = get_history(book_id=book_id, library=library, keyword=keyword, limit=limit)
    return [
        HistoryEntryModel(
            id=e["id"],
            book_id=e["book_id"],
            book_title=e["book_title"],
            library=e["library"],
            question=e["question"],
            mode=e["mode"],
            answer=e["answer"],
            is_grounded=bool(e["is_grounded"]),
            passages_json=e["passages_json"],
            created_at=e["created_at"]
        )
        for e in entries
    ]


@app.delete("/history/{entry_id}", status_code=204)
def delete_one_history(entry_id: int):
    """Delete a single history entry by id."""
    delete_history_entry(entry_id)


@app.delete("/history", status_code=204)
def clear_all_history():
    """Delete ALL history entries."""
    delete_all_history()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
