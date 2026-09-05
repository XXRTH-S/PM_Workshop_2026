import { Router } from "express";
import { prisma } from "../lib/prisma";
import {
  requireAuth,
  signToken,
  verifyPassword,
  type AuthPayload,
  type Role,
} from "../lib/auth";
import { logActivity } from "../lib/activity";

export const authRouter = Router();

// POST /api/auth/login — { username, password } → { token, user }
authRouter.post("/login", async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    return res.status(400).json({ error: "กรอก username และ password" });
  }
  const u = await prisma.user.findUnique({ where: { username: String(username) } });
  if (!u || !(await verifyPassword(String(password), u.passwordHash))) {
    logActivity(req, "LOGIN_FAILED", "username/password ไม่ถูกต้อง", {
      username: String(username),
    });
    return res.status(401).json({ error: "username หรือ password ไม่ถูกต้อง" });
  }
  if (u.status !== "A") {
    logActivity(req, "LOGIN_FAILED", "บัญชีพ้นสภาพ (status=X)", {
      userId: u.id,
      username: u.username,
      role: u.role,
    });
    return res
      .status(403)
      .json({ error: "บัญชีนี้พ้นสภาพแล้ว ไม่สามารถเข้าสู่ระบบได้" });
  }
  const payload: AuthPayload = {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    role: u.role as Role,
  };
  logActivity(req, "LOGIN", `เข้าสู่ระบบ (${u.role})`, {
    userId: u.id,
    username: u.username,
    role: u.role,
  });
  res.json({ token: signToken(payload), user: payload });
});

// GET /api/auth/me — ตรวจ token ปัจจุบัน (ใช้ตอนเปิดเว็บเพื่อ restore session)
authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/logout — บันทึกการออกจากระบบ (JWT ไม่มี state, frontend เรียกก่อนล้าง token)
authRouter.post("/logout", requireAuth, (req, res) => {
  logActivity(req, "LOGOUT", "ออกจากระบบ");
  res.json({ ok: true });
});
