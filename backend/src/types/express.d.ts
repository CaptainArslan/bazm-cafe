import type { AuthenticatedUser } from "../modules/auth/auth.types.js";
import type { GuestSessionContext } from "../modules/guest-sessions/guest-session.types.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      guestSession?: GuestSessionContext;
    }
  }
}

export {};
