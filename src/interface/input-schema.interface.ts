import { ObjectSchema } from 'joi';

export interface InputSchema {
  search?: ObjectSchema;
  groupBy?: ObjectSchema;
  count?: ObjectSchema;
  update?: ObjectSchema;
  create?: ObjectSchema;
  cloneOne?: ObjectSchema;
  cloneMany?: ObjectSchema;
  activation?: ObjectSchema;
}

export interface RequestSchema {
  entity: InputSchema;
  parents?: {
    [key: string]: InputSchema[];
  };
  children?: {
    [key: string]: InputSchema[];
  };
}
