import { ApiError } from "../api/http";

export function toUserSafeErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 401:
        return "Your session has expired. Please sign in again.";
      case 403:
        return "You don't have permission to do that.";
      case 422:
        return error.message || "Please check the highlighted fields and try again.";
      case 409:
        return error.message || "That action can't be completed right now — please refresh and try again.";
      default:
        if (error.status >= 500) {
          return "Something went wrong on our end. Please try again in a moment.";
        }
        return error.message || "Something went wrong.";
    }
  }

  return "Couldn't reach the server. Check your connection and try again.";
}
