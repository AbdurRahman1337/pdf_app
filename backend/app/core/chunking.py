import math
from typing import List, Dict, Any, Optional
from app.config import settings

# Lazy import of tiktoken with word-approximation fallback
try:
    import tiktoken
    _has_tiktoken = True
except ImportError:
    _has_tiktoken = False


def get_token_chunks(
    text: str,
    doc_id: str,
    chunk_size: int = settings.CHUNK_SIZE,
    chunk_overlap: int = settings.CHUNK_OVERLAP,
    base_metadata: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """
    Split raw text into ~500-token chunks with 50-token overlap using tiktoken cl100k_base.
    Falls back to word approximation if tiktoken is not installed.
    Preserves chunk_index, doc_id, and passed metadata.
    """
    if not text or not text.strip():
        return []

    base_meta = base_metadata.copy() if base_metadata else {}
    chunks = []

    if _has_tiktoken:
        try:
            tokenizer = tiktoken.get_encoding("cl100k_base")
            token_ids = tokenizer.encode(text)
            total_tokens = len(token_ids)

            step = max(1, chunk_size - chunk_overlap)
            chunk_index = 0

            for start_idx in range(0, total_tokens, step):
                end_idx = min(start_idx + chunk_size, total_tokens)
                slice_ids = token_ids[start_idx:end_idx]
                chunk_str = tokenizer.decode(slice_ids).strip()

                if chunk_str:
                    metadata = {
                        **base_meta,
                        "doc_id": doc_id,
                        "chunk_index": chunk_index,
                        "token_count": len(slice_ids),
                    }
                    chunk_id = f"{doc_id}_chunk_{chunk_index}"
                    chunks.append({
                        "id": chunk_id,
                        "text": chunk_str,
                        "metadata": metadata,
                    })
                    chunk_index += 1

                if end_idx >= total_tokens:
                    break

            return chunks
        except Exception:
            # Fallback to word approximation on any unexpected tokenizer exception
            pass

    # Word approximation fallback: ~0.75 words per token (500 tokens ≈ 375 words, 50 overlap ≈ 38 words)
    words_per_chunk = max(20, int(chunk_size * 0.75))
    overlap_words = max(5, int(chunk_overlap * 0.75))
    step = max(1, words_per_chunk - overlap_words)

    words = text.split()
    total_words = len(words)
    chunk_index = 0

    for start_idx in range(0, total_words, step):
        end_idx = min(start_idx + words_per_chunk, total_words)
        chunk_words = words[start_idx:end_idx]
        chunk_str = " ".join(chunk_words).strip()

        if chunk_str:
            metadata = {
                **base_meta,
                "doc_id": doc_id,
                "chunk_index": chunk_index,
                "token_count": int(len(chunk_words) / 0.75),
            }
            chunk_id = f"{doc_id}_chunk_{chunk_index}"
            chunks.append({
                "id": chunk_id,
                "text": chunk_str,
                "metadata": metadata,
            })
            chunk_index += 1

        if end_idx >= total_words:
            break

    return chunks

