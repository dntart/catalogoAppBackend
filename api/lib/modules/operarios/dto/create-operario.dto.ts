import { IsString, MinLength } from 'class-validator';

export class CreateOperarioDto {
  @IsString()
  @MinLength(1)
  nombre!: string;
}
