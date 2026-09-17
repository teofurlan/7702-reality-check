import { recoverAuthorizationAddress } from 'viem/utils'

const RPC = 'https://ethereum.publicnode.com'
const POISONER = '0xe6b97aa1490c93c28a14d86c13c9dc9c950643ed'
const N_BLOCKS = 150

async function rpc(method, params) {
  const r = await fetch(RPC, { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ jsonrpc:'2.0', id:1, method, params }) })
  const j = await r.json()
  if (j.error) throw new Error(j.error.message)
  return j.result
}
async function batch(reqs) {
  const r = await fetch(RPC, { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify(reqs.map((x,i)=>({ jsonrpc:'2.0', id:i, ...x }))) })
  return r.json()
}

const latest = parseInt(await rpc('eth_blockNumber', []), 16)
console.log(`latest block: ${latest}, scanning back ${N_BLOCKS}\n`)

const found = []   // { authority, nonce, txHash, relayer }
for (let start = latest - N_BLOCKS; start < latest; start += 10) {
  const nums = []
  for (let b = start; b < Math.min(start+10, latest); b++) nums.push(b)
  const resp = await batch(nums.map(bn => ({ method:'eth_getBlockByNumber', params:[`0x${bn.toString(16)}`, true] })))
  for (const r of resp) {
    const blk = r.result
    if (!blk?.transactions) continue
    for (const tx of blk.transactions.filter(t => t.type === '0x4')) {
      for (const a of (tx.authorizationList ?? [])) {
        if (a.address?.toLowerCase() !== POISONER) continue
        try {
          const authority = await recoverAuthorizationAddress({
            authorization: {
              address: a.address,
              chainId: Number(BigInt(a.chainId)),
              nonce:   Number(BigInt(a.nonce)),
              r: a.r, s: a.s, yParity: Number(BigInt(a.yParity)),
            }
          })
          found.push({ authority: authority.toLowerCase(), nonce: Number(BigInt(a.nonce)), txHash: tx.hash, relayer: tx.from.toLowerCase() })
        } catch (e) { console.log('  recover failed:', e.message.split('\n')[0]) }
      }
    }
  }
  await new Promise(r => setTimeout(r, 80))
}

const uniq = [...new Set(found.map(f => f.authority))]
console.log(`Poisoner authorizations found : ${found.length}`)
console.log(`UNIQUE recovered authorities  : ${uniq.length}`)
console.log(`unique relayers (tx.from)     : ${new Set(found.map(f=>f.relayer)).size}`)
console.log(`\n--- first 15 recovered authorities (nonce) ---`)
found.slice(0,15).forEach(f => console.log(`  ${f.authority}  nonce=${f.nonce}`))

// vanity / lookalike analysis
console.log(`\n--- prefix/suffix clustering (first 6 + last 6 hex chars) ---`)
const pre = {}, suf = {}
for (const a of uniq) { const h=a.slice(2); pre[h.slice(0,6)]=(pre[h.slice(0,6)]||0)+1; suf[h.slice(-6)]=(suf[h.slice(-6)]||0)+1 }
const topPre = Object.entries(pre).sort((a,b)=>b[1]-a[1]).slice(0,5)
const topSuf = Object.entries(suf).sort((a,b)=>b[1]-a[1]).slice(0,5)
console.log('  top prefixes:', JSON.stringify(topPre))
console.log('  top suffixes:', JSON.stringify(topSuf))

// balances + current delegation of a sample
const sample = uniq.slice(0, 12)
const bal = await batch(sample.map(a => ({ method:'eth_getBalance', params:[a,'latest'] })))
const code = await batch(sample.map(a => ({ method:'eth_getCode',    params:[a,'latest'] })))
console.log(`\n--- sample: balance + current delegation pointer ---`)
sample.forEach((a,i) => {
  const wei = BigInt(bal[i].result ?? '0x0')
  const c = code[i].result ?? '0x'
  const delegate = c.startsWith('0xef0100') ? '0x'+c.slice(8) : (c === '0x' ? 'NONE (revoked/never)' : 'other code')
  console.log(`  ${a}  ${(Number(wei)/1e18).toFixed(6)} ETH   -> ${delegate}`)
})
