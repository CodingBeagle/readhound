import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './app/App'
import { requestPersistentStorage } from './db'
import './index.css'
import { applyTheme, readStoredTheme } from './ui/theme/themes'

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root not found')

applyTheme(readStoredTheme())

// Ask the browser to keep our IndexedDB data instead of evicting it under storage pressure.
void requestPersistentStorage()

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
