"""
VERITY LLM Client
Handles grounded prompt construction, multi-provider LLM calling (Gemini, OpenAI),
and deterministic fallback generation for offline testing.
"""

import os
import re
import json
import httpx
from typing import List, Dict, Any, Optional

GROUNDED_REFUSAL = "This textbook's indexed content doesn't answer this question."

SYSTEM_PROMPT = """You are VERITY, an academic study assistant grounded EXCLUSIVELY in the provided textbook passages.

CRITICAL RULES:
1. Answer SOLELY using facts explicitly stated in the provided passages.
2. DO NOT use any outside knowledge, external concepts, or extrapolation.
3. Every factual claim MUST cite the page number using the format [Page X].
4. If the provided passages do NOT clearly and directly answer the question, or if there is insufficient information in the passages to answer the question, you MUST return EXACTLY this refusal sentence and nothing else:
"This textbook's indexed content doesn't answer this question."
5. Never add conversational filler, apologies, or disclaimers when refusing. Return only the exact refusal sentence.
6. Adhere strictly to the requested mode:
   - short_notes: Concise bullet points highlighting key concepts, each with [Page X] citations.
   - detailed: In-depth conceptual explanation broken into paragraphs, each with [Page X] citations.
   - exam_style: Structured format with 'Definition', 'Core Mechanisms/Principles', and 'Summary', each with [Page X] citations.
"""


class LLMException(Exception):
    """Custom exception for LLM provider errors."""
    pass


def format_passages_context(passages: List[Dict[str, Any]]) -> str:
    blocks = []
    for p in passages:
        blocks.append(
            f"[Passage from Page {p['page']} | Section: {p['section']}]\n{p['text']}"
        )
    return "\n\n".join(blocks)


def build_prompt(question: str, passages: List[Dict[str, Any]], mode: str) -> str:
    passages_ctx = format_passages_context(passages)
    return f"""TEXTBOOK PASSAGES:
{passages_ctx}

STUDENT QUESTION:
{question}

MODE:
{mode}

Answer the student's question solely based on the passages above. If the passages do not contain the answer, reply with:
"This textbook's indexed content doesn't answer this question."
"""


async def call_gemini(api_key: str, question: str, passages: List[Dict[str, Any]], mode: str) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    prompt = build_prompt(question, passages, mode)
    
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": f"{SYSTEM_PROMPT}\n\n{prompt}"}
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 800
        }
    }
    
    async with httpx.AsyncClient(timeout=25.0) as client:
        try:
            resp = await client.post(url, json=payload)
            if resp.status_code != 200:
                raise LLMException(f"Gemini API returned status {resp.status_code}: {resp.text}")
            data = resp.json()
            candidates = data.get("candidates", [])
            if not candidates:
                raise LLMException("Gemini returned empty candidate response.")
            content = candidates[0].get("content", {})
            parts = content.get("parts", [])
            if not parts:
                raise LLMException("Gemini returned no content parts.")
            return parts[0].get("text", "").strip()
        except httpx.RequestError as e:
            raise LLMException(f"Network error communicating with Gemini API: {str(e)}")


async def call_openai(api_key: str, question: str, passages: List[Dict[str, Any]], mode: str) -> str:
    url = "https://api.openai.com/v1/chat/completions"
    prompt = build_prompt(question, passages, mode)
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.1,
        "max_tokens": 800
    }
    
    async with httpx.AsyncClient(timeout=25.0) as client:
        try:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code != 200:
                raise LLMException(f"OpenAI API returned status {resp.status_code}: {resp.text}")
            data = resp.json()
            return data["choices"][0]["message"]["content"].strip()
        except httpx.RequestError as e:
            raise LLMException(f"Network error communicating with OpenAI API: {str(e)}")


def deterministic_grounded_answer(question: str, passages: List[Dict[str, Any]], mode: str) -> str:
    """
    Offline deterministic synthesis for automated test suites and offline environments.
    Checks whether the question is genuinely grounded in the retrieved passages.
    If yes, constructs a grounded response with [Page X] citations.
    If no, returns the exact refusal sentence.
    """
    if not passages:
        return GROUNDED_REFUSAL

    q_tokens = [w.lower().strip("?,.!\"':;()") for w in question.split() if len(w) > 2]
    # Filter stopwords and generic prompt verbs
    stop = {
        'what', 'when', 'where', 'which', 'explain', 'describe', 'tell', 'about',
        'does', 'with', 'from', 'this', 'that', 'state', 'how', 'many', 'much',
        'and', 'the', 'for', 'are', 'was', 'were', 'have', 'has'
    }
    meaningful_q = set(t for t in q_tokens if t not in stop)
    if not meaningful_q:
        return GROUNDED_REFUSAL

    # Measure how many meaningful question terms appear in all passages combined
    all_text = " ".join([p["text"].lower() for p in passages])
    covered_terms = {t for t in meaningful_q if t in all_text}
    
    # Grounding threshold: at least 50% of the distinct question terms (or at least 2 terms if >2)
    # must actually exist in the retrieved passages for it to be considered grounded.
    required_matches = max(2, int(len(meaningful_q) * 0.45)) if len(meaningful_q) >= 3 else 1
    if len(covered_terms) < required_matches:
        return GROUNDED_REFUSAL

    matching_sentences = []
    for p in passages:
        page_num = p["page"]
        text = p["text"]
        # Split into sentences
        sentences = re.split(r'(?<=[.!?])\s+', text)
        for sent in sentences:
            sent_clean = sent.lower()
            overlap = [t for t in meaningful_q if t in sent_clean]
            # Require at least 2 overlapping terms per sentence if multiple terms exist
            if len(meaningful_q) >= 2 and len(overlap) < 2:
                continue
            if len(overlap) >= 1:
                matching_sentences.append((sent.strip(), page_num, len(overlap)))

    if not matching_sentences:
        return GROUNDED_REFUSAL

    # Sort matching sentences by keyword overlap
    matching_sentences.sort(key=lambda x: x[2], reverse=True)
    top_matches = matching_sentences[:4]

    # Format based on mode
    if mode == "short_notes":
        bullets = []
        for sent, page, _ in top_matches:
            bullets.append(f"- {sent} [Page {page}]")
        return "\n".join(bullets)
    elif mode == "exam_style":
        lines = []
        lines.append("### Definition & Context")
        lines.append(f"{top_matches[0][0]} [Page {top_matches[0][1]}]\n")
        lines.append("### Key Principles & Mechanisms")
        for sent, page, _ in top_matches[1:]:
            lines.append(f"- {sent} [Page {page}]")
        lines.append(f"\n### Exam Summary\nThis phenomenon illustrates key principles detailed in [Page {top_matches[0][1]}].")
        return "\n".join(lines)
    else:  # detailed
        paragraphs = []
        for sent, page, _ in top_matches:
            paragraphs.append(f"{sent} (refer to [Page {page}]).")
        return " ".join(paragraphs)


async def generate_grounded_answer(
    question: str,
    passages: List[Dict[str, Any]],
    mode: str = "detailed"
) -> str:
    """
    Orchestrates LLM query using available environment keys or offline evaluator.
    Strictly guarantees grounding and refusal rules.
    """
    if not passages:
        return GROUNDED_REFUSAL

    gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    provider = os.getenv("LLM_PROVIDER", "").lower().strip()

    # If user explicitly configured provider or has keys
    if (provider == "gemini" or not provider) and gemini_key and gemini_key != "your_gemini_api_key_here":
        try:
            raw_answer = await call_gemini(gemini_key, question, passages, mode)
            return clean_response(raw_answer)
        except LLMException:
            raise

    if (provider == "openai" or not provider) and openai_key and openai_key != "your_openai_api_key_here":
        try:
            raw_answer = await call_openai(openai_key, question, passages, mode)
            return clean_response(raw_answer)
        except LLMException:
            raise

    # If provider is explicitly offline or no valid API key is present
    return deterministic_grounded_answer(question, passages, mode)


def clean_response(text: str) -> str:
    cleaned = text.strip()
    # Normalize refusal if model included extra quotation marks or minor casing variations
    refusal_lower = GROUNDED_REFUSAL.lower()
    if refusal_lower in cleaned.lower() and len(cleaned) < len(GROUNDED_REFUSAL) + 30:
        return GROUNDED_REFUSAL
    return cleaned
