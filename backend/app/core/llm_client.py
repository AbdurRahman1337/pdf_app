import asyncio
import logging
from typing import List, Dict, Any, Optional

import httpx
from app.config import settings

logger = logging.getLogger(__name__)


class LLMException(Exception):
    """Custom exception raised when LLM generation fails."""
    pass


class UnifiedLLMClient:
    """
    Unified async LLM client for Google Gemini (and optional Anthropic Claude).
    Directly connects to the Google Gemini API with configurable timeout and retries.
    """
    def __init__(self):
        self.model_name = settings.MODEL_NAME
        self.timeout = settings.LLM_TIMEOUT_SECONDS

    def _get_gemini_model(self) -> str:
        # Default to configured model, standardizing model names
        model = self.model_name.replace("models/", "") if "gemini" in self.model_name else "gemini-2.5-flash"
        return model

    async def _call_gemini_api(self, prompt_text: str, temperature: float) -> str:
        """Calls Google Gemini API via REST endpoint using httpx."""
        api_key = settings.GEMINI_API_KEY or settings.GOOGLE_API_KEY
        if not api_key:
            raise LLMException("GEMINI_API_KEY is not configured in environment or settings.")

        model = self._get_gemini_model()
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

        payload = {
            "contents": [
                {
                    "parts": [{"text": prompt_text}]
                }
            ],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": 4096,
            }
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code != 200:
                raise LLMException(f"Gemini API error (HTTP {resp.status_code}): {resp.text}")
            data = resp.json()
            candidates = data.get("candidates", [])
            if not candidates:
                raise LLMException(f"Gemini API returned no candidates: {data}")
            parts = candidates[0].get("content", {}).get("parts", [])
            if not parts:
                raise LLMException("Gemini API returned empty content parts.")
            return parts[0].get("text", "")

    async def _call_anthropic_api(self, prompt_text: str, temperature: float) -> str:
        """Calls Anthropic Claude API via REST endpoint using httpx."""
        api_key = settings.ANTHROPIC_API_KEY
        if not api_key:
            raise LLMException("ANTHROPIC_API_KEY is not configured in environment or settings.")

        model = self.model_name if "claude" in self.model_name else "claude-3-5-sonnet-20241022"
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        payload = {
            "model": model,
            "max_tokens": 4096,
            "temperature": temperature,
            "messages": [{"role": "user", "content": prompt_text}],
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code != 200:
                raise LLMException(f"Anthropic API returned HTTP {resp.status_code}: {resp.text}")
            data = resp.json()
            content = data.get("content", [])
            if not content:
                raise LLMException("Anthropic API returned empty content.")
            return content[0].get("text", "")

    async def _execute_single_attempt(self, prompt_text: str, temperature: float) -> str:
        """Executes generation against configured LLM provider (default: Google Gemini)."""
        # 1. Google Gemini
        if settings.GEMINI_API_KEY or settings.GOOGLE_API_KEY:
            return await self._call_gemini_api(prompt_text, temperature)

        # 2. Anthropic Claude (if configured)
        if settings.ANTHROPIC_API_KEY:
            return await self._call_anthropic_api(prompt_text, temperature)

        raise LLMException("No LLM API Key found. Please set GEMINI_API_KEY in your .env configuration.")

    async def generate(self, prompt_text: str, temperature: float = 0.7) -> str:
        """
        Executes generation with timeout and exponential backoff retry.
        Raises LLMException upon unrecoverable API failure.
        """
        retries = 2
        delays = [1.0, 2.0]
        last_exception = None

        for attempt in range(retries + 1):
            try:
                return await asyncio.wait_for(
                    self._execute_single_attempt(prompt_text, temperature),
                    timeout=float(self.timeout)
                )
            except asyncio.TimeoutError:
                last_exception = LLMException(f"LLM request timed out after {self.timeout}s.")
                logger.warning(f"LLM request timed out on attempt {attempt + 1}/{retries + 1}")
                if attempt < retries:
                    await asyncio.sleep(delays[attempt])
            except Exception as exc:
                last_exception = exc
                logger.warning(f"LLM request failed on attempt {attempt + 1}/{retries + 1}: {exc}")
                if attempt < retries:
                    await asyncio.sleep(delays[attempt])

        if isinstance(last_exception, LLMException):
            raise last_exception
        raise LLMException(f"LLM generation failed after {retries + 1} attempts: {last_exception}")


llm_client = UnifiedLLMClient()
