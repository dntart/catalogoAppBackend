import 'reflect-metadata';
import { plainToInstance, ClassConstructor } from 'class-transformer';
import { validate } from 'class-validator';
import { BadRequestError } from './auth';

/**
 * Reemplaza el ValidationPipe global de NestJS
 * ({ whitelist: true, forbidNonWhitelisted: true, transform: true }):
 * transforma el body plano a la clase del DTO y corre los mismos decoradores
 * de class-validator que ya usaban los DTOs — sin reescribirlos.
 */
export async function validateBody<T extends object>(
  dtoClass: ClassConstructor<T>,
  body: unknown,
): Promise<T> {
  const instance = plainToInstance(dtoClass, body, {
    excludeExtraneousValues: false,
  });
  const errors = await validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  if (errors.length > 0) {
    const mensajes = errors.flatMap((e) => Object.values(e.constraints ?? {}));
    throw new BadRequestError(mensajes.join('; ') || 'Datos inválidos');
  }
  return instance;
}
