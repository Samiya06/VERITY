"""
VERITY End-to-End Verification CLI
Executes the three required core user tests and prints clear, human-readable verification reports.
"""

import sys
import os
import json
from fastapi.testclient import TestClient

# Ensure backend directory is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import app
from database import init_db
from ingest import run_ingestion

client = TestClient(app)

REFUSAL_EXPECTED = "This textbook's indexed content doesn't answer this question."

def run_all_tests():
    print("\n" + "="*70)
    print("VERITY MVP SYSTEM VERIFICATION TESTS")
    print("="*70)

    # Setup
    init_db()
    books_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../books"))
    if os.path.exists(books_dir):
        run_ingestion(books_dir=books_dir, manifest_filename="books.json")

    successes = 0

    # -------------------------------------------------------------------------
    # TEST 1: A question the book answers returns a cited answer
    # -------------------------------------------------------------------------
    print("\n[TEST 1] Testing Question Answered by Textbook...")
    t1_payload = {
        "book_id": "openstax-biology-2e",
        "question": "How does the sodium-potassium pump work and what ions are exchanged?",
        "mode": "detailed"
    }
    resp1 = client.post("/ask", json=t1_payload)
    data1 = resp1.json()

    print(f"Status Code: {resp1.status_code}")
    print(f"Is Grounded: {data1.get('is_grounded')}")
    print(f"Answer Preview:\n{data1.get('answer')[:250]}...")
    print(f"Passages Count: {len(data1.get('retrieved_passages', []))}")
    if data1.get("retrieved_passages"):
        print(f"Top Citation: Page {data1['retrieved_passages'][0]['page']} ({data1['retrieved_passages'][0]['section']})")

    assert resp1.status_code == 200, "Test 1 failed: status != 200"
    assert data1.get("is_grounded") is True, "Test 1 failed: is_grounded != True"
    assert "[Page " in data1.get("answer", ""), "Test 1 failed: missing '[Page ' citation"
    assert data1.get("answer") != REFUSAL_EXPECTED, "Test 1 failed: answer was refusal"
    print(">>> TEST 1 RESULT: PASSED (Cited answer returned with page citations)")
    successes += 1

    # -------------------------------------------------------------------------
    # TEST 2: A question the book does NOT cover returns exact refusal sentence
    # -------------------------------------------------------------------------
    print("\n[TEST 2] Testing Question NOT Covered by Textbook...")
    t2_payload = {
        "book_id": "openstax-biology-2e",
        "question": "Explain the significance of the Treaty of Versailles in 1919.",
        "mode": "detailed"
    }
    resp2 = client.post("/ask", json=t2_payload)
    data2 = resp2.json()

    print(f"Status Code: {resp2.status_code}")
    print(f"Is Grounded: {data2.get('is_grounded')}")
    print(f"Returned Answer: \"{data2.get('answer')}\"")
    print(f"Passages Count: {len(data2.get('retrieved_passages', []))}")

    assert resp2.status_code == 200, "Test 2 failed: status != 200"
    assert data2.get("answer") == REFUSAL_EXPECTED, f"Test 2 failed: answer '{data2.get('answer')}' != '{REFUSAL_EXPECTED}'"
    assert data2.get("is_grounded") is False, "Test 2 failed: is_grounded != False"
    print(f">>> TEST 2 RESULT: PASSED (Exact refusal returned: \"{REFUSAL_EXPECTED}\")")
    successes += 1

    # -------------------------------------------------------------------------
    # TEST 3: An unavailable book is listed but cannot be selected / queried
    # -------------------------------------------------------------------------
    print("\n[TEST 3] Testing Unavailable Book Handling...")
    # 3a: Listed in catalogue
    cat_resp = client.get("/catalogue")
    cat_books = cat_resp.json()
    campbell = next((b for b in cat_books if b["id"] == "campbell-biology-12e"), None)

    print(f"Catalogue Check: Campbell Biology listed? {campbell is not None}")
    if campbell:
        print(f"Access Status in Catalogue: {campbell.get('access_status')}")

    assert campbell is not None, "Test 3 failed: Campbell Biology not in catalogue"
    assert campbell.get("access_status") == "unavailable", "Test 3 failed: status != unavailable"

    # 3b: Rejected when querying /ask
    t3_payload = {
        "book_id": "campbell-biology-12e",
        "question": "What is the structure of DNA?",
        "mode": "detailed"
    }
    resp3 = client.post("/ask", json=t3_payload)
    print(f"Ask Rejection Status: {resp3.status_code}")
    print(f"Rejection Detail: {resp3.json().get('detail')}")

    assert resp3.status_code == 403, "Test 3 failed: status != 403"
    assert "Unavailable: not indexed (permission or licence required)" in resp3.json().get("detail", ""), "Test 3 failed: message mismatch"
    print(">>> TEST 3 RESULT: PASSED (Listed in catalogue as unavailable and cannot be queried)")
    successes += 1

    print("\n" + "="*70)
    print(f"ALL {successes}/3 REQUIRED TESTS PASSED SUCCESSFULLY!")
    print("="*70 + "\n")


if __name__ == "__main__":
    run_all_tests()
