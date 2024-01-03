export type AggregatedDto = AggregatedResultDto & { [key: string]: number };

export interface AggregatedResultDto {
  _id: string[];
  name: string[];
  count: number;
}
