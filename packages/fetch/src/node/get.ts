import {
  type DataParams,
  type GetOptions,
  buildRequest,
  objToQs,
} from "./base";

export default function get<T = unknown>(
  _url: string | URL,
  data: string | DataParams = {},
  options: GetOptions = {},
) {
  const url = typeof _url === "string" ? new URL(_url) : _url;

  if (data) {
    let qs = "";

    if (typeof data === "string") {
      qs = data;
    } else if (Object.prototype.toString.apply(data) === "[object Object]") {
      qs = objToQs(data);
    } else {
      throw new Error("Data should be a String or an Object");
    }

    if (qs.length) {
      url.search = ["?", url.search.replace("?", ""), "&", qs].join("");
    }
  }

  return buildRequest<T>(
    url,
    { ...options, method: "GET" },
    { ...options.headers },
    (request) => request.end(),
  );
}
