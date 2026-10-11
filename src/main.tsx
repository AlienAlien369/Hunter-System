import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary'
import { installGlobalErrorHandlers } from './utils/errorReporting'
import { loadLocale, useLocaleStore } from './i18n'

installGlobalErrorHandlers()
import './index.css'

// A returning Hindi/Hinglish hunter's language is fetched before the first paint, so English never flashes.
// If that download fails the app still starts (English fills the gaps).
loadLocale(useLocaleStore.getState().locale).catch(() => undefined).then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary fullPage>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ErrorBoundary>
    </StrictMode>,
  )
})

// Installable app + offline shell (production builds only, so dev HMR is untouched).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => console.warn('Service worker registration failed:', err));
  });
}
