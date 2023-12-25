import { FieldItemSchema } from 'src/microservice/domain/interface/field-schema.interface';

export class SortHelper {
  static orderBy<Response>(
    items: Array<Response>,
    fieldSchema: FieldItemSchema[],
    sort: object,
    hasExternal: boolean
  ): Array<Response> {
    if (!hasExternal || !sort || !Object.keys(sort).length) return items;

    const sortKeys = Object.keys(sort);
    const sortItems = items.sort((a, b) => {
      let orderResult = 0;
      sortKeys.forEach((key) => {
        if (a[key] === b[key]) return;

        const isFK = fieldSchema.filter(
          (schema) =>
            key === schema.key && schema.orderBy && schema.type === 'externalId'
        );

        orderResult =
          isFK.length && !Array.isArray(a[key])
            ? SortHelper.compare(a[key].value, b[key].value, sort[key])
            : SortHelper.compare(a[key], b[key], sort[key]);
      });
      return orderResult;
    });
    return sortItems;
  }

  static compare(a: any, b: any, mode: number): number {
    if (Array.isArray(a)) return SortHelper.compareArray(a, b, mode);
    if (typeof a == 'string')
      return mode === 1 ? a.localeCompare(b) : b.localeCompare(a);
    return mode === 1 ? a - b : b - a;
  }

  static compareArray(a: any, b: any, mode: number): number {
    if (!a.length) return mode === 1 ? -1 : 1;
    if (!b.length) return mode === 1 ? 1 : -1;

    const valueA = a.sort((value1, value2) =>
      SortHelper.compare(value1, value2, mode)
    );
    const valueB = b.sort((value1, value2) =>
      SortHelper.compare(value1, value2, mode)
    );

    let compareFn = 0;
    let i = 0;
    do {
      compareFn = SortHelper.compare(valueA[i].value, valueB[i].value, mode);

      i++;

      if (i == valueA.length && i < valueB.length)
        compareFn = mode === 1 ? -1 : 1;
      if (i == valueB.length && i < valueA.length)
        compareFn = mode === 1 ? 1 : -1;
    } while (compareFn === 0 && i < valueA.length && i < valueB.length);
    return compareFn;
  }
}
