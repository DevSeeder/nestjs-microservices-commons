import { DynamicValueService } from '../dynamic/get-dynamic-value.service';
import { AbstractEntityLoader } from '../../loader/abstract-entity.loader';
import {
  ErrorService,
  GetTranslationService,
  VALIDATE_ID_ENUMS,
} from '@devseeder/nestjs-microservices-schemas';
import { Inject } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';

import {
  AuthenticatorExtractorHelper,
  JWTPayload,
} from '@devseeder/nestjs-microservices-core';
import {
  EntitySchema,
  FieldSchema,
  SearchEgineOperators,
} from '@devseeder/nestjs-microservices-schemas';
import { AbstractDocument } from '../../schema/abstract.schema';
import { Relation } from '../../interface/relation.interface';
import { ErrorKeys } from '../../enum/error-keys.enum';
import { GenericRepository } from '../../mongoose/generic.repository';

export class AbstractDBService<
  Collection,
  MongooseModel,
  ResponseModel,
> extends AbstractEntityLoader {
  constructor(
    protected readonly repository: GenericRepository<Collection>,
    protected readonly entity: string,
    protected readonly fieldSchemaData: FieldSchema[] = [],
    protected readonly entitySchemaData: EntitySchema[] = [],
    protected readonly translationService?: GetTranslationService,
    protected readonly errorService?: ErrorService,
    @Inject(REQUEST) protected readonly request?: Request,
    protected readonly scopeKey?: string,
  ) {
    super(entity, fieldSchemaData, entitySchemaData);
  }

  protected async convertRelation(
    item: Partial<MongooseModel> | Partial<AbstractDocument>,
    validateInput = true,
  ): Promise<ResponseModel> {
    if (!item || !Object.keys(item).length) return null;

    const relations = this.fieldSchemaDb.filter(
      (schema) => schema.type === 'externalId',
    );
    const itemResponse = { ...item } as unknown as ResponseModel;
    for await (const schema of relations) {
      await this.convertRelationItem(schema, item, itemResponse, validateInput);
    }

    return this.getDynamicValues(itemResponse) as ResponseModel;
  }

  private async convertRelationItem(
    schema: FieldSchema,
    item: Partial<MongooseModel> | Partial<AbstractDocument>,
    itemResponse: ResponseModel,
    validateInput = true,
  ) {
    const rel: Relation = {
      key: schema.key,
      service: schema.externalRelation.service,
      refKey: schema.externalRelation['refKey'] || undefined,
    };

    let keys: Array<SearchEgineOperators | ''> = [''];

    if (
      schema.searchEgines &&
      schema.searchEgines.find((op) =>
        Object.values(VALIDATE_ID_ENUMS).includes(op),
      )
    ) {
      keys = ['', ...Object.values(VALIDATE_ID_ENUMS)];
    }

    const value = item[rel.key];
    let isNormalValidation = true;
    for await (const key of keys) {
      const validationRes = await this.validateOperatorFields(
        key.length ? `${rel.key}_${key}` : rel.key,
        item,
        itemResponse,
        rel,
        key,
        validateInput,
      );

      if (!validationRes) isNormalValidation = false;
    }

    if (!isNormalValidation || value === undefined) return;

    itemResponse[rel.key] = {
      id: value,
      value: await this.convertValueRelation(rel, value, validateInput),
    };
  }

  private async validateOperatorFields(
    key: string,
    item: Partial<MongooseModel> | Partial<AbstractDocument>,
    itemResponse: ResponseModel,
    relation: Relation,
    operator: SearchEgineOperators | '',
    validateInput = true,
  ): Promise<boolean> {
    let value = item[key];

    if (value === undefined) return true;

    if (!Array.isArray(value) && String(value).split(',').length > 1)
      value = value.split(',');

    if (Array.isArray(value) && value.length) {
      const relPromises = value.map(async (val) => {
        return {
          id: val,
          value: await this.convertValueRelation(relation, val, validateInput),
        };
      });

      itemResponse[key] = await Promise.all(relPromises);
      return false;
    }

    if (
      operator !== '' &&
      Object.values(VALIDATE_ID_ENUMS).includes(operator)
    ) {
      await this.convertValueRelation(relation, value);
      return false;
    }
    return true;
  }

  protected async convertValueRelation(
    rel: Relation,
    value: string,
    validateInput = true,
  ): Promise<any> {
    if (!value || (Array.isArray(value) && !value.length)) return null;

    let objValue;
    try {
      const serviceKey = `get${rel.service.capitalizeFirstLetter()}Service`;
      if (rel?.refKey) {
        objValue = await this[serviceKey].search({ [rel?.refKey]: value });
      } else objValue = await this[serviceKey].getById(value);
    } catch (err) {
      this.logger.error(`Error searching id: ${JSON.stringify(err)}`);
      this.logger.error(err);
      this.errorService.throwError(ErrorKeys.INVALID_DATA, {
        key: await this.getFieldTranslation(rel.key),
        value,
      });
    }

    const objKey = rel.repoKey ? rel.repoKey : 'name';

    if (objValue === null || objValue === undefined) {
      if (!validateInput) return value;

      this.errorService.throwError(ErrorKeys.INVALID_DATA, {
        key: await this.getFieldTranslation(rel.key),
        value,
      });
    }

    let valueRelation = objValue[objKey];

    if (objValue.translations && objValue.translations.length) {
      const lang = this.translationService.getLang();
      const translation = objValue.translations.filter(
        (tra) => tra.locale == lang,
      );
      valueRelation = translation[0].value;
    }

    return valueRelation;
  }

  protected async validateId(id: string): Promise<MongooseModel> {
    let item;
    try {
      item = await this.repository.findById(id);
    } catch (err) {
      const entityTranslation =
        await this.translationService.getEntityTranslation(
          this.entitySchema.entity,
        );
      this.errorService.throwError(ErrorKeys.NOT_FOUND, {
        key: entityTranslation.itemLabel,
      });
    }
    if (!item) {
      const entityTranslation =
        await this.translationService.getEntityTranslation(
          this.entitySchema.entity,
        );
      this.errorService.throwError(ErrorKeys.NOT_FOUND, {
        key: entityTranslation.itemLabel,
      });
    }

    await this.validateOnlyLoggedUserForItems([item]);

    return item;
  }

  protected async validateOnlyLoggedUser(
    item: Partial<MongooseModel>,
    localUserId: string,
  ) {
    if (!this.entitySchema.userKey) return;

    const loggedUser = this.getLoggedUser();

    if (
      !item[this.entitySchema.userKey] ||
      !loggedUser ||
      !loggedUser.scopes ||
      !loggedUser.scopes.length ||
      !this['getUsersService']
    )
      return;

    if (loggedUser.scopes.includes(`${this.scopeKey}/ADM`)) return;

    this.logger.log(`Validating Only Logged User...`);

    const requestScope = this.request['metaScopes'];

    this.logger.log(`RequestScope: ${JSON.stringify(requestScope)}`);

    const entityScopes = this.entitySchema.authScopes.filter(
      (aut) => aut.accessKey === requestScope.accessKey,
    );

    if (!entityScopes.length) {
      this.logger.warn(
        `No escope for entity ${this.entity} and accessKey ${requestScope.accessKey}`,
      );
      return;
    }

    const onlyLogged = entityScopes[0].scopes.filter(
      (scope) =>
        loggedUser.scopes.includes(`${this.scopeKey}/${scope.key}`) &&
        scope.onlyLoggedUser,
    );

    if (!onlyLogged.length) return;

    this.logger.log(
      `Auth User ${localUserId} == Entity User ${
        item[this.entitySchema.userKey]
      }`,
    );

    if (localUserId !== item[this.entitySchema.userKey])
      await this.errorService.throwError(ErrorKeys.OPERATE_OTHERS_USERS, {
        key: this.entity,
      });
  }

  protected async validateOnlyLoggedUserForItems(
    items: Partial<MongooseModel>[],
  ): Promise<void> {
    if (!this.entitySchema.userKey) return;

    const localUserId = await this.getLocalUserId();

    if (!localUserId) return;

    for await (const item of items) {
      await this.validateOnlyLoggedUser(item, localUserId);
    }
  }

  protected async getLocalUserId(): Promise<string | null> {
    const loggedUser = this.getLoggedUser();
    if (!loggedUser || !this['getUsersService']) return null;

    const userAuthId = loggedUser[this.entitySchema.userKey];

    this.logger.log(`Checking user for idUserAuth ${userAuthId}`);
    const userDB = await this['getUsersService'].search(
      { idUserAuth: userAuthId, select: 'name,username' },
      false,
      false,
    );

    if (!userDB.items.length)
      this.errorService.throwError(ErrorKeys.INVALID_DATA, {
        key: 'Auth User',
        value: userAuthId,
      });

    return userDB.items[0]._id.toString();
  }

  protected getDynamicValues(
    item: Partial<MongooseModel> | Partial<AbstractDocument>,
  ): Partial<MongooseModel> | Partial<AbstractDocument> {
    Object.keys(item)
      .filter(
        (key) =>
          typeof item[key] == 'string' &&
          (item[key].startsWith('@') || item[key].startsWith('$')),
      )
      .forEach((key) => {
        item[key] = DynamicValueService.getDynamicValue(
          item[key],
          item[key],
          item,
        );
      });
    return item;
  }

  protected async getFieldTranslation(key: string): Promise<string> {
    const fieldTranslation = await this.translationService.getFieldTranslation(
      this.entityLabels,
      key,
    );
    return fieldTranslation.fieldLabel;
  }

  protected getLoggedUser(): JWTPayload {
    const payload = AuthenticatorExtractorHelper.extractBearerTokenAuth(
      this.request.headers['authorization'].replace('Bearer ', ''),
    );
    return payload;
  }
}
