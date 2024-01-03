import { Inject, Injectable, Scope } from '@nestjs/common';
import {
  ErrorService,
  GetTranslationService,
} from '@devseeder/nestjs-microservices-schemas';

import { ObjectId } from 'mongoose';
import { REQUEST } from '@nestjs/core';
import {
  EntitySchema,
  FieldSchema,
} from '@devseeder/nestjs-microservices-schemas';
import { UserBodyDto } from '@devseeder/nestjs-microservices-core/dist/dto/user.dto';
import { GenericRepository } from 'src/mongoose';
import { ClientAuthService } from '@devseeder/nestjs-microservices-core';
import { DependencyInjectorToken } from 'src/app.constants';
import { UserAuth } from '@devseeder/nestjs-microservices-core/dist/auth/model/user-auth.model';
import { GenericCreateService } from '../abstract/generic-create.service';

@Injectable({ scope: Scope.REQUEST })
export class GenericCreateUserService<
  UserEntity,
  UserEntityBody extends UserBodyDto,
> extends GenericCreateService<UserEntity, UserEntity, UserEntityBody> {
  constructor(
    protected readonly repository: GenericRepository<UserEntity>,
    protected readonly fieldSchemaData: FieldSchema[],
    protected readonly entitySchemaData: EntitySchema[],
    protected readonly translationService: GetTranslationService,
    protected readonly errorService: ErrorService,
    @Inject(REQUEST) protected readonly request?: Request,
    @Inject(DependencyInjectorToken.SCOPE_KEY)
    protected readonly scopeKey?: string,
    protected readonly clientAuthService?: ClientAuthService,
    protected readonly projectKey?: string,
  ) {
    super(
      repository,
      'users',
      fieldSchemaData,
      entitySchemaData,
      translationService,
      errorService,
      request,
    );
  }

  async create(body: UserEntityBody): Promise<{ _id: ObjectId }> {
    const userAuthId = await this.createUserAuth(body);
    return super.create({ ...body, idUserAuth: userAuthId });
  }

  async createUserAuth(user: UserEntityBody): Promise<string> {
    const userAuth = new UserAuth();
    userAuth.name = user.name;
    userAuth.username = user.username;
    userAuth.password = user.password;
    userAuth.projectKey = this.projectKey;
    userAuth.scopes = [
      `${this.scopeKey}/USER`,
      `${this.scopeKey}/UPDATE_PASSWORD`,
    ];

    const response = await this.clientAuthService.createUser(userAuth);
    return response.response.userId;
  }
}
