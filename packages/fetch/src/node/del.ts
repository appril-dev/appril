import {
  type DataParams,
  type DelOptions,
  buildRequest,
  stringifyData,
} from "./base";

export default function del<T = unknown>(
  url: string | URL,
  data: string | DataParams = {},
  options: DelOptions = {},
) {
  /** Transfer-Encoding:chunked needed to allow write data to request
   * https://github.com/nodejs/node/issues/19179
   */
  const headers = {
    "Transfer-Encoding": "chunked",
    ...options.headers,
  };

  return buildRequest<T>(
    url,
    { ...options, method: "DELETE" },
    headers,
    (request) => {
      if (data) {
        request.write(stringifyData(request, data));
      }

      request.end();
    },
  );
}
