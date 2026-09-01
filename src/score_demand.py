#!/usr/bin/env python3
"""Day-1 □6: 需要スコア付けと現役/補欠の入替（toyota registry方式の御殿場版）。

  python src/score_demand.py --dry           # スコアだけ更新して入替案を表示
  python src/score_demand.py --apply         # クォータに沿って active/bench を入替

・DataForSEO keywords_data/google_ads/search_volume で各クエリの keyword を実測
・demand = log10(volume+1) × 20 を 0-100 に丸めた指数（growthは将来拡張）
・家族別クォータ（config/settings.yaml: quota）で active を確定
・IDは絶対に振り直さない。落ちたものは bench、需要が消えたものは retired
"""
from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))

import llm  # noqa: E402
from common import ROOT, load, today  # noqa: E402

REGISTRY = ROOT / "prompts" / "registry.yaml"
DEMAND_HISTORY_MAX = 12


def load_registry() -> dict:
    with open(REGISTRY, encoding="utf-8") as f:
        return yaml.safe_load(f)


def save_registry(reg: dict) -> None:
    reg["updated_at"] = today()
    reg["prompts"].sort(key=lambda p: p["id"])
    with open(REGISTRY, "w", encoding="utf-8") as f:
        f.write("# 自動生成 + 手編集可。IDは絶対に振り直さないこと（時系列が壊れる）。\n")
        f.write("# tier: active=週次計測 / bench=補欠（需要のみ更新） / retired=停止\n")
        yaml.safe_dump(reg, f, allow_unicode=True, sort_keys=False, width=10**6)


def fetch_volumes(keywords: list[str]) -> dict[str, int]:
    """search_volume をまとめて取得（1呼で最大1000語だが分割は700語で安全側）。"""
    vols: dict[str, int] = {}
    for i in range(0, len(keywords), 700):
        chunk = keywords[i:i + 700]
        task = llm._post("keywords_data/google_ads/search_volume/live",
                         [{"keywords": chunk, "location_code": 2392, "language_code": "ja"}])
        for row in (task.get("result") or []):
            kw = (row.get("keyword") or "").strip()
            vols[kw] = int(row.get("search_volume") or 0)
    return vols


def push_demand(p: dict, day: str, score: float) -> None:
    h = p.setdefault("demand_history", [])
    if h and h[-1][0] == day:
        h[-1][1] = round(score, 1)
    else:
        h.append([day, round(score, 1)])
    del h[:-DEMAND_HISTORY_MAX]
    p["demand"] = round(score, 1)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--dry", action="store_true")
    a = ap.parse_args()
    day = today()

    reg = load_registry()
    rows = [p for p in reg["prompts"] if p.get("tier") != "retired"]
    kws = sorted({(p.get("keyword") or "").strip() for p in rows if p.get("keyword")})
    print(f"search_volume 取得: {len(kws)}語")
    vols = fetch_volumes(kws)

    for p in rows:
        kw = (p.get("keyword") or "").strip()
        v = vols.get(kw, 0)
        p["volume"] = v
        push_demand(p, day, min(100.0, math.log10(v + 1) * 20))

    quota = load("settings")["quota"]
    moves = []
    for fam, q in quota.items():
        fam_rows = sorted([p for p in rows if p.get("family") == fam],
                          key=lambda p: -(p.get("demand") or 0))
        for i, p in enumerate(fam_rows):
            want = "active" if i < q else "bench"
            if p.get("tier") != want:
                moves.append((p["id"], p.get("tier"), want, p.get("demand"), p["text"][:30]))
                if a.apply:
                    p["tier_prev"] = p.get("tier")
                    p["tier"] = want
                    p["tier_since"] = day

    print(f"入替候補 {len(moves)}件:")
    for m in moves[:60]:
        print(f"  {m[0]} {m[1]}→{m[2]} demand={m[3]} {m[4]}…")
    if a.apply:
        save_registry(reg)
        print(f"registry 保存済み（active合計 "
              f"{sum(1 for p in reg['prompts'] if p.get('tier')=='active')}本）"
              f" API実費 ${llm.spent()['usd']:.4f}")
    else:
        print("（--apply を付けると反映します）")


if __name__ == "__main__":
    main()
