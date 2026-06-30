import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma';

// Name of the httpOnly cookie that carries the JWT.
export const AUTH_COOKIE = 'token';

// The JWT only carries the user id; the authoritative role/active flag is read
// fresh from the DB on every request (see `authenticate`), so deleting or
// deactivating a user invalidates their session on their next action.
interface TokenPayload {
  userId: string;
}

// What downstream handlers see — loaded from the DB, never trusted from the client.
export interface AuthUser {
  id: string;
  name: string;
  username: string;
  role: UserRole;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function getToken(req: Request): string | undefined {
  // Prefer the httpOnly cookie; fall back to a Bearer header (useful for tests).
  return req.cookies?.[AUTH_COOKIE] ?? req.headers.authorization?.split(' ')[1];
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = getToken(req);
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET as string) as TokenPayload;
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }

  // Load the user fresh — a deleted/deactivated account is rejected immediately.
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, name: true, username: true, role: true, active: true },
  });
  if (!user || !user.active) {
    res.status(401).json({ error: 'Session no longer valid' });
    return;
  }

  req.user = { id: user.id, name: user.name, username: user.username, role: user.role };
  next();
}

// Route-group guard. Returns 403 for an authenticated user whose role is not
// in the allow-list. Enforced on the server independently of any UI hiding.
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
