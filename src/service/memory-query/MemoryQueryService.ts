import { AbstractService } from '../abstract-service.service';

export interface MemoryQuery {
  entity: string;
  key: string;
  valueKey: any;
  value: any;
}

export class MemoryQueryService extends AbstractService {
  private memoryQuery: MemoryQuery[] = [];

  getMemory(entity: string, key: string, valueKey: any): any | null {
    const item = this.memoryQuery.filter(
      (mem) =>
        mem.entity == entity && mem.key == key && mem.valueKey == valueKey,
    );
    return item.length ? item[0].value : null;
  }

  set(entity: string, key: string, valueKey: any, value: any): void {
    this.memoryQuery.push({
      entity,
      key,
      valueKey,
      value,
    });
  }
}
