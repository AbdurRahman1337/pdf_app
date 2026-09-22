import io
from app.middleware.error_handler import FileParsingError

try:
    import pypdf
    _has_pypdf = True
except ImportError:
    _has_pypdf = False


def extract_text_from_file(filename: str, file_bytes: bytes) -> str:
    """
    Extracts text from binary streams for .pdf (via pypdf), and .txt/.md (UTF-8 / Latin-1).
    Raises FileParsingError if parsing fails or unsupported file type is provided.
    """
    if not file_bytes:
        raise FileParsingError("Uploaded file is empty.")

    lower_name = filename.lower()

    # 1. PDF Parsing
    if lower_name.endswith(".pdf"):
        if not _has_pypdf:
            raise FileParsingError("pypdf engine is not installed to extract PDF text.")

        try:
            stream = io.BytesIO(file_bytes)
            reader = pypdf.PdfReader(stream)
            extracted_pages = []

            for page_idx, page in enumerate(reader.pages):
                page_text = page.extract_text()
                if page_text and page_text.strip():
                    extracted_pages.append(page_text.strip())

            full_text = "\n\n".join(extracted_pages).strip()
            if not full_text:
                raise FileParsingError("No extractable text found in PDF (document may be scanned or empty).")

            return full_text
        except Exception as e:
            if isinstance(e, FileParsingError):
                raise
            raise FileParsingError(f"Failed to parse PDF: {str(e)}")

    # 2. Text and Markdown Parsing
    if lower_name.endswith((".txt", ".md", ".markdown")):
        try:
            return file_bytes.decode("utf-8").strip()
        except UnicodeDecodeError:
            try:
                return file_bytes.decode("latin-1").strip()
            except Exception as e:
                raise FileParsingError(f"Failed to decode text file: {str(e)}")

    raise FileParsingError(f"Unsupported file type for '{filename}'. Allowed extensions: .pdf, .txt, .md")

