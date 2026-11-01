import { describe, it, expect } from 'vitest';
import { rcpQualidade } from '../src/game/safety';
describe('RCP — ritmo 100–120/min', () => {
  it('110/min constante = 100 % no ritmo', () => { const ts = Array.from({ length: 30 }, (_, i) => i * (60000 / 110)); expect(rcpQualidade(ts)).toBe(1); });
  it('80/min = fora do ritmo', () => { const ts = Array.from({ length: 30 }, (_, i) => i * 750); expect(rcpQualidade(ts)).toBe(0); });
  it('metade lenta, metade certa ≈ 50 %', () => { const ts: number[] = [0]; for (let i = 1; i < 30; i++) ts.push(ts[i - 1] + (i % 2 ? 545 : 800)); expect(rcpQualidade(ts)).toBeGreaterThan(0.4); expect(rcpQualidade(ts)).toBeLessThan(0.6); });
});
