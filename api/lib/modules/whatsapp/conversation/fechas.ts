/// Rangos de fecha para los reportes, calculados en el huso horario del
/// negocio (Argentina), no en UTC (donde corren las funciones de Vercel).
/// Argentina no tiene horario de verano desde 2009 — UTC-3 es fijo, así que
/// no hace falta una librería de zonas horarias para esto.
const ARG_OFFSET_HORAS = 3;
const ZONA_ARG = 'America/Argentina/Buenos_Aires';

function hoyEnArgentina(): { anio: number; mes: number; dia: number } {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_ARG,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const obtener = (tipo: string) =>
    Number(partes.find((p) => p.type === tipo)!.value);
  return { anio: obtener('year'), mes: obtener('month'), dia: obtener('day') };
}

/// Medianoche de esa fecha en Argentina, expresada como el instante UTC
/// equivalente (para usar directo en `fecha: { gte, lt }` de Prisma).
function inicioDeDiaArgUTC(anio: number, mes: number, dia: number): Date {
  return new Date(Date.UTC(anio, mes - 1, dia, ARG_OFFSET_HORAS, 0, 0));
}

export interface RangoFechas {
  desde: Date;
  hasta: Date;
}

export function rangoHoy(): RangoFechas {
  const { anio, mes, dia } = hoyEnArgentina();
  const desde = inicioDeDiaArgUTC(anio, mes, dia);
  const hasta = new Date(desde.getTime() + 24 * 3600 * 1000);
  return { desde, hasta };
}

/// Últimos `dias` completos, terminando al final de hoy (hoy incluido).
export function rangoUltimosDias(dias: number): RangoFechas {
  const { hasta } = rangoHoy();
  const desde = new Date(hasta.getTime() - dias * 24 * 3600 * 1000);
  return { desde, hasta };
}

export function rangoMesActual(): RangoFechas {
  const { anio, mes } = hoyEnArgentina();
  const desde = inicioDeDiaArgUTC(anio, mes, 1);
  const { hasta } = rangoHoy();
  return { desde, hasta };
}

export function fmtFechaCorta(fecha: Date): string {
  // Intl con '2-digit' no garantiza el cero a la izquierda en todos los
  // entornos (Node ICU) — se arma a mano para que "05/03" sea siempre así.
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_ARG,
    day: '2-digit',
    month: '2-digit',
  }).formatToParts(fecha);
  const obtener = (tipo: string) => partes.find((p) => p.type === tipo)!.value;
  return `${obtener('day')}/${obtener('month')}`;
}

export function fmtFechaLarga(fecha: Date): string {
  const texto = new Intl.DateTimeFormat('es-AR', {
    timeZone: ZONA_ARG,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(fecha);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function fmtMesLargo(fecha: Date): string {
  const texto = new Intl.DateTimeFormat('es-AR', {
    timeZone: ZONA_ARG,
    month: 'long',
    year: 'numeric',
  }).format(fecha);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
