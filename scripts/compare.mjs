import { recoverAuthorizationAddress } from 'viem/utils'
const RPC='https://ethereum.publicnode.com', N=150
const NAMES={'0xe6b97aa1490c93c28a14d86c13c9dc9c950643ed':'Poisoner (CASE A)','0xc43b6c6a43e5760a756a67756b2155c7fa735310':'Anon sweeper (CASE B)','0xd2e28229f6f2c235e57de2ebc727025a1d0530fb':'Biz (Ambire)','0x69007702764179f14f51cdce752f4f775d74e139':'SemiModularAccount (Alchemy)','0x000000005c84f8fd50b21cac312528a64437030e':'CaliburEntry (Uniswap)'}
async function rpc(m,p){const r=await fetch(RPC,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:m,params:p})});return (await r.json()).result}
async function batch(reqs){const r=await fetch(RPC,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(reqs.map((x,i)=>({jsonrpc:'2.0',id:i,...x})))});return r.json()}

const latest=parseInt(await rpc('eth_blockNumber',[]),16)
const byContract={}
for(let s=latest-N;s<latest;s+=10){
  const nums=[];for(let b=s;b<Math.min(s+10,latest);b++)nums.push(b)
  const resp=await batch(nums.map(bn=>({method:'eth_getBlockByNumber',params:[`0x${bn.toString(16)}`,true]})))
  for(const r of resp){const blk=r.result;if(!blk?.transactions)continue
    for(const tx of blk.transactions.filter(t=>t.type==='0x4'))
      for(const a of (tx.authorizationList??[])){
        const d=a.address?.toLowerCase();if(!d)continue
        ;(byContract[d]??={auths:0,relayers:new Set(),tuples:[]})
        byContract[d].auths++;byContract[d].relayers.add(tx.from.toLowerCase())
        if(byContract[d].tuples.length<400)byContract[d].tuples.push(a)
      }}
  await new Promise(r=>setTimeout(r,80))
}

const rows=[]
for(const [addr,d] of Object.entries(byContract).sort((a,b)=>b[1].auths-a[1].auths).slice(0,8)){
  const auths=new Set(),nonces=[]
  for(const a of d.tuples){
    try{const who=await recoverAuthorizationAddress({authorization:{address:a.address,chainId:Number(BigInt(a.chainId)),nonce:Number(BigInt(a.nonce)),r:a.r,s:a.s,yParity:Number(BigInt(a.yParity))}})
      auths.add(who.toLowerCase());nonces.push(Number(BigInt(a.nonce)))}catch{}
  }
  const samp=[...auths].slice(0,10)
  let funded=0,avg=0
  if(samp.length){const bal=await batch(samp.map(a=>({method:'eth_getBalance',params:[a,'latest']})))
    const v=bal.map(b=>Number(BigInt(b.result??'0x0'))/1e18);funded=v.filter(x=>x>0.0001).length;avg=v.reduce((x,y)=>x+y,0)/v.length}
  nonces.sort((a,b)=>a-b)
  rows.push({name:NAMES[addr]??addr.slice(0,10)+'…',auths:d.auths,uniq:auths.size,relayers:d.relayers.size,
    medNonce:nonces[Math.floor(nonces.length/2)]??0,funded:`${funded}/${samp.length}`,avgEth:avg.toFixed(5)})
}
console.log(`\nscanned ${N} blocks up to ${latest}\n`)
console.log('contract'.padEnd(30),'auths'.padStart(6),'uniq'.padStart(6),'relay'.padStart(6),'medNon'.padStart(7),'funded'.padStart(8),'avgETH'.padStart(10))
console.log('-'.repeat(80))
for(const r of rows)console.log(r.name.padEnd(30),String(r.auths).padStart(6),String(r.uniq).padStart(6),String(r.relayers).padStart(6),String(r.medNonce).padStart(7),r.funded.padStart(8),r.avgEth.padStart(10))
