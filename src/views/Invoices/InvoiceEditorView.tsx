import React, { useState, useEffect } from 'react';
import { useInvoices } from '../../context/InvoicesContext';
import { useWorkOrders } from '../../context/WorkOrdersContext';
import { useEstimates } from '../../context/EstimatesContext';
import { useMaterials } from '../../context/MaterialsContext';
import { useSettings } from '../../context/SettingsContext';
import { usePrint } from '../../context/PrintContext';
import { useCustomers } from '../../context/CustomersContext';
import { useShippingOrders } from '../../context/ShippingOrdersContext';
import { formatCurrency, numberToArabicWords } from '../../utils/formatters';
import { FileText, Save, X, Trash2, Plus, Printer, Check, FileEdit, Copy, Package, Factory, SlidersHorizontal, Loader2, AlertCircle, ChevronUp, ChevronDown, FileSignature, Stamp, UserPlus, Phone, User } from 'lucide-react';
import { bulkUpsert } from '../../api/client';
import { useDatabaseObject } from '../../hooks/useDatabaseObject';
import { ClausesTransferModal } from './ClausesTransferModal';
import { InvoiceItemPickerModal } from './InvoiceItemPickerModal';
import { logAudit } from '../../context/AuditLogContext';
import { useAuth } from '../../context/AuthContext';

const DEFAULT_TERMS = [
  'مدة الضمان سنة كاملة ضد عيوب التصنيع.',
  'الدفعة الأولى 50% عند اعتماد الفاتورة، والمتبقي 50% عند الاستلام.',
  'الأسعار المذكورة شاملة للتركيب والتسليم داخل المدينة.',
  'أي تعديلات في المواصفات بعد بدء التنفيذ قد يترتب عليها تكلفة إضافية.',
  'التسليم يتم في مقر الورشة أو موقع العميل وفق الاتفاق المسبق.',
  'البضاعة المباعة تخضع لشروط الفحص والمعاينة قبل الاستلام.'
];

const DEFAULT_NOTES = [
  'عرض السعر / الفاتورة المبدئية سارية لمدة 15 يوماً من تاريخ الإصدار.',
  'شكراً لتعاملكم معنا، ونسعد دائماً بخدمتكم.',
  'يرجى مراجعة المواصفات والكميات والتأكيد قبل بدء العمل.',
  'يتم الدفع نقداً أو عبر الصكوك المصدقة أو الحوالات المعتمدة.'
];

const ClausesDisplayCard = ({
  label,
  value,
  onChange,
  onOpenModal,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  onOpenModal: () => void;
  placeholder: string;
}) => {
  const [isRaw, setIsRaw] = useState(false);
  const lines = (value || '').split('\n').map(l => l.trim()).filter(Boolean);

  const handleRemoveLine = (idx: number) => {
    const newLines = [...lines];
    newLines.splice(idx, 1);
    onChange(newLines.join('\n'));
  };

  return (
    <div className="flex-1 bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex flex-wrap sm:flex-nowrap justify-between items-center gap-2 mb-2.5 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 text-sm">{label}</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {lines.length} مدرج
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsRaw(!isRaw)}
              className="text-[11px] text-slate-500 hover:text-slate-700 underline"
            >
              {isRaw ? 'عرض القائمة' : 'نص حر'}
            </button>
            <button
              type="button"
              onClick={onOpenModal}
              className="text-xs bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 hover:border-transparent font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all shadow-2xs"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>نقل وتخصيص السطور</span>
            </button>
          </div>
        </div>

        {isRaw ? (
          <textarea
            className="w-full border border-slate-300 rounded-lg p-2.5 text-xs outline-none focus:border-blue-500 h-28 resize-none"
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
          />
        ) : (
          <div className="min-h-[6.5rem] max-h-36 overflow-y-auto space-y-1.5 p-1">
            {lines.length === 0 ? (
              <div 
                onClick={onOpenModal}
                className="h-24 border border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center p-3 text-center cursor-pointer hover:bg-slate-50 transition-colors group"
              >
                <p className="text-xs text-slate-400 group-hover:text-blue-600 font-medium">
                  لا توجد سطور مدرجة حالياً.
                </p>
                <span className="text-[11px] text-blue-600 font-bold mt-1 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> انقر هنا لاختيار النماذج ونقلها
                </span>
              </div>
            ) : (
              lines.map((line, idx) => (
                <div key={idx} className="flex items-start justify-between gap-2 p-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg text-xs group transition-colors">
                  <div className="flex items-start gap-1.5 flex-1">
                    <span className="font-bold text-slate-400 text-[10px] mt-0.5">{idx + 1}.</span>
                    <span className="text-slate-700 font-medium leading-relaxed">{line}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveLine(idx)}
                    className="text-slate-300 hover:text-red-500 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    title="استبعاد السطر"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center text-[11px]">
        <button
          type="button"
          onClick={onOpenModal}
          className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1"
        >
          <SlidersHorizontal className="w-3 h-3" />
          <span>فتح قائمة المدرج وغير المدرج...</span>
        </button>
      </div>
    </div>
  );
};

export const InvoiceEditorView = ({ editingInvoice, setEditingInvoice, setViewState, setActiveTab }: any) => {
    const { currentUser, users } = useAuth();
    const [savedNotes, setSavedNotes] = useDatabaseObject('shams_savedNotes', []);
    const [savedTerms, setSavedTerms] = useDatabaseObject('shams_savedTerms', []);
    const { invoices, setInvoices } = useInvoices();
    const { workOrders, setWorkOrders } = useWorkOrders();
    const { estimates, estimateCategories } = useEstimates();
    const { masterMaterials } = useMaterials();
    const { generateId, generateIdAsync, appSettings } = useSettings();
    const { setPrintData } = usePrint();
    const { customers, setCustomers } = useCustomers();
    const { shippingOrders } = useShippingOrders();
    const [inv, setInv] = useState(() => {
      const initial = JSON.parse(JSON.stringify(editingInvoice));
      const isNewInvoice = Boolean(initial.isDraft || !initial.id);

      // إذا كانت الفاتورة مسودة أو جديدة، نتأكد من تصفير ملاحظات البنود لتبدأ فارغة ويقوم المستخدم بتعبئتها
      if (isNewInvoice && Array.isArray(initial.items)) {
        initial.items = initial.items.map((item: any) => ({
          ...item,
          notes: initial.isDraft && !initial.id ? '' : (item.notes || '')
        }));
      }

      // إذا كانت الفاتورة جديدة تماماً: نسجل المستخدم المنشئ الحالي
      if (isNewInvoice) {
        if (!initial.createdBy && currentUser) {
          initial.createdBy = {
            id: currentUser.id,
            name: currentUser.displayName,
            jobTitle: currentUser.jobTitle || 'مدير مبيعات',
            signature: currentUser.signature || '',
            stamp: currentUser.stamp || ''
          };
        } else if (initial.createdBy) {
          const matched = (users || []).find((u: any) => u.id === initial.createdBy.id || u.displayName === initial.createdBy.name) || currentUser;
          if (matched) {
            initial.createdBy.signature = initial.createdBy.signature || matched.signature || '';
            initial.createdBy.stamp = initial.createdBy.stamp || matched.stamp || '';
            initial.createdBy.jobTitle = initial.createdBy.jobTitle || matched.jobTitle || 'مدير مبيعات';
          }
        }
      } else {
        // فاتورة سابقة محفوظة: نُحافظ تماماً على المنشئ الأصلي ولا يتم تبديله بالمستخدم الحالي
        if (initial.createdBy) {
          const originalCreator = (users || []).find((u: any) => 
            (initial.createdBy.id && u.id === initial.createdBy.id) || 
            (initial.createdBy.name && (u.displayName === initial.createdBy.name || u.username === initial.createdBy.name))
          );
          if (originalCreator) {
            initial.createdBy = {
              id: originalCreator.id,
              name: initial.createdBy.name || originalCreator.displayName,
              jobTitle: originalCreator.jobTitle || initial.createdBy.jobTitle || 'مدير مبيعات',
              signature: originalCreator.signature || initial.createdBy.signature || '',
              stamp: originalCreator.stamp || initial.createdBy.stamp || ''
            };
          }
        }
      }
      return initial;
    });
    const [clauseModalType, setClauseModalType] = useState<'notes' | 'terms' | null>(null);
    const [itemPickerType, setItemPickerType] = useState<'materials' | 'estimatesOrProducts' | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // إدارة اختيار وإنشاء الزبائن
    const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
    const [newCustomerModalOpen, setNewCustomerModalOpen] = useState(false);
    const [newCustomerForm, setNewCustomerForm] = useState({ name: '', phone: '', notes: '' });
    const [customerSuccessMsg, setCustomerSuccessMsg] = useState('');
    const customerDropdownRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node)) {
          setCustomerDropdownOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredCustomers = React.useMemo(() => {
      const query = (inv.customerName || '').trim().toLowerCase();
      if (!query) return (customers || []).slice(0, 10);
      return (customers || []).filter(c => 
        (c.name && c.name.toLowerCase().includes(query)) || 
        (c.phone && c.phone.includes(query))
      ).slice(0, 10);
    }, [customers, inv.customerName]);

    const exactCustomerMatch = React.useMemo(() => {
      const query = (inv.customerName || '').trim().toLowerCase();
      if (!query) return null;
      return (customers || []).find(c => c.name && c.name.trim().toLowerCase() === query);
    }, [customers, inv.customerName]);

    const handleQuickAddCustomer = (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      
      const existing = (customers || []).find(c => c.name && c.name.trim().toLowerCase() === trimmed.toLowerCase());
      if (existing) {
        setInv(prev => ({ ...prev, customerName: existing.name }));
        setCustomerDropdownOpen(false);
        return;
      }

      const newCust = {
        id: `C${Date.now()}`,
        name: trimmed,
        phone: '',
        notes: ''
      };

      setCustomers(prev => [newCust, ...(prev || [])]);
      setInv(prev => ({ ...prev, customerName: newCust.name }));
      setCustomerDropdownOpen(false);

      logAudit({
        actionType: 'create',
        entityType: 'العملاء',
        entityId: newCust.id,
        title: `إضافة عميل جديد: ${newCust.name}`,
        details: 'تمت الإضافة السريعة من محرر الفواتير',
        targetCollection: 'customers'
      });

      setCustomerSuccessMsg(`تمت إضافة الزبون "${newCust.name}" إلى السجل بنجاح!`);
      setTimeout(() => setCustomerSuccessMsg(''), 4000);
    };

    const handleSaveDetailedCustomer = (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      const trimmed = newCustomerForm.name.trim();
      if (!trimmed) {
        alert('الرجاء إدخال اسم العميل');
        return;
      }

      const newCust = {
        id: `C${Date.now()}`,
        name: trimmed,
        phone: newCustomerForm.phone.trim(),
        notes: newCustomerForm.notes.trim()
      };

      setCustomers(prev => [newCust, ...(prev || [])]);
      setInv(prev => ({ ...prev, customerName: newCust.name }));
      setNewCustomerModalOpen(false);
      setCustomerDropdownOpen(false);
      setNewCustomerForm({ name: '', phone: '', notes: '' });

      logAudit({
        actionType: 'create',
        entityType: 'العملاء',
        entityId: newCust.id,
        title: `إضافة عميل جديد: ${newCust.name}`,
        details: `الهاتف: ${newCust.phone || '--'} | الملاحظات: ${newCust.notes || '--'}`,
        targetCollection: 'customers'
      });

      setCustomerSuccessMsg(`تمت إضافة الزبون "${newCust.name}" إلى السجل بنجاح!`);
      setTimeout(() => setCustomerSuccessMsg(''), 4000);
    };

    // مزامنة توقيع وختم المنشئ الأصلي فقط إن تم تحديثهما في إدارة المستخدمين
    useEffect(() => {
      if (users && users.length > 0) {
        setInv(prev => {
          if (!prev?.createdBy?.id && !prev?.createdBy?.name) return prev;
          const creatorUser = users.find(x => 
            (prev.createdBy?.id && x.id === prev.createdBy.id) || 
            (prev.createdBy?.name && (x.displayName === prev.createdBy.name || x.username === prev.createdBy.name))
          );
          if (creatorUser) {
            const needsUpdate = 
              (!prev.createdBy.signature && creatorUser.signature) ||
              (!prev.createdBy.stamp && creatorUser.stamp) ||
              (!prev.createdBy.jobTitle && creatorUser.jobTitle);
            if (needsUpdate) {
              return {
                ...prev,
                createdBy: {
                  ...prev.createdBy,
                  signature: creatorUser.signature || prev.createdBy.signature || '',
                  stamp: creatorUser.stamp || prev.createdBy.stamp || '',
                  jobTitle: creatorUser.jobTitle || prev.createdBy.jobTitle || ''
                }
              };
            }
          }
          return prev;
        });
      }
    }, [users]);

    useEffect(() => {
      const subtotal = inv.items.reduce((sum, item) => sum + (Number(item.sellPrice) * Number(item.requestedQty || 1)), 0);
      const net = subtotal - Number(inv.discount || 0);
      setInv(prev => ({ ...prev, total: subtotal, netTotal: net }));
    }, [inv.items, inv.discount]);

    const handleItemChange = (index, field, value) => {
      const newItems = [...inv.items];
      newItems[index] = { 
        ...newItems[index], 
        [field]: (field === 'desc' || field === 'unit' || field === 'notes') ? value : Number(value) 
      };
      setInv({ ...inv, items: newItems });
    };

    const handleMoveItem = (index: number, direction: 'up' | 'down') => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= inv.items.length) return;

      const newItems = [...inv.items];
      const temp = newItems[index];
      newItems[index] = newItems[targetIndex];
      newItems[targetIndex] = temp;

      setInv({ ...inv, items: newItems });
    };

    const handleRemoveItem = (index) => {
      const newItems = [...inv.items];
      newItems.splice(index, 1);
      setInv({ ...inv, items: newItems });
    };

    const handleAddCustomItem = () => {
      setInv({
        ...inv,
        items: [
          ...inv.items,
          { isCustom: true, desc: '', notes: '', unit: 'بند', requestedQty: 1, sellPrice: 0 }
        ]
      });
    };

    // Handlers for adding items from the Pop-up Modal
    const handleAddMaterialItem = (mat: any) => {
      setInv(prev => ({
        ...prev,
        items: [
          ...prev.items,
          {
            isMaterial: true,
            materialId: mat.id,
            desc: mat.name,
            notes: '',
            unit: mat.unit || 'قطعة',
            requestedQty: 1,
            sellPrice: Number(mat.defaultPrice) || 0
          }
        ]
      }));
    };

    const handleAddMultipleMaterials = (mats: any[]) => {
      const newItems = mats.map(mat => ({
        isMaterial: true,
        materialId: mat.id,
        desc: mat.name,
        notes: '',
        unit: mat.unit || 'قطعة',
        requestedQty: 1,
        sellPrice: Number(mat.defaultPrice) || 0
      }));
      setInv(prev => ({
        ...prev,
        items: [...prev.items, ...newItems]
      }));
    };

    const handleAddEstimateOrProductItem = (item: any) => {
      const newItem = {
        ...JSON.parse(JSON.stringify(item)),
        notes: '',
        requestedQty: 1
      };
      setInv(prev => ({
        ...prev,
        items: [...prev.items, newItem]
      }));
    };

    const handleAddMultipleEstimatesOrProducts = (itemsToAdd: any[]) => {
      const newItems = itemsToAdd.map(item => ({
        ...JSON.parse(JSON.stringify(item)),
        notes: '',
        requestedQty: 1
      }));
      setInv(prev => ({
        ...prev,
        items: [...prev.items, ...newItems]
      }));
    };

    // Calculate available materials excluding already added ones
    const availableMaterials = React.useMemo(() => {
      const existingIds = new Set(
        inv.items
          .filter(it => it.isMaterial && it.materialId != null)
          .map(it => it.materialId.toString())
      );
      const existingNames = new Set(
        inv.items
          .filter(it => it.isMaterial && it.desc)
          .map(it => it.desc.trim().toLowerCase())
      );

      return masterMaterials.filter(m =>
        !existingIds.has(m.id.toString()) &&
        !existingNames.has(m.name.trim().toLowerCase())
      );
    }, [masterMaterials, inv.items]);

    // Calculate available estimates / ready products excluding already added ones
    const availableEstimatesOrProducts = React.useMemo(() => {
      if (inv.type === 'مبدئية') {
        const existingIds = new Set(
          inv.items
            .filter(it => it.id != null)
            .map(it => it.id.toString())
        );
        const existingKeys = new Set(
          inv.items.map(it => `${it.desc}_${it.chassis}_${it.sellPrice}`)
        );

        return estimates.filter(est =>
          !existingIds.has(est.id.toString()) &&
          !existingKeys.has(`${est.desc}_${est.chassis}_${est.sellPrice}`)
        );
      } else {
        const existingSNs = new Set(
          inv.items
            .map(it => it.serialNumber)
            .filter(Boolean)
        );

        return workOrders
          .flatMap(wo => (wo.items || []).map(i => ({
            ...i,
            date: i.date || wo.date,
            lastUpdated: i.lastUpdated || i.date || wo.date,
            woId: wo.id
          })))
          .filter(i => {
            if (!i.serialNumber) return false;
            // استبعاد البنود المضافة بالفعل إلى هذه الفاتورة
            if (existingSNs.has(i.serialNumber)) return false;

            // 1. يجب أن يكون المنتج غير مباع:
            if (i.status === 'مباع' || i.saleStatus === 'مباع') return false;
            const isSoldInOtherInvoice = (invoices || []).some(otherInv =>
              otherInv.type === 'نهائية' &&
              otherInv.id !== inv.id &&
              Array.isArray(otherInv.items) &&
              otherInv.items.some(it => it.serialNumber === i.serialNumber)
            );
            if (isSoldInOtherInvoice) return false;

            // 2. يجب أن يكون المنتج غير منقول:
            if (i.shippingStatus === 'منقولة') return false;
            const isShipped = (shippingOrders || []).some(so =>
              Array.isArray(so.items) && so.items.some(it => it.serialNumber === i.serialNumber)
            );
            if (isShipped) return false;

            return true;
          });
      }
    }, [inv.type, inv.items, inv.id, estimates, workOrders, invoices, shippingOrders]);

    const saveChanges = async (asNewBranch: boolean) => {
      if (inv.items.length === 0) return alert('لا يمكن حفظ فاتورة فارغة.');
      if (!inv.customerName) return alert('يجب تحديد اسم الزبون.');

      setIsSaving(true);
      setSaveError(null);

      try {
        const finalInvoiceData = { ...inv };

        // في حال كانت فاتورة جديدة أو حفظ كجديد، نطلب الرقم الإشاري ذرياً من الخادم
        if (asNewBranch || inv.isDraft || !finalInvoiceData.id) {
          if (finalInvoiceData.isDraft) delete finalInvoiceData.isDraft;
          const targetType = inv.type === 'مبدئية' ? 'invP' : (inv.type === 'إنتاجية' ? 'invTech' : 'invF');
          const newId = await generateIdAsync(targetType, inv.customerName);
          finalInvoiceData.id = newId;
          finalInvoiceData.date = new Date().toISOString();
        }

        // الحفظ الفعلي المباشر في قاعدة البيانات على الخادم الرئيسي
        const upsertRes = await bulkUpsert('invoices', [finalInvoiceData]);
        if (!upsertRes.success) {
          throw new Error(upsertRes.error || 'فشل حفظ الفاتورة على الخادم الرئيسي.');
        }

        // تحديث الحالة محلياً فقط بعد التأكد التام من استلام الخادم وحفظه للفاتورة
        if (asNewBranch || inv.isDraft) {
          logAudit({
            actionType: 'create',
            entityType: 'فواتير المبيعات',
            entityId: finalInvoiceData.id,
            title: `إنشاء فاتورة ${finalInvoiceData.type}: ${finalInvoiceData.id}`,
            details: `العميل: ${finalInvoiceData.customerName || '--'} | الإجمالي: ${finalInvoiceData.totalAmount ? formatCurrency(finalInvoiceData.totalAmount) : '--'} د.ل | عدد البنود: ${finalInvoiceData.items?.length || 0}`,
            targetCollection: 'invoices',
            nextState: finalInvoiceData
          });
          setInvoices(prev => [finalInvoiceData, ...prev.filter(i => i.id !== finalInvoiceData.id)]);
        } else {
          logAudit({
            actionType: 'edit',
            entityType: 'فواتير المبيعات',
            entityId: finalInvoiceData.id,
            title: `تعديل فاتورة ${finalInvoiceData.type}: ${finalInvoiceData.id}`,
            details: `العميل: ${finalInvoiceData.customerName || '--'} | الإجمالي: ${finalInvoiceData.totalAmount ? formatCurrency(finalInvoiceData.totalAmount) : '--'} د.ل | عدد البنود: ${finalInvoiceData.items?.length || 0}`,
            targetCollection: 'invoices',
            previousState: editingInvoice,
            nextState: finalInvoiceData
          });
          setInvoices(prev => prev.map(i => i.id === inv.id ? finalInvoiceData : i));
        }

        if (inv.type === 'نهائية') {
          const originalSNs = (editingInvoice.isDraft ? [] : editingInvoice.items).map(i => i.serialNumber).filter(Boolean);
          const currentSNs = finalInvoiceData.items.map(i => i.serialNumber).filter(Boolean);
          const toReady = originalSNs.filter(sn => !currentSNs.includes(sn));
          const toSold = currentSNs.filter(sn => !originalSNs.includes(sn));

          if (toReady.length > 0 || toSold.length > 0) {
            setWorkOrders(prev => prev.map(wo => {
              let changed = false;
              const newWoItems = wo.items.map(wi => {
                if (toReady.includes(wi.serialNumber)) { changed = true; return { ...wi, status: wi.mfgStatus || (wi.status === 'جاهز' ? 'جاهز' : 'قيد التصنيع') }; }
                if (toSold.includes(wi.serialNumber)) { changed = true; return { ...wi, status: 'مباع', mfgStatus: wi.mfgStatus || (wi.status === 'جاهز' ? 'جاهز' : 'قيد التصنيع') }; }
                return wi;
              });
              return changed ? { ...wo, items: newWoItems } : wo;
            }));
          }
        }

        if (window.electronAPI && appSettings.outboundLogPath) {
          setPrintData({ type: 'INVOICE', data: finalInvoiceData, silentExport: true });
        } else {
          setEditingInvoice(null);
        }
        setViewState('list');
        if (editingInvoice?.sourceTab && setActiveTab) {
          setActiveTab(editingInvoice.sourceTab);
        }
      } catch (err: any) {
        console.error('[InvoiceEditorView] Save error:', err);
        const msg = err.message || 'حدث خطأ غير متوقع أثناء الاتصال بالخادم الرئيسي.';
        setSaveError(msg);
        alert(`⚠️ تنبيه أمان الفواتير:\n${msg}\n\nلم يتم إغلاق الفاتورة وبياناتك محفوظة في هذه النافذة دون أي فقدان. يرجى التحقق من الاتصال بالشبكة وإعادة المحاولة.`);
      } finally {
        setIsSaving(false);
      }
    };

    const showSerialNumber = (inv.type === 'نهائية' || inv.type === 'إنتاجية') && !inv.isMaterialsInvoice;

    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-6 mb-6 sm:mb-8 animate-in fade-in zoom-in-95">
        <div className="flex justify-between items-start sm:items-center mb-5 sm:mb-6 border-b border-slate-200 pb-4 gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2">
              <FileEdit className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 flex-shrink-0" />
              <span>{inv.type === 'إنتاجية' ? 'محرر فواتير الإنتاجية للفنيين' : (inv.isMaterialsInvoice ? `محرر فواتير بيع المواد (${inv.type})` : `محرر الفواتير الذكي (${inv.type})`)}</span>
            </h2>
            <div className="text-slate-500 text-xs sm:text-sm mt-1">
              {inv.id ? <>رقم الفاتورة: <span className="font-mono font-bold text-slate-700">{inv.id}</span> ({inv.type})</> : `إنشاء فاتورة ${inv.type} جديدة`}
            </div>
          </div>
          <button 
            onClick={() => { 
              setEditingInvoice(null); 
              setViewState('list'); 
              if (editingInvoice?.sourceTab && setActiveTab) {
                setActiveTab(editingInvoice.sourceTab);
              }
            }} 
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0"
            title="إلغاء وإغلاق"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="mb-5 sm:mb-6" ref={customerDropdownRef}>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-xs sm:text-sm font-bold text-slate-700">
              {inv.type === 'إنتاجية' ? 'اسم الفني / منفذ الأعمال *' : 'الزبون / العميل *'}
            </label>
            {inv.type !== 'إنتاجية' && (
              <button
                type="button"
                onClick={() => {
                  setNewCustomerForm({ name: (inv.customerName || '').trim(), phone: '', notes: '' });
                  setNewCustomerModalOpen(true);
                  setCustomerDropdownOpen(false);
                }}
                className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 transition-colors"
                title="إضافة عميل جديد وتعبئة بياناته"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ إضافة زبون جديد للسجل</span>
              </button>
            )}
          </div>

          <div className="relative">
            <div className="relative">
              <input 
                type="text" 
                className="w-full p-2.5 pl-10 border border-slate-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-bold text-slate-800 text-sm transition-all" 
                value={inv.customerName || ''} 
                onChange={e => {
                  setInv({ ...inv, customerName: e.target.value });
                  setCustomerDropdownOpen(true);
                }}
                onFocus={() => setCustomerDropdownOpen(true)}
                placeholder={inv.type === 'إنتاجية' ? 'اكتب اسم الفني المستفيد...' : 'ابحث أو اختر أو اكتب اسم العميل...'} 
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-slate-400">
                {exactCustomerMatch && (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    <Check className="w-3 h-3 text-emerald-600" /> مسجل بالسجل
                  </span>
                )}
                {inv.customerName && (
                  <button
                    type="button"
                    onClick={() => {
                      setInv({ ...inv, customerName: '' });
                      setCustomerDropdownOpen(true);
                    }}
                    className="hover:text-slate-600 p-0.5"
                    title="مسح"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Suggestions Dropdown */}
            {customerDropdownOpen && inv.type !== 'إنتاجية' && (
              <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
                {/* Quick Add Option when query doesn't match an existing customer */}
                {(inv.customerName || '').trim() && !exactCustomerMatch && (
                  <div className="p-2.5 bg-emerald-50 hover:bg-emerald-100/80 border-b border-emerald-200 text-emerald-900 flex items-center justify-between gap-3 transition-colors">
                    <div 
                      className="flex items-center gap-2 flex-1 cursor-pointer"
                      onClick={() => handleQuickAddCustomer((inv.customerName || '').trim())}
                    >
                      <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <Plus className="w-4 h-4" />
                      </div>
                      <div className="text-xs sm:text-sm">
                        <span className="font-medium text-emerald-800">إضافة سريعة: </span>
                        <span className="font-black text-emerald-900">"{(inv.customerName || '').trim()}"</span>
                        <span className="text-[11px] text-emerald-700 block font-normal">حفظ مباشرة في قائمة العملاء وتحديده للفاتورة</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setNewCustomerForm({ name: (inv.customerName || '').trim(), phone: '', notes: '' });
                        setNewCustomerModalOpen(true);
                        setCustomerDropdownOpen(false);
                      }}
                      className="text-xs font-bold bg-white text-emerald-800 border border-emerald-300 hover:bg-emerald-600 hover:text-white px-3 py-1.5 rounded-lg shadow-2xs transition-all shrink-0 flex items-center gap-1"
                      title="إضافة الزبون مع رقم الهاتف والملاحظات"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>+ مع تفاصيل (هاتف...)</span>
                    </button>
                  </div>
                )}

                {/* Existing Matching Customers List */}
                <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                  {filteredCustomers.length > 0 ? (
                    filteredCustomers.map(c => {
                      const isSelected = (inv.customerName || '').trim() === c.name.trim();
                      return (
                        <div
                          key={c.id}
                          className={`p-3 cursor-pointer hover:bg-blue-50/70 flex items-center justify-between transition-colors ${
                            isSelected ? 'bg-blue-50/90 text-blue-900 font-bold' : 'text-slate-800'
                          }`}
                          onClick={() => {
                            setInv({ ...inv, customerName: c.name });
                            setCustomerDropdownOpen(false);
                          }}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                              isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                            }`}>
                              <User className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-sm font-bold flex items-center gap-2">
                                <span>{c.name}</span>
                                {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                              </div>
                              {c.notes && <div className="text-xs text-slate-400 mt-0.5">{c.notes}</div>}
                            </div>
                          </div>
                          {c.phone && (
                            <div className="text-xs font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md dir-ltr flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{c.phone}</span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    !(inv.customerName || '').trim() && (
                      <div className="p-4 text-center text-xs text-slate-400">
                        لا يوجد عملاء محفوظون بعد. اكتب اسماً لإضافته كعميل جديد.
                      </div>
                    )
                  )}
                </div>

                {/* Bottom Helper Bar in Dropdown */}
                <div className="p-2 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500 px-3">
                  <span>العملاء المسجلون: <strong>{customers.length}</strong></span>
                  <button
                    type="button"
                    onClick={() => {
                      setNewCustomerForm({ name: (inv.customerName || '').trim(), phone: '', notes: '' });
                      setNewCustomerModalOpen(true);
                      setCustomerDropdownOpen(false);
                    }}
                    className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة زبون جديد</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Success Message Banner */}
          {customerSuccessMsg && (
            <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{customerSuccessMsg}</span>
            </div>
          )}
        </div>

        {/* اعتماد وتوقيع الفاتورة */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">
                <FileSignature className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-800">المسؤول عن اعتماد وتوقيع الفاتورة</div>
                <div className="text-xs text-slate-500">يظهر الاسم الظاهر والصفة والتوقيع والختم في أسفل الفاتورة المطبوعة / PDF مباشرة</div>
              </div>
            </div>
            <div className="w-full sm:w-auto">
              <select
                value={inv.createdBy?.id || currentUser?.id || 'admin-root'}
                onChange={(e) => {
                  const u = users.find(x => x.id === e.target.value);
                  if (u) {
                    setInv({
                      ...inv,
                      createdBy: {
                        id: u.id,
                        name: u.displayName,
                        jobTitle: u.jobTitle || '',
                        signature: u.signature || '',
                        stamp: u.stamp || ''
                      }
                    });
                  }
                }}
                className="w-full sm:w-auto p-2.5 border border-slate-300 rounded-lg text-sm font-bold bg-white outline-none focus:border-blue-500 shadow-xs"
              >
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.displayName} {u.jobTitle ? `(${u.jobTitle})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {inv.createdBy && (
            <div className="mt-3 pt-3 border-t border-slate-200/80 flex flex-wrap items-center gap-4 text-xs text-slate-600">
              <span>المعتمد: <strong className="text-slate-800">{inv.createdBy.name}</strong></span>
              {inv.createdBy.jobTitle && <span>الصفة: <strong className="text-slate-800">{inv.createdBy.jobTitle}</strong></span>}
              <span>
                {inv.createdBy.signature ? (
                  <span className="text-emerald-700 font-bold inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" /> التوقيع جاهز</span>
                ) : (
                  <span className="text-amber-700 font-medium">⚠ بدون صورة توقيع (يمكن إضافتها من إدارة المستخدمين)</span>
                )}
              </span>
              <span>
                {inv.createdBy.stamp ? (
                  <span className="text-indigo-700 font-bold inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" /> الختم جاهز</span>
                ) : (
                  <span className="text-slate-400">بدون ختم</span>
                )}
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 mb-6">
          <ClausesDisplayCard
            label="ملاحظات الفاتورة"
            value={inv.notes}
            onChange={val => setInv({ ...inv, notes: val })}
            onOpenModal={() => setClauseModalType('notes')}
            placeholder="أضف أي ملاحظات إضافية هنا..."
          />
          <ClausesDisplayCard
            label="الشروط والأحكام"
            value={inv.terms}
            onChange={val => setInv({ ...inv, terms: val })}
            onOpenModal={() => setClauseModalType('terms')}
            placeholder="مثال: الضمان، شروط الدفع، الخ..."
          />
        </div>

        {/* Transfer Modal for Notes & Terms (Columns: Included vs Unincluded) */}
        <ClausesTransferModal
          isOpen={clauseModalType !== null}
          onClose={() => setClauseModalType(null)}
          title={clauseModalType === 'notes' ? 'إدارة ونقل ملاحظات الفاتورة' : 'إدارة ونقل الشروط والأحكام'}
          currentText={clauseModalType === 'notes' ? (inv.notes || '') : (inv.terms || '')}
          onSave={newText => {
            if (clauseModalType === 'notes') {
              setInv({ ...inv, notes: newText });
            } else if (clauseModalType === 'terms') {
              setInv({ ...inv, terms: newText });
            }
          }}
          savedLibrary={clauseModalType === 'notes' ? (savedNotes || []) : (savedTerms || [])}
          onUpdateLibrary={newLib => {
            if (clauseModalType === 'notes') {
              setSavedNotes(newLib);
            } else if (clauseModalType === 'terms') {
              setSavedTerms(newLib);
            }
          }}
          defaultSuggestions={clauseModalType === 'notes' ? DEFAULT_NOTES : DEFAULT_TERMS}
        />

        {/* --- Items Section --- */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-slate-800 text-sm sm:text-base flex items-center gap-2">
              <Package className="w-4 h-4 text-slate-600" />
              <span>بنود ومواد الفاتورة ({inv.items.length})</span>
            </h3>
          </div>

          {/* Mobile Card Layout for items (screens < 768px) */}
          <div className="block md:hidden space-y-3">
            {inv.items.length === 0 ? (
              <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-sm">
                لم يتم إضافة أي مواد أو بنود بعد. استخدم الخيارات أدناه للإضافة.
              </div>
            ) : (
              inv.items.map((item, idx) => (
                <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 shadow-sm space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveItem(idx, 'up')}
                          className="p-1 text-slate-500 hover:text-blue-600 disabled:opacity-20 transition-colors"
                          title="نقل البند للأعلى"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === inv.items.length - 1}
                          onClick={() => handleMoveItem(idx, 'down')}
                          className="p-1 text-slate-500 hover:text-blue-600 disabled:opacity-20 transition-colors"
                          title="نقل البند للأسفل"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                        بند #{idx + 1} {item.isMaterial ? '• مادة' : item.isCustom ? '• مخصص' : ''}
                        {showSerialNumber && item.serialNumber && ` • S/N: ${item.serialNumber}`}
                      </span>
                    </div>
                    <button 
                      onClick={() => handleRemoveItem(idx)} 
                      className="text-red-500 hover:text-red-700 p-1.5 bg-white border border-red-200 rounded-lg shadow-sm transition-colors"
                      title="حذف البند"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">البيان والمواصفات</label>
                    {item.isCustom || item.isMaterial ? (
                      <input 
                        type="text" 
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg outline-none focus:border-blue-500 text-sm font-medium" 
                        placeholder="اسم المادة أو البيان..." 
                        value={item.desc} 
                        onChange={e => handleItemChange(idx, 'desc', e.target.value)} 
                      />
                    ) : (
                      <div className="bg-white p-2 border border-slate-200 rounded-lg">
                        <div className="font-bold text-slate-800 text-sm">{item.desc}</div>
                        <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                          {item.chassis && <span>شاصية: {item.chassis}</span>}
                          {(item.length || item.width || item.height) && <span>أبعاد: {item.length}x{item.width}x{item.height}</span>}
                          {item.mfgStatus && <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold border border-emerald-200">الحالة: {item.mfgStatus}</span>}
                          {item.specialty && <span className="text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded font-bold border border-amber-200">المجال: {item.specialty}</span>}
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      ملاحظات البند <span className="text-slate-400 font-normal text-[11px]">(اختياري)</span>
                    </label>
                    <input 
                      type="text" 
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg outline-none text-xs text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" 
                      placeholder="ملاحظات البند (اختياري)..." 
                      value={item.notes || ''} 
                      onChange={e => handleItemChange(idx, 'notes', e.target.value)} 
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">الوحدة</label>
                      <input 
                        type="text" 
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg text-center outline-none focus:border-blue-500 text-xs font-semibold" 
                        value={item.unit || (item.isMaterial ? 'قطعة' : 'بند')} 
                        onChange={e => handleItemChange(idx, 'unit', e.target.value)} 
                        placeholder="الوحدة" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">الكمية</label>
                      {(inv.type === 'مبدئية' || inv.type === 'إنتاجية' || item.isCustom || item.isMaterial) ? (
                        <input 
                          type="number" 
                          min="0.001" 
                          step="any"
                          className="w-full p-2 bg-white border border-slate-300 rounded-lg text-center outline-none focus:border-blue-500 font-bold text-sm" 
                          value={item.requestedQty ?? 1} 
                          onChange={e => handleItemChange(idx, 'requestedQty', e.target.value)} 
                        />
                      ) : (
                        <div className="p-2 bg-slate-200 text-slate-700 rounded-lg text-center font-bold text-sm">
                          {item.requestedQty || 1}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">سعر الوحدة</label>
                      <input 
                        type="number" 
                        min="0" 
                        step="any"
                        className="w-full p-2 bg-blue-50 border border-blue-300 rounded-lg text-center outline-none focus:border-blue-500 font-bold text-blue-700 text-sm" 
                        value={item.sellPrice ?? 0} 
                        onChange={e => handleItemChange(idx, 'sellPrice', e.target.value)} 
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-white px-3 py-2 rounded-lg border border-slate-200">
                    <span className="text-xs font-bold text-slate-500">إجمالي البند:</span>
                    <span className="text-sm font-bold text-blue-600 dir-ltr">
                      {formatCurrency((Number(item.sellPrice) || 0) * (Number(item.requestedQty) || 1))}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop / Tablet Table Layout (screens >= 768px) */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="p-3 text-center w-14">#</th>
                  <th className="p-3 w-4/12">البيان والمواصفات</th>
                  <th className="p-3 w-3/12">
                    الملاحظات <span className="text-slate-400 text-xs font-normal">(اختياري)</span>
                  </th>
                  <th className="p-3 text-center w-24">الوحدة</th>
                  {showSerialNumber && <th className="p-3 text-center w-28">S/N</th>}
                  <th className="p-3 text-center w-24">الكمية</th>
                  <th className="p-3 text-center w-32">سعر الوحدة (د.ل)</th>
                  <th className="p-3 text-center w-28">الإجمالي</th>
                  <th className="p-3 text-center w-12"></th>
                </tr>
              </thead>
              <tbody>
                {inv.items.map((item, idx) => (
                  <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-2 text-center align-middle">
                      <div className="flex flex-col items-center justify-center gap-0.5">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveItem(idx, 'up')}
                          className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-blue-600 disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-slate-500 transition-colors"
                          title="نقل البند للأعلى"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <span className="text-[11px] font-bold text-slate-400 select-none">
                          {idx + 1}
                        </span>
                        <button
                          type="button"
                          disabled={idx === inv.items.length - 1}
                          onClick={() => handleMoveItem(idx, 'down')}
                          className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-blue-600 disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-slate-500 transition-colors"
                          title="نقل البند للأسفل"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="p-3">
                      {item.isCustom || item.isMaterial ? (
                        <input 
                          type="text" 
                          className="w-full p-2 border border-slate-300 rounded outline-none focus:border-blue-500 font-medium" 
                          placeholder="اسم المادة أو البيان..." 
                          value={item.desc} 
                          onChange={e => handleItemChange(idx, 'desc', e.target.value)} 
                        />
                      ) : (
                        <>
                          <div className="font-bold text-slate-800">{item.desc}</div>
                          <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                            {item.chassis && <span>شاصية: {item.chassis}</span>}
                            {(item.length || item.width || item.height) && <span>أبعاد: {item.length}x{item.width}x{item.height}</span>}
                            {item.mfgStatus && <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold border border-emerald-200">الحالة: {item.mfgStatus}</span>}
                            {item.specialty && <span className="text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded font-bold border border-amber-200">المجال: {item.specialty}</span>}
                          </div>
                        </>
                      )}
                    </td>
                    <td className="p-3">
                      <input 
                        type="text" 
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg outline-none text-xs text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" 
                        placeholder="ملاحظات البند (اختياري)..." 
                        value={item.notes || ''} 
                        onChange={e => handleItemChange(idx, 'notes', e.target.value)} 
                      />
                    </td>
                    <td className="p-3 text-center">
                      <input 
                        type="text" 
                        className="w-full p-2 border border-slate-300 rounded text-center outline-none focus:border-blue-500 text-xs font-semibold" 
                        value={item.unit || (item.isMaterial ? 'قطعة' : 'بند')} 
                        onChange={e => handleItemChange(idx, 'unit', e.target.value)} 
                        placeholder="الوحدة" 
                      />
                    </td>
                    {showSerialNumber && (
                      <td className="p-3 text-center font-mono text-blue-600 font-bold">
                        {item.isCustom || item.isMaterial ? '-' : item.serialNumber}
                      </td>
                    )}
                    <td className="p-3 text-center">
                      {(inv.type === 'مبدئية' || inv.type === 'إنتاجية' || item.isCustom || item.isMaterial) ? (
                        <input 
                          type="number" 
                          min="0.001" 
                          step="any"
                          className="w-full p-2 border border-slate-300 rounded text-center outline-none focus:border-blue-500 font-bold" 
                          value={item.requestedQty ?? 1} 
                          onChange={e => handleItemChange(idx, 'requestedQty', e.target.value)} 
                        />
                      ) : (
                        <span className="font-bold text-slate-700">{item.requestedQty || 1}</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <input 
                        type="number" 
                        min="0" 
                        step="any"
                        className="w-full p-2 border border-blue-300 bg-blue-50 rounded text-center outline-none focus:border-blue-500 font-bold text-blue-700" 
                        value={item.sellPrice ?? 0} 
                        onChange={e => handleItemChange(idx, 'sellPrice', e.target.value)} 
                      />
                    </td>
                    <td className="p-3 text-center font-bold text-slate-700 dir-ltr whitespace-nowrap">
                      {formatCurrency((Number(item.sellPrice) || 0) * (Number(item.requestedQty) || 1))}
                    </td>
                    <td className="p-3 text-center">
                      <button onClick={() => handleRemoveItem(idx)} className="text-slate-400 hover:text-red-500 p-1.5 bg-white border rounded shadow-sm transition-colors" title="حذف البند">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}

                {inv.items.length === 0 && (
                  <tr>
                    <td colSpan={showSerialNumber ? 9 : 8} className="p-8 text-center text-slate-400 bg-slate-50/50">
                      لم يتم إضافة أي مواد أو بنود بعد. استخدم الخيارات أدناه لاختيار مواد من المخزن أو إضافة بنود مخصصة.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Unified Add Items Toolbar (Buttons opening Pop-ups + Custom Item) */}
          <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <button
                type="button"
                onClick={() => setItemPickerType('materials')}
                className="bg-white border border-blue-200 hover:border-blue-400 text-blue-700 hover:bg-blue-50/70 px-4 py-2.5 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-2xs"
              >
                <Package className="w-4 h-4 text-blue-600" />
                <span>إضافة مواد من المخزن ({availableMaterials.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setItemPickerType('estimatesOrProducts')}
                className="bg-white border border-emerald-200 hover:border-emerald-400 text-emerald-700 hover:bg-emerald-50/70 px-4 py-2.5 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-2xs"
              >
                {inv.type === 'مبدئية' ? (
                  <>
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <span>إضافة من التقديرات المعتمدة ({availableEstimatesOrProducts.length})</span>
                  </>
                ) : (
                  <>
                    <Factory className="w-4 h-4 text-emerald-600" />
                    <span>إضافة منتجات من أوامر التصنيع S/N ({availableEstimatesOrProducts.length})</span>
                  </>
                )}
              </button>
            </div>

            <button 
              type="button"
              onClick={handleAddCustomItem} 
              className="bg-white border border-slate-300 text-slate-800 px-4 py-2.5 rounded-lg font-bold hover:bg-slate-100 whitespace-nowrap text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4 text-blue-600" /> إضافة بند مخصص
            </button>
          </div>

          {/* Item Picker Modal (Materials or Estimates/Ready Products) */}
          <InvoiceItemPickerModal
            isOpen={itemPickerType !== null}
            onClose={() => setItemPickerType(null)}
            type={itemPickerType || 'materials'}
            invoiceType={inv.type}
            availableItems={itemPickerType === 'materials' ? availableMaterials : availableEstimatesOrProducts}
            onAddSingle={itemPickerType === 'materials' ? handleAddMaterialItem : handleAddEstimateOrProductItem}
            onAddMultiple={itemPickerType === 'materials' ? handleAddMultipleMaterials : handleAddMultipleEstimatesOrProducts}
            estimateCategories={estimateCategories}
          />
        </div>

        {/* --- Bottom Summary & Action Bar --- */}
        {saveError && (
          <div className="mb-4 bg-red-50 border border-red-300 rounded-xl p-3 flex items-center gap-3 text-red-700 text-xs sm:text-sm animate-in fade-in">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" />
            <div className="flex-1 font-bold">
              {saveError}
            </div>
            <button
              type="button"
              onClick={() => saveChanges(false)}
              className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors shadow-xs"
            >
              إعادة المحاولة
            </button>
          </div>
        )}

        <div className="bg-slate-800 p-4 sm:p-6 rounded-xl text-white shadow-md flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-4 sm:gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 border-b xl:border-b-0 border-slate-700 pb-3 xl:pb-0 items-center">
            <div>
              <div className="text-slate-400 text-xs sm:text-sm mb-0.5">المجموع الكلي</div>
              <div className="text-lg sm:text-xl font-bold text-slate-300 dir-ltr">{formatCurrency(inv.total)}</div>
            </div>
            <div className="bg-slate-900/80 px-3 py-2 rounded-lg border border-slate-700">
              <label className="block text-slate-300 text-xs sm:text-sm mb-1 font-bold">
                قيمة التخفيض (د.ل)
              </label>
              <div className="flex items-center gap-2">
                <input 
                  type="number" 
                  min="0" 
                  step="any"
                  className="w-full sm:w-32 p-1.5 bg-slate-950 border border-slate-600 focus:border-red-400 focus:ring-1 focus:ring-red-400 rounded-md outline-none font-bold text-red-400 text-sm sm:text-base dir-ltr text-center transition-colors" 
                  value={inv.discount || ''} 
                  onChange={e => setInv({ ...inv, discount: e.target.value })} 
                  placeholder="0" 
                />
                <span className="text-xs text-slate-400 font-bold shrink-0">د.ل</span>
              </div>
            </div>
            <div>
              <div className="text-slate-400 text-xs sm:text-sm mb-0.5">الصافي بعد التخفيض</div>
              <div className="text-xl sm:text-2xl font-bold text-green-400 dir-ltr">{formatCurrency(inv.netTotal)}</div>
              <div className="text-xs text-slate-300 mt-1 max-w-sm truncate" title={numberToArabicWords(inv.netTotal)}>
                {numberToArabicWords(inv.netTotal)}
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
            {inv.isDraft ? (
              <button 
                disabled={isSaving}
                onClick={() => saveChanges(false)} 
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:opacity-75 text-white px-6 sm:px-8 py-3 sm:py-2.5 rounded-lg font-bold shadow-lg flex items-center justify-center gap-2 text-sm sm:text-base transition-colors"
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {isSaving ? 'جاري التحقق والحفظ بالخادم...' : 'حفظ الفاتورة'}
              </button>
            ) : (
              <>
                <button 
                  disabled={isSaving}
                  onClick={() => saveChanges(false)} 
                  className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:opacity-75 text-white px-6 py-3 sm:py-2.5 rounded-lg font-bold shadow-lg flex items-center justify-center gap-2 text-sm sm:text-base transition-colors"
                >
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  {isSaving ? 'جاري الحفظ بالخادم...' : 'حفظ'}
                </button>
                {inv.type === 'مبدئية' && (
                  <button 
                    disabled={isSaving}
                    onClick={() => saveChanges(true)} 
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:opacity-75 text-white px-6 py-3 sm:py-2.5 rounded-lg font-bold shadow-lg flex items-center justify-center gap-2 text-sm sm:text-base transition-colors"
                  >
                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Copy className="w-5 h-5" />}
                    حفظ كجديد
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* New Customer Modal */}
        {newCustomerModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 text-right" dir="rtl">
              <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800">إضافة زبون جديد للسجل</h3>
                    <div className="text-xs text-slate-500">سيتم حفظ الزبون واختياره مباشرة لهذه الفاتورة</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setNewCustomerModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveDetailedCustomer} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم العميل / الشركة *</label>
                  <input
                    type="text"
                    required
                    autoFocus
                    className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 font-bold text-slate-800 text-sm"
                    placeholder="اكتب اسم العميل..."
                    value={newCustomerForm.name}
                    onChange={e => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف (اختياري)</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      className="w-full p-2.5 pr-9 border border-slate-300 rounded-lg outline-none focus:border-blue-500 font-mono text-slate-800 text-sm dir-ltr text-right"
                      placeholder="09xxxxxxxx"
                      value={newCustomerForm.phone}
                      onChange={e => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات / العنوان (اختياري)</label>
                  <textarea
                    rows={2}
                    className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:border-blue-500 text-slate-700 text-sm resize-none"
                    placeholder="العنوان، الفرع، أو أي ملاحظات هامة..."
                    value={newCustomerForm.notes}
                    onChange={e => setNewCustomerForm({ ...newCustomerForm, notes: e.target.value })}
                  />
                </div>

                <div className="flex gap-2.5 pt-3 border-t border-slate-200">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <Save className="w-4 h-4" />
                    <span>حفظ واختيار العميل</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCustomerModalOpen(false)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  };
