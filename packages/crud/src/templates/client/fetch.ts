import { fetch } from "@appril/fetch";

import { fetchBase, fetchOptions } from "./assets";

export const fetchApi = fetch(fetchBase, {
  ...fetchOptions,
  errorHandler: undefined, // crud module uses own errorHandler
});
