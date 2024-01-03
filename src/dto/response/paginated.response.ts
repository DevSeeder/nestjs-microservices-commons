export class PaginatedResponse<Data> {
  items: Data[];
  meta?: PaginatedMeta;
}

export interface PaginatedMeta {
  currentPage?: number;
  nextPage?: number | undefined;
  hasNext: boolean;
  pageRecords?: number;
  totalRecords: number;
  actualIndex: number;
  numberOfPages?: number;
}

export interface CountResponse {
  totalRecords: number;
}
