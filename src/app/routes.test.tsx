import 'fake-indexeddb/auto'

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'

import { ReadhoundDB } from '@/db/schema'

import { routes } from './routes'
import { createServices, ServicesProvider } from './services'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const services = createServices(new ReadhoundDB(`shell-${crypto.randomUUID()}`))
  render(
    <ServicesProvider services={services}>
      <RouterProvider router={router} />
    </ServicesProvider>,
  )
  return router
}

describe('app shell', () => {
  it('shows the five tabs in order', () => {
    renderAt('/')
    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    const links = Array.from(nav.querySelectorAll('a')).map((a) => a.textContent)
    expect(links).toEqual(['Home', 'Search', 'Library', 'Stats', 'Profile'])
  })

  it('opens Home by default and marks it active', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { name: 'Currently reading' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page')
  })

  it('navigates between tabs', async () => {
    renderAt('/')
    await userEvent.click(screen.getByRole('link', { name: 'Library' }))
    expect(screen.getByRole('heading', { name: 'Library' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current')
  })

  it('shows a not-found screen for unknown paths', () => {
    renderAt('/nope')
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })
})
