'use client';

import { useEffect, useState, type FormEvent } from 'react';
import axios from 'axios';
import {
  createMovimiento,
  fetchItems,
  fetchMovimientos,
  fetchOperarios,
  fetchOrdenesProduccion,
} from '../../../ui/api-client';
import type { Item, Movimiento, MovimientoTipo, Operario, OrdenProduccion } from '../../../ui/types';

const TIPOS: MovimientoTipo[] = ['COMPRA', 'CONSUMO', 'PRODUCCION', 'VENTA', 'AJUSTE'];

export default function MovimientosPage() {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [operarios, setOperarios] = useState<Operario[]>([]);
  const [ordenes, setOrdenes] = useState<OrdenProduccion[]>([]);
  const [loading, setLoading] = useState(true);

  const [itemId, setItemId] = useState('');
  const [tipo, setTipo] = useState<MovimientoTipo>('COMPRA');
  const [cantidad, setCantidad] = useState('');
  const [operarioId, setOperarioId] = useState('');
  const [ordenProduccionId, setOrdenProduccionId] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load(): void {
    setLoading(true);
    Promise.all([fetchMovimientos(), fetchItems(), fetchOperarios(), fetchOrdenesProduccion()])
      .then(([movimientosData, itemsData, operariosData, ordenesData]) => {
        setMovimientos(movimientosData);
        setItems(itemsData);
        setOperarios(operariosData);
        setOrdenes(ordenesData);
        if (!itemId && itemsData.length > 0) {
          setItemId(itemsData[0].id);
        }
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function nombreItem(id: string): string {
    const item = items.find((i) => i.id === id);
    if (!item) return id;
    return item.colorNombre ? `${item.nombre} ${item.colorNombre}` : item.nombre;
  }

  function opcionItem(item: Item): string {
    const nombreCompleto = item.colorNombre ? `${item.nombre} ${item.colorNombre}` : item.nombre;
    return `${item.codigo} · ${nombreCompleto}`;
  }

  function nombreOperario(id: string | null): string {
    if (!id) return '—';
    return operarios.find((op) => op.id === id)?.nombre ?? id;
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    if (!itemId || !cantidad) return;
    setSubmitting(true);
    try {
      await createMovimiento({
        itemId,
        tipo,
        cantidad: Number(cantidad),
        operarioId: ordenProduccionId ? undefined : operarioId || undefined,
        ordenProduccionId: ordenProduccionId || undefined,
        observaciones: observaciones || undefined,
      });
      setCantidad('');
      setObservaciones('');
      load();
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && typeof err.response?.data?.message === 'string') {
        setError(err.response.data.message);
      } else {
        setError('No se pudo registrar el movimiento');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-lg font-semibold text-wa-text">Nuevo movimiento</h2>
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-lg bg-wa-bubble-in p-4 shadow-sm">
          <div>
            <label className="mb-1 block text-xs text-wa-text-light">Item</label>
            <select
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              className="rounded border border-wa-border px-2 py-1.5"
            >
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {opcionItem(item)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-wa-text-light">Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as MovimientoTipo)}
              className="rounded border border-wa-border px-2 py-1.5"
            >
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-wa-text-light">Cantidad</label>
            <input
              required
              type="number"
              step="0.01"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className="w-28 rounded border border-wa-border px-2 py-1.5"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-wa-text-light">Orden de producción</label>
            <select
              value={ordenProduccionId}
              onChange={(e) => setOrdenProduccionId(e.target.value)}
              className="rounded border border-wa-border px-2 py-1.5"
            >
              <option value="">— ninguna —</option>
              {ordenes.map((orden) => (
                <option key={orden.id} value={orden.id}>
                  {new Date(orden.fecha).toLocaleDateString()} · {nombreOperario(orden.operarioId)}
                </option>
              ))}
            </select>
          </div>
          {!ordenProduccionId && (
            <div>
              <label className="mb-1 block text-xs text-wa-text-light">Operario</label>
              <select
                value={operarioId}
                onChange={(e) => setOperarioId(e.target.value)}
                className="rounded border border-wa-border px-2 py-1.5"
              >
                <option value="">— ninguno —</option>
                {operarios.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs text-wa-text-light">Observaciones</label>
            <input
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="w-full rounded border border-wa-border px-2 py-1.5"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-wa-green px-4 py-1.5 text-white hover:brightness-95 disabled:opacity-50"
          >
            Registrar
          </button>
          {error && <p className="w-full text-sm text-red-600">{error}</p>}
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-wa-text">Movimientos</h2>
        {loading ? (
          <p className="text-wa-text-light">Cargando...</p>
        ) : (
          <div className="overflow-hidden rounded-lg bg-wa-bubble-in shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-wa-input-bg text-wa-text">
                <tr>
                  <th className="px-4 py-2">Fecha</th>
                  <th className="px-4 py-2">Item</th>
                  <th className="px-4 py-2">Tipo</th>
                  <th className="px-4 py-2">Cantidad</th>
                  <th className="px-4 py-2">Operario</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((mov) => (
                  <tr key={mov.id} className="border-t border-wa-border">
                    <td className="px-4 py-2">{new Date(mov.fecha).toLocaleString()}</td>
                    <td className="px-4 py-2">{nombreItem(mov.itemId)}</td>
                    <td className="px-4 py-2">{mov.tipo}</td>
                    <td className="px-4 py-2">{mov.cantidad}</td>
                    <td className="px-4 py-2">{nombreOperario(mov.operarioId)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
