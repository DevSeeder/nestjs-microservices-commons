import { RelationField } from 'src/microservice/domain/interface/relation-field.interface';

export interface GroupByResult {
  totalSum?: number;
  avg?: number;
  count?: number;
}

export type GroupByResponse = {
  [key: string]: RelationField;
} & {
  groupResult: GroupByResult;
};
