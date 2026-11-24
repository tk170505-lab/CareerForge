const TOKEN_KEY = 'careerforge_token';

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch(path, options = {}) {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const isFormData = options.body instanceof FormData;
  if (!isFormData && options.body && typeof options.body === 'object' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, {
    ...options,
    headers,
    body: !isFormData && options.body && typeof options.body === 'object'
      ? JSON.stringify(options.body)
      : options.body,
  });

  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) {
    const errBody = contentType.includes('application/json') ? await response.json() : { error: await response.text() };
    throw new Error(errBody.error || `Request failed with status ${response.status}`);
  }

  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
}
