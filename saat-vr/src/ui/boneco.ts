// Boneco 2D de EPI (canto da tela no desktop, painel no VR): cada peça fica verde quando vestida, vermelha quando exigida
// e faltando, apagada quando não exigida. Contorno verde = pronto para operar.
export type ParteEpi = 'capacete' | 'oculos' | 'protetor_facial' | 'balaclava' | 'auricular' | 'vestimenta' | 'luvas' | 'botina';
export type EstadoParte = 'ok' | 'falta' | 'off';
export interface Boneco { partes: Record<ParteEpi, EstadoParte>; pronto: boolean; faltam: string[] }

const PARTE: Record<string, ParteEpi> = {
  capacete: 'capacete', oculos: 'oculos', oculos_ampla: 'oculos', protetor_facial: 'protetor_facial', balaclava: 'balaclava', protetor_auricular: 'auricular',
  vestimenta: 'vestimenta', luva_isolante: 'luvas', luva_cobertura: 'luvas', luva_pvc: 'luvas', botina: 'botina',
};
/** exigidos: ids de EPI exigidos agora; tem(id): está vestido; nome(id): nome legível. */
export function estadoBoneco(exigidos: string[], tem: (id: string) => boolean, nome: (id: string) => string): Boneco {
  const partes = { capacete: 'off', oculos: 'off', protetor_facial: 'off', balaclava: 'off', auricular: 'off', vestimenta: 'off', luvas: 'off', botina: 'off' } as Record<ParteEpi, EstadoParte>;
  for (const [id, p] of Object.entries(PARTE)) if (tem(id) && partes[p] === 'off') partes[p] = 'ok';
  const faltam: string[] = [];
  for (const id of new Set(exigidos)) { const p = PARTE[id]; if (!p) continue; if (!tem(id)) { partes[p] = 'falta'; faltam.push(nome(id)); } }
  return { partes, pronto: faltam.length === 0, faltam };
}

const COR = { ok: '#3da56a', falta: '#e5484d', off: '#3a4046' } as const;
/** Desenha o boneco num canvas (w × h px). */
export function desenharBoneco(g: CanvasRenderingContext2D, w: number, h: number, b: Boneco, titulo = '') {
  const s = Math.min(w / 120, h / 230), cx = w / 2, P = b.partes; g.clearRect(0, 0, w, h);
  g.fillStyle = 'rgba(13,16,18,0.82)'; g.beginPath(); (g as any).roundRect ? (g as any).roundRect(0, 0, w, h, 6 * s) : g.rect(0, 0, w, h); g.fill();
  g.strokeStyle = b.pronto ? COR.ok : '#e39b2d'; g.lineWidth = 3 * s; g.stroke();
  const y0 = 22 * s, Y = (v: number) => y0 + v * s, X = (v: number) => cx + v * s;
  const pill = (x: number, y: number, ww: number, hh: number, c: string) => { g.fillStyle = c; g.beginPath(); (g as any).roundRect ? (g as any).roundRect(X(x - ww / 2), Y(y), ww * s, hh * s, Math.min(ww, hh) * s / 2) : g.rect(X(x - ww / 2), Y(y), ww * s, hh * s); g.fill(); };
  const skin = '#8c7a6b';
  // pernas e tronco (vestimenta)
  const vest = COR[P.vestimenta];
  pill(-11, 92, 15, 62, vest); pill(11, 92, 15, 62, vest);
  pill(0, 42, 44, 58, vest);
  pill(-29, 46, 12, 50, vest); pill(29, 46, 12, 50, vest);
  // botinas
  pill(-12, 152, 20, 12, COR[P.botina]); pill(12, 152, 20, 12, COR[P.botina]);
  // luvas
  pill(-29, 94, 14, 16, COR[P.luvas]); pill(29, 94, 14, 16, COR[P.luvas]);
  // cabeça: balaclava (pescoço/cabeça), rosto, óculos, protetor facial, capacete, auricular
  g.fillStyle = P.balaclava === 'off' ? skin : COR[P.balaclava]; g.beginPath(); g.arc(X(0), Y(20), 15 * s, 0, Math.PI * 2); g.fill();
  pill(0, 30, 14, 12, P.balaclava === 'off' ? skin : COR[P.balaclava]);
  g.fillStyle = skin; g.beginPath(); g.ellipse(X(0), Y(21), 9 * s, 10 * s, 0, 0, Math.PI * 2); g.fill();
  pill(0, 16, 20, 5, COR[P.oculos]);
  g.globalAlpha = P.protetor_facial === 'off' ? 0.35 : 0.85; g.strokeStyle = COR[P.protetor_facial]; g.lineWidth = 3 * s; g.beginPath(); g.ellipse(X(0), Y(22), 14 * s, 14 * s, 0, Math.PI * 1.05, Math.PI * 1.95, true); g.stroke(); g.globalAlpha = 1;
  g.fillStyle = COR[P.capacete]; g.beginPath(); g.ellipse(X(0), Y(9), 18 * s, 11 * s, 0, Math.PI, 0); g.fill(); pill(0, 7, 40, 4, COR[P.capacete]);
  pill(-17, 17, 5, 10, COR[P.auricular]); pill(17, 17, 5, 10, COR[P.auricular]);
  // legenda
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = b.pronto ? COR.ok : '#e39b2d';
  g.font = `700 ${Math.round(13 * s)}px "Barlow Condensed", system-ui, sans-serif`;
  g.fillText(b.pronto ? 'PRONTO PARA OPERAR' : `FALTA ${b.faltam.length} EPI`, X(0), Y(178));
  if (titulo) { g.fillStyle = '#98a2aa'; g.font = `600 ${Math.round(11 * s)}px "Barlow Condensed", system-ui, sans-serif`; g.fillText(titulo, X(0), Y(194)); }
}
