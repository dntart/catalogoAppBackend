import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { createItem, fetchItems, fetchStockResumen } from '../lib/api';
import type { Categoria, Item, ResumenStockItem, Unidad } from '../lib/types';

const CATEGORIAS: Categoria[] = ['MATERIAL', 'PRODUCTO'];
const UNIDADES: Unidad[] = ['METRO', 'KG', 'CONO', 'UNIDAD'];

export function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [resumenPorItem, setResumenPorItem] = useState<Record<string, ResumenStockItem>>({});
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [grupo, setGrupo] = useState('');
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
        grupo: grupo.trim() || undefined,
        nombre,
        categoria,
        unidad,
        tieneColor,
        colorNombre: tieneColor ? colorNombre : undefined,
      });
      setGrupo('');
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

  const itemsFiltrados = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    if (!t) return items;
    return items.filter(
      (item) =>
        item.nombre.toLowerCase().includes(t) ||
        item.codigo.toLowerCase().includes(t) ||
        (item.grupo?.toLowerCase().includes(t) ?? false) ||
        (item.colorNombre?.toLowerCase().includes(t) ?? false),
    );
  }, [items, busqueda]);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-lg font-semibold text-stone-800">Nuevo item</h2>
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-lg bg-white p-4 shadow-sm">
          <div>
            <label className="mb-1 block text-xs text-stone-500">
              Grupo <span className="text-stone-400">(opcional, ej: Hilo)</span>
            </label>
            <input
              value={grupo}
              onChange={(e) => setGrupo(e.target.value)}
              className="rounded border border-stone-300 px-2 py-1.5"
            />
          </div>
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
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-stone-800">Catálogo</h2>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, código, grupo o color..."
            className="w-72 rounded border border-stone-300 px-3 py-1.5 text-sm focus:border-stone-500 focus:outline-none"
          />
        </div>
        {loading ? (
          <p className="text-stone-500">Cargando...</p>
        ) : (
          <div className="overflow-hidden rounded-lg bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-100 text-stone-600">
                <tr>
                  <th className="px-4 py-2">Código</th>
                  <th className="px-4 py-2">Grupo</th>
                  <th className="px-4 py-2">Nombre</th>
                  <th className="px-4 py-2">Categoría</th>
                  <th className="px-4 py-2">Unidad</th>
                  <th className="px-4 py-2">Color</th>
                  <th className="px-4 py-2">Stock</th>
                  <th className="px-4 py-2">Alta</th>
                </tr>
              </thead>
              <tbody>
                {itemsFiltrados.map((item) => {
                  const resumen = resumenPorItem[item.id];
                  return (
                    <tr key={item.id} className="border-t border-stone-100">
                      <td className="px-4 py-2 font-mono text-xs text-stone-500">{item.codigo}</td>
                      <td className="px-4 py-2 text-stone-500">{item.grupo ?? '—'}</td>
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
                      <td className="px-4 py-2 text-stone-500">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
                {itemsFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-stone-500">
                      Ningún item coincide con "{busqueda}".
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
