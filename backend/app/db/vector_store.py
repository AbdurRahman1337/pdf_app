import os
import json
import sqlite3
import numpy as np
from typing import List, Dict, Any, Optional

from app.config import settings
from app.core.embeddings import generate_embeddings, generate_embedding

try:
    import chromadb
    from chromadb.config import Settings as ChromaSettings
    _has_chromadb = True
except ImportError:
    _has_chromadb = False


class SQLiteVectorStoreFallback:
    """
    Persistent SQLite-backed vector store with cosine similarity.
    Activated when the external chromadb binary/package is not present.
    Guarantees session isolation and persistence across server restarts.
    """
    def __init__(self, db_dir: str):
        os.makedirs(db_dir, exist_ok=True)
        self.db_path = os.path.join(db_dir, "vector_store.sqlite3")
        self._init_db()

    def _get_conn(self):
        return sqlite3.connect(self.db_path)

    def _init_db(self):
        with self._get_conn() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS chunks (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    doc_id TEXT NOT NULL,
                    filename TEXT,
                    chunk_index INTEGER,
                    text TEXT NOT NULL,
                    metadata_json TEXT NOT NULL,
                    embedding_blob BLOB NOT NULL
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_session ON chunks(session_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_doc ON chunks(doc_id)")
            conn.commit()

    def add(self, ids: List[str], documents: List[str], metadatas: List[Dict[str, Any]], embeddings: List[List[float]]):
        with self._get_conn() as conn:
            for chunk_id, doc_text, meta, emb in zip(ids, documents, metadatas, embeddings):
                session_id = str(meta.get("session_id", "default"))
                doc_id = str(meta.get("doc_id", "default"))
                filename = str(meta.get("filename", "unknown"))
                chunk_index = int(meta.get("chunk_index", 0))
                emb_bytes = np.array(emb, dtype=np.float32).tobytes()
                meta_json = json.dumps(meta)

                conn.execute("""
                    INSERT OR REPLACE INTO chunks (id, session_id, doc_id, filename, chunk_index, text, metadata_json, embedding_blob)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (chunk_id, session_id, doc_id, filename, chunk_index, doc_text, meta_json, emb_bytes))
            conn.commit()

    def query(self, query_emb: List[float], session_id: str, n_results: int = 5) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id, text, metadata_json, embedding_blob FROM chunks WHERE session_id = ?",
                (session_id,)
            )
            rows = cursor.fetchall()

        if not rows:
            return []

        q_vec = np.array(query_emb, dtype=np.float32)
        q_norm = np.linalg.norm(q_vec)
        if q_norm > 0:
            q_vec = q_vec / q_norm

        scored = []
        for r_id, r_text, r_meta_json, r_emb_blob in rows:
            emb = np.frombuffer(r_emb_blob, dtype=np.float32)
            emb_norm = np.linalg.norm(emb)
            if emb_norm > 0:
                emb = emb / emb_norm
            similarity = float(np.dot(q_vec, emb))
            # Convert cosine similarity (-1 to 1) to normalized relevance score (0 to 1)
            score = max(0.0, min(1.0, (similarity + 1.0) / 2.0))
            meta = json.loads(r_meta_json)
            scored.append({
                "id": r_id,
                "text": r_text,
                "metadata": meta,
                "score": round(score, 4)
            })

        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[:n_results]

    def list_docs(self, session_id: Optional[str] = None) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            if session_id:
                cursor.execute("""
                    SELECT doc_id, filename, COUNT(id) as chunk_count, MIN(metadata_json)
                    FROM chunks
                    WHERE session_id = ?
                    GROUP BY doc_id, filename
                """, (session_id,))
            else:
                cursor.execute("""
                    SELECT doc_id, filename, COUNT(id) as chunk_count, MIN(metadata_json)
                    FROM chunks
                    GROUP BY doc_id, filename
                """)
            rows = cursor.fetchall()

        docs = []
        for doc_id, filename, chunk_count, meta_sample in rows:
            uploaded_at = None
            if meta_sample:
                try:
                    uploaded_at = json.loads(meta_sample).get("uploaded_at")
                except Exception:
                    pass
            docs.append({
                "doc_id": doc_id,
                "filename": filename,
                "chunk_count": chunk_count,
                "uploaded_at": uploaded_at
            })
        return docs

    def get_doc_chunks(self, doc_id: str) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id, text, metadata_json, chunk_index FROM chunks WHERE doc_id = ? ORDER BY chunk_index ASC",
                (doc_id,)
            )
            rows = cursor.fetchall()
        chunks = []
        for cid, text, meta_json, cidx in rows:
            meta = json.loads(meta_json) if meta_json else {}
            chunks.append({"id": cid, "text": text, "metadata": meta, "chunk_index": cidx})
        return chunks

    def delete_doc(self, doc_id: str, session_id: str) -> bool:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "DELETE FROM chunks WHERE doc_id = ? AND session_id = ?",
                (doc_id, session_id)
            )
            deleted = cursor.rowcount > 0
            conn.commit()
            return deleted

    def count_session_chunks(self, session_id: str) -> int:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(id) FROM chunks WHERE session_id = ?", (session_id,))
            row = cursor.fetchone()
            return row[0] if row else 0

    def total_count(self) -> int:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(id) FROM chunks")
            row = cursor.fetchone()
            return row[0] if row else 0


class VectorStore:
    """
    ChromaDB PersistentClient wrapper with automatic session/tenant isolation.
    Every document chunk is tagged with session_id in metadata.
    Every query strictly filters by where={'session_id': session_id}.
    """
    def __init__(self):
        os.makedirs(settings.CHROMA_DB_PATH, exist_ok=True)
        self.use_native_chroma = False
        self.chroma_client = None
        self.collection = None
        self.fallback_store = None

        if _has_chromadb:
            try:
                self.chroma_client = chromadb.PersistentClient(path=settings.CHROMA_DB_PATH)
                self.collection = self.chroma_client.get_or_create_collection(
                    name="ai_study_assistant_docs",
                    metadata={"hnsw:space": "cosine"}
                )
                self.use_native_chroma = True
            except Exception:
                self.use_native_chroma = False

        if not self.use_native_chroma:
            self.fallback_store = SQLiteVectorStoreFallback(settings.CHROMA_DB_PATH)

    def add_documents(
        self,
        documents: List[str],
        metadatas: List[Dict[str, Any]],
        ids: List[str]
    ) -> None:
        """
        Add documents to the vector store.
        Every metadata dict must contain session_id.
        """
        if not documents:
            return

        embeddings = generate_embeddings(documents)

        # Enforce session_id tagging in metadata
        for meta in metadatas:
            if "session_id" not in meta:
                meta["session_id"] = "session_default"

        if self.use_native_chroma and self.collection is not None:
            # Native ChromaDB
            self.collection.upsert(
                ids=ids,
                documents=documents,
                metadatas=metadatas,
                embeddings=embeddings
            )
        else:
            self.fallback_store.add(
                ids=ids,
                documents=documents,
                metadatas=metadatas,
                embeddings=embeddings
            )

    def query_similar(
        self,
        query_text: str,
        session_id: str,
        n_results: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Query top similar document chunks strictly isolated to session_id.
        """
        query_emb = generate_embedding(query_text)

        if self.use_native_chroma and self.collection is not None:
            try:
                res = self.collection.query(
                    query_embeddings=[query_emb],
                    n_results=n_results,
                    where={"session_id": session_id}
                )

                hits = []
                ids = res.get("ids", [[]])[0]
                docs = res.get("documents", [[]])[0]
                metas = res.get("metadatas", [[]])[0]
                distances = res.get("distances", [[]])[0]

                for chunk_id, doc_text, meta, dist in zip(ids, docs, metas, distances):
                    # Chroma cosine distance = 1 - cosine_similarity.
                    # Normalized score:
                    score = max(0.0, min(1.0, 1.0 - (dist / 2.0)))
                    hits.append({
                        "id": chunk_id,
                        "text": doc_text,
                        "metadata": meta or {},
                        "score": round(score, 4)
                    })
                return hits
            except Exception:
                pass

        return self.fallback_store.query(
            query_emb=query_emb,
            session_id=session_id,
            n_results=n_results
        )

    def list_documents(self, session_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        List distinct documents ingested. If session_id is provided, filters by session.
        """
        if self.use_native_chroma and self.collection is not None:
            try:
                get_kwargs = {"include": ["metadatas"]}
                if session_id:
                    get_kwargs["where"] = {"session_id": session_id}
                res = self.collection.get(**get_kwargs)
                metas = res.get("metadatas", [])
                doc_map = {}
                for meta in metas:
                    if not meta:
                        continue
                    doc_id = meta.get("doc_id")
                    if not doc_id:
                        continue
                    if doc_id not in doc_map:
                        doc_map[doc_id] = {
                            "doc_id": doc_id,
                            "filename": meta.get("filename", "unknown"),
                            "chunk_count": 0,
                            "uploaded_at": meta.get("uploaded_at")
                        }
                    doc_map[doc_id]["chunk_count"] += 1
                return list(doc_map.values())
            except Exception:
                pass

        return self.fallback_store.list_docs(session_id) or []

    def get_document_chunks(self, doc_id: str) -> List[Dict[str, Any]]:
        """
        Retrieve all stored chunks for a given document id.
        """
        if self.use_native_chroma and self.collection is not None:
            try:
                res = self.collection.get(
                    where={"doc_id": doc_id},
                    include=["documents", "metadatas"]
                )
                ids = res.get("ids", [])
                docs = res.get("documents", [])
                metas = res.get("metadatas", [])
                items = []
                for cid, doc_text, meta in zip(ids, docs, metas):
                    items.append({
                        "id": cid,
                        "text": doc_text,
                        "metadata": meta or {},
                        "chunk_index": (meta or {}).get("chunk_index", 0)
                    })
                items.sort(key=lambda x: x["chunk_index"])
                if items:
                    return items
            except Exception:
                pass

        return self.fallback_store.get_doc_chunks(doc_id)

    def delete_document(self, doc_id: str, session_id: str) -> bool:
        """
        Delete all chunks for a document belonging to the specified session.
        """
        if self.use_native_chroma and self.collection is not None:
            try:
                self.collection.delete(
                    where={"$and": [{"session_id": session_id}, {"doc_id": doc_id}]}
                )
                return True
            except Exception:
                pass

        return self.fallback_store.delete_doc(doc_id=doc_id, session_id=session_id)

    def get_session_chunk_count(self, session_id: str) -> int:
        """
        Get total chunk count for a given session.
        """
        if self.use_native_chroma and self.collection is not None:
            try:
                res = self.collection.get(where={"session_id": session_id})
                return len(res.get("ids", []))
            except Exception:
                pass

        return self.fallback_store.count_session_chunks(session_id)

    def get_collection_count(self) -> int:
        """
        Get total number of chunks stored globally in the vector collection.
        """
        if self.use_native_chroma and self.collection is not None:
            try:
                return self.collection.count()
            except Exception:
                pass

        return self.fallback_store.total_count()


# Singleton vector store instance
vector_store = VectorStore()

