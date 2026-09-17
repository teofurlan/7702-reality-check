import { recoverAuthorizationAddress } from 'viem/utils'
import { writeFileSync } from 'fs'
const RPC='https://ethereum.publicnode.com', N=3000, BAL_SAMPLE=100, TOP_N=25
async function rpc(m,p){const r=await fetch(RPC,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:m,params:p})});return (await r.json()).result}
async function batch(reqs){for(let t=0;t<3;t++){try{const r=await fetch(RPC,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(reqs.map((x,i)=>({jsonrpc:'2.0',id:i,...x})))});return await r.json()}catch(e){await new Promise(r=>setTimeout(r,1000))}}return []}

const latest=parseInt(await rpc('eth_blockNumber',[]),16)
const from=latest-N
console.error(`scanning ${from}..${latest}`)
const byC={}; let totalAuths=0, totalTx=0
for(let s=from;s<latest;s+=10){
  const nums=[];for(let b=s;b<Math.min(s+10,latest);b++)nums.push(b)
  const resp=await batch(nums.map(bn=>({method:'eth_getBlockByNumber',params:[`0x${bn.toString(16)}`,true]})))
  for(const r of resp){const blk=r?.result;if(!blk?.transactions)continue
    for(const tx of blk.transactions.filter(t=>t.type==='0x4')){totalTx++
      for(const a of (tx.authorizationList??[])){const d=a.address?.toLowerCase();if(!d)continue;totalAuths++
        ;(byC[d]??={auths:0,relayers:new Set(),tuples:[],firstBlock:parseInt(blk.number,16)})
        byC[d].auths++;byC[d].relayers.add(tx.from.toLowerCase());byC[d].tuples.push(a)}}}
  if((s-from)%500<10)console.error(`  ${s-from}/${N} auths=${totalAuths}`)
  await new Promise(r=>setTimeout(r,60))
}
console.error(`scan done: ${totalTx} type4 tx, ${totalAuths} auths, ${Object.keys(byC).length} contracts`)

const out=[]
const sorted=Object.entries(byC).sort((a,b)=>b[1].auths-a[1].auths)
for(const [addr,d] of sorted){
  const auths=new Set(),nonces=[]
  for(const a of d.tuples.slice(0,3000)){
    try{const w=await recoverAuthorizationAddress({authorization:{address:a.address,chainId:Number(BigInt(a.chainId)),nonce:Number(BigInt(a.nonce)),r:a.r,s:a.s,yParity:Number(BigInt(a.yParity))}})
      auths.add(w.toLowerCase());nonces.push(Number(BigInt(a.nonce)))}catch{}
  }
  nonces.sort((x,y)=>x-y)
  const rec={addr,auths:d.auths,unique:auths.size,relayers:d.relayers.size,
    redelegation:+(d.auths/Math.max(auths.size,1)).toFixed(2),
    medNonce:nonces[Math.floor(nonces.length/2)]??0,
    maxNonce:nonces[nonces.length-1]??0, funded:null,sampled:0,totalEth:0}
  if(out.length<TOP_N&&auths.size){
    const samp=[...auths].slice(0,BAL_SAMPLE); let f=0,tot=0
    for(let i=0;i<samp.length;i+=50){
      const chunk=samp.slice(i,i+50)
      const bal=await batch(chunk.map(a=>({method:'eth_getBalance',params:[a,'latest']})))
      for(const b of bal){const v=Number(BigInt(b?.result??'0x0'))/1e18;tot+=v;if(v>0.0001)f++}
    }
    rec.funded=f;rec.sampled=samp.length;rec.totalEth=+tot.toFixed(6)
  }
  out.push(rec)
}
const res={scannedBlocks:N,fromBlock:from,toBlock:latest,totalType4Tx:totalTx,totalAuths,
  uniqueContracts:Object.keys(byC).length,
  globalUnique:out.reduce((s,r)=>s+r.unique,0),
  globalRedelegation:+(totalAuths/Math.max(out.reduce((s,r)=>s+r.unique,0),1)).toFixed(2),
  contracts:out}
writeFileSync('confirm-output.json',JSON.stringify(res,null,1))
console.error('WROTE confirm-output.json')
