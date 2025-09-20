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