import re

import httpx
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}

# 支援的歌詞網站解析策略
_SITE_SELECTORS: dict[str, str] = {
    "uta-net.com": "div#kashi_area",
    "utamap.com": "div#kasi_area",
    "j-lyric.net": "p#Lyric",
    "kashinavi.com": "div.lyric",
}


def _find_selector(url: str) -> str | None:
    for domain, selector in _SITE_SELECTORS.items():
        if domain in url:
            return selector
    return None


def _clean_text(text: str) -> str:
    text = re.sub(r"\r\n|\r", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def fetch_lyrics_from_url(url: str) -> str:
    """從指定歌詞網頁抓取純文字歌詞"""
    with httpx.Client(headers=HEADERS, timeout=15, follow_redirects=True) as client:
        resp = client.get(url)
        resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")

    selector = _find_selector(url)
    if selector:
        tag, _, cls = selector.partition(" ")  # e.g. "div#kashi_area"
        container = soup.select_one(selector)
        if container:
            for br in container.find_all("br"):
                br.replace_with("\n")
            return _clean_text(container.get_text())

    # 通用 fallback：尋找最大文字塊
    candidates = soup.find_all(["div", "p", "article"], class_=re.compile(r"lyric|kashi|kasi|lyric", re.I))
    if candidates:
        best = max(candidates, key=lambda el: len(el.get_text()))
        for br in best.find_all("br"):
            br.replace_with("\n")
        return _clean_text(best.get_text())

    raise ValueError(f"無法在 {url} 找到歌詞內容，請手動貼上歌詞。")


def search_lyrics_url(title: str, artist: str) -> str | None:
    """透過搜尋引擎找出歌詞頁面 URL（回傳第一個可信結果）"""
    query = f"{title} {artist} 歌詞 site:uta-net.com OR site:utamap.com"
    search_url = f"https://www.google.com/search?q={httpx.QueryParams({'q': query})}"

    with httpx.Client(headers=HEADERS, timeout=10, follow_redirects=True) as client:
        resp = client.get(search_url)

    soup = BeautifulSoup(resp.text, "html.parser")

    trusted_domains = list(_SITE_SELECTORS.keys())
    for a_tag in soup.find_all("a", href=True):
        href: str = a_tag["href"]
        if any(d in href for d in trusted_domains):
            # 過濾 Google redirect
            if href.startswith("http") and "google" not in href:
                return href

    return None
