export type ApiEnvelope<T> = {
  status?: boolean;
  message?: string;
  data: T;
};
