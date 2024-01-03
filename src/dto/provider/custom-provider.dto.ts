export interface CustomProvider {
  get?: ProviderArgs;
  update?: ProviderArgs;
  create?: ProviderArgs;
  repository?: { new (...args: any[]) };
  controller?: CustomController;
}

export interface ProviderArgs {
  className: { new (...args: any[]) };
  injectArgs?: string[];
}

export interface CustomController {
  get?: { new (...args: any[]) };
  update?: { new (...args: any[]) };
  create?: { new (...args: any[]) };
}
