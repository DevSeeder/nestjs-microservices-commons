import { Inject, Injectable, Provider, Scope } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Collection, Model } from 'mongoose';
import {
  ErrorService,
  GLOBAL_ENTITY,
  GetTranslationService,
  SchemaDependecyTokens,
} from '@devseeder/nestjs-microservices-schemas';
import { ModuleRef, REQUEST } from '@nestjs/core';
import {
  EntitySchema,
  FieldSchema,
} from '@devseeder/nestjs-microservices-schemas';
import { DependencyInjectorToken } from 'src/app.constants';
import { AbstractBodyDto, CustomProvider, Search } from 'src/dto';
import { GenericRepository } from 'src/mongoose';
import {
  GenericCreateService,
  GenericGetService,
  GenericUpdateService,
} from 'src/service';
import { ModelEntityTokens } from './model-entity-token.injector';

@Injectable({ scope: Scope.REQUEST })
export class DependencyInjectorService {
  private entitySchema: EntitySchema;
  private parentFields: FieldSchema[];
  private serviceCache = {};
  constructor(
    private moduleRef: ModuleRef,
    @Inject(SchemaDependecyTokens.ERROR_SCHEMA_DB)
    private entitySchemaData: EntitySchema[],
    @Inject(SchemaDependecyTokens.FIELD_SCHEMA_DB)
    private fieldSchemaData: FieldSchema[],
    private translationService: GetTranslationService,
    private errorService: ErrorService,
    @Inject(REQUEST) protected readonly request: Request,
    @Inject(DependencyInjectorToken.SCOPE_KEY)
    protected readonly scopeKey: string,
    protected readonly modelTokens: ModelEntityTokens,
  ) {}

  setSchema(entity: string) {
    this.entitySchema = this.entitySchemaData.filter(
      (ent) => ent.entity === entity,
    )[0];
    this.parentFields = this.fieldSchemaData
      .filter(
        (field) =>
          field.entity === entity ||
          field.entity === GLOBAL_ENTITY ||
          (this.entitySchema.extendedEntities &&
            this.entitySchema.extendedEntities.includes(field.entity)),
      )
      .filter((field) => field.type === 'externalId');
  }

  static injectRepository<Collection>(
    entity: string,
    modelName: string,
    customProvider?: CustomProvider,
  ): Provider {
    return {
      provide: `GENERIC_REPOSITORY_${entity}`,
      useFactory: (model: Model<any>) => {
        let classService = GenericRepository<Collection>;
        if (customProvider && customProvider.repository)
          classService = customProvider.repository;
        return createInstance(classService, model);
      },
      inject: [getModelToken(modelName)],
    };
  }

  async injectService<Collection, T>(
    entity: string,
    repository: GenericRepository<any>,
    genericClass,
    providerKey: string,
    customProvider?: CustomProvider,
    children = true,
  ): Promise<T> {
    const serviceKey = `${providerKey}${entity.capitalizeFirstLetter()}Service`;

    this.setSchema(entity);

    const { args, classService } = this.getInstance(
      entity,
      repository,
      genericClass,
      providerKey,
      customProvider,
    );
    const service = createInstance<any>(classService, ...args);

    await this.injectParents(service, 'get', serviceKey);
    if (children) await this.injectChildren(service, 'get', serviceKey);
    if (providerKey !== 'get' && children)
      await this.injectChildren(service, providerKey, serviceKey);

    this.serviceCache[serviceKey] = service;

    return service;
  }

  private async injectParents(
    service,
    providerKey: string,
    originalServiceKey: string,
  ) {
    for await (const parent of this.parentFields) {
      await this.injectFamily(
        service,
        providerKey,
        parent.externalRelation.service,
        originalServiceKey,
      );
    }
  }

  private async injectChildren(
    service,
    providerKey: string,
    originalServiceKey: string,
  ) {
    for await (const sub of this.entitySchema.subRelations) {
      await this.injectFamily(
        service,
        providerKey,
        sub.service,
        originalServiceKey,
        true,
      );
    }
  }

  private async injectFamily(
    service,
    providerKey: string,
    relation: string,
    originalServiceKey: string,
    children = false,
  ) {
    const serviceKey = `${providerKey}${relation.capitalizeFirstLetter()}Service`;

    const relModel = this.moduleRef.get(
      getModelToken(this.modelTokens[relation].modelName),
      {
        strict: false,
      },
    );
    const relRepository = new GenericRepository<Collection>(relModel);

    const relProvider = await this[
      `inject${providerKey.capitalizeFirstLetter()}Service`
    ](relation, relRepository, {}, false);

    if (children) relProvider[originalServiceKey] = service;

    service[serviceKey] = relProvider;
  }

  async injectGetService<Collection>(
    entity: string,
    repository: GenericRepository<any>,
    customProvider?: CustomProvider,
    children = true,
  ) {
    return this.injectService(
      entity,
      repository,
      GenericGetService<Collection, Collection, Search>,
      'get',
      customProvider,
      children,
    );
  }

  async injectUpdateService<Collection>(
    entity: string,
    repository: GenericRepository<any>,
    customProvider?: CustomProvider,
    children = true,
  ) {
    return this.injectService(
      entity,
      repository,
      GenericUpdateService<
        Collection,
        Collection & Document,
        Search,
        AbstractBodyDto
      >,
      'update',
      customProvider,
      children,
    );
  }

  async injectCreateService<Collection>(
    entity: string,
    repository: GenericRepository<any>,
    customProvider?: CustomProvider,
    children = true,
  ) {
    return this.injectService(
      entity,
      repository,
      GenericCreateService<Collection, Collection & Document, AbstractBodyDto>,
      'create',
      customProvider,
      children,
    );
  }

  private getInstance(
    entity: string,
    repository: GenericRepository<Collection>,
    genericClass,
    providerKey: string,
    customProvider?: CustomProvider,
  ): { args: any[]; classService } {
    let classService = genericClass;
    const defaultArgs = [
      this.fieldSchemaData,
      this.entitySchemaData,
      this.translationService,
      this.errorService,
      this.request,
      this.scopeKey,
    ];

    let args = [repository, entity, ...defaultArgs];

    if (customProvider && customProvider[providerKey]) {
      classService = customProvider[providerKey].className;
      args = [repository, ...defaultArgs];
      const injectArgs = customProvider[providerKey].injectArgs;
      if (injectArgs && injectArgs.length) {
        for (const arg of injectArgs) {
          args.push(this.moduleRef.get(arg, { strict: false }));
        }
      }
    }

    return { args, classService };
  }
}

function createInstance<T>(
  classReference: { new (...args: any[]): T },
  ...args: any[]
): T {
  return new classReference(...args);
}
