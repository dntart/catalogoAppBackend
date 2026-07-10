import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateOperarioDto {
  @ApiProperty({ example: 'María' })
  @IsString()
  @MinLength(1)
  nombre!: string;
}
