import type { Options as FormidableOptions } from "formidable";

export type TrimOption = Array<string>;

export type Trimmer = (
  fields: Record<string, unknown>,
) => Record<string, unknown>;

type GenericOptions = {
  limit?: number;
  trim?: TrimOption;
};

export type JsonOptions = FormidableOptions & GenericOptions;

export type FormOptions = FormidableOptions &
  GenericOptions & {
    uploadDir?: string;
    multipart?: boolean;
    urlencoded?: boolean;
  };

export type RawOptions = {
  /**
   * The byte limit of the body.
   * If the body ends up being larger than this limit, a 413 error code is returned.
   * */
  limit?: number;

  /**
   * The length of the stream.
   * If the contents of the stream do not add up to this length,
   * an 400 error code is returned
   * */
  length?: number;

  /**
   * The encoding to use to decode the body into a string.
   * By default, a Buffer instance will be returned when no encoding is specified.
   * utf-8 would decode as plain text.
   * use any encoding supported by iconv-lite.
   * */
  encoding?: string;

  /**
   * zlib options
   * */
  chunkSize?: number; // Default: 16 * 1024
};

export type Options = JsonOptions | FormOptions | RawOptions;
