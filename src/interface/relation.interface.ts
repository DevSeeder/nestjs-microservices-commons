export interface Relation {
  key: string;
  service: string;
  repoKey?: string;
  refKey?: string | undefined;
  skipTranslate: boolean;
}
