const test = require('node:test');
const assert = require('node:assert');
const { cartTotal } = require('../src/cart');
const { priceWithTax } = require('../src/price');

test('cart total includes tax', () => assert.strictEqual(cartTotal([{ cents: 1000, qty: 2 }]), 2220));
test('price includes tax', () => assert.strictEqual(priceWithTax(1000), 1110));
