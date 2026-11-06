const TAX_RATE = 0.11;

function priceWithTax(cents) {
  return Math.round(cents * (1 + TAX_RATE));
}

module.exports = { priceWithTax };
