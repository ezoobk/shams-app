import React, { createContext, useContext, useState } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useDatabaseCollection } from '../hooks/useDatabaseCollection';

export const PAGE_PERMISSIONS: Record<string, { label: string, actions: string[] }> = {
  dashboard:          { 
    label: 'لوحة التحكم', 
    actions: [
      'view',
      'view_stats',
      'view_invoices_summary',
      'view_purchases_summary',
      'view_wo_movements',
      'view_hr_card',
      'view_recent_activity',
      'qa_estimates',
      'qa_final_invoices',
      'qa_work_orders',
      'qa_shipping',
      'qa_letters',
      'view_hr_shortcuts'
    ] 
  },
  estimates:          { label: 'التقديرات والعروض', actions: ['view', 'create', 'edit', 'delete', 'print'] },
  workOrders:         { label: 'أوامر التصنيع', actions: ['view', 'create', 'edit', 'delete', 'print', 'change_status'] },
  invoices:           { label: 'سجل الصادر', actions: ['view', 'create', 'edit', 'delete', 'print'] },
  customers:          { label: 'العملاء', actions: ['view', 'create', 'edit', 'delete'] },
  suppliers:          { label: 'الموردون', actions: ['view', 'create', 'edit', 'delete'] },
  purchases:          { label: 'المشتريات', actions: ['view', 'create', 'edit', 'delete', 'print'] },
  drivers:            { label: 'السائقون', actions: ['view', 'create', 'edit', 'delete'] },
  materials:          { label: 'إدارة المواد', actions: ['view', 'create', 'edit', 'delete'] },
  worksOf:            { label: 'أنواع الأعمال', actions: ['view', 'create', 'edit', 'delete'] },
  estimateCategories: { label: 'تصنيف التقديرات', actions: ['view', 'create', 'edit', 'delete'] },
  hr:                 { label: 'الموارد البشرية', actions: ['view', 'create', 'edit', 'delete', 'sync', 'payroll', 'print'] },
  reports:            { label: 'التقارير والأداء', actions: ['view', 'view_financials', 'export'] },
  settings:           { label: 'الإعدادات العامة', actions: ['view', 'manage'] },
  users:              { label: 'إدارة المستخدمين', actions: ['view', 'manage'] },
  auditLog:           { label: 'سجل حركات النظام', actions: ['view', 'manage', 'export'] }
};

export const ACTION_LABELS: Record<string, string> = {
  view: 'عرض الصفحة',
  create: 'إضافة',
  edit: 'تعديل',
  delete: 'حذف',
  print: 'طباعة/تصدير',
  export: 'تصدير التقارير والبيانات',
  view_financials: 'عرض البيانات المالية',
  change_status: 'تغيير الحالة',
  sync: 'مزامنة جهاز البصمة',
  payroll: 'احتساب واعتماد مسير الرواتب',
  manage: 'إدارة وتعديل كامل',
  // Dashboard granular actions
  view_stats: 'إجماليات النظام العامة',
  view_invoices_summary: 'إجمالي الفواتير النهائية',
  view_purchases_summary: 'إجمالي فواتير المشتريات',
  view_wo_movements: 'آخر حركات أوامر التصنيع',
  view_hr_card: 'مؤشرات الموارد البشرية',
  view_recent_activity: 'أحدث السجلات والملفات',
  qa_estimates: 'اختصار فاتورة مبدئية',
  qa_final_invoices: 'اختصار فاتورة نهائية',
  qa_work_orders: 'اختصار أمر تصنيع',
  qa_shipping: 'اختصار أمر نقل',
  qa_letters: 'اختصار مراسلة',
  view_hr_shortcuts: 'اختصارات الموارد البشرية'
};

// Legacy fallback for ALL_PAGES exports mapping
export const ALL_PAGES = Object.keys(PAGE_PERMISSIONS).map(id => ({ id, label: PAGE_PERMISSIONS[id].label }));

export type User = {
  id: string;
  username: string;
  displayName: string;
  password: string;
  role: 'admin' | 'user';
  jobTitle?: string;
  signature?: string;
  stamp?: string;
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
  sessionTimeoutHours: number;
  setSessionTimeoutHours: (hours: number) => void;
  sessionExpiredNotice: string | null;
  clearSessionExpiredNotice: () => void;
};

const AuthContext = createContext<AuthContextType>(null!);

const DEFAULT_ADMIN: User = {
  id: 'admin-root',
  username: 'admin',
  displayName: 'المدير',
  password: 'admin123',
  role: 'admin',
  jobTitle: 'المدير العام',
  signature: '',
  stamp: '',
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
  }, []);

  const [currentUser, setCurrentUser] = useLocalStorage<User | null>('shams_current_user', null);
  const [sessionTimeoutHours, setSessionTimeoutHoursState] = useLocalStorage<number>('shams_session_timeout_hours', 3);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState<string | null>(null);

  const lastActivityRef = React.useRef<number>(Date.now());
  const lastSavedStorageRef = React.useRef<number>(Date.now());

  const setSessionTimeoutHours = (hours: number) => {
    const valid = Math.max(0.5, Math.min(24, Number(hours) || 3));
    setSessionTimeoutHoursState(valid);
  };

  const clearSessionExpiredNotice = () => setSessionExpiredNotice(null);

  // Check if session has expired while app was closed, slept, or reloaded
  React.useEffect(() => {
    if (currentUser) {
      const lastActiveStr = localStorage.getItem('shams_last_activity');
      const timeoutHours = sessionTimeoutHours || 3;
      const timeoutMs = timeoutHours * 60 * 60 * 1000;

      if (lastActiveStr) {
        const lastActive = Number(lastActiveStr);
        if (!isNaN(lastActive) && Date.now() - lastActive > timeoutMs) {
          console.log(`[Auth] Session expired during offline period (> ${timeoutHours}h). Auto logging out.`);
          setCurrentUser(null);
          localStorage.removeItem('shams_last_activity');
          setSessionExpiredNotice(`انتهت صلاحية الجلسة لعدم وجود نشاط لمدة تتجاوز ${timeoutHours} ساعات. يرجى تسجيل الدخول مجدداً.`);
        } else if (!isNaN(lastActive)) {
          lastActivityRef.current = lastActive;
        }
      } else {
        localStorage.setItem('shams_last_activity', Date.now().toString());
        lastActivityRef.current = Date.now();
      }
    }
  }, []);

  // Track user activity and auto-logout on inactivity
  React.useEffect(() => {
    if (!currentUser) return;

    const updateActivity = () => {
      const now = Date.now();
      lastActivityRef.current = now;

      // Throttle localStorage writes to once every 30 seconds
      if (now - lastSavedStorageRef.current > 30_000) {
        lastSavedStorageRef.current = now;
        localStorage.setItem('shams_last_activity', now.toString());
      }
    };

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(ev => window.addEventListener(ev, updateActivity, { passive: true }));

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'shams_last_activity' && e.newValue) {
        const val = Number(e.newValue);
        if (!isNaN(val) && val > lastActivityRef.current) {
          lastActivityRef.current = val;
        }
      }
      if (e.key === 'shams_current_user' && !e.newValue) {
        setCurrentUser(null);
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // Periodically check if inactivity timeout has elapsed
    const checkInterval = setInterval(() => {
      const timeoutHours = sessionTimeoutHours || 3;
      const timeoutMs = timeoutHours * 60 * 60 * 1000;
      const storageVal = Number(localStorage.getItem('shams_last_activity')) || 0;
      const effectiveLast = Math.max(lastActivityRef.current, storageVal);
      const idleTime = Date.now() - effectiveLast;

      if (idleTime > timeoutMs) {
        console.warn(`[Auth] Inactivity timeout reached (${idleTime}ms > ${timeoutMs}ms). Auto logging out.`);
        const loggedOutUser = currentUser;
        setCurrentUser(null);
        localStorage.removeItem('shams_last_activity');
        setSessionExpiredNotice(`تم تسجيل الخروج تلقائياً لعدم وجود نشاط لمدة ${timeoutHours} ساعات.`);

        window.dispatchEvent(new CustomEvent('shams-audit-log', {
          detail: {
            actionType: 'logout',
            entityType: 'المستخدمون',
            entityId: loggedOutUser.id,
            title: `تسجيل خروج تلقائي: ${loggedOutUser.displayName}`,
            details: `تم إنهاء جلسة المستخدم تلقائياً بعد مرور ${timeoutHours} ساعات دون نشاط.`,
            userId: loggedOutUser.id,
            userName: loggedOutUser.username,
            userDisplayName: loggedOutUser.displayName
          }
        }));
      }
    }, 15_000);

    return () => {
      events.forEach(ev => window.removeEventListener(ev, updateActivity));
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(checkInterval);
    };
  }, [currentUser?.id, sessionTimeoutHours]);

  // Keep currentUser in sync with database users collection (to pick up fresh title, signature, stamp)
  React.useEffect(() => {
    if (currentUser && users && users.length > 0) {
      const fresh = users.find(u => u.id === currentUser.id || u.username === currentUser.username);
      if (fresh) {
        if (
          fresh.displayName !== currentUser.displayName ||
          fresh.jobTitle !== currentUser.jobTitle ||
          fresh.signature !== currentUser.signature ||
          fresh.stamp !== currentUser.stamp ||
          fresh.role !== currentUser.role
        ) {
          setCurrentUser(fresh);
        }
      }
    }
  }, [users, currentUser?.id]);

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
      if (user.permissions.dashboard && user.permissions.dashboard.includes('view')) {
        const hasGranular = user.permissions.dashboard.some(a => 
          (a.startsWith('view_') && a !== 'view_financials') || a.startsWith('qa_')
        );
        if (!hasGranular) {
          user.permissions.dashboard = [...PAGE_PERMISSIONS.dashboard.actions];
        }
      }
      const now = Date.now();
      lastActivityRef.current = now;
      lastSavedStorageRef.current = now;
      localStorage.setItem('shams_last_activity', now.toString());
      setSessionExpiredNotice(null);

      setCurrentUser(user); 
      window.dispatchEvent(new CustomEvent('shams-audit-log', {
        detail: {
          actionType: 'login',
          entityType: 'المستخدمون',
          entityId: user.id,
          title: `تسجيل دخول: ${user.displayName}`,
          details: `اسم الحساب: @${user.username} | الدور: ${user.role === 'admin' ? 'مدير' : 'مستخدم'}`,
          userId: user.id,
          userName: user.username,
          userDisplayName: user.displayName
        }
      }));
      return true; 
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem('shams_last_activity');
    setSessionExpiredNotice(null);
    setCurrentUser(null);
  };

  const addUser = (u: Omit<User, 'id'>) => {
    const newId = `user-${Date.now()}`;
    setUsers(prev => [...prev, { ...u, id: newId }]);
    window.dispatchEvent(new CustomEvent('shams-audit-log', {
      detail: {
        actionType: 'create',
        entityType: 'إدارة المستخدمين',
        entityId: newId,
        title: `إضافة مستخدم جديد: ${u.displayName}`,
        details: `اسم الدخول: @${u.username} | الدور: ${u.role === 'admin' ? 'مدير' : 'مستخدم'}`
      }
    }));
  };

  const updateUser = (updated: User) => {
    setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
    // if editing current user, update session too
    if (currentUser?.id === updated.id) setCurrentUser(updated);
    window.dispatchEvent(new CustomEvent('shams-audit-log', {
      detail: {
        actionType: 'edit',
        entityType: 'إدارة المستخدمين',
        entityId: updated.id,
        title: `تعديل بيانات المستخدم: ${updated.displayName}`,
        details: `اسم الدخول: @${updated.username} | الدور: ${updated.role === 'admin' ? 'مدير' : 'مستخدم'}`
      }
    }));
  };

  const deleteUser = (id: string) => {
    const target = users.find(u => u.id === id);
    setUsers(prev => prev.filter(u => u.id !== id));
    window.dispatchEvent(new CustomEvent('shams-audit-log', {
      detail: {
        actionType: 'delete',
        entityType: 'إدارة المستخدمين',
        entityId: id,
        title: `حذف المستخدم: ${target?.displayName || id}`,
        details: target ? `اسم الدخول: @${target.username}` : `المعرف: ${id}`
      }
    }));
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
    
    const userActions = perms[pageId] || [];

    // Special backward compatibility for dashboard:
    // If a legacy user already had 'view' on dashboard prior to granular sub-permissions,
    // default to allowing all dashboard widgets until an administrator explicitly customizes their dashboard.
    if (pageId === 'dashboard' && action !== 'view' && userActions.includes('view')) {
      const hasConfiguredGranular = userActions.some(a => 
        (a.startsWith('view_') && a !== 'view_financials') || a.startsWith('qa_')
      );
      if (!hasConfiguredGranular) {
        return true;
      }
    }

    return userActions.includes(action);
  };

  return (
    <AuthContext.Provider value={{ 
      currentUser, 
      users, 
      login, 
      logout, 
      addUser, 
      updateUser, 
      deleteUser, 
      hasPermission,
      sessionTimeoutHours,
      setSessionTimeoutHours,
      sessionExpiredNotice,
      clearSessionExpiredNotice
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
