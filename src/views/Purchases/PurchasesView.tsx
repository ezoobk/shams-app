import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePurchases } from '../../context/PurchasesContext';
import { useSuppliers } from '../../context/SuppliersContext';
import { useMaterials } from '../../context/MaterialsContext';
import { usePrint } from '../../context/PrintContext';
import { useSettings } from '../../context/SettingsContext';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import {
  ShoppingBag, Plus, Trash2, Edit, Save, X, Search, FileText,
  Calendar, Building2, Paperclip, ChevronLeft, ChevronRight,
  Printer, Eye, Check, DollarSign, Download, Grid, List,
  User, AlertCircle, Clock, CheckCircle2, FilterX, HelpCircle, Tag, Loader2,
  ZoomIn, ZoomOut, RotateCw, Maximize2, Minimize2
} from 'lucide-react';
import { bulkUpsert } from '../../api/client';
import { formatCurrency, parseDateSafely } from '../../utils/formatters';
import type { PurchaseInvoice, PurchaseItem, Supplier } from '../../types';
import * as XLSX from 'xlsx';
import { ExportFilterModal, type ExportFilters } from '../../components/ui/ExportFilterModal';

interface PurchasesViewProps {
  initialSupplierFilter?: string;
  onClearSupplierFilter?: () => void;
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({
  initialSupplierFilter,
  onClearSupplierFilter
}) => {
  const { purchaseInvoices, setPurchaseInvoices } = usePurchases();
  const { suppliers, setSuppliers } = useSuppliers();
  const { masterMaterials } = useMaterials();
  const { setPrintData } = usePrint();
  const { generateId, generateIdAsync, idCountersRef } = useSettings();
  const { currentUser, users, hasPermission } = useAuth();

  // View Mode: Cards or Table (Default to cards as requested)
  const [viewMode, setViewMode] = useLocalStorage<'card' | 'table'>('shams_purchases_view_mode', 'card');

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSupplier, setFilterSupplier] = useState(initialSupplierFilter || '');
  const [filterUser, setFilterUser] = useState('');
  const [filterStatus, setFilterStatus] = useState<'' | 'completed' | 'draft'>('');
  const [sortBy, setSortBy] = useState<'date' | 'date_asc' | 'total' | 'total_asc' | 'user'>('date');

  useEffect(() => {
    if (initialSupplierFilter !== undefined) {
      setFilterSupplier(initialSupplierFilter);
    }
  }, [initialSupplierFilter]);

  // Editor Modal state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Form Fields
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('');
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [discount, setDiscount] = useState<number | string>(0);
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState<Array<{ name: string; type: string; data: string }>>([]);
  const [manualDraft, setManualDraft] = useState(false);

  // Side-by-side Attachment Viewer State in Editor Modal
  const [isSideViewerOpen, setIsSideViewerOpen] = useState(false);
  const [activeSideAttachmentIdx, setActiveSideAttachmentIdx] = useState(0);
  const [sideViewerZoom, setSideViewerZoom] = useState(1);
  const [sideViewerRotation, setSideViewerRotation] = useState(0);

  // Quick Supplier Add inside editor
  const [showQuickAddSupplier, setShowQuickAddSupplier] = useState(false);
  const [quickSupplierName, setQuickSupplierName] = useState('');
  const [quickSupplierPhone, setQuickSupplierPhone] = useState('');

  // Lightbox / Attachments Viewer
  const [viewingAttachmentsFor, setViewingAttachmentsFor] = useState<PurchaseInvoice | null>(null);
  const [activeAttachmentIdx, setActiveAttachmentIdx] = useState(0);

  // Invoice Details Modal
  const [viewingInvoiceDetails, setViewingInvoiceDetails] = useState<PurchaseInvoice | null>(null);

  // Keyboard navigation for attachment viewer & escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName);
      if (viewingAttachmentsFor) {
        const list = viewingAttachmentsFor.attachments || [];
        if (e.key === 'Escape') {
          e.preventDefault();
          setViewingAttachmentsFor(null);
          setActiveAttachmentIdx(0);
        } else if (e.key === 'ArrowRight' && list.length > 1) {
          e.preventDefault();
          setActiveAttachmentIdx(prev => (prev < list.length - 1 ? prev + 1 : 0));
        } else if (e.key === 'ArrowLeft' && list.length > 1) {
          e.preventDefault();
          setActiveAttachmentIdx(prev => (prev > 0 ? prev - 1 : list.length - 1));
        }
      } else if (isEditorOpen && isSideViewerOpen && !isInput) {
        if (e.key === 'ArrowRight' && attachments.length > 1) {
          e.preventDefault();
          setActiveSideAttachmentIdx(prev => (prev > 0 ? prev - 1 : attachments.length - 1));
          setSideViewerZoom(1);
          setSideViewerRotation(0);
        } else if (e.key === 'ArrowLeft' && attachments.length > 1) {
          e.preventDefault();
          setActiveSideAttachmentIdx(prev => (prev < attachments.length - 1 ? prev + 1 : 0));
          setSideViewerZoom(1);
          setSideViewerRotation(0);
        }
      } else if (viewingInvoiceDetails && e.key === 'Escape') {
        setViewingInvoiceDetails(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewingAttachmentsFor, viewingInvoiceDetails, isEditorOpen, isSideViewerOpen, attachments.length]);

  // Totals Calculation
  const validItems = items.filter(it => it.itemName && it.itemName.trim() !== '');
  const subtotal = validItems.reduce((sum, item) => sum + (Number(item.totalPrice) || 0), 0);
  const discountVal = Number(discount) || 0;
  const netTotal = Math.max(0, subtotal - discountVal);

  // Distinct creators list for filtering
  const creatorUsersList = useMemo(() => {
    const fromInvoices = purchaseInvoices.map(inv => inv.createdBy).filter(Boolean) as string[];
    const fromUsers = users ? users.map(u => u.displayName || u.username) : [];
    return Array.from(new Set([...fromInvoices, ...fromUsers])).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [purchaseInvoices, users]);

  // Determine if current form state is considered draft
  const isDraftForm = useMemo(() => {
    if (manualDraft) return true;
    if (attachments.length > 0 && validItems.length === 0) return true;
    return false;
  }, [manualDraft, attachments.length, validItems.length]);

  // Open editor for new purchase invoice
  const handleOpenNewInvoice = () => {
    if (!hasPermission('purchases', 'create')) return alert('ليس لديك صلاحية لإنشاء فاتورة مشتريات');
    setEditingInvoiceId(null);
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setSelectedSupplierId('');
    setSupplierName('');
    setSupplierInvoiceNumber('');
    setItems([
      { id: `item-${Date.now()}`, itemName: '', qty: 1, unit: 'قطعة', unitPrice: 0, totalPrice: 0, notes: '' }
    ]);
    setDiscount(0);
    setNotes('');
    setAttachments([]);
    setManualDraft(false);
    setIsSideViewerOpen(false);
    setActiveSideAttachmentIdx(0);
    setSideViewerZoom(1);
    setSideViewerRotation(0);
    setIsEditorOpen(true);
  };

  // Open editor for existing invoice
  const handleEditInvoice = (inv: PurchaseInvoice) => {
    if (!hasPermission('purchases', 'edit')) return alert('ليس لديك صلاحية لتعديل فاتورة المشتريات');
    setEditingInvoiceId(inv.id);
    setInvoiceDate(inv.date ? inv.date.split('T')[0] : new Date().toISOString().split('T')[0]);
    setSelectedSupplierId(inv.supplierId || (inv.supplierName ? '__manual__' : ''));
    setSupplierName(inv.supplierName || '');
    setSupplierInvoiceNumber(inv.invoiceNumber || '');
    setItems(inv.items && inv.items.length > 0 ? JSON.parse(JSON.stringify(inv.items)) : [
      { id: `item-${Date.now()}`, itemName: '', qty: 1, unit: 'قطعة', unitPrice: 0, totalPrice: 0, notes: '' }
    ]);
    setDiscount(inv.discount || 0);
    setNotes(inv.notes || '');
    setAttachments(inv.attachments || []);
    setManualDraft(inv.status === 'draft');
    setIsSideViewerOpen(false);
    setActiveSideAttachmentIdx(0);
    setSideViewerZoom(1);
    setSideViewerRotation(0);
    setIsEditorOpen(true);
  };

  // Add Item Row
  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      { id: `item-${Date.now() + Math.random()}`, itemName: '', qty: 1, unit: 'قطعة', unitPrice: 0, totalPrice: 0, notes: '' }
    ]);
  };

  // Remove Item Row
  const handleRemoveItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  // Update Item Field (Custom items completely supported; suggests unit & price from master materials)
  const handleItemChange = (idx: number, field: keyof PurchaseItem, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      const item = { ...updated[idx], [field]: value };

      if (field === 'itemName') {
        const trimmed = (value || '').trim().toLowerCase();
        const matched = masterMaterials.find(m => m.name.toLowerCase() === trimmed);
        if (matched) {
          if (!item.unit || item.unit === 'قطعة') {
            item.unit = matched.unit || 'قطعة';
          }
          if (!item.unitPrice || Number(item.unitPrice) === 0) {
            item.unitPrice = Number(matched.price) || 0;
            item.totalPrice = (Number(item.qty) || 1) * (Number(matched.price) || 0);
          }
        }
      }

      if (field === 'qty' || field === 'unitPrice') {
        const q = field === 'qty' ? Number(value) || 0 : Number(item.qty) || 0;
        const p = field === 'unitPrice' ? Number(value) || 0 : Number(item.unitPrice) || 0;
        item.totalPrice = q * p;
      }
      updated[idx] = item;
      return updated;
    });
  };

  // Handle Supplier Selection
  const handleSupplierSelect = (id: string) => {
    setSelectedSupplierId(id);
    if (id === '__manual__') {
      setSupplierName('');
      return;
    }
    const found = suppliers.find(s => s.id === id);
    if (found) {
      setSupplierName(found.name);
    } else {
      setSupplierName('');
    }
  };

  // Quick Add Supplier
  const handleQuickAddSupplier = () => {
    if (!quickSupplierName.trim()) return alert('الرجاء كتابة اسم المورد');
    const newId = `S${Date.now()}`;
    const newSup: Supplier = {
      id: newId,
      name: quickSupplierName.trim(),
      phone: quickSupplierPhone.trim(),
      notes: ''
    };
    setSuppliers([newSup, ...suppliers]);
    setSelectedSupplierId(newId);
    setSupplierName(newSup.name);
    setQuickSupplierName('');
    setQuickSupplierPhone('');
    setShowQuickAddSupplier(false);
  };

  // File Attachments Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        if (ev.target?.result) {
          setAttachments(prev => [
            ...prev,
            { name: file.name, type: file.type, data: ev.target!.result as string }
          ]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleRemoveAttachment = (idx: number) => {
    setAttachments(prev => {
      const next = prev.filter((_, i) => i !== idx);
      if (next.length === 0) {
        setIsSideViewerOpen(false);
      }
      return next;
    });
    setActiveSideAttachmentIdx(prev => Math.max(0, Math.min(prev, attachments.length - 2)));
  };

  // Save Purchase Invoice with Server-Side Verification
  const handleSaveInvoice = async () => {
    if (!supplierName.trim()) return alert('الرجاء اختيار أو إدخال اسم المورد');

    const hasAttachments = attachments.length > 0;
    const hasItems = validItems.length > 0;

    // Requirement:
    // If invoice image is attached, items are not mandatory (saved as draft needing completion).
    // And vice versa: if items are provided, attachment is not mandatory.
    // If neither exists, prevent saving.
    if (!hasAttachments && !hasItems) {
      return alert('يجب إما إدراج بنود الفاتورة أو إرفاق صورة الفاتورة الورقية لحفظها كمسودة تحتاج الإكمال.');
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const determinedStatus: 'completed' | 'draft' = (isDraftForm || !hasItems) ? 'draft' : 'completed';

      const creatorName = currentUser?.displayName || currentUser?.username || 'المستخدم';
      const creatorId = currentUser?.id || 'admin';

      const existing = editingInvoiceId ? purchaseInvoices.find(inv => inv.id === editingInvoiceId) : null;
      const invoiceYear = invoiceDate ? new Date(invoiceDate).getFullYear() : new Date().getFullYear();

      let finalInvoiceId = editingInvoiceId;
      if (!finalInvoiceId) {
        // حجز الرقم التسلسلي ذرياً من الخادم الرئيسي
        finalInvoiceId = await generateIdAsync('pinv', supplierName.trim(), '', invoiceYear);
      }

      const matchedSupplier = suppliers.find(s => s.name.trim().toLowerCase() === supplierName.trim().toLowerCase());
      const resolvedSupplierId = (selectedSupplierId && selectedSupplierId !== '__manual__')
        ? selectedSupplierId
        : (matchedSupplier?.id || undefined);

      const invoiceData: PurchaseInvoice = {
        id: finalInvoiceId,
        date: invoiceDate ? new Date(invoiceDate).toISOString() : new Date().toISOString(),
        supplierName: supplierName.trim(),
        supplierId: resolvedSupplierId,
        invoiceNumber: supplierInvoiceNumber.trim() || undefined,
        items: validItems.map(it => ({
          ...it,
          qty: Number(it.qty) || 0,
          unitPrice: Number(it.unitPrice) || 0,
          totalPrice: Number(it.totalPrice) || (Number(it.qty) * Number(it.unitPrice))
        })),
        total: subtotal,
        discount: discountVal,
        netTotal: netTotal,
        notes: notes.trim() || undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
        status: determinedStatus,
        createdBy: existing?.createdBy || creatorName,
        createdById: existing?.createdById || creatorId
      };

      // الحفظ المباشر المؤكد في قاعدة البيانات
      const upsertRes = await bulkUpsert('purchase_invoices', [invoiceData]);
      if (!upsertRes.success) {
        throw new Error(upsertRes.error || 'فشل حفظ فاتورة المشتريات على الخادم الرئيسي.');
      }

      if (editingInvoiceId) {
        setPurchaseInvoices(prev => prev.map(inv => inv.id === editingInvoiceId ? invoiceData : inv));
      } else {
        setPurchaseInvoices(prev => [invoiceData, ...prev.filter(inv => inv.id !== finalInvoiceId)]);
      }

      setIsEditorOpen(false);
    } catch (err: any) {
      console.error('[PurchasesView] Save error:', err);
      const msg = err.message || 'حدث خطأ غير متوقع أثناء حفظ فاتورة المشتريات على الخادم.';
      setSaveError(msg);
      alert(`⚠️ تنبيه أمان فواتير المشتريات:\n${msg}\n\nلم يتم إغلاق الفاتورة وبياناتك محفوظة. يرجى التحقق من الاتصال بالشبكة وإعادة المحاولة.`);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Purchase Invoice
  const handleDeleteInvoice = (id: string) => {
    if (!hasPermission('purchases', 'delete')) return alert('ليس لديك صلاحية لحذف فاتورة المشتريات');
    if (window.confirm('هل أنت متأكد من حذف فاتورة المشتريات هذه نهائياً؟')) {
      setPurchaseInvoices(prev => prev.filter(inv => inv.id !== id));
      if (viewingInvoiceDetails?.id === id) setViewingInvoiceDetails(null);
    }
  };

  // Filtered and Sorted Invoices
  const filteredInvoices = useMemo(() => {
    return purchaseInvoices.filter(inv => {
      const q = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm ||
        inv.id.toLowerCase().includes(q) ||
        (inv.supplierName && inv.supplierName.toLowerCase().includes(q)) ||
        (inv.invoiceNumber && inv.invoiceNumber.toLowerCase().includes(q)) ||
        (inv.notes && inv.notes.toLowerCase().includes(q)) ||
        (inv.createdBy && inv.createdBy.toLowerCase().includes(q)) ||
        (inv.items && inv.items.some(it => it.itemName.toLowerCase().includes(q)));

      const targetSupplier = filterSupplier.trim().toLowerCase();
      const matchedSup = suppliers.find(s => s.id === filterSupplier || s.name.trim().toLowerCase() === targetSupplier);
      const supplierNameTarget = matchedSup ? matchedSup.name.trim().toLowerCase() : targetSupplier;
      const supplierIdTarget = matchedSup ? matchedSup.id : filterSupplier;

      const matchesSupplier = !filterSupplier ||
        inv.supplierId === supplierIdTarget ||
        (inv.supplierName && inv.supplierName.trim().toLowerCase() === supplierNameTarget) ||
        (inv.supplierName && inv.supplierName.trim().toLowerCase() === targetSupplier);
      const matchesUser = !filterUser || inv.createdBy === filterUser;
      
      const isInvDraft = inv.status === 'draft' || (!inv.items || inv.items.length === 0);
      const matchesStatus = !filterStatus ||
        (filterStatus === 'draft' && isInvDraft) ||
        (filterStatus === 'completed' && !isInvDraft);

      return matchesSearch && matchesSupplier && matchesUser && matchesStatus;
    }).sort((a, b) => {
      if (sortBy === 'total') return (b.netTotal || 0) - (a.netTotal || 0);
      if (sortBy === 'total_asc') return (a.netTotal || 0) - (b.netTotal || 0);
      if (sortBy === 'date_asc') return parseDateSafely(a.date || a.id).getTime() - parseDateSafely(b.date || b.id).getTime();
      if (sortBy === 'user') return (a.createdBy || '').localeCompare(b.createdBy || '', 'ar');
      return parseDateSafely(b.date || b.id).getTime() - parseDateSafely(a.date || a.id).getTime();
    });
  }, [purchaseInvoices, searchTerm, filterSupplier, filterUser, filterStatus, sortBy, suppliers]);

  // Pagination State (15 items per page)
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 15;
  const totalPages = Math.ceil(filteredInvoices.length / rowsPerPage) || 1;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterSupplier, filterUser, filterStatus, sortBy]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const paginatedInvoices = filteredInvoices.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  // Excel Export State & Handler
  const [showExportModal, setShowExportModal] = useState(false);

  const exportPurchasesToExcel = (filters: ExportFilters) => {
    let data = filteredInvoices;
    if (filters.dateFrom) data = data.filter(inv => parseDateSafely(inv.date || inv.id) >= new Date(filters.dateFrom));
    if (filters.dateTo) data = data.filter(inv => parseDateSafely(inv.date || inv.id) <= new Date(filters.dateTo + 'T23:59:59'));
    if (filters.refIdFrom) data = data.filter(inv => (inv.id || '') >= filters.refIdFrom!);
    if (filters.refIdTo) data = data.filter(inv => (inv.id || '') <= filters.refIdTo!);

    const headers = [
      '#',
      'الرقم الإشاري',
      'التاريخ',
      'المورد',
      'رقم فاتورة المورد',
      'الحالة',
      'عدد الأصناف',
      'تفاصيل الأصناف والكميات',
      'الإجمالي قبل الخصم',
      'الخصم',
      'الصافي النهائي',
      'مُسجل الفاتورة',
      'ملاحظات'
    ];

    const rows = data.map((inv, idx) => {
      const itemsDetail = inv.items?.map(it => `${it.itemName} (${it.qty || 1} ${it.unit || ''} × ${it.price || 0})`).join(' | ') || '';
      const isDraft = inv.status === 'draft' || (!inv.items || inv.items.length === 0);
      return [
        idx + 1,
        inv.id || '',
        inv.date ? new Date(inv.date).toLocaleDateString('en-GB') : '',
        inv.supplierName || '',
        inv.invoiceNumber || '',
        isDraft ? 'مسودة' : 'مكتملة',
        inv.items?.length || 0,
        itemsDetail,
        inv.total || inv.netTotal || 0,
        inv.discount || 0,
        inv.netTotal || inv.total || 0,
        inv.createdBy || 'مدير النظام',
        inv.notes || ''
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!dir'] = 'rtl';
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "فواتير المشتريات");
    XLSX.writeFile(wb, `فواتير_المشتريات_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.xlsx`);
  };

  const totalPurchasesSum = purchaseInvoices.reduce((sum, inv) => sum + (Number(inv.netTotal) || 0), 0);
  const draftInvoicesCount = purchaseInvoices.filter(inv => inv.status === 'draft' || (!inv.items || inv.items.length === 0)).length;

  return (
    <div className="w-full max-w-7xl mx-auto relative pb-28 px-1 sm:px-4">
      {/* Export Filter Modal */}
      <ExportFilterModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={exportPurchasesToExcel}
        title="تصدير فواتير المشتريات"
        showRefId={true}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 flex items-center gap-2.5">
            <ShoppingBag className="w-7 h-7 md:w-8 md:h-8 text-indigo-600 flex-shrink-0" />
            فواتير المشتريات
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">إدخال ومتابعة فواتير شراء المواد ومسودات الفواتير من الموردين</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Card / Table Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('card')}
              className={`p-2 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all ${
                viewMode === 'card' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="عرض كبطاقات"
            >
              <Grid className="w-4 h-4" />
              <span className="hidden sm:inline">بطاقات</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all ${
                viewMode === 'table' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="عرض كجدول"
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">جدول</span>
            </button>
          </div>

          <button
            onClick={() => setShowExportModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 sm:px-4 py-2.5 rounded-xl font-bold transition-all shadow-sm flex items-center gap-1.5 text-xs sm:text-sm"
            title="تصدير جدول المشتريات إلى Excel"
          >
            <Download className="w-4 h-4 flex-shrink-0" />
            <span>تصدير Excel</span>
          </button>

          {hasPermission('purchases', 'create') && (
            <button
              onClick={handleOpenNewInvoice}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 md:px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm flex items-center gap-2 text-sm flex-1 sm:flex-initial justify-center"
            >
              <Plus className="w-5 h-5 flex-shrink-0" />
              فاتورة مشتريات جديدة
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">إجمالي المشتريات</div>
            <div className="text-xl md:text-2xl font-black text-indigo-600 dir-ltr">{formatCurrency(totalPurchasesSum)}</div>
          </div>
          <div className="w-10 h-10 md:w-12 md:h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-bold flex-shrink-0">
            <DollarSign className="w-5 h-5 md:w-6 md:h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">عدد الفواتير</div>
            <div className="text-xl md:text-2xl font-black text-slate-800">{purchaseInvoices.length}</div>
          </div>
          <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold flex-shrink-0">
            <FileText className="w-5 h-5 md:w-6 md:h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">مسودات تحتاج إكمال</div>
            <div className="text-xl md:text-2xl font-black text-amber-600">{draftInvoicesCount}</div>
          </div>
          <div className="w-10 h-10 md:w-12 md:h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center font-bold flex-shrink-0">
            <Clock className="w-5 h-5 md:w-6 md:h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">عدد الموردين</div>
            <div className="text-xl md:text-2xl font-black text-slate-800">{suppliers.length}</div>
          </div>
          <div className="w-10 h-10 md:w-12 md:h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center font-bold flex-shrink-0">
            <Building2 className="w-5 h-5 md:w-6 md:h-6" />
          </div>
        </div>
      </div>

      {/* Search & Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Text Search */}
          <div className="flex-1 flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 focus-within:border-indigo-400 focus-within:bg-white transition-all">
            <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="بحث بالمورد، رقم الفاتورة، اسم الصنف، أو المستخدم..."
              className="w-full bg-transparent outline-none text-sm text-slate-800"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-red-500 p-1">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Filters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Filter by Supplier */}
            <select
              className="p-2 border border-slate-200 rounded-xl bg-white text-xs md:text-sm font-semibold text-slate-700 outline-none w-full"
              value={suppliers.find(s => s.id === filterSupplier || s.name.toLowerCase() === filterSupplier.toLowerCase())?.id || filterSupplier}
              onChange={e => {
                setFilterSupplier(e.target.value);
                if (!e.target.value) onClearSupplierFilter?.();
              }}
            >
              <option value="">جميع الموردين</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            {/* Filter by Creator User */}
            <select
              className="p-2 border border-slate-200 rounded-xl bg-white text-xs md:text-sm font-semibold text-slate-700 outline-none w-full"
              value={filterUser}
              onChange={e => setFilterUser(e.target.value)}
            >
              <option value="">جميع المستخدمين</option>
              {creatorUsersList.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>

            {/* Filter by Status */}
            <select
              className="p-2 border border-slate-200 rounded-xl bg-white text-xs md:text-sm font-semibold text-slate-700 outline-none w-full"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as any)}
            >
              <option value="">جميع الحالات</option>
              <option value="completed">مكتملة</option>
              <option value="draft">مسودة تحتاج إكمال</option>
            </select>

            {/* Sort by */}
            <select
              className="p-2 border border-slate-200 rounded-xl bg-white text-xs md:text-sm font-semibold text-slate-700 outline-none w-full"
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
            >
              <option value="date">التاريخ (الأحدث)</option>
              <option value="date_asc">التاريخ (الأقدم)</option>
              <option value="total">المبلغ (الأعلى)</option>
              <option value="total_asc">المبلغ (الأقل)</option>
              <option value="user">المستخدم (أبجدياً)</option>
            </select>
          </div>
        </div>

        {/* Filter Summary Tags if active */}
        {(filterSupplier || filterUser || filterStatus || searchTerm) && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 flex-wrap text-xs">
            <span className="text-slate-400 font-bold">التصفيات النشطة:</span>
            {filterSupplier && (
              <span className="bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 border border-indigo-200">
                المورد: {suppliers.find(s => s.id === filterSupplier)?.name || filterSupplier}
                <button
                  onClick={() => {
                    setFilterSupplier('');
                    onClearSupplierFilter?.();
                  }}
                  title="إلغاء تصفية المورد"
                >
                  <X className="w-3 h-3 hover:text-red-500" />
                </button>
              </span>
            )}
            {filterUser && (
              <span className="bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 border border-blue-200">
                المستخدم: {filterUser}
                <button onClick={() => setFilterUser('')}><X className="w-3 h-3 hover:text-red-500" /></button>
              </span>
            )}
            {filterStatus && (
              <span className="bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 border border-amber-200">
                الحالة: {filterStatus === 'draft' ? 'مسودة تحتاج إكمال' : 'مكتملة'}
                <button onClick={() => setFilterStatus('')}><X className="w-3 h-3 hover:text-red-500" /></button>
              </span>
            )}
            <button
              onClick={() => {
                setFilterSupplier('');
                setFilterUser('');
                setFilterStatus('');
                setSearchTerm('');
                onClearSupplierFilter?.();
              }}
              className="text-red-600 hover:underline mr-auto font-bold flex items-center gap-1"
            >
              <FilterX className="w-3.5 h-3.5" /> إلغاء كل التصفيات
            </button>
          </div>
        )}
      </div>

      {/* =========================================================================
          VIEW MODE 1: CARDS VIEW (Responsive & Mobile-first)
         ========================================================================= */}
      {viewMode === 'card' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {paginatedInvoices.map(inv => {
            const isDraft = inv.status === 'draft' || (!inv.items || inv.items.length === 0);
            return (
              <div
                key={inv.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
              >
                {/* Card Top */}
                <div className="p-4 sm:p-5">
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <div>
                      <h3 className="font-black text-slate-800 text-base sm:text-lg flex items-center gap-1.5 leading-snug">
                        <Building2 className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                        {inv.supplierName}
                      </h3>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">{inv.id}</div>
                    </div>

                    {/* Status Badge */}
                    {isDraft ? (
                      <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-black px-2.5 py-1 rounded-full whitespace-nowrap">
                        <Clock className="w-3 h-3" />
                        مسودة تحتاج إكمال
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-black px-2.5 py-1 rounded-full whitespace-nowrap">
                        <CheckCircle2 className="w-3 h-3" />
                        مكتملة
                      </span>
                    )}
                  </div>

                  {/* Metadata: Date, User, Invoice # */}
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 mb-3">
                    <div className="flex items-center gap-1 text-slate-700">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span>{parseDateSafely(inv.date || inv.id).toLocaleDateString('ar-LY')}</span>
                    </div>

                    <div className="flex items-center gap-1 text-slate-700 truncate" title={inv.createdBy || 'غير محدد'}>
                      <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="font-bold truncate">{inv.createdBy || 'مدير النظام'}</span>
                    </div>

                    {inv.invoiceNumber && (
                      <div className="col-span-2 flex items-center gap-1 text-slate-700 pt-1 border-t border-slate-200/60">
                        <span className="text-slate-400 font-bold">فاتورة المورد:</span>
                        <span className="font-mono font-bold text-indigo-700">{inv.invoiceNumber}</span>
                      </div>
                    )}
                  </div>

                  {/* Items Summary */}
                  <div className="mb-3 text-xs">
                    {inv.items && inv.items.length > 0 ? (
                      <div>
                        <span className="font-bold text-slate-700">الأصناف ({inv.items.length}): </span>
                        <span className="text-slate-500 line-clamp-2">
                          {inv.items.map(it => `${it.itemName} (${it.qty} ${it.unit})`).join('، ')}
                        </span>
                      </div>
                    ) : (
                      <div className="text-amber-700 bg-amber-50/70 p-2 rounded-lg border border-amber-200/50 flex items-center gap-1.5 text-xs font-bold">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        لم يتم إدراج بنود بعد (تم حفظ المرفق كمسودة)
                      </div>
                    )}
                  </div>

                  {/* Notes snippet */}
                  {inv.notes && (
                    <div className="text-xs text-slate-500 bg-yellow-50/60 p-2 rounded-lg border border-yellow-200/50 mb-3 truncate" title={inv.notes}>
                      <span className="font-bold text-yellow-800">ملاحظة: </span>{inv.notes}
                    </div>
                  )}

                  {/* Financials & Attachments Bar */}
                  <div className="flex justify-between items-end pt-2 border-t border-slate-100">
                    <div>
                      <div className="text-[11px] font-bold text-slate-400">الصافي الإجمالي</div>
                      <div className="text-lg font-black text-indigo-700 font-mono dir-ltr">
                        {formatCurrency(inv.netTotal)}
                      </div>
                    </div>

                    {inv.attachments && inv.attachments.length > 0 ? (
                      <button
                        onClick={() => {
                          setViewingAttachmentsFor(inv);
                          setActiveAttachmentIdx(0);
                        }}
                        className="inline-flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                        title="عرض المرفقات"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        <span>{inv.attachments.length} مرفقات</span>
                      </button>
                    ) : (
                      <span className="text-xs text-slate-300">بدون مرفقات</span>
                    )}
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="bg-slate-50 p-2.5 sm:px-4 border-t border-slate-100 flex items-center justify-between gap-1">
                  <button
                    onClick={() => setViewingInvoiceDetails(inv)}
                    className="flex-1 py-1.5 px-2 bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 rounded-lg text-xs font-bold border border-slate-200 transition-colors flex items-center justify-center gap-1"
                    title="عرض التفاصيل"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    تفاصيل
                  </button>

                  {hasPermission('purchases', 'print') && (
                    <button
                      onClick={() => setPrintData({ type: 'PURCHASE_INVOICE', data: inv })}
                      className="p-1.5 bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 rounded-lg border border-slate-200 transition-colors"
                      title="طباعة"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  )}

                  {hasPermission('purchases', 'edit') && (
                    <button
                      onClick={() => handleEditInvoice(inv)}
                      className="p-1.5 bg-white hover:bg-blue-50 text-blue-600 rounded-lg border border-slate-200 transition-colors"
                      title="تعديل الفاتورة"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  )}

                  {hasPermission('purchases', 'delete') && (
                    <button
                      onClick={() => handleDeleteInvoice(inv.id)}
                      className="p-1.5 bg-white hover:bg-red-50 text-red-500 rounded-lg border border-slate-200 transition-colors"
                      title="حذف الفاتورة"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          VIEW MODE 2: TABLE VIEW
         ========================================================================= */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 text-xs font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3 w-12 text-center text-slate-400">#</th>
                  <th className="py-3 px-3 w-36 whitespace-nowrap">التاريخ / الإشاري</th>
                  <th className="py-3 px-4 min-w-[180px]">المورد</th>
                  <th className="py-3 px-3 w-32 text-center whitespace-nowrap">فاتورة المورد</th>
                  <th className="py-3 px-3 w-28 text-center whitespace-nowrap">الحالة</th>
                  <th className="py-3 px-4 min-w-[180px] max-w-sm">الأصناف والبنود</th>
                  <th className="py-3 px-4 w-36 text-center whitespace-nowrap">المبلغ</th>
                  <th className="py-3 px-3 w-32 text-center whitespace-nowrap">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedInvoices.map((inv, idx) => {
                  const isDraft = inv.status === 'draft' || (!inv.items || inv.items.length === 0);
                  const refCode = inv.id ? (inv.id.includes(' - ') ? inv.id.split(' - ')[0] : inv.id) : '-';
                  return (
                    <tr key={inv.id} className="hover:bg-indigo-50/20 transition-colors">
                      <td className="py-3.5 px-3 text-center text-slate-400 font-mono text-xs">{(currentPage - 1) * rowsPerPage + idx + 1}</td>
                      
                      {/* Date & Ref Code */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="font-bold text-slate-800 text-xs">
                          {parseDateSafely(inv.date || inv.id).toLocaleDateString('ar-LY')}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5" title={inv.id}>
                          {refCode}
                        </div>
                      </td>

                      {/* Supplier & Creator */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5 break-words whitespace-normal leading-snug">
                          <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span>{inv.supplierName}</span>
                        </div>
                        {inv.createdBy && (
                          <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-1 font-medium">
                            <User className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>بواسطة: {inv.createdBy}</span>
                          </div>
                        )}
                      </td>

                      {/* Supplier's Invoice Number & Attachments */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {inv.invoiceNumber ? (
                            <span className="font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-bold border border-slate-200">
                              {inv.invoiceNumber}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs font-mono">-</span>
                          )}
                          {inv.attachments && inv.attachments.length > 0 && (
                            <button
                              onClick={() => {
                                setViewingAttachmentsFor(inv);
                                setActiveAttachmentIdx(0);
                              }}
                              className="inline-flex items-center gap-0.5 text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded text-[11px] font-bold border border-indigo-100 transition-colors"
                              title={`عرض المرفقات (${inv.attachments.length})`}
                            >
                              <Paperclip className="w-3 h-3" />
                              <span>{inv.attachments.length}</span>
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        {isDraft ? (
                          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-[11px] font-bold px-2.5 py-1 rounded-full border border-amber-200">
                            <Clock className="w-3 h-3" /> مسودة
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[11px] font-bold px-2.5 py-1 rounded-full border border-emerald-200">
                            <Check className="w-3 h-3" /> مكتملة
                          </span>
                        )}
                      </td>

                      {/* Items */}
                      <td className="py-3.5 px-4">
                        {inv.items && inv.items.length > 0 ? (
                          <div className="text-xs text-slate-700 leading-relaxed">
                            <span className="font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px] ml-1.5 whitespace-nowrap">
                              {inv.items.length} {inv.items.length === 1 ? 'صنف' : 'أصناف'}
                            </span>
                            <span className="text-slate-600 font-medium line-clamp-1" title={inv.items.map(it => it.itemName).join('، ')}>
                              {inv.items.map(it => it.itemName).join('، ')}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-amber-600 font-medium">مسودة بدون بنود</span>
                        )}
                      </td>

                      {/* Net Amount / Gross */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="font-bold text-indigo-700 font-mono text-sm dir-ltr">
                          {formatCurrency(inv.netTotal || inv.total || 0)}
                        </div>
                        {inv.total && inv.netTotal && inv.total !== inv.netTotal && (
                          <div className="text-[10px] text-slate-400 line-through font-mono dir-ltr" title="الإجمالي قبل الخصم">
                            {formatCurrency(inv.total)}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <div className="flex justify-center gap-1 items-center">
                          <button
                            onClick={() => setViewingInvoiceDetails(inv)}
                            className="text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-lg transition-colors"
                            title="عرض التفاصيل"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {hasPermission('purchases', 'print') && (
                            <button
                              onClick={() => setPrintData({ type: 'PURCHASE_INVOICE', data: inv })}
                              className="text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-lg transition-colors"
                              title="طباعة"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          )}
                          {hasPermission('purchases', 'edit') && (
                            <button
                              onClick={() => handleEditInvoice(inv)}
                              className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1.5 rounded-lg transition-colors"
                              title="تعديل الفاتورة"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {hasPermission('purchases', 'delete') && (
                            <button
                              onClick={() => handleDeleteInvoice(inv.id)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                              title="حذف الفاتورة"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Bar */}
      {filteredInvoices.length > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white border border-slate-200 rounded-xl p-4 mb-6 shadow-sm">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-3.5 py-2 rounded-lg font-bold text-xs sm:text-sm transition-colors shadow-sm"
              title="تصدير جدول المشتريات إلى Excel"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>تصدير Excel</span>
            </button>
            <span className="text-xs sm:text-sm text-slate-500 font-medium">
              عرض {((currentPage - 1) * rowsPerPage) + 1} إلى {Math.min(currentPage * rowsPerPage, filteredInvoices.length)} من {filteredInvoices.length} فاتورة
            </span>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => {
                  setCurrentPage(p => Math.max(1, p - 1));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }} 
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm font-bold transition-all shadow-sm flex items-center gap-1"
              >
                <ChevronRight className="w-4 h-4" />
                السابق
              </button>
              <div className="flex items-center gap-1 px-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => {
                    if (totalPages <= 7) return true;
                    if (page === 1 || page === totalPages) return true;
                    if (Math.abs(page - currentPage) <= 1) return true;
                    return false;
                  })
                  .reduce((acc: (number | string)[], page, idx, arr) => {
                    if (idx > 0 && (page as number) - (arr[idx - 1] as number) > 1) {
                      acc.push('...');
                    }
                    acc.push(page);
                    return acc;
                  }, [])
                  .map((item, idx) => {
                    if (item === '...') {
                      return <span key={`ellipsis-${idx}`} className="px-2 text-slate-400 font-bold">...</span>;
                    }
                    const pageNum = item as number;
                    const isActive = pageNum === currentPage;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => {
                          setCurrentPage(pageNum);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className={`min-w-[34px] h-[34px] text-xs font-bold rounded-lg border transition-all ${
                          isActive
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
              </div>
              <button 
                onClick={() => {
                  setCurrentPage(p => Math.min(totalPages, p + 1));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }} 
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm font-bold transition-all shadow-sm flex items-center gap-1"
              >
                التالي
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {filteredInvoices.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400">
          <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <div className="font-bold text-base text-slate-600 mb-1">لا توجد فواتير مشتريات مطابقة</div>
          <p className="text-xs text-slate-400">
            {searchTerm || filterSupplier || filterUser || filterStatus
              ? 'جرّب تغيير خيارات البحث أو التصفية أعلاه.'
              : 'لم يتم تسجيل أي فواتير مشتريات بعد. اضغط "فاتورة مشتريات جديدة" للبدء.'}
          </p>
        </div>
      )}

      {/* =========================================================================
          PURCHASE INVOICE EDITOR MODAL (Mobile Responsive & Split Side Viewer)
         ========================================================================= */}
      {isEditorOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-1 sm:p-3 md:p-4 overflow-y-auto">
          <div className={`bg-white rounded-2xl shadow-2xl w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto transition-all ${
            isSideViewerOpen && attachments.length > 0
              ? 'max-w-[98vw] 2xl:max-w-[1750px] h-[95vh]'
              : 'max-w-4xl max-h-[95vh]'
          }`}>
            {/* Modal Header */}
            <div className="p-3.5 sm:p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50 flex-shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-6 h-6 text-indigo-600 flex-shrink-0" />
                <div>
                  <h2 className="font-black text-slate-800 text-base sm:text-lg">
                    {editingInvoiceId ? 'تعديل فاتورة مشتريات' : 'فاتورة مشتريات جديدة'}
                  </h2>
                  <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap mt-0.5">
                    <span>بواسطة: <span className="font-bold text-indigo-600">{currentUser?.displayName || currentUser?.username || 'المستخدم'}</span></span>
                    <span className="text-slate-300">•</span>
                    <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      {editingInvoiceId ? editingInvoiceId : `الترميز: Ref-${((idCountersRef?.current?.pinv || 1).toString().padStart(3, '0'))}-PINV-${(invoiceDate ? new Date(invoiceDate).getFullYear() : new Date().getFullYear())}-${supplierName.trim() || 'اسم_المورد'}`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {attachments.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsSideViewerOpen(!isSideViewerOpen);
                      setSideViewerZoom(1);
                      setSideViewerRotation(0);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 ${
                      isSideViewerOpen
                        ? 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200'
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                    }`}
                    title={isSideViewerOpen ? 'إغلاق العرض الجانبي للمرفقات' : 'تكبير المرفقات وعرضها بجانب الحقول للمساعدة في نقل البيانات'}
                  >
                    {isSideViewerOpen ? (
                      <>
                        <Minimize2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">إغلاق العرض الجانبي</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>تكبير المرفقات</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  onClick={() => setIsEditorOpen(false)}
                  className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Modal Body: Split view when isSideViewerOpen */}
            <div className={`flex-1 overflow-hidden min-h-0 ${
              isSideViewerOpen && attachments.length > 0 ? 'flex flex-col lg:flex-row' : 'overflow-y-auto'
            }`}>
              {/* Form Fields Column */}
              <div className={`p-3 sm:p-6 space-y-5 text-right overflow-y-auto ${
                isSideViewerOpen && attachments.length > 0 ? 'w-full lg:w-7/12 xl:w-1/2 border-l border-slate-200' : 'w-full'
              }`}>
                {/* Draft Status Notice Banner */}
                {isDraftForm && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-800 animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-amber-900 mb-0.5">سيتم حفظ الفاتورة كـ "مسودة تحتاج إكمال":</div>
                    <div>
                      {attachments.length > 0 && validItems.length === 0
                        ? 'تم إرفاق صورة الفاتورة بدون إدراج بنود تفصيلية، وسيتمكن فريق العمل من إكمال بنودها لاحقاً.'
                        : 'تم تفعيل وضع المسودة يدوياً لحفظ الفاتورة والرجوع لإكمالها لاحقاً.'}
                    </div>
                  </div>
                </div>
              )}

              {/* General Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                    تاريخ الفاتورة *
                  </label>
                  <input
                    type="date"
                    className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-indigo-500 text-sm bg-white"
                    value={invoiceDate}
                    onChange={e => setInvoiceDate(e.target.value)}
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold text-slate-700 flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                      المورد *
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowQuickAddSupplier(!showQuickAddSupplier)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-bold"
                    >
                      + مورد جديد
                    </button>
                  </div>
                  <select
                    className={`w-full p-2.5 border rounded-lg outline-none focus:border-indigo-500 text-sm font-bold bg-white transition-colors ${
                      !supplierName ? 'border-amber-400 bg-amber-50/20' : 'border-slate-300'
                    }`}
                    value={selectedSupplierId}
                    onChange={e => handleSupplierSelect(e.target.value)}
                  >
                    <option value="">-- اختر المورد من القائمة * --</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name} {s.phone ? `(${s.phone})` : ''}</option>
                    ))}
                    <option value="__manual__">✏️ إدخال اسم مورد آخر يدوياً...</option>
                  </select>

                  {selectedSupplierId === '__manual__' && (
                    <input
                      type="text"
                      placeholder="اكتب اسم المورد هنا *"
                      className="w-full mt-2 p-2 border border-indigo-400 rounded-lg text-sm font-bold bg-indigo-50/30 outline-none focus:border-indigo-600"
                      value={supplierName}
                      onChange={e => setSupplierName(e.target.value)}
                      autoFocus
                    />
                  )}
                  {!supplierName && (
                    <div className="text-[11px] text-amber-600 mt-1 font-semibold">
                      * يرجى تحديد المورد الذي تم الشراء منه.
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-indigo-600" />
                    رقم فاتورة المورد (اختياري)
                  </label>
                  <input
                    type="text"
                    placeholder="رقم الفاتورة الورقية"
                    className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-indigo-500 text-sm font-mono bg-white"
                    value={supplierInvoiceNumber}
                    onChange={e => setSupplierInvoiceNumber(e.target.value)}
                  />
                </div>
              </div>

              {/* Quick Add Supplier Drawer */}
              {showQuickAddSupplier && (
                <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-200 animate-in fade-in duration-200">
                  <div className="text-xs font-bold text-indigo-800 mb-2">إضافة مورد جديد سريعة:</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <input
                      type="text"
                      placeholder="اسم المورد أو الشركة *"
                      className="p-2 border border-indigo-200 rounded-lg text-sm bg-white"
                      value={quickSupplierName}
                      onChange={e => setQuickSupplierName(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="رقم الهاتف"
                      className="p-2 border border-indigo-200 rounded-lg text-sm bg-white font-mono text-right"
                      value={quickSupplierPhone}
                      onChange={e => setQuickSupplierPhone(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowQuickAddSupplier(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50"
                    >
                      إلغاء
                    </button>
                    <button
                      type="button"
                      onClick={handleQuickAddSupplier}
                      className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700"
                    >
                      حفظ واختيار
                    </button>
                  </div>
                </div>
              )}

              {/* Attachments Section (Emphasized for mobile & draft workflows) */}
              <div className="border border-slate-200 rounded-xl p-3 sm:p-4 bg-slate-50/60">
                <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
                  <div>
                    <h4 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                      <Paperclip className="w-4 h-4 text-indigo-600" />
                      صورة الفاتورة والمرفقات
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      إذا قمت بإرفاق صورة الفاتورة، يمكنك حفظها فوراً كمسودة دون إدراج البنود الآن.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {attachments.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsSideViewerOpen(!isSideViewerOpen);
                          setSideViewerZoom(1);
                          setSideViewerRotation(0);
                        }}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-sm inline-flex items-center gap-1.5 ${
                          isSideViewerOpen
                            ? 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                        }`}
                        title={isSideViewerOpen ? 'إغلاق العرض الجانبي' : 'تكبير المرفقات وعرضها في جانب الحقول لتسهيل نقل البيانات'}
                      >
                        {isSideViewerOpen ? (
                          <>
                            <Minimize2 className="w-4 h-4" />
                            <span>تصغير المرفقات</span>
                          </>
                        ) : (
                          <>
                            <Maximize2 className="w-4 h-4" />
                            <span>تكبير المرفقات</span>
                          </>
                        )}
                      </button>
                    )}

                    <label className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-sm inline-flex items-center gap-1.5 flex-shrink-0">
                      <Plus className="w-4 h-4" />
                      إرفاق صورة الفاتورة
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        multiple
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </label>
                  </div>
                </div>

                {attachments.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {attachments.map((att, attIdx) => (
                      <div
                        key={attIdx}
                        onClick={() => {
                          setActiveSideAttachmentIdx(attIdx);
                          setIsSideViewerOpen(true);
                          setSideViewerZoom(1);
                          setSideViewerRotation(0);
                        }}
                        className={`relative group rounded-xl border overflow-hidden bg-white shadow-sm aspect-square flex flex-col items-center justify-center p-1 cursor-pointer transition-all ${
                          isSideViewerOpen && activeSideAttachmentIdx === attIdx
                            ? 'border-indigo-500 ring-2 ring-indigo-200'
                            : 'border-slate-200 hover:border-indigo-300'
                        }`}
                        title="انقر لتكبير وعرض المرفق في الجانب"
                      >
                        {att.type.startsWith('image/') ? (
                          <img src={att.data} alt={att.name} className="w-full h-full object-cover rounded-lg" />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-500">
                            <FileText className="w-8 h-8 text-indigo-500 mb-1" />
                            <span className="text-[10px] truncate max-w-[80px]">{att.name}</span>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveAttachment(attIdx);
                          }}
                          className="absolute top-1 left-1 bg-red-600 text-white p-1 rounded-full shadow hover:bg-red-700 transition-colors z-10"
                          title="حذف المرفق"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        <div className="absolute inset-0 bg-indigo-900/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                          <Maximize2 className="w-5 h-5 text-indigo-600 drop-shadow" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-3 text-xs text-slate-400 border border-dashed border-slate-300 rounded-xl bg-white/70">
                    لا توجد صورة فاتورة مرفقة حالياً.
                  </div>
                )}
              </div>

              {/* Items Section */}
              <div>
                <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-indigo-600" />
                      بنود ومواد الفاتورة
                      {attachments.length > 0 && (
                        <span className="text-[11px] font-normal text-slate-500">(اختياري في حال وجود صورة الفاتورة)</span>
                      )}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      💡 يمكنك كتابة أي بند حر هنا دون التقيد بقائمة المواد، وتقوم القائمة باقتراح المواد المسجلة فقط لمساعدتك في سرعة الإدخال وتعبئة السعر والوحدة.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    إضافة بند جديد
                  </button>
                </div>

                {/* Items container: Table for md screens, Card-rows for mobile */}
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-sm min-w-[550px]">
                      <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 text-xs">
                        <tr>
                          <th className="p-2.5 w-8 text-center">#</th>
                          <th className="p-2.5">اسم البند / المادة</th>
                          <th className="p-2.5 w-24 text-center">الوحدة</th>
                          <th className="p-2.5 w-20 text-center">الكمية</th>
                          <th className="p-2.5 w-28 text-center">سعر الوحدة</th>
                          <th className="p-2.5 w-28 text-center">الإجمالي</th>
                          <th className="p-2.5 w-10 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {items.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-slate-50/50">
                            <td className="p-2 text-center text-slate-400 font-mono text-xs">{idx + 1}</td>
                            <td className="p-2">
                              <input
                                type="text"
                                list={`mats-list-${idx}`}
                                placeholder="مثال: حديد زاوية 40x40"
                                className="w-full p-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-800 outline-none focus:border-indigo-500"
                                value={item.itemName}
                                onChange={e => handleItemChange(idx, 'itemName', e.target.value)}
                              />
                              <datalist id={`mats-list-${idx}`}>
                                {masterMaterials.map((m, mIdx) => (
                                  <option key={m.id || mIdx} value={m.name} />
                                ))}
                              </datalist>
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                placeholder="قطعة"
                                className="w-full p-2 border border-slate-200 rounded-lg text-xs text-center text-slate-700 outline-none focus:border-indigo-500"
                                value={item.unit}
                                onChange={e => handleItemChange(idx, 'unit', e.target.value)}
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                className="w-full p-2 border border-slate-200 rounded-lg text-sm text-center font-bold text-slate-800 outline-none focus:border-indigo-500"
                                value={item.qty}
                                onChange={e => handleItemChange(idx, 'qty', e.target.value)}
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                className="w-full p-2 border border-slate-200 rounded-lg text-sm text-center font-mono font-bold text-slate-800 outline-none focus:border-indigo-500"
                                value={item.unitPrice}
                                onChange={e => handleItemChange(idx, 'unitPrice', e.target.value)}
                              />
                            </td>
                            <td className="p-2 text-center font-mono font-black text-indigo-700 dir-ltr text-sm">
                              {formatCurrency(item.totalPrice)}
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="text-slate-400 hover:text-red-500 p-1.5 rounded transition-colors"
                                title="حذف البند"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {items.length === 0 && (
                          <tr>
                            <td colSpan={7} className="p-4 text-center text-xs text-slate-400">
                              لم يتم إدراج أي بنود. يمكنك الضغط على "+ إضافة بند جديد" أو حفظ الفاتورة بالصورة فقط كمسودة.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Financial Calculation & Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات الفاتورة</label>
                  <textarea
                    rows={3}
                    placeholder="طريقة الدفع، المستلم، أو أي تفاصيل أخرى..."
                    className="w-full p-2.5 border border-slate-300 rounded-xl outline-none focus:border-indigo-500 text-sm resize-none"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                  
                  {/* Manual Draft Toggle */}
                  <label className="mt-2 flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={manualDraft}
                      onChange={e => setManualDraft(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>حفظ كمسودة تحتاج إكمال ومراجعة لاحقاً</span>
                  </label>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-bold text-slate-600">المجموع الفرعي:</span>
                    <span className="font-bold font-mono dir-ltr">{formatCurrency(subtotal)}</span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="font-bold text-slate-600">الخصم / التخفيض:</span>
                    <div className="flex items-center gap-1 w-32">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        className="w-full p-1.5 border border-slate-300 rounded text-center font-mono font-bold text-sm bg-white"
                        value={discount}
                        onChange={e => setDiscount(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-300 flex justify-between items-center">
                    <span className="font-black text-base text-slate-800">الصافي الإجمالي:</span>
                    <span className="font-black text-xl text-indigo-700 font-mono dir-ltr">
                      {formatCurrency(netTotal)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Side-by-side Attachment Viewer Column */}
            {isSideViewerOpen && attachments.length > 0 && (
              <div className="w-full lg:w-5/12 xl:w-1/2 bg-slate-900 flex flex-col h-full overflow-hidden select-none border-t lg:border-t-0">
                {/* Top Header of Side Viewer */}
                <div className="bg-slate-800 text-white px-3 sm:px-4 py-2.5 flex items-center justify-between border-b border-slate-700 shrink-0">
                  <div className="flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-indigo-400" />
                    <span className="font-bold text-xs sm:text-sm">معاينة الفاتورة الورقية</span>
                    <span className="text-[11px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full font-mono">
                      {activeSideAttachmentIdx + 1} / {attachments.length}
                    </span>
                  </div>

                  {/* Navigation Arrows & Zoom Tools */}
                  <div className="flex items-center gap-1">
                    {/* Previous / Next Arrows */}
                    {attachments.length > 1 && (
                      <div className="flex items-center bg-slate-700/80 rounded-lg p-0.5 ml-2 border border-slate-600">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveSideAttachmentIdx(prev => (prev > 0 ? prev - 1 : attachments.length - 1));
                            setSideViewerZoom(1);
                            setSideViewerRotation(0);
                          }}
                          className="p-1 hover:bg-slate-600 rounded text-slate-200 hover:text-white transition-colors"
                          title="الصورة السابقة"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        <span className="text-[11px] px-2 font-mono font-bold text-slate-300">
                          {activeSideAttachmentIdx + 1} من {attachments.length}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveSideAttachmentIdx(prev => (prev < attachments.length - 1 ? prev + 1 : 0));
                            setSideViewerZoom(1);
                            setSideViewerRotation(0);
                          }}
                          className="p-1 hover:bg-slate-600 rounded text-slate-200 hover:text-white transition-colors"
                          title="الصورة التالية"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* Zoom Out */}
                    <button
                      type="button"
                      onClick={() => setSideViewerZoom(z => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                      className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors"
                      title="تصغير (-)"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>

                    {/* Zoom Percentage */}
                    <button
                      type="button"
                      onClick={() => { setSideViewerZoom(1); setSideViewerRotation(0); }}
                      className="text-[11px] px-1.5 py-0.5 rounded hover:bg-slate-700 text-slate-300 font-mono"
                      title="إعادة ضبط الحجم (100%)"
                    >
                      {Math.round(sideViewerZoom * 100)}%
                    </button>

                    {/* Zoom In */}
                    <button
                      type="button"
                      onClick={() => setSideViewerZoom(z => Math.min(3, Number((z + 0.25).toFixed(2))))}
                      className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors"
                      title="تكبير (+)"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>

                    {/* Rotate */}
                    <button
                      type="button"
                      onClick={() => setSideViewerRotation(r => (r + 90) % 360)}
                      className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors"
                      title="تدوير الصورة 90°"
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>

                    {/* Close Side Viewer */}
                    <button
                      type="button"
                      onClick={() => setIsSideViewerOpen(false)}
                      className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded text-slate-400 transition-colors ml-1"
                      title="تصغير وإخفاء العرض الجانبي"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Main Preview Canvas */}
                <div className="flex-1 overflow-auto p-4 flex items-center justify-center relative bg-slate-950/70">
                  {/* Floating Navigation Overlay Arrows for ultra-fast flipping */}
                  {attachments.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSideAttachmentIdx(prev => (prev > 0 ? prev - 1 : attachments.length - 1));
                          setSideViewerZoom(1);
                          setSideViewerRotation(0);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 bg-slate-800/80 hover:bg-slate-700 text-white p-2.5 rounded-full shadow-lg backdrop-blur-sm border border-slate-600/50 transition-all z-10 hover:scale-110"
                        title="السابق"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSideAttachmentIdx(prev => (prev < attachments.length - 1 ? prev + 1 : 0));
                          setSideViewerZoom(1);
                          setSideViewerRotation(0);
                        }}
                        className="absolute left-3 top-1/2 -translate-y-1/2 bg-slate-800/80 hover:bg-slate-700 text-white p-2.5 rounded-full shadow-lg backdrop-blur-sm border border-slate-600/50 transition-all z-10 hover:scale-110"
                        title="التالي"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                    </>
                  )}

                  {/* The Image or PDF Embed */}
                  {(() => {
                    const currentAtt = attachments[activeSideAttachmentIdx] || attachments[0];
                    if (!currentAtt) return null;

                    if (currentAtt.type?.startsWith('image/')) {
                      return (
                        <div 
                          className="transition-transform duration-200 ease-out origin-center"
                          style={{
                            transform: `scale(${sideViewerZoom}) rotate(${sideViewerRotation}deg)`
                          }}
                        >
                          <img
                            src={currentAtt.data}
                            alt={currentAtt.name}
                            className="max-w-full max-h-[72vh] object-contain rounded shadow-2xl border border-slate-700/50"
                          />
                        </div>
                      );
                    }

                    if (currentAtt.type === 'application/pdf') {
                      return (
                        <iframe
                          src={currentAtt.data}
                          title={currentAtt.name}
                          className="w-full h-full min-h-[500px] rounded border border-slate-700 bg-white"
                        />
                      );
                    }

                    return (
                      <div className="text-center text-slate-400 p-8">
                        <FileText className="w-16 h-16 mx-auto mb-2 text-indigo-400" />
                        <div className="font-bold text-sm text-slate-200">{currentAtt.name}</div>
                        <div className="text-xs text-slate-500 mt-1">نوع الملف غير قابل للمعاينة المباشرة</div>
                      </div>
                    );
                  })()}
                </div>

                {/* Bottom Thumbnails Strip (if multiple attachments) */}
                {attachments.length > 1 && (
                  <div className="bg-slate-800/90 border-t border-slate-700/80 p-2 flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-thin">
                    {attachments.map((att, idx) => {
                      const isActive = idx === activeSideAttachmentIdx;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setActiveSideAttachmentIdx(idx);
                            setSideViewerZoom(1);
                            setSideViewerRotation(0);
                          }}
                          className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 relative ${
                            isActive
                              ? 'border-indigo-400 ring-2 ring-indigo-400/40 scale-105'
                              : 'border-slate-600 opacity-60 hover:opacity-100'
                          }`}
                          title={`صورة ${idx + 1}: ${att.name}`}
                        >
                          {att.type?.startsWith('image/') ? (
                            <img src={att.data} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-slate-700 flex items-center justify-center text-slate-300">
                              <FileText className="w-5 h-5" />
                            </div>
                          )}
                          <span className="absolute bottom-0 right-0 bg-black/70 text-white text-[9px] px-1 rounded-tl font-mono">
                            {idx + 1}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

            {/* Save Error Alert Banner */}
            {saveError && (
              <div className="mx-4 mb-2 bg-red-50 border border-red-300 rounded-xl p-3 flex items-center gap-3 text-red-700 text-xs sm:text-sm animate-in fade-in">
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" />
                <div className="flex-1 font-bold">
                  {saveError}
                </div>
                <button
                  type="button"
                  onClick={handleSaveInvoice}
                  className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors shadow-xs"
                >
                  إعادة المحاولة
                </button>
              </div>
            )}

            {/* Modal Footer */}
            <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50 flex gap-2 justify-end flex-shrink-0">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setIsEditorOpen(false)}
                className="px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-50 transition-colors text-sm"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveInvoice}
                className="px-7 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 disabled:opacity-75 shadow-sm flex items-center gap-2 text-sm transition-colors"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isSaving ? 'جاري التحقق والحفظ بالخادم...' : (isDraftForm ? 'حفظ كمسودة' : 'حفظ الفاتورة')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          INVOICE DETAILS MODAL
         ========================================================================= */}
      {viewingInvoiceDetails && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200 my-auto">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <ShoppingBag className="w-6 h-6 text-indigo-600 flex-shrink-0" />
                <div>
                  <h2 className="font-black text-slate-800 text-base sm:text-lg">تفاصيل فاتورة المشتريات</h2>
                  <div className="text-xs text-slate-500 font-mono">{viewingInvoiceDetails.id}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {hasPermission('purchases', 'print') && (
                  <button
                    onClick={() => setPrintData({ type: 'PURCHASE_INVOICE', data: viewingInvoiceDetails })}
                    className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold"
                  >
                    <Printer className="w-4 h-4" />
                    <span className="hidden sm:inline">طباعة</span>
                  </button>
                )}
                <button
                  onClick={() => setViewingInvoiceDetails(null)}
                  className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-6 text-right overflow-y-auto">
              {/* Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm">
                <div>
                  <div className="text-xs text-slate-400 font-bold mb-1">المورد</div>
                  <div className="font-bold text-slate-800">{viewingInvoiceDetails.supplierName}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-bold mb-1">التاريخ</div>
                  <div className="font-bold text-slate-800">{parseDateSafely(viewingInvoiceDetails.date).toLocaleDateString('ar-LY')}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-bold mb-1">فاتورة المورد</div>
                  <div className="font-bold font-mono text-slate-800">{viewingInvoiceDetails.invoiceNumber || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-bold mb-1">أنشئت بواسطة</div>
                  <div className="font-bold text-indigo-700 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-indigo-500" />
                    {viewingInvoiceDetails.createdBy || 'مدير النظام'}
                  </div>
                </div>
              </div>

              {/* Status Banner in View */}
              {viewingInvoiceDetails.status === 'draft' || (!viewingInvoiceDetails.items || viewingInvoiceDetails.items.length === 0) ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 text-xs font-bold text-amber-800">
                  <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  هذه الفاتورة مسودة تحتاج إكمال بنودها التفصيلية.
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2 text-xs font-bold text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  فاتورة مكتملة تم إدراج بنودها ومراجعتها.
                </div>
              )}

              {/* Items Table */}
              <div>
                <h4 className="font-bold text-sm text-slate-800 mb-2">قائمة الأصناف والبنود</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-slate-100 text-slate-700 text-xs">
                      <tr>
                        <th className="p-3 text-center w-10">#</th>
                        <th className="p-3">الصنف / المادة</th>
                        <th className="p-3 text-center">الكمية</th>
                        <th className="p-3 text-center">سعر الوحدة</th>
                        <th className="p-3 text-center">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {viewingInvoiceDetails.items && viewingInvoiceDetails.items.length > 0 ? (
                        viewingInvoiceDetails.items.map((it, idx) => (
                          <tr key={idx}>
                            <td className="p-3 text-center text-slate-400 font-mono text-xs">{idx + 1}</td>
                            <td className="p-3 font-bold text-slate-800">{it.itemName}</td>
                            <td className="p-3 text-center font-semibold text-slate-700">{it.qty} {it.unit}</td>
                            <td className="p-3 text-center font-mono dir-ltr">{formatCurrency(it.unitPrice)}</td>
                            <td className="p-3 text-center font-mono font-bold text-slate-800 dir-ltr">{formatCurrency(it.totalPrice)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-slate-400 text-xs">
                            لا توجد بنود مضافة (تم إرفاق صورة الفاتورة فقط)
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-full sm:w-72 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-bold">المجموع:</span>
                    <span className="font-bold font-mono dir-ltr">{formatCurrency(viewingInvoiceDetails.total)}</span>
                  </div>
                  {viewingInvoiceDetails.discount > 0 && (
                    <div className="flex justify-between items-center text-amber-600">
                      <span className="font-bold">الخصم:</span>
                      <span className="font-bold font-mono dir-ltr">-{formatCurrency(viewingInvoiceDetails.discount)}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-300 flex justify-between items-center text-base">
                    <span className="font-black text-slate-800">الصافي الإجمالي:</span>
                    <span className="font-black text-indigo-700 font-mono dir-ltr">{formatCurrency(viewingInvoiceDetails.netTotal)}</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {viewingInvoiceDetails.notes && (
                <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200 text-sm">
                  <div className="font-bold text-amber-900 mb-1 text-xs">ملاحظات:</div>
                  <div className="text-amber-800 whitespace-pre-wrap">{viewingInvoiceDetails.notes}</div>
                </div>
              )}

              {/* Attachments */}
              {viewingInvoiceDetails.attachments && viewingInvoiceDetails.attachments.length > 0 && (
                <div>
                  <h4 className="font-bold text-sm text-slate-800 mb-3 flex items-center gap-1.5">
                    <Paperclip className="w-4 h-4 text-indigo-600" />
                    المرفقات ({viewingInvoiceDetails.attachments.length})
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {viewingInvoiceDetails.attachments.map((att, attIdx) => (
                      <div
                        key={attIdx}
                        onClick={() => {
                          setViewingAttachmentsFor(viewingInvoiceDetails);
                          setActiveAttachmentIdx(attIdx);
                        }}
                        className="cursor-pointer border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:ring-2 hover:ring-indigo-400 aspect-square flex flex-col items-center justify-center p-1 bg-white transition-all"
                      >
                        {att.type.startsWith('image/') ? (
                          <img src={att.data} alt={att.name} className="w-full h-full object-cover rounded-lg" />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-500">
                            <FileText className="w-8 h-8 text-indigo-500 mb-1" />
                            <span className="text-[10px] truncate max-w-[90px]">{att.name}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2 flex-shrink-0">
              <button
                onClick={() => setViewingInvoiceDetails(null)}
                className="px-6 py-2 rounded-xl font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition-colors text-sm"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          ATTACHMENTS LIGHTBOX VIEWER MODAL (Esc to close, arrows to change)
         ========================================================================= */}
      {viewingAttachmentsFor && viewingAttachmentsFor.attachments && viewingAttachmentsFor.attachments.length > 0 && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4"
          onClick={() => setViewingAttachmentsFor(null)}
        >
          {/* Top Bar */}
          <div
            className="w-full max-w-4xl flex justify-between items-center text-white mb-4 z-10"
            onClick={e => e.stopPropagation()}
          >
            <div>
              <h3 className="font-bold text-base sm:text-lg">
                مرفق فاتورة: {viewingAttachmentsFor.supplierName} ({viewingAttachmentsFor.invoiceNumber || viewingAttachmentsFor.id})
              </h3>
              <div className="text-xs text-slate-400">
                صورة {activeAttachmentIdx + 1} من {viewingAttachmentsFor.attachments.length} (اضغط Esc للإغلاق)
              </div>
            </div>
            <button
              onClick={() => setViewingAttachmentsFor(null)}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
              title="إغلاق (Esc)"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Image & Nav */}
          <div
            className="relative max-w-4xl w-full h-[75vh] flex items-center justify-center"
            onClick={e => e.stopPropagation()}
          >
            {viewingAttachmentsFor.attachments[activeAttachmentIdx]?.type.startsWith('image/') ? (
              <img
                src={viewingAttachmentsFor.attachments[activeAttachmentIdx].data}
                alt="Attachment"
                className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
              />
            ) : (
              <div className="bg-white p-8 rounded-2xl flex flex-col items-center">
                <FileText className="w-16 h-16 text-indigo-600 mb-3" />
                <div className="font-bold text-slate-800 mb-4">{viewingAttachmentsFor.attachments[activeAttachmentIdx].name}</div>
                <a
                  href={viewingAttachmentsFor.attachments[activeAttachmentIdx].data}
                  download={viewingAttachmentsFor.attachments[activeAttachmentIdx].name}
                  className="bg-indigo-600 text-white px-5 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700"
                >
                  <Download className="w-4 h-4" />
                  تحميل المستند
                </a>
              </div>
            )}

            {viewingAttachmentsFor.attachments.length > 1 && (
              <>
                <button
                  onClick={() => setActiveAttachmentIdx(prev => (prev > 0 ? prev - 1 : viewingAttachmentsFor.attachments!.length - 1))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white p-3 rounded-full transition-colors shadow-lg"
                  title="السابق"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
                <button
                  onClick={() => setActiveAttachmentIdx(prev => (prev < viewingAttachmentsFor.attachments!.length - 1 ? prev + 1 : 0))}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white p-3 rounded-full transition-colors shadow-lg"
                  title="التالي"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
