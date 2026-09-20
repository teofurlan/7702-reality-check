import { test } from 'node:test'
import assert from 'node:assert/strict'
import { signAuthorization, privateKeyToAccount } from 'viem/accounts'
import { recoverAuthorities, RecoveryLimitExceededError } from '../../src/scan/recover.mjs'

// Deterministic throwaway private keys (sequential, never random) so this test
// is reproducible without depending on machine entropy. None of these keys hold
// real funds.
function throwawayPrivateKey(index) {
  return `0x${index.toString(16).padStart(64, '0')}`
}

function toHex(n) {
  return `0x${n.toString(16)}`
}

async function signTuple({ privateKey, contractAddress, nonce, chainId = 1 }) {
  const signed = await signAuthorization({ contractAddress, chainId, nonce, privateKey })
  return {
    address: signed.address,
    chainId: toHex(signed.chainId),
    nonce: toHex(signed.nonce),
    r: signed.r,
    s: signed.s,
    yParity: toHex(signed.yParity),
  }
}

test('recoverAuthorities recovers every hand-written tuple with zero failures on clean input', async () => {
  const keyOne = throwawayPrivateKey(1)
  const keyTwo = throwawayPrivateKey(2)
  const keyThree = throwawayPrivateKey(3)

  const tuples = [
    await signTuple({ privateKey: keyOne, contractAddress: '0x1111111111111111111111111111111111111111', nonce: 0 }),
    await signTuple({ privateKey: keyTwo, contractAddress: '0x1111111111111111111111111111111111111111', nonce: 0 }),
    await signTuple({ privateKey: keyThree, contractAddress: '0x1111111111111111111111111111111111111111', nonce: 5 }),
  ]

  const expectedAuthorities = [
    privateKeyToAccount(keyOne).address.toLowerCase(),
    privateKeyToAccount(keyTwo).address.toLowerCase(),
    privateKeyToAccount(keyThree).address.toLowerCase(),
  ]

  const result = await recoverAuthorities(tuples)

  assert.equal(result.failures, 0)
  assert.deepEqual([...result.authorities].sort(), expectedAuthorities.sort())
  assert.deepEqual(result.nonces, [0, 0, 5])
})

test('recoverAuthorities recovers a recorded tuple against its independently known authority', async () => {
  const privateKey = throwawayPrivateKey(42)
  const tuple = await signTuple({
    privateKey,
    contractAddress: '0x4444444444444444444444444444444444444444',
    nonce: 7,
  })
  const knownAuthority = privateKeyToAccount(privateKey).address.toLowerCase()

  const result = await recoverAuthorities([tuple])

  assert.equal(result.failures, 0)
  assert.ok(result.authorities.has(knownAuthority))
})

test('recoverAuthorities recovers every tuple of a multi-tuple input with no truncation (no default cap)', async () => {
  const privateKey = throwawayPrivateKey(7)
  const tuple = await signTuple({
    privateKey,
    contractAddress: '0x5555555555555555555555555555555555555555',
    nonce: 0,
  })
  // Behavioural proof that nothing is dropped. The count is deliberately small:
  // a run of N tuples only ever proves there is no cap at or below N, and each
  // tuple costs a real ECDSA recovery (~5.7ms). The "no cap at any N" claim is
  // carried by the source-level no-slice assertion in no-recovery-cap.test.mjs,
  // which is both stronger and free. 3,001 here cost ~17s of every test run.
  const tupleCount = 64
  const tuples = Array.from({ length: tupleCount }, () => tuple)

  const result = await recoverAuthorities(tuples)

  assert.equal(result.failures, 0)
  assert.equal(result.nonces.length, tupleCount)
  assert.equal(result.authorities.size, 1)
})

test('recoverAuthorities throws RecoveryLimitExceededError only when maxTuples is explicitly set and exceeded', async () => {
  const privateKey = throwawayPrivateKey(9)
  const tuple = await signTuple({
    privateKey,
    contractAddress: '0x6666666666666666666666666666666666666666',
    nonce: 0,
  })

  await assert.rejects(
    () => recoverAuthorities([tuple, tuple, tuple], { maxTuples: 2 }),
    RecoveryLimitExceededError,
  )
})

test('recoverAuthorities has no default maxTuples, so an unset option never throws for a large input', async () => {
  const privateKey = throwawayPrivateKey(11)
  const tuple = await signTuple({
    privateKey,
    contractAddress: '0x7777777777777777777777777777777777777777',
    nonce: 0,
  })

  const result = await recoverAuthorities(Array.from({ length: 50 }, () => tuple))

  assert.equal(result.failures, 0)
  assert.equal(result.nonces.length, 50)
})
