import { test } from 'node:test'
import assert from 'node:assert/strict'
import { signAuthorization } from 'viem/accounts'
import { createFixtureRpc } from '../../src/scan/rpc-fixture.mjs'
import { scanRange } from '../../src/scan/scan.mjs'

const CONTRACT = '0x8888888888888888888888888888888888888888'
const RELAYER = '0xffffffffffffffffffffffffffffffffffffffff'

function toHex(n) {
  return `0x${n.toString(16)}`
}

async function validTuple(index) {
  const privateKey = `0x${(1000 + index).toString(16).padStart(64, '0')}`
  const signed = await signAuthorization({ contractAddress: CONTRACT, chainId: 1, nonce: index, privateKey })
  return {
    address: signed.address,
    chainId: toHex(signed.chainId),
    nonce: toHex(signed.nonce),
    r: signed.r,
    s: signed.s,
    yParity: toHex(signed.yParity),
  }
}

function corruptTuple(index) {
  // r/s of "0x00" are outside secp256k1's valid signature range, so recovery
  // deterministically throws for these two tuples.
  return {
    address: CONTRACT,
    chainId: '0x1',
    nonce: toHex(index),
    r: '0x00',
    s: '0x00',
    yParity: '0x0',
  }
}

test('scanRange counts recovery failures without discarding them, and keeps the successes (2 of 10 fail)', async () => {
  const validTuples = await Promise.all([0, 1, 2, 3, 4, 5, 6, 7].map(validTuple))
  const tuples = [...validTuples, corruptTuple(8), corruptTuple(9)]

  const block = {
    number: '0x1',
    transactions: tuples.map((tuple) => ({
      type: '0x4',
      from: RELAYER,
      authorizationList: [tuple],
    })),
  }

  const rpc = createFixtureRpc({
    'eth_getBlockByNumber|["0x1",true]': block,
  })

  const result = await scanRange({ rpc, fromBlock: 1, toBlock: 1 })

  assert.equal(result.recoveryFailureCount, 2)
  const contractRecord = result.records.find((record) => record.delegate === CONTRACT.toLowerCase())
  assert.ok(contractRecord)
  assert.equal(contractRecord.distinctAuthorities, 8)
  assert.equal(contractRecord.authorities.size, 8)
})
