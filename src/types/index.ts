export interface Customer {
  id: string;
  name: string;
  phone?: string;
  notes?: string;
}

export interface Driver {
  id: string;
  name: string;
  phone?: string;
  truckNumber?: string;
  license?: string;
  trailerNumber?: string;
}

export interface MasterMaterial {
  id: number | string;
  name: string;
  shortName?: string;
  defaultPrice: number;
  unit: string;
}

export interface WorksOf {
  id: string;
  name: string;
}

export interface MasterItem {
  id: string;
  worksOfId: string;
  name: string;
}

export interface EstimateCategory {
  id: string;
  name: string;
}

export interface Estimate {
  id: string;
  date: string;
  desc: string;
  chassis: string;
  length: number | string;
  width: number | string;
  height: number | string;
  sellPrice: number;
  totalCost: number;
  profitPercentage: number;
  materials: any[];
  specs: any[];
  attachments?: any[];
  categoryId?: string;
}

export interface WorkOrderSectionStatus {
  sectionId: string;
  sectionName: string;
  isCompleted: boolean;
  completedAt?: string;
  completedBy?: string;
  durationDays?: number;
}

export interface WorkOrderItem {
  id?: string;
  desc: string;
  serialNumber: string;
  chassis: string;
  length: number | string;
  width: number | string;
  height: number | string;
  notes?: string;
  materials: any[];
  attachments?: any[];
  mfgStatus?: string;
  status?: string;
  shippingStatus?: string;
  completedAt?: string;
  completionDays?: number;
  sectionStatuses?: WorkOrderSectionStatus[];
}

export interface WorkOrder {
  id: string;
  date: string;
  items: WorkOrderItem[];
}

export interface InvoiceItem {
  id?: string;
  desc: string;
  isCustom?: boolean;
  isMaterial?: boolean;
  unit?: string;
  notes?: string;
  chassis?: string;
  length?: number | string;
  width?: number | string;
  height?: number | string;
  serialNumber?: string;
  serialNumbers?: string[];
  mfgStatus?: string;
  specialty?: string;
  technicianName?: string;
  sellPrice: number;
  requestedQty: number;
  materials?: any[];
  attachments?: any[];
}

export interface Invoice {
  id: string;
  date: string;
  customerName: string;
  customerId?: string;
  type: 'مبدئية' | 'نهائية' | 'إنتاجية';
  items: InvoiceItem[];
  total: number;
  discount: number;
  netTotal: number;
  notes?: string;
  terms?: string;
}

export interface LetterBlock {
  id: string;
  type: 'header' | 'text' | 'list' | 'table';
  content: any;
}

export interface Letter {
  id: string;
  date: string;
  to: string;
  customerName?: string;
  customerId?: string;
  destination?: string;
  to_name?: string;
  subject: string;
  senderUserId?: string;
  senderName?: string;
  senderTitle?: string;
  senderSignature?: string;
  senderStamp?: string;
  blocks: LetterBlock[];
  isArchived?: boolean;
  lastUpdated?: string;
}

export interface AppSettings {
  companyNameAr: string;
  companyNameEn: string;
  address: string;
  cr: string;
  phones: string;
  email: string;
  website: string;
  logoBase64: string | null;
  outboundLogPath: string | null;
  printScale?: number; // scale percentage: 80, 85, 90 (default), 95, 100
}

export interface PrintData {
  type: 'INVOICE' | 'WORK_ORDER' | 'ESTIMATE' | 'LETTER' | 'SHIPPING_ORDER' | 'PURCHASE_INVOICE';
  data: any;
  silentExport?: boolean;
  excludeAttachments?: boolean;
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export interface PurchaseItem {
  id: string;
  itemName: string;
  qty: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
}

export interface PurchaseInvoice {
  id: string;
  date: string;
  supplierName: string;
  supplierId?: string;
  invoiceNumber?: string;
  items: PurchaseItem[];
  total: number;
  discount: number;
  netTotal: number;
  notes?: string;
  attachments?: Array<{ name: string; type: string; data: string }>;
  status?: 'completed' | 'draft';
  createdBy?: string;
  createdById?: string;
}

// ─── Human Resources (HR) & ZKTeco Interfaces ──────────────────────────────

export type HRSalaryType = 'monthly' | 'daily';
export type HROvertimeMode = 'general' | 'percent' | 'fixed';
export type HRTransactionType = 'advance' | 'deduction' | 'bonus' | 'allowance';
export type HRLeaveType = 'paid' | 'unpaid' | 'sick' | 'permission';

export interface HRShift {
  id: string;
  name: string;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  lateGraceMinutes: number;
  earlyGraceMinutes: number;
  minOvertimeMinutes?: number;
  maxDailyOvertimeHours?: number;
  missingPunchPenaltyHours?: number;
  isSplitShift?: boolean;
  splitBreakStart?: string;
  splitBreakEnd?: string;
  workHours: number;
  workDays?: string[];
  color?: string;
  isDefault?: boolean;
  notes?: string;
}

export interface HREmployee {
  id: string;
  badgeNumber?: string;
  name: string;
  phone?: string;
  ssn?: string;
  deptId?: string;
  deptName?: string;
  jobTitle?: string;
  shiftId?: string;
  shiftIds?: string[];
  isZkLinked?: boolean; // هل الموظف مربوط بجهاز البصمة أم لا (افتراضي: true، وإذا كان false فهو موظف يدوي غير مربوط بالجهاز)
  attendanceMode?: 'biometric' | 'auto_present' | 'manual' | 'overtime_only'; // آلية احتساب الدوام (بصمة كاملة / دوام كامل معتمد تلقائياً / يدوي بالأيام / بصمة للإضافي فقط)
  salaryType: HRSalaryType; // 'monthly' | 'daily'
  basicSalary: number;      // شهري
  dailyRate: number;        // يومية
  hourlyRate?: number;
  overtimeMode: HROvertimeMode; // 'general' | 'percent' | 'fixed'
  overtimePercent: number;      // e.g. 125, 150
  overtimeFixedAmount: number;  // د.ل / ساعة
  hireDate?: string;
  terminationDate?: string;
  terminationReason?: string;
  isActive: boolean;
  notes?: string;
}

export interface HRAttendanceLog {
  id: string;
  userId: string;
  badgeNumber?: string;
  checkTime: string; // "YYYY-MM-DD HH:mm:ss"
  checkType: string; // 'I' | 'O'
  verifyCode?: string;
  sn?: string;
  source?: 'zkteco' | 'zkteco_direct' | 'manual' | 'system' | string;
  notes?: string;
}

export interface HRTransaction {
  id: string;
  employeeId: string;
  employeeName?: string;
  type: HRTransactionType;
  amount: number;
  date: string;
  month?: string; // "YYYY-MM"
  reason?: string;
  status: 'pending' | 'settled' | 'cancelled';
  createdBy?: string;
}

export interface HRLeave {
  id: string;
  employeeId: string;
  employeeName?: string;
  type: HRLeaveType;
  startDate: string;
  endDate: string;
  hours?: number;
  reason?: string;
  status: 'approved' | 'pending' | 'rejected';
  approvedBy?: string;
}

export interface HRPayrollItem {
  employeeId: string;
  employeeName: string;
  badgeNumber: string;
  attendanceMode?: string;
  jobTitle: string;
  deptName: string;
  salaryType: HRSalaryType;
  baseSalaryOrRate: number;
  expectedDays: number;
  actualWorkDays: number;
  absentDays: number;
  leaveDays: number;
  lateMinutes: number;
  lateDeduction: number;
  earlyMinutes?: number;
  earlyDeduction?: number;
  delayMinutes?: number;
  delayDeduction?: number;
  overtimeHours: number;
  overtimeRate: number;
  overtimeAmount: number;
  bonuses: number;
  allowances: number;
  advances: number;
  deductions: number;
  earnedSalary: number; // الراتب المستحق قبل الخصومات
  netSalary: number;    // صافي الراتب المستحق للصرف
  isSettledOffCycle?: boolean;        // هل تم تصفية مستحقات الموظف بمخالصة فردية
  settlementId?: string;             // معرّف المخالصة
  settlementDate?: string;           // تاريخ المخالصة
  settlementAmountPaid?: number;     // المبلغ المصروف بالفعل في المخالصة
  currentPayableNet?: number;        // الصافي المستحق للصرف حالياً في هذا المسير (0 إذا صُرف بمخالصة)
  notes?: string;
}

export interface HREndOfServiceSettlement {
  id: string;
  employeeId: string;
  employeeName: string;
  badgeNumber?: string;
  deptName?: string;
  jobTitle?: string;
  settlementDate: string; // YYYY-MM-DD
  month: string;          // YYYY-MM
  startDate: string;      // YYYY-MM-DD
  endDate: string;        // YYYY-MM-DD
  reason: 'resignation' | 'termination' | 'contract_end' | 'mutual_agreement' | 'other' | string;
  reasonDetails?: string;
  salaryType: HRSalaryType;
  baseSalaryOrRate: number;
  actualWorkDays: number;
  absentDays: number;
  earnedSalary: number;
  overtimeHours: number;
  overtimeAmount: number;
  bonuses: number;
  allowances: number;
  leaveBalancePayout: number;    // تعويض رصيد الإجازات
  endOfServiceGratuity: number;  // مكافأة نهاية الخدمة
  totalAdditions: number;
  lateMinutes: number;
  earlyMinutes: number;
  delayDeduction: number;
  advances: number;
  deductions: number;
  otherDeductions: number;
  totalDeductions: number;
  netPayable: number;
  paymentMethod?: string;
  payoutDate?: string;
  notes?: string;
  approvedAt?: string;
  approvedBy?: string;
  isSettled: boolean;
}

export interface HRPayrollRecord {
  id: string;
  month: string; // "YYYY-MM"
  startDate?: string;
  endDate?: string;
  generatedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  notes?: string;
  payoutDate?: string;
  paymentMethod?: string;
  data: HRPayrollItem[];
  totalBase?: number;
  totalOvertime?: number;
  totalBonuses?: number;
  totalAdvances?: number;
  totalDelayDeductions?: number;
  totalNet: number;
  totalDeductions: number;
  totalAdditions: number;
  isApproved: boolean;
}

export interface HRDayAttendanceAnalysis {
  employee: HREmployee;
  date: string;
  shift: HRShift;
  shifts?: HRShift[];
  firstIn: string | null;
  lastOut: string | null;
  morningIn?: string | null;
  morningOut?: string | null;
  eveningIn?: string | null;
  eveningOut?: string | null;
  allPunches: string[];
  workedHours: number;
  scheduledHours?: number;
  lateMinutes: number;
  earlyMinutes: number;
  overtimeHours: number;
  missingPunchesCount?: number;
  missingPunchPenaltyMinutes?: number;
  status: 'present' | 'late' | 'absent' | 'leave' | 'weekend' | 'single_punch';
  isExcused?: boolean;
  notes?: string;
}

export type HROvertimePeriodType = 'before_shift' | 'after_shift' | 'mid_break' | 'weekend' | 'custom';

export interface HROvertimeRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  badgeNumber?: string;
  date: string; // "YYYY-MM-DD"
  periodType: HROvertimePeriodType;
  periodLabel: string; // e.g. "إضافي قبل الدوام (دخول مبكر)"
  punchRange: string;  // e.g. "07:18 - 08:30"
  actualMinutes: number;
  hours: number;       // e.g. 1.2
  hourlyRate: number;
  overtimeRate: number;
  amount: number;      // e.g. 24.00
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  rejectionReason?: string;
  notes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface HRDetectedOvertimePeriod {
  id: string;
  employee: HREmployee;
  date: string;
  periodType: HROvertimePeriodType;
  periodLabel: string;
  punchRange: string;
  actualMinutes: number;
  hours: number;
  hourlyRate: number;
  overtimeRate: number;
  amount: number;
  existingRecord?: HROvertimeRecord;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  rejectionReason?: string;
  notes?: string;
}


