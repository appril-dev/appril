export type MaybeRef<T> = T;

export const unref: <T = unknown>(data: MaybeRef<T>) => T = (data) => data;
