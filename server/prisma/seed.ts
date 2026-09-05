// Seed ข้อมูลตัวอย่างจากโจทย์ PM_WorkShop_2025
// รัน: npm run seed
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// รายการตรวจ PM เริ่มต้น [groupCode, category, label]  (admin แก้/เพิ่มภายหลังได้)
const checkItems: [string, string, string][] = [
  // PRINTER
  ["PRINTER", "HARDWARE", "ทำความสะอาดตัวเครื่อง/ฝุ่น/เศษกระดาษ"],
  ["PRINTER", "HARDWARE", "ตรวจชุดดึงกระดาษ/ลูกยาง"],
  ["PRINTER", "HARDWARE", "ตรวจ/ทำความสะอาดชุดพิมพ์ (drum/หัวพิมพ์/ผ้าหมึก/thermal head)"],
  ["PRINTER", "HARDWARE", "ตรวจระดับหมึก/โทนเนอร์/วัสดุสิ้นเปลือง"],
  ["PRINTER", "HARDWARE", "ทดสอบพิมพ์ test page เช็คคุณภาพงานพิมพ์"],
  ["PRINTER", "HARDWARE", "ตรวจสายไฟ/สาย LAN-USB/ไฟแสดงสถานะ"],
  ["PRINTER", "SOFTWARE", "อัปเดต firmware / ตรวจ driver"],
  ["PRINTER", "SOFTWARE", "ตรวจการเชื่อมต่อเครือข่าย/คิวงานพิมพ์ค้าง"],
  // COMPUTER
  ["COMPUTER", "HARDWARE", "ทำความสะอาดฝุ่นภายใน/ภายนอก/พัดลม"],
  ["COMPUTER", "HARDWARE", "ตรวจพัดลม + อุณหภูมิ CPU/ระบบ"],
  ["COMPUTER", "HARDWARE", "ตรวจสุขภาพ HDD/SSD (S.M.A.R.T.) + พื้นที่ว่าง"],
  ["COMPUTER", "HARDWARE", "ตรวจ RAM/สายไฟ/ขั้วต่อแน่น"],
  ["COMPUTER", "HARDWARE", "ตรวจ Power Supply/UPS/แบต CMOS"],
  ["COMPUTER", "SOFTWARE", "อัปเดต OS / security patch / driver"],
  ["COMPUTER", "SOFTWARE", "อัปเดต + สแกน Antivirus"],
  ["COMPUTER", "SOFTWARE", "ล้างไฟล์ขยะ/temp + ตรวจ Event Log"],
  ["COMPUTER", "SOFTWARE", "ตรวจการสำรองข้อมูล (backup) — สำหรับ Server"],
  // NETWORK
  ["NETWORK", "HARDWARE", "ทำความสะอาด/ฝุ่น/อุณหภูมิตู้ Rack"],
  ["NETWORK", "HARDWARE", "ตรวจไฟ LED สถานะพอร์ต/power"],
  ["NETWORK", "HARDWARE", "ตรวจสาย/หัว RJ45-Fiber/การจัดสาย/label"],
  ["NETWORK", "HARDWARE", "ตรวจ UPS/PoE/สายดิน"],
  ["NETWORK", "SOFTWARE", "อัปเดต firmware"],
  ["NETWORK", "SOFTWARE", "สำรอง config (running-config)"],
  ["NETWORK", "SOFTWARE", "ตรวจ log/error พอร์ต/utilization"],
  ["NETWORK", "SOFTWARE", "ตรวจ VLAN/security config"],
];

// ผู้ใช้ระบบเริ่มต้น [username, password (ก่อน hash), displayName, role]
const users: [string, string, string, string][] = [
  ["admin", "admin123", "ผู้ดูแลระบบ", "ADMIN"],
  ["staffa", "staff123", "Staff A", "TECHNICIAN"],
  ["staffb", "staff123", "Staff B", "TECHNICIAN"],
];

// กลุ่มอุปกรณ์ + นโยบาย PM (รอบเดือน, ค่าใช้จ่าย/ครั้ง)
const groups = [
  { groupCode: "PRINTER", groupName: "เครื่องพิมพ์", pmIntervalMonths: 3, costPerPm: 300 },
  { groupCode: "COMPUTER", groupName: "คอมพิวเตอร์", pmIntervalMonths: 6, costPerPm: 500 },
  { groupCode: "NETWORK", groupName: "อุปกรณ์เครือข่าย", pmIntervalMonths: 3, costPerPm: 400 },
];

// อุปกรณ์: [group, type, serialNumber, brand, model, equipmentName, zoneCode]
const equipments: [string, string, string, string, string, string, string][] = [
  ["PRINTER", "LASER", "CNBKL4X6ZS", "HP", "M706N", "PT.QAD019059", "O1"],
  ["PRINTER", "LASER", "CNBKL4X70L", "HP", "M706N", "PT.QAD004050", "P1"],
  ["PRINTER", "LASER", "CNBKL4X70Y", "HP", "M706N", "PT.BON004076", "B1"],
  ["PRINTER", "LASER", "CNBKL4X717", "HP", "M706N", "PT.MTS004069", "B1"],
  ["PRINTER", "LASER", "CNBKL4X71W", "HP", "M706N", "PT.BON004072", "B1"],
  ["PRINTER", "LASER", "CNE8GBN7MH", "HP", "M706N", "M706N_COS", "O1"],
  ["PRINTER", "LASER", "CNE8GD5BH2", "HP", "M706N", "M706N_PC", "O1"],
  ["PRINTER", "LASER", "CNE8H1HCKC", "HP", "M706N", "M706N_PSN", "O1"],
  ["PRINTER", "LASER", "CNE8H1HCGD", "HP", "M602N", "M602_ENG_PD", "O1"],
  ["PRINTER", "LASER", "CNRXT47761", "HP", "5200", "HP 5200 PE", "O1"],
  ["PRINTER", "INKJET", "D3Q20-80009", "HP", "MFP 477dw", "SYSHP_477DW__019069", "O1"],
  ["PRINTER", "DOTMATRIX", "AL16031038D0", "OKI", "395", "OKI 395_PE1", "B1"],
  ["PRINTER", "DOTMATRIX", "R9KY013213", "EPSON", "LQ300", "Epson 310 Station 3", "B1"],
  ["PRINTER", "DOTMATRIX", "R9KY013227", "EPSON", "LQ300", "Epson 300 Station 2", "B1"],
  ["PRINTER", "DOTMATRIX", "R9KY013204", "EPSON", "LQ300", "Epson 310 Station 4", "B1"],
  ["PRINTER", "DOTMATRIX", "EA02778", "SEIKO", "BBP9000E", "PCT_BP9000_4.65", "B1"],
  ["PRINTER", "THERMAL", "15J163301428", "ZEBRA", "140xi4", "Z140xi4_IPADs-172", "B1"],
  ["PRINTER", "THERMAL", "15J165000272", "ZEBRA", "140xi4", "Z140xi4_IPADs-173", "B1"],
  ["PRINTER", "THERMAL", "16J122901070", "ZEBRA", "170xi4", "Z170xi4_PCT_STICKER", "O1"],
  ["PRINTER", "THERMAL", "16J122200302", "ZEBRA", "170xi4", "Z170xi4_Bon_Rec_01", "P1"],
  ["PRINTER", "THERMAL", "16J122200278", "ZEBRA", "170xi4", "Z170xi4_Bon_Rec_02", "P1"],
  ["COMPUTER", "PC", "UDVGJST014708001500401", "ACER", "X4620G", "TAPP46ATO146", "P1"],
  ["COMPUTER", "PC", "UDVGJST017708000620401", "ACER", "X4620G", "TAPP04BON059", "B1"],
  ["COMPUTER", "PC", "UDVGJST017708000B10401", "ACER", "X4620G", "TAPP04ADM089", "O1"],
  ["COMPUTER", "PC", "UDVGJST017708000640401", "ACER", "X4620G", "TAPP04BON087", "B1"],
  ["COMPUTER", "PC", "UDVGJST0177080009B0401", "ACER", "X4620G", "TAPP04BON163", "B1"],
  ["COMPUTER", "PC", "UDVGJST017708000610401", "ACER", "X4620G", "TAPP04BON173", "O1"],
  ["COMPUTER", "SERVER", "06GRZ68", "IBM", "X3650M3", "THYZWS004124", "O1"],
  ["COMPUTER", "SERVER", "06HFFG2", "IBM", "X3650M4", "THYZWS010023", "O1"],
  ["COMPUTER", "SERVER", "06PMFD5", "IBM", "X3650M4", "THYZWS010021", "O1"],
  ["COMPUTER", "SERVER", "06RZHM8", "IBM", "X3650M4", "THYZWS004032", "O1"],
  ["COMPUTER", "SERVER", "USR96ST0187080001C0401", "ACER", "X4620G", "THYZWS004047", "O1"],
  ["NETWORK", "SWITCH", "CN18BX5510", "HP", "V1910", "HPV1910_IPADs_4.219", "O1"],
  ["NETWORK", "SWITCH", "CN18B9J03P", "H3C", "3000", "HBC_MTS_STORE", "B1"],
  ["NETWORK", "SWITCH", "FOC1705Z1CW", "CISCO", "2960s", "TAPP44SYS015", "O1"],
  ["NETWORK", "SWITCH", "FOC1705Z1H8", "CISCO", "2960s", "TAPP44SYS016", "O1"],
  ["NETWORK", "SWITCH", "FOC1705Z1H7", "CISCO", "2960s", "TAPP44SYS017", "O1"],
];

// ประวัติการ PM ตัวอย่าง: [serialNumber, "YYYY-MM-DD"]
const pmRecords: [string, string][] = [
  ["CNBKL4X717", "2025-02-03"],
  ["CNBKL4X71W", "2025-02-05"],
  ["UDVGJST017708000640401", "2025-02-25"],
  ["CNBKL4X70Y", "2025-02-03"],
  ["AL16031038D0", "2025-02-06"],
  ["R9KY013213", "2025-02-07"],
  ["R9KY013227", "2025-02-10"],
  ["R9KY013204", "2025-02-15"],
  ["EA02778", "2025-02-16"],
  ["15J163301428", "2025-02-20"],
  ["15J165000272", "2025-02-21"],
  ["UDVGJST017708000620401", "2025-02-23"],
  ["UDVGJST0177080009B0401", "2025-02-25"],
  ["CN18B9J03P", "2025-02-26"],
];

async function main() {
  for (const g of groups) {
    await prisma.equipmentGroup.upsert({
      where: { groupCode: g.groupCode },
      update: { groupName: g.groupName, pmIntervalMonths: g.pmIntervalMonths, costPerPm: g.costPerPm },
      create: g,
    });
  }
  console.log(`✓ equipment_group: ${groups.length} กลุ่ม`);

  for (const [groupCode, type, sn, brand, model, name, zone] of equipments) {
    await prisma.equipment.upsert({
      where: { serialNumber: sn },
      update: { groupCode, type, brand, model, equipmentName: name, zoneCode: zone },
      create: {
        groupCode,
        type,
        serialNumber: sn,
        brand,
        model,
        equipmentName: name,
        zoneCode: zone,
      },
    });
  }
  console.log(`✓ equipment: ${equipments.length} ชิ้น`);

  for (const [username, pwd, displayName, role] of users) {
    const passwordHash = await bcrypt.hash(pwd, 10);
    await prisma.user.upsert({
      where: { username },
      update: { displayName, role },
      create: { username, passwordHash, displayName, role },
    });
  }
  console.log(`✓ app_user: ${users.length} บัญชี (admin/admin123, staffa/staff123, staffb/staff123)`);

  // ผู้ทำ PM ตัวอย่าง = Staff A
  const staffA = await prisma.user.findUnique({ where: { username: "staffa" } });

  let pmCount = 0;
  for (const [sn, dateStr] of pmRecords) {
    const eq = await prisma.equipment.findUnique({
      where: { serialNumber: sn },
      include: { group: true },
    });
    if (!eq) {
      console.warn(`! ไม่พบอุปกรณ์ SN=${sn} ข้ามรายการ PM`);
      continue;
    }
    const pmDate = new Date(`${dateStr}T00:00:00.000Z`);
    const exists = await prisma.pmRecord.findFirst({
      where: { serialNumber: eq.serialNumber, pmDate },
    });
    if (exists) continue;
    await prisma.pmRecord.create({
      data: {
        serialNumber: eq.serialNumber,
        pmDate,
        cost: eq.group.costPerPm,
        technician: "ทีม IT",
        performedById: staffA?.id ?? null,
        remark: "ข้อมูลตัวอย่างจากโจทย์",
      },
    });
    pmCount++;
  }
  console.log(`✓ pm_record: ${pmCount} รายการ`);

  // เซ็ตผู้ทำ PM ของข้อมูลตัวอย่างเดิมที่ยังว่างให้เป็น Staff A
  if (staffA) {
    const r = await prisma.pmRecord.updateMany({
      where: { performedById: null },
      data: { performedById: staffA.id },
    });
    if (r.count) console.log(`✓ ตั้งผู้ทำ PM ตัวอย่าง = Staff A: ${r.count} รายการ`);
  }
  let ci = 0;
  for (const [groupCode, category, label] of checkItems) {
    await prisma.pmCheckItem.upsert({
      where: { groupCode_label: { groupCode, label } },
      update: { category, sortOrder: ci },
      create: { groupCode, category, label, sortOrder: ci },
    });
    ci++;
  }
  console.log(`✓ pm_check_item: ${checkItems.length} รายการตรวจ (PRINTER/COMPUTER/NETWORK)`);

  console.log("Seed เสร็จสมบูรณ์");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
