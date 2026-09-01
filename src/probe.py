#!/usr/bin/env python3
"""Day-1 □5: 各APIを1呼ずつ叩き、疎通・レスポンス構造・実測costをログに出す。

GitHub Actions（probe.yml・workflow_dispatch）から実行するのが唯一の正規経路。
ローカルやチャットから直接叩かない（認証情報はSecretsにしか無い）。

確認対象:
  1) AI4面（chatgpt / gemini / aio / aimode）各1呼 — 日本語1本
  2) chatgpt 英語1本（E族の language/locale 挙動確認）
  3) keywords_data/google_ads/search_volume …… クエリ需要スコア付け（□6で使用）
  4) keywords_data/google_trends/explore/live … pytrends保険
  5) business_data/google/my_business_info/task_post … クチコミ系の提供範囲・単価
  6) content_analysis/search/live ……………… SNS語られ方 probe 3経路の第1候補
1呼ずつ・合計$2上限。エンドポイントが存在しない/権限が無い場合も
「何が返ったか」をそのまま残す（それがprobeの目的）。
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import llm  # noqa: E402
from common import load  # noqa: E402

CAP = 2.0


def _structure(obj, depth=0) -> str:
    """レスポンス構造をキー階層で要約（値は出さない）。"""
    if depth > 3:
        return "…"
    if isinstance(obj, dict):
        return "{" + ", ".join(f"{k}:{_structure(v, depth+1)}" for k, v in list(obj.items())[:8]) + "}"
    if isinstance(obj, list):
        return f"[{len(obj)}×{_structure(obj[0], depth+1) if obj else ''}]"
    return type(obj).__name__


def probe(label: str, fn):
    print(f"\n===== {label} =====", flush=True)
    if llm.spent()["usd"] >= CAP:
        print("  skip: 予算上限 $%.1f 到達" % CAP)
        return
    try:
        res = fn()
        print(f"  cost累計: ${llm.spent()['usd']:.4f} / calls {llm.spent()['calls']}")
        print(f"  structure: {_structure(res)[:900]}")
    except Exception as e:
        print(f"  !! {type(e).__name__}: {str(e)[:400]}")


def main() -> None:
    cfg = load("settings")
    faces = {s["id"]: s for s in cfg["surfaces"]}
    q_ja = "関東でおすすめのアウトレットモールを教えてください"
    q_en = "What is the best outlet mall near Tokyo for a day trip?"

    probe("chatgpt (ja)", lambda: llm.fetch_llm_response(q_ja, faces["chatgpt"]))
    probe("gemini (ja)", lambda: llm.fetch_llm_response(q_ja, faces["gemini"]))
    probe("aio (ja)", lambda: llm.fetch_serp_ai(q_ja, faces["aio"]))
    probe("aimode (ja)", lambda: llm.fetch_serp_ai(q_ja, faces["aimode"]))
    probe("chatgpt (en/E族挙動)", lambda: llm.fetch_llm_response(q_en, faces["chatgpt"], lang="en"))

    probe("keywords_data search_volume", lambda: llm._post(
        "keywords_data/google_ads/search_volume/live",
        [{"keywords": ["御殿場 アウトレット", "木更津 アウトレット", "アウトレット 関東"],
          "location_code": 2392, "language_code": "ja"}]))

    probe("keywords_data google_trends explore", lambda: llm._post(
        "keywords_data/google_trends/explore/live",
        [{"keywords": ["御殿場アウトレット"], "location_code": 2392,
          "language_code": "ja", "time_range": "past_12_months"}]))

    probe("business_data my_business_info (クチコミ系の入口)", lambda: llm._post(
        "business_data/google/my_business_info/task_post",
        [{"keyword": "御殿場プレミアム・アウトレット", "location_code": 2392,
          "language_code": "ja"}]))

    probe("content_analysis search (SNS語られ方 第1候補)", lambda: llm._post(
        "content_analysis/search/live",
        [{"keyword": "御殿場アウトレット", "page_type": ["organic", "blogs", "message-boards"],
          "limit": 10}]))

    print(f"\nprobe合計: ${llm.spent()['usd']:.4f} / {llm.spent()['calls']}呼")
    print(json.dumps({"errors": llm.errors()}, ensure_ascii=False))


if __name__ == "__main__":
    main()
