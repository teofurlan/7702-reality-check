export function Footer() {
  return (
    <footer className="border-t border-hairline px-6 py-12">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-ink-subtle text-sm">
          7702 Reality Check — Built for{' '}
          <a href="https://3rd-web-hack.devpost.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary-hover transition-colors">
            3rd-Web-Hack
          </a>
        </div>
        <div className="text-ink-tertiary text-xs font-mono">
          Public RPC only · No API key · No backend · Fully reproducible
        </div>
      </div>
    </footer>
  );
}
