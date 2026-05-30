/**
 * Base API module for AI-Finance frontend.
 */

// We can read from environment variables or default to localhost:8000 for local dev
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
export const API_KEY = import.meta.env.VITE_API_KEY || '';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  const headers = new Headers(options?.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (API_KEY && !headers.has('X-API-Key') && !headers.has('Authorization')) {
    headers.set('X-API-Key', API_KEY);
  }
  
  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Request Failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const result: ApiResponse<T> = await response.json();
  if (!result.success) {
    throw new Error(result.error || 'API Request Failed with unknown error');
  }

  return result.data as T;
}
