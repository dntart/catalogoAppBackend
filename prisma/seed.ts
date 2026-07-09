import { Categoria, PrismaClient, Unidad } from '@prisma/client';

const prisma = new PrismaClient();

const COLORES_ESTANDAR = ['Beige', 'Camel', 'Rosa', 'Gris', 'Ábano', 'Chocolate', 'Mostaza', 'Negro', 'Aéreo', 'Azul'];

const PRODUCTOS = [
  'Zorro',
  'Ballena',
  'Burro',
  'Flamenco',
  'Flamenco Volador',
  'Liebre',
  'Vicuña',
  'Quirquincho',
  'Bolsa',
];

const OPERARIOS = ['María', 'Luján'];

async function upsertItem(
  nombre: string,
  categoria: Categoria,
  unidad: Unidad,
  colorNombre: string | null,
): Promise<void> {
  const existente = await prisma.item.findFirst({ where: { nombre, colorNombre } });
  if (existente) {
    return;
  }
  await prisma.item.create({
    data: {
      nombre,
      categoria,
      unidad,
      tieneColor: colorNombre !== null,
      colorNombre,
    },
  });
}

async function upsertOperario(nombre: string): Promise<void> {
  const existente = await prisma.operario.findFirst({ where: { nombre } });
  if (existente) {
    return;
  }
  await prisma.operario.create({ data: { nombre } });
}

async function main(): Promise<void> {
  for (const nombre of PRODUCTOS) {
    await upsertItem(nombre, Categoria.PRODUCTO, Unidad.UNIDAD, null);
  }

  for (const color of COLORES_ESTANDAR) {
    await upsertItem('Gabardina', Categoria.MATERIAL, Unidad.METRO, color);
    await upsertItem('Corderoy', Categoria.MATERIAL, Unidad.METRO, color);
    await upsertItem('Hilo Poliéster', Categoria.MATERIAL, Unidad.CONO, color);
  }
  await upsertItem('Hilo Poliéster', Categoria.MATERIAL, Unidad.CONO, 'Blanco');

  await upsertItem('Vellón', Categoria.MATERIAL, Unidad.KG, null);

  for (const nombre of OPERARIOS) {
    await upsertOperario(nombre);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
