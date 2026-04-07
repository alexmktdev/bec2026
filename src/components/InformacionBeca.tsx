/**
 * InformacionBeca — PRIMERA PANTALLA DEL SISTEMA
 * Punto de entrada del flujo de postulación. Muestra requisitos, documentos y la opción
 * de continuar hacia el formulario. Las redirecciones "al inicio" deben apuntar aquí.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import logoMolina from '../assets/logo-molina.png'

const REQUISITOS_EXCLUYENTES = [
  'Residencia permanente en la comuna de Molina, acreditada por Registro Social de Hogares en estado vigente.',
  'Estar matriculado/a en el año en curso en carrera técnica o profesional en institución reconocida por el Ministerio de Educación.',
  'Grupo familiar categorizado hasta el 70% de menores ingresos según RSH.',
  'Promedio NEM igual o superior a 5.5.',
  'Podrán postular sólo alumnos egresados de enseñanza media entre 17 y 23 años, que ingresen por primera vez a educación superior.',
  'No ser funcionario/a municipal, bajo ningún estatuto de contratación.',
  'No ser hijo/a de funcionario/a municipal, bajo ningún estatuto de contratación.',
  'El/la postulante debe figurar como integrante del grupo familiar en la cartola del RSH (si no figura, la postulación es inadmisible).',
  'La beca solo puede obtenerse una vez en la vida — quien ya la recibió no puede volver a postular.',
  'Presentar la postulación entre el 13 y el 17 de abril de 2026.',
]

const DOCUMENTOS = [
  'Fotocopia de cédula de identidad (principalmente cara frontal).',
  'Cartola del Registro Social de Hogares (RSH).',
  'Concentración de notas de enseñanza media (NEM).',
  'Certificado de matrícula o comprobante de pago de matrícula en institución de Educación Superior, que acredite que es estudiante de educación superior.',
  'Certificado de alumno/a regular de hermanos/as y/o hijos/as del postulante que estén cursando estudios.',
  'Certificado médico en caso de enfermedades crónicas y/o catastróficas de algún miembro del grupo familiar.',
]

const REQUISITOS_FORMALES = [
  'Toda la documentación debe presentarse completa — las postulaciones incompletas son excluidas.',
  'Toda la información debe ser veraz y fidedigna — la información falsa o errónea es causal de exclusión.',
  'la documentación entregada debe ser clara y legible',
  'La postulación debe hacerse a través de los canales habilitados por la Municipalidad, para este caso por la pagina web y presencialmente en DIDECO Molina.',
  'Si la postulación es digital/remota, es responsabilidad exclusiva del postulante verificar que se hayan enviado todos los antecedentes requeridos.',
  'El/la postulante debe firmar la Declaración Jurada incluida en el formulario online, declarando que toda la información es verídica y que no es funcionario/a ni hijo/a de funcionario/a municipal.',
]

const REQUISITOS_COBRO = [
  'Indicar en el formulario de postulación una cuenta bancaria (cuenta rut u otra) a nombre del propio beneficiario/a.',
  'El/la beneficiario/a debe ser el/la titular de la cuenta bancaria indicada.',
  'La información sobre el pago se informará oportunamente a los beneficiarios cuando corresponda.',
]

interface SectionProps {
  icon: React.ReactNode
  title: string
  subtitle: string
  items: string[]
  color: 'red' | 'blue' | 'amber' | 'emerald'
}

function Section({ icon, title, subtitle, items, color }: SectionProps) {
  const colors = {
    red: {
      card: 'border-red-200 bg-red-50/60',
      header: 'bg-red-100/80 border-b border-red-200',
      iconBg: 'bg-red-100 text-red-700',
      title: 'text-red-900',
      sub: 'text-red-700',
      dot: 'bg-red-500',
      item: 'text-slate-700',
    },
    blue: {
      card: 'border-blue-200 bg-blue-50/60',
      header: 'bg-blue-100/80 border-b border-blue-200',
      iconBg: 'bg-blue-100 text-blue-700',
      title: 'text-blue-900',
      sub: 'text-blue-700',
      dot: 'bg-blue-500',
      item: 'text-slate-700',
    },
    amber: {
      card: 'border-amber-200 bg-amber-50/60',
      header: 'bg-amber-100/80 border-b border-amber-200',
      iconBg: 'bg-amber-100 text-amber-700',
      title: 'text-amber-900',
      sub: 'text-amber-700',
      dot: 'bg-amber-500',
      item: 'text-slate-700',
    },
    emerald: {
      card: 'border-emerald-200 bg-emerald-50/60',
      header: 'bg-emerald-100/80 border-b border-emerald-200',
      iconBg: 'bg-emerald-100 text-emerald-700',
      title: 'text-emerald-900',
      sub: 'text-emerald-700',
      dot: 'bg-emerald-500',
      item: 'text-slate-700',
    },
  }
  const c = colors[color]

  return (
    <div className={`rounded-xl border ${c.card} overflow-hidden shadow-sm`}>
      <div className={`flex items-center gap-3 px-5 py-4 ${c.header}`}>
        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${c.iconBg}`}>
          {icon}
        </div>
        <div>
          <h2 className={`text-sm font-bold uppercase tracking-wide ${c.title}`}>{title}</h2>
          <p className={`text-xs ${c.sub}`}>{subtitle}</p>
        </div>
      </div>
      <ul className="divide-y divide-slate-100/80 px-5 py-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-3 py-2.5">
            <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${c.dot}`} />
            <span className={`text-sm leading-relaxed ${c.item}`}>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

type InfoSectionKey =
  | 'requisitos-excluyentes'
  | 'documentos'
  | 'requisitos-formales'
  | 'requisitos-cobro'

export function InformacionBeca() {
  const navigate = useNavigate()
  const [decision, setDecision] = useState<'pregunta' | 'no' | null>(null)
  const [seccionActiva, setSeccionActiva] = useState<InfoSectionKey | ''>('')

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-slate-50 py-8 px-4">
      <div className="mx-auto max-w-4xl space-y-6">

        {/* Hero */}
        <div className="rounded-2xl border border-blue-200 bg-white shadow-md overflow-hidden">
          <div className="bg-gradient-to-r from-blue-800 to-blue-700 px-8 py-6 flex flex-col items-center text-center gap-4">
            <img
              src={logoMolina}
              alt="Logo Municipalidad de Molina"
              className="h-20 w-auto object-contain drop-shadow"
            />
            <div>
              <p className="text-blue-200 text-sm font-semibold uppercase tracking-widest mb-1">Municipalidad de Molina</p>
              <h1 className="text-3xl font-bold text-white leading-tight">
                Beca Municipal de Molina 2026
              </h1>
            </div>
          </div>
          <div className="px-8 py-6 text-center space-y-3">
            <p className="text-slate-700 text-base leading-relaxed">
              La <strong>Beca Municipal de Molina</strong> es un beneficio económico entregado por la Municipalidad de Molina a jóvenes estudiantes de la comuna que ingresan a la educación superior, con el objetivo de apoyar su continuidad académica y contribuir al desarrollo de nuestra comunidad.
            </p>
            <p className="text-slate-600 text-sm leading-relaxed">
              Antes de iniciar tu postulación, te pedimos que leas detenidamente los requisitos, documentos y condiciones que se detallan a continuación. El cumplimiento de <strong>todos los requisitos excluyentes</strong> es obligatorio para que la postulación sea admisible.
            </p>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Período de postulación: 13 al 17 de abril de 2026
            </div>
          </div>
        </div>

        {/* Aviso crítico: documentación obligatoria antes de postular */}
        <div
          role="alert"
          aria-live="polite"
          className="rounded-xl border-2 border-red-600 bg-red-50/90 p-4 shadow-sm ring-2 ring-red-100 sm:p-4"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
            <div className="flex shrink-0 justify-center sm:justify-start">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-red-600 text-white sm:h-12 sm:w-12">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p className="text-sm font-bold uppercase tracking-wide text-red-950 sm:text-base">
                Documentación obligatoria
              </p>
              <p className="mt-1.5 text-sm font-semibold leading-snug text-red-950">
                Para postular <span className="underline decoration-red-600 decoration-1 underline-offset-2">debe contar sí o sí</span> con toda la documentación exigida: archivos digitales legibles, al día y completos.
              </p>
              <p className="mt-2 text-xs font-medium leading-relaxed text-red-900 sm:text-sm">
                Revise la sección <strong>«Documentos obligatorios»</strong> en el menú de abajo antes de continuar. Las postulaciones sin la documentación completa o ilegible <strong>no serán admisibles</strong>.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 sm:p-5">
          <div className="mb-3 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
            Usa este menú para revisar, una por una, las secciones informativas antes de decidir si continúas con la postulación.
          </div>
          <label htmlFor="menu-informacion-beca" className="block text-xs font-bold uppercase tracking-wide text-slate-600 mb-2">
            Menú de información
          </label>
          <select
            id="menu-informacion-beca"
            value={seccionActiva}
            onChange={(e) => setSeccionActiva(e.target.value as InfoSectionKey | '')}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="">Seleccione una sección...</option>
            <option value="requisitos-excluyentes">Requisitos obligatorios excluyentes</option>
            <option value="documentos">Documentos obligatorios</option>
            <option value="requisitos-formales">Requisitos formales y de presentación</option>
            <option value="requisitos-cobro">Requisitos para el cobro</option>
          </select>
        </div>

        {seccionActiva === 'requisitos-excluyentes' && (
          <Section
            color="red"
            title="Requisitos obligatorios excluyentes"
            subtitle="Si falta uno solo, la postulación queda fuera"
            items={REQUISITOS_EXCLUYENTES}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            }
          />
        )}

        {seccionActiva === 'documentos' && (
          <Section
            color="blue"
            title="Documentos obligatorios"
            subtitle="Todos deben presentarse sin excepción"
            items={DOCUMENTOS}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
          />
        )}

        {seccionActiva === 'requisitos-formales' && (
          <Section
            color="amber"
            title="Requisitos formales y de presentación"
            subtitle="Condiciones que deben cumplir los documentos y la postulación"
            items={REQUISITOS_FORMALES}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            }
          />
        )}

        {seccionActiva === 'requisitos-cobro' && (
          <Section
            color="emerald"
            title="Requisitos para el cobro"
            subtitle="Aplica si resultas seleccionado/a como beneficiario/a"
            items={REQUISITOS_COBRO}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            }
          />
        )}

        {/* Llamado a la acción */}
        {decision === null && (
          <div className="rounded-2xl border border-blue-200 bg-white shadow-md px-8 py-8 text-center space-y-5">
            <div className="flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-bold text-slate-800">
              ¿Cumples con los requisitos y deseas continuar hacia la postulación?
            </h2>
            <p className="text-sm text-slate-500">
              Al continuar, accederás al formulario oficial de postulación de la Beca Municipal de Molina 2026.
            </p>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => navigate('/bienvenida_1')}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-800 px-8 py-3 text-base font-bold text-white shadow-sm hover:bg-blue-700 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Sí, deseo postular
              </button>
              <button
                type="button"
                onClick={() => setDecision('no')}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-8 py-3 text-base font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                No, por ahora no
              </button>
            </div>
          </div>
        )}

        {/* Mensaje si elige "No" */}
        {decision === 'no' && (
          <div className="rounded-2xl border border-blue-200 bg-white shadow-md px-8 py-10 text-center space-y-5">
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-9 w-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-blue-900">
              ¡Gracias por visitarnos!
            </h2>
            <p className="text-base text-slate-600 leading-relaxed max-w-lg mx-auto">
              Te recordamos que el período de postulación a la <strong>Beca Municipal de Molina 2026</strong> es del <strong>13 al 17 de abril</strong>.
            </p>
            <p className="text-slate-500 text-sm">
              Te esperamos aquí cuando estés listo/a para postular. ¡Mucho éxito en tus estudios!
            </p>
            <button
              type="button"
              onClick={() => setDecision(null)}
              className="inline-flex items-center gap-2 rounded-xl border border-blue-300 bg-blue-50 px-6 py-2.5 text-sm font-semibold text-blue-800 hover:bg-blue-100 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Volver a revisar los requisitos
            </button>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 pb-4">
          Municipalidad de Molina · Beca Municipal 2026 · Período de postulación: 13 al 17 de abril de 2026
        </p>

      </div>
    </div>
  )
}
