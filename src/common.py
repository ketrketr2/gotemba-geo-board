"""共通ユーティリティ: 設定読み込み・パス・日付・ドメイン正規化。

toyota-geo-board/src/common.py の御殿場向け移植（必要分のみ）。
"""
from __future__ import annotations

import fnmatch
import json
import os
import re
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

import yaml

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "config"
DATA = ROOT / "data"
SNAPSHOTS = DATA / "snapshots"
DOCS = ROOT / "docs"
JST = timezone(timedelta(hours=9))

_cache: dict[str, dict] = {}


def load(name: str) -> dict:
    """config/<name>.yaml を読む（キャッシュあり）。"""
    if name not in _cache:
        with open(CONFIG / f"{name}.yaml", encoding="utf-8") as f:
            _cache[name] = yaml.safe_load(f)
    return _cache[name]


def env(key: str, default: str | None = None) -> str | None:
    v = os.environ.get(key)
    return v if v not in (None, "") else default


def load_prompts(tier: str = "active") -> list[dict]:
    """プロンプトはレジストリ（prompts/registry.yaml）が唯一の正。"""
    reg = ROOT / "prompts" / "registry.yaml"
    with open(reg, encoding="utf-8") as f:
        rows = yaml.safe_load(f)["prompts"]
    rows = [p for p in rows if p.get("tier") == tier]
    rows.sort(key=lambda p: -(p.get("demand") or 0))
    return rows


def today() -> str:
    return datetime.now(JST).strftime("%Y-%m-%d")


def days_ago(d: str, n: int) -> str:
    return (date.fromisoformat(d) - timedelta(days=n)).isoformat()


def sentences(text: str) -> list[str]:
    """日本語文分割（簡易）。改行・句点・感嘆・疑問で切る。"""
    parts = re.split(r"[。．！!？?\n]+", text or "")
    return [s.strip() for s in parts if s.strip()]


def contains_any(s: str, words: list[str]) -> bool:
    low = s.casefold()
    return any(w.casefold() in low for w in words or [])


def domain_of(url: str) -> str:
    try:
        host = urlparse(url if "://" in url else "https://" + url).netloc.lower()
    except ValueError:
        return ""
    return host.split(":")[0].removeprefix("www.").rstrip(".")


def match_domain(host: str, patterns: list[str]) -> bool:
    for p in patterns or []:
        p = p.lower()
        if "*" in p:
            if fnmatch.fnmatch(host, p):
                return True
        elif host == p or host.endswith("." + p):
            return True
    return False


def classify_url(url: str) -> dict:
    """URL を owned / affiliated / competitor / ugc / travel / reference / press / media / noise に分類。"""
    dm = load("domains")
    host = domain_of(url)
    if not host:
        return {"host": "", "bucket": "noise", "platform": None}
    low = (url or "").lower()
    if any(p in low for p in dm["noise_patterns"]):
        return {"host": host, "bucket": "noise", "platform": None}
    if match_domain(host, dm["owned_domains"]):
        return {"host": host, "bucket": "owned", "platform": None}
    if match_domain(host, dm["affiliated_domains"]):
        return {"host": host, "bucket": "affiliated", "platform": None}
    if match_domain(host, dm["competitor_domains"]):
        return {"host": host, "bucket": "competitor", "platform": None}
    for p in dm["platforms"]:
        if match_domain(host, p["domains"]):
            return {"host": host, "bucket": "ugc", "platform": p["id"]}
    if match_domain(host, dm["travel_media_domains"]):
        return {"host": host, "bucket": "travel", "platform": None}
    if match_domain(host, dm["reference_domains"]):
        return {"host": host, "bucket": "reference", "platform": None}
    if match_domain(host, dm["press_domains"]):
        return {"host": host, "bucket": "press", "platform": None}
    return {"host": host, "bucket": "media", "platform": None}


def write_json(path: Path, obj, compact: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        if compact:
            json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
        else:
            json.dump(obj, f, ensure_ascii=False, indent=1)
