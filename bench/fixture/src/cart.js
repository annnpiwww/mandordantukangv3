const TAX_RATE = 0.11;

function cartTotal(items) {
  const subtotal = items.reduce((sum, it) => sum + it.cents * it.qty, 0);
  return Math.round(subtotal * (1 + TAX_RATE));
}

module.exports = { cartTotal };
