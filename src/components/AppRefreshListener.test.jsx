import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppRefreshListener from './AppRefreshListener';

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
  });

  it('listens for app-resume window event and invalidates bgReadings', () => {
    const { queryClient } = renderWithClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    window.dispatchEvent(new CustomEvent('app-resume'));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bgReadings'] });
  });

  it('listens for bgg-data-update and sets query data when payload is array', () => {
    const { queryClient } = renderWithClient();
    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');
    const readings = [{ id: 1, glucose_value: 100 }];

    window.dispatchEvent(new CustomEvent('bgg-data-update', { detail: readings }));
    expect(setQueryDataSpy).toHaveBeenCalledWith(['bgReadings'], readings);
  });

  it('parses string payload and sets query data on bgg-data-update', () => {
    const { queryClient } = renderWithClient();
    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');
    const readings = [{ id: 1, glucose_value: 100 }];

    window.dispatchEvent(new CustomEvent('bgg-data-update', { detail: JSON.stringify(readings) }));
    expect(setQueryDataSpy).toHaveBeenCalledWith(['bgReadings'], readings);
  });
});
