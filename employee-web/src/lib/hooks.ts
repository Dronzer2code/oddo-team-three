import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@carpool/api-client';

export interface AsyncState<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  /** True only on the first load, so refreshes do not flash a skeleton. */
  initialLoading: boolean;
  reload: () => void;
}

/**
 * Minimal data hook: loading / error / retry with no extra dependency.
 * Every screen uses it, so every screen has the same three states.
 */
export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [nonce, setNonce] = useState(0);
  const alive = useRef(true);
  const run = useRef(fetcher);
  run.current = fetcher;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    let current = true;
    setLoading(true);
    run
      .current()
      .then((result) => {
        if (!current || !alive.current) return;
        setData(result);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!current || !alive.current) return;
        setError(caught instanceof ApiError ? caught : new ApiError(0, 'INTERNAL_ERROR', String(caught)));
      })
      .finally(() => {
        if (!current || !alive.current) return;
        setLoading(false);
        setLoaded(true);
      });
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  return { data, error, loading, initialLoading: loading && !loaded, reload };
}

/** Debounces a value — used for search boxes so every keystroke is not a request. */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Tracks an in-flight mutation so buttons can show a busy state. */
export function useMutation<Args extends unknown[], Result>(
  action: (...args: Args) => Promise<Result>,
): { run: (...args: Args) => Promise<Result | null>; busy: boolean; error: ApiError | null } {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const run = useCallback(
    async (...args: Args) => {
      setBusy(true);
      setError(null);
      try {
        return await action(...args);
      } catch (caught) {
        const apiError = caught instanceof ApiError ? caught : new ApiError(0, 'INTERNAL_ERROR', String(caught));
        setError(apiError);
        return null;
      } finally {
        setBusy(false);
      }
    },
    [action],
  );

  return { run, busy, error };
}
