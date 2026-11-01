// "Impressão" de face: todas as legendas, plaquetas, mímicos e avisos de uma face de painel em UMA textura
// transparente (1 draw call, texto nítido). Coordenadas em metros a partir do canto inferior esquerdo da face.
import { Mesh, PlaneGeometry, MeshStandardMaterial, CanvasTexture, SRGBColorSpace } from 'three';
import { FONT, MONO, picto, tri } from './common';

export class Print {
  c: HTMLCanvasElement; g: CanvasRenderingContext2D; ppm: number;
  constructor(public w: number, public h: number, ppm = 520) {
    this.ppm = ppm; this.c = document.createElement('canvas'); this.c.width = Math.round(w * ppm); this.c.height = Math.round(h * ppm); this.g = this.c.getContext('2d')!;
  }
  private X(x: number) { return x * this.ppm; } private Y(y: number) { return (this.h - y) * this.ppm; }
  rect(x: number, y: number, w: number, h: number, fill: string, stroke?: string, lw = 0.002) {
    const g = this.g; g.fillStyle = fill; g.fillRect(this.X(x), this.Y(y + h), w * this.ppm, h * this.ppm);
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw * this.ppm; g.strokeRect(this.X(x), this.Y(y + h), w * this.ppm, h * this.ppm); }
  }
  text(s: string, x: number, y: number, size: number, o: { color?: string; weight?: number; align?: CanvasTextAlign; mono?: boolean; maxW?: number } = {}) {
    const g = this.g; let fs = size * this.ppm; g.font = `${o.weight ?? 600} ${fs}px ${o.mono ? MONO : FONT}`;
    if (o.maxW) while (g.measureText(s).width > o.maxW * this.ppm && fs > 4) { fs -= 0.5; g.font = `${o.weight ?? 600} ${fs}px ${o.mono ? MONO : FONT}`; }
    g.fillStyle = o.color || '#151719'; g.textAlign = o.align || 'center'; g.textBaseline = 'middle'; g.fillText(s, this.X(x), this.Y(y));
  }
  /** Plaqueta operacional (amarela, texto preto). */
  tag(s: string, x: number, y: number, w: number, h: number, bg = '#f2c230') { this.rect(x - w / 2, y - h / 2, w, h, bg, '#111', 0.003); this.text(s, x, y, h * 0.62, { weight: 700, maxW: w * 0.9 }); }
  line(pts: [number, number][], color: string, lw: number) { const g = this.g; g.strokeStyle = color; g.lineWidth = lw * this.ppm; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(this.X(x), this.Y(y)) : g.moveTo(this.X(x), this.Y(y)))); g.stroke(); }
  circle(x: number, y: number, r: number, fill?: string, stroke?: string, lw = 0.002) { const g = this.g; g.beginPath(); g.arc(this.X(x), this.Y(y), r * this.ppm, 0, Math.PI * 2); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw * this.ppm; g.stroke(); } }
  /** Aviso de perigo compacto (triângulo + texto). */
  danger(x: number, y: number, w: number, lines: string[]) {
    const h = w * 0.62; this.rect(x - w / 2, y - h / 2, w, h, '#f7f5ef', '#222', 0.002); this.rect(x - w / 2, y + h / 2 - h * 0.28, w, h * 0.28, '#c8102e');
    this.text('PERIGO', x, y + h / 2 - h * 0.14, h * 0.2, { color: '#fff', weight: 800 });
    const g = this.g, s = h * 0.5 * this.ppm, tx = this.X(x - w / 2 + w * 0.06), ty = this.Y(y + h * 0.18);
    g.beginPath(); g.moveTo(tx + s / 2, ty); g.lineTo(tx + s, ty + s * 0.88); g.lineTo(tx, ty + s * 0.88); g.closePath(); g.fillStyle = '#f2c230'; g.fill(); g.lineWidth = s * 0.07; g.strokeStyle = '#111'; g.stroke();
    picto(g, 'raio', tx + s / 2, ty + s * 0.58, s * 0.32, '#111');
    lines.forEach((l, i) => this.text(l, x + w * 0.16, y - h * 0.02 - i * h * 0.2 + (lines.length - 1) * h * 0.1, h * 0.15, { weight: 700, maxW: w * 0.62 }));
  }
  poly(pts: [number, number][], fill: string) { const g = this.g; g.fillStyle = fill; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(this.X(x), this.Y(y)) : g.moveTo(this.X(x), this.Y(y)))); g.closePath(); g.fill(); }
  /** Triângulo de advertência (ISO 7010 W012) de lado s (m), centro (x,y). */
  warn(x: number, y: number, s: number) { tri(this.g, this.X(x - s / 2), this.Y(y + s * 0.44), s * this.ppm); }
  /** Etiqueta de arco elétrico (PERIGO / AVISO), w × 1,35w. */
  arc(x: number, y: number, w: number) { const h = w * 1.35, x0 = x - w / 2, y0 = y - h / 2;
    this.rect(x0, y0, w, h, '#f4c430', '#222', 0.0015); this.rect(x0, y0 + h * 0.8, w, h * 0.2, '#c8102e'); this.text('PERIGO', x, y0 + h * 0.9, h * 0.11, { color: '#fff', weight: 800 });
    this.warn(x0 + w * 0.2, y0 + h * 0.66, w * 0.24); this.text('RISCO DE ARCO', x + w * 0.12, y0 + h * 0.69, h * 0.065, { weight: 700, maxW: w * 0.6 }); this.text('ELÉTRICO', x + w * 0.12, y0 + h * 0.62, h * 0.065, { weight: 700, maxW: w * 0.6 });
    for (let k = 0; k < 3; k++) this.rect(x0 + w * 0.08, y0 + h * (0.3 + k * 0.08), w * 0.84, h * 0.045, '#e9e2c8');
    this.rect(x0, y0, w, h * 0.17, '#e86a1c'); this.text('AVISO', x, y0 + h * 0.085, h * 0.1, { color: '#111', weight: 800 }); }
  mesh(rough = 0.5) {
    const t = new CanvasTexture(this.c); t.colorSpace = SRGBColorSpace; t.anisotropy = 8;
    const m = new Mesh(new PlaneGeometry(this.w, this.h), new MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.02, roughness: rough, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.castShadow = false; m.receiveShadow = true; return m;
  }
}
