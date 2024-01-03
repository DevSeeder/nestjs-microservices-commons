import { FieldSchema } from '@devseeder/nestjs-microservices-schemas';

export interface FormSchemaResponse {
  fields: Array<FieldSchema & FormFieldResponse>;
  filterOptions?: {
    orderBy?: FieldOrder[];
  };
  cloneRelations?: Array<{
    relation: string;
    label: string;
  }>;
  entityRefs?: {
    entity: string;
    label: string;
    forbiddenMethods: string[];
  };
}

export interface FormFieldResponse {
  projectKey?: string;
  entity?: string;
  values?: FieldValue[];
}

export interface FieldValue {
  id: string;
  value: any;
}

export interface FieldOrder {
  label: string;
  key: string;
}

export enum FieldSchemaPage {
  SEARCH = 'search',
  UPDATE = 'update',
  CREATE = 'create',
}
