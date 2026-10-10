const fs = require('fs');
const appPath = './src/App.tsx';
let lines = fs.readFileSync(appPath, 'utf8').split('\n');

const getLineIdx = (needle) => lines.findIndex(l => l.includes(needle));

// ---- Step 1: Extract DriverSelect -> src/components/ui/DriverSelect.tsx ----
const driverSelectStart = getLineIdx('const DriverSelect = ');
const outboundStart = getLineIdx('const OutboundLogView = ');
const driverSelectLines = lines.slice(driverSelectStart, outboundStart - 2);

const driverSelectContent = `import React, { useState, useRef, useEffect } from 'react';
import { useDrivers } from '../../context/DriversContext';
import { Search, ChevronDown, Plus, Edit, Check, Trash2, X } from 'lucide-react';

export const DriverSelect = ({ value, onChange }) => {
${driverSelectLines.slice(1).join('\n')}
`;
fs.writeFileSync('./src/components/ui/DriverSelect.tsx', driverSelectContent);

// ---- Step 2: Extract InvoiceEditorView -> src/views/Invoices/InvoiceEditorView.tsx ----
const invoiceEditorStart = getLineIdx('const InvoiceEditorView = ');
const invoiceEditorLines = lines.slice(invoiceEditorStart, driverSelectStart - 2);

const invoiceEditorContent = `import React, { useState, useEffect } from 'react';
import { useInvoices } from '../../context/InvoicesContext';
import { usePrint } from '../../context/PrintContext';
import { formatCurrency, numberToArabicWords } from '../../utils/formatters';
import { FileText, Save, X, Trash2, Plus, Printer, Check } from 'lucide-react';

export const InvoiceEditorView = ({ editingInvoice, setEditingInvoice }) => {
${invoiceEditorLines.slice(1).join('\n')}
`;
fs.mkdirSync('./src/views/Invoices', { recursive: true });
fs.writeFileSync('./src/views/Invoices/InvoiceEditorView.tsx', invoiceEditorContent);

// ---- Step 3: Extract OutboundLogView -> src/views/Invoices/OutboundLogView.tsx ----
const worksOfStart = getLineIdx('const WorksOfView = ');
const outboundLines = lines.slice(outboundStart, worksOfStart - 2);

const outboundContent = `import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useInvoices } from '../../context/InvoicesContext';
import { useShippingOrders } from '../../context/ShippingOrdersContext';
import { usePrint } from '../../context/PrintContext';
import { useWorkOrders } from '../../context/WorkOrdersContext';
import { FileText, Search, Archive, Truck, FileCheck2, FilterX, ChevronUp, ChevronDown, ChevronsUpDown, Download } from 'lucide-react';
import { DriverSelect } from '../../components/ui/DriverSelect';

export const OutboundLogView = ({ setEditingInvoice, setActiveTab }) => {
${outboundLines.slice(1).join('\n')}
`;
fs.writeFileSync('./src/views/Invoices/OutboundLogView.tsx', outboundContent);

// ---- Step 4: Remove all three from App.tsx ----
// Remove from bottom to top to preserve line numbers
lines.splice(outboundStart, worksOfStart - outboundStart - 2);
lines.splice(invoiceEditorStart, outboundStart - invoiceEditorStart - 2);

fs.writeFileSync(appPath, lines.join('\n'));
console.log('InvoiceEditorView, DriverSelect, OutboundLogView all extracted!');
console.log('App.tsx lines remaining:', lines.length);
