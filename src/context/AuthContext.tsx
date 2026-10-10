import React, { createContext, useContext, useState } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useDatabaseCollection } from '../hooks/useDatabaseCollection';

export const PAGE_PERMISSIONS: Record<string, { label: string, actions: string[] }> = {
  dashboard:          { label: 'لوحة التحكم', actions: ['view', 'view_financials'] },
  estimates:          { label: 'التقديرات والعروض', actions: ['view', 'create', 'edit', 'delete', 'print'] },
  workOrders:         { label: 'أوامر التصنيع', actions: ['view', 'create', 'edit', 'delete', 'print', 'change_status'] },
  invoices:           { label: 'سجل الصادر', actions: ['view', 'create', 'edit', 'delete', 'print'] },
  customers:          { label: 'العملاء', actions: ['view', 'create', 'edit', 'delete'] },
  drivers:            { label: 'السائقون', actions: ['view', 'create', 'edit', 'delete'] },
  materials:          { label: 'إدارة المواد', actions: ['view', 'create', 'edit', 'delete'] },
  worksOf:            { label: 'أنواع الأعمال', actions: ['view', 'create', 'edit', 'delete'] },
  estimateCategories: { label: 'تصنيف التقديرات', actions: ['view', 'create', 'edit', 'delete'] },
  settings:           { label: 'الإعدادات العامة', actions: ['view', 'manage'] },
  users:              { label: 'إدارة المستخدمين', actions: ['view', 'manage'] }
};

export const ACTION_LABELS: Record<string, string> = {
  view: 'عرض الصفحة',
  create: 'إضافة',
  edit: 'تعديل',
  delete: 'حذف',
  print: 'طباعة/تصدير',
  view_financials: 'عرض البيانات المالية',
  change_status: 'تغيير الحالة',
  manage: 'إدارة وتعديل كامل'
};

// Legacy fallback for ALL_PAGES exports mapping
export const ALL_PAGES = Object.keys(PAGE_PERMISSIONS).map(id => ({ id, label: PAGE_PERMISSIONS[id].label }));

export type User = {
  id: string;
  username: string;
  displayName: string;
  password: string;
  role: 'admin' | 'user';
  allowedPages?: string[]; // Legacy fallback
  permissions: Record<string, string[]>;
};

type AuthContextType = {
  currentUser: User | null;
  users: User[];
  login: (username: string, password: string) => boolean;
  logout: () => void;
  addUser: (u: Omit<User, 'id'>) => void;
  updateUser: (u: User) => void;
  deleteUser: (id: string) => void;
  hasPermission: (pageId: string, action?: string) => boolean;
};

const AuthContext = createContext<AuthContextType>(null!);

const DEFAULT_ADMIN: User = {
  id: 'admin-root',
  username: 'admin',
  displayName: 'المدير',
  password: 'admin123',
  role: 'admin',
  permissions: Object.keys(PAGE_PERMISSIONS).reduce((acc, key) => ({ ...acc, [key]: PAGE_PERMISSIONS[key].actions }), {}),
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [users, setUsers] = useDatabaseCollection<User[]>('users', []);
  
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
  }, [users.length]);
  const [currentUser, setCurrentUser] = useLocalStorage<User | null>('shams_current_user', null);

  const login = (username: string, password: string): boolean => {
    let user = users.find(u => u.username === username && u.password === password);
    if (user) { 
      // Migrate old users if necessary
      if (!user.permissions) {
        user.permissions = {};
        (user.allowedPages || []).forEach(p => {
          user.permissions[p] = PAGE_PERMISSIONS[p]?.actions || ['view'];
        });
      }
      setCurrentUser(user); 
      return true; 
    }
    return false;
  };

  const logout = () => setCurrentUser(null);

  const addUser = (u: Omit<User, 'id'>) => {
    setUsers(prev => [...prev, { ...u, id: `user-${Date.now()}` }]);
  };

  const updateUser = (updated: User) => {
    setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
    // if editing current user, update session too
    if (currentUser?.id === updated.id) setCurrentUser(updated);
  };

  const deleteUser = (id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id));
  };

  const hasPermission = (pageId: string, action: string = 'view'): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    
    // Migration fallback for legacy users active session
    let perms = currentUser.permissions;
    if (!perms) {
      perms = {};
      (currentUser.allowedPages || []).forEach(p => { perms[p] = PAGE_PERMISSIONS[p]?.actions || ['view']; });
    }
    
    return (perms[pageId] || []).includes(action);
  };

  return (
    <AuthContext.Provider value={{ currentUser, users, login, logout, addUser, updateUser, deleteUser, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
