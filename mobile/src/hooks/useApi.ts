import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@carpool/api-client';

export interface AsyncState<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  initialLoading: boolean;
  refreshing: boolean;
  reload: () => void;
}

/** Same contract as the web hook: loading, error and retry on every screen. */
export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [nonce, setNonce] = useState(0);
  const run = useRef(fetcher);
  run.current = fetcher;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    run
      .current()
      .then((result) => {
        if (!alive) return;
        setData(result);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!alive) return;
        setError(caught instanceof ApiError ? caught : new ApiError(0, 'INTERNAL_ERROR', String(caught)));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
        setLoaded(true);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  return {
    data,
    error,
    loading,
    initialLoading: loading && !loaded,
    refreshing: loading && loaded,
    reload,
  };
}

export function useMutation<Args extends unknown[], Result>(action: (...args: Args) => Promise<Result>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const run = useCallback(
    async (...args: Args): Promise<Result | null> => {
      setBusy(true);
      setError(null);
      try {
        return await action(...args);
      } catch (caught) {
        setError(caught instanceof ApiError ? caught : new ApiError(0, 'INTERNAL_ERROR', String(caught)));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [action],
  );

  return { run, busy, error };
}
