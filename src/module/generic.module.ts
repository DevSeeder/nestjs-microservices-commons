import { Module, DynamicModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ErrorSchemasModule,
  ErrorService,
  GetTranslationService,
  SchemaDependecyTokens,
  TranslationsModule,
} from '@devseeder/nestjs-microservices-schemas';
import { ModuleRef, REQUEST } from '@nestjs/core';
import {
  EntitySchema,
  FieldSchema,
  SchemasModule,
} from '@devseeder/nestjs-microservices-schemas';

import { JwtService } from '@nestjs/jwt';
import { CustomProvider } from '../dto';
import { DependencyInjectorToken } from '../app.constants';
import { GenericRepository } from '../mongoose';
import {
  GenericCreateController,
  GenericGetController,
  GenericUpdateController,
} from '../controller';
import { DependencyInjectorService } from '../injector/dependency-injector.service';
import {
  EntityModelTokenBuilder,
  ModelEntityTokens,
} from '../injector/model-entity-token.injector';
import { ConfigService } from '@nestjs/config';

export interface GenericModuleOptions {
  modelName: string;
  entity: string;
  configuration;
  customProvider?: CustomProvider;
  authGuard;
  interceptor;
  modelTokens: ModelEntityTokens;
}

@Module({})
export class GenericModule {
  static forFeature(options: GenericModuleOptions): DynamicModule {
    const repositoryProvider = DependencyInjectorService.injectRepository(
      options.entity,
      options.modelName,
      options.customProvider,
    );
    return {
      module: GenericModule,
      controllers: controllersFactory(
        options.entity,
        options.authGuard,
        options.interceptor,
        options.customProvider,
      ),
      imports: [
        MongooseModule.forFeature(
          EntityModelTokenBuilder.buildMongooseStaticModelForFeature(
            options.modelTokens,
          ),
        ),
        SchemasModule.forRootAsync(options.configuration),
        TranslationsModule.forRoot(options.configuration),
        ErrorSchemasModule.forRoot(options.configuration),
      ],
      providers: [
        repositoryProvider,
        JwtService,
        {
          provide: DependencyInjectorToken.SCOPE_KEY,
          useFactory: async (config: ConfigService) =>
            config.get<string>('auth.scopeKey'),
          inject: [ConfigService],
        },
        options.authGuard,
        GenericModule.loadServiceProvider(
          options.entity,
          'get',
          options.modelTokens,
          options.customProvider,
        ),
        GenericModule.loadServiceProvider(
          options.entity,
          'update',
          options.modelTokens,
          options.customProvider,
        ),
        GenericModule.loadServiceProvider(
          options.entity,
          'create',
          options.modelTokens,
          options.customProvider,
        ),
      ],
      exports: [
        repositoryProvider,
        `GENERIC_GET_SERVICE_${options.entity}`,
        `GENERIC_UPDATE_SERVICE_${options.entity}`,
        `GENERIC_CREATE_SERVICE_${options.entity}`,
      ],
    };
  }

  static loadServiceProvider<Collection>(
    entity: string,
    providerKey: string,
    modelTokens: ModelEntityTokens,
    customProvider?: CustomProvider,
  ) {
    return {
      provide: `GENERIC_${providerKey.toUpperCase()}_SERVICE_${entity}`,
      useFactory: async (
        moduleRef: ModuleRef,
        repository: GenericRepository<Collection>,
        fieldSchemaData: FieldSchema[],
        entitySchemaData: EntitySchema[],
        translationService: GetTranslationService,
        errorService: ErrorService,
        request: Request,
        scopeKey: string,
      ) => {
        const injectorService = new DependencyInjectorService(
          moduleRef,
          entitySchemaData,
          fieldSchemaData,
          translationService,
          errorService,
          request,
          scopeKey,
          modelTokens,
        );
        const injectFunction = `inject${providerKey.capitalizeFirstLetter()}Service`;
        const serviceProvider = await injectorService[injectFunction](
          entity,
          repository,
          customProvider,
        );
        return serviceProvider;
      },
      inject: [
        ModuleRef,
        `GENERIC_REPOSITORY_${entity}`,
        SchemaDependecyTokens.FIELD_SCHEMA_DB,
        SchemaDependecyTokens.ENTITY_SCHEMA_DB,
        GetTranslationService,
        ErrorService,
        REQUEST,
        DependencyInjectorToken.SCOPE_KEY,
      ],
    };
  }
}

function controllersFactory(
  entity: string,
  authGuard,
  interceptor,
  customProvider?: CustomProvider,
) {
  const controllerArgs = { entity, authGuard, interceptor };
  const genericArr = [
    GenericGetController(controllerArgs),
    GenericUpdateController(controllerArgs),
    GenericCreateController(controllerArgs),
  ];

  if (checkCustomController('get', customProvider))
    genericArr.push(customProvider.controller.get);
  if (checkCustomController('update', customProvider))
    genericArr.push(customProvider.controller.update);
  if (checkCustomController('create', customProvider))
    genericArr.push(customProvider.controller.get);

  return genericArr;
}

function checkCustomController(
  ctrlKey: string,
  customProvider?: CustomProvider,
): boolean {
  return (
    customProvider &&
    customProvider.controller &&
    customProvider.controller[ctrlKey]
  );
}
