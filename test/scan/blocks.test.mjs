import { test } from 'node:test'
import assert from 'node:assert/strict'
import { blockNumbersInRange, chunk } from '../../src/scan/blocks.mjs'

test('blockNumbersInRange returns every block number from fromBlock to toBlock, step 1', () => {
  assert.deepEqual(blockNumbersInRange(10, 15), [10, 11, 12, 13, 14, 15])
})

test('blockNumbersInRange handles a single-block range', () => {
  assert.deepEqual(blockNumbersInRange(5, 5), [5])
})

test('blockNumbersInRange accepts no stride argument beyond fromBlock/toBlock', () => {
  assert.equal(blockNumbersInRange.length, 2)
})

test('chunk splits an array into fixed-size groups, with a shorter final group', () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]])
})

test('chunk returns one group when size is larger than the input length', () => {
  assert.deepEqual(chunk([1, 2], 10), [[1, 2]])
})

test('chunk rejects a non-positive size instead of looping forever', () => {
  assert.throws(() => chunk([1, 2, 3], 0), RangeError)
  assert.throws(() => chunk([1, 2, 3], -1), RangeError)
})

test('chunk rejects a non-integer size', () => {
  assert.throws(() => chunk([1, 2, 3], 1.5), RangeError)
})
