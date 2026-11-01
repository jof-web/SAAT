import { test, expect } from 'vitest';
import { runAcceptance } from '../src/qa/acceptance';
test('critérios de aceite A1–A13 + golden', () => {
  const r = runAcceptance();
  for (const x of r) console.log(`${x.pass ? 'PASS' : 'FALHA'} ${x.id} ${x.nome}\n   esperado: ${x.esperado}\n   obtido:   ${x.obtido}`);
  expect(r.filter((x) => !x.pass).map((x) => x.id)).toEqual([]);
});
