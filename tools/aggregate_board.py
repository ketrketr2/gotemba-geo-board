#!/usr/bin/env python3
"""snapshot（計測）→ board_data.json（表示）を作る。

板テンプレート（part_head.html + part_js1.js）は window.BOARD_DATA = {real, s, meta}
を読む。R0（計測前）は data/board_seed.json（実データ＋サンプル設計値）を
そのまま出し、スナップショットが貯まり次第、s 側の各指標を実測で上書きしていく。

原則（HANDOFF §11-1）: 取れない数値は null（板は「—」表示）。デモ値で埋めない。
"""
from __future__ import annotations

import glob
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
from common import DATA, ROOT, today  # noqa: E402

FACE_KEY = {"chatgpt": "gpt", "gemini": "gem", "aio": "aio", "aimode": "aim"}
NAME = {"gotemba": "御殿場", "kisarazu": "木更津", "karuizawa": "軽井沢", "iruma": "入間",
        "makuhari": "幕張", "yokohama_bs": "横浜BS", "tama": "多摩南大沢", "sano": "佐野",
        "shisui": "酒々井", "ami": "あみ", "grandberry": "グランベリー",
        "nagashima": "長島", "nasu": "那須"}


def latest_snapshot() -> dict | None:
    files = sorted(glob.glob(str(DATA / "snapshots" / "*.json")))
    if not files:
        return None
    with open(files[-1], encoding="utf-8") as f:
        return json.load(f)


def main() -> None:
    with open(DATA / "board_seed.json", encoding="utf-8") as f:
        board = json.load(f)
    board.setdefault("meta", {})
    board["meta"]["built_at"] = today()
    board["meta"]["measured"] = False

    snap = latest_snapshot()
    if snap:
        s = board["s"]
        sm = snap["summary"]
        # 面別
        for fid, key in FACE_KEY.items():
            v = sm["per_face"].get(fid)
            if not v:
                continue
            for row in s["faces"]:
                if row["id"] == key:
                    row["gen"] = v["gen_rate"]
                    row["cite"] = v["avg_cites"]
                    row["g2"] = v["mention_rate"]
                    row["g3"] = v["first_rate"]
        # 全体 G1/G2/G3
        pf = [v for v in sm["per_face"].values() if v.get("mention_rate") is not None]
        if pf:
            gen = sum(v["gen_rate"] for v in pf) / len(pf)
            cit = sum(v["avg_cites"] or 0 for v in pf) / len(pf)
            s["g1"] = round(gen / 100 * cit, 1)
            s["g2"] = round(sum(v["mention_rate"] for v in pf) / len(pf), 1)
            g3s = [v["first_rate"] for v in pf if v.get("first_rate") is not None]
            s["g3"] = round(sum(g3s) / len(g3s), 1) if g3s else None
            s["g1sub"] = f"生成率{gen:.0f}% × 平均引用{cit:.1f}"
        # 第一想起ランキング
        s["firstBar"] = [[NAME.get(k, k), n, 1 if k == "gotemba" else 0]
                         for k, n in sm["first_rank"]]
        # 引用元
        s["domains"] = [[h, pct, _bucket_label(h)] for h, n, pct in sm["domains"][:10]]
        cb = sm.get("cite_buckets") or {}
        s["ugc"] = cb.get("ugc")
        s["official"] = cb.get("owned")
        board["meta"]["measured"] = True
        board["meta"]["round_date"] = snap["date"]
        board["meta"]["round_cost"] = snap["api_cost"]["usd"]
        board["meta"]["n_cells"] = snap["n_cells"]

    # トレンド（G4）
    tpath = DATA / "trends.json"
    if tpath.exists():
        with open(tpath, encoding="utf-8") as f:
            tr = json.load(f)
        if tr.get("ok"):
            board["real"]["trends"] = {"asof": tr["asof"], "prefs": tr["prefs"]}

    out = ROOT / "tools" / "board_data.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(board, f, ensure_ascii=False, separators=(",", ":"))
    print(f"wrote tools/board_data.json measured={board['meta']['measured']}")


def _bucket_label(host: str) -> str:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
    from common import classify_url
    b = classify_url("https://" + host)["bucket"]
    return {"owned": "自社公式", "affiliated": "関連", "competitor": "競合公式",
            "ugc": "UGC", "travel": "旅行メディア", "reference": "百科",
            "press": "プレス", "media": "メディア"}.get(b, b)


if __name__ == "__main__":
    main()
