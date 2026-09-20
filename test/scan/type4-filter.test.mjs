import { test } from 'node:test'
import assert from 'node:assert/strict'
import { type4Transactions, authorizationsOf } from '../../src/scan/filter.mjs'

test('type4Transactions returns only the type-4 transactions from a block', () => {
  const block = {
    transactions: [
      { type: '0x4', from: '0xaaa', authorizationList: [] },
      { type: '0x2', from: '0xbbb' },
      { type: '0x4', from: '0xccc', authorizationList: [] },
      { type: '0x2', from: '0xddd' },
      { type: '0x4', from: '0xeee', authorizationList: [] },
    ],
  }

  assert.equal(type4Transactions(block).length, 3)
})

test('type4Transactions never depends on tx.from being present', () => {
  const block = {
    transactions: [{ type: '0x4', authorizationList: [] }],
  }

  assert.equal(type4Transactions(block).length, 1)
})

test('authorizationsOf returns a transaction\'s authorizationList tuples unchanged', () => {
  const tuple = { address: '0xdelegate', chainId: 1, nonce: 0, r: '0x1', s: '0x2', yParity: 0 }
  const tx = { type: '0x4', from: '0xrelayer', authorizationList: [tuple] }

  assert.deepEqual(authorizationsOf(tx), [tuple])
})

test('authorizationsOf returns an empty array when authorizationList is absent', () => {
  assert.deepEqual(authorizationsOf({ type: '0x4', from: '0xrelayer' }), [])
})
