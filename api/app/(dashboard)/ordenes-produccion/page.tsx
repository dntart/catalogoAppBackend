'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { createOrdenProduccion, fetchOperarios, fetchOrdenesProduccion } from '../../../ui/api-client';
import type { Operario, OrdenProduccion } from '../../../ui/types';

export default function OrdenesProduccionPage() {
  const [ordenes, setOrdenes] = useState<OrdenProduccion[]>([]);
  const [operarios, setOperarios] = useState<Operario[]>([]);
  const [loading, setLoading] = useState(true);
  const [operarioId, setOperarioId] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function load(): void {
    setLoading(true);
    Promise.all([fetchOrdenesProduccion(), fetchOperarios()])
      .then(([ordenesData, operariosData]) => {
        setOrdenes(ordenesData);
        setOperarios(operariosData);
        if (!operarioId && operariosData.length > 0) {
          setOperarioId(operariosData[0].id);
        }
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function nombreOperario(id: string): string {
    return operarios.find((op) => op.id === id)?.nombre ?? id;
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!operarioId) return;
    setSubmitting(true);
    try {
      await createOrdenProduccion({ operarioId, observaciones: observaciones || undefined });
      setObservaciones('');
      load();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-lg font-semibold text-stone-800">Nueva entrega / orden de producción</h2>
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-lg bg-white p-4 shadow-sm">
          <div>
            <label className="mb-1 block text-xs text-stone-500">Operario</label>
            <select
              value={operarioId}
              onChange={(e) => setOperarioId(e.target.value)}
              className="rounded border border-stone-300 px-2 py-1.5"
            >
              {operarios.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[240px] flex-1">
            <label className="mb-1 block text-xs text-stone-500">Observaciones</label>
            <input
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Ej: 5m de gabardina beige para 10 Zorros"
              className="w-full rounded border border-stone-300 px-2 py-1.5"
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !operarioId}
            className="rounded bg-stone-800 px-4 py-1.5 text-white hover:bg-stone-700 disabled:opacity-50"
          >
            Abrir orden
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-stone-800">Órdenes de producción</h2>
        {loading ? (
          <p className="text-stone-500">Cargando...</p>
        ) : (
          <div className="overflow-hidden rounded-lg bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-100 text-stone-600">
                <tr>
                  <th className="px-4 py-2">Fecha</th>
                  <th className="px-4 py-2">Operario</th>
                  <th className="px-4 py-2">Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {ordenes.map((orden) => (
                  <tr key={orden.id} className="border-t border-stone-100">
                    <td className="px-4 py-2">{new Date(orden.fecha).toLocaleString()}</td>
                    <td className="px-4 py-2">{nombreOperario(orden.operarioId)}</td>
                    <td className="px-4 py-2">{orden.observaciones ?? '—'}</td>
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
