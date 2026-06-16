from google import genai
from google.genai import types

from config import settings

_client = genai.Client(api_key=settings.gemini_api_key)

_SYSTEM_PROMPT = (
    "你是一位精通日文與網頁工程的助手。"
    "請將以下日文歌詞中的所有漢字，轉換為 HTML 規範的 <ruby> 與 <rt> 標籤，"
    "用以標注平假名（Furigana）。"
    "範例：漢字 必須轉換為 <ruby>漢字<rt>かんじ</rt></ruby>。"
    "請直接回傳轉換後的歌詞文本，不要包含任何 Markdown 標記、代碼區塊或額外說明。"
)


def annotate_with_furigana(raw_lyrics: str) -> str:
    """送 raw_lyrics 給 Gemini，回傳帶 <ruby> 標籤的 HTML 歌詞字串"""
    response = _client.models.generate_content(
        model="gemini-2.0-flash-lite",
        contents=f"{_SYSTEM_PROMPT}\n\n{raw_lyrics}",
        config=types.GenerateContentConfig(
            temperature=0.1,
        ),
    )
    return response.text.strip()


def bulk_annotate_lyrics(raw_lyrics: str) -> list[dict]:
    """整篇歌詞一次送 AI 標注，再切行解析回傳"""
    annotated = annotate_with_furigana(raw_lyrics)

    raw_lines = [l for l in raw_lyrics.splitlines() if l.strip()]
    html_lines = [l for l in annotated.splitlines() if l.strip()]

    if len(raw_lines) == len(html_lines):
        return [
            {
                "line_number": i + 1,
                "raw_text": raw_lines[i],
                "html_text": html_lines[i],
                "time_marker": 0.0,
            }
            for i in range(len(raw_lines))
        ]

    return [
        {
            "line_number": i + 1,
            "raw_text": "",
            "html_text": line,
            "time_marker": 0.0,
        }
        for i, line in enumerate(html_lines)
    ]
