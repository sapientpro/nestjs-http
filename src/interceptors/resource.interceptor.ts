import { CallHandler, ExecutionContext, Inject, NestInterceptor } from '@nestjs/common';
import { from, mergeMap, Observable } from 'rxjs';
import { ResourcesService } from '../services';

export class ResourceInterceptor implements NestInterceptor {
  @Inject() private readonly resourcesService!: ResourcesService;
  intercept(context: ExecutionContext, next: CallHandler<any>): Observable<any> {
    return next.handle().pipe(
      mergeMap((data: unknown) => from(this.resourcesService.map(data)))
    );
  }
}
