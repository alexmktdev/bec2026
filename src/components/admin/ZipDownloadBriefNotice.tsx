import { useEffect, useState } from 'react'

type Props = { tick: number }

/**
 * Cartel fijo ~2 s al disparar una descarga ZIP masiva o individual.
 * `pointer-events-none` para no interceptar clics; la descarga sigue en segundo plano.
 */
export function ZipDownloadBriefNotice({ tick }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (tick === 0) return
    setVisible(true)
    const hide = window.setTimeout(() => setVisible(false), 2000)
    return () => clearTimeout(hide)
  }, [tick])

  if (!visible) return null

  return (
    <div
      className="pointer-events-none fixed bottom-6 left-1/2 z-[200] max-w-md -translate-x-1/2 px-4"
      role="status"
      aria-live="polite"
    >
      <div className="rounded-lg border border-blue-200 bg-white px-4 py-3 text-center text-sm font-medium text-slate-800 shadow-lg">
        La descarga se hará en breve.
      </div>
    </div>
  )
}
