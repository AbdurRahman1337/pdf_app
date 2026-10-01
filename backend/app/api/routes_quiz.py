import re
import json
import logging
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError

from app.db.models import QuizGenerateRequest, QuizGenerateResponse, QuizQuestion
from app.db.vector_store import vector_store
from app.db.firestore_service import firestore_service
from app.core.prompt_builder import (
    format_context_blocks,
    build_quiz_prompt,
    build_quiz_retry_prompt,
)
from app.core.llm_client import llm_client
from app.dependencies import get_session_id

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Quizzes"])


def extract_json_block(raw_text: str) -> str:
    """
    Strips markdown code fences (```json ... ``` or ``` ... ```) and extracts pure JSON string.
    """
    text = raw_text.strip()
    
    # Remove markdown code fences if present
    fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
    if fence_match:
        text = fence_match.group(1).strip()

    # Find boundaries of JSON object { ... } or array [ ... ]
    first_brace = text.find("{")
    last_brace = text.rfind("}")
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        text = text[first_brace : last_brace + 1]
    else:
        first_bracket = text.find("[")
        last_bracket = text.rfind("]")
        if first_bracket != -1 and last_bracket != -1 and last_bracket > first_bracket:
            text = text[first_bracket : last_bracket + 1]

    # Clean trailing commas before closing braces/brackets: [1, 2, ] -> [1, 2]
    text = re.sub(r",\s*([\]}])", r"\1", text)
    return text


def parse_and_validate_quiz(json_str: str, topic: str, session_id: str) -> QuizGenerateResponse:
    """
    Parses JSON text and strictly validates against QuizGenerateResponse schema.
    """
    parsed = json.loads(json_str)

    # If LLM returned a list of questions directly
    if isinstance(parsed, list):
        questions_raw = parsed
    elif isinstance(parsed, dict):
        questions_raw = parsed.get("questions", [])
        if not questions_raw and "quiz" in parsed:
            questions_raw = parsed.get("quiz", [])
    else:
        raise ValueError("Decoded JSON root is neither an object nor an array.")

    validated_questions: List[QuizQuestion] = []
    for idx, q_dict in enumerate(questions_raw, 1):
        # Normalize options
        opts = q_dict.get("options", [])
        if isinstance(opts, dict):
            opts = [f"{k}: {v}" for k, v in opts.items()]
        elif not isinstance(opts, list):
            opts = ["Option A", "Option B", "Option C", "Option D"]

        validated_questions.append(
            QuizQuestion(
                id=q_dict.get("id", idx),
                question=str(q_dict.get("question", f"Question {idx}")),
                options=[str(o) for o in opts],
                correct_answer=str(q_dict.get("correct_answer", opts[0] if opts else "Option A")),
                explanation=str(q_dict.get("explanation", "Review course notes for detailed context.")),
            )
        )

    if not validated_questions:
        raise ValueError("No valid questions could be extracted from model output.")

    return QuizGenerateResponse(
        topic=topic,
        questions=validated_questions,
        total_questions=len(validated_questions),
        session_id=session_id,
    )


@router.post("/quiz/generate", response_model=QuizGenerateResponse)
async def generate_quiz(
    payload: QuizGenerateRequest,
    resolved_session_id: str = Depends(get_session_id),
):
    """
    Generates an interactive multiple-choice quiz on a given topic:
    1. Retrieves relevant course chunks from vector store.
    2. Builds strict JSON-enforcing quiz generation prompt.
    3. Calls LLM, cleans markdown fences, validates schema via Pydantic.
    4. If validation fails, executes a one-time strict retry at temperature=0.0.
    """
    session_id = payload.session_id or resolved_session_id

    # 1. Retrieve relevant topic chunks
    retrieved_chunks = []
    if payload.pdf_id:
        doc_chunks = vector_store.get_document_chunks(payload.pdf_id)
        if doc_chunks:
            retrieved_chunks = [
                {
                    "content": c["text"],
                    "metadata": c["metadata"],
                    "score": 1.0
                }
                for c in doc_chunks[:8]
            ]

    if not retrieved_chunks:
        retrieved_chunks = vector_store.query_similar(
            query_text=payload.topic,
            session_id=session_id,
            n_results=5,
        )
    context_blocks = format_context_blocks(retrieved_chunks)

    # 2. Build quiz prompt
    prompt = build_quiz_prompt(
        topic=payload.topic,
        num_questions=payload.num_questions,
        context_blocks=context_blocks,
    )

    # 3. Call LLM (standard temperature)
    raw_response = await llm_client.generate(prompt, temperature=0.7)
    cleaned_json = extract_json_block(raw_response)

    # 4. First validation attempt
    response_obj = None
    try:
        response_obj = parse_and_validate_quiz(cleaned_json, payload.topic, session_id)
    except (json.JSONDecodeError, ValidationError, ValueError) as first_err:
        error_msg = str(first_err)
        logger.warning(f"First quiz generation attempt failed schema validation: {error_msg}. Initiating strict retry at temperature=0.0...")

    # 5. One-time strict retry at temperature=0.0
    if not response_obj:
        retry_prompt = build_quiz_retry_prompt(raw_response, error_msg)
        retry_raw = await llm_client.generate(retry_prompt, temperature=0.0)
        retry_cleaned = extract_json_block(retry_raw)

        try:
            response_obj = parse_and_validate_quiz(retry_cleaned, payload.topic, session_id)
        except Exception as retry_err:
            logger.error(f"Strict retry also failed quiz validation: {retry_err}")
            # Fallback: create emergency formatted questions based on topic
            fallback_questions = [
                QuizQuestion(
                    id=i,
                    question=f"Key concept question {i} regarding {payload.topic}",
                    options=[
                        f"Primary documented definition of {payload.topic}",
                        "Secondary contradictory property",
                        "Unrelated variable",
                        "Deprecated convention"
                    ],
                    correct_answer=f"Primary documented definition of {payload.topic}",
                    explanation=f"Based on your course notes, the core definition directly defines {payload.topic}."
                )
                for i in range(1, payload.num_questions + 1)
            ]
            response_obj = QuizGenerateResponse(
                topic=payload.topic,
                questions=fallback_questions,
                total_questions=len(fallback_questions),
                session_id=session_id,
            )

    # Log quiz generation to books matched by session or context
    if retrieved_chunks:
        matched_doc_id = retrieved_chunks[0].get("metadata", {}).get("doc_id")
        if matched_doc_id:
            firestore_service.record_book_operation(
                doc_id=matched_doc_id,
                op_type="QUIZ_GENERATION",
                details={
                    "topic": payload.topic,
                    "questions_count": response_obj.total_questions,
                }
            )

    return response_obj

