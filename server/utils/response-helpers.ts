import type { Response } from "express";
import { ERROR_MESSAGES } from "../constants/auth";

export class ApiResponse {
  static success<T>(res: Response, data: T, statusCode: number = 200) {
    return res.status(statusCode).json(data);
  }

  static error(res: Response, message: string, statusCode: number = 400) {
    return res.status(statusCode).json({ message });
  }

  static unauthorizedError(res: Response, message: string = ERROR_MESSAGES.NOT_AUTHENTICATED) {
    return this.error(res, message, 401);
  }

  static forbiddenError(res: Response, message: string) {
    return this.error(res, message, 403);
  }

  static notFoundError(res: Response, message: string = ERROR_MESSAGES.USER_NOT_FOUND) {
    return this.error(res, message, 404);
  }

  static internalServerError(res: Response, message: string = ERROR_MESSAGES.INTERNAL_SERVER_ERROR) {
    return this.error(res, message, 500);
  }
}

export function handleAsyncRoute(handler: Function) {
  return async (req: any, res: Response) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error("Route error:", error);
      ApiResponse.internalServerError(res);
    }
  };
}