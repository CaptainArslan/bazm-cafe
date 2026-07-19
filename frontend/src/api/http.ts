const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

type ApiErrorPayload = {
  code: string;
  details?: unknown;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, message: string, error: ApiErrorPayload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = error.code;
    this.details = error.details;
  }
}

type ApiSuccessBody<T> = {
  success: true;
  message: string;
  data?: T;
  meta?: Record<string, unknown>;
};

type ApiErrorBody = {
  success: false;
  message: string;
  error: ApiErrorPayload;
};

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(body !== undefined && { "Content-Type": "application/json" }),
      ...headers,
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });

  const payload = (await response.json().catch(() => null)) as
    | ApiSuccessBody<T>
    | ApiErrorBody
    | null;

  if (!response.ok || !payload || payload.success === false) {
    const errorPayload = payload && payload.success === false ? payload.error : undefined;
    throw new ApiError(
      response.status,
      payload?.message ?? "An unexpected error occurred.",
      errorPayload ?? { code: "UNKNOWN_ERROR" },
    );
  }

  return payload.data as T;
}

export const http = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PUT", body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "DELETE" }),
};
