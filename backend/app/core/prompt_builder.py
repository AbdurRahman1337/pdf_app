from typing import List, Dict, Any

ACADEMIC_TUTOR_SYSTEM_PROMPT = """You are an expert, encouraging Academic Tutor and Study Assistant.
Your mission is to help the student deeply understand concepts, master their course materials, and excel in their studies.

Guidelines:
1. Academic Rigor: Provide accurate, structured, and pedagogical explanations. Break down complex ideas into intuitive steps.
2. Grounded Truth: Base your answers primarily on the provided source documents. When referencing materials, cite the document name.
3. Clarity & Format: Use clean markdown with headings, bold terms, bullet points, and code/math blocks where helpful.
4. Honest Boundaries: If the provided source documents do not contain enough information to fully answer a question, state what is known from the text, and clarify what is general academic knowledge.
"""

def format_context_blocks(retrieved_chunks: List[Dict[str, Any]]) -> str:
    """
    Format retrieved document chunks into structured context blocks:
    --- [SOURCE DOCUMENT #N: filename (Section X)] ---
    <content>
    """
    if not retrieved_chunks:
        return "No relevant source document excerpts found for this query."

    blocks = []
    for idx, item in enumerate(retrieved_chunks, 1):
        meta = item.get("metadata", {})
        filename = meta.get("filename", "Unknown Document")
        chunk_idx = meta.get("chunk_index", 0)
        content = item.get("text", "").strip()

        header = f"--- [SOURCE DOCUMENT #{idx}: {filename} (Section {chunk_idx})] ---"
        blocks.append(f"{header}\n{content}")

    return "\n\n".join(blocks)


def build_tutor_messages(
    query: str,
    context_blocks: str,
    pruned_history: list,
) -> List[Dict[str, str]]:
    """
    Build structured message sequence for chat completion with the tutor persona.
    """
    system_content = f"{ACADEMIC_TUTOR_SYSTEM_PROMPT}\n\n=== RELEVANT COURSE MATERIALS ===\n{context_blocks}\n================================="

    messages = [{"role": "system", "content": system_content}]

    for msg in pruned_history:
        messages.append({
            "role": msg.role,
            "content": msg.content
        })

    messages.append({
        "role": "user",
        "content": query
    })

    return messages


def build_quiz_prompt(topic: str, num_questions: int, context_blocks: str) -> str:
    """
    Construct JSON-enforcing prompt for generating multiple-choice quizzes.
    """
    return f"""You are an assessment engine for students. Generate exactly {num_questions} high-quality multiple-choice questions on the topic: "{topic}".

Base the questions on these source document excerpts when available:
=== COURSE MATERIALS ===
{context_blocks}
========================

Requirements:
- Generate exactly {num_questions} questions.
- Each question must have exactly 4 plausible options labeled "A", "B", "C", and "D" or formatted clearly.
- Specify the correct_answer (e.g., "A", "B", "C", or "D" or full option text).
- Include an educational "explanation" that clearly clarifies why the answer is correct.
- Respond with pure JSON ONLY. Do NOT wrap in ```json or ``` markdown fences. Do NOT include greeting or closing text.

Schema:
{{
  "topic": "{topic}",
  "questions": [
    {{
      "id": 1,
      "question": "What is ...?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "Option A",
      "explanation": "Because ..."
    }}
  ]
}}
"""


def build_quiz_retry_prompt(original_response: str, error_detail: str) -> str:
    """
    Strict retry prompt to correct malformed JSON.
    """
    return f"""The previous JSON response was invalid or failed validation with the following error:
{error_detail}

Here was the raw output:
{original_response}

Please fix all syntax and schema errors and output ONLY valid, parsable JSON conforming to the schema. No markdown formatting, no text before or after the JSON:
{{
  "topic": "topic name",
  "questions": [
    {{
      "id": 1,
      "question": "question text",
      "options": ["A", "B", "C", "D"],
      "correct_answer": "correct option",
      "explanation": "explanation text"
    }}
  ]
}}
"""

