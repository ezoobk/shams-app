const fs = require('fs');
const appPath = './src/App.tsx';
const lines = fs.readFileSync(appPath, 'utf8').split('\n');
const estViewStart = lines.findIndex(l => l.includes('const EstimatesView = '));
console.log('EstimatesView starts at:', estViewStart + 1);
const lettersStart = 2474;
const lettersEnd = estViewStart - 2;

const lettersViewLines = lines.slice(lettersStart, lettersEnd + 1);

let imports = `import React, { useState, useEffect, useRef } from 'react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useLetters } from '../../context/LettersContext';
import { useSettings } from '../../context/SettingsContext';
import { usePrint } from '../../context/PrintContext';
import { useCustomers } from '../../context/CustomersContext';
import { FileText, Plus, Search, Check, Trash2, Printer, X, Eye, ArrowUp, ArrowDown, List, Grid, Edit, MoveUp, MoveDown, ChevronsUpDown, ChevronUp, ChevronDown } from 'lucide-react';

import { formatCurrency, numberToArabicWords } from '../../utils/formatters';
import { CustomerSelect } from '../../components/ui/CustomerSelect';
export `;

fs.mkdirSync('./src/views/Letters', { recursive: true });
fs.writeFileSync('./src/views/Letters/LettersView.tsx', imports + '\n' + lettersViewLines.join('\n'));

lines.splice(lettersStart, lettersEnd - lettersStart + 1);
fs.writeFileSync(appPath, lines.join('\n'));

console.log('LettersView extracted!');
