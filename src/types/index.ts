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
  chassis?: string;
  length?: number | string;
  width?: number | string;
  height?: number | string;
  serialNumber?: string;
  serialNumbers?: string[];
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
  type: 'مبدئية' | 'نهائية';
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
  subject: string;
  blocks: LetterBlock[];
  isArchived?: boolean;
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
}

export interface PrintData {
  type: 'INVOICE' | 'WORK_ORDER' | 'ESTIMATE' | 'LETTER' | 'SHIPPING_ORDER';
  data: any;
  silentExport?: boolean;
}
