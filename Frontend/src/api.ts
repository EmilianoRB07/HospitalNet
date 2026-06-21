// src/api.ts
// Wrapper de fetch que agrega el header Authorization en cada petición y
// fuerza el cierre de sesión si el backend responde 401 (token inválido,
// expirado o ausente). Reemplaza todas las llamadas directas a fetch()
// hacia el backend de HospitalNet.

export const BASE_URL = 'http://localhost:8000';

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('token');

  const headers: HeadersInit = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (response.status === 401) {
    localStorage.clear();
    alert('Tu sesión no es válida o expiró. Inicia sesión nuevamente.');
    window.location.reload();
    throw new Error('Sesión inválida (401)');
  }

  return response;
}
