import { useEffect, useMemo, useState } from 'react';
import { fetchStockResumen } from '../lib/api';
import type { ResumenStockItem } from '../lib/types';

const COLOR_MATERIAL = '#2a78d6'; // sequential blue — categorical slot 1
const COLOR_PRODUCTO = '#eb6834'; // sequential orange — categorical slot 2
const COLOR_WARNING = '#fab219';
const COLOR_CRITICAL = '#d03b3b';
const COLOR_TRACK = '#e1e0d9';

function estadoDe(item: ResumenStockItem): { color: string; etiqueta: string | null } {
  if (item.stock <= 0) return { color: COLOR_CRITICAL, etiqueta: 'Sin stock' };
  if (item.bajoMinimo) return { color: COLOR_WARNING, etiqueta: 'Bajo mínimo' };
  return { color: '', etiqueta: null };
}

function BarraStock({ item, colorNormal, max }: { item: ResumenStockItem; colorNormal: string; max: number }) {
  const { color, etiqueta } = estadoDe(item);
  const fill = color || colorNormal;
  const pct = max > 0 ? Math.max((item.stock / max) * 100, item.stock > 0 ? 2 : 0) : 0;

  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-40 shrink-0 truncate text-sm text-stone-700" title={item.nombre}>
        {item.nombre}
      </div>
      <div className="h-5 flex-1 overflow-hidden rounded-sm" style={{ backgroundColor: COLOR_TRACK }}>
        <div
          className="h-full rounded-r"
          style={{ width: `${pct}%`, backgroundColor: fill }}
        />
      </div>
      <div className="w-24 shrink-0 text-right text-sm tabular-nums text-stone-800">
        {item.stock} {item.unidad.toLowerCase()}
      </div>
      <div className="w-28 shrink-0 text-xs">
        {etiqueta && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium"
            style={{ backgroundColor: `${fill}1a`, color: fill }}
          >
            <span aria-hidden="true">{item.stock <= 0 ? '⛔' : '⚠️'}</span>
            {etiqueta}
          </span>
        )}
      </div>
    </div>
  );
}

function SeccionStock({
  titulo,
  items,
  colorNormal,
}: {
  titulo: string;
  items: ResumenStockItem[];
  colorNormal: string;
}) {
  const max = useMemo(() => Math.max(...items.map((i) => i.stock), 1), [items]);
  const alertas = items.filter((i) => i.bajoMinimo || i.stock <= 0).length;

  return (
    <section className="rounded-lg bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-stone-800">{titulo}</h2>
        <span className="text-sm text-stone-500">
          {items.length} items{alertas > 0 && <> · <span className="font-medium text-amber-700">{alertas} con alerta</span></>}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-stone-500">No hay items cargados en esta categoría.</p>
      ) : (
        <div>
          {items.map((item) => (
            <BarraStock key={item.itemId} item={item} colorNormal={colorNormal} max={max} />
          ))}
        </div>
      )}
    </section>
  );
}

export function ResumenPage() {
  const [resumen, setResumen] = useState<ResumenStockItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStockResumen()
      .then(setResumen)
      .finally(() => setLoading(false));
  }, []);

  const materiales = useMemo(
    () =>
      resumen
        .filter((i) => i.categoria === 'MATERIAL')
        .sort((a, b) => a.stock - b.stock),
    [resumen],
  );
  const productos = useMemo(
    () =>
      resumen
        .filter((i) => i.categoria === 'PRODUCTO')
        .sort((a, b) => a.stock - b.stock),
    [resumen],
  );

  if (loading) {
    return <p className="text-stone-500">Cargando...</p>;
  }

  return (
    <div className="space-y-6">
      <SeccionStock titulo="Materiales" items={materiales} colorNormal={COLOR_MATERIAL} />
      <SeccionStock titulo="Productos" items={productos} colorNormal={COLOR_PRODUCTO} />
    </div>
  );
}
