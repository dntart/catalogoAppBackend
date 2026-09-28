/// Parsers de texto libre del bot de WhatsApp — extraídos de conversation.service.ts
/// para poder testearlos por separado. Portados del prototipo validado
/// (artifact Fauna de Tela V16), que ya resolvió el caso de formato argentino
/// que el parser anterior (`texto.replace(',', '.')`) no manejaba: "15.000"
/// (quince mil, punto de miles) se leía como 15.

/// "2,5" y "2.5" son 2.5. Devuelve null si no es un número positivo válido.
export function parsePositiveNumber(
  raw: string,
  options: { integer?: boolean } = {},
): number | null {
  const normalizado = String(raw).trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalizado)) return null;
  const valor = Number(normalizado);
  if (valor <= 0 || (options.integer && !Number.isInteger(valor))) return null;
  return valor;
}

/// Formato argentino de dinero: "15.000", "$ 15.000,50" y "15000" son todos
/// válidos. Si hay coma, es el separador decimal (y los puntos son de miles,
/// se descartan). Si no hay coma pero el texto matchea el patrón de miles
/// (grupos de exactamente 3 dígitos separados por punto), los puntos también
/// son de miles. Si no, se interpreta como número simple.
export function parsePrice(raw: string): number | null {
  let texto = String(raw).replace(/[$\s]/g, '');
  if (texto.includes(',')) {
    texto = texto.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(texto)) {
    texto = texto.replace(/\./g, '');
  }
  return parsePositiveNumber(texto);
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
