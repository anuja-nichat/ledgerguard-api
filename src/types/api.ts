export type ApiMeta = Record<string, unknown>;

export type ApiErrorPayload = {
  code: string;
  message: string;
  details: unknown[];
};

export type ApiSuccessResponse<T> = {
  success: true;
  data: T;
  meta: ApiMeta;
};

export type ApiErrorResponse = {
  success: false;
  error: ApiErrorPayload;
};
