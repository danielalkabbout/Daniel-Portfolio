import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CodeRequest } from './CodeRequest';

const api = vi.fn();
vi.mock('../../api/client', async (orig) => ({
  ...(await orig<typeof import('../../api/client')>()),
  API_ENABLED: true,
  api: (...a: unknown[]) => api(...a),
}));

const renderIt = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CodeRequest project="Booking bot" />
    </QueryClientProvider>,
  );

describe('Request the code', () => {
  const sent = () => api.mock.calls.filter(([path]) => path === '/api/requests');
  beforeEach(() => api.mockReset().mockResolvedValue({ id: 1 }));

  it('opens a short form and checks name and email', () => {
    renderIt();
    fireEvent.click(screen.getByRole('button', { name: 'Request the code' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));
    expect(screen.getByText('Enter your name.')).toBeTruthy();
    expect(sent()).toHaveLength(0);
  });

  it('sends a Code access request for the project', async () => {
    renderIt();
    fireEvent.click(screen.getByRole('button', { name: 'Request the code' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Rana' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'rana@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));
    await waitFor(() => expect(screen.getByText('Request sent')).toBeTruthy());
    const body = sent()[0][1].body;
    expect(body.services).toEqual(['Code access']);
    expect(body.message).toContain('"Booking bot"');
  });
});
