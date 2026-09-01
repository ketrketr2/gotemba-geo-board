"""AI4面にプロンプトを投げ、回答本文と引用URLを集める。

toyota-geo-board/src/collect/llm.py の移植。実測1,500呼以上で確認済みの仕様:
  - chatgpt: /ai_optimization/chat_gpt/llm_responses/live（gpt-5・max_tokens 4096 必須・
             web_search_country_iso_code は chatgpt のみ）
  - gemini : /ai_optimization/gemini/llm_responses/live（gemini-2.5-flash）
             引用が vertexaisearch のリダイレクタで返る → title の裸ドメインから復元
  - aio    : /serp/google/organic/live/advanced + load_async_ai_overview
  - aimode : /serp/google/ai_mode/live/advanced
  - google.com/goto リダイレクタは 302 を1回辿って実URLへ解決（2026-08-26頃から発生）

デモモードは提供しない（推定値をボードに載せないため）。認証が無ければ止まる。
"""
from __future__ import annotations

import sys
import threading
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import requests  # noqa: E402

from common import domain_of, env, load  # noqa: E402

DFS_BASE = "https://api.dataforseo.com/v3"
LLM_PATH = {"chatgpt": "chat_gpt", "gemini": "gemini"}

_COST_LOCK = threading.Lock()
_COST = {"total": 0.0, "calls": 0}
_ERRORS: list[str] = []
_LAST_RAW: dict = {}


def errors() -> list[str]:
    with _COST_LOCK:
        return list(_ERRORS)


def spent() -> dict:
    with _COST_LOCK:
        return {"usd": round(_COST["total"], 4), "calls": _COST["calls"]}


def _charge(task: dict) -> None:
    with _COST_LOCK:
        _COST["total"] += float(task.get("cost") or 0)
        _COST["calls"] += 1


def _dfs_auth():
    lg, pw = env("DATAFORSEO_LOGIN"), env("DATAFORSEO_PASSWORD")
    if not lg or not pw:
        sys.exit("DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD 未設定。"
                 "GitHub Secrets に登録して Actions から実行してください（デモ実行は提供しません）。")
    return (lg, pw)


def _post(path: str, body: list) -> dict:
    r = requests.post(f"{DFS_BASE}/{path}", auth=_dfs_auth(), json=body, timeout=180)
    if r.status_code >= 400:
        raise RuntimeError(f"HTTP {r.status_code} {r.text[:300]}")
    task = r.json()["tasks"][0]
    if task.get("status_code") != 20000:
        raise RuntimeError(f"{task.get('status_code')} {task.get('status_message')}")
    _charge(task)
    return task


# ---- リダイレクタ対策（トヨタ実測: Gemini引用の73%がリダイレクタ） ----
_REDIRECTORS = ("vertexaisearch.cloud.google.com", "grounding-api-redirect", "google.com/goto")
_GOTO_CACHE: dict[str, str] = {}
_GOTO_UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                          "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"}


def _is_goto(url: str) -> bool:
    u = (url or "").lower()
    return ("google.com/goto" in u) and u.startswith(("http://", "https://"))


def _resolve_goto(url: str) -> str:
    if url in _GOTO_CACHE:
        return _GOTO_CACHE[url]
    u = url.replace("://google.com/", "://www.google.com/", 1)
    final = ""
    for _ in range(3):
        try:
            r = requests.get(u, headers=_GOTO_UA, timeout=8, allow_redirects=False)
        except Exception:
            break
        loc = r.headers.get("location") or ""
        if r.status_code in (301, 302, 303, 307, 308) and loc:
            if "google.com/goto" in loc or "grounding-api-redirect" in loc:
                u = loc
                continue
            final = loc
        break
    _GOTO_CACHE[url] = final
    return final


def _walk_refs(node, out: list) -> None:
    """references / annotations は階層がまちまち。URLを持つ辞書を再帰で拾う。"""
    if isinstance(node, dict):
        if node.get("url"):
            url = node["url"]
            title = node.get("title") or node.get("source") or ""
            dom = node.get("domain") or ""
            if _is_goto(url):
                real = _resolve_goto(url)
                if real:
                    url = real
                    dom = domain_of(real)
                else:
                    dom = url            # 未解決は noise_patterns 側で落とす
            if any(x in url for x in _REDIRECTORS):
                if title and "/" not in title and "." in title and " " not in title:
                    dom = title.lower()  # Gemini: title に裸ドメインが入る
            out.append({"url": url, "title": title, "domain": dom or domain_of(url)})
            return
        for v in node.values():
            _walk_refs(v, out)
    elif isinstance(node, list):
        for v in node:
            _walk_refs(v, out)


def _dedup(cites: list[dict]) -> list[dict]:
    seen, out = set(), []
    for c in cites:
        key = c.get("url")
        if any(x in (c.get("url") or "") for x in _REDIRECTORS):
            key = ("dom", c.get("domain"), c.get("title"))
        if key not in seen:
            seen.add(key)
            out.append(c)
    return out


def fetch_llm_response(prompt: str, surface: dict, lang: str = "ja") -> dict:
    path = LLM_PATH.get(surface["id"], "chat_gpt")
    body = {
        "user_prompt": prompt[:500],
        "model_name": surface["model"],
        "max_output_tokens": surface.get("max_tokens", 1500),
        "web_search": True,
    }
    if path == "chat_gpt":
        body["web_search_country_iso_code"] = "JP"   # Gemini に送ると 40501 で弾かれる
    if surface.get("system_message") and lang == "ja":
        body["system_message"] = surface["system_message"]
    task = _post(f"ai_optimization/{path}/llm_responses/live", [body])
    items = (task.get("result") or [{}])[0].get("items") or []
    _LAST_RAW[surface["id"]] = {"cost": float(task.get("cost") or 0), "items": items}
    text, cites = "", []
    for it in items:
        if it.get("type") == "reasoning":
            continue
        for sec in it.get("sections") or []:
            text += (sec.get("text") or "") + "\n"
            _walk_refs(sec.get("annotations"), cites)
    return {"text": text.strip(), "citations": _dedup(cites),
            "fanout": (items[0].get("fan_out_queries") if items else None) or []}


def fetch_serp_ai(prompt: str, surface: dict, lang: str = "ja") -> dict:
    cfg = load("settings")["serp"]
    lc = "en" if lang == "en" else cfg["language_code"]
    if surface["id"] == "aimode":
        path = "serp/google/ai_mode/live/advanced"
        body = [{"keyword": prompt[:700], "language_code": lc,
                 "location_code": cfg["location_code"], "device": "desktop"}]
    else:
        path = "serp/google/organic/live/advanced"
        body = [{"keyword": prompt[:700], "language_code": lc,
                 "location_code": cfg["location_code"], "device": "desktop",
                 "load_async_ai_overview": True}]
    task = _post(path, body)
    items = (task.get("result") or [{}])[0].get("items") or []
    _LAST_RAW[surface["id"]] = {"cost": float(task.get("cost") or 0), "items": items}
    text, cites = "", []
    for it in items:
        if not str(it.get("type", "")).startswith("ai_"):
            continue
        for el in (it.get("items") or [it]):
            text += (el.get("text") or "") + "\n"
        _walk_refs(it.get("references"), cites)
        _walk_refs(it.get("items"), cites)
    return {"text": text.strip(), "citations": _dedup(cites), "fanout": []}


class BudgetGuard:
    def __init__(self, cap_usd: float):
        self.cap = cap_usd

    def over(self) -> bool:
        with _COST_LOCK:
            return self.cap > 0 and _COST["total"] >= self.cap


def one_call(job: dict) -> dict | None:
    """1回分の実測。失敗しても None を返すだけで、全体は止めない。"""
    p, s = job["p"], job["s"]
    if job["guard"].over():
        return None
    fn = fetch_serp_ai if s["provider"] == "serp" else fetch_llm_response
    for attempt in range(3):
        try:
            res = fn(p["text"], s, p.get("lang") or "ja")
            return {"date": job["day"], "prompt_id": p["id"], "surface": s["id"], **res}
        except Exception as e:
            if attempt == 2:
                msg = f"{p['id']}/{s['id']}: {type(e).__name__}: {e}"
                print(f"  ! {msg}", file=sys.stderr)
                with _COST_LOCK:
                    if len(_ERRORS) < 40:
                        _ERRORS.append(msg)
                return None
            time.sleep(2 ** attempt * 1.5)
    return None
