import { createBrowserRouter, RouterProvider } from 'react-router'

import { PwaStatus } from '@/ui/layout/PwaStatus'

import { routes } from './routes'

const router = createBrowserRouter(routes, { basename: import.meta.env.BASE_URL })

export function App() {
  return (
    <>
      <RouterProvider router={router} />
      <PwaStatus />
    </>
  )
}
