export interface ApiResult<T = Record<string, unknown>> {
  ok: boolean;
  status: number;
  data: T;
  error?: string;
}

export async function apiFetch<T = Record<string, unknown>>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(path, {
    credentials: 'include',
    ...options,
    headers,
  });

  let data = {} as T & { error?: string };
  try {
    data = await res.json();
  } catch {
    // Non-JSON response
  }

  return {
    ok: res.ok,
    status: res.status,
    data,
    error: data?.error || (!res.ok ? `Request failed (${res.status})` : undefined),
  };
}
