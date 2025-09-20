import { CallHandler, ExecutionContext, Inject, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { ResourcesService } from '../services';

export class ResourceInterceptor implements NestInterceptor {
  @Inject() private readonly resourcesService!: ResourcesService;
  intercept(context: ExecutionContext, next: CallHandler<any>): Observable<any> | Promise<Observable<any>> {
    context.getHandler();
    return next.handle().pipe(map((data: unknown) => this.resourcesService.map(data)));
  }
}
