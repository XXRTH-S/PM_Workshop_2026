import "dotenv/config";
import express from "express";
import cors from "cors";
import { prisma } from "./lib/prisma";
import { equipmentRouter } from "./routes/equipment";
import { pmRouter } from "./routes/pm";
import { alertRouter } from "./routes/alert";
import { reportRouter } from "./routes/report";
import { authRouter } from "./routes/auth";
import { checkRouter } from "./routes/check";
import { requireAuth } from "./lib/auth";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// login ไม่ต้องมี token (สาธารณะ)
app.use("/api/auth", authRouter);

// ทุก endpoint ด้านล่างต้องเข้าสู่ระบบก่อน (มี token ที่ถูกต้อง)
app.use("/api", requireAuth);

// กลุ่มอุปกรณ์ (สำหรับ dropdown ฝั่งหน้าเว็บ)
app.get("/api/groups", async (_req, res) => {
  const groups = await prisma.equipmentGroup.findMany({ orderBy: { groupCode: "asc" } });
  res.json(groups.map((g) => ({ ...g, costPerPm: Number(g.costPerPm) })));
});

app.use("/api/equipment", equipmentRouter);
app.use("/api/pm", pmRouter);
app.use("/api/alerts", alertRouter);
app.use("/api/reports", reportRouter);
app.use("/api/check-items", checkRouter);

// ตัวจัดการ error รวม
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "เกิดข้อผิดพลาดในระบบ", detail: String(err?.message ?? err) });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => console.log(`API พร้อมใช้งานที่ http://localhost:${port}`));
