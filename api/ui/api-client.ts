'use client';

import axios from 'axios';
import type {
  Categoria,
  Item,
  Movimiento,
  NegocioConUsuarios,
  Operario,
  OrdenProduccion,
  ResumenStockItem,
  AuthenticatedUser,
  UsuarioResumen,
} from './types';

const TOKEN_KEY = 'textilstock_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// Mismo origen que el resto de la app (frontend y backend viven en el mismo
// proyecto de Vercel) — antes esto era una URL absoluta a otro dominio
// (VITE_API_URL) y hacía falta CORS; ahora es una ruta relativa nomás.
export const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      clearToken();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export async function login(email: string, password: string): Promise<string> {
  const { data } = await api.post<{ accessToken: string }>('/auth/login', { email, password });
  return data.accessToken;
}

export async function fetchMe(): Promise<AuthenticatedUser> {
  const { data } = await api.get<AuthenticatedUser>('/auth/me');
  return data;
}

export interface RegistroNegocioPayload {
  nombreNegocio: string;
  ownerNombre: string;
  ownerEmail: string;
  ownerPassword: string;
  ownerWhatsappNumber?: string;
}

export async function registrarNegocio(payload: RegistroNegocioPayload): Promise<void> {
  await api.post('/negocios/registro', payload);
}

export async function fetchItems(): Promise<Item[]> {
  const { data } = await api.get<Item[]>('/items');
  return data;
}

export async function createItem(payload: Partial<Item>): Promise<Item> {
  const { data } = await api.post<Item>('/items', payload);
  return data;
}

export async function fetchStockResumen(categoria?: Categoria): Promise<ResumenStockItem[]> {
  const { data } = await api.get<ResumenStockItem[]>('/stock', {
    params: categoria ? { categoria } : undefined,
  });
  return data;
}

export async function fetchOperarios(): Promise<Operario[]> {
  const { data } = await api.get<Operario[]>('/operarios');
  return data;
}

export async function createOperario(nombre: string): Promise<Operario> {
  const { data } = await api.post<Operario>('/operarios', { nombre });
  return data;
}

export async function fetchOrdenesProduccion(): Promise<OrdenProduccion[]> {
  const { data } = await api.get<OrdenProduccion[]>('/ordenes-produccion');
  return data;
}

export async function createOrdenProduccion(payload: {
  operarioId: string;
  observaciones?: string;
}): Promise<OrdenProduccion> {
  const { data } = await api.post<OrdenProduccion>('/ordenes-produccion', payload);
  return data;
}

export async function fetchMovimientos(): Promise<Movimiento[]> {
  const { data } = await api.get<Movimiento[]>('/movimientos');
  return data;
}

export async function createMovimiento(payload: {
  itemId: string;
  operarioId?: string;
  ordenProduccionId?: string;
  tipo: string;
  cantidad: number;
  observaciones?: string;
}): Promise<Movimiento> {
  const { data } = await api.post<Movimiento>('/movimientos', payload);
  return data;
}

// --- Panel de super-admin: listado y edición de talleres ---

export async function fetchAdminNegocios(): Promise<NegocioConUsuarios[]> {
  const { data } = await api.get<NegocioConUsuarios[]>('/admin/negocios');
  return data;
}

export async function updateAdminNegocio(
  id: string,
  payload: { nombre?: string; activo?: boolean },
): Promise<void> {
  await api.patch(`/admin/negocios/${id}`, payload);
}

export async function updateAdminUsuario(
  id: string,
  payload: { email?: string; whatsappNumber?: string; activo?: boolean },
): Promise<UsuarioResumen> {
  const { data } = await api.patch<UsuarioResumen>(`/admin/users/${id}`, payload);
  return data;
}
