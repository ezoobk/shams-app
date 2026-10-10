const fs = require('fs');
const appPath = './src/App.tsx';
const lines = fs.readFileSync(appPath, 'utf8').split('\n');

const matStart = lines.findIndex(l => l.includes('const MaterialsView = '));
const estCatStart = lines.findIndex(l => l.includes('const EstimateCategoriesView = '));

const matLines = lines.slice(matStart, estCatStart - 1);

let imports = `import React, { useState } from 'react';
import { useMaterials } from '../../context/MaterialsContext';
import { Package, Plus, Trash2, Edit, Save, X, Search, ArrowUp, ArrowDown, Tags } from 'lucide-react';

export `;

fs.mkdirSync('./src/views/Materials', { recursive: true });
fs.writeFileSync('./src/views/Materials/MaterialsView.tsx', imports + '\n' + matLines.join('\n'));

lines.splice(matStart, estCatStart - matStart - 1);
fs.writeFileSync(appPath, lines.join('\n'));
console.log('MaterialsView extracted!');
