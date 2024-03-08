import {
  Controller,
  Get,
  Inject,
  Param,
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

import { ErrorKeys } from '../../enum/error-keys.enum';
import {
  CountResponse,
  PaginatedResponse,
} from '../../dto/response/paginated.response';
import { GroupByResponse } from '../../dto/response/groupby/group-by.response';
import { FormSchemaResponse } from '../../interface/field-schema.interface';
import { GenericGetService } from '../../service/abstract/generic-get.service';

const allKey = 'GET';

export function GenericGetController<
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
  class GenericGetControllerHost extends AbstractController<
    Collection,
    GetResponse,
    SearchParams,
    BodyDto
  > {
    constructor(
      @Inject(`GENERIC_GET_SERVICE_${entity}`)
      readonly getService?: GenericGetService<
        Collection,
        GetResponse,
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
    @MetaScope({ entity, accessKey: 'GET_BY_ID' })
    @Get(`/:id`)
    async getById(@Param('id') id: string): Promise<GetResponse> {
      return this.getService.getById(id, true);
    }

    @UseGuards(authGuard)
    @MetaScope({ entity, accessKey: 'SEARCH_BY_ID' })
    @Get(`/search/:searchId`)
    async searchBy(
      @Query() params: SearchParams,
      @Param('searchId') searchId: string,
    ): Promise<PaginatedResponse<GetResponse>> {
      this.isMethodAllowed('searchBy');

      if (params[this.entitySchema.searchKey] !== undefined)
        this.errorService.throwError(ErrorKeys.NOT_ALLOWED, {
          key: this.entitySchema.searchKey,
        });

      await this.schemaValidator.validateRequestSchema(
        this.requestSchema,
        'search',
        params,
        this.fieldSchemaData,
        true,
      );

      if (this.entitySchema.searchKey)
        params[this.entitySchema.searchKey] = searchId;

      return this.getService.search(params);
    }

    @UseGuards(authGuard)
    @MetaScope({ entity, accessKey: 'SEARCH_ALL' })
    @Get(`/`)
    async searchAll(
      @Query() params: SearchParams,
    ): Promise<PaginatedResponse<GetResponse>> {
      await this.schemaValidator.validateRequestSchema(
        this.requestSchema,
        'search',
        params,
        this.fieldSchemaData,
        true,
      );
      return this.getService.search(params);
    }

    @UseGuards(authGuard)
    @MetaScope({ entity, accessKey: 'COUNT' })
    @Get(`/meta/count`)
    async count(@Query() params: SearchParams): Promise<CountResponse> {
      await this.schemaValidator.validateRequestSchema(
        this.requestSchema,
        'count',
        params,
        this.fieldSchemaData,
        true,
      );
      return this.getService.count(params);
    }

    @UseGuards(authGuard)
    @MetaScope({ entity, accessKey: 'GET_FORM' })
    @Get(`/form/fields`)
    getForm(): Promise<FormSchemaResponse> {
      return this.getService.getForm();
    }

    @UseGuards(authGuard)
    @MetaScope({ entity, accessKey: 'GROUP_BY' })
    @Get(`/groupby/:relation`)
    async groupBy(
      @Param('relation') relation: string,
      @Query() params: SearchParams,
    ): Promise<GroupByResponse[]> {
      this.isMethodAllowed('groupby');
      await this.schemaValidator.validateRequestSchema(
        this.requestSchema,
        'groupBy',
        params,
        this.fieldSchemaData,
        true,
      );
      return this.getService.groupBy(relation, params);
    }
  }

  Object.defineProperty(GenericGetControllerHost, 'name', {
    value: `Generic${entity.capitalizeFirstLetter()}GetController`,
  });

  return GenericGetControllerHost;
}
