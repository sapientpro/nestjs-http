import { ApiProperty } from '@nestjs/swagger';
import { Resource } from './resource';

export class ResourcePaginated<T extends Resource<any>> {
  @ApiProperty()
  public data: T[];

  @ApiProperty()
  public total: number;

  constructor(data: T[], total: number) {
    this.data = data;
    this.total = total;
  }
}
