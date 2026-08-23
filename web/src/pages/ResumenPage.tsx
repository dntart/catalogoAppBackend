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

function contarAlertas(items: ResumenStockItem[]): number {
  return items.filter((i) => i.bajoMinimo || i.stock <= 0).length;
}

// --- Árbol grupo -> nombreBase -> variantes de color, con auto-colapso de
// niveles que solo tienen un elemento (no tiene sentido un header "Zorro"
// para un solo item).
interface NodoNombre {
  tipo: 'nombre';
  clave: string;
  nombreBase: string;
  items: ResumenStockItem[];
}
interface NodoGrupo {
  tipo: 'grupo';
  clave: string;
  grupo: string;
  nombres: NodoNombre[];
}
type Nodo = NodoGrupo | NodoNombre;

function construirArbol(items: ResumenStockItem[]): Nodo[] {
  const porGrupo = new Map<string | null, Map<string, ResumenStockItem[]>>();
  for (const item of items) {
    const grupoKey = item.grupo ?? null;
    if (!porGrupo.has(grupoKey)) porGrupo.set(grupoKey, new Map());
    const porNombre = porGrupo.get(grupoKey)!;
    if (!porNombre.has(item.nombreBase)) porNombre.set(item.nombreBase, []);
    porNombre.get(item.nombreBase)!.push(item);
  }

  const nodos: Nodo[] = [];
  const gruposOrdenados = [...porGrupo.entries()]
    .filter((entry): entry is [string, Map<string, ResumenStockItem[]>] => entry[0] !== null)
    .sort((a, b) => a[0].localeCompare(b[0]));

  for (const [grupo, porNombre] of gruposOrdenados) {
    const nombres = [...porNombre.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([nombreBase, items]) => ({
        tipo: 'nombre' as const,
        clave: `${grupo}::${nombreBase}`,
        nombreBase,
        items,
      }));
    nodos.push({ tipo: 'grupo', clave: grupo, grupo, nombres });
  }

  const sinGrupo = porGrupo.get(null);
  if (sinGrupo) {
    for (const [nombreBase, items] of [...sinGrupo.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      nodos.push({ tipo: 'nombre', clave: nombreBase, nombreBase, items });
    }
  }
  return nodos;
}

function BarraStock({ item, colorNormal, max }: { item: ResumenStockItem; colorNormal: string; max: number }) {
  const { color, etiqueta } = estadoDe(item);
  const fill = color || colorNormal;
  const pct = max > 0 ? Math.max((item.stock / max) * 100, item.stock > 0 ? 2 : 0) : 0;

  return (
    <div className="flex items-center gap-3 py-1.5 pl-2">
      <div className="w-48 shrink-0 text-sm leading-snug text-stone-700">
        <span className="font-mono text-xs text-stone-400">{item.codigo}</span> {item.nombre}
      </div>
      <div className="h-5 flex-1 overflow-hidden rounded-sm" style={{ backgroundColor: COLOR_TRACK }}>
        <div className="h-full rounded-r" style={{ width: `${pct}%`, backgroundColor: fill }} />
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

function EncabezadoColapsable({
  etiqueta,
  cantidad,
  alertas,
  expandido,
  onToggle,
  indent,
}: {
  etiqueta: string;
  cantidad: number;
  alertas: number;
  expandido: boolean;
  onToggle: () => void;
  indent: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      className={`flex w-full items-center gap-2 rounded py-1.5 text-left hover:bg-stone-50 ${indent ? 'pl-6' : ''}`}
    >
      <span className="text-stone-400">{expandido ? '▾' : '▸'}</span>
      <span className="text-sm font-medium text-stone-800">{etiqueta}</span>
      <span className="text-xs text-stone-500">
        {cantidad} {cantidad === 1 ? 'variante' : 'variantes'}
        {alertas > 0 && (
          <>
            {' · '}
            <span className="font-medium text-amber-700">{alertas} con alerta</span>
          </>
        )}
      </span>
    </button>
  );
}

function NombreNodo({
  nodo,
  colorNormal,
  max,
  expandidos,
  onToggle,
  indent,
}: {
  nodo: NodoNombre;
  colorNormal: string;
  max: number;
  expandidos: Set<string>;
  onToggle: (clave: string) => void;
  indent: boolean;
}) {
  if (nodo.items.length === 1) {
    return <BarraStock item={nodo.items[0]} colorNormal={colorNormal} max={max} />;
  }
  const expandido = expandidos.has(nodo.clave);
  return (
    <div>
      <EncabezadoColapsable
        etiqueta={nodo.nombreBase}
        cantidad={nodo.items.length}
        alertas={contarAlertas(nodo.items)}
        expandido={expandido}
        onToggle={() => onToggle(nodo.clave)}
        indent={indent}
      />
      {expandido && (
        <div className={indent ? 'pl-6' : ''}>
          {nodo.items.map((item) => (
            <BarraStock key={item.itemId} item={item} colorNormal={colorNormal} max={max} />
          ))}
        </div>
      )}
    </div>
  );
}

function SeccionStock({
  titulo,
  items,
  colorNormal,
  expandidos,
  onToggle,
}: {
  titulo: string;
  items: ResumenStockItem[];
  colorNormal: string;
  expandidos: Set<string>;
  onToggle: (clave: string) => void;
}) {
  const max = useMemo(() => Math.max(...items.map((i) => i.stock), 1), [items]);
  const alertas = contarAlertas(items);
  const arbol = useMemo(() => construirArbol(items), [items]);

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
          {arbol.map((nodo) =>
            nodo.tipo === 'grupo' ? (
              <div key={nodo.clave}>
                <EncabezadoColapsable
                  etiqueta={nodo.grupo}
                  cantidad={nodo.nombres.reduce((n, x) => n + x.items.length, 0)}
                  alertas={contarAlertas(nodo.nombres.flatMap((x) => x.items))}
                  expandido={expandidos.has(nodo.clave)}
                  onToggle={() => onToggle(nodo.clave)}
                  indent={false}
                />
                {expandidos.has(nodo.clave) && (
                  <div className="pl-4">
                    {nodo.nombres.map((sub) => (
                      <NombreNodo
                        key={sub.clave}
                        nodo={sub}
                        colorNormal={colorNormal}
                        max={max}
                        expandidos={expandidos}
                        onToggle={onToggle}
                        indent
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <NombreNodo
                key={nodo.clave}
                nodo={nodo}
                colorNormal={colorNormal}
                max={max}
                expandidos={expandidos}
                onToggle={onToggle}
                indent={false}
              />
            ),
          )}
        </div>
      )}
    </section>
  );
}

function coincide(item: ResumenStockItem, termino: string): boolean {
  const t = termino.toLowerCase();
  return (
    item.nombre.toLowerCase().includes(t) ||
    item.codigo.toLowerCase().includes(t) ||
    (item.grupo?.toLowerCase().includes(t) ?? false)
  );
}

export function ResumenPage() {
  const [resumen, setResumen] = useState<ResumenStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchStockResumen()
      .then(setResumen)
      .finally(() => setLoading(false));
  }, []);

  function toggle(clave: string): void {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(clave)) next.delete(clave);
      else next.add(clave);
      return next;
    });
  }

  const filtrado = useMemo(
    () => (busqueda.trim() ? resumen.filter((i) => coincide(i, busqueda.trim())) : resumen),
    [resumen, busqueda],
  );

  // Con búsqueda activa, expandimos todo lo que matchea para no obligar a
  // abrir grupo por grupo algo que el usuario ya pidió ver puntualmente.
  const expandidosEfectivos = useMemo(() => {
    if (!busqueda.trim()) return expandidos;
    const todasLasClaves = new Set<string>();
    for (const item of filtrado) {
      if (item.grupo) todasLasClaves.add(item.grupo);
      todasLasClaves.add(item.grupo ? `${item.grupo}::${item.nombreBase}` : item.nombreBase);
    }
    return todasLasClaves;
  }, [busqueda, filtrado, expandidos]);

  const materiales = useMemo(
    () => filtrado.filter((i) => i.categoria === 'MATERIAL').sort((a, b) => a.stock - b.stock),
    [filtrado],
  );
  const productos = useMemo(
    () => filtrado.filter((i) => i.categoria === 'PRODUCTO').sort((a, b) => a.stock - b.stock),
    [filtrado],
  );

  if (loading) {
    return <p className="text-stone-500">Cargando...</p>;
  }

  return (
    <div className="space-y-6">
      <input
        type="search"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre, código o grupo..."
        className="w-full rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm shadow-sm focus:border-stone-500 focus:outline-none"
      />
      <SeccionStock
        titulo="Materiales"
        items={materiales}
        colorNormal={COLOR_MATERIAL}
        expandidos={expandidosEfectivos}
        onToggle={toggle}
      />
      <SeccionStock
        titulo="Productos"
        items={productos}
        colorNormal={COLOR_PRODUCTO}
        expandidos={expandidosEfectivos}
        onToggle={toggle}
      />
    </div>
  );
}
