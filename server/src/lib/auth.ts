// ระบบ login: bcrypt ตรวจรหัสผ่าน + JWT token + middleware กันสิทธิ์
import type { NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "pm-workshop-dev-secret-change-me";
const TOKEN_TTL = "8h";

export type Role = "ADMIN" | "TECHNICIAN";

export interface AuthPayload {
  id: number;
  username: string;
  displayName: string;
  role: Role;
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function readToken(req: Request): AuthPayload | null {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(h.slice(7), JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
}

// แนบ user เข้า req ถ้ามี token ที่ถูกต้อง
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

/** ต้อง login ก่อน (มี token ที่ถูกต้อง) */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const u = readToken(req);
  if (!u) return res.status(401).json({ error: "ต้องเข้าสู่ระบบก่อน" });
  req.user = u;
  next();
}

/** ต้องมี role ที่กำหนด (เช่น ADMIN เท่านั้น) */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const u = readToken(req);
    if (!u) return res.status(401).json({ error: "ต้องเข้าสู่ระบบก่อน" });
    if (!roles.includes(u.role)) {
      return res.status(403).json({ error: "ไม่มีสิทธิ์เข้าถึงส่วนนี้" });
    }
    req.user = u;
    next();
  };
}
