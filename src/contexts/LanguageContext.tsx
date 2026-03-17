import { createContext, useContext, useState, type ReactNode } from 'react';

type Language = 'en' | 'vi';

interface Translations {
  [key: string]: {
    en: string;
    vi: string;
  };
}

const translations: Translations = {
  headerTitle: { en: 'Molding Operations', vi: 'Quản Lý Molding' },
  headerSubtitle: { en: 'Real-time Equipment Monitoring & Capacity', vi: 'Giám sát Máy & Khuôn theo thời gian thực' },
  totalMoldsRunning: { en: 'Total Molds Running', vi: 'Tổng Số Khuôn Đang Chạy' },
  activeMachines: { en: 'Active Machines', vi: 'Số Máy Đang Hoạt Động' },
  capacity: { en: 'Capacity', vi: 'Công suất' },
  systemUtilization: { en: 'System Utilization', vi: 'Hiệu suất Hệ thống' },
  liveMachineStatus: { en: 'Live Machine Status', vi: 'Trạng thái Máy Trực tiếp' },
  optimal: { en: 'Optimal (>80%)', vi: 'Tối ưu (>80%)' },
  warning: { en: 'Warning (50-80%)', vi: 'Cảnh báo (50-80%)' },
  underutilized: { en: 'Underutilized (<50%)', vi: 'Chưa tối ưu (<50%)' },
  capacityLoad: { en: 'Capacity Load', vi: 'Tải Công suất' },
  molds: { en: 'Molds', vi: 'Khuôn' },
  runningMolds: { en: 'Running Molds', vi: 'Khuôn Đang Chạy' },
  total: { en: 'Total', vi: 'Tổng' },
  noMolds: { en: 'No molds running', vi: 'Không có khuôn nào đang chạy' },
  qty: { en: 'Qty', vi: 'SL' },
  // Navigation
  liveDashboard: { en: 'Live Dashboard', vi: 'Dashboard Trực tiếp' },
  scanInOut: { en: 'Scan In/Out (Mobile)', vi: 'Scan Vào/Ra (Mobile)' },
  moldDatabase: { en: 'Mold Database', vi: 'Dữ liệu Khuôn' },
  // Filters
  searchPlaceholder: { en: 'Search Machine or Mold ID...', vi: 'Tìm kiếm Máy hoặc Mã Khuôn...' },
  status: { en: 'Status', vi: 'Trạng thái' },
  empty: { en: 'Empty', vi: 'Trống' },
  sortByCapacity: { en: 'Sort by Capacity', vi: 'Sắp xếp theo Công suất' },
  all: { en: 'All', vi: 'Tất cả' },
  // Scan In/Out Mobile View
  barcodeScannerPlaceholder: { en: 'Camera / QR Barcode Scanner', vi: 'Camera / Máy Quét Mã Vạch QR' },
  selectedMachine: { en: 'Selected Machine', vi: 'Máy đã chọn' },
  scannedMold: { en: 'Scanned Mold', vi: 'Khuôn đã quét' },
  size: { en: 'Size', vi: 'Size' },
  size1: { en: 'Size 1', vi: 'Size 1' },
  size2Optional: { en: 'Size 2 (Optional)', vi: 'Size 2 (Tuỳ chọn)' },
  sizeHint: { en: 'Enter Size 1 and Size 2 for a range (e.g. 4.5# - 5.5#). For a single size, enter only Size 1.', vi: 'Nhập Size 1 và Size 2 nếu khuôn có khoảng size (Ví dụ: 4.5# - 5.5#). Nếu khuôn chỉ có 1 size, hãy nhập vào Size 1.' },
  scanIn: { en: 'SCAN IN', vi: 'SCAN IN (Lên khuôn)' },
  scanOut: { en: 'SCAN OUT', vi: 'SCAN OUT (Xuống khuôn)' },
  confirmSubmit: { en: 'CONFIRM & SUBMIT', vi: 'XÁC NHẬN & GỬI' },
  quantity: { en: 'Quantity', vi: 'Số lượng' },
  // Mold Database
  moldId: { en: 'Mold ID', vi: 'Mã Khuôn' },
  totalOwnedQty: { en: 'Total Owned Qty', vi: 'Số Lượng Sở Hữu' },
  currentlyRunningQty: { en: 'Currently Running Qty', vi: 'SL Đang Chạy' },
  addNewMold: { en: 'Add New Mold', vi: 'Thêm Khuôn Mới' },
  importExcel: { en: 'Import Excel', vi: 'Nhập từ Excel' },
  downloadTemplate: { en: 'Download Template', vi: 'Tải Template Excel' },
  uploading: { en: 'Uploading...', vi: 'Đang tải lên...' },
  uploadSuccess: { en: 'Upload successful!', vi: 'Tải lên thành công!' },
  uploadFailed: { en: 'Upload failed!', vi: 'Tải lỗi! Vui lòng kiểm tra lại.' },
  invalidFormat: { en: 'Invalid Excel format. Required columns: Mold, Size, Quantity.', vi: 'Sai định dạng Excel. Yêu cầu 3 cột: Mold, Size, Quantity.' },
  selectMachine: { en: 'Select Machine', vi: 'Chọn Máy' },
  selectMold: { en: 'Select Mold', vi: 'Chọn Khuôn' },
  scanMachineFirst: { en: 'Please scan Machine QR first (Starts with "M")', vi: 'Vui lòng quét mã MÁY trước (Mã máy phải bắt đầu bằng chữ "M")' },
  invalidMachineCode: { en: 'Invalid Machine code. Must start with "M"', vi: 'Mã Máy không hợp lệ. Phải bắt đầu bằng chữ "M"' },
  scanSuccess: { en: 'Operation successful!', vi: 'Thực hiện thành công!' },
  scanError: { en: 'Operation failed!', vi: 'Thực hiện thất bại!' },
  save: { en: 'Save', vi: 'Lưu' },
  cancel: { en: 'Cancel', vi: 'Hủy' },
  initialQuantity: { en: 'Initial Quantity', vi: 'Số lượng ban đầu' },
  exportExcel: { en: 'Export Excel', vi: 'Xuất Excel' },
  searchMold: { en: 'Search Mold ID...', vi: 'Tìm mã khuôn...' },
  recentMolds: { en: 'Recent', vi: 'Gần đây' },
  toggleCamera: { en: 'Camera', vi: 'Máy ảnh' },
  // Machine operational status
  opActive: { en: 'Running', vi: 'Đang chạy' },
  opPause: { en: 'Paused', vi: 'Tạm ngưng' },
  opStop: { en: 'Stopped', vi: 'Ngưng hoạt động' },
  opActiveLabel: { en: 'Running (Active)', vi: 'Đang hoạt động (Active)' },
  opPauseLabel: { en: 'Paused', vi: 'Tạm ngưng (Pause)' },
  opStopLabel: { en: 'Stopped', vi: 'Ngưng hoạt động (Stop)' },
  opStatusTitle: { en: 'Set machine status', vi: 'Chọn trạng thái hoạt động của máy' },
  opStatusCurrent: { en: 'Current', vi: 'Hiện tại' },
  notCounted: { en: 'Excluded', vi: 'Không tính' },
  // Analytics
  analyticsBtn: { en: 'Analytics & Charts', vi: 'Thống kê & Biểu đồ' },
  // Add machine
  addNewMachine: { en: 'Add New Machine', vi: 'Thêm Máy Mới' },
  addMachineHint: { en: 'Auto-number & set capacity', vi: 'Dễ dàng đánh số & thiết lập công suất' },
  viewMode: { en: 'View Mode', vi: 'Chế độ xem' },
  simpleView: { en: 'Simple View', vi: 'Xem Tổng Quan' },
  gridView: { en: 'Grid View', vi: 'Xem Chi Tiết' },
  // Analytics/Charts Modal
  noData: { en: 'No data', vi: 'Chưa có dữ liệu' },
  totalMachinesLabel: { en: 'Total Machines', vi: 'Tổng máy' },
  loadingHistory: { en: 'Loading history...', vi: 'Đang tải lịch sử...' },
  noHistoryData: { en: 'No historical data available. Data is recorded automatically on dashboard load.', vi: 'Chưa có dữ liệu lịch sử. Dữ liệu sẽ được ghi nhận tự động mỗi khi Dashboard tải.' },
  loadPerformanceStats: { en: 'Load Performance Statistics', vi: 'Thống Kê Hiệu Suất Tải' },
  realtimeAnalysis: { en: 'Real-time Analysis', vi: 'Phân tích thời gian thực' },
  machinesRunningCount: { en: 'machines running', vi: 'máy đang chạy' },
  moldTypesCount: { en: 'mold types', vi: 'loại khuôn' },
  efficiencyHistory30d: { en: 'Daily Load Efficiency (Last 30 Days)', vi: 'Lịch sử hiệu suất tải theo ngày (30 ngày gần nhất)' },
  lowest: { en: 'Lowest', vi: 'Thấp nhất' },
  highest: { en: 'Highest', vi: 'Cao nhất' },
  todayLabel: { en: 'Today', vi: 'Hôm nay' },
  machineCapacityStatus: { en: 'Machine Capacity Status', vi: 'Trạng thái công suất máy' },
  machineListTitle: { en: 'Machine List', vi: 'Danh sách máy' },
  runningMoldsTitle: { en: 'Running Molds', vi: 'Khuôn đang chạy' },
  machinesActiveTitle: { en: 'Active Machines', vi: 'Máy đang hoạt động' },
  efficiencyByCapacityGroup: { en: 'Efficiency by Capacity Group', vi: 'Hiệu suất theo nhóm công suất máy' },
  underloadedAlert: { en: 'Underloaded Machines (Under 30%)', vi: 'Máy đang dưới tải (dưới 30%)' },
  underloadedHint: { en: 'machines need further mold allocation', vi: 'máy cần xem xét phân bổ khuôn thêm' },
  machinesUnit: { en: 'machines', vi: 'máy' },
  typeUnit: { en: 'types', vi: 'loại' },
  loadLabel: { en: 'load', vi: 'tải' },
  errUpdateMolds: { en: 'Error updating molds', vi: 'Lỗi cập nhật khuôn' },
  errEnterMachineId: { en: 'Please enter Machine ID!', vi: 'Vui lòng nhập ID máy!' },
  errAddMachine: { en: 'Error adding machine', vi: 'Lỗi thêm máy' },
  offLabel: { en: 'OFF', vi: 'Tắt' },
  clickToChangeStatus: { en: 'Click to change status', vi: 'Nhấn để đổi trạng thái' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('vi'); // Default to Vietnamese

  const t = (key: string) => {
    return translations[key]?.[language] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
