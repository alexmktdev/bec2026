import { useEffect, useRef, useState } from 'react'

interface Props {
  scrollRef: React.RefObject<HTMLDivElement | null>
}

/**
 * Slider de desplazamiento horizontal sincronizado con la tabla.
 * Se actualiza cuando el usuario arrastra la tabla y viceversa.
 */
export function TableScrollSlider({ scrollRef }: Props) {
  const [value, setValue] = useState(0)
  const [maxScroll, setMaxScroll] = useState(1)
  const isDragging = useRef(false)

  // Actualiza el max y sincroniza el slider al hacer scroll en la tabla
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const updateMax = () => {
      const max = el.scrollWidth - el.clientWidth
      setMaxScroll(max > 0 ? max : 1)
    }

    const handleScroll = () => {
      if (!isDragging.current) {
        setValue(el.scrollLeft)
      }
      updateMax()
    }

    updateMax()
    el.addEventListener('scroll', handleScroll, { passive: true })

    const ro = new ResizeObserver(updateMax)
    ro.observe(el)

    return () => {
      el.removeEventListener('scroll', handleScroll)
      ro.disconnect()
    }
  }, [scrollRef])

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value)
    setValue(v)
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = v
    }
  }

  if (maxScroll <= 1) return null

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-t border-slate-100 bg-slate-50/60">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      <input
        type="range"
        min={0}
        max={maxScroll}
        value={value}
        onChange={handleSliderChange}
        onMouseDown={() => { isDragging.current = true }}
        onMouseUp={() => { isDragging.current = false }}
        onTouchStart={() => { isDragging.current = true }}
        onTouchEnd={() => { isDragging.current = false }}
        className="flex-1 h-1.5 appearance-none rounded-full cursor-pointer
          [&::-webkit-slider-runnable-track]:rounded-full
          [&::-webkit-slider-runnable-track]:bg-slate-200
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:w-4
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-blue-600
          [&::-webkit-slider-thumb]:shadow-sm
          [&::-webkit-slider-thumb]:cursor-grab
          [&::-webkit-slider-thumb]:active:cursor-grabbing
          [&::-webkit-slider-thumb]:border-2
          [&::-webkit-slider-thumb]:border-white
          [&::-moz-range-track]:rounded-full
          [&::-moz-range-track]:bg-slate-200
          [&::-moz-range-thumb]:h-4
          [&::-moz-range-thumb]:w-4
          [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:bg-blue-600
          [&::-moz-range-thumb]:border-2
          [&::-moz-range-thumb]:border-white
          [&::-moz-range-thumb]:cursor-grab"
        style={{
          background: `linear-gradient(to right, #2563eb ${(value / maxScroll) * 100}%, #e2e8f0 ${(value / maxScroll) * 100}%)`,
        }}
        aria-label="Desplazamiento horizontal de la tabla"
      />
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </div>
  )
}
