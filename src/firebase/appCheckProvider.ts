import { ReCaptchaEnterpriseProvider, ReCaptchaV3Provider } from 'firebase/app-check'

/**
 * Debe coincidir con lo registrado en Firebase Console → App Check → tu app Web.
 * Si allí elegiste reCAPTCHA Enterprise, usa VITE_APPCHECK_USE_ENTERPRISE=true.
 */
export function createRecaptchaAppCheckProvider(siteKey: string) {
  const enterprise =
    import.meta.env.VITE_APPCHECK_USE_ENTERPRISE === 'true' ||
    import.meta.env.VITE_APPCHECK_USE_ENTERPRISE === '1'

  return enterprise ? new ReCaptchaEnterpriseProvider(siteKey) : new ReCaptchaV3Provider(siteKey)
}
