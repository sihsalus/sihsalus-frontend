import { useEffect, useState } from 'react';

interface ApiDataState<T> {
  data?: T;
  error: boolean;
  isLoading: boolean;
}

export function useApiData<T>(load: () => Promise<T>): ApiDataState<T> {
  const [state, setState] = useState<ApiDataState<T>>({ error: false, isLoading: true });

  useEffect(() => {
    let active = true;
    setState({ error: false, isLoading: true });

    void load()
      .then((data) => {
        if (active) setState({ data, error: false, isLoading: false });
      })
      .catch(() => {
        if (active) setState({ error: true, isLoading: false });
      });

    return () => {
      active = false;
    };
  }, [load]);

  return state;
}
