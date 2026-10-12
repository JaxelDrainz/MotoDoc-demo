export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  { method = 'GET', body }: { method?: string; body?: unknown } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers:
        body !== undefined ? { 'Content-Type': 'application/json', 'X-MotoDoc-Request': '1' } : {},
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new ApiError('MotoDoc could not connect. Please try again.', 0);
  }
  const data = await response.json().catch(() => ({ error: 'The MotoDoc server is unavailable.' }));
  if (!response.ok) throw new ApiError(data.error || 'Something went wrong.', response.status);
  return data as T;
}
