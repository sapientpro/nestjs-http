import { ForwardReference, Inject, InjectionToken, Type } from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import { ApiPropertyOptions } from '@nestjs/swagger';
import { AsyncLocalStorage } from 'node:async_hooks';
import { ResourceMap } from '../decorators';
import { Resource } from '../resources';
import { dataSymbol } from '../resources/consts';

type AbstractType<T = any> = abstract new (...args: any[]) => T;
type Path = { value: object; parent?: Path };

export class ResourcesService {
  @Inject() private reflector!: Reflector;
  @Inject() private readonly moduleRef!: ModuleRef;

  private readonly mappers = new Map<AbstractType, (value: any, map: (value: unknown) => Promise<unknown>) => unknown>();

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
      .addMapper(Map, async (value, map) =>
        Object.fromEntries(await Promise.all(Array.from(value.entries()).map(async ([key, value]) => [key, await map(value)]))),
      )
      .addMapper(Set, (value, map) => Promise.all(Array.from(value.values()).map(map)));
  }

  addMapper<T>(type: AbstractType<T>, resolver: (value: T, map: (value: unknown) => Promise<unknown>) => Promise<unknown> | unknown) {
    this.mappers.set(type, resolver);
    return this;
  }

  /** Objects mapped in place: seen again, they are already what they should be. */
  private mappedValues = new WeakSet<object>();

  /** The objects being converted right now, innermost first, for whatever runs inside them. */
  private readonly path = new AsyncLocalStorage<Path>();

  async map(value: unknown): Promise<unknown> {
    switch (typeof value) {
      case 'bigint':
        return value.toString();
      case 'object': {
        if (value === null) return null;
        if (this.mappedValues.has(value)) {
          return value;
        }
        const path = this.path.getStore();
        for (let step = path; step; step = step.parent) {
          if (step.value === value) return value;
        }
        return this.path.run({ value, parent: path }, () => this.convert(value));
      }
    }

    return value;
  }

  /**
   * An array or a value with a mapper is converted wherever it turns up, so two rows sharing one
   * both get the result; only meeting itself inside its own conversion ends the walk (see `map`).
   */
  private async convert(value: object): Promise<unknown> {
    if (Array.isArray(value)) {
      return Promise.all(value.map((item) => this.map(item)));
    }

    // A resource is filled in where it stands, once, however many rows hold it.
    if (value instanceof Resource) this.mappedValues.add(value);

    for (const [type, mapper] of this.mappers) {
      if (value instanceof type) {
        const mapped = await mapper(value, (value: any) => this.map(value));
        if (mapped !== value) return this.map(mapped);
        this.mappedValues.add(value);
        return value;
      }
    }

    this.mappedValues.add(value);
    await Promise.all(
      this.getProps(value.constructor as Type)
        .map(async (name) => {
          (<Record<string, unknown>>value)[name] = await this.map((<Record<string, unknown>>value)[name]);
        }));

    return value;
  }

  private _props = new Map<Type, Array<string>>;

  private getProps(metatype: Type): readonly string[] {
    if (!this._props.has(metatype)) {
      const props = new Set(
        ((Reflect.getMetadata('swagger/apiModelPropertiesArray', metatype.prototype) ?? []) as Array<string>).map(
          (prop: string) => prop.slice(1),
        ),
      );
      this._props.set(metatype, Array.from(props));
    }

    return this._props.get(metatype)!;
  }

  async mapResource(
    metatype: Type<Resource<unknown>>,
    value: Resource<any> & Record<string, unknown>,
    data: Record<string, unknown>,
  ) {
    const props = new Set(this.getProps(metatype));

    let prototype = metatype;
    const targets: Array<Type<Resource<unknown>>> = [];
    do {
      targets.push(prototype);
      prototype = <Type<Resource<any>>>Object.getPrototypeOf(prototype);
    } while (prototype.prototype !== Resource.prototype);

    await Promise.all(Array.from(new Set(this.reflector.getAll(ResourceMap.Decorator, targets).filter(Boolean).reverse())).map(
      async ({ map, injects }) => {
        const injectValues: unknown[] =
          injects?.map((provider) =>
            this.moduleRef.get(
              typeof provider === 'object' && 'forwardRef' in provider
                ? (provider as unknown as ForwardReference<() => InjectionToken>).forwardRef()
                : provider,
              { strict: false },
            ),
          ) ?? [];

        await Promise.all(Object.entries(await map(data, ...injectValues)).map(async ([key, propValue]) => {
          value[key] = await this.map(propValue);
          props.delete(key);
        }));
      },
    ));

    await Promise.all(Array.from(props).map(async (name) => {
      let propValue = data[name];

      if ((propValue ?? null) !== null) {
        const existingMetadata = <ApiPropertyOptions | undefined>(
          Reflect.getMetadata('swagger/apiModelProperties', metatype.prototype, name)
        );
        const type: any = typeof existingMetadata?.type === 'function' && (existingMetadata.type.prototype ? existingMetadata.type : existingMetadata.type.call(null));
        if (type instanceof Function && type.prototype instanceof Resource) {
          if (existingMetadata!.isArray) {
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

      value[name] = await this.map(propValue);
    }));

    return value;
  }
}
