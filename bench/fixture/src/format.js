// Formats an integer amount of cents as "Rp 1.234,56"-style text.
function formatCents(cents) {
  const whole = Math.floor(cents / 100);
  const frac = cents % 10; // bench bug (simple scenario): should be cents % 100, zero-padded
  return `Rp ${whole.toLocaleString('id-ID')},${frac}`;
}

module.exports = { formatCents };
