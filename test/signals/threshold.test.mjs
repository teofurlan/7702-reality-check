import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MIN_AUTHORIZATIONS, isClassifiable } from '../../src/signals/threshold.mjs'

test('MIN_AUTHORIZATIONS is fixed at 100 authorizations', () => {
  assert.equal(MIN_AUTHORIZATIONS, 100)
})

test('a contract below the threshold (43 authorizations) is reported as insufficient volume', () => {
  const record = { authorizations: 43 }
  const label = isClassifiable(record) ? 'classifiable' : 'insufficient-volume'
  assert.equal(label, 'insufficient-volume')
})

test('a contract at exactly the threshold (100 authorizations) is classifiable', () => {
  const record = { authorizations: 100 }
  const label = isClassifiable(record) ? 'classifiable' : 'insufficient-volume'
  assert.notEqual(label, 'insufficient-volume')
})

test('a contract just below the threshold (99 authorizations) is not classifiable', () => {
  assert.equal(isClassifiable({ authorizations: 99 }), false)
})
