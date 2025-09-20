import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsNumber, IsPositive, Max, Min } from 'class-validator';

export class PaginatedQuery {
  @ApiProperty({ type: Number, default: 20 })
  @Transform(({ value }: { value: string }) => (value ? Number(value) : value))
  @IsNumber()
  @IsInt()
  @IsPositive()
  @Max(100)
  limit?: number;

  @ApiProperty({ type: Number, default: 0 })
  @Transform(({ value }: { value: string }) => (value ? Number(value) : value))
  @IsNumber()
  @IsInt()
  @Min(0)
  offset?: number;
}
