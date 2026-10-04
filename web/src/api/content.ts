import { useQuery } from '@tanstack/react-query';
import fallbackJson from '../content/fallback.json';
import { siteContentSchema, type SiteContent } from '../types/content';
import { api, API_URL } from './client';

/** Bundled snapshot: the site renders instantly from this, even if the API is asleep. */
export const fallbackContent: SiteContent = siteContentSchema.parse(fallbackJson);

/**
 * Public pages read content through this hook.
 * Today it returns the bundled snapshot. Once VITE_API_URL is set (Phase 5),
 * it refreshes from GET /api/content in the background and falls back on any error.
 */
export function useContent() {
  return useQuery({
    queryKey: ['content'],
    queryFn: async () => siteContentSchema.parse(await api<unknown>('/api/content')),
    enabled: Boolean(API_URL),
    initialData: fallbackContent,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
