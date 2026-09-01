#!/usr/bin/env python3
"""週次ラウンドの計測ランナー（toyota run_car.py の御殿場移植）。

  python src/run_round.py --cap 20            # 現役クエリ × 有効4面
  python src/run_round.py --tier active --cap 15

・回答本文・引用は全文保存する（勝敗テーマ抽出・ペルソナ分析・再計算のため）
・取得率50%未満ならスナップショットを書かずに落ちる（欠測だらけの週を正に混ぜない）
・G2/G3 の分母は「出現期待クエリ」= named でも compare でもないクエリ（ファネル原則）
"""
from __future__ import annotations

import argparse
import sys
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import llm  # noqa: E402
from common import SNAPSHOTS, classify_url, env, load, load_prompts, today, write_json  # noqa: E402
from detect import catalog, detect_outlets, theme_persona_scan  # noqa: E402


def build_jobs(day: str, tier: str, cap: float) -> tuple[list[dict], dict]:
    cfg = load("settings")
    surfaces = [s for s in cfg["surfaces"] if s.get("enabled")]
    limit = cfg["sampling"]["tier_schedule"].get(tier, {}).get("max_prompts", 500)
    guard = llm.BudgetGuard(cap)
    prompts = load_prompts(tier)[:limit]
    jobs = [{"day": day, "p": p, "s": s, "guard": guard} for p in prompts for s in surfaces]
    return jobs, {p["id"]: p for p in prompts}


def collect(jobs: list[dict]) -> list[dict]:
    workers = int(env("GEO_BOARD_WORKERS", "10") or 10)
    out, done = [], 0
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(llm.one_call, j): j for j in jobs}
        for fut in as_completed(futs):
            r = fut.result()
            done += 1
            if r:
                out.append(r)
            if done % 100 == 0:
                print(f"  … {done}/{len(jobs)} 完了（成功 {len(out)} / ${llm.spent()['usd']:.2f}）",
                      flush=True)
    out.sort(key=lambda r: (r["prompt_id"], r["surface"]))
    return out


def build_cells(responses: list[dict], prompts_by_id: dict) -> list[dict]:
    cat = catalog()
    cells = []
    for r in responses:
        p = prompts_by_id.get(r["prompt_id"], {})
        text = r.get("text") or ""
        det = detect_outlets(text, cat)
        scan = theme_persona_scan(text, cat)
        cites = [{**classify_url(c.get("url") or ""),
                  "url": c.get("url"), "title": (c.get("title") or "")[:120]}
                 for c in r.get("citations") or []]
        cells.append({
            "prompt_id": r["prompt_id"], "surface": r["surface"],
            "family": p.get("family"), "named": bool(p.get("named")),
            "compare": bool(p.get("compare")), "lang": p.get("lang") or "ja",
            "answer": text, "citations": cites,
            "outlets": {k: v for k, v in det.items()},
            "themes": scan["themes"], "personas": scan["personas"],
            "fanout": r.get("fanout") or [],
        })
    return cells


def summarize(cells: list[dict]) -> dict:
    """一次集計。G1=面別 生成率×平均引用数（ノイズ引用除外） / G2 / G3 / 勝敗 / ペルソナ / 引用元。"""
    cfg = load("settings")
    faces = [s["id"] for s in cfg["surfaces"] if s.get("enabled")]
    expect = [c for c in cells if not c["named"] and not c["compare"]]  # 出現期待セル

    per_face = {}
    for f in faces:
        fc = [c for c in cells if c["surface"] == f]
        fe = [c for c in expect if c["surface"] == f]
        answered = [c for c in fc if c["answer"]]
        cite_counts = [len([x for x in c["citations"] if x["bucket"] != "noise"]) for c in answered]
        m = [c for c in fe if "gotemba" in c["outlets"]]
        first = [c for c in m if c["outlets"]["gotemba"]["rank"] == 1]
        per_face[f] = {
            "cells": len(fc), "answered": len(answered),
            "gen_rate": round(len(answered) / len(fc) * 100, 1) if fc else None,
            "avg_cites": round(sum(cite_counts) / len(cite_counts), 2) if cite_counts else None,
            "expect_cells": len(fe), "mention": len(m),
            "mention_rate": round(len(m) / len(fe) * 100, 1) if fe else None,
            "first": len(first),
            "first_rate": round(len(first) / len(m) * 100, 1) if m else None,
        }

    # 第一想起ランキング（全施設・出現期待セル）
    first_rank = Counter()
    mention_rank = Counter()
    for c in expect:
        for oid, d in c["outlets"].items():
            mention_rank[oid] += 1
            if d["rank"] == 1:
                first_rank[oid] += 1

    # 勝敗マトリクス v1: テーマ文の共起×極性。
    # gotembaを含む文 → pol を gotemba 側へ、含まず競合のみの文 → pol を競合側へ。
    mx: dict[str, dict[str, dict]] = {}
    for c in expect:
        for t in c["themes"]:
            row = mx.setdefault(t["theme"], {})
            has_me = "gotemba" in t["outlets"]
            for oid in t["outlets"]:
                if oid in ("gotemba",):
                    continue
                cell = row.setdefault(oid, {"me_pos": 0, "me_neg": 0, "riv_pos": 0, "riv_neg": 0, "n": 0})
                cell["n"] += 1
                if has_me:
                    cell["me_pos" if t["pol"] == "pos" else "me_neg" if t["pol"] == "neg" else "me_pos"] += \
                        (1 if t["pol"] != "neu" else 0)
                else:
                    cell["riv_pos" if t["pol"] == "pos" else "riv_neg" if t["pol"] == "neg" else "riv_pos"] += \
                        (1 if t["pol"] != "neu" else 0)

    # ペルソナ分布（gotemba言及セル内）
    pers = Counter()
    for c in expect:
        if "gotemba" not in c["outlets"]:
            continue
        for p in c["personas"]:
            if "gotemba" in p["outlets"]:
                pers[p["persona"]] += 1

    # 引用元ドメイン（全面合算・ノイズ除外）
    dom = Counter()
    buckets = Counter()
    for c in cells:
        for x in c["citations"]:
            if x["bucket"] == "noise":
                continue
            dom[x["host"]] += 1
            buckets[x["bucket"]] += 1
    total_cites = sum(dom.values()) or 1

    return {
        "per_face": per_face,
        "first_rank": first_rank.most_common(20),
        "mention_rank": mention_rank.most_common(20),
        "matrix_raw": mx,
        "personas": dict(pers),
        "domains": [[h, n, round(n / total_cites * 100, 1)] for h, n in dom.most_common(25)],
        "cite_buckets": {k: round(v / total_cites * 100, 1) for k, v in buckets.items()},
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tier", default="active")
    ap.add_argument("--date", default=today())
    ap.add_argument("--cap", type=float, default=20.0)
    a = ap.parse_args()

    jobs, prompts_by_id = build_jobs(a.date, a.tier, a.cap)
    faces = len({j["s"]["id"] for j in jobs})
    print(f"[{a.date}] round: {len(prompts_by_id)}本 × {faces}面 = {len(jobs)}呼び出し（上限 ${a.cap:.0f}）")
    responses = collect(jobs)

    got = len(responses) / max(len(jobs), 1)
    by_surface = Counter(r["surface"] for r in responses)
    print(f"  取得 {len(responses)}/{len(jobs)} ({got*100:.1f}%) 面別 {dict(by_surface)}")
    if got < 0.5:
        (SNAPSHOTS.parent / "last_error.txt").write_text(
            f"{a.date} round 取得率 {got*100:.1f}%（{len(responses)}/{len(jobs)}）\n"
            f"面別: {dict(by_surface)}\n実費 {llm.spent()}\n\n" + "\n".join(llm.errors()),
            encoding="utf-8")
        sys.exit("取得率が50%を下回ったため、スナップショットは書きません。data/last_error.txt を確認。")

    cells = build_cells(responses, prompts_by_id)
    snap = {
        "date": a.date, "tier": a.tier, "mode": "live",
        "n_prompts": len(prompts_by_id), "n_cells": len(cells),
        "surfaces": dict(by_surface),
        "summary": summarize(cells),
        "api_cost": llm.spent(),
        "errors": llm.errors()[:20],
        "cells": cells,                      # 回答全文＋引用（再計算の生命線）
    }
    write_json(SNAPSHOTS / f"{a.date}.json", snap, compact=True)
    s = snap["summary"]["per_face"]
    print(f"  wrote data/snapshots/{a.date}.json  実費 ${snap['api_cost']['usd']:.2f}"
          f" / {snap['api_cost']['calls']}回")
    for f, v in s.items():
        print(f"    {f:<8} 生成率 {v['gen_rate']}% 引用 {v['avg_cites']} "
              f"G2 {v['mention_rate']}% G3 {v['first_rate']}%")


if __name__ == "__main__":
    main()
