interface Props {
  totalItems: number
  itemsPerPage: number
  currentPage: number
  onPageChange: (page: number) => void
}

export function TablePagination({ totalItems, itemsPerPage, currentPage, onPageChange }: Props) {
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  if (totalPages <= 1) return null

  const start = (currentPage - 1) * itemsPerPage + 1
  const end = Math.min(currentPage * itemsPerPage, totalItems)

  // Genera los números de página visibles con "..." cuando hay muchas
  const pages: (number | '...')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (currentPage > 3) pages.push('...')
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pages.push(i)
    }
    if (currentPage < totalPages - 2) pages.push('...')
    pages.push(totalPages)
  }

  const btn = (label: React.ReactNode, page: number, disabled: boolean, active = false) => (
    <button
      key={String(label) + page}
      type="button"
      onClick={() => !disabled && onPageChange(page)}
      disabled={disabled}
      className={`inline-flex h-7 min-w-[28px] items-center justify-center rounded px-2 text-xs font-semibold transition-colors
        ${active
          ? 'bg-blue-800 text-white shadow-sm'
          : disabled
            ? 'cursor-not-allowed text-slate-300'
            : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
        }`}
    >
      {label}
    </button>
  )

  return (
    <div className="flex items-center justify-between gap-4 px-1 py-2">
      <p className="text-xs text-slate-400 whitespace-nowrap">
        Mostrando <span className="font-semibold text-slate-600">{start}–{end}</span> de <span className="font-semibold text-slate-600">{totalItems}</span>
      </p>
      <div className="flex items-center gap-1 flex-wrap">
        {btn(
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>,
          currentPage - 1,
          currentPage === 1,
        )}
        {pages.map((p, i) =>
          p === '...'
            ? <span key={`dots-${i}`} className="px-1 text-xs text-slate-400">…</span>
            : btn(p, p, false, p === currentPage),
        )}
        {btn(
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>,
          currentPage + 1,
          currentPage === totalPages,
        )}
      </div>
    </div>
  )
}
