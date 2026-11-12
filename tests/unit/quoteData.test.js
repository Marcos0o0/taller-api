const assert = require('node:assert/strict');
const { calculateTotals, normalizeItems, materialChanged } = require('../../src/utils/quoteData');

test('calculates CLP IVA and balance from lines, ignoring client totals', () => {
  const totals = calculateTotals(
    [{ type: 'service', name: 'Frenos', quantity: 2, price: 1050 }],
    true,
    [{ amount: 500 }]
  );
  assert.deepEqual(totals, {
    subtotal: 2100,
    tax: 399,
    estimatedCost: 2499,
    totalAbonos: 500,
    saldoPendiente: 1999,
  });
});

test('rejects invalid money and payments exceeding total', () => {
  for (const price of [-1, NaN, Infinity, '100']) {
    assert.throws(() => normalizeItems([{ type: 'part', name: 'Filtro', quantity: 1, price }]));
  }
  assert.throws(() =>
    calculateTotals([{ type: 'part', name: 'Filtro', quantity: 1, price: 100 }], false, [
      { amount: 101 },
    ])
  );
});

test('notes are not a material price or work change', () => {
  const quote = {
    items: [{ type: 'service', name: 'Frenos', price: 2000, quantity: 1 }],
    estimatedCost: 2380,
    includeIVA: true,
  };
  assert.equal(materialChanged(quote, { ...quote, notes: 'Llamar' }), false);
  assert.equal(materialChanged(quote, { ...quote, estimatedCost: 2500 }), true);
});

test('normaliza referencias pobladas y distingue cambios de cliente y vehículo', () => {
  const before = {
    clientId: { _id: 'client-a' },
    vehicleId: { _id: 'vehicle-a' },
    vehicle: { licensePlate: 'ABCD12' },
  };
  const after = {
    clientId: 'client-a',
    vehicleId: 'vehicle-a',
    vehicle: { licensePlate: 'ABCD12' },
  };
  assert.equal(materialChanged(before, after), false);
  assert.equal(materialChanged(before, { ...after, clientId: 'client-b' }), true);
  assert.equal(materialChanged(before, { ...after, vehicle: { licensePlate: 'ZZXX11' } }), true);
});
