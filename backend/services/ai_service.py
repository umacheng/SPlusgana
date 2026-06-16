import google.generativeai as genai

from config import settings

genai.configure(api_key=settings.gemini_api_key)

_MODEL = genai.GenerativeModel("gemini-1.5-flash")

_SYSTEM_PROMPT = (
    "你是一位精通日文與網頁工程的助手。"
    "請將以下日文歌詞中的所有漢字，轉換為 HTML 規範的 <ruby> 與 <rt> 標籤，"
    "用以標注平假名（Furigana）。"
    "範例：漢字 必須轉換為 <ruby>漢字<rt>かんじ</rt></ruby>。"
    "請直接回傳轉換後的歌詞文本，不要包含任何 Markdown 標記、代碼區塊或額外說明。"
)


def annotate_with_furigana(raw_lyrics: str) -> str:
    """送 raw_lyrics 給 Gemini，回傳帶 <ruby> 標籤的 HTML 歌詞字串"""
    response = _MODEL.generate_content(
        f"{_SYSTEM_PROMPT}\n\n{raw_lyrics}",
        generation_config=genai.GenerationConfig(
            temperature=0.1,  # 低溫確保格式穩定
        ),
    )
    return response.text.strip()


def split_lines_with_annotation(raw_lyrics: str) -> list[dict]:
    """
    將歌詞按行分割，每行分別送 AI 標注（較精準，但 API 呼叫次數較多）。
    適合用於手動修正單行歌詞。
    """
    lines = [l for l in raw_lyrics.splitlines() if l.strip()]
    result = []
    for i, line in enumerate(lines, start=1):
        html_text = annotate_with_furigana(line)
        result.append({
            "line_number": i,
            "raw_text": line,
            "html_text": html_text,
            "time_marker": 0.0,
        })
    return result


def bulk_annotate_lyrics(raw_lyrics: str) -> list[dict]:
    """
    整篇歌詞一次送 AI 標注（節省 API 次數），再切行解析回傳。
    這是主要使用的流程。
    """
    annotated = annotate_with_furigana(raw_lyrics)

    raw_lines = [l for l in raw_lyrics.splitlines() if l.strip()]
    html_lines = [l for l in annotated.splitlines() if l.strip()]

    # 若行數吻合直接對應；否則以 annotated 版本為主重新切行
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

    # fallback：僅保留 html 版本，raw_text 留空
    return [
        {
            "line_number": i + 1,
            "raw_text": "",
            "html_text": line,
            "time_marker": 0.0,
        }
        for i, line in enumerate(html_lines)
    ]
