from typing import Dict, List, Any, Optional
import httpx
import spacy
import os
import chromadb
import uuid
from sentence_transformers import SentenceTransformer
from app.core.config import settings

class AIService:
    def __init__(self):
        # 1. Load spaCy boundaries
        self.nlp = spacy.load(settings.SPACY_MODEL)
        
        # 2. Lazy load SentenceTransformer embeddings
        self._encoder = None
        
        # 3. Chroma Client
        self.chroma_client = chromadb.HttpClient(
            host=settings.CHROMADB_HOST,
            port=settings.CHROMADB_PORT
        )

    @property
    def encoder(self):
        """Lazy load embeds weights to prevent memory leaks during worker creation."""
        if self._encoder is None:
            self._encoder = SentenceTransformer(settings.EMBEDDINGS_MODEL)
        return self._encoder

    def semantic_chunking(self, text: str, max_tokens: int = 300) -> List[str]:
        """
        Tokenizes text into logical semantic paragraph groups using spaCy boundaries.
        Optimized to break cleanly at sentence splits.
        """
        doc = self.nlp(text)
        chunks = []
        current_chunk = []
        current_tokens = 0

        for sent in doc.sents:
            sent_text = sent.text.strip()
            if not sent_text:
                continue
            
            # Rough token estimate (words + puncts)
            sent_tokens = len(sent_text.split())
            if current_tokens + sent_tokens > max_tokens:
                if current_chunk:
                    chunks.append(" ".join(current_chunk))
                current_chunk = [sent_text]
                current_tokens = sent_tokens
            else:
                current_chunk.append(sent_text)
                current_tokens += sent_tokens

        if current_chunk:
            chunks.append(" ".join(current_chunk))
        return chunks

    def get_chroma_collection(self, collection_name: str = "pdf_chunks"):
        """Get or initialize target Chroma DB collections."""
        return self.chroma_client.get_or_create_collection(name=collection_name)

    def inject_vector_chunks(self, pdf_id: str, chunks: List[str]) -> None:
        """Embeds text paragraphs and index vectors inside ChromaDB stores."""
        if not chunks:
            return

        collection = self.get_chroma_collection()
        embeddings = self.encoder.encode(chunks).tolist()
        
        ids = [f"{pdf_id}_{i}" for i in range(len(chunks))]
        metadatas = [{"pdf_id": pdf_id, "sequence": i} for i in range(len(chunks))]
        
        collection.add(
            embeddings=embeddings,
            documents=chunks,
            ids=ids,
            metadatas=metadatas
        )

    async def summarize_tiers(self, text: str) -> Dict[str, Any]:
        """
        Processes text through local Ollama.
        Applies Map-Reduce tier summaries to save Context Windows memory boundaries.
        """
        # Compress text if too large (e.g. over 8000 words) to avoid context limit
        words = text.split()
        if len(words) > 4000:
            # Map tier: split in half and summarize each, then synthesize
            half = len(words) // 2
            text_1 = " ".join(words[:half])
            text_2 = " ".join(words[half:])
            
            sum_1 = await self._ollama_inference(text_1, "Write a highly condensed summary of this section.")
            sum_2 = await self._ollama_inference(text_2, "Write a highly condensed summary of this section.")
            text = f"Part 1: {sum_1}\n\nPart 2: {sum_2}"

        # Level 1 Main Synthesis
        brief = await self._ollama_inference(
            text, 
            "Provide a brief one-paragraph executive summary of the overall document."
        )
        
        # Level 2 Detailed tiers
        full_analysis = await self._ollama_inference(
            text,
            "Synthesize a highly structured point-by-point summary of the core concepts, themes, and key takeaways."
        )

        return {
            "brief": brief,
            "main_points": full_analysis
        }

    async def extract_vocabulary(self, text: str) -> List[Dict[str, str]]:
        """Synthesizes vocabulary pairs with definitions from texts."""
        words = text.split()[:4000] # Cap text scope for processing speed
        target_text = " ".join(words)
        
        prompt = (
            "Analyze the text and extract 5 to 10 key technical terms or advanced vocabulary words.\n"
            "Output the results STRICTLY in a standard JSON list of objects formats, where "
            "each object has EXACTLY key names 'term' and 'definition'.\n"
            "Do not include any other markdown wrap, comments, or explanations outside the JSON."
        )
        
        raw_output = await self._ollama_inference(target_text, prompt)
        # Handle simple JSON extractors
        import json
        try:
            # Clean possible markdown wrap helpers like ```json
            cleaned = raw_output.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            data = json.loads(cleaned.strip())
            if isinstance(data, list):
                return data
        except Exception:
            pass
        return []

    async def query_rag(self, pdf_id: str, question: str) -> Dict[str, Any]:
        """
        Retrieval Augmented Query. embeds the question, fetches context blocks from Chroma DB,
        performs cosine score filters, and streams answering.
        """
        # Embed inquiry
        query_vector = self.encoder.encode(question).tolist()
        
        collection = self.get_chroma_collection()
        results = collection.query(
            query_embeddings=[query_vector],
            n_results=4,
            where={"pdf_id": pdf_id}
        )
        
        # Parse context
        documents = results.get("documents", [[]])[0]
        distances = results.get("distances", [[]])[0] # Cosine distance metric
        
        # AI cost-optimiser: prune snippets with distance scores > 0.4 (low similarity)
        context_blocks = []
        for doc, dist in zip(documents, distances):
            if dist < 0.45: # Chroma distance L2 threshold (lower is closer)
                context_blocks.append(doc)

        context_text = "\n---\n".join(context_blocks) if context_blocks else "No relevant context found."
        
        system_prompt = (
            f"You are a helpful AI assistant. Answer the user's question accurately based ONLY on the "
            f"following provided PDF document context:\n\n{context_text}\n\n"
            f"If the information is not present block inside the context, explain that clearly "
            f"and do not synthesize false responses."
        )
        
        answer = await self._ollama_inference(question, system_prompt)
        
        return {
            "answer": answer,
            "sources": context_blocks
        }

    async def _ollama_inference(self, prompt: str, system_instruction: str) -> str:
        """Call local Ollama APIs asynchronously."""
        async with httpx.AsyncClient(timeout=60.0) as client:
            payload = {
                "model": settings.OLLAMA_MODEL,
                "prompt": f"System Guidelines: {system_instruction}\nUser Prompt: {prompt}",
                "stream": False
            }
            try:
                response = await client.post(f"{settings.OLLAMA_BASE_URL}/api/generate", json=payload)
                if response.status_code == 200:
                    return response.json().get("response", "").strip()
            except Exception as e:
                return f"Local Ollama Engine Connection Lost. Error: {str(e)}"
        return "Failed generating response from inference engines."

ai_service = AIService()
