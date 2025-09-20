import { ForwardReference, Inject, InjectionToken, Type } from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import { ApiPropertyOptions } from '@nestjs/swagger';
import { ResourceMap } from '../decorators';
import { Resource } from '../resources';
import { dataSymbol } from '../resources/consts';

type AbstractType<T = any> = abstract new (...args: any[]) => T;

export class ResourcesService {
  @Inject() private reflector!: Reflector;
  @Inject() private readonly moduleRef!: ModuleRef;

  private readonly mappers = new Map<AbstractType, (value: any, map: (value: unknown) => unknown) => unknown>();

  constructor() {
    this.addMapper(Resource, (value) =>
      this.mapResource(
        <Type<Resource<any>>>value.constructor,
        <Resource<any> & Record<string, unknown>>value,
        <Record<string, any>>value[dataSymbol],
      ),
    )
      .addMapper(Date, (value) => value.toISOString())
      .addMapper(Buffer, (value) => value.toString('base64'))
      .addMapper(Map, (value, map) =>
        Object.fromEntries(Array.from(value.entries()).map(([key, value]) => [key, map(value)])),
      )
      .addMapper(Set, (value, map) => Array.from(value.values()).map((value) => map(value)));
  }

  addMapper<T>(type: AbstractType<T>, resolver: (value: T, map: (value: unknown) => unknown) => unknown) {
    this.mappers.set(type, resolver);
    return this;
  }

  private mappedValues = new WeakSet<object>();

  map(value: unknown): unknown {
    switch (typeof value) {
      case 'bigint':
        return value.toString();
      case 'object': {
        if (value === null) return null;
        if (this.mappedValues.has(value)) {
          return value;
        }
        this.mappedValues.add(value);

        if (Array.isArray(value)) {
          return value.map((item) => this.map(item));
        }

        for (const [type, mapper] of this.mappers) {
          if (value instanceof type) {
            return this.map(mapper(value, (value: any) => this.map(value)));
          }
        }

        (
          (Reflect.getMetadata('swagger/apiModelPropertiesArray', value.constructor.prototype) ?? []) as Array<string>
        ).forEach((prop) => {
          const name = prop.slice(1);
          (<Record<string, unknown>>value)[name] = this.map((<Record<string, unknown>>value)[name]);
        });
      }
    }

    return value;
  }

  mapResource(
    metatype: Type<Resource<unknown>>,
    value: Resource<any> & Record<string, unknown>,
    data: Record<string, unknown>,
  ) {
    const props = new Set(
      ((Reflect.getMetadata('swagger/apiModelPropertiesArray', metatype.prototype) ?? []) as Array<string>).map(
        (prop: string) => prop.slice(1),
      ),
    );

    let prototype = metatype;
    const targets: Array<Type<Resource<unknown>>> = [];
    do {
      targets.push(prototype);
      prototype = <Type<Resource<any>>>Object.getPrototypeOf(prototype);
    } while (prototype.prototype !== Resource.prototype);

    new Set(this.reflector.getAll(ResourceMap.Decorator, targets).filter(Boolean).reverse()).forEach(
      ({ map, injects }) => {
        const injectValues: unknown[] =
          injects?.map((provider) =>
            this.moduleRef.get(
              typeof provider === 'object' && 'forwardRef' in provider
                ? (provider as unknown as ForwardReference<() => InjectionToken>).forwardRef()
                : provider,
              { strict: false },
            ),
          ) ?? [];
        Object.entries(map(data, ...injectValues)).forEach(([key, propValue]) => {
          value[key] = this.map(propValue);
          props.delete(key);
        });
      },
    );

    props.forEach((name) => {
      let propValue = data[name];

      if ((propValue ?? null) !== null) {
        const existingMetadata = <ApiPropertyOptions | undefined>(
          Reflect.getMetadata('swagger/apiModelProperties', metatype.prototype, name)
        );
        if (existingMetadata?.type instanceof Function && existingMetadata.type.prototype instanceof Resource) {
          const type = existingMetadata.type as Type<Resource<any>>;
          if (existingMetadata.isArray) {
            propValue = [].map.call(propValue, (item: any) => new type(item));
          } else {
            propValue = new type(propValue);
          }
        } else {
          const propType = <void | Type<Resource<any>>>Reflect.getMetadata('design:type', metatype, name);
          if (propType && propType.prototype instanceof Resource) {
            propValue = new propType(propValue);
          }
        }
      }

      value[name] = this.map(propValue);
    });

    return value;
  }
}
