import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, Outlet } from 'react-router-dom'

// Importaciones estáticas para elementos críticos de contexto
import { ProtectedRoute } from './components/ProtectedRoute'
import { FormStepGuard } from './components/FormStepGuard'
import { AdminFilterProvider } from './contexts/AdminFilterContext'

// Lazy Loading de los pasos del formulario
const Bienvenida = lazy(() => import('./components/Bienvenida').then(module => ({ default: module.Bienvenida })))
const InformacionBeca = lazy(() => import('./components/InformacionBeca').then(module => ({ default: module.InformacionBeca })))
const AntecedentesPostulante = lazy(() => import('./components/AntecedentesPostulante').then(module => ({ default: module.AntecedentesPostulante })))
const AntecedentesAcademicos = lazy(() => import('./components/AntecedentesAcademicos').then(module => ({ default: module.AntecedentesAcademicos })))
const AntecedentesFamiliares = lazy(() => import('./components/AntecedentesFamiliares').then(module => ({ default: module.AntecedentesFamiliares })))
const CuentaBancaria = lazy(() => import('./components/CuentaBancaria').then(module => ({ default: module.CuentaBancaria })))
const Observaciones = lazy(() => import('./components/Observaciones').then(module => ({ default: module.Observaciones })))
const DocumentosPostulacion = lazy(() => import('./components/DocumentosPostulacion').then(module => ({ default: module.DocumentosPostulacion })))
const DeclaracionJurada = lazy(() => import('./components/DeclaracionJurada').then(module => ({ default: module.DeclaracionJurada })))

// Lazy Loading de páginas de estado resultantes
const EvaluandoPostulacion = lazy(() => import('./components/EvaluandoPostulacion').then(module => ({ default: module.EvaluandoPostulacion })))
const PostulacionExitosa = lazy(() => import('./components/PostulacionExitosa').then(module => ({ default: module.PostulacionExitosa })))
const PostulacionRechazada = lazy(() => import('./components/PostulacionRechazada').then(module => ({ default: module.PostulacionRechazada })))
const PostulacionYaRealizada = lazy(() => import('./components/PostulacionYaRealizada').then(module => ({ default: module.PostulacionYaRealizada })))

// Lazy Loading de rutas de Admin (pesadas)
const Login = lazy(() => import('./components/admin/Login').then(module => ({ default: module.Login })))
const Dashboard = lazy(() => import('./components/admin/Dashboard').then(module => ({ default: module.Dashboard })))
const FiltroPuntajeTotal = lazy(() => import('./components/admin/FiltroPuntajeTotal').then(module => ({ default: module.FiltroPuntajeTotal })))
const FiltroInicial = lazy(() => import('./components/admin/FiltroInicial').then(module => ({ default: module.FiltroInicial })))
const FiltroRevisionDoc = lazy(() => import('./components/admin/FiltroRevisionDoc').then(module => ({ default: module.FiltroRevisionDoc })))
const FiltroDesempate = lazy(() => import('./components/admin/FiltroDesempate').then(module => ({ default: module.FiltroDesempate })))
const PostulantesRechazadosEntrada = lazy(() =>
  import('./components/admin/PostulantesRechazadosEntrada').then((module) => ({
    default: module.PostulantesRechazadosEntrada,
  })),
)
const UsersManagement = lazy(() => import('./components/admin/UsersManagement').then(module => ({ default: module.UsersManagement })))

function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen px-4">
      <div>{children}</div>
      <div className="mt-4 flex justify-center sm:absolute sm:bottom-3 sm:left-1/2 sm:mt-0 sm:-translate-x-1/2">
        <div className="inline-flex max-w-[92vw] items-center justify-center gap-1.5 text-center text-[10px] text-slate-500 sm:max-w-none">
          <span>Si quiere ingresar nuevos datos, por favor recargar la página web en el icono</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5"
            aria-hidden="true"
          >
            <path d="M21 12a9 9 0 1 1-3-6.7" />
            <path d="M21 3v6h-6" />
          </svg>
        </div>
      </div>
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-800"></div>
        <p className="text-sm font-medium text-slate-500 animate-pulse">Cargando módulo...</p>
      </div>
    </div>
  )
}

function App() {
  return (
    <main className="min-h-screen bg-slate-50">
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Rutas publicas - Formulario */}
          <Route path="/" element={<Navigate to="/informacion_beca" replace />} />
          <Route path="/informacion_beca" element={<InformacionBeca />} />
          <Route path="/bienvenida_1" element={<PageContainer><Bienvenida /></PageContainer>} />
          <Route
            path="/antecedentes_postulante_2"
            element={<PageContainer><FormStepGuard step={1}><AntecedentesPostulante /></FormStepGuard></PageContainer>}
          />
          <Route
            path="/antecedentes_academicos_3"
            element={<PageContainer><FormStepGuard step={2}><AntecedentesAcademicos /></FormStepGuard></PageContainer>}
          />
          <Route
            path="/antecedentes_familiares_4"
            element={<PageContainer><FormStepGuard step={3}><AntecedentesFamiliares /></FormStepGuard></PageContainer>}
          />
          <Route
            path="/cuenta_bancaria_5"
            element={<PageContainer><FormStepGuard step={4}><CuentaBancaria /></FormStepGuard></PageContainer>}
          />
          <Route
            path="/observaciones_6"
            element={<PageContainer><FormStepGuard step={5}><Observaciones /></FormStepGuard></PageContainer>}
          />
          <Route
            path="/documentos_7"
            element={<PageContainer><FormStepGuard step={6}><DocumentosPostulacion /></FormStepGuard></PageContainer>}
          />
          <Route
            path="/declaracion_jurada_8"
            element={<PageContainer><FormStepGuard step={7}><DeclaracionJurada /></FormStepGuard></PageContainer>}
          />
          <Route
            path="/evaluando_postulacion_9"
            element={<PageContainer><FormStepGuard step={8}><EvaluandoPostulacion /></FormStepGuard></PageContainer>}
          />
          <Route path="/postulacion_exitosa_9" element={<PageContainer><PostulacionExitosa /></PageContainer>} />
          <Route path="/postulacion_rechazada" element={<PageContainer><PostulacionRechazada /></PageContainer>} />
          <Route path="/postulacion_ya_realizada" element={<PageContainer><PostulacionYaRealizada /></PageContainer>} />

          {/* Rutas admin */}
          <Route path="/admin/login" element={<PageContainer><Login /></PageContainer>} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminFilterProvider>
                  <Outlet />
                </AdminFilterProvider>
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="filtro-puntaje-total" element={<FiltroPuntajeTotal />} />
            <Route path="filtro-inicial" element={<FiltroInicial />} />
            <Route path="filtro-revision-doc" element={<FiltroRevisionDoc />} />
            <Route path="filtro-desempate" element={<FiltroDesempate />} />
            <Route path="postulantes-rechazados-entrada" element={<PostulantesRechazadosEntrada />} />
            <Route path="usuarios" element={<UsersManagement />} />
          </Route>
          <Route path="/admin/*" element={<Navigate to="/admin" replace />} />

          {/* Fallback para cualquier ruta inválida */}
          <Route path="*" element={<Navigate to="/bienvenida_1" replace />} />
        </Routes>
      </Suspense>
    </main>
  )
}

export default App
