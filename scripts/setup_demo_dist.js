import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const xlsx = require('xlsx');

// ----- Đọc dữ liệu tháng 6 từ file Excel -----
const wb = xlsx.readFile('Molding_Live_Status_2026-07-22.xlsx');
const rawRows = xlsx.utils.sheet_to_json(wb.Sheets['Live Status']);

// 1. Machines M-01 -> M-50 + Shelves SHELF-01 -> SHELF-20
const machines = [];
for (let i = 1; i <= 50; i++) {
  machines.push({
    id: `M-${String(i).padStart(2, '0')}`,
    name: `Molding Machine ${String(i).padStart(2, '0')}`,
    max_molds: 12,
    operational_status: 'active',
    status: 'optimal'
  });
}
for (let i = 1; i <= 20; i++) {
  machines.push({
    id: `SHELF-${String(i).padStart(2, '0')}`,
    name: `Kệ ${String(i).padStart(2, '0')}`,
    max_molds: 9999,
    operational_status: 'active',
    status: 'optimal'
  });
}

// 2. Running molds từ snapshot Excel
const runningMolds = rawRows.map((r, idx) => ({
  id: idx + 1,
  uuid: `uuid-june-${idx + 1}`,
  machine_id: String(r['Machine ID'] || 'M-01').trim(),
  mold_id: String(r['Mold ID'] || 'OE-1429').trim(),
  mold_size: String(r['Mold Size'] || '8#').trim(),
  quantity: Number(r['Quantity']) || 1,
  status_note: (!r['Status Note'] || r['Status Note'] === 'OK') ? null : String(r['Status Note']),
  status_note_updated_at: '2026-06-22T08:00:00Z',
  created_at: '2026-06-20T06:00:00Z',
  updated_at: '2026-06-22T08:30:00Z'
}));

// Gán max_molds thực tế từ file Excel
rawRows.forEach(r => {
  const m = machines.find(x => x.id === String(r['Machine ID'] || '').trim());
  if (m && r['Max Molds']) m.max_molds = Number(r['Max Molds']);
});

// 3. Thêm khuôn mẫu trên kệ
runningMolds.push(
  { id: 201, uuid: 'uuid-shelf-1', machine_id: 'SHELF-01', mold_id: 'OE-1429', mold_size: '6#', quantity: 8, status_note: null, created_at: '2026-06-15T08:00:00Z', updated_at: '2026-06-22T08:00:00Z' },
  { id: 202, uuid: 'uuid-shelf-2', machine_id: 'SHELF-01', mold_id: 'OE-1429', mold_size: '7#', quantity: 6, status_note: null, created_at: '2026-06-15T08:00:00Z', updated_at: '2026-06-22T08:00:00Z' },
  { id: 203, uuid: 'uuid-shelf-3', machine_id: 'SHELF-02', mold_id: 'OV-0428', mold_size: '8#', quantity: 12, status_note: null, created_at: '2026-06-15T08:00:00Z', updated_at: '2026-06-22T08:00:00Z' },
  { id: 204, uuid: 'uuid-shelf-4', machine_id: 'SHELF-03', mold_id: 'OV-0385', mold_size: '9#', quantity: 10, status_note: null, created_at: '2026-06-15T08:00:00Z', updated_at: '2026-06-22T08:00:00Z' }
);

// 4. Mold master tổng hợp
const moldMasterMap = new Map();
runningMolds.forEach(r => {
  const key = `${r.mold_id}___${r.mold_size}`;
  if (!moldMasterMap.has(key)) {
    moldMasterMap.set(key, { id: r.mold_id, size: r.mold_size, total_owned: 20, currently_running: 0, status: 'active' });
  }
  moldMasterMap.get(key).currently_running += r.quantity;
});
moldMasterMap.forEach(v => {
  if (v.currently_running > v.total_owned) v.total_owned = v.currently_running + 6;
});

// 5. Default shelves
const defaultShelves = [];
Array.from(moldMasterMap.values()).slice(0, 20).forEach((v, i) => {
  const shelfNum = (i % 20) + 1;
  defaultShelves.push({ mold_id: v.id, mold_size: v.size, shelf_id: `SHELF-${String(shelfNum).padStart(2, '0')}` });
});

// 6. Scan logs mẫu
const scanLogs = [
  { id: 1001, machine_id: 'M-01', mold_id: 'OE-1429', mold_size: '6.5#', quantity: 4, action_type: 'IN', operator_name: 'Nguyen Van A', created_at: '2026-06-22T07:15:00Z', load_percentage: 100 },
  { id: 1002, machine_id: 'M-02', mold_id: 'OE-1429', mold_size: '11.5#', quantity: 1, action_type: 'IN', operator_name: 'Tran Van B', created_at: '2026-06-22T07:35:00Z', load_percentage: 95 },
  { id: 1003, machine_id: 'SHELF-01', mold_id: 'OE-1429', mold_size: '6#', quantity: 2, action_type: 'OUT', operator_name: 'Nguyen Van A', created_at: '2026-06-22T08:10:00Z', load_percentage: 0 }
];

// 7. Scan users - SHA256("admin:admin") tính sẵn
const scanUsers = [
  { id: 1, username: 'admin', password_hash: 'b5ad3f19c4fa0fe12d77f3c34ecde3f5f7720faab55bde67a2efab26a4e6d8b7', full_name: 'Admin Demo' },
  { id: 2, username: 'operator', password_hash: '6b22f5c4dba5a0a6ee6de2e77c30e3e2a45c21c2e4ba2a01a72a8b24a2d09e87', full_name: 'Tho Khuon Demo' },
  { id: 3, username: 'demo', password_hash: '6b22f5c4dba5a0a6ee6de2e77c30e3e2a45c21c2e4ba2a01a72a8b24a2d09e87', full_name: 'Demo User' }
];

// --- Tạo đoạn script JSON nhúng trực tiếp vào HTML ---
const inlineScript = `
<script>
  window.__DEMO_MODE__ = true;
  window.__JUNE_DATA__ = {
    machines: ${JSON.stringify(machines)},
    runningMolds: ${JSON.stringify(runningMolds)},
    moldMasters: ${JSON.stringify(Array.from(moldMasterMap.values()))},
    defaultShelves: ${JSON.stringify(defaultShelves)},
    scanLogs: ${JSON.stringify(scanLogs)},
    scanUsers: ${JSON.stringify(scanUsers)}
  };
  window.ENV = { VITE_DEMO_MODE: "true" };
</script>`;

// --- Inject vào index.html được build bởi vite-plugin-singlefile ---
const indexPath = path.resolve('dist_demo_thang6/index.html');
if (!fs.existsSync(indexPath)) {
  console.error("Lỗi: Không tìm thấy file dist_demo_thang6/index.html. Hãy chạy vite build trước.");
  process.exit(1);
}

let content = fs.readFileSync(indexPath, 'utf8');

// Thay thế block <script> ENV cũ bằng script inline có chứa toàn bộ dữ liệu tháng 6
content = content.replace(/<script>[\s\S]*?<\/script>/, inlineScript.trim());

// Lưu ra hẳn một file HTML độc lập ở ngoài cùng để user dễ copy đi
const standalonePath = path.resolve('Molding_Demo_Thang6_2026.html');
fs.writeFileSync(standalonePath, content, 'utf8');

const sizeKB = Math.round(fs.statSync(standalonePath).size / 1024);
console.log(`=== HOÀN TẤT: Đã tạo file ${standalonePath} (${sizeKB} KB) ===`);
console.log('Bạn chỉ cần click đúp vào file HTML này để chạy demo mà không cần Node hay Server!');

