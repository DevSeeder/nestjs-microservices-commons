import { SearchEgineOperators } from '@devseeder/nestjs-microservices-schemas';

// OPERATORS ENUMS
export const SKIP_ENUMS_ALIAS = [SearchEgineOperators.IN];
export const SKIP_ENUMS = [
  SearchEgineOperators.BETWEEN,
  SearchEgineOperators.IN,
];
export const VALIDATE_ID_ENUMS = [
  SearchEgineOperators.IN,
  SearchEgineOperators.NOT_IN,
  SearchEgineOperators.NOT_EQUAL,
];

export enum DependencyInjectorToken {
  SCOPE_KEY = 'SCOPE_KEY',
}
