import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ResourceInterceptor } from './interceptors';
import { ResourcesService } from './services';

@Module({
  providers: [
    ResourcesService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ResourceInterceptor,
    },
  ],
})
export class HttpModule {}
