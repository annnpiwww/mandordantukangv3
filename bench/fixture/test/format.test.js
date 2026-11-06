const test = require('node:test');
const assert = require('node:assert');
const { formatCents } = require('../src/format');

test('formats whole amounts', () => assert.strictEqual(formatCents(123400), 'Rp 1.234,00'));
test('formats fractional amounts', () => assert.strictEqual(formatCents(123456), 'Rp 1.234,56'));
