const fs = require('fs');
const appPath = './src/App.tsx';
let lines = fs.readFileSync(appPath, 'utf8').split('\n');

const getRange = (startName, endName) => {
  const start = lines.findIndex(l => l.includes(`const ${startName} = `));
  const end = lines.findIndex(l => l.includes(`const ${endName} = `)) - 2;
  return { start, end };
};

const cc = getRange('CostCalculatorView', 'DriverSelect');
const est = getRange('EstimatesView', 'WorkOrdersView');
const estCat = getRange('EstimateCategoriesView', 'WorksOfView');

fs.mkdirSync('./src/views/Estimates', { recursive: true });

const ccLines = lines.slice(cc.start, cc.end + 1);
const estLines = lines.slice(est.start, est.end + 1);
const estCatLines = lines.slice(estCat.start, estCat.end + 1);

// Shared imports for Estimates
const imports = `import React, { useState, useEffect, useRef } from 'react';
import { useEstimates } from '../../context/EstimatesContext';
import { useSettings } from '../../context/SettingsContext';
import { usePrint } from '../../context/PrintContext';
import { useMaterials } from '../../context/MaterialsContext';
import { useCustomers } from '../../context/CustomersContext';
import { Calculator, Plus, Trash2, Edit, Save, FileText, Check, Printer, X, Eye, EyeOff, LayoutDashboard, Database, Tags, ArrowUp, ArrowDown } from 'lucide-react';
import { formatCurrency, numberToArabicWords } from '../../utils/formatters';
import { CustomerSelect } from '../../components/ui/CustomerSelect';

`;

fs.writeFileSync('./src/views/Estimates/CostCalculatorView.tsx', imports + 'export ' + ccLines.join('\n'));
fs.writeFileSync('./src/views/Estimates/EstimatesView.tsx', imports + 'export ' + estLines.join('\n'));
fs.writeFileSync('./src/views/Estimates/EstimateCategoriesView.tsx', imports + 'export ' + estCatLines.join('\n'));

// Remove from bottom to top so indices don't shift
lines.splice(estCat.start, estCat.end - estCat.start + 1);
lines.splice(est.start, est.end - est.start + 1);
lines.splice(cc.start, cc.end - cc.start + 1);

fs.writeFileSync(appPath, lines.join('\n'));
console.log('Estimates & Calculator Views extracted!');
