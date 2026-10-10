const fs = require('fs');
let c = fs.readFileSync('src/views/Letters/LettersView.tsx', 'utf8');

c = c.replace(
  "import { useAuth } from '../../context/AuthContext'; { useState, useEffect, useRef, useMemo } from 'react';",
  "import { useState, useEffect, useRef, useMemo } from 'react';\nimport { useAuth } from '../../context/AuthContext';"
);

fs.writeFileSync('src/views/Letters/LettersView.tsx', c);
console.log('Fixed imports');
