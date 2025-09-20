import { applyDecorators, HttpStatus, Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';

export function ApiPaginatedResponse({
  type,
  status = HttpStatus.OK,
  omit = [],
  extends: properties = {},
  description = '',
}: {
  type: Type;
  status?: HttpStatus;
  omit?: string[];
  extends?: Record<string, any>;
  description?: string;
}) {
  return applyDecorators(
    ApiExtraModels(type),
    ApiResponse({
      status,
      description,
      schema: {
        allOf: [
          { properties },
          {
            properties: {
              data: {
                type: 'array',
                items: {
                  allOf: [
                    { $ref: getSchemaPath(type) },
                    { properties: Object.fromEntries(omit.map((key) => [key, { writeOnly: true }])) },
                  ],
                },
              },
              total: { type: 'number' },
            },
          },
        ],
      },
    }),
  );
}
