import io
import asyncio
import httpx
from fastapi.testclient import TestClient

from app.main import app
from app.config import settings

client = TestClient(app)

def test_health():
    print("Testing GET /health...")
    resp = client.get("/health")
    assert resp.status_code == 200, f"Health check failed: {resp.text}"
    data = resp.json()
    assert data["status"] == "healthy"
    assert "collection_count" in data
    print(f"  [PASS] /health returned status={data['status']}, collection_count={data['collection_count']}")


import pytest


def _create_test_doc():
    sample_text = """
    # Principles of Operating Systems: Concurrency and Synchronization

    Concurrency refers to the ability of different parts or units of a program, algorithm, or problem
    to be executed out-of-order or in partial order, without affecting the outcome.
    
    A race condition occurs when two or more threads or processes access shared data and try to change it
    at the same time. Because the thread scheduling algorithm can swap between threads at any time,
    you don't know the order in which the threads will attempt to access the shared data.

    A mutex (mutual exclusion object) is a synchronization primitive that grants exclusive access
    to the shared resource to only one thread at a time.
    Semaphores are integer variables used to control access to common resources by multiple processes.
    """
    import uuid
    session_id = f"test_session_user_{uuid.uuid4().hex[:8]}"
    files = {"file": ("os_notes.txt", sample_text.encode("utf-8"), "text/plain")}
    data = {"session_id": session_id}

    resp = client.post("/upload", files=files, data=data, headers={"X-Session-ID": session_id})
    assert resp.status_code == 200, f"Upload text failed: {resp.text}"
    upload_res = resp.json()
    assert upload_res["total_chunks"] >= 1
    doc_id = upload_res["doc_id"]
    return {"doc_id": doc_id, "session_id": session_id}


@pytest.fixture
def uploaded_doc():
    return _create_test_doc()


def test_upload_text_and_pdf():
    print("Testing POST /upload with plain text notes...")
    sample_text = """
    # Principles of Operating Systems: Concurrency and Synchronization

    Concurrency refers to the ability of different parts or units of a program, algorithm, or problem
    to be executed out-of-order or in partial order, without affecting the outcome.
    
    A race condition occurs when two or more threads or processes access shared data and try to change it
    at the same time. Because the thread scheduling algorithm can swap between threads at any time,
    you don't know the order in which the threads will attempt to access the shared data.

    A mutex (mutual exclusion object) is a synchronization primitive that grants exclusive access
    to the shared resource to only one thread at a time.
    Semaphores are integer variables used to control access to common resources by multiple processes.
    """
    
    import uuid
    session_id = f"test_session_user_{uuid.uuid4().hex[:8]}"
    files = {"file": ("os_notes.txt", sample_text.encode("utf-8"), "text/plain")}
    data = {"session_id": session_id}

    resp = client.post("/upload", files=files, data=data, headers={"X-Session-ID": session_id})
    assert resp.status_code == 200, f"Upload text failed: {resp.text}"
    upload_res = resp.json()
    assert upload_res["total_chunks"] >= 1
    doc_id = upload_res["doc_id"]
    print(f"  [PASS] Uploaded {upload_res['filename']}: doc_id={doc_id}, chunks={upload_res['total_chunks']}")

    # Test GET /documents
    print("Testing GET /documents...")
    doc_resp = client.get("/documents", headers={"X-Session-ID": session_id})
    assert doc_resp.status_code == 200
    docs = doc_resp.json()
    assert docs["total_documents"] >= 1
    assert any(d["doc_id"] == doc_id for d in docs["documents"])
    print(f"  [PASS] Found {docs['total_documents']} documents in session with {docs['total_chunks']} chunks.")


def test_chat_interaction(uploaded_doc):
    session_id = uploaded_doc["session_id"] if isinstance(uploaded_doc, dict) else uploaded_doc
    print("Testing POST /chat RAG pipeline...")
    payload = {
        "message": "What is a race condition and how does a mutex help solve it?",
        "history": [],
        "session_id": session_id
    }
    resp = client.post("/chat", json=payload, headers={"X-Session-ID": session_id})
    assert resp.status_code == 200, f"Chat failed: {resp.text}"
    chat_data = resp.json()
    assert "answer" in chat_data
    assert len(chat_data["sources"]) > 0
    print(f"  [PASS] Chat answered successfully. Grounded with {len(chat_data['sources'])} citation source(s):")
    for s in chat_data["sources"]:
        print(f"    - Source: {s['filename']} (Score: {s['score']})")


def test_quiz_generation(uploaded_doc):
    session_id = uploaded_doc["session_id"] if isinstance(uploaded_doc, dict) else uploaded_doc
    print("Testing POST /quiz/generate...")
    payload = {
        "topic": "Concurrency and Mutex Synchronization",
        "num_questions": 3,
        "session_id": session_id
    }
    resp = client.post("/quiz/generate", json=payload, headers={"X-Session-ID": session_id})
    assert resp.status_code == 200, f"Quiz generation failed: {resp.text}"
    quiz_data = resp.json()
    assert len(quiz_data["questions"]) == 3
    for q in quiz_data["questions"]:
        assert len(q["options"]) == 4
        assert q["correct_answer"]
        assert q["explanation"]
    print(f"  [PASS] Generated {len(quiz_data['questions'])} validated quiz questions for topic '{quiz_data['topic']}'.")


def test_delete_document(uploaded_doc):
    if isinstance(uploaded_doc, dict):
        doc_id = uploaded_doc["doc_id"]
        session_id = uploaded_doc["session_id"]
    else:
        doc_id, session_id = uploaded_doc
    print(f"Testing DELETE /documents/{doc_id}...")
    resp = client.delete(f"/documents/{doc_id}", headers={"X-Session-ID": session_id})
    assert resp.status_code == 200
    print(f"  [PASS] Successfully deleted document {doc_id}.")

    # Verify document count decreased
    doc_resp = client.get("/documents", headers={"X-Session-ID": session_id})
    assert any(d["doc_id"] == doc_id for d in doc_resp.json()["documents"]) is False
    print(f"  [PASS] Document successfully removed from session.")


def test_rate_limiter_and_error_handling():
    print("Testing Rate Limiter and Error Handlers...")
    # Test invalid file format
    resp = client.post(
        "/upload",
        files={"file": ("malicious.exe", b"binary content", "application/octet-stream")},
        headers={"X-Session-ID": "test_err_session"}
    )
    assert resp.status_code == 400
    print(f"  [PASS] Unsupported file returned HTTP 400 as expected: {resp.json()['detail']}")

    # Check X-RateLimit headers
    h_resp = client.get("/documents")
    assert "x-ratelimit-limit" in h_resp.headers
    assert "x-ratelimit-remaining" in h_resp.headers
    print(f"  [PASS] Rate limit headers present: Limit={h_resp.headers.get('x-ratelimit-limit')}, Remaining={h_resp.headers.get('x-ratelimit-remaining')}")


def test_mobile_compat_endpoints():
    print("Testing Mobile Compatibility Endpoints (/api/v1)...")
    # 1. Test mobile upload
    sample_notes = "Deep Learning is a subset of machine learning based on artificial neural networks."
    files = {"file": ("deep_learning_intro.txt", sample_notes.encode("utf-8"), "text/plain")}
    resp = client.post("/api/v1/pdf/upload", files=files, headers={"X-Session-ID": "mobile_test_session"})
    assert resp.status_code == 200, f"Mobile upload failed: {resp.text}"
    m_doc = resp.json()
    doc_id = m_doc["id"]
    print(f"  [PASS] Mobile upload: id={doc_id}, status={m_doc['process_status']}")

    # 2. Test mobile list
    resp = client.get("/api/v1/pdf/list", headers={"X-Session-ID": "mobile_test_session"})
    assert resp.status_code == 200
    pdf_list = resp.json()
    assert any(p["id"] == doc_id for p in pdf_list)
    print(f"  [PASS] Mobile PDF list returned {len(pdf_list)} item(s)")

    # 3. Test mobile status
    resp = client.get(f"/api/v1/pdf/{doc_id}/status")
    assert resp.status_code == 200
    assert resp.json()["process_status"] == "COMPLETED"
    print(f"  [PASS] Mobile PDF status: COMPLETED")

    # 4. Test mobile details (Summary & Vocab)
    resp = client.get(f"/api/v1/pdf/{doc_id}")
    assert resp.status_code == 200
    details = resp.json()
    assert "summary_brief" in details
    assert "vocabulary" in details
    print(f"  [PASS] Mobile PDF details loaded with brief summary and {len(details['vocabulary'])} vocabulary terms")

    # 5. Test mobile translate
    resp = client.post("/api/v1/ai/translate", json={"text": "Artificial neural networks", "target_language": "es"})
    assert resp.status_code == 200
    print(f"  [PASS] Mobile AI translate returned: {resp.json()['translated_text']}")


if __name__ == "__main__":
    print("==================================================")
    print("Running Comprehensive AI Study Assistant Verification")
    print("==================================================")
    test_health()
    test_upload_text_and_pdf()
    doc_info = _create_test_doc()
    test_chat_interaction(doc_info)
    test_quiz_generation(doc_info)
    test_delete_document(doc_info)
    test_rate_limiter_and_error_handling()
    test_mobile_compat_endpoints()
    print("==================================================")
    print("ALL TESTS (WEB + MOBILE) PASSED WITH 100% SUCCESS!")
    print("==================================================")


