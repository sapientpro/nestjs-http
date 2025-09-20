import { dataSymbol } from './consts';
import { ResourcePaginated } from './resource.paginated';

export abstract class Resource<T extends any> {
  readonly [dataSymbol]: T;

  public constructor(data: T) {
    this[dataSymbol] = data;
  }

  static make<R, T extends new (data: R) => any>(this: T, data: R): InstanceType<T> {
    return new this(data);
  }

  static collection<R, T extends new (data: R) => any>(this: T, data: R[]): Array<InstanceType<T>> {
    return data.map((item) => new this(item));
  }

  static paginated<R, T extends new (data: R) => any>(
    this: T,
    data: R[],
    total: number,
  ): ResourcePaginated<InstanceType<T>> {
    return new ResourcePaginated<InstanceType<T>>(
      data.map((item) => new this(item)),
      total,
    );
  }
}
