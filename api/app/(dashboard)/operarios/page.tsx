'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { createOperario, fetchOperarios } from '../../../ui/api-client';
import type { Operario } from '../../../ui/types';

export default function OperariosPage() {
  const [operarios, setOperarios] = useState<Operario[]>([]);
  const [loading, setLoading] = useState(true);
  const [nombre, setNombre] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function load(): void {
    setLoading(true);
    fetchOperarios()
      .then(setOperarios)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    try {
      await createOperario(nombre);
      setNombre('');
      load();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-lg font-semibold text-stone-800">Nuevo operario</h2>
        <form onSubmit={handleSubmit} className="flex items-end gap-3 rounded-lg bg-white p-4 shadow-sm">
          <div>
            <label className="mb-1 block text-xs text-stone-500">Nombre</label>
            <input
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="rounded border border-stone-300 px-2 py-1.5"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-stone-800 px-4 py-1.5 text-white hover:bg-stone-700 disabled:opacity-50"
          >
            Crear
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-stone-800">Operarios</h2>
        {loading ? (
          <p className="text-stone-500">Cargando...</p>
        ) : (
          <div className="overflow-hidden rounded-lg bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-100 text-stone-600">
                <tr>
                  <th className="px-4 py-2">Nombre</th>
                  <th className="px-4 py-2">Activo</th>
                </tr>
              </thead>
              <tbody>
                {operarios.map((op) => (
                  <tr key={op.id} className="border-t border-stone-100">
                    <td className="px-4 py-2">{op.nombre}</td>
                    <td className="px-4 py-2">{op.activo ? 'Sí' : 'No'}</td>
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
