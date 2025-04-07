// This file configures the testing environment
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Create navigation mock function that can be verified in tests
const mockNavigate = vi.fn();

// Mock React Router DOM
vi.mock('react-router-dom', () => {
  return {
    ...vi.importActual('react-router-dom'),
    useParams: () => ({ id: '100' }), // This matches the expected ID in the tests
    useNavigate: () => mockNavigate, // Return the mock function
    useLocation: () => ({ pathname: '/workflows/100' }),
    mockNavigate: mockNavigate // Export the mock for assertions
  };
});

// Set up any global mocks or environment variables here
global.ResizeObserver = class ResizeObserver {
  constructor(callback) {
    this.callback = callback;
  }
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});