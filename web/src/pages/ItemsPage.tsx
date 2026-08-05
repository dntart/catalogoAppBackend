import { useEffect, useState, type FormEvent } from 'react';
import { createItem, fetchItems, fetchStockResumen } from '../lib/api';
import type { Categoria, Item, ResumenStockItem, Unidad } from '../lib/types';

const CATEGORIAS: Categoria[] = ['MATERIAL', 'PRODUCTO'];
const UNIDADES: Unidad[] = ['METRO', 'KG', 'CONO', 'UNIDAD'];

export function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [resumenPorItem, setResumenPorItem] = useState<Record<string, ResumenStockItem>>({});
  const [loading, setLoading] = useState(true);
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState<Categoria>('MATERIAL');
  const [unidad, setUnidad] = useState<Unidad>('METRO');
  const [tieneColor, setTieneColor] = useState(false);
  const [colorNombre, setColorNombre] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load(): void {
    setLoading(true);
    Promise.all([fetchItems(), fetchStockResumen()])
      .then(([itemsData, resumen]) => {
        setItems(itemsData);
        setResumenPorItem(Object.fromEntries(resumen.map((r) => [r.itemId, r])));
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createItem({
        nombre,
        categoria,
        unidad,
        tieneColor,
        colorNombre: tieneColor ? colorNombre : undefined,
      });
      setNombre('');
      setColorNombre('');
      setTieneColor(false);
      load();
    } catch {
      setError('No se pudo crear el item. Revisá los datos.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-lg font-semibold text-stone-800">Nuevo item</h2>
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-lg bg-white p-4 shadow-sm">
          <div>
            <label className="mb-1 block text-xs text-stone-500">Nombre</label>
            <input
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="rounded border border-stone-300 px-2 py-1.5"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-stone-500">Categoría</label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as Categoria)}
              className="rounded border border-stone-300 px-2 py-1.5"
            >
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-stone-500">Unidad</label>
            <select
              value={unidad}
              onChange={(e) => setUnidad(e.target.value as Unidad)}
              className="rounded border border-stone-300 px-2 py-1.5"
            >
              {UNIDADES.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 pb-1.5 text-sm text-stone-600">
            <input type="checkbox" checked={tieneColor} onChange={(e) => setTieneColor(e.target.checked)} />
            Tiene color
          </label>
          {tieneColor && (
            <div>
              <label className="mb-1 block text-xs text-stone-500">Color</label>
              <input
                required
                value={colorNombre}
                onChange={(e) => setColorNombre(e.target.value)}
                className="rounded border border-stone-300 px-2 py-1.5"
              />
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-stone-800 px-4 py-1.5 text-white hover:bg-stone-700 disabled:opacity-50"
          >
            Crear
          </button>
          {error && <p className="w-full text-sm text-red-600">{error}</p>}
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-stone-800">Catálogo</h2>
        {loading ? (
          <p className="text-stone-500">Cargando...</p>
        ) : (
          <div className="overflow-hidden rounded-lg bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-100 text-stone-600">
                <tr>
                  <th className="px-4 py-2">Código</th>
                  <th className="px-4 py-2">Nombre</th>
                  <th className="px-4 py-2">Categoría</th>
                  <th className="px-4 py-2">Unidad</th>
                  <th className="px-4 py-2">Color</th>
                  <th className="px-4 py-2">Stock</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const resumen = resumenPorItem[item.id];
                  return (
                    <tr key={item.id} className="border-t border-stone-100">
                      <td className="px-4 py-2 font-mono text-xs text-stone-500">{item.codigo}</td>
                      <td className="px-4 py-2">{item.nombre}</td>
                      <td className="px-4 py-2">{item.categoria}</td>
                      <td className="px-4 py-2">{item.unidad}</td>
                      <td className="px-4 py-2">{item.colorNombre ?? '—'}</td>
                      <td className="px-4 py-2 tabular-nums">
                        {resumen === undefined ? (
                          '—'
                        ) : resumen.bajoMinimo ? (
                          <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                            <span aria-hidden="true">⚠️</span>
                            {resumen.stock}
                          </span>
                        ) : (
                          resumen.stock
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
