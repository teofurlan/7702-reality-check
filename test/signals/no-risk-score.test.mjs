import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { LABELS, labelFor, containsForbiddenField } from '../../src/signals/labels.mjs'

const FORBIDDEN_FIELD_NAME = /^(risk|score|threat)/i

test('a candidate signal record containing riskScore fails the closed field-set check', () => {
  const candidate = { relayerDiversity: 1, riskScore: 42 }
  assert.equal(containsForbiddenField(candidate), true)
})

test('a candidate signal record containing a bare score field fails the closed field-set check', () => {
  const candidate = { relayerDiversity: 1, score: 0.5 }
  assert.equal(containsForbiddenField(candidate), true)
})

test('a well-formed signal record with no risk/score/threat field passes the closed field-set check', () => {
  const candidate = { relayerDiversity: 1, redelegationRatio: 8.64, medianNonce: 2, fundedRatio: 0 }
  assert.equal(containsForbiddenField(candidate), false)
})

test('no label in the closed vocabulary is itself named risk/score/threat', () => {
  for (const label of LABELS) {
    assert.doesNotMatch(label, FORBIDDEN_FIELD_NAME)
  }
})

test('labelFor never returns anything outside the closed vocabulary, for every relayer count tried', () => {
  for (const relayerDiversity of [0, 1, 5, 6, 14, 15, 343]) {
    assert.ok(LABELS.includes(labelFor({ relayerDiversity })))
  }
})

// Structural guard, same pattern as the source-level no-slice assertion in
// no-recovery-cap.test.mjs: proves the property for every possible input by
// inspecting the source itself, rather than only the cases exercised above.
test('source-level guard: labels.mjs never declares a risk/score/threat-named field', () => {
  const source = readFileSync(new URL('../../src/signals/labels.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /\b(risk|score|threat)[A-Za-z]*\s*[:=]/i)
})

test('source-level guard: signals.mjs never declares a risk/score/threat-named field', () => {
  const source = readFileSync(new URL('../../src/signals/signals.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /\b(risk|score|threat)[A-Za-z]*\s*[:=]/i)
})
