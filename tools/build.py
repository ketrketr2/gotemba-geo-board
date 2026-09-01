#!/usr/bin/env python3
"""御殿場GEOボード: パーツ結合 → plain.html（暗号化前の平文ボード）。"""
import json
import os

CB = os.path.dirname(os.path.abspath(__file__))
data = json.load(open(os.environ.get('BOARD_DATA', f'{CB}/board_data.json'), encoding='utf-8'))
head = open(f'{CB}/part_head.html', encoding='utf-8').read()
js = open(f'{CB}/part_js1.js', encoding='utf-8').read()
html = (head
        + '\n<script>\nwindow.BOARD_DATA=' + json.dumps(data, ensure_ascii=False, separators=(',', ':'))
        + ';\n</script>\n<script>\n' + js + '\n</script>\n</body>\n</html>\n')
open('plain.html', 'w', encoding='utf-8').write(html)
print(f'plain.html {len(html.encode())/1024:.0f}KB')
