import type { DataParams, PutOptions } from "./@types";
import { buildRequest, stringifyData } from "./_helpers";

export default function put<T = unknown>(
  url: string | URL,
  data: string | DataParams = {},
  options: PutOptions = {},
) {
  return buildRequest<T>(
    url,
    { ...options, method: "PUT" },
    { ...options.headers },
    (request) => {
      if (!request.getHeader("Content-Type")) {
        request.setHeader("Content-Type", "application/x-www-form-urlencoded");
      }

      if (data) {
        request.write(stringifyData(request, data));
      }

      request.end();
    },
  );
}
