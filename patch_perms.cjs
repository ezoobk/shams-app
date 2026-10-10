const fs = require('fs');

function patchPermissions(file, pageId) {
  let c = fs.readFileSync(file, 'utf8');
  
  if (!c.includes('useAuth')) {
    c = c.replace(
      "import React,",
      "import React,\n  { useContext } from 'react';\nimport { useAuth } from '../../context/AuthContext';"
    );
  }
  
  // Inject into component
  if (!c.includes('const { hasPermission } = useAuth();')) {
    // Find the component declaration (e.g., export const LettersView = ...)
    c = c.replace(
      /export const \w+ \= \([^\)]*\) \=\> \{/,
      "$& \n  const { hasPermission } = useAuth();"
    );
  }

  // Patch save
  if (c.includes('const handleSave = ')) {
    c = c.replace(
      /const handleSave = \([^\)]*\) \=\> \{/,
      "$& \n    if (!hasPermission('" + pageId + "', 'create') && !hasPermission('" + pageId + "', 'edit')) return alert('ليس لديك صلاحية');"
    );
  }

  // Patch delete
  if (c.includes('const handleDelete = ')) {
    c = c.replace(
      /const handleDelete = \([^\)]*\) \=\> \{/,
      "$& \n    if (!hasPermission('" + pageId + "', 'delete')) return alert('ليس لديك صلاحية للحذف');"
    );
  }

  fs.writeFileSync(file, c);
}

patchPermissions('src/views/Letters/LettersView.tsx', 'invoices');
console.log('Letters patched!');
