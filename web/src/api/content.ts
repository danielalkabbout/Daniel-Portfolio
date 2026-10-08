import { useQuery } from '@tanstack/react-query';
import fallbackJson from '../content/fallback.json';
import { siteContentSchema, type SiteContent } from '../types/content';
import { store } from '../lib/env';
import { api, API_ENABLED } from './client';

/** Bundled snapshot: the site renders instantly from this, even while the API is asleep. */
export const fallbackContent: SiteContent = siteContentSchema.parse(fallbackJson);

export const PREVIEW_KEY = 'dk-preview';

/** Unpublished content the owner is previewing from the studio (this tab only). */
function readPreview(): SiteContent | null {
  const raw = store('session').get(PREVIEW_KEY);
  if (!raw) return null;
  try {
    const parsed = siteContentSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const preview = typeof window !== 'undefined' ? readPreview() : null;
export const isPreview = Boolean(preview);

/**
 * Public pages read content through this hook.
 * It starts from the bundled snapshot and, when VITE_API_ENABLED is set, refreshes from
 * GET /api/content in the background, keeping the snapshot on any error.
 */
export function useContent() {
  return useQuery({
    queryKey: ['content'],
    queryFn: async () => siteContentSchema.parse(await api<unknown>('/api/content', { timeoutMs: 60000 })),
    enabled: API_ENABLED && !preview,
    initialData: preview ?? fallbackContent,
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

/** The content to render: preview draft, fresh API content, or the bundled snapshot. */
export function useSite(): SiteContent {
  return useContent().data;
}
