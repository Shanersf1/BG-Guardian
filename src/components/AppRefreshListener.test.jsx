import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppRefreshListener from './AppRefreshListener';

const mockGetPlatform = vi.fn(() => 'android');
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => mockGetPlatform() },
  registerPlugin: vi.fn(),
}));

vi.mock('@capacitor/app', () => ({
  App: { addListener: vi.fn(() => Promise.resolve({ remove: vi.fn() })) },
}));

function renderWithClient() {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <AppRefreshListener />
    </QueryClientProvider>
  );
  return { queryClient };
}

describe('AppRefreshListener', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatform.mockReturnValue('android');
  });

  it('listens for app-resume window event and invalidates bgReadings', () => {
    const { queryClient } = renderWithClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    window.dispatchEvent(new CustomEvent('app-resume'));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bgReadings'] });
  });
});
