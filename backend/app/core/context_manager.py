from typing import List, Tuple
from app.config import settings
from app.db.models import ChatMessage

try:
    import tiktoken
    _enc = tiktoken.get_encoding("cl100k_base")
    _has_tiktoken = True
except Exception:
    _has_tiktoken = False


def estimate_token_count(text: str) -> int:
    """
    Estimate token count of a given text string.
    Uses tiktoken cl100k_base if available, else standard 4-chars/token heuristic.
    """
    if not text:
        return 0
    if _has_tiktoken:
        try:
            return len(_enc.encode(text))
        except Exception:
            pass
    # Heuristic fallback: ~4 characters per token
    return max(1, len(text) // 4)


def prune_history_to_token_budget(
    history: List[ChatMessage],
    system_prompt: str,
    context_text: str,
    current_query: str,
    max_context_tokens: int = settings.MAX_CONTEXT_TOKENS,
    response_reservation: int = 1024,
) -> List[ChatMessage]:
    """
    Enforces token budget in reverse-chronological order.
    Prunes the oldest dialogue turns first when the budget is reached.
    Always prioritizes system instructions, retrieved context, and the immediate user query.
    """
    system_tokens = estimate_token_count(system_prompt)
    context_tokens = estimate_token_count(context_text)
    query_tokens = estimate_token_count(current_query)

    fixed_tokens = system_tokens + context_tokens + query_tokens + response_reservation
    available_history_budget = max(0, max_context_tokens - fixed_tokens)

    if available_history_budget <= 0 or not history:
        return []

    # Iterate in reverse chronological order (newest turns first)
    preserved_turns: List[ChatMessage] = []
    used_tokens = 0

    for msg in reversed(history):
        msg_tokens = estimate_token_count(msg.content) + 4  # role overhead
        if used_tokens + msg_tokens <= available_history_budget:
            preserved_turns.append(msg)
            used_tokens += msg_tokens
        else:
            # Budget exhausted, prune remaining older turns
            break

    # Re-order to chronological order
    preserved_turns.reverse()
    return preserved_turns

