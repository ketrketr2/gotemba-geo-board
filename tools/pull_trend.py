#!/usr/bin/env python3
"""Googleトレンド（pytrends）で G4 検索需要と都県別の地域差を取る。

実バグ由来の注意（HANDOFF §8・トヨタで踏んだ地雷）:
  - TrendReq に retries / backoff_factor を渡すと urllib3 v2 の
    method_whitelist 例外で死ぬ。渡さず自前リトライ（sleep＋再試行）にする
  - 5語制限 → 全バッチに共通アンカー語を入れ、アンカー=100 で正規化して連結
  - 全滅した場合は data/trends.json に ok:false を書き、ボード側は「—」表示

出力: data/trends.json
  { ok, asof, anchor, weekly: {dates, series:{<kw>: [..]}}, prefs: {JP-13: idx, ...} }
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
from common import DATA, load, today  # noqa: E402

RETRY = 4
SLEEP = 12


def _fetch(fn, label):
    last = None
    for i in range(RETRY):
        try:
            return fn()
        except Exception as e:                      # 429含む。自前リトライ
            last = e
            print(f"  retry {i+1}/{RETRY} {label}: {type(e).__name__}: {str(e)[:120]}")
            time.sleep(SLEEP * (i + 1))
    print(f"  !! {label} 失敗: {last}")
    return None


def main() -> None:
    cfg = load("settings")["trends"]
    anchor = cfg["anchor"]
    targets = [c["full"] if len(c.get("full", "")) <= 20 else c["name"]
               for c in ([load("outlets")["self"]] + load("outlets")["tier1"])]
    # 指名検索語はフル名称より通称の方が需要実態に近い
    targets = [t.replace("プレミアム・アウトレット", "アウトレット")
                .replace("三井アウトレットパーク ", "").strip() for t in targets]
    targets = [t if "アウトレット" in t else t + " アウトレット" for t in targets]
    targets = list(dict.fromkeys(targets))

    try:
        from pytrends.request import TrendReq
    except Exception as e:
        _write({"ok": False, "note": f"pytrends未導入: {e}"})
        return

    py = TrendReq(hl="ja-JP", tz=-540)              # retries/backoff は渡さない（§8）

    # ---- 週次（アンカー連結） ----
    series: dict[str, list] = {}
    dates: list[str] = []
    scale = {anchor: 1.0}
    for i in range(0, len(targets), 4):
        batch = [anchor] + targets[i:i + 4]

        def pull(b=batch):
            py.build_payload(b, timeframe=cfg["timeframe"], geo=cfg["geo_national"])
            return py.interest_over_time()
        df = _fetch(pull, f"weekly {batch}")
        if df is None or df.empty:
            continue
        if not dates:
            dates = [d.strftime("%Y-%m-%d") for d in df.index]
        a = df[anchor].astype(float)
        amax = float(a.max()) or 1.0
        for kw in batch[1:]:
            vals = df[kw].astype(float) / amax * 100.0
            series[kw] = [round(float(v), 1) for v in vals]
        series.setdefault(anchor, [round(float(v) / amax * 100.0, 1) for v in a])
        time.sleep(4)

    # ---- 都県別（アンカー語の地域指数） ----
    prefs: dict[str, float | None] = {}
    for geo, label in cfg["geo_prefs"].items():
        def pull_p(g=geo):
            py.build_payload([anchor], timeframe=cfg["timeframe"], geo=g)
            return py.interest_over_time()
        df = _fetch(pull_p, f"pref {label}")
        prefs[geo] = round(float(df[anchor].astype(float).mean()), 1) if df is not None and not df.empty else None
        time.sleep(4)

    _write({"ok": bool(series), "asof": today(), "anchor": anchor,
            "weekly": {"dates": dates, "series": series}, "prefs": prefs})


def _write(obj: dict) -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    with open(DATA / "trends.json", "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
    print(f"wrote data/trends.json ok={obj.get('ok')}")


if __name__ == "__main__":
    main()
