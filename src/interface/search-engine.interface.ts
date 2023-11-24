export interface SearchEngine {
  key: string;
  operator: SearchEgineOperators;
}

export enum SearchEgineOperators {
  LIKE = 'like',
  IN = 'in',
  BETWEEN = 'between',
  GT = 'gt',
  LT = 'lt',
  GE = 'ge',
  LE = 'le'
}
