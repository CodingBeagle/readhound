import '@testing-library/jest-dom/vitest'

// jsdom has no canvas: the confetti splash is a no-op in unit tests (its own test spies on it).
vi.mock('canvas-confetti', () => ({ default: vi.fn() }))
