import { useState, useEffect, useCallback } from 'react';

/**
 * Reusable data fetching hook with loading, error, and refetch capabilities
 */
export const useFetch = (fetchFn, autoFetch = true) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState(null);

  const execute = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchFn(...args);
      setData(response.data);
      setLoading(false);
      return { success: true, data: response.data };
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Error fetching data';
      setError(errMsg);
      setLoading(false);
      return { success: false, error: errMsg };
    }
  }, [fetchFn]);

  useEffect(() => {
    if (autoFetch) {
      execute();
    }
  }, [autoFetch, execute]);

  return { data, loading, error, refetch: execute };
};
