import {
  fmtFechaCorta,
  fmtFechaLarga,
  fmtMesLargo,
  rangoHoy,
  rangoMesActual,
  rangoUltimosDias,
} from './fechas';

// 15 de marzo de 2026, 23:30 UTC = 20:30 en Argentina (UTC-3) — mismo día
// calendario en ambas zonas, para no complicar el fixture.
const AHORA_UTC = new Date('2026-03-15T23:30:00.000Z');

describe('fechas (huso horario Argentina, no UTC)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(AHORA_UTC);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('rangoHoy va de las 03:00 UTC de hoy a las 03:00 UTC de mañana (medianoche a medianoche en Argentina)', () => {
    const { desde, hasta } = rangoHoy();
    expect(desde.toISOString()).toBe('2026-03-15T03:00:00.000Z');
    expect(hasta.toISOString()).toBe('2026-03-16T03:00:00.000Z');
  });

  it('rangoUltimosDias(7) resta 7 dias completos desde el fin de hoy', () => {
    const { desde, hasta } = rangoUltimosDias(7);
    expect(hasta.toISOString()).toBe('2026-03-16T03:00:00.000Z');
    expect(desde.toISOString()).toBe('2026-03-09T03:00:00.000Z');
  });

  it('rangoMesActual arranca el dia 1 del mes en curso (hora Argentina)', () => {
    const { desde, hasta } = rangoMesActual();
    expect(desde.toISOString()).toBe('2026-03-01T03:00:00.000Z');
    expect(hasta.toISOString()).toBe('2026-03-16T03:00:00.000Z');
  });

  it('un instante cerca de medianoche UTC cae en el dia correcto de Argentina', () => {
    // 00:30 UTC del 16/3 son las 21:30 del 15/3 en Argentina.
    jest.setSystemTime(new Date('2026-03-16T00:30:00.000Z'));
    const { desde } = rangoHoy();
    expect(desde.toISOString()).toBe('2026-03-15T03:00:00.000Z');
  });
});

describe('formato de fechas en es-AR', () => {
  it('fmtFechaCorta es dd/mm', () => {
    expect(fmtFechaCorta(new Date('2026-03-05T12:00:00.000Z'))).toBe('05/03');
  });

  it('fmtFechaLarga incluye dia, mes y año, con mayuscula inicial', () => {
    const texto = fmtFechaLarga(new Date('2026-03-05T12:00:00.000Z'));
    expect(texto).toMatch(/^\d+ de marzo de 2026$/);
  });

  it('fmtMesLargo incluye mes y año, con mayuscula inicial', () => {
    const texto = fmtMesLargo(new Date('2026-03-05T12:00:00.000Z'));
    expect(texto).toBe('Marzo de 2026');
  });
});
