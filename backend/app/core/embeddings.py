import hashlib
import math
from typing import List, Optional

_model = None
_model_attempted = False
EMBEDDING_DIMENSION = 384


def get_embedding_model():
    """
    SentenceTransformer lazy loader for 'all-MiniLM-L6-v2'.
    Loads model into memory on demand to optimize startup latency and memory footprint.
    """
    global _model, _model_attempted
    if _model is not None:
        return _model

    if not _model_attempted:
        _model_attempted = True
        try:
            from sentence_transformers import SentenceTransformer
            _model = SentenceTransformer("all-MiniLM-L6-v2")
        except Exception:
            _model = None

    return _model


def _fallback_deterministic_embedding(text: str) -> List[float]:
    """
    Generates a deterministic 384-dimensional normalized dense embedding
    for environments without PyTorch / sentence-transformers installed.
    Uses token hashing across n-grams and character distributions.
    """
    vec = [0.0] * EMBEDDING_DIMENSION
    tokens = text.lower().split()
    
    if not tokens:
        vec[0] = 1.0
        return vec

    # Unigrams and bigrams hashing
    for i, token in enumerate(tokens):
        # Hash token into vector dimensions
        h = int(hashlib.sha256(token.encode("utf-8")).hexdigest(), 16)
        dim_idx = h % EMBEDDING_DIMENSION
        weight = 1.0 + (1.0 / (1.0 + math.log(1 + len(token))))
        vec[dim_idx] += weight

        # Bigram
        if i + 1 < len(tokens):
            bigram = f"{token}_{tokens[i+1]}"
            h_bi = int(hashlib.md5(bigram.encode("utf-8")).hexdigest(), 16)
            vec[h_bi % EMBEDDING_DIMENSION] += 1.5

    # L2 normalize
    norm = math.sqrt(sum(x * x for x in vec))
    if norm > 0:
        vec = [x / norm for x in vec]
    else:
        vec[0] = 1.0

    return vec


def generate_embeddings(texts: List[str]) -> List[List[float]]:
    """
    Generate dense 384-dimensional vector embeddings for a list of text strings.
    """
    if not texts:
        return []

    model = get_embedding_model()
    if model is not None:
        try:
            embeddings = model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
            return embeddings.tolist()
        except Exception:
            pass

    # Fallback path
    return [_fallback_deterministic_embedding(t) for t in texts]


def generate_embedding(text: str) -> List[float]:
    """
    Generate dense vector embedding for a single text string.
    """
    return generate_embeddings([text])[0]

