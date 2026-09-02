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

import yaml

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
            s["g1sub"] = f"回答が返る率 {gen:.0f}% × 回答あたり引用 {cit:.1f}本"
            exp = sum(v["expect_cells"] for v in pf)
            men = sum(v["mention"] for v in pf)
            fst = sum(v["first"] for v in pf)
            s["g2n"] = f"{men}/{exp}セル"
            s["g3n"] = f"{fst}/{men}回答"
            s["calls"] = {"queries": max(v["expect_cells"] for v in pf),
                          "faces": len(pf), "answers": snap["n_cells"],
                          "mentions": men, "first": fst}
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

        # ---- クエリ・ドリルダウン（VQ「クエリの中身」ビュー） ----
        # s.qindex   : 軽量索引（板に埋め込む）。[id, 質問文, family, named, compare, lang,
        #              [面別コード: 0=回答なし 1=言及なし 2=言及 3=第一想起] × gpt/gem/aio/aim]
        # docs/cells.json : 回答全文・引用・検出施設（重いのでPagesから遅延fetch）
        with open(ROOT / "prompts" / "registry.yaml", encoding="utf-8") as f:
            preg = {p["id"]: p for p in yaml.safe_load(f)["prompts"]}
        order = ["chatgpt", "gemini", "aio", "aimode"]
        by_q: dict[str, dict] = {}
        for c in snap["cells"]:
            by_q.setdefault(c["prompt_id"], {})[c["surface"]] = c
        qindex, qcells = [], {}
        for pid in sorted(by_q):
            p = preg.get(pid, {})
            codes, fdetail = [], {}
            for sfc in order:
                c = by_q[pid].get(sfc)
                if not c or not c.get("answer"):
                    codes.append(0)
                    continue
                g = c["outlets"].get("gotemba")
                codes.append(3 if (g and g.get("rank") == 1) else 2 if g else 1)
                fdetail[FACE_KEY[sfc]] = {
                    "a": c["answer"],
                    "o": sorted(([k, v["rank"]] for k, v in c["outlets"].items()),
                                key=lambda x: x[1]),
                    "c": [[x.get("host") or "", x.get("bucket") or "",
                           x.get("url") or "", (x.get("title") or "")[:120]]
                          for x in c["citations"]],
                }
            qindex.append([pid, p.get("text") or pid, p.get("family") or "-",
                           1 if p.get("named") else 0, 1 if p.get("compare") else 0,
                           p.get("lang") or "ja", codes])
            qcells[pid] = fdetail
        s["qindex"] = qindex
        docs = ROOT / "docs"
        docs.mkdir(exist_ok=True)
        with open(docs / "cells.json", "w", encoding="utf-8") as f:
            json.dump({"date": snap["date"], "cells": qcells}, f,
                      ensure_ascii=False, separators=(",", ":"))
        print(f"wrote docs/cells.json ({len(qcells)} queries)")

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
