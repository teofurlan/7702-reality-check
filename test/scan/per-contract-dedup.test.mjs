import { test } from 'node:test'
import assert from 'node:assert/strict'
import { unionAuthorities } from '../../src/scan/dedupe.mjs'

test('a contract receiving 5 tuples from 3 distinct authorities (one delegating 3 times) has a per-contract unique-authority count of 3', () => {
  const record = {
    delegate: '0xcontract1',
    authorizations: 5,
    distinctAuthorities: 3,
    relayers: new Set(['0xrelayer1']),
    nonces: [0, 1, 2, 3, 4],
    // The repeated delegator contributes 3 authorizations from the same authority;
    // Set literal semantics already dedupe that repetition down to one entry.
    authorities: new Set([
      '0xauthoritya',
      '0xauthoritya',
      '0xauthoritya',
      '0xauthorityb',
      '0xauthorityc',
    ]),
  }

  assert.equal(record.authorities.size, 3)
  assert.equal(unionAuthorities([record]).size, 3)
})
