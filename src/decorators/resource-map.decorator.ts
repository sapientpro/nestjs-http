import { ForwardReference, InjectionToken } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Resource } from '../resources';

type Ctor<T> = abstract new (...args: any[]) => T;
type ResourceValue<C extends Ctor<Resource<any>>> = C extends Ctor<Resource<infer R>> ? R : never;

export type ResourceMapOptions<R> = {
  injects?: Array<InjectionToken | ForwardReference>;
  map: (value: R, ...args: any[]) => Record<string, any>;
};

const ResourceMapDecorator = Reflector.createDecorator<ResourceMapOptions<any>>();

export function ResourceMap<C extends Ctor<Resource<any>>>(options: ResourceMapOptions<ResourceValue<C>>) {
  return <(target: C) => void>ResourceMapDecorator(options);
}

ResourceMap.Decorator = ResourceMapDecorator;
