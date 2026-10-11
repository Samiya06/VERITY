# VERITY: Textbook-Grounded Learning

AI answers that come only from verified textbooks, with page citations. If the book doesn't cover the question, VERITY refuses instead of guessing.

## Features
- Strict grounded answers with page citations
- Refusal when the textbooks don't contain the answer
- Library selector (UPSC Prelims GS, Science Samples)
- Study history (search, reopen, delete)
- Copyrighted books are listed but locked until licensed

## Tech
React + Vite frontend, Python FastAPI backend, SQLite FTS5 (BM25) search.

## Run locally
Backend: pip install -r requirements.txt, then python -m uvicorn main:app --host 127.0.0.1 --port 8000
Frontend: npm install, then npm run dev (opens at localhost:5173)

API keys are optional (set GEMINI_API_KEY or OPENAI_API_KEY). Without a key, VERITY runs in offline grounded mode.

## Roadmap
Practice quizzes, mistake notebook, progress tracker, teacher upload, more exams.
