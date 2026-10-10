const fs = require('fs');
const appPath = './src/App.tsx';
let lines = fs.readFileSync(appPath, 'utf8').split('\n');

const getLineIdx = (needle) => lines.findIndex(l => l.includes(needle));

// Extract WorksOfView
const worksOfStart = getLineIdx('const WorksOfView = ');
const dashStart = getLineIdx('const DashboardView = ');
const worksOfLines = lines.slice(worksOfStart, dashStart - 2);

const worksOfContent = `import React, { useState } from 'react';
import { useMaterials } from '../../context/MaterialsContext';
import { Plus, Trash2, Edit, Save, X, MoveUp, MoveDown } from 'lucide-react';

export const WorksOfView = ({ selectedWorkId, setSelectedWorkId }) => {
${worksOfLines.slice(1).join('\n')}
`;
fs.mkdirSync('./src/views/WorksOf', { recursive: true });
fs.writeFileSync('./src/views/WorksOf/WorksOfView.tsx', worksOfContent);

// Extract DashboardView  
const totalLines = lines.length;
// DashboardView ends near closing brace of App function – it's the last view
const dashLines = lines.slice(dashStart, totalLines - 2);

const dashContent = `import React, { useMemo } from 'react';
import { useWorkOrders } from '../../context/WorkOrdersContext';
import { useInvoices } from '../../context/InvoicesContext';
import { useCustomers } from '../../context/CustomersContext';
import { useEstimates } from '../../context/EstimatesContext';
import { useShippingOrders } from '../../context/ShippingOrdersContext';
import { useSettings } from '../../context/SettingsContext';
import { LayoutDashboard, Factory, FileText, Users, ShoppingCart, Truck } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

export const DashboardView = () => {
${dashLines.slice(1).join('\n')}
`;
fs.mkdirSync('./src/views/Dashboard', { recursive: true });
fs.writeFileSync('./src/views/Dashboard/DashboardView.tsx', dashContent);

// Remove both from App.tsx
lines.splice(worksOfStart, totalLines - worksOfStart);
fs.writeFileSync(appPath, lines.join('\n'));
console.log('WorksOfView and DashboardView extracted!');
console.log('App.tsx lines now:', lines.length);
