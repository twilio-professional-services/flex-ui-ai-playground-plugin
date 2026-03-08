import { useState, useEffect, useCallback } from 'react';
import * as Flex from '@twilio/flex-ui';
import {
  LookupResponse,
  RecallResponse,
  RecallParams,
  MemoraObservation,
  MemoraTrait,
  MemoraSummary,
  PaginationMeta,
} from './types';

const SERVERLESS_DOMAIN = process.env.FLEX_APP_SERVERLESS_DOMAIN || '';
const PROXY_URL = `https://${SERVERLESS_DOMAIN}/memoraProxy`;

async function callMemoraProxy<T>(params: Record<string, string | number | undefined>): Promise<T> {
  const token = Flex.Manager.getInstance().user.token;

  // Build URL-encoded body with Token for twilio-flex-token-validator
  const body = new URLSearchParams();
  body.set('Token', token);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      body.set(key, String(value));
    }
  }

  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Memora proxy returned ${response.status}`);
  }

  return response.json();
}

// --- Profile Lookup ---

export function useProfileLookup(callerNumber: string | undefined) {
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!callerNumber) {
      setProfileId(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    callMemoraProxy<LookupResponse>({ action: 'lookup', phone: callerNumber })
      .then((data) => {
        if (cancelled) return;
        if (data.profiles && data.profiles.length > 0) {
          setProfileId(data.profiles[0]);
        } else {
          setError('No profile found for this caller');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [callerNumber]);

  return { profileId, loading, error };
}

// --- Recall (semantic search) ---

export function useRecall(profileId: string | null) {
  const [data, setData] = useState<RecallResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recall = useCallback(
    async (params: RecallParams = {}) => {
      if (!profileId) return;
      setLoading(true);
      setError(null);

      try {
        const result = await callMemoraProxy<RecallResponse>({
          action: 'recall',
          profileId,
          query: params.query,
          observationsLimit: params.observationsLimit ?? 20,
          summariesLimit: params.summariesLimit ?? 5,
        });
        setData(result);
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error.message);
      } finally {
        setLoading(false);
      }
    },
    [profileId],
  );

  return { data, loading, error, recall };
}

// --- Paginated list hooks ---

interface PaginatedState<T> {
  items: T[];
  meta: PaginationMeta | null;
  loading: boolean;
  error: string | null;
}

function usePaginatedMemora<T>(
  profileId: string | null,
  action: string,
  itemsKey: string,
) {
  const [state, setState] = useState<PaginatedState<T>>({
    items: [],
    meta: null,
    loading: false,
    error: null,
  });
  // Track page token history for client-side backward navigation
  // tokenHistory[0] is always undefined (first page), tokenHistory[1] is the token for page 2, etc.
  const [tokenHistory, setTokenHistory] = useState<(string | undefined)[]>([undefined]);
  const [pageIndex, setPageIndex] = useState(0);

  const fetchPageInternal = useCallback(
    async (pageToken?: string) => {
      if (!profileId) return;
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const result = await callMemoraProxy<Record<string, any>>({
          action,
          profileId,
          pageSize: 20,
          pageToken,
        });
        console.log(`[useMemora] ${action} response meta:`, result.meta, `items: ${(result[itemsKey] || []).length}`);
        setState({
          items: result[itemsKey] || [],
          meta: result.meta || null,
          loading: false,
          error: null,
        });
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        setState((prev) => ({ ...prev, loading: false, error: error.message }));
      }
    },
    [profileId, action, itemsKey],
  );

  const fetchNext = useCallback(() => {
    const nextToken = state.meta?.nextToken;
    if (!nextToken) return;
    const newIndex = pageIndex + 1;
    setTokenHistory((prev) => {
      const updated = prev.slice(0, newIndex);
      updated.push(nextToken);
      return updated;
    });
    setPageIndex(newIndex);
    fetchPageInternal(nextToken);
  }, [state.meta?.nextToken, pageIndex, fetchPageInternal]);

  const fetchPrevious = useCallback(() => {
    if (pageIndex <= 0) return;
    const prevIndex = pageIndex - 1;
    setPageIndex(prevIndex);
    fetchPageInternal(tokenHistory[prevIndex]);
  }, [pageIndex, tokenHistory, fetchPageInternal]);

  const refetch = useCallback(() => {
    fetchPageInternal(tokenHistory[pageIndex]);
  }, [fetchPageInternal, tokenHistory, pageIndex]);

  const hasNext = Boolean(state.meta?.nextToken);
  const hasPrevious = pageIndex > 0;

  // Auto-fetch first page when profileId changes; reset state to avoid stale data
  useEffect(() => {
    if (profileId) {
      setState({ items: [], meta: null, loading: true, error: null });
      setTokenHistory([undefined]);
      setPageIndex(0);
      fetchPageInternal();
    } else {
      setState({ items: [], meta: null, loading: false, error: null });
      setTokenHistory([undefined]);
      setPageIndex(0);
    }
  }, [profileId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    ...state,
    hasNext,
    hasPrevious,
    fetchNext,
    fetchPrevious,
    refetch,
  };
}

export function useObservations(profileId: string | null) {
  return usePaginatedMemora<MemoraObservation>(profileId, 'observations', 'observations');
}

export function useTraits(profileId: string | null) {
  return usePaginatedMemora<MemoraTrait>(profileId, 'traits', 'traits');
}

export function useConversationSummaries(profileId: string | null) {
  return usePaginatedMemora<MemoraSummary>(profileId, 'conversationSummaries', 'summaries');
}

// --- Sequential single-item deletion ---

export function useDeleteItems(profileId: string | null) {
  const [deleting, setDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState({ done: 0, total: 0 });
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deleteItems = useCallback(
    async (
      action: 'deleteObservation' | 'deleteSummary',
      ids: string[],
    ): Promise<number> => {
      if (!profileId || ids.length === 0) return 0;
      setDeleting(true);
      setDeleteError(null);
      setDeleteProgress({ done: 0, total: ids.length });

      const idParam = action === 'deleteObservation' ? 'observationId' : 'summaryId';
      let deleted = 0;

      for (const id of ids) {
        try {
          await callMemoraProxy<{ deleted: boolean }>({
            action,
            profileId,
            [idParam]: id,
          });
          deleted++;
        } catch (err: unknown) {
          const error = err instanceof Error ? err : new Error(String(err));
          setDeleteError(`Failed to delete ${id}: ${error.message}`);
          break;
        }
        setDeleteProgress({ done: deleted, total: ids.length });
      }

      setDeleting(false);
      return deleted;
    },
    [profileId],
  );

  return { deleting, deleteProgress, deleteError, deleteItems };
}

