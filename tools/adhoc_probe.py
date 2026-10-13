#!/usr/bin/env python3
"""単発スタディ用の AI4面プローブ（結果はコミットせず Actions artifact に出す）。

用途: 御殿場ボードの計測基盤（src/llm.py）をそのまま借りて、別テーマのクエリ群を
1回だけ4面（ChatGPT / Gemini / AI Overview / AIモード）に投げ、回答全文と引用URLを
JSON に保存する。data/snapshots には書かない（ボードの時系列を汚さない）。

実行: python tools/adhoc_probe.py --queries tools/adhoc_queries.json --cap 6 --out out/adhoc.json
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

import llm  # noqa: E402
from common import load  # noqa: E402

JST = timezone(timedelta(hours=9))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--queries", required=True)
    ap.add_argument("--cap", type=float, default=6.0)
    ap.add_argument("--out", default="out/adhoc.json")
    ap.add_argument("--faces", default="chatgpt,gemini,aio,aimode")
    args = ap.parse_args()

    cfg = load("settings")
    faces = {s["id"]: s for s in cfg["surfaces"] if s.get("enabled", True)}
    want = [f for f in args.faces.split(",") if f in faces]
    queries = json.loads(Path(args.queries).read_text(encoding="utf-8"))
    guard = llm.BudgetGuard(args.cap)

    results = []
    for q in queries:
        row = {"id": q["id"], "group": q.get("group"), "query": q["query"], "faces": {}}
        for fid in want:
            if guard.over():
                row["faces"][fid] = {"error": "budget cap reached"}
                continue
            surface = faces[fid]
            t0 = time.time()
            try:
                if surface["provider"] == "serp":
                    res = llm.fetch_serp_ai(q["query"], surface, lang="ja")
                else:
                    res = llm.fetch_llm_response(q["query"], surface, lang="ja")
                res["sec"] = round(time.time() - t0, 1)
                res["cost"] = llm._LAST_RAW.get(fid, {}).get("cost")
                row["faces"][fid] = res
                print(f"[{q['id']}] {fid}: {len(res.get('text') or '')} chars, "
                      f"{len(res.get('citations') or [])} cites, ${llm.spent()['usd']:.3f} total", flush=True)
            except Exception as e:  # noqa: BLE001
                row["faces"][fid] = {"error": f"{type(e).__name__}: {str(e)[:300]}"}
                print(f"[{q['id']}] {fid}: !! {type(e).__name__}: {str(e)[:200]}", flush=True)
        results.append(row)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "run_at": datetime.now(JST).isoformat(timespec="seconds"),
        "spent": llm.spent(),
        "errors": llm.errors(),
        "faces": want,
        "results": results,
    }
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nsaved {out} / spent {llm.spent()}")


if __name__ == "__main__":
    main()
