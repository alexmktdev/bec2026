import { useMemo, useState } from 'react'
import type { PostulanteFirestore } from '../../types/postulante'
import { actualizarPostulante } from '../../services/postulacionService'
import { calcularPuntajeTotal } from '../../services/scoring'

interface Props {
  postulante: PostulanteFirestore
  onClose: () => void
  onGuardado: (actualizado: PostulanteFirestore) => void
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="col-span-full text-xs font-bold text-blue-800 uppercase tracking-widest border-b border-slate-200 pb-1 mb-1 mt-2">
      {children}
    </h3>
  )
}

function Field({
  label,
  name,
  value,
  onChange,
  type = 'text',
  readOnly = false,
}: {
  label: string
  name: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void
  type?: string
  readOnly?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        className={`rounded-lg border px-2.5 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
          readOnly ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' : 'border-slate-300 bg-white'
        }`}
      />
    </div>
  )
}

function SelectField({
  label,
  name,
  value,
  onChange,
  options,
}: {
  label: string
  name: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
      <select
        name={name}
        value={value}
        onChange={onChange}
        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

export function PostulanteEdit({ postulante, onClose, onGuardado }: Props) {
  const [form, setForm] = useState({
    nombres: postulante.nombres ?? '',
    apellidoPaterno: postulante.apellidoPaterno ?? '',
    apellidoMaterno: postulante.apellidoMaterno ?? '',
    rut: postulante.rut ?? '',
    fechaNacimiento: postulante.fechaNacimiento ?? '',
    edad: postulante.edad ?? '',
    sexo: postulante.sexo ?? '',
    estadoCivil: postulante.estadoCivil ?? '',
    telefono: postulante.telefono ?? '',
    email: postulante.email ?? '',
    domicilioFamiliar: postulante.domicilioFamiliar ?? '',
    nem: postulante.nem ?? '',
    nombreInstitucion: postulante.nombreInstitucion ?? '',
    comuna: postulante.comuna ?? '',
    carrera: postulante.carrera ?? '',
    duracionSemestres: postulante.duracionSemestres ?? '',
    anoIngreso: postulante.anoIngreso ?? '',
    totalIntegrantes: postulante.totalIntegrantes ?? '',
    tramoRegistroSocial: postulante.tramoRegistroSocial ?? '',
    tieneHermanosOHijosEstudiando: postulante.tieneHermanosOHijosEstudiando ?? '',
    tieneUnHermanOHijoEstudiando: postulante.tieneUnHermanOHijoEstudiando ?? '',
    tieneDosOMasHermanosOHijosEstudiando: postulante.tieneDosOMasHermanosOHijosEstudiando ?? '',
    enfermedadCatastrofica: postulante.enfermedadCatastrofica ?? '',
    enfermedadCronica: postulante.enfermedadCronica ?? '',
    numeroCuenta: postulante.numeroCuenta ?? '',
    rutCuenta: postulante.rutCuenta ?? '',
    observacion: postulante.observacion ?? '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Puntaje calculado en tiempo real según los campos del formulario
  const puntajePreview = useMemo(() => calcularPuntajeTotal({ ...postulante, ...form }), [form, postulante])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleGuardar = async () => {
    if (!postulante.id) return

    // Validaciones básicas antes de guardar
    if (!form.nombres.trim()) { setError('El campo "Nombres" es obligatorio.'); return }
    if (!form.apellidoPaterno.trim()) { setError('El campo "Apellido paterno" es obligatorio.'); return }
    const nemNum = parseFloat(form.nem)
    if (!form.nem || isNaN(nemNum) || nemNum < 1.0 || nemNum > 7.0) {
      setError('El NEM debe ser un número entre 1.0 y 7.0.'); return
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('El formato del email no es válido.'); return
    }

    setGuardando(true)
    setError(null)
    try {
      // Recalcular puntaje con los nuevos datos
      const datosActualizados = { ...postulante, ...form }
      const puntaje = calcularPuntajeTotal(datosActualizados)

      await actualizarPostulante(postulante.id, { ...form, puntaje })

      onGuardado({ ...postulante, ...form, puntaje })
    } catch (err) {
      console.error('Error guardando:', err)
      setError('Error al guardar los cambios. Intente nuevamente.')
    } finally {
      setGuardando(false)
    }
  }

  const SI_NO = [
    { value: '', label: '—' },
    { value: 'Si', label: 'Sí' },
    { value: 'No', label: 'No' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 pt-6 pb-6">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Editar postulante</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {postulante.nombres} {postulante.apellidoPaterno} · {postulante.rut}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-2 max-h-[calc(100vh-10rem)] overflow-y-auto">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">

            <SectionTitle>Datos personales</SectionTitle>
            <Field label="Nombres" name="nombres" value={form.nombres} onChange={handleChange} />
            <Field label="Apellido paterno" name="apellidoPaterno" value={form.apellidoPaterno} onChange={handleChange} />
            <Field label="Apellido materno" name="apellidoMaterno" value={form.apellidoMaterno} onChange={handleChange} />
            <Field label="RUT" name="rut" value={form.rut} onChange={handleChange} readOnly />
            <Field label="Fecha nacimiento" name="fechaNacimiento" value={form.fechaNacimiento} onChange={handleChange} type="date" />
            <Field label="Edad" name="edad" value={form.edad} onChange={handleChange} />
            <SelectField
              label="Sexo"
              name="sexo"
              value={form.sexo}
              onChange={handleChange}
              options={[
                { value: '', label: '—' },
                { value: 'Masculino', label: 'Masculino' },
                { value: 'Femenino', label: 'Femenino' },
                { value: 'Otro', label: 'Otro' },
              ]}
            />
            <SelectField
              label="Estado civil"
              name="estadoCivil"
              value={form.estadoCivil}
              onChange={handleChange}
              options={[
                { value: '', label: '—' },
                { value: 'Soltero/a', label: 'Soltero/a' },
                { value: 'Casado/a', label: 'Casado/a' },
                { value: 'Conviviente', label: 'Conviviente' },
                { value: 'Divorciado/a', label: 'Divorciado/a' },
                { value: 'Viudo/a', label: 'Viudo/a' },
              ]}
            />
            <Field label="Teléfono" name="telefono" value={form.telefono} onChange={handleChange} />
            <Field label="Email" name="email" value={form.email} onChange={handleChange} type="email" />
            <div className="col-span-2 sm:col-span-3 flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Domicilio familiar</label>
              <input
                type="text"
                name="domicilioFamiliar"
                value={form.domicilioFamiliar}
                onChange={handleChange}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <SectionTitle>Antecedentes académicos</SectionTitle>
            <Field label="NEM" name="nem" value={form.nem} onChange={handleChange} />
            <Field label="Institución" name="nombreInstitucion" value={form.nombreInstitucion} onChange={handleChange} />
            <Field label="Comuna" name="comuna" value={form.comuna} onChange={handleChange} />
            <Field label="Carrera" name="carrera" value={form.carrera} onChange={handleChange} />
            <Field label="Duración (semestres)" name="duracionSemestres" value={form.duracionSemestres} onChange={handleChange} />
            <Field label="Año ingreso" name="anoIngreso" value={form.anoIngreso} onChange={handleChange} />

            <SectionTitle>Antecedentes familiares y socioeconómicos</SectionTitle>
            <Field label="Total integrantes" name="totalIntegrantes" value={form.totalIntegrantes} onChange={handleChange} />
            <SelectField
              label="Tramo RSH"
              name="tramoRegistroSocial"
              value={form.tramoRegistroSocial}
              onChange={handleChange}
              options={[
                { value: '', label: '—' },
                { value: '40%', label: '40%' },
                { value: '50%', label: '50%' },
                { value: '60%', label: '60%' },
                { value: '70%', label: '70%' },
              ]}
            />
            <SelectField label="Hnos./Hijos estudiando" name="tieneHermanosOHijosEstudiando" value={form.tieneHermanosOHijosEstudiando} onChange={handleChange} options={SI_NO} />
            <SelectField label="1 Hno./Hijo estudiando" name="tieneUnHermanOHijoEstudiando" value={form.tieneUnHermanOHijoEstudiando} onChange={handleChange} options={SI_NO} />
            <SelectField label="2+ Hnos./Hijos estudiando" name="tieneDosOMasHermanosOHijosEstudiando" value={form.tieneDosOMasHermanosOHijosEstudiando} onChange={handleChange} options={SI_NO} />
            <SelectField label="Enfermedad catastrófica" name="enfermedadCatastrofica" value={form.enfermedadCatastrofica} onChange={handleChange} options={SI_NO} />
            <SelectField label="Enfermedad crónica" name="enfermedadCronica" value={form.enfermedadCronica} onChange={handleChange} options={SI_NO} />

            <SectionTitle>Cuenta bancaria</SectionTitle>
            <Field label="N° cuenta" name="numeroCuenta" value={form.numeroCuenta} onChange={handleChange} />
            <Field label="RUT titular" name="rutCuenta" value={form.rutCuenta} onChange={handleChange} />

            <SectionTitle>Observaciones</SectionTitle>
            <div className="col-span-2 sm:col-span-3 flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Observaciones</label>
              <textarea
                name="observacion"
                value={form.observacion}
                onChange={handleChange}
                rows={3}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Puntaje en tiempo real */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-2">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Puntaje calculado (se actualiza al editar)</p>
            <div className="grid grid-cols-5 gap-2">
              {[
                { label: 'NEM', value: puntajePreview.nem, color: 'bg-blue-100 text-blue-800' },
                { label: 'RSH', value: puntajePreview.rsh, color: 'bg-purple-100 text-purple-800' },
                { label: 'Enfermedad', value: puntajePreview.enfermedad, color: 'bg-amber-100 text-amber-800' },
                { label: 'Hermanos', value: puntajePreview.hermanos, color: 'bg-teal-100 text-teal-800' },
                { label: 'TOTAL', value: puntajePreview.total, color: 'bg-slate-800 text-white' },
              ].map((item) => (
                <div key={item.label} className={`flex flex-col items-center rounded-lg px-2 py-2 ${item.color}`}>
                  <span className="text-[9px] font-semibold uppercase tracking-wide opacity-80">{item.label}</span>
                  <span className="text-lg font-bold leading-tight">{item.value}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-400">El RUT no puede modificarse. Al guardar, el puntaje quedará registrado con estos valores.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={guardando}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleGuardar}
            disabled={guardando}
            className="flex items-center gap-2 rounded-lg bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {guardando ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Guardando...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Guardar cambios
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
