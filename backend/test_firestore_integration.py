import asyncio
import io
import uuid
from fastapi.testclient import TestClient

from app.main import app
from app.db.firestore_service import firestore_service

client = TestClient(app)


def test_firestore_service_direct():
    print("\n--- Testing FirestoreService Direct Methods ---")
    test_id = f"test_doc_{uuid.uuid4().hex[:8]}"
    
    # 1. Save Book
    saved = firestore_service.save_book({
        "id": test_id,
        "title": "Introduction to Algorithms.pdf",
        "original_name": "Introduction to Algorithms.pdf",
        "session_id": "test_user_session",
        "size_bytes": 102400,
        "chunk_count": 8,
        "total_characters": 16000,
        "process_status": "COMPLETED",
    })
    assert saved is True
    print(f"✓ Book saved with ID: {test_id}")

    # 2. Get Book
    book = firestore_service.get_book(test_id)
    assert book is not None
    assert book["title"] == "Introduction to Algorithms.pdf"
    assert book["chunk_count"] == 8
    print(f"✓ Book retrieved: {book['title']}, chunk_count={book['chunk_count']}")

    # 3. Record Operations
    firestore_service.record_book_operation(
        doc_id=test_id,
        op_type="UPLOAD_AND_INDEX",
        details={"chunk_count": 8, "total_characters": 16000}
    )
    firestore_service.record_book_operation(
        doc_id=test_id,
        op_type="RAG_QUERY",
        details={"question": "What is Big-O notation?", "sources_count": 2}
    )
    
    book_after_ops = firestore_service.get_book(test_id)
    assert len(book_after_ops.get("operations", [])) == 2
    assert book_after_ops["stats"]["query_count"] == 1
    print(f"✓ Recorded 2 operations successfully. Current ops: {[op['type'] for op in book_after_ops['operations']]}")

    # 4. Update Summary & Vocabulary
    firestore_service.update_book_summary(
        doc_id=test_id,
        summary_brief="Foundational concepts of asymptotic notation and algorithm design.",
        main_points="• Divide and conquer\n• Dynamic programming",
        vocabulary=[
            {"term": "Big-O", "definition": "Upper bound of time complexity."},
            {"term": "Recursion", "definition": "Function calling itself."}
        ]
    )
    
    book_with_summary = firestore_service.get_book(test_id)
    assert book_with_summary["summary"]["summary_brief"].startswith("Foundational concepts")
    assert len(book_with_summary["vocabulary"]) == 2
    print(f"✓ Summary & vocabulary stored: {len(book_with_summary['vocabulary'])} terms")

    # 5. List Books
    books_list = firestore_service.list_books(session_id="test_user_session")
    assert any(b.get("id") == test_id for b in books_list)
    print(f"✓ Book listed in session 'test_user_session' (total in session: {len(books_list)})")

    # 6. Delete Book
    deleted = firestore_service.delete_book(test_id)
    assert deleted is True
    assert firestore_service.get_book(test_id) is None
    print(f"✓ Book successfully deleted")


def test_api_endpoints_firestore_integration():
    print("\n--- Testing API Endpoints with Firestore Synchronization ---")
    headers = {
        "X-Session-ID": "session_test_student_123",
        "Authorization": "Bearer test_firebase_token"
    }

    # 1. Upload via /pdf/upload
    pdf_content = (
        b"%PDF-1.4\n"
        b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"
        b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n"
        b"3 0 obj << /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >> endobj\n"
        b"4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n"
        b"5 0 obj << /Length 44 >> stream\n"
        b"BT /F1 12 Tf 100 700 Td (Deep Learning and Neural Networks) Tj ET\n"
        b"endstream endobj\n"
        b"xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000227 00000 n \n0000000301 00000 n \n"
        b"trailer << /Size 6 /Root 1 0 R >>\nstartxref\n395\n%%EOF\n"
    )
    files = {
        "file": ("Deep_Learning_Basics.pdf", io.BytesIO(pdf_content), "application/pdf")
    }
    
    upload_res = client.post("/api/v1/pdf/upload", files=files, headers=headers)
    assert upload_res.status_code == 200, f"Upload failed: {upload_res.text}"
    uploaded_data = upload_res.json()
    doc_id = uploaded_data["id"]
    print(f"✓ /api/v1/pdf/upload succeeded: doc_id={doc_id}, file={uploaded_data['original_name']}")

    # 2. Check Book in Firestore
    firestore_book = firestore_service.get_book(doc_id)
    assert firestore_book is not None
    assert firestore_book["original_name"] == "Deep_Learning_Basics.pdf"
    assert len(firestore_book.get("operations", [])) >= 1
    assert firestore_book["operations"][0]["type"] == "UPLOAD_AND_INDEX"
    print(f"✓ Verified book stored in Firestore 'books' with operation: {firestore_book['operations'][0]['type']}")

    # 3. List via /api/v1/pdf/list
    list_res = client.get("/api/v1/pdf/list", headers=headers)
    assert list_res.status_code == 200
    pdf_items = list_res.json()
    assert any(item["id"] == doc_id for item in pdf_items)
    print(f"✓ /api/v1/pdf/list returned book (total books for session: {len(pdf_items)})")

    # 4. Get Status
    status_res = client.get(f"/api/v1/pdf/{doc_id}/status", headers=headers)
    assert status_res.status_code == 200
    assert status_res.json()["process_status"] == "COMPLETED"
    print(f"✓ /api/v1/pdf/{doc_id}/status returned COMPLETED")

    # 5. Query /api/v1/ai/query
    query_res = client.post(
        "/api/v1/ai/query",
        json={"pdf_id": doc_id, "question": "What is deep learning?"},
        headers=headers
    )
    assert query_res.status_code == 200
    print(f"✓ /api/v1/ai/query succeeded")

    # Verify RAG_QUERY operation was recorded on the book in Firestore
    updated_book = firestore_service.get_book(doc_id)
    op_types = [op["type"] for op in updated_book.get("operations", [])]
    assert "RAG_QUERY" in op_types
    print(f"✓ Verified RAG_QUERY recorded in Firestore operations: {op_types}")

    # Clean up
    del_res = client.delete(f"/documents/{doc_id}", headers=headers)
from app.db.google_drive_service import google_drive_service


def test_google_drive_service_direct():
    print("\n--- Testing Google Drive Service ---")
    txt_content = b"Superposition and entanglement are core foundations of quantum information processing."
    result = google_drive_service.upload_file(
        filename="Quantum_Notes.txt",
        file_bytes=txt_content,
        mime_type="text/plain"
    )
    assert result["success"] is True
    assert "drive_file_id" in result
    assert "drive_web_view_link" in result
    print(f"✓ Google Drive upload simulated/performed successfully: ID={result['drive_file_id']}, Link={result['drive_web_view_link']}")


if __name__ == "__main__":
    test_google_drive_service_direct()
    test_firestore_service_direct()
    print("\n🎉 ALL GOOGLE DRIVE & FIRESTORE INTEGRATION TESTS PASSED!")
