import {
  Body,
  Controller,
  Inject,
  Param,
  Patch,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ErrorService,
  GetTranslationService,
  SchemaDependecyTokens,
} from '@devseeder/nestjs-microservices-schemas';
import {
  EntitySchema,
  FieldSchema,
} from '@devseeder/nestjs-microservices-schemas';
import { AbstractController } from '../abstract/abstract.controller';
import { MetaScope } from '@devseeder/nestjs-microservices-core';

import { ActivationQueryParams } from '../../dto/query/activation-query-params.dto';
import { GenericUpdateService } from '../../service/abstract/generic-update.service';

const allKey = 'UPDATE';

export function GenericUpdateController<
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
  class GenericUpdateControllerHost extends AbstractController<
    Collection,
    GetResponse,
    SearchParams,
    BodyDto
  > {
    constructor(
      @Inject(`GENERIC_UPDATE_SERVICE_${entity}`)
      readonly updateService?: GenericUpdateService<
        Collection,
        GetResponse,
        BodyDto,
        SearchParams
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
    @MetaScope({ entity, accessKey: 'INACTIVATE' })
    @Patch(`inactivate/:id`)
    async inactivate(
      @Param('id') id: string,
      @Query() queryParams: ActivationQueryParams,
    ): Promise<void> {
      this.isMethodAllowed('inactivate');
      await this.schemaValidator.validateRequestSchema(
        this.requestSchema,
        'activation',
        queryParams,
      );
      await this.updateService.activation(
        id,
        false,
        queryParams.cascadeRelations,
      );
    }

    @UseGuards(authGuard)
    @MetaScope({ entity, accessKey: 'ACTIVATE' })
    @Patch(`activate/:id`)
    async activate(
      @Param('id') id: string,
      @Query() queryParams: ActivationQueryParams,
    ): Promise<void> {
      this.isMethodAllowed('activate');
      await this.schemaValidator.validateRequestSchema(
        this.requestSchema,
        'activation',
        queryParams,
      );
      await this.updateService.activation(
        id,
        true,
        queryParams.cascadeRelations,
      );
    }

    @UseGuards(authGuard)
    @MetaScope({ entity, accessKey: 'UPDATE_BY_ID' })
    @Patch(`/:id`)
    async updateById(
      @Param('id') id: string,
      @Body() body: BodyDto,
    ): Promise<void> {
      this.isMethodAllowed('updateById');
      await this.schemaValidator.validateRequestSchema(
        this.requestSchema,
        'update',
        body,
        this.fieldSchemaData,
      );
      await this.updateService.updateById(id, body as unknown as BodyDto);
    }

    @UseGuards(authGuard)
    @MetaScope({ entity, accessKey: 'UPDATE_MANY' })
    @Patch(`/`)
    async updateBy(
      @Query() params: SearchParams,
      @Body() body: BodyDto,
    ): Promise<void> {
      this.isMethodAllowed('updateBy');
      await this.schemaValidator.validateRequestSchema(
        this.requestSchema,
        'search',
        params,
        [],
        true,
      );
      await this.schemaValidator.validateRequestSchema(
        this.requestSchema,
        'update',
        body,
        this.fieldSchemaData,
      );
      await this.updateService.updateBy(params, body);
    }
  }

  Object.defineProperty(GenericUpdateControllerHost, 'name', {
    value: `Generic${entity.capitalizeFirstLetter()}UpdateController`,
  });

  return GenericUpdateControllerHost;
}
