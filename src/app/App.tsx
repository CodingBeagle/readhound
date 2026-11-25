import { createBrowserRouter, RouterProvider } from 'react-router'

import { PwaStatus } from '@/ui/layout/PwaStatus'

import { routes } from './routes'
import { ServicesProvider } from './services'

const router = createBrowserRouter(routes, { basename: import.meta.env.BASE_URL })

export function App() {
  return (
    <ServicesProvider>
      <RouterProvider router={router} />
      <PwaStatus />
    </ServicesProvider>
  )
}
