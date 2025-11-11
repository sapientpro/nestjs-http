# @sapientpro/nestjs-http
[![NPM Package](https://img.shields.io/npm/v/@sapientpro/nestjs-http.svg)](https://www.npmjs.org/package/@sapientpro/nestjs-http)

NestJS HTTP utilities for building clean, well‑documented APIs:
- Resource class and ResourceMap decorator for mapping domain objects to API responses
- Automatic response serialization via ResourceInterceptor and ResourcesService
- Swagger helper for paginated responses (ApiPaginatedResponse)
- Validated pagination query DTO (PaginatedQuery)

## Installation

```sh
npm install @sapientpro/nestjs-http
```

## What problem does it solve?

This module helps you separate your domain data from your HTTP responses. Define lightweight Resource classes that declare exactly what goes out over the wire. A global interceptor serializes your controller responses (including nested Resources, arrays, Maps/Sets, Dates, Buffers, and BigInt) into JSON‑safe structures and respects Swagger metadata for better API docs.

## Features at a glance
- Resource base class with helpers: make, collection, paginated
- ResourceMap decorator to declare how to map raw data to response fields (with optional DI injections)
- Global ResourceInterceptor to serialize responses consistently
- ApiPaginatedResponse decorator to document list endpoints in Swagger
- PaginatedQuery DTO with class‑validator rules and Swagger defaults

## Quick start

1) Register providers and the interceptor

If you don't use the provided module, add the HttpModule to your AppModule:

```ts
// app.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@sapientpro/nestjs-http';

@Module({
    imports: [HttpModule],
})
export class AppModule {}
```

2) Create a Resource and define mapping

```ts
// post.resource.ts
import { ApiProperty } from '@nestjs/swagger';
import { Resource, ResourceMap } from '@sapientpro/nestjs-http';

export class PostResource extends Resource<{ id: string; title: string; content: string; createdAt: Date }> {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  content!: string;

  @ApiProperty()
  createdAt!: string; // will be ISO string after mapping
}
```

3) Use the Resource in a controller

```ts
// posts.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { ApiProperty } from "@nestjs/swagger";
import { ApiPaginatedResponse } from '@sapientpro/nestjs-http';
import { PaginatedQuery, Resource } from '@sapientpro/nestjs-http';

@Controller('posts')
export class PostsController {
    @Get()
    @ApiPaginatedResponse({ type: PostResource, description: 'List posts' })
    async list(@Query() query: PaginatedQuery) {
        const data = [
            { id: '1', title: 'Hello', content: '...', createdAt: new Date() },
        ];
        const total = 1;
        return PostResource.paginated(data, total);
    }
}
```

## API

- Resource<T>
  - new Resource(data)
  - static make(data)
  - static collection(dataArray)
  - static paginated(dataArray, total)

- @ResourceMap({ map, injects? })
  - map receives the original data and returns an object with public fields to expose
  - injects allows resolving providers to use inside map

- ApiPaginatedResponse({ type, status?, omit?, extends?, description? })
  - Adds Swagger schema for { data: T[], total: number }
  - omit lets you hide some fields from the schema (writeOnly)
  - extends allows adding extra top‑level properties to the wrapper

- PaginatedQuery
  - limit?: number (default 20, max 100)
  - offset?: number (default 0)

## Serialization rules
- BigInt -> string
- Date -> ISO string
- Buffer -> base64 string
- Map -> plain object
- Set -> array
- Nested arrays, objects, and Resources are recursively mapped
- Swagger @ApiProperty metadata on Resource fields is honored, including nested Resource types

## Advanced mapping examples

### 1) Auto-expanding nested Resources from entity data

When a Resource field is typed as another Resource (optionally via Swagger's `type`), the mapper will automatically construct that nested Resource from the original entity value. Arrays are supported too.

Example:

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Resource } from '@sapientpro/nestjs-http';

// Suppose these resources exist
class ProfileResource extends Resource<any> {}
class MembershipResource extends Resource<any> {}
class PhoneNumberResource extends Resource<any> {}

type AccountEntity = {
  id: string;
  name: string;
  profile?: any; // data to feed into ProfileResource
  memberships?: any[]; // data to feed into MembershipResource[]
  phoneNumbers?: any[]; // data to feed into PhoneNumberResource[]
};

export class AccountSummaryResource extends Resource<AccountEntity> {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  profile?: ProfileResource; // will be auto-mapped from entity.profile

  @ApiPropertyOptional({ type: MembershipResource, isArray: true })
  memberships?: MembershipResource[]; // auto-mapped from entity.memberships

  @ApiPropertyOptional({ type: PhoneNumberResource, isArray: true })
  phoneNumbers?: PhoneNumberResource[]; // auto-mapped from entity.phoneNumbers
}
```

Result: `profile`, `memberships`, and `phoneNumbers` will be automatically expanded from the corresponding `AccountEntity` fields and converted to the specified Resource types.


### 2) Inheritance-aware field resolution

If you extend a Resource, only the declared fields of each class are auto-resolved from the data type assigned to that class in the hierarchy.

```ts
import { ApiProperty } from '@nestjs/swagger';
import { Resource } from '@sapientpro/nestjs-http';

type DataType = { id: number; name: number };

class A extends Resource<DataType> {
  @ApiProperty()
  id!: number; // A will map only `id` from DataType
}

class B extends A {
  @ApiProperty()
  name!: number; // B adds `name`, so B will map both `id` and `name`
}
```

- An instance of `A` will include only `id`.
- An instance of `B` will include both `id` and `name`.


### 3) Using ResourceMap for custom mapping (with DI)

You can override or enrich the auto-resolved properties using `@ResourceMap`. Inject services (including forwardRef) into the mapper and return an object with fields to set explicitly. Fields returned by `map` are ignored by the auto-resolver (i.e., they won't be auto-populated again).

```ts
import { forwardRef, Injectable } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Resource, ResourceMap } from '@sapientpro/nestjs-http';

class SomeService { /* ... */ }
class Service2 { /* ... */ }

type DataType = { raw: string; computed?: string };

@ResourceMap<DataType>({
  injects: [SomeService, forwardRef(() => Service2)],
  map(value: DataType, someService: SomeService, service2: Service2) {
    return {
      // Any fields you return here will be set on the resource and excluded from auto-resolving
      computed: `${value.raw}-${someService.get('x')}`,
    };
  },
})
export class ExampleResource extends Resource<DataType> {
  @ApiProperty()
  raw!: string; // will be auto-resolved unless overridden in map

  @ApiProperty()
  computed!: string; // provided by ResourceMap.map, so auto-resolve will skip it
}
```

Notes:
- The `map` function receives the original data and any injected services.
- Returned fields from `map` are considered resolved and will not be auto-filled afterward.
- Remaining declared properties on the Resource are auto-resolved from the source data (including nested Resources, arrays, Dates, Buffers, BigInt, Maps/Sets, etc.).


## Creating new resources (cookbook)

Below are small, copy–pasteable examples you can adapt when creating new Resources. These are examples only; no source files are added to the library.

### A) Simple nested resources with arrays

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Resource } from '@sapientpro/nestjs-http';

type Profile = {
  bio?: string;
  website?: string;
};

type UserEntity = {
  id: string;
  name: string;
  tags?: string[];
  profile?: Profile;
};

export class ProfileResource extends Resource<Profile> {
  @ApiPropertyOptional()
  bio?: string;

  @ApiPropertyOptional()
  website?: string;
}

export class UserResource extends Resource<UserEntity> {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ isArray: true, type: String })
  tags?: string[];

  @ApiPropertyOptional({ type: ProfileResource })
  profile?: ProfileResource; // auto-expanded from entity.profile
}
```

- Arrays of primitives work with `type: String | Number | Boolean`.
- Single nested resource is auto-instantiated because the field type is `ProfileResource`.

### B) Handling Date, Buffer, BigInt and arrays of nested resources

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Resource } from '@sapientpro/nestjs-http';

// Domain types
export type OrderItem = { sku: string; quantity: number };
export type Order = {
  id: bigint;        // will be serialized as string
  createdAt: Date;   // will be serialized as ISO string
  invoicePdf?: Buffer; // will be base64 string if present
  items: OrderItem[];
};

export class OrderItemResource extends Resource<OrderItem> {
  @ApiProperty()
  sku!: string;

  @ApiProperty()
  quantity!: number;
}

export class OrderResource extends Resource<Order> {
  @ApiProperty()
  id!: string; // BigInt -> string

  @ApiProperty()
  createdAt!: string; // Date -> ISO string

  @ApiPropertyOptional()
  invoicePdf?: string; // Buffer -> base64

  @ApiProperty({ type: OrderItemResource, isArray: true })
  items!: OrderItemResource[]; // auto-expanded
}
```

- You can still declare `id` as `bigint` and `createdAt` as `Date` in the resource; the interceptor will serialize them. Typing as `string` in the Resource reflects the final JSON.

### C) Renaming fields and computing values with ResourceMap

```ts
import { ApiProperty } from '@nestjs/swagger';
import { Resource, ResourceMap } from '@sapientpro/nestjs-http';

type Product = {
  id: number;
  title: string;           // we want to expose as `name`
  priceCents: number;      // we want to expose as `price` in dollars
};

@ResourceMap<Product>({
  map(value) {
    return {
      name: value.title,                // rename
      price: value.priceCents / 100,    // compute
    };
  },
})
export class ProductResource extends Resource<Product> {
  @ApiProperty()
  id!: number; // auto-resolved

  @ApiProperty()
  name!: string; // provided by map, excluded from auto-resolve

  @ApiProperty()
  price!: number; // provided by map
}
```

Tip: Any fields returned by `map` are considered resolved and won’t be auto-populated again.
