// Hand-written `ContractRecord[]` literals — never captured chain data and
// never produced through `recoverAuthorizationAddress`. The overlap under
// test (one authority delegating to two distinct contracts) is guaranteed by
// construction here, at the `unionAuthorities`/`ContractRecord`-literal seam,
// per the task's explicit instruction not to fabricate plausible-looking
// signed tuples for this case.
//
// `0xauthorityb` appears in BOTH records' `authorities` sets: it delegated to
// `0xcontract1` and to `0xcontract2`. A sum-based (non-union) global count
// would silently double-count it; `unionAuthorities` must not.
export const overlapRecords = [
  {
    delegate: '0xcontract1',
    authorizations: 4,
    distinctAuthorities: 2,
    relayers: new Set(['0xrelayer1']),
    nonces: [0, 1, 2, 3],
    authorities: new Set(['0xauthoritya', '0xauthorityb']),
  },
  {
    delegate: '0xcontract2',
    authorizations: 3,
    distinctAuthorities: 2,
    relayers: new Set(['0xrelayer2']),
    nonces: [0, 1, 2],
    authorities: new Set(['0xauthorityb', '0xauthorityc']),
  },
]
