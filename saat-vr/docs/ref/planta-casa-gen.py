# Planta 2D (hipótese) do interior da casa de comando, a partir das 17 fotos. Medidas ESTIMADAS.
import math
S = 64; OX = 70; OY = 110; W = 9.0; L = 19.5
FONT = '/home/claude/se-treino/node_modules/@fontsource'
X = lambda x: OX + x * S
Y = lambda y: OY + (W - y) * S
out = []
def add(s): out.append(s)
def rect(x0, y0, x1, y1, fill='none', stroke='#30363b', sw=1.5, extra=''):
    add(f'<rect x="{X(x0):.1f}" y="{Y(y1):.1f}" width="{(x1-x0)*S:.1f}" height="{(y1-y0)*S:.1f}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" {extra}/>')
def line(x0, y0, x1, y1, stroke='#30363b', sw=1.5, extra=''):
    add(f'<line x1="{X(x0):.1f}" y1="{Y(y0):.1f}" x2="{X(x1):.1f}" y2="{Y(y1):.1f}" stroke="{stroke}" stroke-width="{sw}" {extra}/>')
def text(x, y, s, size=12, fill='#1b1f24', anchor='middle', weight=600, fam='C', rot=0):
    f = '"Barlow Condensed"' if fam == 'C' else 'Barlow'
    tr = f' transform="rotate({rot} {X(x):.1f} {Y(y):.1f})"' if rot else ''
    add(f'<text x="{X(x):.1f}" y="{Y(y):.1f}" font-family={f!r} font-size="{size}" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}" dominant-baseline="middle"{tr}>{s}</text>')
def q(x, y, n):  # marcador de dúvida
    add(f'<circle cx="{X(x):.1f}" cy="{Y(y):.1f}" r="11" fill="#f2c230" stroke="#111" stroke-width="1.5"/>')
    text(x, y - 0.005, str(n), 13, '#111', weight=700)
def cam(x, y, ang, n):  # posição da foto; ang em graus (0 = +x, 90 = +y)
    a = math.radians(ang); cx, cy = X(x), Y(y); r = 26
    p1 = (cx + r * math.cos(a - 0.38), cy - r * math.sin(a - 0.38)); p2 = (cx + r * math.cos(a + 0.38), cy - r * math.sin(a + 0.38))
    add(f'<path d="M{cx:.1f},{cy:.1f} L{p1[0]:.1f},{p1[1]:.1f} L{p2[0]:.1f},{p2[1]:.1f} Z" fill="#6fb3e0" fill-opacity=".35" stroke="#2e6fb5" stroke-width="1"/>')
    add(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="8" fill="#2e6fb5"/>')
    add(f'<text x="{cx:.1f}" y="{cy+0.5:.1f}" font-family="Barlow Condensed" font-size="10" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="middle">{n}</text>')

add('<defs><pattern id="xadrez" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#7d7f80"/><path d="M0,4 L4,0 M4,8 L8,4" stroke="#5e6062" stroke-width="1.2"/></pattern>'
    '<pattern id="lote" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#e7e4dc"/><line x1="0" y1="0" x2="0" y2="6" stroke="#cfcac0" stroke-width="2"/></pattern></defs>')
# ---------- piso, faixas e zonas ----------
rect(0, 0, L, W, '#d6d6d8', 'none')                       # piso cinza pintado
rect(19.5, 2.4, 23.5, 5.4, '#dcdcde', 'none')             # piso da sala de baterias
# canaleta com chapas xadrez (do PDMT até a parede A) + faixa amarela larga
rect(0.9, 1.45, 5.9, 2.75, '#e0c890', 'none'); rect(1.2, 1.7, 5.9, 2.5, 'url(#xadrez)', 'none')
# área dos retificadores e QDCC (xadrez + borda amarela)
rect(15.9, 7.75, 18.6, 9.0, '#e0c890', 'none'); rect(16.1, 7.95, 18.4, 9.0, 'url(#xadrez)', 'none')
rect(18.75, 7.2, 19.5, 9.0, '#e0c890', 'none'); rect(18.9, 7.35, 19.5, 9.0, 'url(#xadrez)', 'none')
# base amarela do PSPC
rect(13.25, 8.0, 15.85, 9.0, '#e0c890', 'none')
# faixa amarela de circulação na frente do PDMT e linha vermelha de limite
add(f'<path d="M{X(5.6)},{Y(3.1)} L{X(5.6)},{Y(5.7)} L{X(14.6)},{Y(5.7)} L{X(14.6)},{Y(3.1)}" fill="none" stroke="#e0b21e" stroke-width="4"/>')
add(f'<path d="M{X(5.85)},{Y(3.1)} L{X(5.85)},{Y(4.1)} L{X(14.35)},{Y(4.1)} L{X(14.35)},{Y(3.1)}" fill="none" stroke="#c8202e" stroke-width="3"/>')
line(5.9, 1.12, 14.3, 1.12, '#e0b21e', 3)                  # faixa no corredor traseiro
# quadrados de extintor (vermelho com borda amarela, NBR 13434)
for (x0, y0) in [(8.6, 7.95)]:
    rect(x0, y0, x0 + 1.0, y0 + 1.0, '#c8202e', '#e0b21e', 5)
rect(17.9, 1.95, 18.7, 2.85, 'none', '#e0b21e', 5); rect(18.0, 2.05, 18.6, 2.75, 'none', '#c8202e', 2)
# ---------- paredes ----------
T = 0.2
def wallH(y, x0, x1, gaps=()):   # parede horizontal com vãos
    xs = [x0] + [g for gap in gaps for g in gap] + [x1]
    for i in range(0, len(xs), 2): rect(xs[i], y - T / 2, xs[i + 1], y + T / 2, '#8a8580', 'none')
def wallV(x, y0, y1, gaps=()):
    ys = [y0] + [g for gap in gaps for g in gap] + [y1]
    for i in range(0, len(ys), 2): rect(x - T / 2, ys[i], x + T / 2, ys[i + 1], '#8a8580', 'none')
wallH(W, -0.1, L + 0.1); wallH(0, -0.1, L + 0.1)
wallV(0, 0, W, [(6.1, 8.8)])                                 # parede A com portão
wallV(L, 0, W, [(0.4, 1.5), (3.9, 4.9)])                     # parede B: porta alta + porta baterias
wallH(5.4, L, 23.6); wallH(2.4, L, 23.6); wallV(23.5, 2.4, 5.4)  # sala de baterias
# janelas altas com grade (parede F) e da sala de baterias
for x0 in (2.4, 7.2, 11.0, 16.7):
    rect(x0, W - 0.1, x0 + 1.0, W + 0.1, '#bfe3f2', '#30363b', 1.2)
rect(21.0, 5.3, 21.9, 5.5, '#bfe3f2', '#30363b', 1.2)
# pilares de concreto
for x in (0.0, 5.0, 10.0, 15.0, 19.5):
    for y in (W - 0.45, 0.0):
        rect(x - 0.22 if 0 < x < L else (0 if x == 0 else L - 0.45), y, (x + 0.22) if 0 < x < L else (0.45 if x == 0 else L), y + 0.45, '#b3ab9e', '#30363b', 1)
for y0 in (4.45, 5.65): rect(0, y0, 0.45, y0 + 0.4, '#b3ab9e', '#30363b', 1)
# portão de 2 folhas (parede A) + porta alta (parede B) + porta baterias
for (y0, d) in ((6.1, 1), (8.8, -1)):
    add(f'<path d="M{X(0)},{Y(y0)} L{X(1.35)},{Y(y0)} A{1.35*S},{1.35*S} 0 0 {0 if d > 0 else 1} {X(0)},{Y(y0 + d*1.35)}" fill="none" stroke="#30363b" stroke-width="1" stroke-dasharray="4 3"/>')
    rect(0, min(y0, y0 + d * 0.06), 1.35, max(y0, y0 + d * 0.06), '#3b3e42', 'none')
add(f'<path d="M{X(L)},{Y(1.5)} L{X(L-1.1)},{Y(1.5)} A{1.1*S},{1.1*S} 0 0 1 {X(L)},{Y(0.4)}" fill="none" stroke="#30363b" stroke-width="1" stroke-dasharray="4 3"/>')
add(f'<path d="M{X(L)},{Y(4.9)} L{X(L+0.95)},{Y(4.9)} A{0.95*S},{0.95*S} 0 0 1 {X(L)},{Y(3.95)}" fill="none" stroke="#30363b" stroke-width="1" stroke-dasharray="4 3"/>')
# ---------- luminárias tubulares em perfilado ----------
for y in (2.6, 6.6):
    line(0.4, y, 19.1, y, '#9aa1a6', 1, 'stroke-dasharray="2 4"')
    for x in (1.6, 6.0, 10.4, 14.8):
        rect(x, y - 0.07, x + 1.3, y + 0.07, '#fff6c8', '#8a8f93', 1)
# ---------- PDMT 13,8 kV: 10 cubículos (frente para a parede F) ----------
rect(5.9, 1.2, 14.3, 3.1, '#c9cdc8', '#30363b', 2)
cubs = [('10Q1', '89-6', 'TSA-2', 1.0), ('9Q1', '52-4', 'TR-02'), ('8Q1', '529', 'saída'), ('7Q1', '528', 'saída'), ('6', 'transição', 'IHM'),
        ('5Q1', '52-5', 'acopl.'), ('4Q1', '89-5', 'TSA-1'), ('3Q1', '52-3', 'TR-01'), ('2Q1', '52-7', 'PCCB'), ('1Q1', '52-6', 'MPTF-2')]
x = 6.0
for c in cubs:
    w = c[3] if len(c) > 3 else 0.8
    rect(x, 2.75, x + w, 3.1, '#89919d', '#30363b', 1)      # faixa da porta (frente)
    line(x, 1.2, x, 3.1, '#30363b', 1)
    text(x + w / 2, 2.35, c[0], 12, '#111', weight=700); text(x + w / 2, 1.95, c[1], 10.5, '#30363b', weight=600); text(x + w / 2, 1.6, c[2], 10, '#59626a', weight=600)
    x += w
line(14.2, 1.2, 14.2, 3.1, '#30363b', 1)
text(10.1, 3.45, 'frente do PDMT 13,8 kV (10 cubículos + capota)', 12, '#30363b')
# carrinho do disjuntor no corredor traseiro + estação meteorológica
rect(4.55, 0.25, 5.45, 0.95, '#a6adb2', '#30363b', 1); text(5.0, 0.6, 'carrinho DJ', 9.5)
for (cx, cy) in ((2.4, 0.55), (3.3, 0.7)): add(f'<circle cx="{X(cx)}" cy="{Y(cy)}" r="7" fill="#fff" stroke="#30363b"/>')
text(2.85, 1.15, 'estação meteorológica (prop)', 9.5, '#59626a')
# ---------- parede A: vara, EPI, mesa SCADA, mesa auxiliar ----------
line(0.12, 0.35, 0.12, 1.45, '#e8590c', 5); text(0.55, 0.9, 'vara', 9.5, '#59626a', rot=-90)
add(f'<circle cx="{X(0.95)}" cy="{Y(1.1)}" r="6" fill="none" stroke="#30363b"/>')
rect(0.0, 1.5, 0.55, 2.7, '#2e6fb5', '#30363b', 1.2); text(0.9, 2.1, 'armário EPI', 10.5, rot=-90)
rect(0.0, 2.8, 0.8, 4.4, '#c9a46a', '#30363b', 1.2); text(0.4, 3.6, 'mesa SCADA', 10.5, rot=-90)
line(0.06, 3.0, 0.06, 4.2, '#18191b', 4); add(f'<circle cx="{X(1.3)}" cy="{Y(3.6)}" r="9" fill="#30363b"/>')
text(1.75, 3.6, 'TV na parede + monitor + PC', 9.5, '#59626a', rot=-90)
rect(0.0, 4.9, 0.6, 5.6, '#eceae4', '#30363b', 1); add(f'<circle cx="{X(0.95)}" cy="{Y(5.25)}" r="7" fill="#18191b"/>')
text(1.5, 5.25, 'mesa aux. + caixas', 9.5, '#59626a', rot=-90)
text(1.75, 7.45, 'portão 2 folhas (aço escuro, ~2,7 × 4,5 m)', 10.5, '#30363b', rot=-90)
# ---------- parede F: armário de vidro, PSPC, retificadores ----------
rect(13.4, 8.25, 14.0, 8.85, '#dfe6ea', '#30363b', 1.2); text(13.7, 7.85, 'arm. vidro', 9.5)
rect(14.1, 8.2, 15.7, 8.85, '#eceae4', '#30363b', 1.5); text(14.9, 8.5, 'PSPC (2 portas)', 10.5, weight=700)
line(14.15, 8.2, 15.65, 8.2, '#c8202e', 2)
for (x0, n) in ((16.2, 'RET-2'), (17.4, 'RET-1')): rect(x0, 8.15, x0 + 0.8, 8.9, '#c9cdc8', '#30363b', 1.2); text(x0 + 0.4, 8.5, n, 10, weight=700)
text(17.2, 7.55, 'saída ← (placa)', 9.5, '#00843d')
# ---------- parede B: QDCC, QDCA, QSA, prateleira, porta baterias, quadro, extintor, porta alta ----------
for (y0, n) in ((8.25, 'QDCC'), (7.55, 'QDCA')): rect(19.2, y0, 19.4, y0 + 0.6, '#e9e6dc', '#30363b', 1.2); text(18.95, y0 + 0.3, n, 9.5, rot=-90)
rect(19.15, 6.7, 19.4, 7.3, '#e9e6dc', '#30363b', 1.2); text(18.95, 7.0, 'QSA', 9.5, rot=-90)
rect(19.05, 6.0, 19.4, 6.45, '#a6adb2', '#30363b', 1); text(18.85, 6.22, 'prat.', 9, '#59626a', rot=-90)
rect(19.3, 3.15, 19.4, 3.8, '#fff', '#30363b', 1); text(19.0, 3.47, 'quadro', 9, '#59626a', rot=-90)
rect(18.7, 2.0, 19.4, 2.9, '#b3ab9e', '#30363b', 1); add(f'<circle cx="{X(18.3)}" cy="{Y(2.4)}" r="7" fill="#c8202e"/>')
text(17.4, 2.4, 'extintor carreta', 9.5, '#c8202e')
text(18.75, 0.95, 'porta alta', 9.5, '#30363b', rot=-90)
# ---------- sala de baterias ----------
for (y0, y1) in ((2.65, 3.75), (4.15, 5.2)): rect(22.6, y0, 23.35, y1, '#30363b', '#18191b', 1)
rect(20.0, 2.55, 20.6, 3.3, '#a0784a', '#30363b', 1); text(21.5, 3.95, 'SALA DE BATERIAS', 11, weight=700)
text(21.5, 3.55, '2 racks · baterias VRLA', 9.5, '#59626a'); text(21.45, 5.05, 'janela + split', 9, '#59626a')
# ---------- câmeras (onde cada foto foi tirada) ----------
for (x, y, a, n) in [(11.0, 6.6, 180, 1), (4.6, 4.7, 0, 2), (2.0, 0.7, 5, 3), (1.7, 2.1, 180, 4), (3.0, 3.4, 180, 5), (11.5, 7.2, 270, 6),
                     (3.2, 7.2, 180, 7), (17.0, 6.4, 90, 8), (15.8, 5.3, 110, 9), (15.6, 4.8, 215, 10), (14.9, 6.9, 90, 11), (16.7, 7.0, 15, 12),
                     (20.3, 4.4, 0, 13), (15.4, 0.6, 180, 14), (16.0, 3.3, 10, 16), (16.2, 0.95, 175, 17)]:
    cam(x, y, a, n)
# ---------- cotas (estimadas) ----------
def dim(x0, y0, x1, y1, s, off):
    add(f'<line x1="{X(x0)}" y1="{Y(y0)+off}" x2="{X(x1)}" y2="{Y(y1)+off}" stroke="#59626a" stroke-width="1" marker-start="url(#a)" marker-end="url(#a)"/>')
add('<defs><marker id="a" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M4,0 L4,8" stroke="#59626a" stroke-width="1.5"/></marker></defs>')
dim(0, W, L, W, '', -38); text(L / 2, W + 0.82, '≈ 19,5 m (estimado)', 13, '#30363b')
add(f'<line x1="{X(0)-38}" y1="{Y(W)}" x2="{X(0)-38}" y2="{Y(0)}" stroke="#59626a" stroke-width="1" marker-start="url(#a)" marker-end="url(#a)"/>')
text(-0.8, W / 2, '≈ 9,0 m', 13, '#30363b', rot=-90)
dim(5.9, 0, 14.3, 0, '', 26); text(10.1, -0.62, 'PDMT ≈ 8,4 m · corredor traseiro ≈ 1,2 m · faixa vermelha a ≈ 1,0 m da frente', 11, '#59626a')
# ---------- dúvidas ----------
for (x, y, n) in [(15.3, 7.75, 1), (19.0, 9.6, 2), (0.6, 8.3, 3), (22.9, 5.75, 4), (12.7, 0.45, 5)]: q(x, y, n)
# rótulos de paredes
text(9.6, W + 0.35, 'PAREDE F — janelas altas com grade', 11, '#59626a', weight=700)
text(9.6, -0.28, 'PAREDE R — pilares de concreto, eletrodutos', 11, '#59626a', weight=700)
svg = '\n'.join(out)
legend = '''
<div class="leg">
 <div><i style="background:#d6d6d8"></i>piso de concreto pintado cinza</div>
 <div><i class="xd"></i>canaleta com chapa xadrez</div>
 <div><i style="background:#e0c890"></i>faixa amarela larga (borda de canaleta/base)</div>
 <div><i class="ln" style="border-color:#e0b21e"></i>faixa amarela de circulação</div>
 <div><i class="ln" style="border-color:#c8202e"></i>linha vermelha de limite</div>
 <div><i style="background:#c8202e;outline:3px solid #e0b21e"></i>área de extintor</div>
 <div><i style="background:#fff6c8;height:6px"></i>luminária tubular no perfilado</div>
 <div><i style="background:#2e6fb5;border-radius:50%"></i>posição e direção da foto (nº)</div>
 <div><i style="background:#f2c230;border-radius:50%"></i>dúvida a confirmar (nº)</div>
</div>'''
html = f'''<!doctype html><meta charset="utf-8"><style>
@font-face{{font-family:"Barlow Condensed";font-weight:600;src:url(file://{FONT}/barlow-condensed/files/barlow-condensed-latin-600-normal.woff2)}}
@font-face{{font-family:"Barlow Condensed";font-weight:700;src:url(file://{FONT}/barlow-condensed/files/barlow-condensed-latin-700-normal.woff2)}}
@font-face{{font-family:Barlow;font-weight:400;src:url(file://{FONT}/barlow/files/barlow-latin-400-normal.woff2)}}
body{{margin:0;background:#f7f5ef;font-family:Barlow;color:#1b1f24}} .wrap{{padding:22px 28px}}
h1{{margin:0;font:700 28px "Barlow Condensed";letter-spacing:.02em}} p.s{{margin:4px 0 0;color:#59626a;font-size:15px}}
.leg{{display:grid;grid-template-columns:repeat(3,auto);gap:6px 28px;margin:6px 0 0;font-size:13.5px;color:#30363b;justify-content:start}}
.leg i{{display:inline-block;width:18px;height:12px;margin-right:8px;vertical-align:-1px;border:1px solid #30363b}} .leg i.ln{{height:0;border:0;border-top:3px solid;width:22px;vertical-align:3px}}
.leg i.xd{{background:repeating-linear-gradient(45deg,#7d7f80 0 3px,#5e6062 3px 5px)}}
</style><div class="wrap"><h1>Casa de comando — planta do interior (hipótese para validar)</h1>
<p class="s">Feita a partir das 17 fotos. Medidas estimadas pela escala das pessoas e dos cubículos; corrigir com trena. Topo da planta = parede das janelas.</p>
<svg width="1700" height="800" viewBox="0 0 1700 800" xmlns="http://www.w3.org/2000/svg">{svg}</svg>{legend}</div>'''
open('/tmp/claude-0/-home-claude/260e9ac4-1f1b-54b7-918f-564468668f5a/scratchpad/planta/planta.html', 'w', encoding='utf8').write(html)
print('ok')
