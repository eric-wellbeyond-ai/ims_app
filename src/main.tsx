import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthProvider'
import { PublicClientApplication } from '@azure/msal-browser'
import { msalConfig } from './auth/msalConfig'

const pca = new PublicClientApplication(msalConfig)

// MSAL Browser v5 requires initialize() to complete before any rendering.
// Without this, MsalProvider has no internal state and renders nothing.
pca.initialize().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AuthProvider instance={pca}>
        <App />
      </AuthProvider>
    </StrictMode>,
  )
}).catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err)
  console.error('[MSAL] initialize() failed:', err)
  document.getElementById('root')!.innerHTML =
    `<pre style="padding:2rem;color:red">MSAL init failed:\n${msg}</pre>`
})
