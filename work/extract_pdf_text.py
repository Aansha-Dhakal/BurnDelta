from pathlib import Path

from pypdf import PdfReader


pdf_path = Path(r"C:\Users\Aansha\Downloads\Gemini-_38.pdf")
reader = PdfReader(str(pdf_path))
chunks = []

for index, page in enumerate(reader.pages, start=1):
    chunks.append(f"--- PAGE {index} ---\n{page.extract_text() or ''}")

text = "\n\n".join(chunks)
Path("work/pdf_text.txt").write_text(text, encoding="utf-8")

print(f"pages {len(reader.pages)}")
print(text[:12000])
