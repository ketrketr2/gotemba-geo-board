"""回答本文からの検出: 施設・テーマ・ペルソナ・極性。

detect_outlets はトヨタ detect_cars の確定形をそのまま移植:
  「全トークン（alias+guard）を長い順・同長なら alias 優先で走査し、
   一致区間を＊でマスクしながら最小位置を記録 → 出現順 rank 化」
guard を施設ごとに先処理すると他 alias を壊すバグを実際に踏んだため、必ずこの形。

英語 alias 対策として、照合は NFKC + casefold 正規化テキストに対して行う
（HANDOFF §3「英語aliasは大文字小文字ゆれに注意（検出は正規化後に行う）」）。
"""
from __future__ import annotations

import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import load, sentences  # noqa: E402


def catalog() -> list[dict]:
    cfg = load("outlets")
    rows = [{**cfg["self"], "own": True, "tier": "self"}]
    rows += [{**c, "own": False, "tier": "t1"} for c in cfg["tier1"]]
    rows += [{**c, "own": False, "tier": "t2"} for c in cfg["tier2"]]
    return rows


def _norm(text: str) -> str:
    return unicodedata.normalize("NFKC", text or "").casefold()


def detect_outlets(text: str, cat: list[dict] | None = None) -> dict[str, dict]:
    """回答本文から施設の言及位置と出現順位を取る。"""
    if not text:
        return {}
    cat = cat or catalog()
    work = _norm(text)
    tokens = [(_norm(a), c["id"]) for c in cat for a in c["aliases"]]
    tokens += [(_norm(g), None) for c in cat for g in (c.get("guards") or [])]
    tokens.sort(key=lambda x: (-len(x[0]), x[1] is None))   # 長い順・同長ならalias優先
    found: dict[str, int] = {}
    for tok, cid in tokens:
        if not tok:
            continue
        start = 0
        while True:
            i = work.find(tok, start)
            if i < 0:
                break
            if cid is not None and (cid not in found or i < found[cid]):
                found[cid] = i
            work = work[:i] + "＊" * len(tok) + work[i + len(tok):]
            start = i + len(tok)
    order = sorted(found, key=lambda k: found[k])
    return {cid: {"pos": pos, "rank": order.index(cid) + 1} for cid, pos in found.items()}


def _hit_words(s_norm: str, words: list[str]) -> bool:
    return any(_norm(w) in s_norm for w in words)


def sent_polarity(s_norm: str) -> str:
    sx = load("outlets")["sentiment"]
    p = sum(s_norm.count(_norm(w)) for w in sx["positive"])
    n = sum(s_norm.count(_norm(w)) for w in sx["negative"])
    return "pos" if p > n else "neg" if n > p else "neu"


def theme_persona_scan(text: str, cat: list[dict] | None = None) -> dict:
    """文単位でテーマ・ペルソナ・施設の共起を取る。

    戻り値:
      themes:   [{theme, outlets:[id], pol, snippet}]
      personas: [{persona, outlets:[id], snippet}]
    勝敗マトリクスは v1 ヒューリスティック（共起×極性）。回答全文を snapshot に
    保存してあるので、辞書やロジックを改良したら過去分も再計算できる。
    """
    cat = cat or catalog()
    cfg = load("outlets")
    out_t, out_p = [], []
    for s in sentences(text):
        sn = _norm(s)
        det = detect_outlets(s, cat)
        if not det:
            continue
        pol = sent_polarity(sn)
        for tid, t in cfg["themes"].items():
            if _hit_words(sn, t["words"]):
                out_t.append({"theme": tid, "outlets": sorted(det, key=lambda k: det[k]["pos"]),
                              "pol": pol, "snippet": s[:160]})
        for pid, p in cfg["personas"].items():
            if _hit_words(sn, p["words"]):
                out_p.append({"persona": pid, "outlets": sorted(det, key=lambda k: det[k]["pos"]),
                              "snippet": s[:160]})
    return {"themes": out_t, "personas": out_p}


# ---------------------------------------------------------------- selftest
def _selftest() -> None:
    cat = catalog()
    # 1) guard衝突: 御殿場線・御殿場市はヒットさせず、正式名称は拾う
    t1 = ("アクアラインを使えば三井アウトレットパーク木更津が便利です。"
          "御殿場線は本数が少ないですが、御殿場プレミアム・アウトレットは"
          "御殿場駅から無料バスがあります。御殿場市の観光も楽しめます。")
    d1 = detect_outlets(t1, cat)
    assert set(d1) == {"kisarazu", "gotemba"}, d1
    assert d1["kisarazu"]["rank"] == 1 and d1["gotemba"]["rank"] == 2, d1
    # 2) 英語・大文字小文字
    t2 = "If you want outlet shopping near Mt Fuji, GOTEMBA PREMIUM OUTLETS is the best choice."
    d2 = detect_outlets(t2, cat)
    assert set(d2) == {"gotemba"}, d2
    # 3) 「御殿場」単独では拾わない（市名・駅名との衝突回避）
    t3 = "御殿場は自衛隊の演習場で有名な街です。"
    assert detect_outlets(t3, cat) == {}, detect_outlets(t3, cat)
    # 4) guardの誤マスクが他施設aliasを壊さない（佐野ラーメン vs 佐野アウトレット）
    t4 = "佐野ラーメンを食べてから佐野プレミアム・アウトレットへ。軽井沢アウトレットも人気です。"
    d4 = detect_outlets(t4, cat)
    assert set(d4) == {"sano", "karuizawa"}, d4
    # 5) テーマ共起
    r = theme_persona_scan("富士山を眺めながら買い物できるのは御殿場アウトレットならではの魅力です。", cat)
    assert any(x["theme"] == "view" and "gotemba" in x["outlets"] and x["pol"] == "pos"
               for x in r["themes"]), r
    print("detect selftest: OK (5/5)")


if __name__ == "__main__":
    _selftest()
