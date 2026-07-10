import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Fauna de Tela API')
    .setDescription('Gestión de producción e inventario para Fauna de Tela')
    .setVersion('1.0')
    .addTag('items', 'Catálogo de materiales y productos')
    .addTag('operarios', 'Personas que registran movimientos')
    .addTag('movimientos', 'Ledger de entradas y salidas de stock')
    .addTag('stock', 'Stock calculado a partir de los movimientos')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
