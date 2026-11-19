import React, { useState, useEffect, useMemo } from 'react'; 
import { useAuth } from '../../context/AuthContext';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useWorkOrders } from '../../context/WorkOrdersContext';
import { useEstimates } from '../../context/EstimatesContext';
import { useCustomers } from '../../context/CustomersContext';
import { useDrivers } from '../../context/DriversContext';
import { useSettings } from '../../context/SettingsContext';
import { usePrint } from '../../context/PrintContext';
import { useMaterials } from '../../context/MaterialsContext';
import { useShippingOrders } from '../../context/ShippingOrdersContext';
import { useInvoices } from '../../context/InvoicesContext';
import { Factory, Search, FileText, Settings, Play, Check, CheckCheck, Package, Calendar, Clock, AlertTriangle, Truck, Tag, Plus, Edit, Hash, Printer, MoveUp, MoveDown, ChevronsUpDown, ChevronUp, ChevronDown, Database, FilterX, X, Trash2, Download, FileCheck2, MapPin, Save, Grid, List, Image as ImageIcon, Wrench } from 'lucide-react';
import { formatCurrency, numberToArabicWords, calculateDurationDays, formatDurationDaysAr, parseDateSafely } from '../../utils/formatters';
import { CustomerSelect } from '../../components/ui/CustomerSelect';
import { DriverSelect } from '../../components/ui/DriverSelect';
import { AttachmentsGalleryModal } from '../../components/ui/AttachmentsGalleryModal';
import { TechnicianInvoiceModal } from './TechnicianInvoiceModal';
import { WorkOrderStatusModal } from './WorkOrderStatusModal';
import type { WorkOrderSectionStatus } from '../../types';
import * as XLSX from 'xlsx';
import { ExportFilterModal } from '../../components/ui/ExportFilterModal';
import type { ExportFilters } from '../../components/ui/ExportFilterModal';
import { logAudit } from '../../context/AuditLogContext';
import { bulkUpsert, bulkDelete, getWorkOrder } from '../../api/client';


export const WorkOrdersView = ({ setViewState, setEditingInvoice, setActiveTab, setTabStates }: any) => {
    const { invoices, setInvoices, deletedInvoices } = useInvoices();
    const { workOrders, setWorkOrders } = useWorkOrders();
    const { worksOf } = useMaterials();
    const { generateId, generateIdAsync } = useSettings();
    const { drivers } = useDrivers();
    const { shippingOrders, setShippingOrders } = useShippingOrders();
    const { setPrintData } = usePrint();
    const { customers } = useCustomers();
    const { setEditingEstimate, setEditingContext } = useEstimates();
    const [selectedItemsForInvoice, setSelectedItemsForInvoice] = useLocalStorage('wo_selectedItems', []);
    const [finalCustomer, setFinalCustomer] = useLocalStorage('wo_finalCustomer', '');
    const [showShippingModal, setShowShippingModal] = useState(false);
    const [showTechnicianInvoiceModal, setShowTechnicianInvoiceModal] = useState(false);
    const [statusModalData, setStatusModalData] = useState<{ item: any; woId: string; woDate?: string } | null>(null);
    const [searchTerm, setSearchTerm] = useLocalStorage('wo_searchTerm', '');
    const [filterMfgStatus, setFilterMfgStatus] = useLocalStorage('wo_filterMfg', 'الكل');
    const [filterSaleStatus, setFilterSaleStatus] = useLocalStorage('wo_filterSale', 'الكل');
    const [filterShipping, setFilterShipping] = useLocalStorage('wo_filterShipping', 'الكل');
    const [filterProductivity, setFilterProductivity] = useLocalStorage('wo_filterProductivity', 'الكل');
    const [filterProductivitySpecialty, setFilterProductivitySpecialty] = useLocalStorage('wo_filterProductivitySpecialty', 'أعمال كهرباء');
    const [filterDesc, setFilterDesc] = useLocalStorage('wo_filterDesc', '');

    // استخراج كافة التخصصات المتاحة ديناميكياً للفلترة متعددة الطبقات
    const availableProductivitySpecialties = useMemo(() => {
      const set = new Set<string>([
        'أعمال كهرباء',
        'أعمال سباكة',
        'أعمال حدادة وتصنيع',
        'أعمال نجارة وتشطيب',
        'أعمال دهان وديكور',
        'أعمال تكييف وتهوية'
      ]);
      try {
        const saved = localStorage.getItem('shams_technician_specialties');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) parsed.forEach((s: string) => s && set.add(s.trim()));
        }
      } catch (e) {}

      invoices.forEach(inv => {
        if (inv?.type === 'إنتاجية' && Array.isArray(inv.items)) {
          inv.items.forEach((it: any) => {
            if (it?.specialty?.trim()) set.add(it.specialty.trim());
          });
        }
      });

      return Array.from(set).filter(Boolean);
    }, [invoices]);

    const getItemStatus = (item) => {
      const itemSn = (item.serialNumber || item.sn)?.trim();
      const inv = invoices.find(inv => inv.type === 'نهائية' && Array.isArray(inv.items) && inv.items.some(x => (x.serialNumber || x.sn)?.trim() === itemSn));
      const so = shippingOrders.find(so => 
        (item.shippingOrderId && String(so.id) === String(item.shippingOrderId)) ||
        (Array.isArray(so.items) && so.items.some(x => (x.serialNumber || x.sn)?.trim() === itemSn))
      );
      const mfgStatus = item.mfgStatus || (item.status === 'جاهز' ? 'جاهز' : 'قيد التصنيع');
      const saleStatus = inv || item.status === 'مباع' ? 'مباع' : 'غير مباعة';
      const shippingStatus = so ? 'منقولة' : 'غير منقولة';
      const techInvoices = invoices.filter(i => i.type === 'إنتاجية' && Array.isArray(i.items) && i.items.some(it => (it.serialNumber || it.sn)?.trim() === itemSn)).map(ti => {
        const matchingItem = ti.items.find(it => (it.serialNumber || it.sn)?.trim() === itemSn);
        return {
          id: ti.id,
          date: ti.date,
          specialty: matchingItem?.specialty || 'إنتاجية',
          technicianName: matchingItem?.technicianName || ti.customerName
        };
      });
      return { inv, so, mfgStatus, saleStatus, shippingStatus, techInvoices };
    };

    // فحص دوري لمطابقة حالات النقل وعلاج أي حالات معلقة تلقائياً
    useEffect(() => {
      if (!workOrders || workOrders.length === 0 || !shippingOrders) return;
      const allShippedSNs = new Set<string>();
      shippingOrders.forEach(so => {
        (so.items || []).forEach((it: any) => {
          const sn = (it.serialNumber || it.sn)?.trim();
          if (sn) allShippedSNs.add(sn);
        });
      });

      let needsHeal = false;
      const healedWos = workOrders.map(wo => {
        let changed = false;
        const newItems = (wo.items || []).map((wi: any) => {
          const sn = wi.serialNumber?.trim();
          if (wi.shippingStatus === 'منقولة' && (!sn || !allShippedSNs.has(sn))) {
            changed = true;
            needsHeal = true;
            const fixed = { ...wi, shippingStatus: 'غير منقولة' };
            delete fixed.shippingOrderId;
            delete fixed.shippingOrderDate;
            return fixed;
          }
          return wi;
        });
        return changed ? { ...wo, items: newItems } : wo;
      });

      if (needsHeal) {
        setWorkOrders(healedWos);
        const changedWos = healedWos.filter((wo, idx) => wo !== workOrders[idx]);
        if (changedWos.length > 0) {
          bulkUpsert('work_orders', changedWos).catch(console.error);
        }
      }
    }, [shippingOrders]);

    const getItemCost = (item: any): number => {
      if (!item) return 0;
      if (item.totalCost !== undefined && item.totalCost !== null && !isNaN(Number(item.totalCost)) && Number(item.totalCost) > 0) {
        return Number(item.totalCost);
      }
      if (Array.isArray(item.materials) && item.materials.length > 0) {
        const matSum = item.materials.reduce((sum: number, mat: any) => sum + (Number(mat.qty || 0) * Number(mat.price || 0)), 0);
        if (matSum > 0) return matSum;
      }
      if (item.cost !== undefined && item.cost !== null && !isNaN(Number(item.cost)) && Number(item.cost) > 0) {
        return Number(item.cost);
      }
      if (item.totalCost !== undefined && item.totalCost !== null && !isNaN(Number(item.totalCost))) {
        return Number(item.totalCost);
      }
      return 0;
    };
    const [filterLength, setFilterLength] = useLocalStorage('wo_filterLen', '');
    const { hasPermission, currentUser } = useAuth();
  const [viewMode, setViewMode] = useLocalStorage('wo_viewMode', 'table');
    const [filterWidth, setFilterWidth] = useLocalStorage('wo_filterWid', '');
    const [filterHeight, setFilterHeight] = useLocalStorage('wo_filterHei', '');
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 10;
    
    const [driverId, setDriverId] = useState('');
    const [destination, setDestination] = useState('');
    const [shippingCustomerName, setShippingCustomerName] = useState('');
    const [isSavingShipping, setIsSavingShipping] = useState(false);
    const [shippingContents, setShippingContents] = useState({});
    const [shippingAttachments, setShippingAttachments] = useState<Array<{ name: string; type: string; data: string }>>([]);
    const [includeAttachmentsInPrint, setIncludeAttachmentsInPrint] = useState(true);

    // Gallery state
    const [galleryImages, setGalleryImages] = useState<any[]>([]);
    const [galleryIndex, setGalleryIndex] = useState(0);
    const [galleryTitle, setGalleryTitle] = useState('معاينة المرفقات');
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);

    const openGallery = async (images: any[], startIndex = 0, title = 'معاينة المرفقات', woId?: string) => {
      if (!images || images.length === 0) return;
      let finalImages = images;
      if (images.some((a: any) => a && a.hasData && !a.data) && woId) {
        try {
          const res = await getWorkOrder(woId);
          if (res.success && res.data) {
            const fullWo = res.data;
            const fullItem = (fullWo.items || []).find((it: any) => it.attachments && it.attachments.length > 0);
            if (fullItem && fullItem.attachments) {
              finalImages = fullItem.attachments;
            }
          }
        } catch (e) {
          console.error(e);
        }
      }
      setGalleryImages(finalImages);
      setGalleryIndex(startIndex);
      setGalleryTitle(title);
      setIsGalleryOpen(true);
    };

    // Print Prompt for Work Orders with attachments
    const [woPrintPrompt, setWoPrintPrompt] = useState<{ wo: any; attachments: any[] } | null>(null);

    const getWoAttachments = (wo: any) => {
      if (!wo) return [];
      const itemAtts = (wo.items || []).flatMap((i: any) => i.attachments || []).filter((a: any) => a?.type?.startsWith('image/') || a?.data);
      const directAtts = (wo.attachments || []).filter((a: any) => a?.type?.startsWith('image/') || a?.data);
      return [...itemAtts, ...directAtts];
    };

    const handlePrintWorkOrder = async (wo: any) => {
      let targetWo = wo;
      let attachments = getWoAttachments(wo);
      if (attachments.some((a: any) => a && a.hasData && !a.data)) {
        try {
          const res = await getWorkOrder(wo.id);
          if (res.success && res.data) {
            targetWo = res.data;
            attachments = getWoAttachments(targetWo);
          }
        } catch (e) {
          console.error(e);
        }
      }
      if (attachments.length > 0) {
        setWoPrintPrompt({ wo: targetWo, attachments });
      } else {
        setPrintData({ type: 'WORK_ORDER', data: targetWo });
      }
    };

    const handleShippingFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      files.forEach(file => {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (ev.target?.result) {
            setShippingAttachments(prev => [...prev, { name: file.name, type: file.type, data: ev.target!.result as string }]);
          }
        };
        reader.readAsDataURL(file);
      });
      e.target.value = '';
    };

    const removeShippingAttachment = (index: number) => {
      setShippingAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const [showLegacyImportModal, setShowLegacyImportModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [legacyItems, setLegacyItems] = useState([{ id: Date.now(), serialNumber: '', desc: '', chassis: '', length: '', width: '', height: '', sellPrice: '', mfgStatus: 'جاهز', isSold: false, customerName: '' }]);

    useEffect(() => {
      const handler = (e: any) => {
        if (e.key === 'Escape') {
          const currentTab = window.localStorage.getItem('shams_activeTab')?.replace(/"/g, '');
          if (currentTab !== 'workOrders') return;
          
          if (statusModalData) setStatusModalData(null);
          else if (isGalleryOpen) setIsGalleryOpen(false);
          else if (woPrintPrompt) setWoPrintPrompt(null);
          else if (showShippingModal) setShowShippingModal(false);
          else if (showLegacyImportModal) setShowLegacyImportModal(false);
          else if (selectedItemsForInvoice.length > 0) setSelectedItemsForInvoice([]);
        }
      };
      document.addEventListener('keydown', handler);
      return () => document.removeEventListener('keydown', handler);
    }, [isGalleryOpen, woPrintPrompt, showShippingModal, showLegacyImportModal, selectedItemsForInvoice, statusModalData]);

    const handleSaveLegacyItems = () => {
      if (!hasPermission('workOrders', 'create')) return alert('ليس لديك صلاحية لإضافة أوامر عمل أو أرصدة افتتاحية.');
      const validItems = legacyItems.filter(i => i.serialNumber && i.desc);
      if (validItems.length === 0) return alert('الرجاء إدخال رقم تصنيع ووصف لمنتج واحد على الأقل.');

      const hasInvalidSold = validItems.some(i => i.isSold && !i.customerName);
      if (hasInvalidSold) return alert('يجب تحديد اسم الزبون للمنتجات المباعة.');

      const newWoItems = validItems.map(i => ({
        serialNumber: i.serialNumber,
        desc: i.desc,
        chassis: i.chassis || '-',
        length: i.length || 0,
        width: i.width || 0,
        height: i.height || 0,
        sellPrice: Number(i.sellPrice) || 0,
        status: i.isSold ? 'مباع' : i.mfgStatus,
        mfgStatus: i.mfgStatus,
        shippingStatus: 'غير منقولة',
        notes: 'رصيد افتتاحي'
      }));

      const newWo = {
        id: generateId('wo'),
        date: new Date().toISOString(),
        items: newWoItems,
        notes: 'أرصدة افتتاحية - جرد'
      };

      setWorkOrders(prev => [newWo, ...prev]);

      const soldItems = validItems.filter(i => i.isSold);
      const customers = [...new Set(soldItems.map(i => i.customerName))];
      
      const newInvoices = customers.map(cust => {
        const custItems = soldItems.filter(i => i.customerName === cust);
        return {
          id: generateId('invF', cust),
          date: new Date().toISOString(),
          type: 'نهائية',
          customerName: cust,
          items: custItems.map(i => ({
            serialNumber: i.serialNumber,
            desc: i.desc,
            chassis: i.chassis,
            sellPrice: Number(i.sellPrice) || 0
          })),
          payments: [],
          notes: 'رصيد افتتاحي مدخل يدوياً'
        };
      });

      if (newInvoices.length > 0) {
        setInvoices(prev => [...newInvoices, ...prev]);
      }

      alert('تم إدخال الأرصدة الافتتاحية بنجاح!');
      setShowLegacyImportModal(false);
      setLegacyItems([{ id: Date.now(), serialNumber: '', desc: '', chassis: '', length: '', width: '', height: '', sellPrice: '', mfgStatus: 'جاهز', isSold: false, customerName: '' }]);
    };

    const generateShippingOrder = async () => {
      if (!hasPermission('invoices', 'create')) return alert('ليس لديك صلاحية لإنشاء أمر نقل.');
      
      const customerName = (shippingCustomerName || '').trim();
      if (!customerName || customerName.length < 2) {
        return alert('الرجاء كتابة اسم العميل أو الجهة المستلمة بشكل صحيح (حرفين على الأقل).');
      }

      if (!driverId) return alert('الرجاء اختيار السائق / الناقل.');
      const driver = drivers.find(d => d.id === driverId);
      if (!driver) return alert('بيانات السائق غير صالحة، يرجى إعادة اختياره من القائمة.');

      const cleanDest = (destination || '').trim();
      if (!cleanDest || cleanDest.length < 2) {
        return alert('الرجاء كتابة الوجهة بشكل صحيح ومفصل (حرفين على الأقل).');
      }

      const itemsToShip = workOrders.flatMap(wo => wo.items).filter(item => selectedItemsForInvoice.includes(item.serialNumber));
      if (itemsToShip.length === 0) {
        return alert('لم يتم العثور على أي منتجات صالحة للنقل.');
      }

      // حماية صارمة لمنع شحن منتجات غير جاهزة
      const unready = itemsToShip.filter(i => (i.mfgStatus || i.status) !== 'جاهز');
      if (unready.length > 0) {
        return alert(`⚠️ حماية النظام ومنع النقص:\nلا يمكن شحن المنتجات التالية لأنها غير جاهزة بعد:\n${unready.map(u => `- ${u.desc} (${u.serialNumber})`).join('\n')}`);
      }

      // حماية صارمة لمنع شحن منتج منقول مسبقاً
      const alreadyShipped = itemsToShip.filter(i => 
        i.shippingStatus === 'منقولة' || 
        shippingOrders.some(so => (so.items || []).some((x: any) => (x.serialNumber || x.sn)?.trim() === i.serialNumber?.trim()))
      );
      if (alreadyShipped.length > 0) {
        return alert(`⚠️ حماية النظام:\nالمنتجات التالية تم نقلها وشحنها مسبقاً:\n${alreadyShipped.map(a => `- ${a.desc} (${a.serialNumber})`).join('\n')}`);
      }

      setIsSavingShipping(true);
      try {
        const newOrderId = await generateIdAsync('shp', customerName);

        // تجهيز بيانات المنتجات لأمر النقل بشكل نظيف ومحدد
        const sanitizedItems = itemsToShip.map(item => ({
          serialNumber: item.serialNumber,
          desc: item.desc || '',
          chassis: item.chassis || '',
          length: item.length || '',
          width: item.width || '',
          height: item.height || '',
          contents: (shippingContents[item.serialNumber] || '').trim(),
          customerName: customerName,
          workOrderId: item._woId || ''
        }));

        const newOrder = {
          id: newOrderId,
          date: new Date().toISOString(),
          driver,
          destination: cleanDest,
          customerName,
          items: sanitizedItems,
          attachments: shippingAttachments,
          issuedBy: {
            id: currentUser?.id,
            name: currentUser?.displayName || 'المدير',
            jobTitle: currentUser?.jobTitle || 'مسؤول الحركة والتسليم',
            signature: currentUser?.signature || '',
            stamp: currentUser?.stamp || ''
          }
        };

        // تحديث أوامر التصنيع وربطها برقم أمر النقل صراحةً
        const updatedWOs = workOrders.map(wo => {
          let hasChange = false;
          const newItems = (wo.items || []).map((item: any) => {
            if (selectedItemsForInvoice.includes(item.serialNumber)) {
              hasChange = true;
              return { 
                ...item, 
                shippingStatus: 'منقولة',
                shippingOrderId: newOrderId,
                shippingOrderDate: newOrder.date
              };
            }
            return item;
          });
          return hasChange ? { ...wo, items: newItems } : wo;
        });

        // 1. حفظ أمر النقل مباشرة في قاعدة البيانات
        const shpRes = await bulkUpsert('shipping_orders', [newOrder]);
        if (!shpRes.success) throw new Error(shpRes.error || 'فشل حفظ أمر النقل على الخادم.');

        // 2. تحديث أوامر التصنيع المتأثرة مباشرة في قاعدة البيانات
        const affectedWos = updatedWOs.filter(wo => (wo.items || []).some((it: any) => selectedItemsForInvoice.includes(it.serialNumber)));
        if (affectedWos.length > 0) {
          const woRes = await bulkUpsert('work_orders', affectedWos);
          if (!woRes.success) throw new Error(woRes.error || 'فشل ربط أمر النقل بأوامر التصنيع في قاعدة البيانات.');
        }

        // تحديث الحالات المحلية بعد التأكد من نجاح الكتابة في قاعدة البيانات
        setShippingOrders(prev => [newOrder, ...prev.filter(s => s.id !== newOrderId)]);
        setWorkOrders(updatedWOs);

        logAudit({
          actionType: 'create',
          entityType: 'أوامر النقل',
          entityId: newOrder.id,
          title: `إنشاء أمر نقل: ${newOrder.id}`,
          details: `السائق: ${driver?.name || '--'} | الوجهة: ${newOrder.destination} | العميل: ${customerName} | عدد البنود: ${sanitizedItems.length}`,
          targetCollection: 'shipping_orders',
          nextState: newOrder
        });

        setPrintData({ 
          type: 'SHIPPING_ORDER', 
          data: newOrder,
          excludeAttachments: !includeAttachmentsInPrint
        });

        setShowShippingModal(false);
        setSelectedItemsForInvoice([]);
        setShippingAttachments([]);
        setShippingContents({});
        setDriverId('');
        setDestination('');
        setShippingCustomerName('');
      } catch (err: any) {
        alert('⚠️ خطأ في إصدار أمر النقل:\n' + (err.message || 'حدث خطأ غير متوقع. يرجى التحقق من الاتصال بالشبكة.'));
      } finally {
        setIsSavingShipping(false);
      }
    };

    // إلغاء أمر النقل لمنتج معين وإعادته مباشرة إلى غير منقولة مع صيانة وتحديث السجلات
    const handleCancelShippingForProduct = async (item: any) => {
      if (!hasPermission('invoices', 'delete') && !hasPermission('workOrders', 'edit')) {
        return alert('ليس لديك صلاحية لإلغاء أو تعديل أوامر النقل.');
      }

      const targetSo = item._so || shippingOrders.find(s => (s.items || []).some((x: any) => (x.serialNumber || x.sn)?.trim() === item.serialNumber?.trim()));
      const soId = targetSo?.id || item.shippingOrderId || 'أمر النقل';

      const confirmed = window.confirm(
        `هل أنت متأكد من إلغاء أمر النقل (${soId}) لهذا المنتج؟\n\nالمنتج: ${item.desc} (S/N: ${item.serialNumber})\n\nسيتم إرجاع حالة المنتج فوراً إلى "غير منقولة" في أوامر التصنيع وتحديث سجلات النقل.`
      );
      if (!confirmed) return;

      try {
        // 1. تحديث أوامر التصنيع
        const updatedWOs = workOrders.map(wo => {
          let hasChange = false;
          const newItems = (wo.items || []).map((wi: any) => {
            if (wi.serialNumber === item.serialNumber) {
              hasChange = true;
              const copy = { ...wi, shippingStatus: 'غير منقولة' };
              delete copy.shippingOrderId;
              delete copy.shippingOrderDate;
              return copy;
            }
            return wi;
          });
          return hasChange ? { ...wo, items: newItems } : wo;
        });

        const targetWo = updatedWOs.find(wo => (wo.items || []).some((i: any) => i.serialNumber === item.serialNumber));
        if (targetWo) {
          const woRes = await bulkUpsert('work_orders', [targetWo]);
          if (!woRes.success) throw new Error(woRes.error || 'فشل تحديث أمر التصنيع');
        }
        setWorkOrders(updatedWOs);

        // 2. تحديث أمر النقل أو حذفه بالكامل إذا كان هذا المنتج الوحيد به
        if (targetSo) {
          const remainingItems = (targetSo.items || []).filter((i: any) => (i.serialNumber || i.sn)?.trim() !== item.serialNumber?.trim());
          if (remainingItems.length === 0) {
            const delRes = await bulkDelete('shipping_orders', [targetSo.id]);
            if (!delRes.success) throw new Error(delRes.error || 'فشل حذف أمر النقل');
            setShippingOrders(prev => prev.filter(s => s.id !== targetSo.id));
            logAudit({
              actionType: 'delete',
              entityType: 'أوامر النقل',
              entityId: targetSo.id,
              title: `إلغاء وحذف أمر النقل: ${targetSo.id}`,
              details: `تم إلغاء شحن المنتج ${item.serialNumber} وحذف أمر النقل لخلوه من المنتجات`,
              targetCollection: 'shipping_orders',
              previousState: targetSo
            });
          } else {
            const updatedSo = { ...targetSo, items: remainingItems };
            const upRes = await bulkUpsert('shipping_orders', [updatedSo]);
            if (!upRes.success) throw new Error(upRes.error || 'فشل تحديث أمر النقل');
            setShippingOrders(prev => prev.map(s => s.id === updatedSo.id ? updatedSo : s));
            logAudit({
              actionType: 'edit',
              entityType: 'أوامر النقل',
              entityId: targetSo.id,
              title: `تعديل أمر النقل باستبعاد منتج: ${targetSo.id}`,
              details: `تم إلغاء شحن المنتج ${item.serialNumber} وإرجاعه إلى الورشة (غير منقولة)`,
              targetCollection: 'shipping_orders',
              previousState: targetSo,
              nextState: updatedSo
            });
          }
        }

        window.dispatchEvent(new CustomEvent('shams-db-change', { detail: 'work_orders' }));
        window.dispatchEvent(new CustomEvent('shams-db-change', { detail: 'shipping_orders' }));
        alert('✅ تم إلغاء الشحن بنجاح وإرجاع المنتج لحالة "غير منقولة".');
      } catch (err: any) {
        alert('حدث خطأ أثناء إلغاء النقل: ' + (err.message || 'خطأ غير متوقع'));
      }
    };

    const uniqueDescriptions = Array.from(new Set(workOrders.flatMap(wo => wo.items.map(i => i.desc)).filter(Boolean)));

    const handleDeleteWorkOrder = (woId: string) => {
      if (!hasPermission('workOrders', 'delete')) return alert('ليس لديك صلاحية للإلغاء');
      const targetWo = workOrders.find(w => w.id === woId);
      if (window.confirm('هل أنت متأكد من إلغاء أمر العمل هذا بالكامل؟')) {
        setWorkOrders(workOrders.filter(w => w.id !== woId));
        logAudit({
          actionType: 'delete',
          entityType: 'أوامر التصنيع',
          entityId: woId,
          title: `إلغاء أمر تصنيع بالكامل: ${woId}`,
          details: targetWo ? `عدد البنود: ${targetWo.items?.length || 0} (${targetWo.items?.map(i => i.desc).join('، ')})` : undefined,
          targetCollection: 'work_orders',
          previousState: targetWo
        });
      }
    };

    const getItemCompletionDurationText = (item: any): string => {
      if (!item || item._mfgStatus !== 'جاهز') return '';
      const startDate = item._woDate || item.date;
      let latestCompletedAt: string | null = null;
      if (Array.isArray(item.sectionStatuses) && item.sectionStatuses.length > 0) {
        const dates = item.sectionStatuses
          .filter((s: any) => s.isCompleted && s.completedAt)
          .map((s: any) => ({ raw: s.completedAt, ts: parseDateSafely(s.completedAt).getTime() }))
          .filter((d: any) => d.ts > 0)
          .sort((a: any, b: any) => b.ts - a.ts);
        if (dates.length > 0) latestCompletedAt = dates[0].raw;
      }
      if (!latestCompletedAt && item.completedAt) {
        latestCompletedAt = item.completedAt;
      }
      const days = latestCompletedAt
        ? calculateDurationDays(startDate, latestCompletedAt)
        : (typeof item.completionDays === 'number' ? item.completionDays : null);
      return days !== null ? formatDurationDaysAr(days) : '';
    };

    const toggleStatus = (woId, serialNumber) => {
      if (!hasPermission('workOrders', 'change_status')) return alert('ليس لديك صلاحية لتغيير حالة التصنيع.');
      const targetWo = workOrders.find(wo => wo.id === woId);
      const targetItem = targetWo?.items.find(i => i.serialNumber === serialNumber);
      if (!targetItem) return;

      const stats = getItemStatus(targetItem);

      if (stats.shippingStatus === 'منقولة') {
        return alert(`⚠️ حماية النظام ومنع التعارض:\nلا يمكن تغيير حالة التصنيع لمنتج تم شحنه ونقله بالفعل (${stats.so?.id || ''}).\nيرجى إلغاء أمر النقل أولاً إذا كنت بحاجة لإعادة المنتج إلى خط التصنيع.`);
      }

      if (stats.saleStatus === 'مباع') {
        const confirmChange = window.confirm(`تنبيه: هذا المنتج مباع بالفعل بموجب الفاتورة (${stats.inv?.id || ''}). هل تريد بالتأكيد تعديل حالة أقسام التصنيع؟`);
        if (!confirmChange) return;
      }

      setStatusModalData({
        item: { ...targetItem, _mfgStatus: stats.mfgStatus, _shippingStatus: stats.shippingStatus, _saleStatus: stats.saleStatus, _woDate: targetWo?.date },
        woId,
        woDate: targetWo?.date
      });
    };

    const handleSaveSectionStatuses = (newStatuses: WorkOrderSectionStatus[], newMfgStatus: string) => {
      if (!statusModalData) return;
      const { woId, item, woDate } = statusModalData;
      const serialNumber = item.serialNumber;

      const targetWo = workOrders.find(wo => wo.id === woId);
      const targetItem = targetWo?.items.find(i => i.serialNumber === serialNumber);
      const currentMfg = targetItem?.mfgStatus || (targetItem?.status === 'جاهز' ? 'جاهز' : 'قيد التصنيع');

      const completedDates = newStatuses
        .filter(s => s.isCompleted && s.completedAt)
        .map(s => ({ raw: s.completedAt!, ts: parseDateSafely(s.completedAt).getTime() }))
        .filter(d => d.ts > 0)
        .sort((a, b) => b.ts - a.ts);
      const latestCompletedAt = newMfgStatus === 'جاهز' && completedDates.length > 0
        ? completedDates[0].raw
        : undefined;
      const completionDays = latestCompletedAt
        ? (calculateDurationDays(woDate || targetWo?.date || targetItem?.date, latestCompletedAt) ?? undefined)
        : undefined;

      setWorkOrders(workOrders.map(wo => wo.id === woId ? {
        ...wo,
        items: wo.items.map(it => {
          if (it.serialNumber === serialNumber) {
            return {
              ...it,
              mfgStatus: newMfgStatus,
              status: newMfgStatus,
              completedAt: latestCompletedAt,
              completionDays,
              sectionStatuses: newStatuses
            };
          }
          return it;
        })
      } : wo));

      const completedCount = newStatuses.filter(s => s.isCompleted).length;
      logAudit({
        actionType: 'status_change',
        entityType: 'أوامر التصنيع',
        entityId: `${woId} (${serialNumber})`,
        title: `تحديث حالة أقسام التصنيع إلى "${newMfgStatus}"`,
        details: `المنتج: ${targetItem?.desc || ''} | المكتمل: ${completedCount} من ${newStatuses.length} أقسام${completionDays !== undefined ? ` | مدة الإنجاز: ${formatDurationDaysAr(completionDays)}` : ''}`,
        targetCollection: 'work_orders',
        previousState: { woId, serialNumber, mfgStatus: currentMfg, sectionStatuses: targetItem?.sectionStatuses },
        nextState: { woId, serialNumber, mfgStatus: newMfgStatus, completedAt: latestCompletedAt, completionDays, sectionStatuses: newStatuses }
      });

      if (newMfgStatus !== 'جاهز') {
        setSelectedItemsForInvoice(prev => prev.filter(sn => sn !== serialNumber));
      }

      setStatusModalData(null);
    };

    const handleSelectForInvoice = (serialNumber) => setSelectedItemsForInvoice(prev => prev.includes(serialNumber) ? prev.filter(sn => sn !== serialNumber) : [...prev, serialNumber]);

    const createFinalInvoice = () => {
      if (!hasPermission('invoices', 'create')) return alert('ليس لديك صلاحية لإصدار فاتورة نهائية.');
      if (selectedItemsForInvoice.length === 0) return alert('الرجاء تحديد منتجات.');
      const selectedItems = workOrders.flatMap(wo => wo.items).filter(item => selectedItemsForInvoice.includes(item.serialNumber));
      if (selectedItems.some(i => getItemStatus(i).saleStatus === 'مباع')) return alert('لا يمكن إصدار فاتورة لمنتجات مباعة مسبقاً.');
      if (!finalCustomer) return alert('الرجاء اختيار العميل.');
      let itemsToInvoice = [];
      workOrders.forEach(wo => {
        wo.items.forEach(item => {
          if (selectedItemsForInvoice.includes(item.serialNumber)) {
            itemsToInvoice.push({ ...item, requestedQty: 1, notes: '' });
          }
        });
      });
      const customer = customers.find(c => c.id === finalCustomer);
      const subtotal = itemsToInvoice.reduce((sum, item) => sum + item.sellPrice, 0);
      const newInvoice = {
        isDraft: true,
        type: 'نهائية',
        customerName: customer?.name || finalCustomer,
        items: itemsToInvoice,
        total: subtotal,
        discount: 0,
        netTotal: subtotal,
        createdBy: currentUser ? {
          id: currentUser.id,
          name: currentUser.displayName,
          jobTitle: currentUser.jobTitle || 'مدير مبيعات',
          signature: currentUser.signature || '',
          stamp: currentUser.stamp || ''
        } : undefined
      };
      setEditingInvoice(newInvoice);
      setSelectedItemsForInvoice([]);
      setFinalCustomer('');
      setActiveTab('invoices');
      setTabStates(prev => ({ ...prev, invoices: 'edit_invoice' }));
    };

    const handleConfirmTechnicianInvoice = (data: {
      technicianName: string;
      specialty: string;
      items: any[];
      notes?: string;
    }) => {
      const subtotal = data.items.reduce((sum, item) => sum + (Number(item.sellPrice) || 0) * (Number(item.requestedQty) || 1), 0);
      const newInvoice = {
        isDraft: true,
        type: 'إنتاجية' as const,
        customerName: data.technicianName,
        items: data.items,
        total: subtotal,
        discount: 0,
        netTotal: subtotal,
        notes: data.notes || `مستحقات إنتاجية (${data.specialty}) للفني ${data.technicianName}`,
        createdBy: currentUser ? {
          id: currentUser.id,
          name: currentUser.displayName,
          jobTitle: currentUser.jobTitle || 'مدير مالي / تشغيل',
          signature: currentUser.signature || '',
          stamp: currentUser.stamp || ''
        } : undefined
      };

      setEditingInvoice(newInvoice);
      setShowTechnicianInvoiceModal(false);
      setSelectedItemsForInvoice([]);
      setActiveTab('invoices');
      setTabStates(prev => ({ ...prev, invoices: 'edit_invoice' }));
    };

    const filteredWOs = workOrders.map(wo => {
      const matchesWoId = wo.id.toLowerCase().includes(searchTerm.toLowerCase());
      const woDateStr = wo.date ? new Date(wo.date).toLocaleDateString('en-GB') : '';
      const matchesWoDate = woDateStr.includes(searchTerm) || (wo.date && wo.date.includes(searchTerm));
      
      return {
        ...wo,
        items: wo.items.map(i => {
          const stats = getItemStatus(i);
          return { 
            ...i, 
            _inv: stats.inv, 
            _so: stats.so, 
            _mfgStatus: stats.mfgStatus, 
            _saleStatus: stats.saleStatus, 
            _shippingStatus: stats.shippingStatus,
            _techInvoices: stats.techInvoices
          };
        }).filter(i => {
          const searchLower = searchTerm.toLowerCase();
          const matchesTechSearch = Array.isArray(i._techInvoices) && i._techInvoices.some((ti: any) => 
            String(ti.specialty || '').toLowerCase().includes(searchLower) ||
            String(ti.technicianName || '').toLowerCase().includes(searchLower) ||
            String(ti.id || '').toLowerCase().includes(searchLower)
          );

          const matchesSearch = 
            (i.desc && i.desc.toLowerCase().includes(searchLower)) || 
            (i.chassis && i.chassis.toLowerCase().includes(searchLower)) || 
            (i.serialNumber && i.serialNumber.toLowerCase().includes(searchLower)) ||
            matchesWoId ||
            matchesWoDate ||
            matchesTechSearch ||
            (i._inv && ((i._inv.id && i._inv.id.toLowerCase().includes(searchLower)) || (i._inv.customerName && i._inv.customerName.toLowerCase().includes(searchLower)))) ||
            (i._so && i._so.id && i._so.id.toLowerCase().includes(searchLower));

          const matchesMfgStatus = filterMfgStatus === 'الكل' || i._mfgStatus === filterMfgStatus;
          const matchesSaleStatus = filterSaleStatus === 'الكل' || i._saleStatus === filterSaleStatus;
          const matchesShipping = filterShipping === 'الكل' || i._shippingStatus === filterShipping;

          const itemTechInvoices = i._techInvoices || [];
          let matchesProductivity = true;
          if (filterProductivity === 'مفوتر' || filterProductivity === 'مفوتر_إنتاجية') {
            matchesProductivity = itemTechInvoices.length > 0;
          } else if (filterProductivity === 'غير_مفوتر' || filterProductivity === 'غير_مفوتر_إنتاجية') {
            matchesProductivity = itemTechInvoices.length === 0;
          } else if (filterProductivity === 'صرفت_في_مجال') {
            if (filterProductivitySpecialty) {
              matchesProductivity = itemTechInvoices.some((ti: any) => ti.specialty === filterProductivitySpecialty);
            }
          } else if (filterProductivity === 'لم_تصرف_في_مجال') {
            if (filterProductivitySpecialty) {
              matchesProductivity = !itemTechInvoices.some((ti: any) => ti.specialty === filterProductivitySpecialty);
            }
          } else if (filterProductivity.startsWith('تمت_')) {
            const spec = filterProductivity.replace('تمت_', '');
            matchesProductivity = itemTechInvoices.some((ti: any) => ti.specialty === spec);
          } else if (filterProductivity.startsWith('لم_')) {
            const spec = filterProductivity.replace('لم_', '');
            matchesProductivity = !itemTechInvoices.some((ti: any) => ti.specialty === spec);
          }

          const matchesDesc = filterDesc === '' || (i.desc && i.desc.includes(filterDesc));
          const matchesLength = filterLength === '' || Number(i.length) === Number(filterLength);
          const matchesWidth = filterWidth === '' || Number(i.width) === Number(filterWidth);
          const matchesHeight = filterHeight === '' || Number(i.height) === Number(filterHeight);
          return matchesSearch && matchesMfgStatus && matchesSaleStatus && matchesShipping && matchesProductivity && matchesDesc && matchesLength && matchesWidth && matchesHeight;
        })
      };
    }).filter(wo => wo.items.length > 0);

    const [sortConfig, setSortConfig] = useLocalStorage('wo_sortConfig', { key: 'sn', direction: 'desc' });

    const handleSort = (key) => {
      let direction = 'desc';
      if (sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';
      setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
      if (sortConfig.key !== key) return <ChevronsUpDown className="w-3 h-3 inline text-slate-300 mx-1" />;
      return sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 inline text-blue-500 mx-1" /> : <ChevronDown className="w-3 h-3 inline text-blue-500 mx-1" />;
    };

    const sortedFlattenedItems = useMemo(() => {
      let items = [];
      filteredWOs.forEach(wo => {
        wo.items.forEach(item => {
          items.push({ ...item, _woId: wo.id, _woDate: wo.date, _wo: wo });
        });
      });

      items.sort((a, b) => {
        let valA, valB;
        switch (sortConfig.key) {
          case 'woId': valA = a._woId; valB = b._woId; break;
          case 'desc': valA = a.desc; valB = b.desc; break;
          case 'sn': valA = a.serialNumber; valB = b.serialNumber; break;
          case 'cost':
          case 'price': valA = getItemCost(a); valB = getItemCost(b); break;
          case 'mfgStatus': valA = a._mfgStatus; valB = b._mfgStatus; break;
          case 'saleStatus': valA = a._saleStatus; valB = b._saleStatus; break;
          case 'shippingStatus': valA = a._shippingStatus; valB = b._shippingStatus; break;
          default: valA = a.serialNumber; valB = b.serialNumber;
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });

      return items;
    }, [filteredWOs, sortConfig]);

    useEffect(() => {
      setCurrentPage(1);
    }, [searchTerm, filterMfgStatus, filterSaleStatus, filterShipping, filterProductivity, filterProductivitySpecialty, filterDesc, filterLength, filterWidth, filterHeight, sortConfig]);

    const totalPages = Math.ceil(sortedFlattenedItems.length / rowsPerPage);
    const paginatedItems = sortedFlattenedItems.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

    const selectedItemsFull = selectedItemsForInvoice.map(sn => {
      let rawItem = null;
      workOrders.some(wo => {
        const found = wo.items.find(i => i.serialNumber === sn);
        if (found) { rawItem = found; return true; }
        return false;
      });
      if (!rawItem) return null;
      return { ...rawItem, ...getItemStatus(rawItem) };
    }).filter(Boolean);

    const allUnsold = selectedItemsFull.length > 0 && selectedItemsFull.every(i => i.saleStatus === 'غير مباعة');
    const allSold = selectedItemsFull.length > 0 && selectedItemsFull.every(i => i.saleStatus === 'مباع');
    const mixedSaleStatus = selectedItemsFull.length > 0 && !allUnsold && !allSold;

    const exportToExcel = (filters: ExportFilters) => {
      let data = sortedFlattenedItems;
      if (filters.dateFrom) data = data.filter(item => new Date(item._woDate) >= new Date(filters.dateFrom));
      if (filters.dateTo) data = data.filter(item => new Date(item._woDate) <= new Date(filters.dateTo + 'T23:59:59'));
      if (filters.workOrderId) data = data.filter(item => item._woId && item._woId.toLowerCase().includes(filters.workOrderId!.toLowerCase()));
      
      const headers = [
        'رقم أمر العمل', 'تاريخ أمر العمل', 'رقم التصنيع (SN)', 'المنتج / المواصفات',
        'الشاصية', 'الأبعاد (ط x ع x ا)', 'ملاحظات', 'سعر التكلفة', 'حالة التصنيع',
        'حالة البيع', 'رقم الفاتورة', 'اسم الزبون', 'حالة النقل', 'رقم أمر النقل'
      ];
      
      const rows = data.map(item => [
        item._woId || '',
        item._woDate ? new Date(item._woDate).toLocaleDateString('en-GB') : '',
        item.serialNumber || '',
        item.desc || '',
        item.chassis || '',
        `${item.length || 0}x${item.width || 0}x${item.height || 0}`,
        item.notes || '',
        getItemCost(item),
        item._mfgStatus || '',
        item._saleStatus || '',
        item._inv ? item._inv.id : '',
        item._inv ? item._inv.customerName : '',
        item._shippingStatus || '',
        item._so ? item._so.id : ''
      ]);

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      
      // Set right-to-left
      ws['!dir'] = 'rtl';
      
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "أوامر التصنيع");
      XLSX.writeFile(wb, `أوامر_العمل_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.xlsx`);
    };

    return (
      <div className="relative pb-40">
        <ExportFilterModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          onExport={exportToExcel}
          title="تصدير أوامر التصنيع"
          showWorkOrderId={true}
        />
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-slate-800">أوامر التصنيع النشطة</h1>
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-200 p-1 rounded-lg">
              <button onClick={() => setViewMode('table')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`} title="عرض كجدول">
                <List className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`} title="عرض كبطاقات">
                <Grid className="w-4 h-4" />
              </button>
            </div>
            <button onClick={() => setShowLegacyImportModal(true)} className="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold hover:bg-slate-900 text-sm flex items-center gap-2"><Database className="w-4 h-4" /> إدخال أرصدة سابقة (جرد)</button>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mb-6 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute right-3 top-2.5 text-slate-400 w-5 h-5" />
            <input type="text" placeholder="بحث برقم التسلسل، الشاصية، الفاتورة، العميل، أمر العمل، النقل، أو التاريخ..." className="w-full pl-4 pr-10 py-2 bg-slate-50 border border-slate-200 rounded outline-none focus:border-blue-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <select className="border border-slate-200 rounded p-2 bg-slate-50 outline-none w-40 shrink-0" value={filterMfgStatus} onChange={e => setFilterMfgStatus(e.target.value)}>
            <option value="الكل">حالة التصنيع (الكل)</option>
            <option value="قيد التصنيع">قيد التصنيع</option>
            <option value="جاهز">جاهز</option>
          </select>
          <select className="border border-slate-200 rounded p-2 bg-slate-50 outline-none w-40 shrink-0" value={filterSaleStatus} onChange={e => setFilterSaleStatus(e.target.value)}>
            <option value="الكل">حالة البيع (الكل)</option>
            <option value="مباع">مباع / مفوتر</option>
            <option value="غير مباعة">غير مباعة</option>
          </select>
          <select className="border border-slate-200 rounded p-2 bg-slate-50 outline-none w-40 shrink-0" value={filterShipping} onChange={e => setFilterShipping(e.target.value)}>
            <option value="الكل">حالة النقل (الكل)</option>
            <option value="منقولة">منقولة</option>
            <option value="غير منقولة">غير منقولة</option>
          </select>
          {/* الفلترة متعددة الطبقات لفواتير الإنتاجية */}
          <select 
            className="border border-amber-200 rounded p-2 bg-amber-50/70 text-amber-900 font-bold outline-none w-48 shrink-0 text-xs" 
            value={filterProductivity} 
            onChange={e => {
              const val = e.target.value;
              setFilterProductivity(val);
              if ((val === 'صرفت_في_مجال' || val === 'لم_تصرف_في_مجال') && !filterProductivitySpecialty) {
                setFilterProductivitySpecialty(availableProductivitySpecialties[0] || 'أعمال كهرباء');
              }
            }}
          >
            <option value="الكل">فواتير الإنتاجية (الكل)</option>
            <option value="غير_مفوتر">لم تصرف له أي فاتورة</option>
            <option value="مفوتر">صُرفت له أي فاتورة</option>
            <option value="لم_تصرف_في_مجال">لم تصرف له فاتورة في مجال...</option>
            <option value="صرفت_في_مجال">صُرفت له فاتورة في مجال...</option>
          </select>

          {/* الطبقة الثانية لاختيار المجال/التخصص المحدد */}
          {(filterProductivity === 'صرفت_في_مجال' || filterProductivity === 'لم_تصرف_في_مجال') && (
            <select
              className="border border-amber-300 rounded p-2 bg-amber-100/60 text-amber-950 font-bold outline-none w-44 shrink-0 text-xs animate-in fade-in"
              value={filterProductivitySpecialty}
              onChange={e => setFilterProductivitySpecialty(e.target.value)}
              title="تحديد المجال المستهدف"
            >
              {availableProductivitySpecialties.map(spec => (
                <option key={spec} value={spec}>{spec}</option>
              ))}
            </select>
          )}
          {(searchTerm || filterMfgStatus !== 'الكل' || filterSaleStatus !== 'الكل' || filterShipping !== 'الكل' || filterProductivity !== 'الكل' || filterDesc || filterLength || filterWidth || filterHeight) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterMfgStatus('الكل');
                setFilterSaleStatus('الكل');
                setFilterShipping('الكل');
                setFilterProductivity('الكل');
                setFilterProductivitySpecialty(availableProductivitySpecialties[0] || 'أعمال كهرباء');
                setFilterDesc('');
                setFilterLength('');
                setFilterWidth('');
                setFilterHeight('');
                setSortConfig({ key: 'woId', direction: 'desc' });
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-2 font-bold transition-colors shrink-0"
              title="تفريغ التصفية والترتيب"
            >
              <FilterX className="w-4 h-4" /> تصفية البحث
            </button>
          )}
        </div>

        <div className="mb-6 flex flex-wrap gap-4 items-center">
          <span className="text-sm font-bold text-slate-700">تصفية سريعة:</span>

          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1.5 px-3 shadow-sm focus-within:border-blue-400 transition-colors">
            <label className="text-sm font-medium text-slate-500">المنتج:</label>
            <input type="text" list="desc-filters-wo" placeholder="اختر للتصفية..." className="w-32 outline-none bg-transparent font-bold text-slate-800 text-sm" value={filterDesc} onChange={e => setFilterDesc(e.target.value)} />
            <datalist id="desc-filters-wo">
              {uniqueDescriptions.map((desc, i) => <option key={i} value={desc} />)}
            </datalist>
            {filterDesc && <button onClick={() => setFilterDesc('')} className="text-slate-300 hover:text-red-500 p-0.5"><X className="w-4 h-4" /></button>}
          </div>

          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1.5 px-3 shadow-sm focus-within:border-blue-400 transition-colors">
            <label className="text-sm font-medium text-slate-500">الطول (م):</label>
            <input type="number" className="w-16 outline-none bg-transparent text-center font-bold text-slate-800" value={filterLength} onChange={e => setFilterLength(e.target.value)} />
            {filterLength && <button onClick={() => setFilterLength('')} className="text-slate-300 hover:text-red-500 p-0.5"><X className="w-4 h-4" /></button>}
          </div>
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1.5 px-3 shadow-sm focus-within:border-blue-400 transition-colors">
            <label className="text-sm font-medium text-slate-500">العرض (م):</label>
            <input type="number" className="w-16 outline-none bg-transparent text-center font-bold text-slate-800" value={filterWidth} onChange={e => setFilterWidth(e.target.value)} />
            {filterWidth && <button onClick={() => setFilterWidth('')} className="text-slate-300 hover:text-red-500 p-0.5"><X className="w-4 h-4" /></button>}
          </div>
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1.5 px-3 shadow-sm focus-within:border-blue-400 transition-colors">
            <label className="text-sm font-medium text-slate-500">الارتفاع (م):</label>
            <input type="number" className="w-16 outline-none bg-transparent text-center font-bold text-slate-800" value={filterHeight} onChange={e => setFilterHeight(e.target.value)} />
            {filterHeight && <button onClick={() => setFilterHeight('')} className="text-slate-300 hover:text-red-500 p-0.5"><X className="w-4 h-4" /></button>}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          {viewMode === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="text-slate-500 border-b-2 border-slate-200 bg-slate-50">
                <tr>
                  <th className="p-4 w-12 text-center">تحديد</th>
                  <th className="p-4 cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('woId')}>رقم أمر العمل {getSortIcon('woId')}</th>
                  <th className="p-4 cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('desc')}>المنتج / المواصفات {getSortIcon('desc')}</th>
                  <th className="p-4 text-center cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('sn')}>رقم التصنيع (SN) {getSortIcon('sn')}</th>
                  <th className="p-4 text-center cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('cost')}>سعر التكلفة {getSortIcon('cost')}</th>
                  <th className="p-4 text-center cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('mfgStatus')}>حالة التصنيع {getSortIcon('mfgStatus')}</th>
                  <th className="p-4 text-center cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('saleStatus')}>حالة البيع {getSortIcon('saleStatus')}</th>
                  <th className="p-4 text-center cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('shippingStatus')}>حالة النقل {getSortIcon('shippingStatus')}</th>
                  <th className="p-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-10 text-center text-slate-400">لا توجد أوامر عمل تطابق البحث.</td>
                  </tr>
                ) : (
                  paginatedItems.map((item, idx) => {
                    const isSameWoAsPrev = idx > 0 && paginatedItems[idx - 1]._woId === item._woId && sortConfig.key === 'woId';
                    return (
                      <tr key={item.serialNumber} className={`border-b border-slate-100 hover:bg-slate-50 ${selectedItemsForInvoice.includes(item.serialNumber) ? 'bg-indigo-50/50' : ''}`}>
                        <td className="p-4 text-center">
                          <input type="checkbox" className="w-4 h-4 cursor-pointer" checked={selectedItemsForInvoice.includes(item.serialNumber)} onChange={() => handleSelectForInvoice(item.serialNumber)} />
                        </td>
                        <td className="p-4">
                          {!isSameWoAsPrev ? (
                            <div className="flex flex-col gap-2">
                              <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded inline-block whitespace-nowrap">{item._woId}</span>
                              {item._woDate && <span className="text-xs text-slate-500 font-mono">{new Date(item._woDate).toLocaleDateString('en-GB')}</span>}
                              <div className="flex gap-1">
                                {hasPermission('workOrders', 'print') && <button onClick={() => handlePrintWorkOrder(item._wo)} className="bg-slate-100 text-slate-600 p-1 rounded hover:bg-slate-200" title="طباعة للتصنيع"><Printer className="w-3.5 h-3.5" /></button>}
                                {hasPermission('workOrders', 'delete') && <button onClick={() => handleDeleteWorkOrder(item._woId)} className="bg-red-50 text-red-500 p-1 rounded hover:bg-red-100" title="إلغاء الأمر"><Trash2 className="w-3.5 h-3.5" /></button>}
                              </div>
                            </div>
                          ) : (
                            <span className="font-mono text-xs text-slate-300 px-2 py-1 inline-block">↑</span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-semibold text-slate-800">{item.desc}</div>
                              <div className="text-xs text-slate-500 mt-1">شاصية: {item.chassis} | {item.length}x{item.width}x{item.height}</div>
                              {item.notes && <div className="text-xs text-slate-500 mt-1">ملاحظة: {item.notes}</div>}
                              {item._techInvoices && item._techInvoices.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {item._techInvoices.map((ti: any, i: number) => (
                                    <span key={i} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200" title={`فاتورة إنتاجية ${ti.id} - الفني: ${ti.technicianName}`}>
                                      {ti.specialty}: {ti.technicianName}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            {item.attachments && item.attachments.length > 0 && (
                              <button
                                type="button"
                                onClick={() => openGallery(item.attachments, 0, `مرفقات أمر التصنيع: ${item.desc} (${item.serialNumber})`, item._woId)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/80 rounded-full text-xs font-bold transition-colors cursor-pointer shadow-xs shrink-0"
                                title="عرض وتصفح الصور المرفقة"
                              >
                                <ImageIcon className="w-3.5 h-3.5 text-amber-600" />
                                <span>{item.attachments.length} {item.attachments.length === 1 ? 'صورة' : 'صور'}</span>
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-center font-mono font-bold text-blue-600 bg-blue-50/30">{item.serialNumber}</td>
                        <td className="p-4 text-center font-semibold text-slate-700 dir-ltr">{formatCurrency(getItemCost(item))}</td>
                        <td className="p-4 text-center">
                          <button
                            type="button"
                            onClick={() => toggleStatus(item._woId, item.serialNumber)}
                            className="inline-flex flex-col items-center group cursor-pointer"
                            title="انقر لتعديل ومتابعة حالة أقسام التصنيع"
                          >
                            <span className={`px-3 py-1 rounded-full text-xs font-bold transition-transform group-hover:scale-105 ${item._mfgStatus === 'جاهز' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {item._mfgStatus}
                            </span>
                            {Array.isArray(item.sectionStatuses) && item.sectionStatuses.length > 0 && (
                              <span className="text-[10px] text-slate-500 font-mono mt-0.5 group-hover:text-blue-600 font-bold">
                                ({item.sectionStatuses.filter((s: any) => s.isCompleted).length}/{item.sectionStatuses.length} أقسام)
                              </span>
                            )}
                            {(() => {
                              const durationText = getItemCompletionDurationText(item);
                              if (item._mfgStatus === 'جاهز' && durationText) {
                                return (
                                  <span className="text-[10px] text-emerald-700 font-bold mt-0.5 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/80 whitespace-nowrap">
                                    مدة الإنجاز: {durationText}
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </button>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex flex-col items-center gap-1.5">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${item._saleStatus === 'مباع' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>{item._saleStatus}</span>
                            {item._inv && (
                              <div className="flex flex-col gap-0.5 items-center bg-slate-50 p-1 rounded border border-slate-100 w-full mt-1">
                                <span className="text-[10px] text-slate-500 font-mono" title="رقم الفاتورة">{item._inv.id}</span>
                                <span className="text-[10px] text-slate-700 font-bold truncate w-24 text-center" title={item._inv.customerName}>{item._inv.customerName}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex flex-col items-center gap-1.5">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${item._shippingStatus === 'منقولة' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>{item._shippingStatus}</span>
                            {item._so && (
                              <div className="mt-1 bg-slate-50 p-1.5 rounded border border-slate-200 w-full flex flex-col items-center gap-1 shadow-xs">
                                <span className="text-[10px] text-slate-700 font-mono font-bold" title="رقم أمر النقل">{item._so.id}</span>
                                <div className="flex gap-1">
                                  <button onClick={() => setPrintData({ type: 'SHIPPING_ORDER', data: item._so })} className="text-[10px] text-blue-600 hover:text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded font-bold transition-colors" title="طباعة أمر النقل">طباعة</button>
                                  {hasPermission('workOrders', 'edit') && (
                                    <button onClick={() => handleCancelShippingForProduct(item)} className="text-[10px] text-red-600 hover:text-red-800 bg-red-50 px-1.5 py-0.5 rounded font-bold transition-colors" title="إلغاء النقل وإرجاع المنتج للورشة">إلغاء النقل</button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex gap-2 justify-center">
                            {hasPermission('workOrders', 'change_status') && (
                              <button onClick={() => toggleStatus(item._woId, item.serialNumber)} className="text-sm px-3 py-1.5 rounded bg-white border border-slate-300 hover:bg-slate-100 font-medium flex items-center gap-1.5 shadow-2xs">
                                <CheckCheck className="w-3.5 h-3.5 text-blue-600" />
                                <span>تغيير الحالة</span>
                              </button>
                            )}
                            <button onClick={() => { setEditingEstimate(item); setEditingContext({ type: 'workOrder', woId: item._woId }); setViewState('calculator'); window.scrollTo(0,0); }} className="text-sm px-3 py-1.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium">المواد والتفاصيل</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 bg-slate-50/50">
            {paginatedItems.length === 0 ? (
              <div className="col-span-full p-10 text-center text-slate-400">لا توجد أوامر عمل تطابق البحث.</div>
            ) : (
              paginatedItems.map((item, idx) => (
                <div key={item.serialNumber} className={`relative flex flex-col bg-white p-4 rounded-xl shadow-sm border transition-shadow hover:shadow-md ${selectedItemsForInvoice.includes(item.serialNumber) ? 'border-indigo-400 ring-2 ring-indigo-400 bg-indigo-50/30' : 'border-slate-200'}`}>
                  <div className="mb-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded shrink-0">{item._woId}</span>
                        {item._woDate && <span className="text-xs text-slate-500 font-mono shrink-0">{new Date(item._woDate).toLocaleDateString('en-GB')}</span>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {item.attachments && item.attachments.length > 0 && (
                          <button
                            type="button"
                            onClick={() => openGallery(item.attachments, 0, `مرفقات أمر التصنيع: ${item.desc} (${item.serialNumber})`, item._woId)}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/80 rounded-full text-xs font-bold transition-colors cursor-pointer shadow-xs"
                            title="عرض وتصفح الصور المرفقة"
                          >
                            <ImageIcon className="w-3.5 h-3.5 text-amber-600" />
                            <span>{item.attachments.length} {item.attachments.length === 1 ? 'صورة' : 'صور'}</span>
                          </button>
                        )}
                        <input 
                          type="checkbox" 
                          className="w-5 h-5 cursor-pointer accent-indigo-600 rounded" 
                          checked={selectedItemsForInvoice.includes(item.serialNumber)} 
                          onChange={() => handleSelectForInvoice(item.serialNumber)} 
                          title="تحديد لإضافته للفاتورة"
                        />
                      </div>
                    </div>
                    <h3 className="font-bold text-lg text-slate-800 leading-tight">{item.desc}</h3>
                  </div>
                  
                  <div className="flex flex-wrap items-start gap-2 mb-4">
                    <div className="flex flex-col items-start">
                      <button
                        type="button"
                        onClick={() => toggleStatus(item._woId, item.serialNumber)}
                        className={`text-xs font-bold px-2.5 py-1 rounded-full border transition-transform hover:scale-105 cursor-pointer flex items-center gap-1 ${item._mfgStatus === 'جاهز' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}
                        title="انقر لتعديل وتفصيل حالة الأقسام"
                      >
                        <span>{item._mfgStatus}</span>
                        {Array.isArray(item.sectionStatuses) && item.sectionStatuses.length > 0 && (
                          <span className="text-[10px] font-mono text-slate-500 font-bold">
                            ({item.sectionStatuses.filter((s: any) => s.isCompleted).length}/{item.sectionStatuses.length})
                          </span>
                        )}
                      </button>
                      {(() => {
                        const durationText = getItemCompletionDurationText(item);
                        if (item._mfgStatus === 'جاهز' && durationText) {
                          return (
                            <span className="text-[10px] text-emerald-700 font-bold mt-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/80 whitespace-nowrap">
                              مدة الإنجاز: {durationText}
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full border ${item._saleStatus === 'مباع' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>{item._saleStatus}</span>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full border ${item._shippingStatus === 'منقولة' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>{item._shippingStatus}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg mb-4 flex-1">
                    <div><span className="text-slate-400 block text-[10px] uppercase font-bold mb-0.5">رقم التصنيع (SN)</span><span className="font-mono font-bold text-slate-700 text-sm">{item.serialNumber}</span></div>
                    <div><span className="text-slate-400 block text-[10px] uppercase font-bold mb-0.5">سعر التكلفة</span><span className="font-black text-slate-700 text-sm" dir="ltr">{formatCurrency(getItemCost(item))}</span></div>
                    <div className="col-span-2"><span className="text-slate-400 block text-[10px] uppercase font-bold mb-0.5">الشاصية / الأبعاد</span><span className="font-medium text-slate-700 text-sm">{item.chassis} | {item.length}x{item.width}x{item.height}</span></div>
                    {item.notes && <div className="col-span-2"><span className="text-slate-400 block text-[10px] uppercase font-bold mb-0.5">ملاحظات</span><span className="text-slate-700 text-sm">{item.notes}</span></div>}
                    
                    {item._inv && (
                      <div className="col-span-2 pt-2 mt-1 border-t border-slate-200">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold mb-0.5">معلومات الفاتورة</span>
                        <div className="text-xs font-bold text-blue-700">INV: {item._inv.id} - {item._inv.customerName}</div>
                      </div>
                    )}
                    {item._so && (
                      <div className="col-span-2 pt-2 mt-1 border-t border-slate-200">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-slate-400 block text-[10px] uppercase font-bold">معلومات النقل</span>
                          <div className="flex gap-1.5">
                            <button onClick={() => setPrintData({ type: 'SHIPPING_ORDER', data: item._so })} className="text-[10px] text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-0.5 rounded font-bold transition-colors">طباعة</button>
                            {hasPermission('workOrders', 'edit') && (
                              <button onClick={() => handleCancelShippingForProduct(item)} className="text-[10px] text-red-600 hover:text-red-800 bg-red-50 px-2 py-0.5 rounded font-bold transition-colors">إلغاء النقل</button>
                            )}
                          </div>
                        </div>
                        <div className="text-xs font-bold text-purple-700 font-mono">{item._so.id} - {item._so.driver?.name || item._so.driverName || 'سائق'} ({item._so.destination})</div>
                      </div>
                    )}
                    {item._techInvoices && item._techInvoices.length > 0 && (
                      <div className="col-span-2 pt-2 mt-1 border-t border-slate-200">
                        <span className="text-amber-800 block text-[10px] uppercase font-bold mb-1 flex items-center gap-1">
                          <Wrench className="w-3 h-3 text-amber-600" /> فواتير إنتاجية سابقة ({item._techInvoices.length}):
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {item._techInvoices.map((ti: any, i: number) => (
                            <span key={i} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200" title={`فاتورة ${ti.id} - الفني: ${ti.technicianName}`}>
                              {ti.specialty}: {ti.technicianName}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                    <div className="flex gap-1">
                      {hasPermission('workOrders', 'print') && <button onClick={() => handlePrintWorkOrder(item._wo)} className="bg-slate-100 text-slate-600 p-2 rounded hover:bg-slate-200 transition-colors" title="طباعة للتصنيع"><Printer className="w-4 h-4" /></button>}
                      {hasPermission('workOrders', 'delete') && <button onClick={() => handleDeleteWorkOrder(item._woId)} className="bg-red-50 text-red-500 p-2 rounded hover:bg-red-100 transition-colors" title="إلغاء الأمر"><Trash2 className="w-4 h-4" /></button>}
                    </div>
                    <div className="flex gap-2">
                      {hasPermission('workOrders', 'change_status') && (
                        <button onClick={() => toggleStatus(item._woId, item.serialNumber)} className="text-xs px-3 py-1.5 rounded bg-white border border-slate-300 hover:bg-slate-100 transition-colors font-bold flex items-center gap-1 shadow-2xs">
                          <CheckCheck className="w-3.5 h-3.5 text-blue-600" />
                          <span>الحالة</span>
                        </button>
                      )}
                      <button onClick={() => { setEditingEstimate(item); setEditingContext({ type: 'workOrder', woId: item._woId }); setViewState('calculator'); window.scrollTo(0,0); }} className="text-xs px-3 py-1.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold transition-colors shadow-sm">المواد</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
          {sortedFlattenedItems.length > 0 && (
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-4">
                <button onClick={() => setShowExportModal(true)} className="flex items-center gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-4 py-2 rounded-lg font-bold transition-colors">
                  <Download className="w-4 h-4" /> تصدير Excel
                </button>
                <span className="text-sm text-slate-500 font-medium">
                  عرض {(currentPage - 1) * rowsPerPage + 1} إلى {Math.min(currentPage * rowsPerPage, sortedFlattenedItems.length)} من {sortedFlattenedItems.length} منتج
                </span>
              </div>
              {totalPages > 1 && (
                <div className="flex gap-2">
                  <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                  >
                    السابق
                  </button>
                  <div className="flex gap-1 items-center px-4 font-mono text-sm text-slate-600 font-bold bg-white border border-slate-200 rounded">
                    {currentPage} / {totalPages}
                  </div>
                  <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                  >
                    التالي
                  </button>
                </div>
              )}
            </div>
          )}
        </div>


        {selectedItemsForInvoice.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 md:right-64 bg-white border-t border-slate-300 shadow-[0_-10px_30px_rgba(0,0,0,0.1)] p-4 z-40">
            <div className="w-full 2xl:max-w-[1800px] mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="font-bold text-indigo-900 flex items-center gap-2"><span className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm">{selectedItemsForInvoice.length}</span> منتجات محددة للفوترة أو النقل</div>
              <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto items-center flex-wrap justify-end">
                {mixedSaleStatus && (
                  <div className="text-amber-800 text-xs font-bold px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                    المنتجات المختارة خليط (متاح لإصدار فاتورة إنتاجية فنيين)
                  </div>
                )}
                {hasPermission('invoices', 'create') ? (
                  <>
                    <button 
                      onClick={() => setShowTechnicianInvoiceModal(true)} 
                      className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2.5 rounded-lg font-bold shadow-md flex items-center justify-center gap-2 transition-colors shrink-0"
                      title="إصدار فاتورة إنتاجية لفنيي الكهرباء، السباكة، وغيرها بأرقام تصنيع المنتجات"
                    >
                      <Wrench className="w-5 h-5" />
                      <span>إصدار فاتورة إنتاجية ({selectedItemsForInvoice.length})</span>
                    </button>

                    {allUnsold && (
                      <>
                        <CustomerSelect value={finalCustomer} onChange={setFinalCustomer} direction="up" />
                        <button onClick={createFinalInvoice} className="bg-indigo-600 text-white px-8 py-2.5 rounded-lg font-bold hover:bg-indigo-700 shadow-md flex items-center justify-center gap-2 shrink-0"><FileCheck2 className="w-5 h-5" /> إصدار فاتورة نهائية</button>
                      </>
                    )}
                    {allSold && (
                      <button onClick={() => {
                        if (selectedItemsFull.some(i => i.mfgStatus !== 'جاهز')) {
                          return alert('لا يمكن نقل المنتجات إلا بعد أن تصبح جاهزة.');
                        }
                        const uniqueCustomers = new Set(selectedItemsFull.map(i => i.inv?.customerName || i.customerName).filter(Boolean));
                        if (uniqueCustomers.size > 1) {
                          return alert('لا يمكن إنشاء أمر نقل واحد لمنتجات تابعة لزبائن مختلفين.');
                        }
                        const detectedCustomer = Array.from(uniqueCustomers)[0] || selectedItemsFull[0]?.customerName || selectedItemsFull[0]?.inv?.customerName || '';
                        setShippingCustomerName(detectedCustomer);
                        setShowShippingModal(true);
                      }} className="bg-emerald-600 text-white px-8 py-2.5 rounded-lg font-bold hover:bg-emerald-700 shadow-md flex items-center justify-center gap-2 shrink-0"><Truck className="w-5 h-5" /> إنشاء أمر نقل</button>
                    )}
                  </>
                ) : (
                  <div className="text-xs text-slate-500 font-bold p-2 bg-slate-100 rounded-lg">
                    صلاحياتك الحالية للعرض فقط ولا تتيح إصدار فواتير نهائية أو أوامر نقل.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <TechnicianInvoiceModal
          isOpen={showTechnicianInvoiceModal}
          onClose={() => setShowTechnicianInvoiceModal(false)}
          selectedItems={workOrders.flatMap(wo => wo.items).filter(i => selectedItemsForInvoice.includes(i.serialNumber))}
          allInvoices={invoices}
          onConfirm={handleConfirmTechnicianInvoice}
        />

        {showShippingModal && (
          <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
              <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Truck className="w-6 h-6 text-emerald-600" /> إنشاء أمر نقل وإيصال استلام</h2>
                <button onClick={() => setShowShippingModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-6 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      الزبون / الجهة المستلمة <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      list="wo-shipping-customers-list"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:border-emerald-500 font-medium"
                      value={shippingCustomerName}
                      onChange={e => setShippingCustomerName(e.target.value)}
                      placeholder="اسم العميل أو الجهة المستلمة"
                      required
                    />
                    <datalist id="wo-shipping-customers-list">
                      {(customers || []).map((c: any) => (
                        <option key={c.id || c.name} value={c.name} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      السائق / الناقل <span className="text-red-500">*</span>
                    </label>
                    <DriverSelect value={driverId} onChange={setDriverId} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      الوجهة <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <MapPin className="absolute right-3 top-2.5 text-slate-400 w-5 h-5" />
                      <input 
                        type="text" 
                        className="w-full pl-4 pr-10 py-2 border border-slate-300 rounded-lg outline-none focus:border-emerald-500 font-medium" 
                        value={destination} 
                        onChange={e => setDestination(e.target.value)} 
                        placeholder="مثال: طرابلس - طريق الشط" 
                        required
                      />
                    </div>
                  </div>
                </div>
                <h3 className="font-bold text-lg mb-4 text-slate-800">المنتجات المحملة ({selectedItemsForInvoice.length})</h3>
                <div className="space-y-4">
                  {workOrders.flatMap(wo => wo.items).filter(item => selectedItemsForInvoice.includes(item.serialNumber)).map(item => (
                    <div key={item.serialNumber} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                      <div className="flex flex-col gap-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-bold text-lg text-slate-800">{item.desc}</div>
                            <div className="text-sm text-slate-600">S/N: <span className="font-mono font-bold">{item.serialNumber}</span> | الشاصية: {item.chassis}</div>
                          </div>
                        </div>
                        <div className="w-full">
                          <label className="block text-sm font-bold text-slate-700 mb-2">المرفقات والمحتويات الداخلية (أثاث، معدات...)</label>
                          <textarea className="w-full p-3 border border-slate-300 rounded-lg outline-none text-sm focus:border-emerald-500" rows={2} placeholder="مثال: 3 كراسي، 1 طاولة، 1 مكيف" value={shippingContents[item.serialNumber] || ''} onChange={e => setShippingContents(prev => ({ ...prev, [item.serialNumber]: e.target.value }))} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Shipping Attachments Section */}
                <div className="mt-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex justify-between items-center mb-3 border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-5 h-5 text-emerald-600" />
                      <h4 className="font-bold text-slate-800 text-sm">مرفقات وصور أمر النقل ({shippingAttachments.length})</h4>
                    </div>
                    <label className="cursor-pointer bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm">
                      <Plus className="w-4 h-4" /> إضافة صور
                      <input type="file" className="hidden" accept="image/*" multiple onChange={handleShippingFileUpload} />
                    </label>
                  </div>

                  {shippingAttachments.length === 0 ? (
                    <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 text-xs">
                      لا توجد صور مرفقة بأمر النقل حالياً. يمكنك إرفاق صور للمنتجات المحملة، الشاحنة، أو إيصالات الاستلام.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {shippingAttachments.map((att, i) => (
                        <div key={i} className="group relative border border-slate-200 bg-white rounded-lg p-1.5 overflow-hidden shadow-sm hover:shadow transition-all">
                          <img 
                            src={att.data} 
                            alt={att.name} 
                            onClick={() => openGallery(shippingAttachments, i)}
                            className="w-full h-24 object-cover rounded cursor-pointer group-hover:scale-105 transition-transform duration-200" 
                          />
                          <button 
                            type="button"
                            onClick={() => removeShippingAttachment(i)} 
                            className="absolute top-2 left-2 bg-red-600/90 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 hover:bg-red-700 transition-all shadow-md z-10"
                            title="حذف الصورة"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                          <div className="text-[10px] text-slate-500 truncate mt-1 text-center font-medium px-1">
                            {att.name}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="p-6 border-t border-slate-200 bg-slate-50 rounded-b-xl flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                  {shippingAttachments.length > 0 && (
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-700 bg-white px-3.5 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 transition-colors shadow-sm">
                      <input 
                        type="checkbox" 
                        checked={includeAttachmentsInPrint} 
                        onChange={e => setIncludeAttachmentsInPrint(e.target.checked)} 
                        className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer" 
                      />
                      <span>طباعة الصور مع أمر النقل ({shippingAttachments.length} صور)</span>
                    </label>
                  )}
                </div>
                <div className="flex gap-4">
                  <button 
                    disabled={isSavingShipping}
                    onClick={() => { setShowShippingModal(false); setShippingAttachments([]); }} 
                    className="px-6 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
                  >
                    إلغاء
                  </button>
                  <button 
                    disabled={isSavingShipping}
                    onClick={generateShippingOrder} 
                    className={`bg-emerald-600 text-white px-8 py-2 rounded-lg font-bold hover:bg-emerald-700 flex items-center gap-2 shadow-md transition-colors ${isSavingShipping ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <Printer className="w-5 h-5" /> 
                    {isSavingShipping ? 'جاري الحفظ والتسجيل...' : 'حفظ وطباعة أمر النقل'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Gallery Lightbox Modal with navigation and thumbnails */}
        <AttachmentsGalleryModal
          isOpen={isGalleryOpen}
          onClose={() => setIsGalleryOpen(false)}
          images={galleryImages}
          initialIndex={galleryIndex}
          title={galleryTitle}
        />

        {/* Work Order Print Prompt Modal (Choose to print attachments or not) */}
        {woPrintPrompt && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Printer className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-slate-800 text-base">خيارات طباعة أمر التصنيع</h3>
                </div>
                <button 
                  onClick={() => setWoPrintPrompt(null)}
                  className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 text-right space-y-4">
                <div className="flex items-start gap-3 bg-blue-50/70 p-3.5 rounded-xl border border-blue-100">
                  <ImageIcon className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-slate-700 leading-relaxed">
                    يحتوي أمر التصنيع <span className="font-mono font-bold text-blue-700">({woPrintPrompt.wo.id})</span> على <span className="font-bold text-slate-900">{woPrintPrompt.attachments.length}</span> {woPrintPrompt.attachments.length === 1 ? 'صورة مرفقة' : 'صور مرفقة'}.
                    <p className="mt-1.5 text-slate-500 text-xs font-medium">هل ترغب في طباعة الصور والمرفقات مع أمر التصنيع أو طباعة أمر التصنيع فقط؟</p>
                  </div>
                </div>

                <div className="space-y-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPrintData({ type: 'WORK_ORDER', data: woPrintPrompt.wo });
                      setWoPrintPrompt(null);
                    }}
                    className="w-full p-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-between text-sm shadow-md transition-all group"
                  >
                    <span className="flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-blue-200 group-hover:scale-110 transition-transform" /> 
                      طباعة أمر التصنيع مع الصور المرفقة
                    </span>
                    <span className="text-xs bg-blue-700/80 px-2 py-0.5 rounded-full font-mono font-bold">
                      +{woPrintPrompt.attachments.length} صور
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPrintData({ type: 'WORK_ORDER', data: woPrintPrompt.wo, excludeAttachments: true });
                      setWoPrintPrompt(null);
                    }}
                    className="w-full p-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold border border-slate-300 flex items-center justify-between text-sm transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-500" /> 
                      طباعة أمر التصنيع فقط (بدون صور)
                    </span>
                    <span className="text-xs text-slate-400">بيانات التصنيع والمواد فقط</span>
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setWoPrintPrompt(null)}
                  className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

        {showLegacyImportModal && (
          <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
              <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Database className="w-6 h-6 text-slate-700" /> إدخال منتجات سابقة (أرصدة افتتاحية / جرد)</h2>
                  <p className="text-sm text-slate-500 mt-1">أدخل المنتجات القديمة بحالتها الحالية وأرقام تصنيعها القديمة لربطها بالنظام.</p>
                </div>
                <button onClick={() => setShowLegacyImportModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-6 overflow-y-auto flex-1">
                <div className="overflow-x-auto w-full">
<table className="w-full text-right text-sm mb-4">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      <th className="p-2 w-10"></th>
                      <th className="p-2 w-32">رقم التصنيع (SN)</th>
                      <th className="p-2">المنتج / الوصف</th>
                      <th className="p-2 w-24">الشاصية</th>
                      <th className="p-2 w-28">حالة التصنيع</th>
                      <th className="p-2 w-24">حالة البيع</th>
                      <th className="p-2 w-32">اسم الزبون (للمباع)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {legacyItems.map((item, idx) => (
                      <tr key={item.id} className="border-b border-slate-100">
                        <td className="p-2 text-center">
                          <button onClick={() => setLegacyItems(prev => prev.filter(i => i.id !== item.id))} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4" /></button>
                        </td>
                        <td className="p-2">
                          <input type="text" className="w-full border border-slate-300 rounded p-1 outline-none font-mono dir-ltr text-right" placeholder="SN-..." value={item.serialNumber} onChange={e => setLegacyItems(prev => prev.map(i => i.id === item.id ? { ...i, serialNumber: e.target.value } : i))} />
                        </td>
                        <td className="p-2">
                          <input type="text" className="w-full border border-slate-300 rounded p-1 outline-none" placeholder="وصف المنتج..." value={item.desc} onChange={e => setLegacyItems(prev => prev.map(i => i.id === item.id ? { ...i, desc: e.target.value } : i))} />
                        </td>
                        <td className="p-2">
                          <input type="text" className="w-full border border-slate-300 rounded p-1 outline-none" value={item.chassis} onChange={e => setLegacyItems(prev => prev.map(i => i.id === item.id ? { ...i, chassis: e.target.value } : i))} />
                        </td>
                        <td className="p-2">
                          <select className="w-full border border-slate-300 rounded p-1 outline-none" value={item.mfgStatus} onChange={e => setLegacyItems(prev => prev.map(i => i.id === item.id ? { ...i, mfgStatus: e.target.value } : i))}>
                            <option value="جاهز">جاهز</option>
                            <option value="قيد التصنيع">قيد التصنيع</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-1 px-2 rounded border border-slate-200">
                            <input type="checkbox" className="w-4 h-4" checked={item.isSold} onChange={e => setLegacyItems(prev => prev.map(i => i.id === item.id ? { ...i, isSold: e.target.checked } : i))} />
                            <span className="font-bold">مباع</span>
                          </label>
                        </td>
                        <td className="p-2">
                          <input type="text" className="w-full border border-slate-300 rounded p-1 outline-none disabled:bg-slate-100 disabled:opacity-50" placeholder="اسم الزبون..." disabled={!item.isSold} value={item.customerName} onChange={e => setLegacyItems(prev => prev.map(i => i.id === item.id ? { ...i, customerName: e.target.value } : i))} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
</div>
                <button onClick={() => setLegacyItems(prev => [...prev, { id: Date.now(), serialNumber: '', desc: '', chassis: '', length: '', width: '', height: '', sellPrice: '', mfgStatus: 'جاهز', isSold: false, customerName: '' }])} className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 p-2 bg-blue-50 rounded-lg"><Plus className="w-4 h-4" /> إضافة صف آخر</button>
              </div>
              <div className="p-6 border-t border-slate-200 bg-slate-50 rounded-b-xl flex justify-end gap-4">
                <button onClick={() => setShowLegacyImportModal(false)} className="px-6 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-200">إلغاء</button>
                <button onClick={handleSaveLegacyItems} className="bg-slate-800 text-white px-8 py-2 rounded-lg font-bold hover:bg-slate-900 flex items-center gap-2"><Save className="w-5 h-5" /> حفظ الأرصدة المدخلة</button>
              </div>
            </div>
          </div>
        )}

        {/* Work Order Section Status Modal */}
        <WorkOrderStatusModal
          isOpen={Boolean(statusModalData)}
          onClose={() => setStatusModalData(null)}
          item={statusModalData?.item}
          woId={statusModalData?.woId}
          woDate={statusModalData?.woDate}
          worksOf={worksOf}
          onSave={handleSaveSectionStatuses}
        />
      </div>
    );
  };