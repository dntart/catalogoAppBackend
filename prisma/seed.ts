import * as bcrypt from 'bcrypt';
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
  negocioId: string,
  nombre: string,
  categoria: Categoria,
  unidad: Unidad,
  colorNombre: string | null,
): Promise<void> {
  const existente = await prisma.item.findFirst({ where: { negocioId, nombre, colorNombre } });
  if (existente) {
    return;
  }
  await prisma.item.create({
    data: {
      negocioId,
      nombre,
      categoria,
      unidad,
      tieneColor: colorNombre !== null,
      colorNombre,
    },
  });
}

async function upsertOperario(negocioId: string, nombre: string): Promise<void> {
  const existente = await prisma.operario.findFirst({ where: { negocioId, nombre } });
  if (existente) {
    return;
  }
  await prisma.operario.create({ data: { negocioId, nombre } });
}

/**
 * Crea (si no existe) el negocio del fundador del SaaS y su usuario dueño,
 * marcado como super-admin para poder dar de alta negocios de otros clientes
 * desde POST /admin/negocios.
 */
async function upsertNegocioYOwner(): Promise<string> {
  const nombreNegocio = process.env.OWNER_NEGOCIO_NOMBRE ?? 'Fauna de Tela';
  const email = process.env.OWNER_EMAIL;
  const password = process.env.OWNER_PASSWORD;
  const nombre = process.env.OWNER_NOMBRE ?? 'Dueño';
  const whatsappNumber = process.env.OWNER_WHATSAPP_NUMBER;

  if (!email || !password) {
    throw new Error(
      'Definí OWNER_EMAIL y OWNER_PASSWORD en .env antes de correr el seed (son las credenciales de login del dueño)',
    );
  }

  const existente = await prisma.user.findUnique({ where: { email } });
  if (existente) {
    return existente.negocioId;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const negocio = await prisma.negocio.create({ data: { nombre: nombreNegocio } });
  await prisma.user.create({
    data: {
      negocioId: negocio.id,
      email,
      passwordHash,
      nombre,
      whatsappNumber,
      esSuperAdmin: true,
    },
  });

  return negocio.id;
}

async function main(): Promise<void> {
  const negocioId = await upsertNegocioYOwner();

  for (const nombre of PRODUCTOS) {
    await upsertItem(negocioId, nombre, Categoria.PRODUCTO, Unidad.UNIDAD, null);
  }

  for (const color of COLORES_ESTANDAR) {
    await upsertItem(negocioId, 'Gabardina', Categoria.MATERIAL, Unidad.METRO, color);
    await upsertItem(negocioId, 'Corderoy', Categoria.MATERIAL, Unidad.METRO, color);
    await upsertItem(negocioId, 'Hilo Poliéster', Categoria.MATERIAL, Unidad.CONO, color);
  }
  await upsertItem(negocioId, 'Hilo Poliéster', Categoria.MATERIAL, Unidad.CONO, 'Blanco');

  await upsertItem(negocioId, 'Vellón', Categoria.MATERIAL, Unidad.KG, null);

  for (const nombre of OPERARIOS) {
    await upsertOperario(negocioId, nombre);
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
