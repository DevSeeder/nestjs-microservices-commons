import { RelationField } from '../../../interface/relation-field.interface';

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
