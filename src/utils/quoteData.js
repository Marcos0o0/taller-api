function invalid(message) {
  const error = new Error(message);
  error.status = 400;
  throw error;
}

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 500) {
    invalid('Agregue entre 1 y 500 trabajos o repuestos');
  }
  return items.map((item) => {
    if (
      !item ||
      !['service', 'part'].includes(item.type) ||
      typeof item.name !== 'string' ||
      !item.name.trim() ||
      item.name.length > 500
    ) {
      invalid('Cada trabajo o repuesto necesita un nombre válido');
    }
    if (
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0 ||
      !Number.isSafeInteger(item.price) ||
      item.price < 0
    ) {
      invalid('Revise las cantidades y precios. Los precios deben ser pesos enteros');
    }
    if (
      item.description !== undefined &&
      (typeof item.description !== 'string' || item.description.length > 4000)
    ) {
      invalid('La descripción del trabajo es demasiado larga');
    }
    return {
      type: item.type,
      name: item.name.trim(),
      description: item.description?.trim() || '',
      quantity: item.quantity,
      price: item.price,
    };
  });
}

function calculateTotals(items, includeIVA, abonos = []) {
  const normalized = normalizeItems(items);
  const subtotal = Math.round(
    normalized.reduce((sum, item) => sum + item.quantity * item.price, 0)
  );
  const tax = includeIVA ? Math.round(subtotal * 0.19) : 0;
  const estimatedCost = subtotal + tax;
  if (!Number.isSafeInteger(estimatedCost)) invalid('El importe supera el máximo admitido');
  if (
    !Array.isArray(abonos) ||
    abonos.some((abono) => !Number.isSafeInteger(abono.amount) || abono.amount <= 0)
  ) {
    invalid('Cada abono debe ser un monto positivo en pesos');
  }
  const totalAbonos = abonos.reduce((sum, abono) => sum + abono.amount, 0);
  if (totalAbonos > estimatedCost)
    invalid('El total del presupuesto no puede ser menor a sus abonos');
  return { subtotal, tax, estimatedCost, totalAbonos, saldoPendiente: estimatedCost - totalAbonos };
}

function materialChanged(before, after) {
  const referenceId = (value) => String(value?._id || value || '');
  if (referenceId(before.clientId) !== referenceId(after.clientId)) return true;
  if (
    before.vehicleId &&
    after.vehicleId &&
    referenceId(before.vehicleId) !== referenceId(after.vehicleId)
  )
    return true;
  const vehicleChanged = ['brand', 'model', 'year', 'licensePlate', 'mileage'].some(
    (field) => (before.vehicle?.[field] ?? '') !== (after.vehicle?.[field] ?? '')
  );
  return (
    vehicleChanged ||
    ['items', 'proposedWork', 'description', 'estimatedCost', 'includeIVA'].some(
      (field) => JSON.stringify(before[field]) !== JSON.stringify(after[field])
    )
  );
}

module.exports = { calculateTotals, normalizeItems, materialChanged };
