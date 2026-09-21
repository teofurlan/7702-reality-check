import { useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, ExternalLink, Copy, Check } from 'lucide-react';
import { classifiedContracts, volumeSharePct } from '../../src/artifact/ui-aggregates.mjs';
import { MIN_AUTHORIZATIONS } from '../../src/signals/threshold.mjs';

interface Contract {
  addr: string;
  auths: number;
  unique: number;
  relayers: number;
  redelegation: number;
  medNonce: number;
  funded: number | null;
  sampled: number;
  totalEth: number;
  label: string;
}

interface ContractsTableProps {
  data: { contracts: Contract[]; totalAuths: number };
}

type FilterTab = 'all' | 'single-operator' | 'organic' | 'insufficient';

// Display-only mapping from the pipeline's own label vocabulary
// (single source of truth: src/signals/threshold.mjs + labels.mjs) to a
// badge string and CSS classes. This function decides NO thresholds — it
// only decorates a label the artifact already carries. The previous version
// re-derived `< 100`, `<= 5`, `>= 15` here and invented a `'mixed'` token
// that didn't match the pipeline's actual `'mixed-relayers'` label; both
// were a second place classification could silently drift from the
// pipeline's real behavior.
const STATUS_BY_LABEL: Record<string, { label: string; badgeClass: string; isClassified: boolean }> = {
  'insufficient-volume': {
    label: 'Insufficient volume',
    badgeClass: 'bg-surface-3 text-ink-subtle border-hairline',
    isClassified: false,
  },
  'single-operator': {
    label: 'Single-operator',
    badgeClass: 'bg-red-950/40 text-red-400 border-red-800/40',
    isClassified: true,
  },
  organic: {
    label: 'Organic',
    badgeClass: 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40',
    isClassified: true,
  },
  'mixed-relayers': {
    label: 'Mixed-relayers',
    badgeClass: 'bg-amber-950/40 text-amber-400 border-amber-800/40',
    isClassified: true,
  },
};

function getContractStatus(c: Contract) {
  return (
    STATUS_BY_LABEL[c.label] ?? {
      label: c.label,
      badgeClass: 'bg-surface-3 text-ink-subtle border-hairline',
      isClassified: false,
    }
  );
}

export function ContractsTable({ data }: ContractsTableProps) {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);

  const copyToClipboard = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddr(addr);
    setTimeout(() => setCopiedAddr(null), 2000);
  };

  // Sort by authorizations descending by default
  const sorted = useMemo(() => {
    return [...data.contracts].sort((a, b) => b.auths - a.auths);
  }, [data.contracts]);

  const classifiedVolumePct = useMemo(
    () => volumeSharePct(classifiedContracts(sorted), data.totalAuths),
    [sorted, data.totalAuths],
  );

  // Counts for tabs — driven entirely by `label`, never by re-checking
  // authorizations/relayer counts against a threshold.
  const tabCounts = useMemo(() => {
    let singleOp = 0;
    let organic = 0;
    let insufficient = 0;

    for (const c of sorted) {
      if (c.label === 'insufficient-volume') {
        insufficient++;
        continue;
      }
      if (c.label === 'single-operator') singleOp++;
      else if (c.label === 'organic') organic++;
    }

    return {
      all: sorted.length,
      'single-operator': singleOp,
      organic,
      insufficient,
    };
  }, [sorted]);

  // Filtered contracts based on search & tab
  const filtered = useMemo(() => {
    return sorted.filter((c) => {
      const matchesSearch = c.addr.toLowerCase().includes(search.trim().toLowerCase());
      if (!matchesSearch) return false;

      if (activeTab === 'all') return true;
      if (activeTab === 'single-operator') return c.label === 'single-operator';
      if (activeTab === 'organic') return c.label === 'organic';
      if (activeTab === 'insufficient') return c.label === 'insufficient-volume';
      return true;
    });
  }, [sorted, search, activeTab]);

  // Reset page when filter changes
  const handleTabChange = (tab: FilterTab) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  // Pagination calculation
  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const pageItems = filtered.slice(startIndex, startIndex + pageSize);

  return (
    <section className="px-6 py-20 max-w-6xl mx-auto" id="contracts">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-3xl font-semibold text-ink tracking-tight" style={{ letterSpacing: '-0.02em' }}>
              Delegate Contracts Directory
            </h2>
          </div>
          <p className="text-ink-subtle max-w-2xl text-sm leading-relaxed">
            Contracts with <span className="text-ink font-medium">≥{MIN_AUTHORIZATIONS} authorizations</span> represent{' '}
            <span className="text-primary-text font-mono font-medium">
              {classifiedVolumePct !== null ? `${classifiedVolumePct.toFixed(2)}%` : 'n/a'}
            </span>{' '}
            of all volume and are classified by behavioural signature. Remaining contracts are declared as insufficient volume.
          </p>
        </div>

        {/* Search input */}
        <div className="relative min-w-[280px]">
          <Search className="w-4 h-4 text-ink-subtle absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search address (0x...)"
            aria-label="Search contract address"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full bg-surface-1 border border-hairline focus:border-primary rounded-md pl-9 pr-3 py-2 text-xs font-mono text-ink placeholder:text-ink-tertiary focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Tabs as Linear Segmented Control */}
      <div className="flex items-center gap-1.5 p-1 rounded-lg bg-surface-2/80 border border-hairline overflow-x-auto mb-6 scrollbar-none">
        <button
          onClick={() => handleTabChange('single-operator')}
          className={`px-3 py-1.5 text-xs font-mono transition-all rounded-md flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'single-operator'
              ? 'bg-red-950/40 text-red-300 font-semibold border border-red-800/40 shadow-sm'
              : 'text-ink-subtle hover:text-ink hover:bg-surface-3/50'
          }`}
        >
          Single-Operator
          <span className="px-1.5 py-0.5 rounded-full text-xs bg-red-950/60 text-red-400 border border-red-900/30">
            {tabCounts['single-operator']}
          </span>
        </button>

        <button
          onClick={() => handleTabChange('organic')}
          className={`px-3 py-1.5 text-xs font-mono transition-all rounded-md flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'organic'
              ? 'bg-emerald-950/40 text-emerald-300 font-semibold border border-emerald-800/40 shadow-sm'
              : 'text-ink-subtle hover:text-ink hover:bg-surface-3/50'
          }`}
        >
          Organic
          <span className="px-1.5 py-0.5 rounded-full text-xs bg-emerald-950/60 text-emerald-400 border border-emerald-900/30">
            {tabCounts.organic}
          </span>
        </button>

        <button
          onClick={() => handleTabChange('insufficient')}
          className={`px-3 py-1.5 text-xs font-mono transition-all rounded-md flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'insufficient'
              ? 'bg-surface-3 text-ink font-semibold shadow-sm'
              : 'text-ink-subtle hover:text-ink hover:bg-surface-3/50'
          }`}
        >
          Insufficient Volume (&lt;{MIN_AUTHORIZATIONS})
          <span className="px-1.5 py-0.5 rounded-full text-xs bg-surface-1 text-ink-tertiary">
            {tabCounts.insufficient}
          </span>
        </button>

        <button
          onClick={() => handleTabChange('all')}
          className={`px-3 py-1.5 text-xs font-mono transition-all rounded-md flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'all'
              ? 'bg-surface-3 text-ink font-semibold shadow-sm'
              : 'text-ink-subtle hover:text-ink hover:bg-surface-3/50'
          }`}
        >
          All Observed
          <span className="px-1.5 py-0.5 rounded-full text-xs bg-surface-1 text-ink-tertiary">
            {tabCounts.all}
          </span>
        </button>
      </div>

      {/* Table container */}
      <div className="overflow-x-auto border border-hairline rounded-lg bg-surface-1/30 shadow-2xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-1 text-ink-subtle font-mono text-xs uppercase tracking-wider border-b border-hairline">
              <th className="text-left px-4 py-3.5 font-medium">Contract</th>
              <th className="text-left px-3 py-3.5 font-medium">Classification</th>
              <th className="text-right px-3 py-3.5 font-medium">Auths</th>
              <th className="text-right px-3 py-3.5 font-medium">Unique</th>
              <th className="text-right px-3 py-3.5 font-medium">Relayers</th>
              <th className="text-right px-3 py-3.5 font-medium">Ratio</th>
              <th className="text-right px-3 py-3.5 font-medium">Med. Nonce</th>
              <th className="text-right px-3 py-3.5 font-medium">Funded</th>
              <th className="text-right px-4 py-3.5 font-medium">ETH Sampled</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline font-mono text-xs">
            {pageItems.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-ink-subtle">
                  No contracts match the selected filter.
                </td>
              </tr>
            ) : (
              pageItems.map((c) => {
                const status = getContractStatus(c);
                const isCopied = copiedAddr === c.addr;

                return (
                  <tr key={c.addr} className="hover:bg-surface-1/80 transition-colors group">
                    <td className="px-4 py-3 text-ink-muted">
                      <div className="flex items-center gap-2">
                        <span className="text-ink font-semibold tracking-wide">
                          {c.addr.slice(0, 8)}...{c.addr.slice(-6)}
                        </span>
                        <button
                          onClick={() => copyToClipboard(c.addr)}
                          title="Copy address"
                          aria-label="Copy address"
                          className="text-ink-tertiary hover:text-ink opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <a
                          href={`https://etherscan.io/address/${c.addr}`}
                          target="_blank"
                          rel="noreferrer"
                          title="View on Etherscan"
                          aria-label="View on Etherscan"
                          className="text-ink-tertiary hover:text-primary-text opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </td>

                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border ${status.badgeClass}`}>
                        {status.label}
                      </span>
                    </td>

                    <td className="px-3 py-3 text-right text-ink font-medium tabular-nums">
                      {c.auths.toLocaleString()}
                    </td>

                    <td className="px-3 py-3 text-right text-ink-muted tabular-nums">
                      {c.unique.toLocaleString()}
                    </td>

                    <td className="px-3 py-3 text-right text-ink tabular-nums">
                      <span className={c.label === 'single-operator' ? 'text-red-400 font-medium' : c.label === 'organic' ? 'text-emerald-400 font-medium' : 'text-ink'}>
                        {c.relayers}
                      </span>
                    </td>

                    <td className="px-3 py-3 text-right tabular-nums">
                      <span className={c.redelegation > 2.0 ? 'text-amber-400 font-medium' : 'text-ink-muted'}>
                        {c.redelegation.toFixed(2)}×
                      </span>
                    </td>

                    <td className="px-3 py-3 text-right text-ink-muted tabular-nums">
                      {c.medNonce.toLocaleString()}
                    </td>

                    <td className="px-3 py-3 text-right tabular-nums">
                      {c.funded !== null ? (
                        <>
                          <span className={c.funded > 20 ? 'text-emerald-400 font-medium' : 'text-ink-subtle'}>
                            {c.funded}
                          </span>
                          <span className="text-ink-tertiary">/{c.sampled}</span>
                        </>
                      ) : (
                        <span className="text-ink-tertiary">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className={c.totalEth > 0.1 ? 'text-emerald-300 font-medium' : 'text-ink-tertiary'}>
                        {c.totalEth.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 px-2 text-xs font-mono text-ink-subtle">
        <div className="flex items-center gap-2">
          <label htmlFor="contracts-page-size">Rows per page:</label>
          <select
            id="contracts-page-size"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="bg-surface-1 border border-hairline text-ink rounded px-2 py-1 text-xs focus:outline-none focus:border-primary"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
          <span className="text-ink-tertiary ml-2">
            Showing {totalItems > 0 ? startIndex + 1 : 0}–{Math.min(startIndex + pageSize, totalItems)} of {totalItems} contracts
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={validCurrentPage <= 1}
            aria-label="Previous page"
            className="px-2 py-1 bg-surface-1 border border-hairline rounded hover:bg-surface-2 disabled:opacity-40 disabled:hover:bg-surface-1 text-ink transition-colors flex items-center"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="px-2 text-ink">
            Page {validCurrentPage} of {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={validCurrentPage >= totalPages}
            aria-label="Next page"
            className="px-2 py-1 bg-surface-1 border border-hairline rounded hover:bg-surface-2 disabled:opacity-40 disabled:hover:bg-surface-1 text-ink transition-colors flex items-center"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
