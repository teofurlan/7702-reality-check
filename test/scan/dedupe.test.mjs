import { test } from 'node:test'
import assert from 'node:assert/strict'
import { unionAuthorities } from '../../src/scan/dedupe.mjs'

test('unionAuthorities dedupes one contract\'s 5 tuples from 3 distinct authorities down to 3', () => {
  const record = {
    delegate: '0xcontract1',
    authorizations: 5,
    distinctAuthorities: 3,
    relayers: new Set(['0xrelayer1']),
    nonces: [0, 1, 2, 3, 4],
    authorities: new Set(['0xauthoritya', '0xauthorityb', '0xauthorityc']),
  }

  assert.equal(unionAuthorities([record]).size, 3)
})

test('unionAuthorities combines distinct authority sets across multiple non-overlapping contracts', () => {
  const recordOne = {
    delegate: '0xcontract1',
    authorizations: 2,
    distinctAuthorities: 2,
    relayers: new Set(),
    nonces: [0, 1],
    authorities: new Set(['0xauthoritya', '0xauthorityb']),
  }
  const recordTwo = {
    delegate: '0xcontract2',
    authorizations: 1,
    distinctAuthorities: 1,
    relayers: new Set(),
    nonces: [0],
    authorities: new Set(['0xauthorityc']),
  }

  const union = unionAuthorities([recordOne, recordTwo])

  assert.equal(union.size, 3)
  assert.deepEqual([...union].sort(), ['0xauthoritya', '0xauthorityb', '0xauthorityc'])
})
