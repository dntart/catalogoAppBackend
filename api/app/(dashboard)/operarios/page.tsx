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
        <h2 className="mb-3 text-lg font-semibold text-wa-text">Nuevo operario</h2>
        <form onSubmit={handleSubmit} className="flex items-end gap-3 rounded-lg bg-wa-bubble-in p-4 shadow-sm">
          <div>
            <label className="mb-1 block text-xs text-wa-text-light">Nombre</label>
            <input
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="rounded border border-wa-border px-2 py-1.5"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-wa-green px-4 py-1.5 text-white hover:brightness-95 disabled:opacity-50"
          >
            Crear
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-wa-text">Operarios</h2>
        {loading ? (
          <p className="text-wa-text-light">Cargando...</p>
        ) : (
          <div className="overflow-hidden rounded-lg bg-wa-bubble-in shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-wa-input-bg text-wa-text">
                <tr>
                  <th className="px-4 py-2">Nombre</th>
                  <th className="px-4 py-2">Activo</th>
                </tr>
              </thead>
              <tbody>
                {operarios.map((op) => (
                  <tr key={op.id} className="border-t border-wa-border">
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
