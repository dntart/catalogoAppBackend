import { parsePositiveNumber, parsePrice, pluralize } from './parsing';

describe('parsePositiveNumber', () => {
  it('acepta coma como separador decimal', () => {
    expect(parsePositiveNumber('2,5')).toBe(2.5);
  });

  it('acepta punto como separador decimal', () => {
    expect(parsePositiveNumber('2.5')).toBe(2.5);
  });

  it('acepta enteros', () => {
    expect(parsePositiveNumber('10')).toBe(10);
  });

  it('rechaza cero, negativos y no numéricos', () => {
    expect(parsePositiveNumber('0')).toBeNull();
    expect(parsePositiveNumber('-5')).toBeNull();
    expect(parsePositiveNumber('abc')).toBeNull();
    expect(parsePositiveNumber('')).toBeNull();
  });

  it('con integer:true rechaza decimales', () => {
    expect(parsePositiveNumber('2.5', { integer: true })).toBeNull();
    expect(parsePositiveNumber('3', { integer: true })).toBe(3);
  });
});

describe('parsePrice', () => {
  it('bug ya resuelto: "15.000" (formato argentino) es quince mil, no quince', () => {
    expect(parsePrice('15.000')).toBe(15000);
  });

  it('interpreta punto de miles + coma decimal', () => {
    expect(parsePrice('15.000,50')).toBe(15000.5);
  });

  it('ignora el símbolo $ y espacios', () => {
    expect(parsePrice('$ 15.000')).toBe(15000);
  });

  it('numero simple sin separadores', () => {
    expect(parsePrice('15000')).toBe(15000);
  });

  it('coma sola como decimal (sin miles)', () => {
    expect(parsePrice('150,5')).toBe(150.5);
  });

  it('rechaza valores inválidos', () => {
    expect(parsePrice('abc')).toBeNull();
    expect(parsePrice('-100')).toBeNull();
  });
});

describe('pluralize', () => {
  it('singular para 1', () => {
    expect(pluralize(1, 'unidad', 'unidades')).toBe('1 unidad');
  });

  it('plural para 0 y para más de 1', () => {
    expect(pluralize(0, 'unidad', 'unidades')).toBe('0 unidades');
    expect(pluralize(2, 'unidad', 'unidades')).toBe('2 unidades');
  });
});
