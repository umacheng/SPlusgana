import re
import urllib.parse

import httpx
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}

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
        container = soup.select_one(selector)
        if container:
            for br in container.find_all("br"):
                br.replace_with("\n")
            return _clean_text(container.get_text())

    candidates = soup.find_all(["div", "p", "article"], class_=re.compile(r"lyric|kashi|kasi", re.I))
    if candidates:
        best = max(candidates, key=lambda el: len(el.get_text()))
        for br in best.find_all("br"):
            br.replace_with("\n")
        return _clean_text(best.get_text())

    raise ValueError(f"無法在 {url} 找到歌詞內容，請手動貼上歌詞。")


def _search_uta_net(title: str, artist: str) -> str | None:
    """直接搜尋 uta-net.com"""
    for kw in [title, f"{title} {artist}"]:
        encoded = urllib.parse.quote_plus(kw)
        search_url = f"https://www.uta-net.com/search/?Aselect=2&Vselect=0&KWRD={encoded}"
        try:
            with httpx.Client(headers=HEADERS, timeout=10, follow_redirects=True) as client:
                resp = client.get(search_url)
            print(f"[scraper] uta-net search '{kw}' → HTTP {resp.status_code}")
            soup = BeautifulSoup(resp.text, "html.parser")
            for a in soup.find_all("a", href=True):
                href: str = a["href"]
                if re.search(r"/song/\d+", href):
                    if href.startswith("/"):
                        result = f"https://www.uta-net.com{href}"
                    elif "uta-net.com" in href:
                        result = href
                    else:
                        continue
                    print(f"[scraper] found: {result}")
                    return result
            print(f"[scraper] uta-net: no song links found for '{kw}'")
        except Exception as e:
            print(f"[scraper] uta-net error for '{kw}': {e}")
    return None


def _search_utamap(title: str, artist: str) -> str | None:
    """直接搜尋 utamap.com"""
    kw = urllib.parse.quote_plus(f"{title} {artist}")
    url = f"https://www.utamap.com/searchkasi.php?strkey={kw}&shrtarget=titol"
    try:
        with httpx.Client(headers=HEADERS, timeout=10, follow_redirects=True) as client:
            resp = client.get(url)
        print(f"[scraper] utamap search → HTTP {resp.status_code}")
        soup = BeautifulSoup(resp.text, "html.parser")
        for a in soup.find_all("a", href=re.compile(r"showkasi\.php")):
            href = a["href"]
            if not href.startswith("http"):
                href = f"https://www.utamap.com/{href.lstrip('/')}"
            print(f"[scraper] utamap found: {href}")
            return href
    except Exception as e:
        print(f"[scraper] utamap error: {e}")
    return None


def search_lyrics_url(title: str, artist: str) -> str | None:
    print(f"[scraper] searching lyrics for title='{title}' artist='{artist}'")
    result = _search_uta_net(title, artist) or _search_utamap(title, artist)
    if not result:
        print("[scraper] all searches failed")
    return result
