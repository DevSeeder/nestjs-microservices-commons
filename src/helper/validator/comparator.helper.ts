import { DynamicValueService } from '../../service/dynamic/get-dynamic-value.service';
import {
  ErrorService,
  GetTranslationService,
} from '@devseeder/nestjs-microservices-schemas';
import { CompareOperators } from '@devseeder/nestjs-microservices-schemas';
import { ErrorKeys } from '../../enum/error-keys.enum';

export class ComparatorHelper {
  constructor(
    private readonly errorService: ErrorService,
    private readonly translationService: GetTranslationService,
    private readonly entityLabels = [],
  ) {}

  static compare(
    valueA: any,
    valueB: any,
    operator: CompareOperators,
    type: string,
  ): boolean {
    switch (type) {
      case 'text':
      case 'varchar':
      case 'string':
        valueA = String(valueA);
        valueB = String(valueB);
      case 'number':
      case 'double':
      case 'integer':
        valueA = Number(valueA);
        valueB = Number(valueB);
        break;
      default:
        return ComparatorHelper.compareValues(valueA, valueB, operator);
    }
  }

  static compareValues(
    valueA: any,
    valueB: any,
    operator: CompareOperators,
  ): boolean {
    switch (operator) {
      case CompareOperators.GREATER_THAN:
        return valueA > valueB;
      case CompareOperators.GREATER_THAN_EQUAL:
        return valueA >= valueB;
      case CompareOperators.LOWER_THAN:
        return valueA < valueB;
      case CompareOperators.LOWER_THAN_EQUAL:
        return valueA <= valueB;
      case CompareOperators.NOT_EQUAL:
        return valueA != valueB;
      case CompareOperators.EQUAL:
        return valueA == valueB;
      case CompareOperators.IN:
        return valueB.includes(valueA);
      case CompareOperators.NOT_IN:
        return !valueB.includes(valueA);
      case CompareOperators.LIKE:
        return (valueA as string).indexOf(valueB) > -1;
      case CompareOperators.BETWEEN:
        return valueA >= valueB[0] && valueA <= valueB[1];
      case CompareOperators.BEGINS_WITH:
        return valueA.startsWith(valueB);
      case CompareOperators.ENDS_WITH:
        return (valueA as string).endsWith(valueB);
      case CompareOperators.CONTAINS:
        return valueA.includes(valueB);
      case CompareOperators.NOT_CONTAINS:
        return !valueA.includes(valueB);
    }
  }

  async getComparatorError(
    key: string,
    value: any,
    operator: CompareOperators,
  ): Promise<void> {
    const valueB = new DynamicValueService(
      this.translationService,
    ).getValueMessage(value, value);

    const compKey = await this.translationService.getFieldTranslation(
      this.entityLabels,
      key,
    );
    switch (operator) {
      case CompareOperators.GREATER_THAN:
      case CompareOperators.GREATER_THAN_EQUAL:
      case CompareOperators.LOWER_THAN:
      case CompareOperators.LOWER_THAN_EQUAL:
      case CompareOperators.NOT_EQUAL:
      case CompareOperators.EQUAL:
      case CompareOperators.LIKE:
      case CompareOperators.BEGINS_WITH:
      case CompareOperators.ENDS_WITH:
      case CompareOperators.CONTAINS:
      case CompareOperators.NOT_CONTAINS:
        this.errorService.throwError(
          this.getEnumKeyByEnumValue<ErrorKeys>(CompareOperators, operator),
          {
            key: compKey.fieldLabel,
            value: valueB,
          },
        );
        break;
      case CompareOperators.IN:
      case CompareOperators.NOT_IN:
      case CompareOperators.BETWEEN:
        this.errorService.throwError(
          this.getEnumKeyByEnumValue<ErrorKeys>(CompareOperators, operator),
          {
            key: compKey.fieldLabel,
            value: valueB.join(','),
          },
        );
      default:
        this.errorService.throwError(ErrorKeys.INVALID_DATA, {
          key: 'Comparator',
          value: compKey.fieldLabel,
        });
    }
  }

  getEnumKeyByEnumValue<EnumType>(
    myEnum: any,
    enumValue: string,
  ): EnumType | null {
    const keys = Object.keys(myEnum).filter(
      (x) => myEnum[x as unknown as string] == enumValue,
    );
    return keys.length > 0 ? (keys[0] as EnumType) : null;
  }
}
