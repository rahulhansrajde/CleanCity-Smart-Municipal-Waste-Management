import { useCallback, useEffect, useRef, useState } from 'react';
import { errMsg } from '../api';

/** Calls `loader` now and then every `ms` milliseconds; `refresh()` reloads immediately. */
export function usePoll(loader, ms, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    let alive = true;
    let timer;
    const run = async () => {
      try {
        const d = await loaderRef.current();
        if (alive) {
          setData(d);
          setError(null);
        }
      } catch (e) {
        if (alive) setError(errMsg(e));
      } finally {
        if (alive) timer = setTimeout(run, ms);
      }
    };
    run();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, tick, ...deps]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading: data === null && !error, refresh };
}
