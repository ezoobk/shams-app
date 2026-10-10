const fs = require('fs');
let c = fs.readFileSync('src/views/Settings/SettingsView.tsx', 'utf8');

if (!c.includes('useAuth')) {
  c = c.replace(/import React.*?from 'react';/, "import React, { useState } from 'react';\nimport { useAuth } from '../../context/AuthContext';");
  c = c.replace(/const \{ appSettings, setAppSettings \} = useSettings\(\);/, "const { appSettings, setAppSettings } = useSettings();\n  const { hasPermission } = useAuth();\n  const canManage = hasPermission('settings', 'manage');");
  
  // Disable all inputs/selects/buttons if !canManage
  c = c.replace(/<input /g, "<input disabled={!canManage} ");
  c = c.replace(/<select /g, "<select disabled={!canManage} ");
  // Do not disable all buttons blindly, some might be navigation, but wait, settings view only has action buttons.
  c = c.replace(/<button /g, "<button disabled={!canManage} ");
  
  fs.writeFileSync('src/views/Settings/SettingsView.tsx', c);
  console.log('Done');
}
