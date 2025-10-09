import { AUTH_ERROR_MESSAGES, CACHE_SETTINGS } from "../constants/auth";

export class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: Response
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export class HttpClient {
  static async get<T>(url: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
      ...options,
      method: "GET",
      credentials: CACHE_SETTINGS.INCLUDE_CREDENTIALS,
      headers: {
        ...CACHE_SETTINGS.NO_CACHE,
        ...options.headers,
      },
    });

    return this.handleResponse<T>(response);
  }

  static async post<T>(url: string, data?: unknown, options: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
      ...options,
      method: "POST",
      credentials: CACHE_SETTINGS.INCLUDE_CREDENTIALS,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    return this.handleResponse<T>(response);
  }

  static async patch<T>(url: string, data?: unknown, options: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
      ...options,
      method: "PATCH",
      credentials: CACHE_SETTINGS.INCLUDE_CREDENTIALS,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    return this.handleResponse<T>(response);
  }

  static async put<T>(url: string, data?: unknown, options: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
      ...options,
      method: "PUT",
      credentials: CACHE_SETTINGS.INCLUDE_CREDENTIALS,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    return this.handleResponse<T>(response);
  }

  static async delete<T>(url: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
      ...options,
      method: "DELETE",
      credentials: CACHE_SETTINGS.INCLUDE_CREDENTIALS,
    });

    return this.handleResponse<T>(response);
  }

  private static async handleResponse<T>(response: Response): Promise<T> {
    if (response.status === 401) {
      throw new HttpError(AUTH_ERROR_MESSAGES.SESSION_EXPIRED, 401, response);
    }

    if (!response.ok) {
      const errorText = await this.getErrorText(response);
      throw new HttpError(errorText, response.status, response);
    }

    return this.getResponseData<T>(response);
  }

  private static async getErrorText(response: Response): Promise<string> {
    try {
      const errorData = await response.json();
      return errorData.message || response.statusText;
    } catch {
      return response.statusText || AUTH_ERROR_MESSAGES.NETWORK_ERROR;
    }
  }

  private static async getResponseData<T>(response: Response): Promise<T> {
    const contentType = response.headers.get("content-type");
    
    if (contentType && contentType.includes("application/json")) {
      return response.json();
    }
    
    return response.text() as any;
  }
}