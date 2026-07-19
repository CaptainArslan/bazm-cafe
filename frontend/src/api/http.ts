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

type AuthedRequestOptions = RequestOptions & {
  /** @internal set by the retry-after-refresh path; callers never set this. */
  _isRetryAfterRefresh?: boolean;
};

type AuthIntegration = {
  getToken: () => string | null;
  refresh: () => Promise<string | null>;
  onUnauthorized: () => void;
};

let authIntegration: AuthIntegration = {
  getToken: () => null,
  refresh: () => Promise.resolve(null),
  onUnauthorized: () => {},
};

let inFlightRefresh: Promise<string | null> | null = null;

export function configureAuthIntegration(config: AuthIntegration): void {
  authIntegration = config;
}

function refreshOnce(): Promise<string | null> {
  if (!inFlightRefresh) {
    inFlightRefresh = authIntegration.refresh().finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
}

async function request<T>(path: string, options: AuthedRequestOptions = {}, useAuth = false): Promise<T> {
  const { body, headers, _isRetryAfterRefresh, ...rest } = options;

  const token = useAuth ? authIntegration.getToken() : null;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(body !== undefined && { "Content-Type": "application/json" }),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...headers,
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });

  const payload = (await response.json().catch(() => null)) as
    | ApiSuccessBody<T>
    | ApiErrorBody
    | null;

  if (!response.ok || !payload || payload.success === false) {
    if (useAuth && response.status === 401 && !_isRetryAfterRefresh) {
      const newToken = await refreshOnce();
      if (newToken) {
        return request<T>(path, { ...options, _isRetryAfterRefresh: true }, true);
      }
      authIntegration.onUnauthorized();
    }

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
    request<T>(path, { ...options, method: "GET" }, false),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }, false),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }, false),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PUT", body }, false),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "DELETE" }, false),
};

export const authHttp = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "GET" }, true),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }, true),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }, true),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PUT", body }, true),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "DELETE" }, true),
};
