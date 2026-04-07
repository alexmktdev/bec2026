/**
 * Aproxima los acentos de color de `RevisionTable` / panel según el título de columna del Excel.
 */
const TH_BASE =
  'px-2 py-2 text-left font-semibold uppercase tracking-tight whitespace-nowrap border-b border-slate-200'

export function thClassExcelRevisionColumn(label: string): string {
  const s = label.trim().toLowerCase()
  let tone = 'text-slate-500 bg-slate-50'
  if (s.includes('nombre') || s.includes('apellido') || s.includes('rut')) {
    tone = 'text-slate-800 bg-slate-50'
  }
  if (s.includes('fecha nacimiento') || s.includes('f. nacimiento')) tone = 'text-slate-700 bg-slate-50/90'
  if (s.includes('fecha postulación') || s.includes('hora postulación')) {
    tone = 'text-blue-800 bg-blue-50/50'
  }
  if (s === 'nem' || (s.includes('nem') && !s.includes('puntaje'))) {
    tone = 'text-indigo-700 bg-indigo-50/50'
  }
  if (s.includes('tramo rsh')) tone = 'text-teal-700 bg-teal-50/50'
  if (s.includes('hermano') || s.includes('hijo') || s.includes('hnos')) {
    tone = 'text-purple-700 bg-purple-50/50'
  }
  if (s.includes('enfermedad') || s.includes('enf.') || s.includes('catastrófica') || s.includes('crónica')) {
    tone = 'text-rose-700 bg-rose-50/50'
  }
  if (s.includes('puntaje nem') || s.includes('pts. nem') || s.match(/puntaje\s*nem/)) {
    tone = 'text-indigo-800 bg-indigo-50/70'
  }
  if (s.includes('puntaje rsh') || s.includes('pts. rsh')) tone = 'text-teal-800 bg-teal-50/70'
  if (s.includes('puntaje enfermedad') || s.includes('pts. enf')) tone = 'text-rose-800 bg-rose-50/70'
  if (s.includes('puntaje hermanos') || s.includes('pts. hnos')) tone = 'text-purple-900 bg-purple-50/70'
  if (s.includes('puntaje total')) tone = 'text-blue-900 bg-blue-100 font-black'
  if (s.includes('cuenta banc')) tone = 'text-slate-700 bg-amber-50/30'
  if (s.includes('fecha registro')) tone = 'text-slate-700 bg-slate-100/80'
  if (s.includes('descarga documentación') || s.includes('revisor designado')) {
    tone = 'text-sky-800 bg-sky-50/60'
  }
  return `${TH_BASE} ${tone}`
}

const TD_BASE =
  'px-2 py-1.5 text-[10px] align-top border-b border-slate-100 min-w-[5rem] max-w-[min(32rem,48vw)] whitespace-pre-wrap break-words'

export function tdClassExcelRevisionColumn(label: string): string {
  const s = label.trim().toLowerCase()
  let tone = 'text-slate-800 bg-white'
  if (s.includes('fecha postulación')) tone = 'text-blue-900 bg-blue-50/25 font-medium'
  if (s === 'nem' || (s.includes('nem') && !s.includes('puntaje'))) tone = 'text-indigo-900 bg-indigo-50/25 font-bold'
  if (s.includes('tramo rsh')) tone = 'text-teal-900 bg-teal-50/25 font-semibold'
  if (s.includes('hermano') || s.includes('hijo') || s.includes('hnos')) {
    tone = 'text-purple-900 bg-purple-50/25'
  }
  if (s.includes('enfermedad') || s.includes('enf.')) tone = 'text-rose-900 bg-rose-50/25'
  if (s.includes('puntaje nem') || s.includes('pts. nem')) tone = 'text-indigo-950 bg-indigo-50/35 font-bold'
  if (s.includes('puntaje rsh') || s.includes('pts. rsh')) tone = 'text-teal-950 bg-teal-50/35 font-bold'
  if (s.includes('puntaje enfermedad') || s.includes('pts. enf')) tone = 'text-rose-950 bg-rose-50/35 font-bold'
  if (s.includes('puntaje hermanos') || s.includes('pts. hnos')) tone = 'text-purple-950 bg-purple-50/35 font-bold'
  if (s.includes('puntaje total')) {
    tone = 'text-blue-950 bg-blue-100/90 font-black shadow-[inset_0_0_0_1px_rgba(30,64,175,0.08)]'
  }
  return `${TD_BASE} ${tone}`
}
