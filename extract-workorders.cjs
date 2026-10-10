const fs = require('fs');
const appPath = './src/App.tsx';
let lines = fs.readFileSync(appPath, 'utf8').split('\n');

const start = lines.findIndex(l => l.includes('const WorkOrdersView = '));
const end = lines.findIndex(l => l.includes('const OutboundLogView = ')) - 2;

const viewLines = lines.slice(start, end + 1);

const imports = `import React, { useState, useEffect, useMemo } from 'react';
import { useWorkOrders } from '../../context/WorkOrdersContext';
import { useEstimates } from '../../context/EstimatesContext';
import { useCustomers } from '../../context/CustomersContext';
import { useDrivers } from '../../context/DriversContext';
import { useSettings } from '../../context/SettingsContext';
import { usePrint } from '../../context/PrintContext';
import { useMaterials } from '../../context/MaterialsContext';
import { useShippingOrders } from '../../context/ShippingOrdersContext';
import { Factory, Search, FileText, Settings, Play, Check, Package, Calendar, Clock, AlertTriangle, Truck, Tag, Plus, Edit, Hash, Printer, MoveUp, MoveDown, ChevronsUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { formatCurrency, numberToArabicWords } from '../../utils/formatters';
import { CustomerSelect } from '../../components/ui/CustomerSelect';

`;

fs.mkdirSync('./src/views/WorkOrders', { recursive: true });
fs.writeFileSync('./src/views/WorkOrders/WorkOrdersView.tsx', imports + 'export ' + viewLines.join('\n'));

lines.splice(start, end - start + 1);
fs.writeFileSync(appPath, lines.join('\n'));
console.log('WorkOrdersView extracted!');
