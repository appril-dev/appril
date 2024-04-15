export type Config<ItemT = never> = {
  primaryKey: keyof ItemT;
  itemsPerPage: number;
  sidePages: number;
};

export type Pager = {
  totalItems: number;
  totalPages: number;
  currentPage: number;
  nextPage: number;
  prevPage: number;
  offset: number;
};

export type ApiTypes = {
  EnvT?: string;
  ListAssetsT?: string;
  ItemAssetsT?: string;
};

export type ApiTypesLiteral = Record<keyof ApiTypes, boolean>;

export type ApiTemplates = {
  "base.ts"?: string;
  "route.ts"?: string;
};

export type ClientTemplates = {
  "apiTypes.ts"?: string;
  "assets.ts"?: string;

  "ControlButtons.vue"?: string;
  "CreateDialog.vue"?: string;
  "EditorPlaceholder.vue"?: string;

  "fetch.ts"?: string;
  "handlers.ts"?: string;
  "index.ts"?: string;

  "Layout.vue"?: string;
  "Overlay.vue"?: string;
  "Pager.vue"?: string;

  "setup.ts"?: string;
  "store.ts"?: string;
};

export type DefaultTemplates = {
  api: Record<keyof ApiTemplates, { file: string; content: string }>;
  client: Record<keyof ClientTemplates, { file: string; content: string }>;
};
