import asyncio
import unittest
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.db.google_drive_service import google_drive_service, GoogleDriveServiceException
from app.core.llm_client import llm_client, LLMException

client = TestClient(app)


class TestFullArchitecture(unittest.TestCase):

    def test_health_endpoint(self):
        resp = client.get("/health")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "healthy")
        self.assertIn("collection_count", data)

    def test_google_oauth_url_generation(self):
        resp = client.get("/api/v1/auth/google/url?redirect_uri=pdfapp://oauth")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("url", data)
        self.assertIn("accounts.google.com", data["url"])
        self.assertIn("pdfapp://oauth", data["url"])
        self.assertIn("https://www.googleapis.com/auth/drive.file", data["url"])

    def test_google_oauth_exchange_validation(self):
        # Invalid code should properly reject with 400
        resp = client.post(
            "/api/v1/auth/google/exchange",
            json={"code": "fake_auth_code_12345", "redirect_uri": "pdfapp://oauth"}
        )
        self.assertIn(resp.status_code, [400, 500])

    def test_google_drive_service_mock_removed(self):
        # Verify that google_drive_service does NOT generate fake simulated IDs (gdrive_local_...)
        with self.assertRaises(GoogleDriveServiceException):
            google_drive_service.upload_file(
                filename="test.pdf",
                file_bytes=b"dummy content",
                mime_type="application/pdf",
                user_access_token=None
            )

    def test_offline_generator_removal(self):
        # Verify that LLMClient has no offline heuristic methods
        self.assertFalse(hasattr(llm_client, "_generate_offline_summary_and_vocab"))
        self.assertFalse(hasattr(llm_client, "_extract_all_difficult_vocabulary"))
        self.assertFalse(hasattr(llm_client, "_generate_offline_tutor_response"))

    def test_llm_client_gemini_call_and_parsing(self):
        async def run_test():
            with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
                mock_response = MagicMock()
                mock_response.status_code = 200
                mock_response.json.return_value = {
                    "candidates": [
                        {
                            "content": {
                                "parts": [
                                    {"text": "Photosynthesis is the biochemical process that converts light energy into chemical energy."}
                                ]
                            }
                        }
                    ]
                }
                mock_post.return_value = mock_response

                ans = await llm_client.generate("Explain photosynthesis in one sentence.")
                self.assertIn("Photosynthesis", ans)

        asyncio.run(run_test())

    def test_chat_endpoint_with_gemini(self):
        # 1. Upload sample text note
        note_content = "Cell membranes consist of a lipid bilayer with embedded transport proteins."
        files = {"file": ("biology.txt", note_content.encode("utf-8"), "text/plain")}
        upload_resp = client.post("/upload", files=files, headers={"X-Session-ID": "test_gemini_session"})
        self.assertEqual(upload_resp.status_code, 200)

        # 2. Mock Gemini response for /chat
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {"text": "Cell membranes are composed of a lipid bilayer with transport proteins that maintain cellular integrity."}
                            ]
                        }
                    }
                ]
            }
            mock_post.return_value = mock_response

            chat_resp = client.post(
                "/chat",
                json={
                    "message": "What are cell membranes made of?",
                    "history": [],
                    "session_id": "test_gemini_session"
                },
                headers={"X-Session-ID": "test_gemini_session"}
            )
            self.assertEqual(chat_resp.status_code, 200)
            data = chat_resp.json()
            self.assertIn("answer", data)
            self.assertIn("lipid bilayer", data["answer"])
            self.assertGreater(len(data["sources"]), 0)

    def test_quiz_generate_endpoint(self):
        # Mock Gemini JSON response for quiz
        mock_quiz_json = (
            '[\n'
            '  {\n'
            '    "id": 1,\n'
            '    "question": "What is the primary structure of cell membranes?",\n'
            '    "options": ["Lipid bilayer", "Peptidoglycan", "Cellulose", "Chitin"],\n'
            '    "correct_answer": "Lipid bilayer",\n'
            '    "explanation": "Cell membranes are primarily composed of a phospholipid bilayer.",\n'
            '    "difficulty": "Easy"\n'
            '  }\n'
            ']'
        )
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {"text": mock_quiz_json}
                            ]
                        }
                    }
                ]
            }
            mock_post.return_value = mock_response

            quiz_resp = client.post(
                "/quiz/generate",
                json={
                    "topic": "Cell Biology",
                    "num_questions": 1,
                    "session_id": "test_gemini_session"
                },
                headers={"X-Session-ID": "test_gemini_session"}
            )
            self.assertEqual(quiz_resp.status_code, 200)
            qdata = quiz_resp.json()
            self.assertEqual(len(qdata["questions"]), 1)
            self.assertEqual(qdata["questions"][0]["correct_answer"], "Lipid bilayer")


if __name__ == "__main__":
    unittest.main()

