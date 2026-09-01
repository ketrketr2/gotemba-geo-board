#!/usr/bin/env python3
"""plain.html → AES-GCM暗号化して index_new.html を生成。

鍵素材は環境変数 GOTEMBA_GATE_KEY（"id:pw" を : で連結した1文字列）。
方式: PBKDF2-SHA256 200,000回 + AES-GCM + gzip（toyota-car-board流用）。
復号後の検証マーカーは GOTEMBA_BOARD（トヨタとは別物・使い回し禁止）。
"""
import base64
import gzip
import os
import sys

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

km = os.environ.get('GOTEMBA_GATE_KEY')
if not km:
    sys.exit('GOTEMBA_GATE_KEY 未設定（"id:pw" 形式。値はGitHub Secretsのみに置く）')
SRC = os.environ.get('SRC', 'plain.html')
DST = os.environ.get('DST', 'index_new.html')
doc = open(SRC, 'rb').read()
if b'GOTEMBA_BOARD' not in doc:
    sys.exit('plain.html に検証マーカー GOTEMBA_BOARD がありません')
salt, iv = os.urandom(16), os.urandom(12)
key = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt,
                 iterations=200000).derive(km.encode())
ct = AESGCM(key).encrypt(iv, gzip.compress(doc, 9), None)
blob = base64.b64encode(salt + iv + ct).decode()
gate = open(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                         'gate_template.html'), encoding='utf-8').read()
open(DST, 'w', encoding='utf-8').write(gate.replace('__BLOB__', blob))
print(f'encrypted {SRC} -> {DST} ({len(blob)//1024}KB blob)')
