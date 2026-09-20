export type PageSearchParams = {
  lang?: string;
  zone?: string;
  [key: string]: string | string[] | undefined;
};

export type PageParamsPromise<T = Record<string, string>> = Promise<T>;
export type PageSearchParamsPromise = Promise<PageSearchParams>;
