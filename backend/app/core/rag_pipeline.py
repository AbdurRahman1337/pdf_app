from typing import List
from app.db.models import ChatMessage, ChatResponse, DocumentSource
from app.db.vector_store import vector_store
from app.core.prompt_builder import (
    ACADEMIC_TUTOR_SYSTEM_PROMPT,
    format_context_blocks,
    build_tutor_messages,
)
from app.core.context_manager import prune_history_to_token_budget
from app.core.llm_client import llm_client


async def run_rag_pipeline(
    query: str,
    session_id: str,
    history: Optional[List[ChatMessage]] = None,
) -> ChatResponse:
    if history is None:
        history = []
    """
    Coordinates the full RAG pipeline:
    1. Vector similarity retrieval (filtered by session_id)
    2. Document source citation mapping
    3. Context block formatting and reverse-chronological token budget enforcement
    4. Tutor prompt construction
    5. Async LLM generation with retry/timeout protection
    6. Returns structured ChatResponse
    """
    # 1. Retrieve top matching chunks from vector store
    retrieved_chunks = vector_store.query_similar(
        query_text=query,
        session_id=session_id,
        n_results=5
    )

    # 2. Map to DocumentSource objects for citation display
    sources: List[DocumentSource] = []
    for chunk in retrieved_chunks:
        meta = chunk.get("metadata", {})
        doc_id = meta.get("doc_id", "doc_unknown")
        filename = meta.get("filename", "Document")
        chunk_idx = meta.get("chunk_index", 0)
        raw_text = chunk.get("text", "")
        # Preview snippet of content
        snippet = (raw_text[:250] + "...") if len(raw_text) > 250 else raw_text
        score = float(chunk.get("score", 0.0))

        sources.append(DocumentSource(
            doc_id=doc_id,
            filename=filename,
            chunk_index=chunk_idx,
            content=snippet,
            score=score
        ))

    # 3. Format context blocks
    context_blocks = format_context_blocks(retrieved_chunks)

    # 4. Prune dialogue history to token budget (MAX_CONTEXT_TOKENS)
    pruned_history = prune_history_to_token_budget(
        history=history,
        system_prompt=ACADEMIC_TUTOR_SYSTEM_PROMPT,
        context_text=context_blocks,
        current_query=query
    )

    # 5. Build prompt
    message_sequence = build_tutor_messages(
        query=query,
        context_blocks=context_blocks,
        pruned_history=pruned_history
    )

    # Combine message sequence into structured prompt string for LLM client
    prompt_parts = []
    for m in message_sequence:
        role_label = m["role"].upper()
        prompt_parts.append(f"[{role_label}]\n{m['content']}")
    full_prompt = "\n\n".join(prompt_parts)

    # 6. LLM generation with retry logic
    answer = await llm_client.generate(full_prompt, temperature=0.7)

    return ChatResponse(
        answer=answer,
        sources=sources,
        session_id=session_id
    )

