const fs = require('fs');

let c = fs.readFileSync('src/context/AuthContext.tsx', 'utf8');

if (!c.includes("import { useDatabaseCollection } from '../hooks/useDatabaseCollection';")) {
  c = c.replace(
    "import { useLocalStorage } from '../hooks/useLocalStorage';",
    "import { useLocalStorage } from '../hooks/useLocalStorage';\nimport { useDatabaseCollection } from '../hooks/useDatabaseCollection';"
  );
}

// Replace useLocalStorage with useDatabaseCollection for users
c = c.replace(
  "const [users, setUsers] = useLocalStorage<User[]>('shams_users', [DEFAULT_ADMIN]);",
  `const [users, setUsers] = useDatabaseCollection<User[]>('users', []);
  
  // Migrate from local storage to database once
  React.useEffect(() => {
    if (users.length === 0) {
      try {
        const local = localStorage.getItem('shams_users');
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setUsers(parsed);
          } else {
            setUsers([DEFAULT_ADMIN]);
          }
        } else {
          setUsers([DEFAULT_ADMIN]);
        }
      } catch {
        setUsers([DEFAULT_ADMIN]);
      }
    }
  }, [users.length]);`
);

fs.writeFileSync('src/context/AuthContext.tsx', c);
console.log('AuthContext patched for DB sync!');
