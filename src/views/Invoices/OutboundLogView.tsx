import React, { useState, useMemo, useEffect, useRef } from 'react'; 
import { useAuth } from '../../context/AuthContext';
import * as XLSX from 'xlsx';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useInvoices } from '../../context/InvoicesContext';
import { useShippingOrders } from '../../context/ShippingOrdersContext';
import { usePrint } from '../../context/PrintContext';
import { useLetters } from '../../context/LettersContext';
import { useWorkOrders } from '../../context/WorkOrdersContext';
import { useDrivers } from '../../context/DriversContext';
import { useSettings } from '../../context/SettingsContext';
import { useCustomers } from '../../context/CustomersContext';
import { bulkUpsert, bulkDelete } from '../../api/client';
import { FileText, Search, Archive, Truck, FileCheck2, FilterX, ChevronUp, ChevronDown, ChevronsUpDown, Download, Database, Mail, Grid, List, Printer, Trash2, FileEdit, X, Save, Plus, Package, MapPin, Calendar, AlertCircle, Check, Image as ImageIcon, UserCheck, UserPlus, User } from 'lucide-react';
import { DriverSelect } from '../../components/ui/DriverSelect';
import { AttachmentsGalleryModal } from '../../components/ui/AttachmentsGalleryModal';
import { LettersView } from '../Letters/LettersView';
import { formatCurrency } from '../../utils/formatters';
import { ExportFilterModal } from '../../components/ui/ExportFilterModal';
import type { ExportFilters } from '../../components/ui/ExportFilterModal';
import { logAudit } from '../../context/AuditLogContext';


export const OutboundLogView = ({ setEditingInvoice, setActiveTab, setViewState }: any) => {
    const { hasPermission, currentUser, users } = useAuth();
    const { invoices, setInvoices, deletedInvoices, setDeletedInvoices } = useInvoices();
    const { shippingOrders, setShippingOrders } = useShippingOrders();
    const { setPrintData } = usePrint();
    const { workOrders, setWorkOrders } = useWorkOrders();
    const { letters, setLetters } = useLetters();
    const { drivers } = useDrivers();
    const { generateIdAsync } = useSettings();
    const { customers, setCustomers } = useCustomers();
    const [editingShippingOrder, setEditingShippingOrder] = useState<any>(null);
    const [isSavingShipping, setIsSavingShipping] = useState(false);
    const [showAddProducts, setShowAddProducts] = useState(false);
    const [productSearch, setProductSearch] = useState('');

    // Customer selection & quick-add states for custom shipping orders
    const [shippingCustomerDropdownOpen, setShippingCustomerDropdownOpen] = useState(false);
    const [newShippingCustomerModalOpen, setNewShippingCustomerModalOpen] = useState(false);
    const [newShippingCustomerForm, setNewShippingCustomerForm] = useState({ name: '', phone: '', notes: '' });
    const [shippingCustomerSuccessMsg, setShippingCustomerSuccessMsg] = useState('');
    const shippingCustomerDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (shippingCustomerDropdownRef.current && !shippingCustomerDropdownRef.current.contains(e.target as Node)) {
          setShippingCustomerDropdownOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredShippingCustomers = useMemo(() => {
      const q = (editingShippingOrder?.customerName || '').trim().toLowerCase();
      if (!q) return (customers || []).slice(0, 10);
      return (customers || []).filter(c => 
        (c.name && c.name.toLowerCase().includes(q)) || 
        (c.phone && c.phone.includes(q))
      ).slice(0, 10);
    }, [customers, editingShippingOrder?.customerName]);

    const exactShippingCustomerMatch = useMemo(() => {
      const q = (editingShippingOrder?.customerName || '').trim().toLowerCase();
      if (!q) return null;
      return (customers || []).find(c => c.name && c.name.trim().toLowerCase() === q);
    }, [customers, editingShippingOrder?.customerName]);

    const formatShippingOrderId = (currentId: string, customerName: string, dateStr?: string): string => {
      if (!currentId) return '';
      const safeCustomerClean = (customerName || '').replace(/[\/\\:*?"<>|]/g, '').trim();
      const year = dateStr ? new Date(dateStr).getFullYear() : new Date().getFullYear();

      const m = String(currentId).match(/^Ref-(\d+)-SHP(?:-(.*?))?-(\d{4})$/i);
      if (m) {
        const seq = m[1].padStart(3, '0');
        const targetYear = m[3] || year;
        if (safeCustomerClean) {
          return `Ref-${seq}-SHP-${safeCustomerClean}-${targetYear}`.replace(/--+/g, '-');
        }
        return `Ref-${seq}-SHP-${targetYear}`;
      }

      return currentId;
    };

    const handleSelectShippingCustomer = (customerName: string) => {
      setEditingShippingOrder((prev: any) => {
        if (!prev) return prev;
        const newId = formatShippingOrderId(prev.id, customerName, prev.date);
        return {
          ...prev,
          id: newId,
          customerName,
          items: (prev?.items || []).map((it: any) => ({ ...it, customerName }))
        };
      });
      setShippingCustomerDropdownOpen(false);
    };

    const handleQuickAddShippingCustomer = async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;

      const existing = (customers || []).find(c => c.name && c.name.trim().toLowerCase() === trimmed.toLowerCase());
      if (existing) {
        handleSelectShippingCustomer(existing.name);
        return;
      }

      const newCust = {
        id: `C${Date.now()}`,
        name: trimmed,
        phone: '',
        notes: ''
      };

      setCustomers(prev => [newCust, ...(prev || [])]);
      await bulkUpsert('customers', [newCust]);

      handleSelectShippingCustomer(newCust.name);

      logAudit({
        actionType: 'create',
        entityType: 'العملاء',
        entityId: newCust.id,
        title: `إضافة عميل جديد: ${newCust.name}`,
        details: 'تمت الإضافة السريعة من أمر النقل المخصص',
        targetCollection: 'customers'
      });

      setShippingCustomerSuccessMsg(`تمت إضافة الزبون "${newCust.name}" بنجاح!`);
      setTimeout(() => setShippingCustomerSuccessMsg(''), 3000);
    };

    const handleSaveDetailedShippingCustomer = async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      const trimmed = newShippingCustomerForm.name.trim();
      if (!trimmed) {
        alert('الرجاء إدخال اسم العميل');
        return;
      }

      const newCust = {
        id: `C${Date.now()}`,
        name: trimmed,
        phone: newShippingCustomerForm.phone.trim(),
        notes: newShippingCustomerForm.notes.trim()
      };

      setCustomers(prev => [newCust, ...(prev || [])]);
      await bulkUpsert('customers', [newCust]);

      handleSelectShippingCustomer(newCust.name);
      setNewShippingCustomerModalOpen(false);
      setShippingCustomerDropdownOpen(false);
      setNewShippingCustomerForm({ name: '', phone: '', notes: '' });

      logAudit({
        actionType: 'create',
        entityType: 'العملاء',
        entityId: newCust.id,
        title: `إضافة عميل جديد: ${newCust.name}`,
        details: `الهاتف: ${newCust.phone || '--'} | الملاحظات: ${newCust.notes || '--'}`,
        targetCollection: 'customers'
      });

      setShippingCustomerSuccessMsg(`تمت إضافة الزبون "${newCust.name}" بنجاح!`);
      setTimeout(() => setShippingCustomerSuccessMsg(''), 3000);
    };

    // Table item helpers for shipping order
    const handleAddNewRow = () => {
      const currentCust = (editingShippingOrder?.customerName || '').trim();
      const newRow = {
        serialNumber: `SN-${Date.now().toString().slice(-6)}`,
        desc: '',
        chassis: '',
        length: '',
        width: '',
        height: '',
        contents: '',
        customerName: currentCust
      };
      setEditingShippingOrder((prev: any) => ({
        ...prev,
        items: [...(prev?.items || []), newRow]
      }));
    };

    const handleItemChange = (index: number, field: string, value: any) => {
      setEditingShippingOrder((prev: any) => {
        if (!prev || !prev.items) return prev;
        const newItems = [...prev.items];
        newItems[index] = {
          ...newItems[index],
          [field]: value
        };
        return { ...prev, items: newItems };
      });
    };

    // Lightbox Gallery state for browsing multiple attachments
    const [galleryImages, setGalleryImages] = useState<any[]>([]);
    const [galleryIndex, setGalleryIndex] = useState(0);
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const [galleryTitle, setGalleryTitle] = useState('معاينة المرفقات');

    const openGallery = (images: any[], startIndex = 0, title = 'معاينة المرفقات') => {
      if (!images || images.length === 0) return;
      setGalleryImages(images);
      setGalleryIndex(startIndex);
      setGalleryTitle(title);
      setIsGalleryOpen(true);
    };

    // Print Prompt for Shipping Orders with attachments
    const [shippingPrintPrompt, setShippingPrintPrompt] = useState<any>(null);

    const handlePrintShippingOrder = (so: any) => {
      if (so.attachments && so.attachments.length > 0) {
        setShippingPrintPrompt(so);
      } else {
        setPrintData({ type: 'SHIPPING_ORDER', data: so });
      }
    };

    const openEditShippingOrder = (so: any) => {
      const matchingUser = users?.find((u: any) => u.id === so.issuedBy?.id || u.displayName === so.issuedBy?.name);
      const issuedBy = so.issuedBy || (matchingUser ? {
        id: matchingUser.id,
        name: matchingUser.displayName,
        jobTitle: matchingUser.jobTitle || 'مسؤول الحركة والتسليم',
        signature: matchingUser.signature || '',
        stamp: matchingUser.stamp || ''
      } : (currentUser ? {
        id: currentUser.id,
        name: currentUser.displayName,
        jobTitle: currentUser.jobTitle || 'مسؤول الحركة والتسليم',
        signature: currentUser.signature || '',
        stamp: currentUser.stamp || ''
      } : undefined));

      const hasFactoryItems = (so.items || []).some((i: any) => 
        i.workOrderId || workOrders.some(wo => (wo.items || []).some((wi: any) => (wi.serialNumber || wi.sn)?.trim() === (i.serialNumber || i.sn)?.trim()))
      );

      const originalId = so.id;
      const targetCustomer = so.customerName || '';
      const formattedId = formatShippingOrderId(so.id, targetCustomer, so.date);

      setEditingShippingOrder({
        ...so,
        id: formattedId,
        _originalId: originalId,
        _isNew: false,
        _isCustomOrder: so._isCustomOrder !== undefined ? Boolean(so._isCustomOrder) : !hasFactoryItems,
        issuedBy,
        _originalSNs: (so.items || []).map((i: any) => i.serialNumber).filter(Boolean),
        items: (so.items || []).map((i: any) => ({ ...i })),
        attachments: (so.attachments || []).map((a: any) => ({ ...a }))
      });
      setShowAddProducts(false);
      setProductSearch('');
    };

    const handleShippingOrderFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      files.forEach(file => {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (ev.target?.result) {
            setEditingShippingOrder((prev: any) => ({
              ...prev,
              attachments: [...(prev.attachments || []), { name: file.name, type: file.type, data: ev.target!.result as string }]
            }));
          }
        };
        reader.readAsDataURL(file);
      });
      e.target.value = '';
    };

    const removeShippingOrderAttachment = (index: number) => {
      setEditingShippingOrder((prev: any) => ({
        ...prev,
        attachments: (prev.attachments || []).filter((_: any, i: number) => i !== index)
      }));
    };

    const hasFactoryProductsInOrder = useMemo(() => {
      if (!editingShippingOrder || !editingShippingOrder.items || editingShippingOrder.items.length === 0) return false;
      return (editingShippingOrder.items || []).some((it: any) => 
        it.workOrderId || workOrders.some(wo => (wo.items || []).some((wi: any) => (wi.serialNumber || wi.sn)?.trim() === (it.serialNumber || it.sn)?.trim()))
      );
    }, [editingShippingOrder?.items, workOrders]);

    const availableFactoryProducts = useMemo(() => {
      if (!editingShippingOrder) return [];
      const currentSNs = new Set((editingShippingOrder.items || []).map((i: any) => (i.serialNumber || i.sn)?.trim()).filter(Boolean));
      const otherShippedSNs = new Set(
        shippingOrders
          .filter(so => so.id !== editingShippingOrder.id)
          .flatMap(so => (so.items || []).map((i: any) => (i.serialNumber || i.sn)?.trim()))
          .filter(Boolean)
      );

      const list: any[] = [];
      workOrders.forEach(wo => {
        (wo.items || []).forEach((item: any) => {
          const sn = (item.serialNumber || item.sn)?.trim();
          if (!sn) return;
          if (currentSNs.has(sn)) return;
          if (otherShippedSNs.has(sn)) return;

          // 1. Must be Ready (جاهز) - غير الجاهز لا يعرض أبداً
          const isReady = item.mfgStatus === 'جاهز' || item.status === 'جاهز';
          if (!isReady) return;

          // 2. Must be Sold (مباع) - غير المباع لا يعرض أبداً
          const finalInv = invoices.find(inv => 
            inv.type === 'نهائية' && 
            Array.isArray(inv.items) && 
            inv.items.some((x: any) => (x.serialNumber || x.sn)?.trim() === sn)
          );

          const isSold = Boolean(finalInv || item.status === 'مباع' || item.isSold === true || item.saleStatus === 'مباع');
          if (!isSold) return;

          // 3. Must have an identified customer name
          const customer = (finalInv?.customerName || item.customerName || wo.customerName || '').trim();
          if (!customer || customer === 'عميل غير محدد' || customer === 'غير محدد') return;

          list.push({
            ...item,
            serialNumber: sn,
            workOrderId: wo.id,
            customerName: customer,
            isReady: true,
            isSold: true,
            invoiceId: finalInv?.id
          });
        });
      });

      return list;
    }, [workOrders, shippingOrders, invoices, editingShippingOrder?.id, editingShippingOrder?.items]);

    const filteredFactoryProducts = useMemo(() => {
      if (!editingShippingOrder) return [];

      const currentOrderCustomer = (editingShippingOrder.customerName || '').trim().toLowerCase();

      return availableFactoryProducts.filter(item => {
        // Single customer constraint: if the shipping order has a customer set, only show products belonging to that exact customer
        if (currentOrderCustomer && !editingShippingOrder._isCustomOrder) {
          const itemCust = (item.customerName || '').trim().toLowerCase();
          if (itemCust !== currentOrderCustomer) {
            return false;
          }
        }

        if (productSearch.trim()) {
          const q = productSearch.trim().toLowerCase();
          const matchSN = (item.serialNumber || '').toLowerCase().includes(q);
          const matchDesc = (item.desc || item.name || '').toLowerCase().includes(q);
          const matchChassis = (item.chassis || '').toLowerCase().includes(q);
          const matchCust = (item.customerName || '').toLowerCase().includes(q);
          if (!matchSN && !matchDesc && !matchChassis && !matchCust) return false;
        }

        return true;
      });
    }, [availableFactoryProducts, editingShippingOrder?.customerName, editingShippingOrder?._isCustomOrder, productSearch]);

    const handleAddFactoryProduct = (prod: any) => {
      if (editingShippingOrder._isCustomOrder) {
        alert('⚠️ أمر النقل الحالي في وضع "أمر نقل مخصص".\nلإضافة منتجات من المصنع، يرجى التبديل أولاً إلى وضع "منتجات المصنع المباعة".');
        return;
      }

      const prodCustomer = (prod.customerName || '').trim();
      const currentCustomer = (editingShippingOrder.customerName || '').trim();

      // Rule: cannot mix products of different customers
      if (currentCustomer && prodCustomer && currentCustomer.toLowerCase() !== prodCustomer.toLowerCase()) {
        alert(`⚠️ لا يمكن إضافة هذا المنتج:\nأمر النقل مخصص للعميل (${currentCustomer})، بينما هذا المنتج مباع للعميل (${prodCustomer}).\n\nقواعد النظام تمنع شحن منتجات تخص أكثر من عميل واحد في نفس أمر النقل.`);
        return;
      }

      const newItem = {
        serialNumber: prod.serialNumber,
        desc: prod.desc || prod.name || '',
        chassis: prod.chassis || '',
        length: prod.length || '',
        width: prod.width || '',
        height: prod.height || '',
        contents: '',
        customerName: prodCustomer || currentCustomer,
        workOrderId: prod.workOrderId || ''
      };

      const finalCustomer = currentCustomer || prodCustomer;
      const newId = formatShippingOrderId(editingShippingOrder.id, finalCustomer, editingShippingOrder.date);

      setEditingShippingOrder({
        ...editingShippingOrder,
        id: newId,
        customerName: finalCustomer,
        items: [...(editingShippingOrder.items || []), newItem]
      });
    };

    const handleDeleteProduct = (indexToRemove: number) => {
      if ((editingShippingOrder.items || []).length <= 1 && !editingShippingOrder._isNew) {
        alert('يجب أن يحتوي أمر النقل على منتج واحد على الأقل. لحذف أمر النقل بالكامل، استخدم زر الحذف من القائمة الرئيسية.');
        return;
      }
      const updated = editingShippingOrder.items.filter((_: any, idx: number) => idx !== indexToRemove);
      const resetCustomer = updated.length === 0 && !editingShippingOrder._isCustomOrder;
      const finalCustomer = resetCustomer ? '' : editingShippingOrder.customerName;
      const newId = formatShippingOrderId(editingShippingOrder.id, finalCustomer, editingShippingOrder.date);
      setEditingShippingOrder({ 
        ...editingShippingOrder, 
        id: newId,
        customerName: finalCustomer,
        items: updated 
      });
    };

    const handleCreateShippingOrder = async () => {
      if (!hasPermission('invoices', 'create')) {
        alert('ليس لديك صلاحية لإنشاء أوامر النقل.');
        return;
      }

      let newId = '';
      try {
        newId = await generateIdAsync('shp', '');
      } catch (err) {
        newId = `shp-${Date.now().toString().slice(-6)}`;
      }

      const issuedBy = currentUser ? {
        id: currentUser.id,
        name: currentUser.displayName,
        jobTitle: currentUser.jobTitle || 'مسؤول الحركة والتسليم',
        signature: currentUser.signature || '',
        stamp: currentUser.stamp || ''
      } : undefined;

      setEditingShippingOrder({
        id: newId,
        _originalId: newId,
        _isNew: true,
        _isCustomOrder: false,
        date: new Date().toISOString(),
        driver: null,
        destination: '',
        customerName: '',
        items: [],
        attachments: [],
        issuedBy,
        _originalSNs: []
      });
      setShowAddProducts(true);
      setProductSearch('');
    };

    const handleSaveShippingOrder = async () => {
      if (!editingShippingOrder) return;
      if (!editingShippingOrder.destination || !editingShippingOrder.destination.trim()) {
        alert('الرجاء كتابة الوجهة بشكل صحيح');
        return;
      }
      if (!editingShippingOrder.driver && !editingShippingOrder.driverName) {
        alert('الرجاء اختيار السائق / الناقل');
        return;
      }
      if (!editingShippingOrder.items || editingShippingOrder.items.length === 0) {
        alert('يجب أن يحتوي أمر النقل على منتج واحد على الأقل في الجدول');
        return;
      }
      const customerName = (editingShippingOrder.customerName || '').trim();
      if (!customerName || customerName.length < 2) {
        alert('الرجاء تحديد العميل بشكل صحيح (اختر منتجاً مباعاً ليتم ربط وتحديد العميل تلقائياً، أو اكتب واقتنص اسم العميل في أمر النقل المخصص)');
        return;
      }

      // Check all items have a description/name
      for (let i = 0; i < editingShippingOrder.items.length; i++) {
        const item = editingShippingOrder.items[i];
        if (!item.desc || !item.desc.trim()) {
          alert(`يرجى كتابة وصف أو اسم المنتج في السطر رقم (${i + 1}) في جدول المنتجات`);
          return;
        }
      }

      // Check single customer rule across all items
      const uniqueCustomers = new Set(
        (editingShippingOrder.items || [])
          .map((i: any) => (i.customerName || '').trim().toLowerCase())
          .filter(Boolean)
      );
      if (uniqueCustomers.size > 1) {
        alert('⚠️ لا يمكن حفظ أمر النقل:\nيحتوي أمر النقل على منتجات تابعة لزبائن مختلفين. يجب أن تخص كل المنتجات عميلاً واحداً فقط.');
        return;
      }

      // Strict enforcement: ensure no factory item has a mismatched buyer
      for (const it of (editingShippingOrder.items || [])) {
        const sn = (it.serialNumber || it.sn)?.trim();
        if (!sn) continue;
        const factoryItem = workOrders.flatMap(wo => wo.items || []).find((wi: any) => (wi.serialNumber || wi.sn)?.trim() === sn);
        if (factoryItem) {
          const finalInv = invoices.find(inv => inv.type === 'نهائية' && Array.isArray(inv.items) && inv.items.some((x: any) => (x.serialNumber || x.sn)?.trim() === sn));
          const realCustomer = (finalInv?.customerName || factoryItem.customerName || '').trim();
          if (realCustomer && realCustomer.toLowerCase() !== customerName.toLowerCase()) {
            alert(`❌ حماية صارمة لمنع التلاعب:\nالمنتج (${it.desc || sn}) مسجل ومباع في المصنع للعميل (${realCustomer})، بينما أمر النقل موجه للعميل (${customerName}).\n\nلا يمكن حفظ أمر النقل لعميل غير المشتري الحقيقي المسجل في الفاتورة.`);
            return;
          }
          if (editingShippingOrder._isCustomOrder) {
            alert(`❌ حماية النظام:\nلا يمكن حفظ أمر نقل "مخصص" يحتوي على منتجات مصنع مباعة (${it.desc || sn}). منتجات المصنع يجب أن تشحن بأمر نقل منتجات مصنع بالزبون الأصلي.`);
            return;
          }
        }
      }

      setIsSavingShipping(true);
      try {
        const originalSNs: string[] = (editingShippingOrder._originalSNs || []).map((s: string) => s.trim());
        const currentSNs: string[] = (editingShippingOrder.items || []).map((i: any) => (i.serialNumber || i.sn)?.trim()).filter(Boolean);

        const removedSNs = originalSNs.filter(sn => !currentSNs.includes(sn));
        const addedSNs = currentSNs.filter(sn => !originalSNs.includes(sn));

        const finalId = formatShippingOrderId(editingShippingOrder.id, customerName, editingShippingOrder.date);
        const originalId = editingShippingOrder._originalId || editingShippingOrder.id;
        const isIdChanged = Boolean(originalId && originalId !== finalId);

        let updatedWOs = workOrders;
        if (removedSNs.length > 0 || addedSNs.length > 0 || isIdChanged) {
          updatedWOs = workOrders.map(wo => {
            let changed = false;
            const newWoItems = (wo.items || []).map(wi => {
              const sn = wi.serialNumber?.trim();
              if (sn && removedSNs.includes(sn)) {
                changed = true;
                const copy = { ...wi, shippingStatus: 'غير منقولة' };
                delete copy.shippingOrderId;
                delete copy.shippingOrderDate;
                return copy;
              }
              if (sn && addedSNs.includes(sn)) {
                changed = true;
                return { 
                  ...wi, 
                  shippingStatus: 'منقولة',
                  shippingOrderId: finalId,
                  shippingOrderDate: editingShippingOrder.date
                };
              }
              if (isIdChanged && wi.shippingOrderId === originalId) {
                changed = true;
                return {
                  ...wi,
                  shippingOrderId: finalId
                };
              }
              return wi;
            });
            return changed ? { ...wo, items: newWoItems } : wo;
          });
        }

        const sanitizedItems = (editingShippingOrder.items || []).map((it: any, idx: number) => ({
          ...it,
          desc: (it.desc || '').trim(),
          serialNumber: (it.serialNumber || '').trim() || `SN-${Date.now().toString().slice(-6)}-${idx + 1}`,
          chassis: (it.chassis || '').trim(),
          length: (it.length || '').trim(),
          width: (it.width || '').trim(),
          height: (it.height || '').trim(),
          contents: (it.contents || '').trim(),
          customerName: customerName
        }));

        const orderToSave = { 
          ...editingShippingOrder,
          id: finalId,
          customerName,
          items: sanitizedItems
        };
        const isNew = Boolean(orderToSave._isNew);
        delete orderToSave._originalSNs;
        delete orderToSave._isNew;
        delete orderToSave._originalId;

        if (!orderToSave.issuedBy && currentUser) {
          orderToSave.issuedBy = {
            id: currentUser.id,
            name: currentUser.displayName,
            jobTitle: currentUser.jobTitle || 'مسؤول الحركة والتسليم',
            signature: currentUser.signature || '',
            stamp: currentUser.stamp || ''
          };
        }

        // Persist to server / database
        const shpRes = await bulkUpsert('shipping_orders', [orderToSave]);
        if (!shpRes.success) {
          throw new Error(shpRes.error || 'فشل حفظ أمر النقل في قاعدة البيانات');
        }

        // If ID changed and not a brand new record, remove old ID record from db
        if (isIdChanged && !isNew) {
          await bulkDelete('shipping_orders', [originalId]);
        }

        if (removedSNs.length > 0 || addedSNs.length > 0 || isIdChanged) {
          const affectedWos = updatedWOs.filter(wo => (wo.items || []).some((it: any) => removedSNs.includes(it.serialNumber) || addedSNs.includes(it.serialNumber) || it.shippingOrderId === finalId));
          if (affectedWos.length > 0) {
            await bulkUpsert('work_orders', affectedWos);
          }
          setWorkOrders(updatedWOs);
        }

        if (isNew) {
          setShippingOrders([orderToSave, ...shippingOrders.filter(s => s.id !== orderToSave.id && s.id !== originalId)]);
          logAudit({
            actionType: 'create',
            entityType: 'أوامر النقل',
            entityId: orderToSave.id,
            title: `إنشاء أمر نقل: ${orderToSave.id}`,
            details: `السائق: ${orderToSave.driver?.name || orderToSave.driverName || '--'} | الوجهة: ${orderToSave.destination} | العميل: ${orderToSave.customerName || '--'} | عدد البنود: ${orderToSave.items?.length || 0}`,
            targetCollection: 'shipping_orders',
            nextState: orderToSave
          });
        } else {
          setShippingOrders(shippingOrders.map(so => (so.id === originalId || so.id === orderToSave.id) ? orderToSave : so));
          const prevSo = shippingOrders.find(s => s.id === originalId || s.id === orderToSave.id);
          logAudit({
            actionType: 'edit',
            entityType: 'أوامر النقل',
            entityId: orderToSave.id,
            title: `تعديل أمر نقل: ${orderToSave.id}`,
            details: `السائق: ${orderToSave.driver?.name || orderToSave.driverName || '--'} | الوجهة: ${orderToSave.destination} | عدد البنود: ${orderToSave.items?.length || 0}`,
            targetCollection: 'shipping_orders',
            previousState: prevSo,
            nextState: orderToSave
          });
        }

        setEditingShippingOrder(null);
        if (isNew && window.confirm('تم إنشاء وحفظ أمر النقل بنجاح! هل ترغب في طباعته الآن؟')) {
          handlePrintShippingOrder(orderToSave);
        }
      } catch (err: any) {
        console.error('Error saving shipping order:', err);
        alert(`حدث خطأ أثناء حفظ أمر النقل: ${err.message || 'خطأ غير معروف'}`);
      } finally {
        setIsSavingShipping(false);
      }
    };

    const [activeSubTab, setActiveSubTab] = useLocalStorage('shams_outbound_tab', 'general');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<string>(() => {
      try {
        const saved = window.localStorage.getItem('shams_outbound_filterType');
        if (saved) {
          window.localStorage.removeItem('shams_outbound_filterType');
          return JSON.parse(saved);
        }
      } catch {}
      return 'الكل';
    });

    useEffect(() => {
      try {
        const saved = window.localStorage.getItem('shams_outbound_filterType');
        if (saved) {
          window.localStorage.removeItem('shams_outbound_filterType');
          setFilterType(JSON.parse(saved));
        }
      } catch {}
    }, [activeSubTab]);
    const [filterSpecialty, setFilterSpecialty] = useLocalStorage('shams_outbound_filterSpecialty', 'الكل');
    const [filterTechnician, setFilterTechnician] = useLocalStorage('shams_outbound_filterTechnician', 'الكل');
    const [generalCategoryFilter, setGeneralCategoryFilter] = useLocalStorage('shams_outbound_generalCategory', 'الكل');
    const [exportModalTarget, setExportModalTarget] = useState<string | null>(null);
    const [viewMode, setViewMode] = useLocalStorage('outbound_viewMode', 'table'); // 'general' | 'invoices' | 'shipping'
    
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 10;
    const [sortConfig, setSortConfig] = useLocalStorage('outbound_sortConfig', { key: 'date', direction: 'desc' });

    // تجميع التخصصات والفنيين المتاحين ديناميكياً من فواتير الإنتاجية
    const { availableSpecialties, availableTechnicians } = useMemo(() => {
      const specs = new Set<string>();
      const techs = new Set<string>();
      invoices.forEach(inv => {
        if (inv?.type === 'إنتاجية') {
          if (inv.customerName?.trim()) techs.add(inv.customerName.trim());
          if (Array.isArray(inv.items)) {
            inv.items.forEach((it: any) => {
              if (it.specialty?.trim()) specs.add(it.specialty.trim());
              if (it.technicianName?.trim()) techs.add(it.technicianName.trim());
            });
          }
        }
      });
      return {
        availableSpecialties: Array.from(specs).sort(),
        availableTechnicians: Array.from(techs).sort()
      };
    }, [invoices]);


    const handleSort = (key) => {
      let direction = 'desc';
      if (sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';
      setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
      if (sortConfig.key !== key) return <ChevronsUpDown className="w-3 h-3 inline text-slate-300 mx-1" />;
      return sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 inline text-blue-500 mx-1" /> : <ChevronDown className="w-3 h-3 inline text-blue-500 mx-1" />;
    };

    const handleCreateInvoice = (type: 'مبدئية' | 'نهائية') => {
      if (!hasPermission('invoices', 'create')) {
        alert('ليس لديك صلاحية لإنشاء الفواتير.');
        return;
      }

      const newInvoice = {
        isDraft: true,
        type: type,
        customerName: '',
        items: [],
        total: 0,
        discount: 0,
        netTotal: 0,
        notes: '',
        terms: '',
        sourceTab: 'invoices',
        createdBy: currentUser ? {
          id: currentUser.id,
          name: currentUser.displayName,
          jobTitle: currentUser.jobTitle || 'مدير مبيعات',
          signature: currentUser.signature || '',
          stamp: currentUser.stamp || ''
        } : undefined
      };

      setEditingInvoice(newInvoice);
      setViewState('edit_invoice');
      window.scrollTo(0, 0);
    };


    const deleteInvoice = (inv) => {
      if (!hasPermission('invoices', 'delete')) return alert('ليس لديك صلاحية لحذف الفواتير.');
      if (window.confirm('هل أنت متأكد من حذف هذه الفاتورة؟ (سيتم إرجاع المنتجات المباعة لحالتها السابقة في أوامر التصنيع وسيتم نقل الفاتورة إلى سجل المحذوفات)')) {
        if (inv.type === 'نهائية') {
          const sns = inv.items.map(i => i.serialNumber).filter(Boolean);
          setWorkOrders(prev => prev.map(wo => {
            let changed = false;
            const newWoItems = wo.items.map(wi => {
              if (sns.includes(wi.serialNumber)) { changed = true; return { ...wi, status: wi.mfgStatus || 'جاهز' }; }
              return wi;
            });
            return changed ? { ...wo, items: newWoItems } : wo;
          }));
        }
        setDeletedInvoices([{ ...inv, deletedAt: new Date().toISOString() }, ...deletedInvoices]);
        setInvoices(invoices.filter(i => i.id !== inv.id));
        logAudit({
          actionType: 'delete',
          entityType: 'فواتير المبيعات',
          entityId: inv.id,
          title: `حذف فاتورة ونقلها للمحذوفات: ${inv.id}`,
          details: `النوع: ${inv.type} | العميل: ${inv.customerName || '--'} | الإجمالي: ${inv.totalAmount ? formatCurrency(inv.totalAmount) : '--'} د.ل`,
          targetCollection: 'invoices',
          previousState: inv
        });
      }
    };

    const deleteShippingOrder = (so) => {
      if (!hasPermission('invoices', 'delete')) return alert('ليس لديك صلاحية لحذف أوامر النقل.');
      if(window.confirm('هل أنت متأكد من حذف أمر النقل هذا من السجل؟ (سيتم إرجاع حالة المنتجات لـ "غير منقولة")')) {
        const sns = (so.items || []).map((i: any) => (i.serialNumber || i.sn)?.trim()).filter(Boolean);
        setWorkOrders(prev => prev.map(wo => {
          let changed = false;
          const newWoItems = (wo.items || []).map((wi: any) => {
            const sn = wi.serialNumber?.trim();
            if (sn && sns.includes(sn)) { 
              changed = true; 
              const copy = { ...wi, shippingStatus: 'غير منقولة' };
              delete copy.shippingOrderId;
              delete copy.shippingOrderDate;
              return copy;
            }
            return wi;
          });
          return changed ? { ...wo, items: newWoItems } : wo;
        }));
        setShippingOrders(shippingOrders.filter(x => x.id !== so.id));
        logAudit({
          actionType: 'delete',
          entityType: 'أوامر النقل',
          entityId: so.id,
          title: `حذف أمر نقل: ${so.id}`,
          details: `السائق: ${so.driverName || so.driver?.name || '--'} | الوجهة: ${so.destination || '--'}`,
          targetCollection: 'shipping_orders',
          previousState: so
        });
      }
    };

    const isDeletedView = filterType === 'محذوفة';
    const sourceArray = isDeletedView ? deletedInvoices : invoices;
    
    const filteredInvoices = useMemo(() => {
      const term = (searchTerm || '').trim().toLowerCase();
      let filtered = sourceArray.filter(inv => {
        if (!inv) return false;
        const idMatch = String(inv.id || '').toLowerCase().includes(term);
        const custMatch = String(inv.customerName || '').toLowerCase().includes(term);
        const notesMatch = String(inv.notes || '').toLowerCase().includes(term);
        const itemsMatch = Array.isArray(inv.items) && inv.items.some((it: any) => 
          String(it.serialNumber || '').toLowerCase().includes(term) ||
          String(it.desc || '').toLowerCase().includes(term) ||
          String(it.specialty || '').toLowerCase().includes(term) ||
          String(it.technicianName || '').toLowerCase().includes(term)
        );
        const matchSearch = !term || idMatch || custMatch || notesMatch || itemsMatch;
        const matchType = filterType === 'الكل' || filterType === 'محذوفة' || inv.type === filterType;

        let matchSpecialty = true;
        let matchTechnician = true;

        if (filterType === 'إنتاجية' || inv.type === 'إنتاجية') {
          if (filterSpecialty !== 'الكل') {
            matchSpecialty = (Array.isArray(inv.items) && inv.items.some((it: any) => it.specialty === filterSpecialty))
              || String(inv.notes || '').includes(filterSpecialty);
          }
          if (filterTechnician !== 'الكل') {
            matchTechnician = inv.customerName === filterTechnician 
              || (Array.isArray(inv.items) && inv.items.some((it: any) => it.technicianName === filterTechnician));
          }
        }

        return matchSearch && matchType && matchSpecialty && matchTechnician;
      });

      filtered.sort((a, b) => {
        let valA: any = '';
        let valB: any = '';
        switch (sortConfig.key) {
          case 'id': valA = String(a?.id || ''); valB = String(b?.id || ''); break;
          case 'date': valA = a?.date ? new Date(a.date).getTime() : 0; valB = b?.date ? new Date(b.date).getTime() : 0; break;
          case 'customerName': valA = String(a?.customerName || ''); valB = String(b?.customerName || ''); break;
          case 'type': valA = String(a?.type || ''); valB = String(b?.type || ''); break;
          case 'netTotal': valA = Number(a?.netTotal || 0); valB = Number(b?.netTotal || 0); break;
          default: valA = a?.date ? new Date(a.date).getTime() : 0; valB = b?.date ? new Date(b.date).getTime() : 0;
        }
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
      return filtered;
    }, [sourceArray, searchTerm, filterType, filterSpecialty, filterTechnician, sortConfig]);

    const paginatedInvoices = filteredInvoices.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
    const totalInvoicesPages = Math.ceil(filteredInvoices.length / rowsPerPage);

    const exportInvoicesToExcel = (filters: ExportFilters) => {
      let data = filteredInvoices;
      if (filters.dateFrom) data = data.filter(inv => new Date(inv.date) >= new Date(filters.dateFrom));
      if (filters.dateTo) data = data.filter(inv => new Date(inv.date) <= new Date(filters.dateTo + 'T23:59:59'));
      if (filters.refIdFrom) data = data.filter(inv => String(inv.id) >= String(filters.refIdFrom));
      if (filters.refIdTo) data = data.filter(inv => String(inv.id) <= String(filters.refIdTo));
      const headers = ['الرقم الإشاري', 'النوع', 'الزبون / الفني', 'التاريخ', 'المبلغ', 'ملاحظات / تخصص'];
      const rows = data.map(inv => [
        inv.id || '',
        inv.type === 'إنتاجية' ? 'إنتاجية فنيين' : (inv.type || ''),
        inv.customerName || '',
        inv.date ? new Date(inv.date).toLocaleDateString('en-GB') : '',
        inv.netTotal || 0,
        inv.notes || (inv.items?.map((it: any) => it.specialty).filter(Boolean).join(', ')) || ''
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!dir'] = 'rtl';
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "الفواتير");
      XLSX.writeFile(wb, `الفواتير_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.xlsx`);
    };

    const filteredShipping = useMemo(() => {
      const term = (searchTerm || '').trim().toLowerCase();
      let filtered = shippingOrders.filter(so => {
        if (!so) return false;
        const idMatch = String(so.id || '').toLowerCase().includes(term);
        const destMatch = String(so.destination || '').toLowerCase().includes(term);
        const driverMatch = String(so.driver?.name || '').toLowerCase().includes(term);
        return !term || idMatch || destMatch || driverMatch;
      });

      filtered.sort((a, b) => {
        let valA: any = '';
        let valB: any = '';
        switch (sortConfig.key) {
          case 'id': valA = String(a?.id || ''); valB = String(b?.id || ''); break;
          case 'date': valA = a?.date ? new Date(a.date).getTime() : 0; valB = b?.date ? new Date(b.date).getTime() : 0; break;
          case 'destination': valA = String(a?.destination || ''); valB = String(b?.destination || ''); break;
          case 'driverName': valA = String(a?.driver?.name || ''); valB = String(b?.driver?.name || ''); break;
          case 'itemsCount': valA = Number(a?.items?.length || 0); valB = Number(b?.items?.length || 0); break;
          default: valA = a?.date ? new Date(a.date).getTime() : 0; valB = b?.date ? new Date(b.date).getTime() : 0;
        }
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
      return filtered;
    }, [shippingOrders, searchTerm, sortConfig]);

    const paginatedShipping = filteredShipping.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
    const totalShippingPages = Math.ceil(filteredShipping.length / rowsPerPage);

    const exportShippingToExcel = (filters: ExportFilters) => {
      let data = filteredShipping;
      if (filters.dateFrom) data = data.filter(so => new Date(so.date) >= new Date(filters.dateFrom));
      if (filters.dateTo) data = data.filter(so => new Date(so.date) <= new Date(filters.dateTo + 'T23:59:59'));
      const headers = ['الرقم الإشاري', 'التاريخ', 'الوجهة', 'السائق والمركبة', 'عدد المنتجات'];
      const rows = data.map(so => [
        so.id || '',
        so.date ? new Date(so.date).toLocaleDateString('en-GB') : '',
        so.destination || '',
        `${so.driver?.name || ''} (${so.driver?.truckNumber || ''})`,
        so.items?.length || 0
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!dir'] = 'rtl';
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "أوامر النقل");
      XLSX.writeFile(wb, `أوامر_النقل_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.xlsx`);
    };

    const allRecords = [
      ...invoices.map(inv => ({
        id: inv?.id || '',
        date: inv?.date || '',
        customerName: inv?.customerName || '',
        subject: inv?.type === 'مبدئية' ? 'فاتورة مبدئية' : (inv?.type === 'إنتاجية' ? 'فاتورة إنتاجية' : 'فاتورة نهائية'),
        original: inv,
        sourceType: inv?.type === 'إنتاجية' ? 'tech_invoice' : 'invoice'
      })),
      ...shippingOrders.map(so => ({
        id: so?.id || '',
        date: so?.date || '',
        customerName: so?.destination || '',
        subject: 'أمر نقل',
        original: so,
        sourceType: 'shipping'
      })),
      ...letters.map(ltr => ({
        id: ltr?.id || '',
        date: ltr?.date || '',
        customerName: ltr?.to || ltr?.customerName || '',
        subject: ltr?.subject || 'مخاطبة',
        original: ltr,
        sourceType: 'letter'
      }))
    ].sort((a, b) => (new Date(b.date).getTime() || 0) - (new Date(a.date).getTime() || 0));

    const filteredGeneral = useMemo(() => {
      const term = (searchTerm || '').trim().toLowerCase();
      let filtered = allRecords.filter(r => {
        if (!r) return false;
        const idMatch = String(r.id || '').toLowerCase().includes(term);
        const custMatch = String(r.customerName || '').toLowerCase().includes(term);
        const subjMatch = String(r.subject || '').toLowerCase().includes(term);
        const origItemsMatch = r.original?.items && Array.isArray(r.original.items) && r.original.items.some((it: any) => 
          String(it.serialNumber || '').toLowerCase().includes(term) ||
          String(it.desc || '').toLowerCase().includes(term) ||
          String(it.specialty || '').toLowerCase().includes(term) ||
          String(it.technicianName || '').toLowerCase().includes(term)
        );
        const origNotesMatch = String(r.original?.notes || '').toLowerCase().includes(term);
        const matchSearch = !term || idMatch || custMatch || subjMatch || origItemsMatch || origNotesMatch;

        let matchCategory = true;
        if (generalCategoryFilter === 'invoices') {
          matchCategory = r.sourceType === 'invoice';
        } else if (generalCategoryFilter === 'tech_invoices') {
          matchCategory = r.sourceType === 'tech_invoice';
        } else if (generalCategoryFilter === 'shipping') {
          matchCategory = r.sourceType === 'shipping';
        } else if (generalCategoryFilter === 'letters') {
          matchCategory = r.sourceType === 'letter';
        }

        return matchSearch && matchCategory;
      });

      filtered.sort((a, b) => {
        let valA: any = '';
        let valB: any = '';
        switch (sortConfig.key) {
          case 'id': valA = String(a?.id || ''); valB = String(b?.id || ''); break;
          case 'date': valA = a?.date ? new Date(a.date).getTime() : 0; valB = b?.date ? new Date(b.date).getTime() : 0; break;
          case 'customerName': valA = String(a?.customerName || ''); valB = String(b?.customerName || ''); break;
          case 'subject': valA = String(a?.subject || ''); valB = String(b?.subject || ''); break;
          default: valA = a?.date ? new Date(a.date).getTime() : 0; valB = b?.date ? new Date(b.date).getTime() : 0;
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });

      return filtered;
    }, [allRecords, searchTerm, sortConfig, generalCategoryFilter]);

    useEffect(() => {
      setCurrentPage(1);
    }, [searchTerm, sortConfig, activeSubTab, filterType, filterSpecialty, filterTechnician, generalCategoryFilter]);

    const totalGeneralPages = Math.ceil(filteredGeneral.length / rowsPerPage);
    const paginatedGeneral = filteredGeneral.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

    const exportGeneralToExcel = (filters: ExportFilters) => {
      let data = filteredGeneral;
      if (filters.dateFrom) data = data.filter(r => new Date(r.date) >= new Date(filters.dateFrom));
      if (filters.dateTo) data = data.filter(r => new Date(r.date) <= new Date(filters.dateTo + 'T23:59:59'));
      if (filters.refIdFrom) data = data.filter(r => String(r.id) >= String(filters.refIdFrom));
      if (filters.refIdTo) data = data.filter(r => String(r.id) <= String(filters.refIdTo));
      const headers = ['الرقم الإشاري', 'التاريخ', 'العميل / الجهة', 'الموضوع'];
      const rows = data.map(record => [
        record.id || '',
        record.date ? new Date(record.date).toLocaleDateString('en-GB') : '',
        record.customerName || '',
        record.subject || ''
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!dir'] = 'rtl';
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "السجل العام");
      XLSX.writeFile(wb, `السجل_العام_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.xlsx`);
    };

    return (
      <div className="w-full 2xl:max-w-[1800px] mx-auto">
        <h1 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Archive className="w-6 h-6 text-slate-500" /> سجل الصادر (الفواتير والنقل)</h1>

        {/* Export Filter Modals */}
        <ExportFilterModal
          isOpen={exportModalTarget === 'general'}
          onClose={() => setExportModalTarget(null)}
          onExport={exportGeneralToExcel}
          title="تصدير السجل العام"
          showRefId={true}
        />
        <ExportFilterModal
          isOpen={exportModalTarget === 'invoices'}
          onClose={() => setExportModalTarget(null)}
          onExport={exportInvoicesToExcel}
          title="تصدير أرشيف الفواتير"
          showRefId={true}
        />
        <ExportFilterModal
          isOpen={exportModalTarget === 'shipping'}
          onClose={() => setExportModalTarget(null)}
          onExport={exportShippingToExcel}
          title="تصدير سجلات أوامر النقل"
        />

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
          <div className="flex flex-wrap gap-2 sm:gap-4">
            <button onClick={() => setActiveSubTab('general')} className={`px-6 py-3 rounded-lg font-bold shadow-sm flex items-center gap-2 transition-colors ${activeSubTab === 'general' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}><Database className="w-5 h-5" /> السجل العام</button>
            <button onClick={() => setActiveSubTab('invoices')} className={`px-6 py-3 rounded-lg font-bold shadow-sm flex items-center gap-2 transition-colors ${activeSubTab === 'invoices' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}><FileText className="w-5 h-5" /> أرشيف الفواتير</button>
            <button onClick={() => setActiveSubTab('shipping')} className={`px-6 py-3 rounded-lg font-bold shadow-sm flex items-center gap-2 transition-colors ${activeSubTab === 'shipping' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}><Truck className="w-5 h-5" /> سجلات أوامر النقل</button>
            <button onClick={() => setActiveSubTab('letters')} className={`px-6 py-3 rounded-lg font-bold shadow-sm flex items-center gap-2 transition-colors ${activeSubTab === 'letters' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}><Mail className="w-5 h-5" /> الرسائل والمخاطبات</button>
          </div>

          {activeSubTab === 'invoices' && hasPermission('invoices', 'create') && (
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => handleCreateInvoice('مبدئية')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-bold shadow-sm flex items-center gap-2 text-xs sm:text-sm transition-all hover:shadow hover:-translate-y-0.5 active:translate-y-0"
                title="إنشاء فاتورة مبدئية جديدة"
              >
                <Plus className="w-4 h-4" />
                <span>إنشاء فاتورة مبدئية</span>
              </button>

              <button
                type="button"
                onClick={() => handleCreateInvoice('نهائية')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-bold shadow-sm flex items-center gap-2 text-xs sm:text-sm transition-all hover:shadow hover:-translate-y-0.5 active:translate-y-0"
                title="إنشاء فاتورة نهائية جديدة"
              >
                <Plus className="w-4 h-4" />
                <span>إنشاء فاتورة نهائية</span>
              </button>
            </div>
          )}

          {activeSubTab === 'shipping' && hasPermission('invoices', 'create') && (
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleCreateShippingOrder}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-bold shadow-sm flex items-center gap-2 text-xs sm:text-sm transition-all hover:shadow hover:-translate-y-0.5 active:translate-y-0"
                title="إنشاء أمر نقل جديد"
              >
                <Plus className="w-4 h-4" />
                <Truck className="w-4 h-4" />
                <span>إنشاء أمر نقل</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-4 mb-6 bg-white p-3 rounded-lg border border-slate-200 shadow-sm items-center">
          {activeSubTab !== 'letters' && <div className="flex bg-slate-100 p-1 rounded-lg">
            <button onClick={() => setViewMode('table')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`} title="عرض كجدول"><List className="w-4 h-4" /></button>
            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`} title="عرض كبطاقات"><Grid className="w-4 h-4" /></button>
          </div>}
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute right-3 top-2.5 text-slate-400 w-5 h-5" />
            <input type="text" placeholder="بحث بالمرجع، العميل، السائق، الفني، التخصص، الوجهة أو الموضوع..." className="w-full pl-4 pr-10 py-2 bg-slate-50 border border-slate-200 rounded outline-none focus:border-blue-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>

          {activeSubTab === 'general' && (
            <select
              className="border border-slate-200 rounded p-2 bg-slate-50 outline-none w-52 shrink-0 font-medium text-slate-700 text-sm"
              value={generalCategoryFilter}
              onChange={e => setGeneralCategoryFilter(e.target.value)}
            >
              <option value="الكل">جميع السجلات (الكل)</option>
              <option value="invoices">فواتير المبيعات</option>
              <option value="tech_invoices">فواتير الإنتاجية للفنيين</option>
              <option value="shipping">أوامر النقل والتسليم</option>
              <option value="letters">الرسائل والمخاطبات</option>
            </select>
          )}

          {activeSubTab === 'invoices' && (
            <>
              <select className="border border-slate-200 rounded p-2 bg-slate-50 outline-none w-48 shrink-0 font-medium text-sm" value={filterType} onChange={e => { setFilterType(e.target.value); setFilterSpecialty('الكل'); setFilterTechnician('الكل'); }}>
                <option value="الكل">جميع الفواتير</option>
                <option value="مبدئية">مبدئية</option>
                <option value="نهائية">نهائية</option>
                <option value="إنتاجية">إنتاجية (فنيين)</option>
                <option value="محذوفة">سجل المحذوفات</option>
              </select>

              {filterType === 'إنتاجية' && (
                <>
                  <select
                    className="border border-amber-200 rounded p-2 bg-amber-50/60 outline-none w-44 shrink-0 text-slate-700 font-medium text-sm"
                    value={filterSpecialty}
                    onChange={e => setFilterSpecialty(e.target.value)}
                  >
                    <option value="الكل">جميع التخصصات</option>
                    {availableSpecialties.map(spec => (
                      <option key={spec} value={spec}>{spec}</option>
                    ))}
                  </select>

                  <select
                    className="border border-amber-200 rounded p-2 bg-amber-50/60 outline-none w-44 shrink-0 text-slate-700 font-medium text-sm"
                    value={filterTechnician}
                    onChange={e => setFilterTechnician(e.target.value)}
                  >
                    <option value="الكل">جميع الفنيين</option>
                    {availableTechnicians.map(tech => (
                      <option key={tech} value={tech}>{tech}</option>
                    ))}
                  </select>
                </>
              )}
            </>
          )}

          {(searchTerm || filterType !== 'الكل' || filterSpecialty !== 'الكل' || filterTechnician !== 'الكل' || generalCategoryFilter !== 'الكل') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterType('الكل');
                setFilterSpecialty('الكل');
                setFilterTechnician('الكل');
                setGeneralCategoryFilter('الكل');
                setSortConfig({ key: 'date', direction: 'desc' });
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-2 font-bold transition-colors shrink-0"
              title="تفريغ التصفية والترتيب"
            >
              <FilterX className="w-4 h-4" /> تصفية البحث
            </button>
          )}
        </div>

        {activeSubTab === 'general' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {viewMode === 'table' ? (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="p-4 cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('id')}>الرقم الإشاري {getSortIcon('id')}</th>
                      <th className="p-4 text-center cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('date')}>التاريخ {getSortIcon('date')}</th>
                      <th className="p-4 cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('customerName')}>العميل / الجهة {getSortIcon('customerName')}</th>
                      <th className="p-4 cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('subject')}>الموضوع {getSortIcon('subject')}</th>
                      <th className="p-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedGeneral.map((record, idx) => (
                      <tr key={`general-${record.id}-${idx}`} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-4 font-mono font-bold text-slate-800 break-words whitespace-normal leading-relaxed max-w-xs md:max-w-sm lg:max-w-md">{record.id}</td>
                        <td className="p-4 text-center whitespace-nowrap">{new Date(record.date).toLocaleDateString('ar-LY')}</td>
                        <td className="p-4 font-bold">{record.customerName}</td>
                        <td className="p-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                             record.sourceType === 'tech_invoice' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                             record.sourceType === 'invoice' ? 'bg-indigo-100 text-indigo-700' :
                             record.sourceType === 'shipping' ? 'bg-emerald-100 text-emerald-700' :
                             'bg-blue-100 text-blue-700'
                          }`}>{record.subject}</span>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex gap-2 justify-center">
                            <button onClick={() => {
                               if (record.sourceType === 'invoice' || record.sourceType === 'tech_invoice') setPrintData({ type: 'INVOICE', data: record.original });
                               if (record.sourceType === 'shipping') handlePrintShippingOrder(record.original);
                               if (record.sourceType === 'letter') setPrintData({ type: 'LETTER', data: record.original });
                            }} className="text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 p-2 rounded flex items-center gap-1 font-bold text-xs"><Printer className="w-4 h-4" /> طباعة</button>
                            {hasPermission('invoices', 'edit') && record.sourceType === 'shipping' && (
                              <button onClick={() => openEditShippingOrder(record.original)} className="text-slate-600 hover:text-orange-600 bg-slate-100 hover:bg-orange-50 p-2 rounded flex items-center gap-1 font-bold text-xs" title="تعديل أمر النقل"><FileEdit className="w-4 h-4" /></button>
                            )}
                            {hasPermission('invoices', 'edit') && (record.sourceType === 'invoice' || record.sourceType === 'tech_invoice') && (
                              <button onClick={() => { setEditingInvoice(record.original); setViewState('edit_invoice'); window.scrollTo(0,0); }} className="text-slate-600 hover:text-orange-600 bg-slate-100 hover:bg-orange-50 p-2 rounded flex items-center gap-1 font-bold text-xs" title="تعديل الفاتورة"><FileEdit className="w-4 h-4" /></button>
                            )}
                            {hasPermission('invoices', 'delete') && (
                              <button onClick={() => {
                                 if (record.sourceType === 'invoice' || record.sourceType === 'tech_invoice') deleteInvoice(record.original);
                                 if (record.sourceType === 'shipping') deleteShippingOrder(record.original);
                                 if (record.sourceType === 'letter') {
                                   if (window.confirm('هل أنت متأكد من حذف هذه الرسالة؟')) {
                                     setLetters(letters.filter(l => l.id !== record.original.id));
                                   }
                                 }
                              }} className="text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 className="w-4 h-4" /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {paginatedGeneral.length === 0 && (
                      <tr><td colSpan={5} className="p-8 text-center text-slate-400">لا توجد سجلات مطابقة.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 bg-slate-50/50">
                {paginatedGeneral.length === 0 ? (
                  <div className="col-span-full p-10 text-center text-slate-400">لا توجد سجلات.</div>
                ) : (
                  paginatedGeneral.map((record, idx) => (
                    <div key={`general-card-${record.id}-${idx}`} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 transition-shadow hover:shadow-md flex flex-col">
                      <div className="flex justify-between items-start mb-3 border-b border-slate-100 pb-3">
                        <div>
                          <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded inline-block mb-2 break-words whitespace-normal max-w-full leading-relaxed">{record.id}</span>
                          <div className="text-xs text-slate-500 flex items-center gap-1 font-bold">{new Date(record.date).toLocaleDateString('ar-LY')}</div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                           record.sourceType === 'tech_invoice' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                           record.sourceType === 'invoice' ? 'bg-indigo-100 text-indigo-700' :
                           record.sourceType === 'shipping' ? 'bg-emerald-100 text-emerald-700' :
                           'bg-blue-100 text-blue-700'
                        }`}>{record.subject}</span>
                      </div>
                      <div className="flex-1 mb-4">
                        <div className="text-xs uppercase font-bold text-slate-400 mb-1">العميل / الجهة</div>
                        <div className="font-black text-slate-800">{record.customerName}</div>
                      </div>
                      <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                        <button onClick={() => {
                           if (record.sourceType === 'invoice' || record.sourceType === 'tech_invoice') setPrintData({ type: 'INVOICE', data: record.original });
                           if (record.sourceType === 'shipping') handlePrintShippingOrder(record.original);
                           if (record.sourceType === 'letter') setPrintData({ type: 'LETTER', data: record.original });
                        }} className="text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 p-2 rounded flex items-center gap-1 font-bold text-xs"><Printer className="w-4 h-4" /> طباعة</button>
                        {hasPermission('invoices', 'edit') && record.sourceType === 'shipping' && (
                          <button onClick={() => openEditShippingOrder(record.original)} className="text-slate-600 hover:text-orange-600 bg-slate-100 hover:bg-orange-50 p-2 rounded flex items-center gap-1 font-bold text-xs"><FileEdit className="w-4 h-4" /> تعديل</button>
                        )}
                        {hasPermission('invoices', 'edit') && (record.sourceType === 'invoice' || record.sourceType === 'tech_invoice') && (
                          <button onClick={() => { setEditingInvoice(record.original); setViewState('edit_invoice'); window.scrollTo(0,0); }} className="text-slate-600 hover:text-orange-600 bg-slate-100 hover:bg-orange-50 p-2 rounded flex items-center gap-1 font-bold text-xs"><FileEdit className="w-4 h-4" /> تعديل</button>
                        )}
                        {hasPermission('invoices', 'delete') && (
                          <button onClick={() => {
                             if (record.sourceType === 'invoice' || record.sourceType === 'tech_invoice') deleteInvoice(record.original);
                             if (record.sourceType === 'shipping') deleteShippingOrder(record.original);
                             if (record.sourceType === 'letter') {
                               if (window.confirm('هل أنت متأكد من حذف هذه الرسالة؟')) {
                                 setLetters(letters.filter(l => l.id !== record.original.id));
                               }
                             }
                          }} className="text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 p-2 rounded font-bold text-xs"><Trash2 className="w-4 h-4" /></button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            
            {filteredGeneral.length > 0 && (
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-4">
                  <button onClick={() => setExportModalTarget('general')} className="flex items-center gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-4 py-2 rounded-lg font-bold transition-colors">
                    <Download className="w-4 h-4" /> تصدير Excel
                  </button>
                  <span className="text-sm text-slate-500 font-medium">
                    عرض {(currentPage - 1) * rowsPerPage + 1} إلى {Math.min(currentPage * rowsPerPage, filteredGeneral.length)} من {filteredGeneral.length} سجل
                  </span>
                </div>
                {totalGeneralPages > 1 && (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                    >
                      السابق
                    </button>
                    <div className="flex gap-1 items-center px-4 font-mono text-sm text-slate-600 font-bold bg-white border border-slate-200 rounded">
                      {currentPage} / {totalGeneralPages}
                    </div>
                    <button 
                      onClick={() => setCurrentPage(p => Math.min(totalGeneralPages, p + 1))} 
                      disabled={currentPage === totalGeneralPages}
                      className="px-3 py-1.5 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                    >
                      التالي
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeSubTab === 'invoices' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {viewMode === 'table' ? (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="p-4 w-64 whitespace-nowrap cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('id')}>الرقم الإشاري {getSortIcon('id')}</th>
                      <th className="p-4 text-center cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('type')}>النوع {getSortIcon('type')}</th>
                      <th className="p-4 cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('customerName')}>{filterType === 'إنتاجية' ? 'الفني' : 'الزبون / الفني'} {getSortIcon('customerName')}</th>
                      <th className="p-4 text-center w-32 whitespace-nowrap cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('date')}>التاريخ {getSortIcon('date')}</th>
                      <th className="p-4 text-center cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('netTotal')}>المبلغ {getSortIcon('netTotal')}</th>
                      <th className="p-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedInvoices.map((inv, idx) => (
                      <tr key={`inv-${inv.id}-${idx}`} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-4 font-mono font-bold text-slate-700 break-words whitespace-normal leading-relaxed max-w-xs md:max-w-sm lg:max-w-md">{inv.id}</td>
                        <td className="p-4 text-center">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            inv.type === 'نهائية' ? 'bg-indigo-100 text-indigo-700' :
                            inv.type === 'إنتاجية' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {inv.type === 'إنتاجية' ? 'إنتاجية فنيين' : inv.type}
                          </span>
                        </td>
                        <td className="p-4 font-semibold text-slate-800">
                          <div>{inv.customerName}</div>
                          {inv.type === 'إنتاجية' && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {Array.isArray(inv.items) && Array.from(new Set(inv.items.map((it: any) => it.specialty).filter(Boolean))).map((spec: any, sIdx: number) => (
                                <span key={sIdx} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                  {spec}
                                </span>
                              ))}
                              {inv.items?.length > 0 && (
                                <span className="text-[10px] text-slate-400 font-medium self-center">
                                  ({inv.items.length} {inv.items.length === 1 ? 'منتج' : 'منتجات'})
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-center text-slate-500 whitespace-nowrap">{new Date(inv.date).toLocaleDateString('ar-LY')}</td>
                        <td className="p-4 text-center font-bold text-blue-600 dir-ltr">{formatCurrency(inv.netTotal)}</td>
                        <td className="p-4 text-center">
                          {filterType === 'محذوفة' ? (
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-xs text-red-500 font-bold bg-red-50 px-2 py-1 rounded">حُذفت في: {inv.deletedAt ? new Date(inv.deletedAt).toLocaleDateString('ar-LY') : 'غير معروف'}</span>
                            </div>
                          ) : (
                            <div className="flex gap-2 justify-center">
                              {hasPermission('invoices', 'print') && <button onClick={() => setPrintData({ type: 'INVOICE', data: inv })} className="text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 p-2 rounded" title="طباعة"><Printer className="w-4 h-4" /></button>}
                              {hasPermission('invoices', 'edit') && (
                                <button onClick={() => { setEditingInvoice(inv); setViewState('edit_invoice'); window.scrollTo(0,0); }} className="text-slate-600 hover:text-orange-600 bg-slate-100 hover:bg-orange-50 p-2 rounded" title="تعديل"><FileEdit className="w-4 h-4" /></button>
                              )}
                              {hasPermission('invoices', 'delete') && (
                                <button onClick={() => deleteInvoice(inv)} className="text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 p-2 rounded" title="إلغاء وحذف الفاتورة"><Trash2 className="w-4 h-4" /></button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {paginatedInvoices.length === 0 && (
                      <tr><td colSpan={6} className="p-8 text-center text-slate-400">لا توجد فواتير مطابقة.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 bg-slate-50/50">
                {paginatedInvoices.length === 0 ? (
                  <div className="col-span-full p-10 text-center text-slate-400">لا توجد فواتير مطابقة.</div>
                ) : (
                  paginatedInvoices.map(inv => {
                    const isDeleted = filterType === 'محذوفة';
                    return (
                      <div key={`inv-card-${inv.id}`} className={`bg-white p-4 rounded-xl shadow-sm border transition-shadow hover:shadow-md flex flex-col ${isDeleted ? 'border-red-200 bg-red-50/10' : 'border-slate-200'}`}>
                        <div className="flex justify-between items-start mb-3 border-b border-slate-100 pb-3">
                          <div>
                            <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded inline-block mb-2 break-words whitespace-normal max-w-full leading-relaxed">{inv.id}</span>
                            <div className="text-xs text-slate-500 flex items-center gap-1 font-bold">{new Date(inv.date).toLocaleDateString('ar-LY')}</div>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            inv.type === 'نهائية' ? 'bg-indigo-100 text-indigo-700' :
                            inv.type === 'إنتاجية' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {inv.type === 'إنتاجية' ? 'إنتاجية فنيين' : inv.type}
                          </span>
                        </div>
                        <div className="flex-1 mb-4">
                          <div className="text-xs uppercase font-bold text-slate-400 mb-1">{inv.type === 'إنتاجية' ? 'الفني' : 'العميل'}</div>
                          <div className="font-black text-slate-800 text-base">{inv.customerName}</div>
                          {inv.type === 'إنتاجية' && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {Array.isArray(inv.items) && Array.from(new Set(inv.items.map((it: any) => it.specialty).filter(Boolean))).map((spec: any, sIdx: number) => (
                                <span key={sIdx} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                  {spec}
                                </span>
                              ))}
                              {inv.items?.length > 0 && (
                                <span className="text-[10px] text-slate-400 font-medium self-center">
                                  ({inv.items.length} {inv.items.length === 1 ? 'منتج' : 'منتجات'})
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded-lg mb-4 text-center">
                          <div>
                            <div className="text-[10px] uppercase font-bold text-slate-400">الإجمالي</div>
                            <div className="font-bold text-emerald-600 text-sm" dir="ltr">{formatCurrency(inv.netTotal)}</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase font-bold text-slate-400">المتبقي</div>
                            <div className="font-bold text-red-600 text-sm" dir="ltr">{formatCurrency(inv.remainingAmount)}</div>
                          </div>
                        </div>
                        <div className="flex justify-between gap-2 border-t border-slate-100 pt-3">
                          <div className="flex gap-1">
                            {hasPermission('invoices', 'print') && <button onClick={() => setPrintData({ type: 'INVOICE', data: inv })} className="text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 p-2 rounded" title="طباعة"><Printer className="w-4 h-4" /></button>}
                            {(!isDeleted && hasPermission('invoices', 'delete')) && <button onClick={() => deleteInvoice(inv)} className="text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 p-2 rounded" title="إلغاء الفاتورة"><Trash2 className="w-4 h-4" /></button>}
                          </div>
                          {!isDeleted && (
                            <button onClick={() => { setEditingInvoice(inv); setViewState('edit_invoice'); window.scrollTo(0,0); }} className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded font-bold text-xs flex items-center gap-1">
                              تعديل / عرض التفاصيل
                            </button>
                          )}
                          {isDeleted && inv.deletedAt && (
                            <div className="text-xs text-red-500 font-bold self-center">حُذفت في: {new Date(inv.deletedAt).toLocaleDateString('ar-LY')}</div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
            
            {filteredInvoices.length > 0 && (
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-4">
                  <button onClick={() => setExportModalTarget('invoices')} className="flex items-center gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-4 py-2 rounded-lg font-bold transition-colors">
                    <Download className="w-4 h-4" /> تصدير Excel
                  </button>
                  <span className="text-sm text-slate-500 font-medium">
                    عرض {(currentPage - 1) * rowsPerPage + 1} إلى {Math.min(currentPage * rowsPerPage, filteredInvoices.length)} من {filteredInvoices.length} فاتورة
                  </span>
                </div>
                {totalInvoicesPages > 1 && (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                    >
                      السابق
                    </button>
                    <div className="flex gap-1 items-center px-4 font-mono text-sm text-slate-600 font-bold bg-white border border-slate-200 rounded">
                      {currentPage} / {totalInvoicesPages}
                    </div>
                    <button 
                      onClick={() => setCurrentPage(p => Math.min(totalInvoicesPages, p + 1))} 
                      disabled={currentPage === totalInvoicesPages}
                      className="px-3 py-1.5 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                    >
                      التالي
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeSubTab === 'shipping' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {viewMode === 'table' ? (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="p-4 w-64 whitespace-nowrap cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('id')}>رقم أمر النقل {getSortIcon('id')}</th>
                      <th className="p-4 text-center cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('date')}>التاريخ {getSortIcon('date')}</th>
                      <th className="p-4 cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('driverName')}>السائق / الناقل {getSortIcon('driverName')}</th>
                      <th className="p-4 cursor-pointer group select-none hover:bg-slate-100 transition-colors" onClick={() => handleSort('destination')}>الوجهة {getSortIcon('destination')}</th>
                      <th className="p-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedShipping.map((so, idx) => (
                      <tr key={`so-${so.id}-${idx}`} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-4 font-mono font-bold text-slate-700 break-words whitespace-normal leading-relaxed max-w-xs md:max-w-sm lg:max-w-md">{so.id}</td>
                        <td className="p-4 text-center text-slate-500 whitespace-nowrap">{new Date(so.date).toLocaleDateString('ar-LY')}</td>
                        <td className="p-4 font-semibold text-slate-800">{so.driver?.name || so.driverName || '--'}</td>
                        <td className="p-4 text-slate-600">
                          <div>{so.destination}</div>
                          {so.attachments && so.attachments.length > 0 && (
                            <button 
                              type="button"
                              onClick={() => openGallery(so.attachments, 0, `مرفقات أمر النقل ${so.id}`)}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded mt-1 transition-colors"
                              title="عرض والتنقل بين الصور المرفقة"
                            >
                              <ImageIcon className="w-3.5 h-3.5" />
                              <span>{so.attachments.length} {so.attachments.length === 1 ? 'صورة' : 'صور'}</span>
                            </button>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex gap-2 justify-center">
                            {hasPermission('invoices', 'print') && <button onClick={() => handlePrintShippingOrder(so)} className="text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 p-2 rounded" title="طباعة"><Printer className="w-4 h-4" /></button>}
                            {hasPermission('invoices', 'edit') && <button onClick={() => openEditShippingOrder(so)} className="text-slate-600 hover:text-orange-600 bg-slate-100 hover:bg-orange-50 p-2 rounded" title="تعديل"><FileEdit className="w-4 h-4" /></button>}
                            {hasPermission('invoices', 'delete') && (
                              <button onClick={() => deleteShippingOrder(so)} className="text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 p-2 rounded" title="حذف أمر النقل"><Trash2 className="w-4 h-4" /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {paginatedShipping.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <span>لا توجد سجلات نقل مطابقة.</span>
                            {hasPermission('invoices', 'create') && (
                              <button
                                type="button"
                                onClick={handleCreateShippingOrder}
                                className="mt-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1.5 transition-colors shadow-sm"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>إنشاء أمر نقل جديد</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 bg-slate-50/50">
                {paginatedShipping.length === 0 ? (
                  <div className="col-span-full p-10 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                    <span>لا توجد سجلات نقل مطابقة.</span>
                    {hasPermission('invoices', 'create') && (
                      <button
                        type="button"
                        onClick={handleCreateShippingOrder}
                        className="mt-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1.5 transition-colors shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>إنشاء أمر نقل جديد</span>
                      </button>
                    )}
                  </div>
                ) : (
                  paginatedShipping.map(so => (
                    <div key={`so-card-${so.id}`} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 transition-shadow hover:shadow-md flex flex-col">
                      <div className="flex justify-between items-start mb-3 border-b border-slate-100 pb-3">
                        <div>
                          <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded inline-block mb-2 break-words whitespace-normal max-w-full leading-relaxed">{so.id}</span>
                          <div className="text-xs text-slate-500 flex items-center gap-1 font-bold">{new Date(so.date).toLocaleDateString('ar-LY')}</div>
                        </div>
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">أمر نقل</span>
                      </div>
                      <div className="flex-1 mb-4">
                        <div className="text-xs uppercase font-bold text-slate-400 mb-1">الناقل / السائق</div>
                        <div className="font-black text-slate-800 text-base mb-3">{so.driver?.name || so.driverName || '--'}</div>
                        <div className="text-xs uppercase font-bold text-slate-400 mb-1">الوجهة</div>
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-slate-700 text-sm">{so.destination}</span>
                          {so.attachments && so.attachments.length > 0 && (
                            <button 
                              type="button"
                              onClick={() => openGallery(so.attachments, 0, `مرفقات أمر النقل ${so.id}`)}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded transition-colors"
                              title="عرض والتنقل بين الصور المرفقة"
                            >
                              <ImageIcon className="w-3.5 h-3.5" />
                              <span>{so.attachments.length} {so.attachments.length === 1 ? 'صورة' : 'صور'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                        {hasPermission('invoices', 'print') && <button onClick={() => handlePrintShippingOrder(so)} className="text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 p-2 rounded flex items-center gap-1 font-bold text-xs"><Printer className="w-4 h-4" /> طباعة</button>}
                        {hasPermission('invoices', 'edit') && <button onClick={() => openEditShippingOrder(so)} className="text-slate-600 hover:text-orange-600 bg-slate-100 hover:bg-orange-50 p-2 rounded flex items-center gap-1 font-bold text-xs"><FileEdit className="w-4 h-4" /> تعديل</button>}
                        {hasPermission('invoices', 'delete') && (
                          <button onClick={() => deleteShippingOrder(so)} className="text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 p-2 rounded font-bold text-xs" title="حذف أمر النقل"><Trash2 className="w-4 h-4" /></button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            
            {filteredShipping.length > 0 && (
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-4">
                  <button onClick={() => setExportModalTarget('shipping')} className="flex items-center gap-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-4 py-2 rounded-lg font-bold transition-colors">
                    <Download className="w-4 h-4" /> تصدير Excel
                  </button>
                  <span className="text-sm text-slate-500 font-medium">
                    عرض {(currentPage - 1) * rowsPerPage + 1} إلى {Math.min(currentPage * rowsPerPage, filteredShipping.length)} من {filteredShipping.length} أمر نقل
                  </span>
                </div>
                {totalShippingPages > 1 && (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                    >
                      السابق
                    </button>
                    <div className="flex gap-1 items-center px-4 font-mono text-sm text-slate-600 font-bold bg-white border border-slate-200 rounded">
                      {currentPage} / {totalShippingPages}
                    </div>
                    <button 
                      onClick={() => setCurrentPage(p => Math.min(totalShippingPages, p + 1))} 
                      disabled={currentPage === totalShippingPages}
                      className="px-3 py-1.5 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                    >
                      التالي
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeSubTab === 'letters' && (
          <LettersView searchTerm={searchTerm} />
        )}

        {editingShippingOrder && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[92vh] overflow-hidden flex flex-col border border-slate-200">
              {/* Modal Header */}
              <div className="p-4 sm:px-6 border-b border-slate-200 flex justify-between items-center bg-slate-50/80 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      {editingShippingOrder._isNew ? 'إنشاء أمر نقل جديد وإيصال استلام' : 'تعديل أمر النقل'}
                      <span className="font-mono text-sm bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-600">
                        {formatShippingOrderId(editingShippingOrder.id, editingShippingOrder.customerName, editingShippingOrder.date) || editingShippingOrder.id}
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {editingShippingOrder._isNew ? 'تحديد بيانات السائق، الوجهة، وتحميل المنتجات المنقولة' : 'تعديل بيانات السائق، الوجهة، ومحتويات أو قائمة المنتجات المنقولة'}
                    </p>
                  </div>
                </div>
                <button onClick={() => setEditingShippingOrder(null)} className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-500 hover:text-slate-800">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 sm:p-6 space-y-6 text-right overflow-y-auto flex-1">
                {/* Order Mode Switch: Factory Products (Standard) vs Custom Transport Order */}
                <div className="bg-gradient-to-r from-slate-100 to-indigo-50/60 p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700 shrink-0">نوع أمر النقل:</span>
                    <div className="inline-flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                      <button
                        type="button"
                        onClick={() => {
                          if (editingShippingOrder.items?.length > 0 && editingShippingOrder._isCustomOrder) {
                            if (!window.confirm('التحويل إلى وضع منتجات المصنع سيتطلب أن تكون المنتجات مباعة بالمصنع. هل تريد المتابعة؟')) return;
                          }
                          setEditingShippingOrder({ ...editingShippingOrder, _isCustomOrder: false });
                          setShowAddProducts(true);
                        }}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                          !editingShippingOrder._isCustomOrder 
                            ? 'bg-emerald-600 text-white shadow-sm' 
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>منتجات المصنع المباعة (افتراضي)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (hasFactoryProductsInOrder) {
                            const confirmed = window.confirm(
                              `⚠️ تنبيه أمني:\nأمر النقل يحتوي حالياً على منتجات مباعة من المصنع للعميل (${editingShippingOrder.customerName}).\n\nلا يمكن تحويل أمر النقل إلى "مخصص" مع الاحتفاظ بمنتجات المصنع المباعة لمنع تغيير اسم المشتري.\n\nهل ترغب في تفريغ منتجات المصنع من هذا الأمر والتحويل إلى أمر نقل مخصص؟`
                            );
                            if (confirmed) {
                              const newId = formatShippingOrderId(editingShippingOrder.id, '', editingShippingOrder.date);
                              setEditingShippingOrder({
                                ...editingShippingOrder,
                                id: newId,
                                _isCustomOrder: true,
                                customerName: '',
                                items: [{
                                  serialNumber: `SN-${Date.now().toString().slice(-6)}`,
                                  desc: '',
                                  chassis: '',
                                  length: '',
                                  width: '',
                                  height: '',
                                  contents: '',
                                  customerName: ''
                                }]
                              });
                              setShowAddProducts(false);
                            }
                            return;
                          }
                          const currentItems = editingShippingOrder.items || [];
                          setEditingShippingOrder({ 
                            ...editingShippingOrder, 
                            _isCustomOrder: true,
                            items: currentItems.length === 0 ? [{
                              serialNumber: `SN-${Date.now().toString().slice(-6)}`,
                              desc: '',
                              chassis: '',
                              length: '',
                              width: '',
                              height: '',
                              contents: '',
                              customerName: editingShippingOrder.customerName || ''
                            }] : currentItems
                          });
                          setShowAddProducts(false);
                        }}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                          editingShippingOrder._isCustomOrder 
                            ? 'bg-blue-600 text-white shadow-sm' 
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Package className="w-3.5 h-3.5" />
                        <span>أمر نقل مخصص / يدوي</span>
                      </button>
                    </div>
                  </div>
                  <div className="text-[11px] font-semibold text-slate-500">
                    {!editingShippingOrder._isCustomOrder ? (
                      <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        🔒 اسم العميل مقفل ومحدد تلقائياً من بيانات بيع المنتج
                      </span>
                    ) : (
                      <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        ✏️ أمر مخصص: يمكنك تحديد اسم العميل وتعديل الجدول مباشرة
                      </span>
                    )}
                  </div>
                </div>

                {/* Basic Info Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="relative z-30">
                    <label className="block text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Truck className="w-4 h-4 text-emerald-600" /> الناقل / السائق *
                    </label>
                    <DriverSelect 
                      value={editingShippingOrder.driver?.id || editingShippingOrder.driverId} 
                      onChange={(id) => {
                         const driver = drivers.find(d => d.id === id);
                         setEditingShippingOrder({
                           ...editingShippingOrder,
                           driver,
                           driverName: driver?.name,
                           driverId: id
                         });
                      }} 
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-blue-600" /> الوجهة *
                    </label>
                    <input 
                      type="text" 
                      value={editingShippingOrder.destination || ''} 
                      onChange={e => setEditingShippingOrder({...editingShippingOrder, destination: e.target.value})} 
                      placeholder="مثال: طرابلس - طريق الشط"
                      className="w-full p-2.5 border border-slate-300 rounded-lg bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-sm font-semibold" 
                    />
                  </div>

                  <div className="relative" ref={shippingCustomerDropdownRef}>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <User className="w-4 h-4 text-blue-600" />
                        الزبون / العميل *
                      </span>
                      {(!editingShippingOrder._isCustomOrder || hasFactoryProductsInOrder) ? (
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                          🔒 مقفل ومحدد بالمنتج المباع
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setNewShippingCustomerForm({ name: (editingShippingOrder.customerName || '').trim(), phone: '', notes: '' });
                              setNewShippingCustomerModalOpen(true);
                              setShippingCustomerDropdownOpen(false);
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 transition-colors"
                            title="إضافة عميل جديد وتعبئة بياناته بالسجل"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>+ إضافة زبون جديد</span>
                          </button>
                          <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                            ✏️ أمر مخصص
                          </span>
                        </div>
                      )}
                    </label>

                    <div className="relative">
                      <input 
                        type="text" 
                        disabled={!editingShippingOrder._isCustomOrder || hasFactoryProductsInOrder}
                        readOnly={!editingShippingOrder._isCustomOrder || hasFactoryProductsInOrder}
                        value={editingShippingOrder.customerName || ''} 
                        onChange={e => {
                          const val = e.target.value;
                          const newId = formatShippingOrderId(editingShippingOrder.id, val, editingShippingOrder.date);
                          setEditingShippingOrder({
                            ...editingShippingOrder,
                            id: newId,
                            customerName: val,
                            items: (editingShippingOrder.items || []).map((it: any) => ({ ...it, customerName: val }))
                          });
                          setShippingCustomerDropdownOpen(true);
                        }} 
                        onFocus={() => {
                          if (editingShippingOrder._isCustomOrder && !hasFactoryProductsInOrder) {
                            setShippingCustomerDropdownOpen(true);
                          }
                        }}
                        placeholder={
                          (!editingShippingOrder._isCustomOrder || hasFactoryProductsInOrder) 
                            ? (editingShippingOrder.customerName || 'يحدد تلقائياً فور اختيار المنتج المباع...') 
                            : 'ابحث أو اختر أو اكتب اسم العميل...'
                        }
                        className={`w-full p-2.5 pl-14 border rounded-lg outline-none text-sm font-semibold transition-all ${
                          (!editingShippingOrder._isCustomOrder || hasFactoryProductsInOrder)
                            ? 'bg-slate-100 text-slate-800 border-slate-300 cursor-not-allowed select-none'
                            : 'bg-white text-slate-800 border-blue-400 focus:ring-2 focus:ring-blue-100'
                        }`} 
                      />

                      {/* Status indicator / Clear button */}
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-slate-400">
                        {editingShippingOrder._isCustomOrder && !hasFactoryProductsInOrder && exactShippingCustomerMatch && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            <Check className="w-3 h-3 text-emerald-600" /> مسجل
                          </span>
                        )}
                        {editingShippingOrder._isCustomOrder && !hasFactoryProductsInOrder && editingShippingOrder.customerName && (
                          <button
                            type="button"
                            onClick={() => {
                              const newId = formatShippingOrderId(editingShippingOrder.id, '', editingShippingOrder.date);
                              setEditingShippingOrder({ 
                                ...editingShippingOrder, 
                                id: newId,
                                customerName: '',
                                items: (editingShippingOrder.items || []).map((it: any) => ({ ...it, customerName: '' }))
                              });
                              setShippingCustomerDropdownOpen(true);
                            }}
                            className="hover:text-slate-600 p-0.5"
                            title="مسح"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {shippingCustomerSuccessMsg && (
                      <div className="mt-1 text-xs font-bold text-emerald-600 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> {shippingCustomerSuccessMsg}
                      </div>
                    )}

                    {(!editingShippingOrder._isCustomOrder || hasFactoryProductsInOrder) ? (
                      <p className="text-[11px] text-slate-500 mt-1">
                        {editingShippingOrder.customerName 
                          ? `الزبون محدد تلقائياً ومقفل بناءً على بيانات بيع المنتج (${editingShippingOrder.customerName}).` 
                          : 'اختر منتجاً مباعاً من القائمة بالأسفل ليتم تحديد وقفل اسم الزبون تلقائياً.'}
                      </p>
                    ) : (
                      <p className="text-[11px] text-blue-600 mt-1">
                        أمر نقل مخصص: يتيح لك اختيار زبون مسجل أو كتابة اسم زبون جديد وإضافته فوراً.
                      </p>
                    )}

                    {/* Customer Autocomplete Dropdown */}
                    {shippingCustomerDropdownOpen && editingShippingOrder._isCustomOrder && !hasFactoryProductsInOrder && (
                      <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
                        {/* Quick Add Option */}
                        {(editingShippingOrder.customerName || '').trim() && !exactShippingCustomerMatch && (
                          <div className="p-2.5 bg-emerald-50 hover:bg-emerald-100/80 border-b border-emerald-200 text-emerald-900 flex items-center justify-between gap-3 transition-colors">
                            <div 
                              className="flex items-center gap-2 flex-1 cursor-pointer"
                              onClick={() => handleQuickAddShippingCustomer((editingShippingOrder.customerName || '').trim())}
                            >
                              <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                                <Plus className="w-4 h-4" />
                              </div>
                              <div className="text-xs sm:text-sm">
                                <span className="font-medium text-emerald-800">إضافة سريعة: </span>
                                <span className="font-black text-emerald-900">"{(editingShippingOrder.customerName || '').trim()}"</span>
                                <span className="text-[11px] text-emerald-700 block font-normal">حفظ مباشرة في قائمة العملاء وتحديده لهذا الأمر</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setNewShippingCustomerForm({ name: (editingShippingOrder.customerName || '').trim(), phone: '', notes: '' });
                                setNewShippingCustomerModalOpen(true);
                                setShippingCustomerDropdownOpen(false);
                              }}
                              className="text-xs font-bold bg-white text-emerald-800 border border-emerald-300 hover:bg-emerald-600 hover:text-white px-3 py-1.5 rounded-lg shadow-2xs transition-all shrink-0 flex items-center gap-1"
                              title="إضافة الزبون مع رقم الهاتف والملاحظات"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              <span>+ تفاصيل</span>
                            </button>
                          </div>
                        )}

                        {/* Customer list */}
                        <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                          {filteredShippingCustomers.length > 0 ? (
                            filteredShippingCustomers.map(c => {
                              const isSelected = (editingShippingOrder.customerName || '').trim().toLowerCase() === (c.name || '').trim().toLowerCase();
                              return (
                                <div
                                  key={c.id}
                                  className={`p-2.5 cursor-pointer hover:bg-blue-50/70 flex items-center justify-between transition-colors ${
                                    isSelected ? 'bg-blue-50/90 text-blue-900 font-bold' : 'text-slate-800'
                                  }`}
                                  onClick={() => handleSelectShippingCustomer(c.name)}
                                >
                                  <div className="flex items-center gap-2.5">
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                                      isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                                    }`}>
                                      <User className="w-3.5 h-3.5" />
                                    </div>
                                    <div>
                                      <div className="text-xs sm:text-sm font-bold flex items-center gap-2">
                                        <span>{c.name}</span>
                                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                                      </div>
                                      {c.notes && <div className="text-[11px] text-slate-400 mt-0.5">{c.notes}</div>}
                                    </div>
                                  </div>
                                  {c.phone && (
                                    <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded dir-ltr">
                                      {c.phone}
                                    </span>
                                  )}
                                </div>
                              );
                            })
                          ) : (
                            <div className="p-4 text-center text-xs text-slate-400">
                              لا يوجد عميل مطابق للبحث. انقر على الإضافة السريعة أعلاه لإضافته كعميل جديد.
                            </div>
                          )}
                        </div>

                        {/* Dropdown footer: Detailed add */}
                        <div className="p-2 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              setNewShippingCustomerForm({ name: (editingShippingOrder.customerName || '').trim(), phone: '', notes: '' });
                              setNewShippingCustomerModalOpen(true);
                              setShippingCustomerDropdownOpen(false);
                            }}
                            className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>إضافة زبون جديد مع بيانات تفصيلية (هاتف، ملاحظات...)</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-slate-500" /> تاريخ أمر النقل
                    </label>
                    <input 
                      type="date" 
                      value={editingShippingOrder.date ? new Date(editingShippingOrder.date).toISOString().split('T')[0] : ''} 
                      onChange={e => {
                        if (!e.target.value) return;
                        setEditingShippingOrder({...editingShippingOrder, date: new Date(e.target.value).toISOString()});
                      }} 
                      className="w-full p-2.5 border border-slate-300 rounded-lg bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-sm" 
                    />
                  </div>

                  {/* Approver / Issuer Section */}
                  <div className="md:col-span-2 bg-white p-3.5 rounded-lg border border-slate-200 space-y-3">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-100 pb-2">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-emerald-600" /> المسؤول عن اعتماد أمر النقل
                      </label>
                      {users && users.length > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-500 font-medium">اختيار من المستخدمين:</span>
                          <select
                            value={editingShippingOrder.issuedBy?.id || ''}
                            onChange={e => {
                              const u = users.find((usr: any) => usr.id === e.target.value);
                              if (u) {
                                setEditingShippingOrder({
                                  ...editingShippingOrder,
                                  issuedBy: {
                                    id: u.id,
                                    name: u.displayName || u.username,
                                    jobTitle: u.jobTitle || 'مسؤول الحركة والتسليم',
                                    signature: u.signature || '',
                                    stamp: u.stamp || ''
                                  }
                                });
                              }
                            }}
                            className="text-xs p-1 border border-slate-300 rounded bg-slate-50 outline-none focus:border-indigo-500 font-semibold text-slate-700"
                          >
                            <option value="">-- اختر المستخدم المعتمد --</option>
                            {users.map((u: any) => (
                              <option key={u.id} value={u.id}>
                                {u.displayName || u.username} ({u.jobTitle || 'بدون صفة'})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <span className="block text-[11px] font-bold text-slate-500 mb-1">اسم المعتمد</span>
                        <input
                          type="text"
                          value={editingShippingOrder.issuedBy?.name || ''}
                          onChange={e => setEditingShippingOrder({
                            ...editingShippingOrder,
                            issuedBy: {
                              ...(editingShippingOrder.issuedBy || {}),
                              name: e.target.value
                            }
                          })}
                          placeholder="اسم المعتمد"
                          className="w-full p-2 border border-slate-200 rounded text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <span className="block text-[11px] font-bold text-slate-500 mb-1">الصفة / المسمى الوظيفي</span>
                        <input
                          type="text"
                          value={editingShippingOrder.issuedBy?.jobTitle || ''}
                          onChange={e => setEditingShippingOrder({
                            ...editingShippingOrder,
                            issuedBy: {
                              ...(editingShippingOrder.issuedBy || {}),
                              jobTitle: e.target.value
                            }
                          })}
                          placeholder="مثال: مسؤول الحركة والتسليم"
                          className="w-full p-2 border border-slate-200 rounded text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px] text-slate-500">
                      <div className="flex items-center gap-3">
                        <span>التوقيع الرقمي: {editingShippingOrder.issuedBy?.signature ? <strong className="text-emerald-600 font-bold">متوفر</strong> : <span className="text-slate-400">غير متوفر</span>}</span>
                        <span>الختم الرسمي: {editingShippingOrder.issuedBy?.stamp ? <strong className="text-blue-600 font-bold">متوفر</strong> : <span className="text-slate-400">غير متوفر</span>}</span>
                      </div>
                      {(editingShippingOrder.issuedBy?.signature || editingShippingOrder.issuedBy?.stamp) && (
                        <div className="flex items-center gap-2">
                          {editingShippingOrder.issuedBy?.signature && (
                            <img src={editingShippingOrder.issuedBy.signature} alt="توقيع" className="h-5 max-w-[60px] object-contain border border-slate-200 rounded bg-white" />
                          )}
                          {editingShippingOrder.issuedBy?.stamp && (
                            <img src={editingShippingOrder.issuedBy.stamp} alt="ختم" className="h-5 max-w-[60px] object-contain border border-slate-200 rounded bg-white" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Products Section */}
                <div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3 border-b border-slate-200 pb-3">
                    <div className="flex items-center gap-2">
                      <Package className="w-5 h-5 text-indigo-600" />
                      <div>
                        <h3 className="font-bold text-slate-800 text-base">جدول المواد والمنتجات المنقولة</h3>
                        <p className="text-xs text-slate-500 font-medium">جدول تفاعلي قابل للإضافة والتعديل المباشر</p>
                      </div>
                      <span className="bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full text-xs">
                        {editingShippingOrder.items?.length || 0}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {!editingShippingOrder._isCustomOrder ? (
                        <button
                          type="button"
                          onClick={() => setShowAddProducts(!showAddProducts)}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm ${
                            showAddProducts 
                              ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' 
                              : 'bg-emerald-600 text-white hover:bg-emerald-700'
                          }`}
                        >
                          {showAddProducts ? (
                            <>
                              <X className="w-3.5 h-3.5" /> إغلاق قائمة منتجات المصنع
                            </>
                          ) : (
                            <>
                              <Truck className="w-3.5 h-3.5" /> اختيار من منتجات المصنع المباعة ({availableFactoryProducts.length})
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleAddNewRow}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          <span>+ إضافة بند جديد للجدول</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Factory Products Selection Drawer (for standard factory mode) */}
                  {!editingShippingOrder._isCustomOrder && showAddProducts && (
                    <div className="mb-4 p-4 rounded-xl border-2 border-emerald-200 bg-emerald-50/40 animate-in fade-in zoom-in-95 duration-150">
                      <div className="flex items-center justify-between mb-3 border-b border-emerald-100 pb-2">
                        <div className="font-bold text-xs text-emerald-900 flex items-center gap-1.5">
                          <Truck className="w-4 h-4 text-emerald-700" />
                          <span>منتجات المصنع الجاهزة والمباعة المتاحة للنقل ({availableFactoryProducts.length})</span>
                        </div>
                        <button
                          onClick={() => setShowAddProducts(false)}
                          className="text-slate-400 hover:text-slate-600 p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <div className="relative flex-1">
                            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                            <input
                              type="text"
                              placeholder="بحث بالرقم التسلسلي (SN)، الوصف، الشاصية، الزبون..."
                              value={productSearch}
                              onChange={e => setProductSearch(e.target.value)}
                              className="w-full pl-3 pr-9 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-emerald-500"
                            />
                          </div>
                          <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-slate-200 rounded-lg text-xs shrink-0 flex-wrap">
                            {editingShippingOrder.customerName ? (
                              <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 flex items-center gap-1.5">
                                <span>الزبون: {editingShippingOrder.customerName}</span>
                                <span className="text-[10px] text-emerald-600 font-normal">(محصور لنفس الزبون تلقائياً)</span>
                              </span>
                            ) : (
                              <span className="text-slate-500 font-medium">
                                جميع المنتجات الجاهزة والمباعة المتاحة ({availableFactoryProducts.length})
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 bg-white border border-slate-200 rounded-xl">
                          {filteredFactoryProducts.length > 0 ? (
                            filteredFactoryProducts.map((p, idx) => (
                              <div key={idx} className="p-3 hover:bg-emerald-50/50 flex items-center justify-between gap-3 transition-colors">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-slate-800 text-sm">{p.desc || p.name}</span>
                                    <span className="font-mono text-xs bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded border border-slate-200">
                                      SN: {p.serialNumber}
                                    </span>
                                    <span className="bg-emerald-100 text-emerald-800 font-bold text-[11px] px-2 py-0.5 rounded-full">جاهز ومباع</span>
                                    {p.invoiceId && (
                                      <span className="bg-indigo-50 text-indigo-700 font-mono text-[10px] px-2 py-0.5 rounded border border-indigo-100 font-bold">
                                        فاتورة نهائية: {p.invoiceId}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-slate-500 mt-1 flex gap-2 flex-wrap items-center">
                                    <span>الزبون: <strong className="text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded font-bold">{p.customerName}</strong></span>
                                    {p.chassis && <span>الشاصية: <strong className="text-slate-700">{p.chassis}</strong></span>}
                                    {(p.length || p.width) && <span>الأبعاد: {p.length}×{p.width}م</span>}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleAddFactoryProduct(p)}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 transition-colors shadow-sm"
                                >
                                  <Plus className="w-3.5 h-3.5" /> إضافة للجدول
                                </button>
                              </div>
                            ))
                          ) : (
                            <div className="p-6 text-center text-xs text-slate-400">
                              {editingShippingOrder.customerName 
                                ? `لا توجد منتجات جاهزة ومباعة أخرى للزبون (${editingShippingOrder.customerName}).`
                                : 'لا توجد منتجات مصنع جاهزة ومباعة متاحة للنقل حالياً.'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* THE EDITABLE TABLE */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full text-right border-collapse">
                        <thead>
                          <tr className="bg-slate-100/90 text-slate-700 text-xs font-bold border-b border-slate-200">
                            <th className="p-2.5 text-center w-10">#</th>
                            <th className="p-2.5 text-right min-w-[220px]">البيان / وصف المنتج *</th>
                            <th className="p-2.5 text-right min-w-[140px]">الرقم التسلسلي (SN)</th>
                            <th className="p-2.5 text-right min-w-[120px]">رقم الشاصية</th>
                            <th className="p-2.5 text-center min-w-[180px]">الأبعاد (طول × عرض × ارتفاع) م</th>
                            <th className="p-2.5 text-right min-w-[180px]">المحتويات / الملاحظات</th>
                            <th className="p-2.5 text-center w-12">حذف</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {(!editingShippingOrder.items || editingShippingOrder.items.length === 0) ? (
                            <tr>
                              <td colSpan={7} className="p-8 text-center bg-slate-50/50">
                                <div className="max-w-xs mx-auto text-center space-y-2">
                                  <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
                                  <div className="font-bold text-slate-700 text-sm">لا توجد بنود في أمر النقل حتى الآن</div>
                                  <p className="text-slate-400 text-xs">
                                    {editingShippingOrder._isCustomOrder 
                                      ? 'انقر على زر "إضافة بند جديد" للبدء في كتابة وتعديل المواد المنقولة في الجدول.'
                                      : 'انقر على زر "اختيار من منتجات المصنع" لإدراج المنتجات المباعة في الجدول.'}
                                  </p>
                                  {editingShippingOrder._isCustomOrder ? (
                                    <button
                                      type="button"
                                      onClick={handleAddNewRow}
                                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors mt-2"
                                    >
                                      <Plus className="w-4 h-4" /> إضافة أول بند للجدول
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setShowAddProducts(true)}
                                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors mt-2"
                                    >
                                      <Truck className="w-4 h-4" /> اختيار منتج من المصنع
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ) : (
                            editingShippingOrder.items.map((item: any, idx: number) => {
                              const isFactoryItem = Boolean(item.workOrderId || workOrders.some(wo => (wo.items || []).some((wi: any) => (wi.serialNumber || wi.sn)?.trim() === (item.serialNumber || item.sn)?.trim())));
                              return (
                                <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                                  <td className="p-2.5 text-center font-mono font-bold text-slate-500 bg-slate-50/50">
                                    {idx + 1}
                                  </td>
                                  <td className="p-2">
                                    <div className="space-y-1">
                                      <input
                                        type="text"
                                        value={item.desc || item.name || ''}
                                        onChange={e => handleItemChange(idx, 'desc', e.target.value)}
                                        placeholder="وصف المنتج أو المادة..."
                                        className="w-full p-2 text-xs border border-slate-200 rounded-md font-bold text-slate-800 bg-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100"
                                      />
                                      {isFactoryItem && (
                                        <div className="flex items-center gap-1 text-[10px] text-emerald-700 font-bold">
                                          <span className="bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">🏭 منتج مصنع مباع</span>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-2">
                                    <input
                                      type="text"
                                      value={item.serialNumber || ''}
                                      onChange={e => handleItemChange(idx, 'serialNumber', e.target.value)}
                                      placeholder="SN-..."
                                      className="w-full p-2 text-xs font-mono border border-slate-200 rounded-md text-slate-700 bg-white outline-none focus:border-indigo-500"
                                    />
                                  </td>
                                  <td className="p-2">
                                    <input
                                      type="text"
                                      value={item.chassis || ''}
                                      onChange={e => handleItemChange(idx, 'chassis', e.target.value)}
                                      placeholder="الشاصية"
                                      className="w-full p-2 text-xs border border-slate-200 rounded-md text-slate-700 bg-white outline-none focus:border-indigo-500"
                                    />
                                  </td>
                                  <td className="p-2">
                                    <div className="flex items-center justify-center gap-1">
                                      <input
                                        type="text"
                                        placeholder="طول"
                                        value={item.length || ''}
                                        onChange={e => handleItemChange(idx, 'length', e.target.value)}
                                        className="w-12 p-1.5 text-center text-xs border border-slate-200 rounded-md bg-white outline-none focus:border-indigo-500"
                                      />
                                      <span className="text-slate-400 font-bold">×</span>
                                      <input
                                        type="text"
                                        placeholder="عرض"
                                        value={item.width || ''}
                                        onChange={e => handleItemChange(idx, 'width', e.target.value)}
                                        className="w-12 p-1.5 text-center text-xs border border-slate-200 rounded-md bg-white outline-none focus:border-indigo-500"
                                      />
                                      <span className="text-slate-400 font-bold">×</span>
                                      <input
                                        type="text"
                                        placeholder="ارتفاع"
                                        value={item.height || ''}
                                        onChange={e => handleItemChange(idx, 'height', e.target.value)}
                                        className="w-12 p-1.5 text-center text-xs border border-slate-200 rounded-md bg-white outline-none focus:border-indigo-500"
                                      />
                                    </div>
                                  </td>
                                  <td className="p-2">
                                    <input
                                      type="text"
                                      value={item.contents || ''}
                                      onChange={e => handleItemChange(idx, 'contents', e.target.value)}
                                      placeholder="المحتويات، المرفقات، ملاحظات..."
                                      className="w-full p-2 text-xs border border-slate-200 rounded-md text-slate-700 bg-white outline-none focus:border-indigo-500"
                                    />
                                  </td>
                                  <td className="p-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteProduct(idx)}
                                      className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                                      title="حذف هذا السطر من الجدول"
                                    >
                                      <Trash2 className="w-4 h-4 mx-auto" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Table Bottom Action Bar */}
                    <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center flex-wrap gap-2">
                      <div className="text-xs text-slate-500 font-medium">
                        إجمالي البنود في الجدول: <strong className="text-slate-800">{editingShippingOrder.items?.length || 0}</strong> بند
                      </div>
                      <div className="flex items-center gap-2">
                        {editingShippingOrder._isCustomOrder ? (
                          <button
                            type="button"
                            onClick={handleAddNewRow}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>+ إضافة سطر جديد للجدول</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowAddProducts(true)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>+ إضافة منتج من المصنع</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Attachments Section */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex justify-between items-center mb-3 border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-5 h-5 text-indigo-600" />
                      <h3 className="font-bold text-slate-800 text-sm">مرفقات وصور أمر النقل</h3>
                      <span className="bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full text-xs">
                        {editingShippingOrder.attachments?.length || 0}
                      </span>
                    </div>
                    <label className="cursor-pointer bg-white text-indigo-700 hover:bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm">
                      <Plus className="w-4 h-4" /> إضافة صور
                      <input type="file" className="hidden" accept="image/*" multiple onChange={handleShippingOrderFileUpload} />
                    </label>
                  </div>

                  {(!editingShippingOrder.attachments || editingShippingOrder.attachments.length === 0) ? (
                    <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 text-xs">
                      لا توجد صور مرفقة بأمر النقل حالياً. يمكنك إرفاق صور للمنتجات المحملة، الشاحنة، أو إيصالات الاستلام.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {editingShippingOrder.attachments.map((att: any, i: number) => (
                        <div key={i} className="group relative border border-slate-200 bg-white rounded-lg p-1.5 overflow-hidden shadow-sm hover:shadow transition-all">
                          <img 
                            src={att.data} 
                            alt={att.name} 
                            onClick={() => openGallery(editingShippingOrder.attachments, i, `مرفقات أمر النقل ${editingShippingOrder.id}`)}
                            className="w-full h-24 object-cover rounded cursor-pointer group-hover:scale-105 transition-transform duration-200" 
                          />
                          <button 
                            type="button"
                            onClick={() => removeShippingOrderAttachment(i)} 
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

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-2 justify-between items-center shrink-0">
                <div className="text-xs text-slate-500 font-medium">
                  {editingShippingOrder.items?.length || 0} منتج محمل في هذا الأمر
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setEditingShippingOrder(null)} 
                    className="px-5 py-2 rounded-lg font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 text-sm transition-colors"
                  >
                    إلغاء
                  </button>
                  <button 
                    disabled={isSavingShipping}
                    onClick={handleSaveShippingOrder} 
                    className="px-5 py-2 rounded-lg font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 disabled:opacity-75 shadow-md flex items-center gap-2 text-sm transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSavingShipping ? 'جاري الحفظ...' : (editingShippingOrder._isNew ? 'حفظ أمر النقل' : 'حفظ التعديلات')}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Add New Customer for Shipping Order */}
        {newShippingCustomerModalOpen && (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">إضافة زبون جديد للسجل</h3>
                    <p className="text-xs text-slate-500">حفظ الزبون في قاعدة البيانات وتحديده لأمر النقل</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setNewShippingCustomerModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveDetailedShippingCustomer} className="p-4 sm:p-6 space-y-4 text-right">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم العميل / الشركة *</label>
                  <input
                    type="text"
                    required
                    value={newShippingCustomerForm.name}
                    onChange={e => setNewShippingCustomerForm({ ...newShippingCustomerForm, name: e.target.value })}
                    placeholder="مثال: شركة النور للمقاولات"
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-bold outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف (اختياري)</label>
                  <input
                    type="tel"
                    value={newShippingCustomerForm.phone}
                    onChange={e => setNewShippingCustomerForm({ ...newShippingCustomerForm, phone: e.target.value })}
                    placeholder="0910000000"
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات أو العنوان (اختياري)</label>
                  <input
                    type="text"
                    value={newShippingCustomerForm.notes}
                    onChange={e => setNewShippingCustomerForm({ ...newShippingCustomerForm, notes: e.target.value })}
                    placeholder="مثال: طرابلس - السراج"
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setNewShippingCustomerModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
                  >
                    <Save className="w-4 h-4" />
                    <span>حفظ وتحديد الزبون</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Shipping Print Prompt Modal (Choose to print attachments or not) */}
        {shippingPrintPrompt && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Printer className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-slate-800 text-base">خيارات طباعة أمر النقل</h3>
                </div>
                <button 
                  onClick={() => setShippingPrintPrompt(null)}
                  className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 text-right space-y-4">
                <div className="flex items-start gap-3 bg-blue-50/70 p-3.5 rounded-xl border border-blue-100">
                  <ImageIcon className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-slate-700 leading-relaxed">
                    يحتوي أمر النقل <span className="font-mono font-bold text-blue-700">({shippingPrintPrompt.id})</span> على <span className="font-bold text-slate-900">{shippingPrintPrompt.attachments.length}</span> {shippingPrintPrompt.attachments.length === 1 ? 'صورة مرفقة' : 'صور مرفقة'}.
                    <p className="mt-1.5 text-slate-500 text-xs font-medium">هل ترغب في طباعة الصور والمرفقات مع أمر النقل أو طباعة أمر النقل فقط؟</p>
                  </div>
                </div>

                <div className="space-y-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPrintData({ type: 'SHIPPING_ORDER', data: shippingPrintPrompt });
                      setShippingPrintPrompt(null);
                    }}
                    className="w-full p-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-between text-sm shadow-md transition-all group"
                  >
                    <span className="flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-blue-200 group-hover:scale-110 transition-transform" /> 
                      طباعة أمر النقل مع الصور المرفقة
                    </span>
                    <span className="text-xs bg-blue-700/80 px-2 py-0.5 rounded-full font-mono font-bold">
                      +{shippingPrintPrompt.attachments.length} صور
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPrintData({ type: 'SHIPPING_ORDER', data: shippingPrintPrompt, excludeAttachments: true });
                      setShippingPrintPrompt(null);
                    }}
                    className="w-full p-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold border border-slate-300 flex items-center justify-between text-sm transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-500" /> 
                      طباعة أمر النقل فقط (بدون صور)
                    </span>
                    <span className="text-xs text-slate-400">النسخ الأساسية فقط</span>
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShippingPrintPrompt(null)}
                  className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-200 text-xs font-bold transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lightbox Gallery Modal with Next/Prev navigation and thumbnails */}
        <AttachmentsGalleryModal
          isOpen={isGalleryOpen}
          onClose={() => setIsGalleryOpen(false)}
          images={galleryImages}
          initialIndex={galleryIndex}
          title={galleryTitle}
        />
      </div>
    );
  };

