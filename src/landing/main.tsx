import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '../index.css'
import './landing.css'
import { LandingPage } from './LandingPage'

const root = document.getElementById('landing')
if (!root) throw new Error('Root element #landing not found')

createRoot(root).render(
  <StrictMode>
    <LandingPage />
  </StrictMode>,
)
