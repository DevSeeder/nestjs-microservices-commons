import {
  Body,
  Controller,
  Inject,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ErrorService,
  GetTranslationService,
  SchemaDependecyTokens,
} from '@devseeder/nestjs-microservices-schemas';
import { ObjectId } from 'mongoose';
import {
  EntitySchema,
  FieldSchema,
} from '@devseeder/nestjs-microservices-schemas';
import { AbstractController } from '../abstract/abstract.controller';
import { MetaScope } from '@devseeder/nestjs-microservices-core';
import {
  ClonyManyBodyDto,
  ClonyOneBodyDto,
} from '../../dto/body/clone-body.dto';
import {
  CloneManyResponse,
  CloneOneResponse,
} from '../../dto/response/clone.response';
import { GenericCreateService } from '../../service/abstract/generic-create.service';

const allKey = 'CREATE';

export function GenericCreateController<
  Collection,
  GetResponse,
  SearchParams,
  BodyDto,
>({
  entity,
  authGuard,
  interceptor,
}: {
  entity: string;
  authGuard;
  interceptor;
}) {
  @UseInterceptors(interceptor)
  @Controller(entity.toLowerCase())
  class GenericCreateControllerHost extends AbstractController<
    Collection,
    GetResponse,
    SearchParams,
    BodyDto
  > {
    constructor(
      @Inject(`GENERIC_CREATE_SERVICE_${entity}`)
      readonly createService?: GenericCreateService<
        Collection,
        GetResponse,
        BodyDto
      >,
      @Inject(SchemaDependecyTokens.FIELD_SCHEMA_DB)
      readonly fieldSchemaData?: FieldSchema[],
      @Inject(SchemaDependecyTokens.ENTITY_SCHEMA_DB)
      readonly entitySchemaData?: EntitySchema[],
      readonly errorService?: ErrorService,
      readonly translationService?: GetTranslationService,
    ) {
      super(
        entity,
        fieldSchemaData,
        entitySchemaData,
        errorService,
        translationService,
      );
    }

    @UseGuards(authGuard)
    @MetaScope({ entity, accessKey: 'CREATE' })
    @Post(`/`)
    async create(@Body() body: BodyDto): Promise<{ _id: ObjectId }> {
      this.isMethodAllowed('create');
      await this.schemaValidator.validateRequestSchema(
        this.requestSchema,
        'create',
        body,
        this.fieldSchemaData,
      );
      return this.createService.create(body as unknown as BodyDto);
    }

    @UseGuards(authGuard)
    @MetaScope({ entity, accessKey: 'CLONE_ONE' })
    @Post(`/clone/:id`)
    async cloneById(
      @Param('id') id: string,
      @Body() body: ClonyOneBodyDto,
    ): Promise<CloneOneResponse> {
      this.isMethodAllowed('cloneById');
      await this.schemaValidator.validateRequestSchema(
        this.requestSchema,
        'cloneOne',
        body,
        this.fieldSchemaData,
      );
      const response = await this.createService.cloneByIds(
        [id],
        body.cloneRelations,
        body.replaceBody,
      );
      return response[0];
    }

    @UseGuards(authGuard)
    @MetaScope({ entity, accessKey: 'CLONE_MANY' })
    @Post(`/clone`)
    async cloneManyByIds(
      @Body()
      body: ClonyManyBodyDto,
    ): Promise<CloneManyResponse> {
      this.isMethodAllowed('cloneManyByIds');
      await this.schemaValidator.validateRequestSchema(
        this.requestSchema,
        'cloneMany',
        body,
        this.fieldSchemaData,
      );
      return this.createService.cloneByIds(
        body._ids,
        body.cloneRelations,
        body.replaceBody,
      );
    }
  }

  Object.defineProperty(GenericCreateControllerHost, 'name', {
    value: `Generic${entity.capitalizeFirstLetter()}CreateController`,
  });

  return GenericCreateControllerHost;
}
