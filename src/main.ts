import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim()),
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('StockAsist API')
    .setDescription(
      'Gestión de producción e inventario multi-tenant para emprendimientos textiles',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Login del dueño del emprendimiento')
    .addTag('negocios', 'Alta self-service de un negocio nuevo')
    .addTag('admin', 'Alta manual de negocios (respaldo, solo super-admin)')
    .addTag('items', 'Catálogo de materiales y productos')
    .addTag('operarios', 'Personas que registran movimientos')
    .addTag(
      'ordenes-produccion',
      'Entregas de material a un operario y su trazabilidad',
    )
    .addTag('movimientos', 'Ledger de entradas y salidas de stock')
    .addTag('stock', 'Stock calculado a partir de los movimientos')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
