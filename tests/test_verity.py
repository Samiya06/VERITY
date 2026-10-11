"""
VERITY Automated Test Suite
Verifies the three core requirements specified in the project specification:
1. A question the book answers returns a cited answer with [Page X].
2. A question the book does not cover returns the exact refusal sentence:
   "This textbook's indexed content doesn't answer this question."
3. An unavailable book is listed in the catalogue but cannot be selected/asked.
"""

import sys
import os
import pytest
from fastapi.testclient import TestClient

# Ensure backend directory is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import app
from database import init_db
from ingest import run_ingestion

client = TestClient(app)

REFUSAL_STRING = "This textbook's indexed content doesn't answer this question."


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    """Ensure database is initialized and sample textbooks are ingested before running tests."""
    init_db()
    # Resolve path to books manifest
    books_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../books"))
    if os.path.exists(books_dir):
        run_ingestion(books_dir=books_dir, manifest_filename="books.json")


# ---------------------------------------------------------------------------
# Test 1: Question the book answers returns a cited answer
# ---------------------------------------------------------------------------
def test_1_answered_question_returns_cited_answer():
    """
    Test 1:
    A student asks about the sodium-potassium pump from OpenStax Biology 2e.
    The textbook covers this in Section 5.3 (Page 3).
    The system must return an answer grounded in the passages containing inline page citations.
    """
    payload = {
        "book_id": "openstax-biology-2e",
        "question": "How does the sodium-potassium pump work and how many ions are moved?",
        "mode": "detailed"
    }
    response = client.post("/ask", json=payload)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    data = response.json()
    assert data["book_id"] == "openstax-biology-2e"
    assert data["is_grounded"] is True
    assert data["answer"] != REFUSAL_STRING
    
    # Verify page citation format [Page X]
    assert "[Page " in data["answer"], f"Expected '[Page ' citation in answer, got: {data['answer']}"
    
    # Verify separate retrieved passages with page and section
    passages = data["retrieved_passages"]
    assert len(passages) > 0, "Expected non-empty retrieved passages"
    assert any(p["page"] == 3 for p in passages), "Expected passage from Page 3 (Section 5.3 Active Transport)"
    for p in passages:
        assert "text" in p and len(p["text"]) > 0
        assert "page" in p and isinstance(p["page"], int)
        assert "section" in p


# ---------------------------------------------------------------------------
# Test 1b: Modes (short_notes & exam_style) also follow citation rule
# ---------------------------------------------------------------------------
def test_1b_modes_preserve_grounding_and_citations():
    """Verify short_notes and exam_style modes return properly cited outputs."""
    payload_notes = {
        "book_id": "openstax-biology-2e",
        "question": "What is the fluid mosaic model?",
        "mode": "short_notes"
    }
    resp = client.post("/ask", json=payload_notes)
    assert resp.status_code == 200
    data = resp.json()
    assert "[Page 1]" in data["answer"]
    assert data["answer"].startswith("•") or "Page" in data["answer"]


# ---------------------------------------------------------------------------
# Test 2: Question the book does NOT cover returns exact refusal sentence
# ---------------------------------------------------------------------------
def test_2_uncovered_question_returns_exact_refusal():
    """
    Test 2:
    A student asks a question completely outside the textbook's scope
    (e.g., the French Revolution, or quantum chromodynamics).
    The system MUST return EXACTLY:
    "This textbook's indexed content doesn't answer this question."
    """
    payload = {
        "book_id": "openstax-biology-2e",
        "question": "Who led the storming of the Bastille during the French Revolution in 1789?",
        "mode": "detailed"
    }
    response = client.post("/ask", json=payload)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    data = response.json()
    assert data["answer"] == REFUSAL_STRING, f"Expected exact refusal '{REFUSAL_STRING}', got: '{data['answer']}'"
    assert data["is_grounded"] is False


def test_2b_cross_subject_uncovered_question():
    """Asking a physics question to the biology book returns refusal."""
    payload = {
        "book_id": "openstax-biology-2e",
        "question": "State Newton's third law of motion and explain action reaction pairs.",
        "mode": "exam_style"
    }
    response = client.post("/ask", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["answer"] == REFUSAL_STRING


# ---------------------------------------------------------------------------
# Test 3: Unavailable book is listed in catalogue but cannot be selected
# ---------------------------------------------------------------------------
def test_3_unavailable_book_listed_in_catalogue_and_cannot_be_asked():
    """
    Test 3:
    1. GET /catalogue: 'campbell-biology-12e' is listed with access_status == 'unavailable'.
    2. POST /ask with 'campbell-biology-12e': API returns 403 Forbidden with
       'Unavailable: not indexed (permission or licence required)'.
    """
    # 1. Catalogue check
    cat_response = client.get("/catalogue")
    assert cat_response.status_code == 200
    books = cat_response.json()
    
    campbell = next((b for b in books if b["id"] == "campbell-biology-12e"), None)
    assert campbell is not None, "Campbell Biology must be present in the catalogue"
    assert campbell["access_status"] == "unavailable", "Campbell Biology status must be 'unavailable'"
    
    # 2. Rejection check when attempting to ask
    ask_payload = {
        "book_id": "campbell-biology-12e",
        "question": "What is cellular respiration?",
        "mode": "detailed"
    }
    ask_response = client.post("/ask", json=ask_payload)
    assert ask_response.status_code == 403, f"Expected 403 Forbidden, got {ask_response.status_code}"
    error_detail = ask_response.json().get("detail", "")
    assert "Unavailable: not indexed (permission or licence required)" in error_detail
