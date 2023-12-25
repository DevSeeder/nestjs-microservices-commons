export class Search {
  active?: boolean;
  page?: number = 0;
  pageSize?: number = 0;
  orderBy?: string;
  orderMode?: 1 | -1;
  select?: string | undefined;
}
