import React, { useState, useEffect, useRef } from 'react'; 
import { useAuth } from '../../context/AuthContext';
import { useEstimates } from '../../context/EstimatesContext';
import { useSettings } from '../../context/SettingsContext';
import { usePrint } from '../../context/PrintContext';
import { useMaterials } from '../../context/MaterialsContext';
import { useCustomers } from '../../context/CustomersContext';
import { useWorkOrders } from '../../context/WorkOrdersContext';
import { Calculator, Plus, Trash2, Edit, Save, FileText, Check, Printer, X, Eye, EyeOff, LayoutDashboard, Database, Tags, ArrowUp, ArrowDown, Factory, List, ChevronUp, ChevronDown, Search } from 'lucide-react';
import { formatCurrency, numberToArabicWords } from '../../utils/formatters';
import { CustomerSelect } from '../../components/ui/CustomerSelect';

export const CostCalculatorView = ({ setViewState }: { setViewState: (state: string) => void }) => {
    const { hasPermission } = useAuth();
  const { estimates, setEstimates, estimateCategories, setEstimateCategories, cart, setCart, editingEstimate, setEditingEstimate, editingContext, setEditingContext, calculatorDraftRef } = useEstimates();
    const { appSettings, setAppSettings, idCountersRef, generateId } = useSettings();
    const { printData, setPrintData } = usePrint();
    const { masterMaterials, setMasterMaterials, worksOf, setWorksOf, masterItems, setMasterItems } = useMaterials();
    const { customers, setCustomers } = useCustomers();
    const { workOrders, setWorkOrders } = useWorkOrders();
    const isSameEstimate = calculatorDraftRef.current && calculatorDraftRef.current.estimateId === (editingEstimate ? editingEstimate.id : null);
    const normalizeText = (text) => (text || '').trim().replace(/\s+/g, ' ').toLowerCase();

    const [specs, setSpecs] = useState(() => {
      if (isSameEstimate) return calculatorDraftRef.current.specs;
      if (editingEstimate) return { desc: editingEstimate.desc, chassis: editingEstimate.chassis, length: editingEstimate.length, width: editingEstimate.width, height: editingEstimate.height, notes: editingEstimate.notes || '', categoryId: editingEstimate.categoryId || '' };
      return { desc: '', chassis: '', length: '', width: '', height: '', notes: '', categoryId: '' };
    });

    const [materials, setMaterials] = useState(() => {
      let resultMaterials = [];
      if (isSameEstimate) {
        resultMaterials = [...calculatorDraftRef.current.materials];
      } else if (editingEstimate) {
        let loadedMaterials = (editingEstimate.materials || []).map(m => ({ ...m, isVisible: m.isVisible !== false }));
        masterItems.forEach((mItem) => {
          const exists = loadedMaterials.some(m => m.worksOf === mItem.worksOfId && normalizeText(m.itemName) === normalizeText(mItem.name));
          if (!exists) {
            loadedMaterials.push({
              id: Date.now() + Math.random(), itemName: mItem.name, name: '', qty: 0, unit: '', worksOf: mItem.worksOfId, price: 0, masterId: null, isVisible: true
            });
          }
        });
        resultMaterials = loadedMaterials;
      } else {
        const initialMaterials = masterItems.map((item, idx) => ({
          id: Date.now() + idx, itemName: item.name, name: '', qty: 0, unit: '', worksOf: item.worksOfId, price: 0, masterId: null, isVisible: true
        }));
        resultMaterials = initialMaterials.length > 0 ? initialMaterials : [{ id: Date.now(), itemName: '', name: '', qty: 1, unit: 'قطعة', worksOf: worksOf[0]?.id || '', price: 0, masterId: null, isVisible: true }];
      }

      resultMaterials.sort((a, b) => {
        if (a.worksOf !== b.worksOf) {
          const aSectionIdx = worksOf.findIndex(w => w.id === a.worksOf);
          const bSectionIdx = worksOf.findIndex(w => w.id === b.worksOf);
          const aIdx = aSectionIdx !== -1 ? aSectionIdx : 999;
          const bIdx = bSectionIdx !== -1 ? bSectionIdx : 999;
          if (aIdx !== bIdx) return aIdx - bIdx;
        }
        const aMasterIdx = masterItems.findIndex(i => i.worksOfId === a.worksOf && normalizeText(i.name) === normalizeText(a.itemName || ''));
        const bMasterIdx = masterItems.findIndex(i => i.worksOfId === b.worksOf && normalizeText(i.name) === normalizeText(b.itemName || ''));
        if (aMasterIdx !== -1 && bMasterIdx !== -1) return aMasterIdx - bMasterIdx;
        if (aMasterIdx !== -1) return -1;
        if (bMasterIdx !== -1) return 1;
        return 0;
      });

      return resultMaterials;
    });

    const [sellPrice, setSellPrice] = useState(() => {
      if (isSameEstimate) return calculatorDraftRef.current.sellPrice;
      if (editingEstimate) return editingEstimate.sellPrice;
      return '';
    });

    const [profitPercentage, setProfitPercentage] = useState(() => {
      if (isSameEstimate) return calculatorDraftRef.current.profitPercentage;
      if (editingEstimate) {
        if (editingEstimate.profitPercentage !== undefined) {
          return editingEstimate.profitPercentage;
        }
        const loadedCost = (editingEstimate.materials || []).reduce((sum, mat) => sum + (Number(mat.qty) * Number(mat.price)), 0);
        if (loadedCost > 0) {
          const pct = ((Number(editingEstimate.sellPrice) - loadedCost) / loadedCost) * 100;
          return pct.toFixed(2);
        }
      }
      return 30;
    });

    const [attachments, setAttachments] = useState(() => {
      if (isSameEstimate) return calculatorDraftRef.current.attachments;
      if (editingEstimate) return editingEstimate.attachments || [];
      return [];
    });

    const [initialStateStr] = useState(() => {
      if (isSameEstimate && calculatorDraftRef.current?.initialStateStr) {
        return calculatorDraftRef.current.initialStateStr;
      }
      return JSON.stringify({ specs, materials, sellPrice, profitPercentage, attachments });
    });

    // Convert array of IDs to an object of booleans for fast lookup
    const initialExpanded = worksOf.reduce((acc, w) => ({ ...acc, [w.id]: true }), {});
    const [expandedSections, setExpandedSections] = useState(initialExpanded);
    const toggleSection = (id) => setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
    const [pendingSaveData, setPendingSaveData] = useState(null);
    const [pendingPriceUpdate, setPendingPriceUpdate] = useState(null);
    const [pendingStructureData, setPendingStructureData] = useState(null);
    const [showClosePrompt, setShowClosePrompt] = useState(false);
    

    ;

    const handleCloseDirectly = () => {
      const currentStateStr = JSON.stringify({ specs, materials, sellPrice, profitPercentage, attachments });
      if (currentStateStr === initialStateStr) {
        setViewState('list');
        setEditingEstimate(null);
        setEditingContext(null);
        calculatorDraftRef.current = null;
        window.scrollTo(0, 0);
      } else {
        setShowClosePrompt(true);
      }
    };

    const applyPriceUpdates = (resolvedChanges) => {
      setMaterials(prev => {
        let finalMaterials = [...prev];
        resolvedChanges.forEach(change => {
          const matIndex = finalMaterials.findIndex(m => m.id === change.matId);
          if (matIndex !== -1) {
            if (change.action === 'accept') {
              finalMaterials[matIndex].price = change.newPrice;
            } else if (change.action === 'modify') {
              finalMaterials[matIndex].price = change.modifiedPrice;
            }
          }
        });
        return finalMaterials;
      });
      setPendingPriceUpdate(null);
    };

    const handleFileUpload = (e) => {
      const files = Array.from(e.target.files);
      files.forEach(file => {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          setAttachments(prev => [...prev, { name: file.name, type: file.type, data: ev.target.result }]);
        };
        reader.readAsDataURL(file);
      });
    };

    const removeAttachment = (index) => {
      setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const [materialModal, setMaterialModal] = useState(null);
    const [priceModal, setPriceModal] = useState(null);
    const [modalSearch, setModalSearch] = useState('');
    const [showNewMaterialForm, setShowNewMaterialForm] = useState(false);
    const [newMatForm, setNewMatForm] = useState({ name: '', shortName: '', defaultPrice: '', unit: 'قطعة' });
    const inputRefs = useRef({});

    useEffect(() => {
      const handler = e => {
        if (e.key === 'Escape') {
          if (pendingStructureData) setPendingStructureData(null);
          else if (pendingSaveData) setPendingSaveData(null);
          else if (pendingPriceUpdate) setPendingPriceUpdate(null);
          else if (showClosePrompt) setShowClosePrompt(false);
          else if (materialModal) setMaterialModal(null);
          else if (priceModal) setPriceModal(null);
          else if (showNewMaterialForm) setShowNewMaterialForm(false);
          else handleCloseDirectly();
        }
      };
      document.addEventListener('keydown', handler);
      return () => document.removeEventListener('keydown', handler);
    }, [pendingStructureData, pendingSaveData, pendingPriceUpdate, showClosePrompt, materialModal, priceModal, showNewMaterialForm]);

    useEffect(() => {
      calculatorDraftRef.current = {
        estimateId: editingEstimate ? editingEstimate.id : null,
        specs, materials, sellPrice, profitPercentage, attachments, initialStateStr
      };
    }, [specs, materials, sellPrice, profitPercentage, attachments, editingEstimate, initialStateStr]);

    // Check for updated prices when an existing estimate is first opened
    useEffect(() => {
      if (editingEstimate && !isSameEstimate) {
        let outdatedMaterials = [];
        materials.forEach((mat, idx) => {
          if (mat.masterId) {
            const masterMat = masterMaterials.find(m => m.id === mat.masterId);
            if (masterMat && Number(masterMat.defaultPrice) !== Number(mat.price)) {
              outdatedMaterials.push({
                idx, matId: mat.id, masterId: mat.masterId, name: mat.name,
                oldPrice: mat.price, newPrice: masterMat.defaultPrice,
                action: 'accept', modifiedPrice: masterMat.defaultPrice
              });
            }
          }
        });
        if (outdatedMaterials.length > 0) {
          setPendingPriceUpdate({ changedMaterials: outdatedMaterials });
        }
      }
    }, []);

    const totalCost = materials.reduce((sum, mat) => sum + (Number(mat.qty) * Number(mat.price)), 0);
    const profit = (Number(sellPrice) || 0) - totalCost;

    useEffect(() => {
      if (totalCost > 0 && profitPercentage !== '') {
        const calculatedPrice = totalCost * (1 + Number(profitPercentage) / 100);
        if (Math.abs(calculatedPrice - Number(sellPrice)) > 0.01) {
          setSellPrice(calculatedPrice.toFixed(2));
        }
      }
    }, [totalCost, profitPercentage]);

    const handlePercentageChange = (e) => setProfitPercentage(e.target.value);


    const addMaterial = (worksOfId) => {
      const newId = Date.now();
      setMaterials(prev => [...prev, { id: newId, itemName: '', name: '', qty: 1, unit: 'قطعة', worksOf: worksOfId || worksOf[0]?.id || '', price: 0, masterId: null, isVisible: true }]);
      setTimeout(() => inputRefs.current[newId]?.focus(), 50);
    };

    const removeMaterial = (id) => {
      const mat = materials.find(m => m.id === id);
      if (!mat) return;
      const isMasterItem = masterItems.some(i => i.worksOfId === mat.worksOf && normalizeText(i.name) === normalizeText(mat.itemName || ''));
      if (isMasterItem) {
        setMaterials(materials.map(m => m.id === id ? { ...m, name: '', fullName: '', qty: 1, price: 0, unit: '', masterId: null } : m));
      } else {
        setMaterials(materials.filter(m => m.id !== id));
      }
    };

    const clearSection = (sectionId, sectionName) => {
      if (window.confirm(`هل أنت متأكد من تفريغ جميع البنود في قسم "${sectionName}"؟\nسيعود القسم لحالته الافتراضية.`)) {
        setMaterials(prev => prev.map(m => {
          if (m.worksOf === sectionId) {
            return { ...m, name: '', fullName: '', qty: 1, price: 0, unit: '', masterId: null };
          }
          return m;
        }));
      }
    };
    const moveMaterial = (id, direction) => {
      const index = materials.findIndex(m => m.id === id);
      if (index === -1) return;
      const newMaterials = [...materials];
      if (direction === 'up' && index > 0) {
        [newMaterials[index - 1], newMaterials[index]] = [newMaterials[index], newMaterials[index - 1]];
      } else if (direction === 'down' && index < newMaterials.length - 1) {
        [newMaterials[index + 1], newMaterials[index]] = [newMaterials[index], newMaterials[index + 1]];
      }
      setMaterials(newMaterials);
    };
    const updateMaterial = (id, field, value) => setMaterials(materials.map(m => m.id === id ? { ...m, [field]: value } : m));
    const toggleVisibility = (id) => setMaterials(materials.map(m => m.id === id ? { ...m, isVisible: !m.isVisible } : m));

    
    const selectModalMaterial = (masterMat) => {
      const rowId = materialModal.matId;
      if (masterMat) {
        const updatedMaterials = materials.map(m => m.id === rowId ? { ...m, name: masterMat.shortName || masterMat.name, fullName: masterMat.name, price: masterMat.defaultPrice, unit: masterMat.unit || m.unit, masterId: masterMat.id } : m);
        if (calculatorDraftRef.current) calculatorDraftRef.current.materials = updatedMaterials;
        setMaterials(updatedMaterials);
        
        const currentMat = materials.find(m => m.id === rowId);
        if (currentMat && currentMat.worksOf) {
          const sectionId = currentMat.worksOf;
          if (!masterMat.worksOfIds || !masterMat.worksOfIds.includes(sectionId)) {
            const newWorksOfIds = [...(masterMat.worksOfIds || []), sectionId];
            setMasterMaterials(prev => prev.map(mm => mm.id === masterMat.id ? { ...mm, worksOfIds: newWorksOfIds } : mm));
          }
        }
      } else {
        const newMat = { id: Date.now(), name: newMatForm.name, shortName: newMatForm.shortName || newMatForm.name, defaultPrice: Number(newMatForm.defaultPrice) || 0, unit: newMatForm.unit || 'قطعة', worksOfIds: [materialModal.worksOfId] };
        
        const updatedMaterials = materials.map(m => m.id === rowId ? { ...m, name: newMatForm.name, fullName: newMatForm.name, price: Number(newMatForm.defaultPrice) || 0, unit: newMatForm.unit || 'قطعة', masterId: newMat.id } : m);
        if (calculatorDraftRef.current) calculatorDraftRef.current.materials = updatedMaterials;
        setMaterials(updatedMaterials);
        
        setMasterMaterials(prev => [...prev, newMat]);
      }
      setMaterialModal(null);
      setTimeout(() => document.getElementById(`mat-qty-${rowId}`)?.focus(), 50);
    };

    const activeModalSuggestions = React.useMemo(() => {
      if (!materialModal) return [];
      const lowerSearch = modalSearch.toLowerCase();
      const sectionId = materialModal.worksOfId;

      let filtered = masterMaterials.filter(mm => mm.name.toLowerCase().includes(lowerSearch) || (mm.shortName && mm.shortName.toLowerCase().includes(lowerSearch)));
      
      if (sectionId) {
        filtered.sort((a, b) => {
          const aHas = a.worksOfIds?.includes(sectionId) ? 1 : 0;
          const bHas = b.worksOfIds?.includes(sectionId) ? 1 : 0;
          if (aHas !== bHas) return bHas - aHas;
          return a.name.localeCompare(b.name, 'ar');
        });
      }
      return filtered;
    }, [masterMaterials, modalSearch, materialModal]);


    const isSpecsValid = () => specs.desc?.trim() !== '' && specs.chassis?.trim() !== '' && Number(specs.length) > 0 && Number(specs.width) > 0 && Number(specs.height) > 0;

    const checkDuplicateSpecs = (asNew) => {
      const currentId = (asNew || !editingEstimate) ? null : editingEstimate.id;
      return estimates.some(est =>
        est.id !== currentId &&
        normalizeText(est.desc) === normalizeText(specs.desc) &&
        normalizeText(est.chassis) === normalizeText(specs.chassis) &&
        Number(est.length) === Number(specs.length) &&
        Number(est.width) === Number(specs.width) &&
        Number(est.height) === Number(specs.height) &&
        normalizeText(est.notes || '') === normalizeText(specs.notes || '')
      );
    };

    const checkPricesAndSave = (asNew, finalMats, newSections, itemsToNotSave) => {
      executeSave(asNew, [], finalMats, newSections, itemsToNotSave);
    };

    const handleSaveClick = (asNew = false) => { 
      if (editingEstimate && !asNew) { if (!hasPermission(editingContext?.type === 'workOrder' ? 'workOrders' : 'estimates', 'edit')) return alert('ليس لديك صلاحية للتعديل'); } 
      else { if (!hasPermission(editingContext?.type === 'workOrder' ? 'workOrders' : 'estimates', 'create')) return alert('ليس لديك صلاحية للإضافة'); }

      if (!isSpecsValid()) return alert('الرجاء إدخال جميع المواصفات الفنية الإلزامية بشكل صحيح (بما فيها الارتفاع).');
      if (checkDuplicateSpecs(asNew)) return alert('يوجد منتج بنفس المواصفات تماماً! لتجنب التكرار يرجى تغيير الأبعاد، الوصف، أو كتابة ملاحظة مميزة.');

      const cleanedMaterials = materials.filter(mat => {
        const isMasterItem = worksOf.some(w => w.id === mat.worksOf) && masterItems.some(i => i.worksOfId === mat.worksOf && normalizeText(i.name) === normalizeText(mat.itemName || ''));
        if (isMasterItem) return true;
        return (mat.itemName || '').trim() !== '' || (mat.name || '').trim() !== '';
      });

      const missingSections = [];
      const missingItems = [];

      cleanedMaterials.forEach(mat => {
        if (!mat.worksOf) return;
        if (!worksOf.some(w => w.id === mat.worksOf)) {
           if (!missingSections.some(s => s.id === mat.worksOf)) {
             missingSections.push({ id: mat.worksOf, name: 'قسم غير معروف (' + mat.worksOf.substring(0,4) + ')', action: 'delete' });
           }
        } else {
           const iName = (mat.itemName || '').trim();
           if (iName !== '') {
             if (!masterItems.some(i => i.worksOfId === mat.worksOf && normalizeText(i.name) === normalizeText(iName))) {
                if (!missingItems.some(item => item.worksOfId === mat.worksOf && normalizeText(item.name) === normalizeText(iName))) {
                  missingItems.push({ worksOfId: mat.worksOf, name: iName, sectionName: worksOf.find(w => w.id === mat.worksOf)?.name, action: 'delete' });
                }
             }
           }
        }
      });

      if (missingSections.length > 0 || missingItems.length > 0) {
        setPendingStructureData({ asNew, missingSections, missingItems, originalMaterials: cleanedMaterials });
        return;
      }

      checkPricesAndSave(asNew, cleanedMaterials, [], []);
    };

    const applyStructureUpdates = () => {
      const { asNew, missingSections, missingItems, originalMaterials } = pendingStructureData;
      let finalMats = [...originalMaterials];
      let newSections = [];
      let itemsToNotSave = [];

      missingSections.forEach(sec => {
        if (sec.action === 'delete') finalMats = finalMats.filter(m => m.worksOf !== sec.id);
        else if (sec.action === 'restore') newSections.push({ id: sec.id, name: 'قسم مستعاد ' + sec.id.substring(0,4) });
      });

      missingItems.forEach(item => {
        if (item.action === 'delete') finalMats = finalMats.filter(m => m.worksOf !== item.worksOfId || normalizeText(m.itemName || '') !== normalizeText(item.name));
        else if (item.action === 'keep') itemsToNotSave.push({ worksOfId: item.worksOfId, name: item.name });
      });

      setPendingStructureData(null);
      checkPricesAndSave(asNew, finalMats, newSections, itemsToNotSave);
    };

    const executeSave = (asNew = false, resolvedChanges = [], finalMatsOverride = null, newSections = [], itemsToNotSave = []) => {
      let updatedMasters = [...masterMaterials];
      let changedMasterPrices = {};
      let updatedMasterItems = [...masterItems];
      let finalMaterials = finalMatsOverride ? JSON.parse(JSON.stringify(finalMatsOverride)) : JSON.parse(JSON.stringify(materials));

      if (newSections.length > 0) {
        setWorksOf(prev => [...prev, ...newSections]);
      }

      resolvedChanges.forEach(change => {
        if (change.action === 'modify') {
          finalMaterials[change.idx].price = change.modifiedPrice;
          const masterIdx = updatedMasters.findIndex(m => m.id === change.masterId);
          if (masterIdx !== -1) {
            updatedMasters[masterIdx].defaultPrice = change.modifiedPrice;
            changedMasterPrices[change.masterId] = change.modifiedPrice;
          }
        } else if (change.action === 'update') {
          const masterIdx = updatedMasters.findIndex(m => m.id === change.masterId);
          if (masterIdx !== -1) {
            updatedMasters[masterIdx].defaultPrice = change.newPrice;
            changedMasterPrices[change.masterId] = change.newPrice;
          }
        } else if (change.action === 'revert') {
          finalMaterials[change.idx].price = change.oldPrice;
        }
      });

      finalMaterials.forEach((mat, idx) => {
        const iName = (mat.itemName || '').trim();
        if (iName !== '' && mat.worksOf) {
          const existingItem = updatedMasterItems.find(i => i.worksOfId === mat.worksOf && normalizeText(i.name) === normalizeText(iName));
          const shouldSkip = itemsToNotSave.some(it => it.worksOfId === mat.worksOf && normalizeText(it.name) === normalizeText(iName));
          if (!existingItem && !shouldSkip) {
            updatedMasterItems.push({ id: `I${Date.now() + idx}`, worksOfId: mat.worksOf, name: iName });
          }
        }

        const matName = mat.name.trim();
        if (matName === '') return;
        if (!mat.masterId) {
          const existingByName = updatedMasters.find(m => normalizeText(m.name) === normalizeText(matName));
          if (!existingByName) {
            const newMasterId = Date.now() + idx;
            updatedMasters.push({ id: newMasterId, name: matName, defaultPrice: Number(mat.price), unit: mat.unit });
            finalMaterials[idx].masterId = newMasterId;
          } else finalMaterials[idx].masterId = existingByName.id;
        }
      });
      
      setMasterMaterials(updatedMasters);
      setMasterItems(updatedMasterItems);

      const newTotalCost = finalMaterials.reduce((sum, mat) => sum + (mat.price * mat.qty), 0);
      const newProfit = Number(sellPrice) - newTotalCost;

      const estimateData = {
        id: asNew || !editingEstimate ? Date.now() : editingEstimate.id,
        ...specs,
        materials: finalMaterials,
        totalCost: newTotalCost,
        sellPrice: Number(sellPrice),
        profit: newProfit,
        profitPercentage: profitPercentage,
        attachments: [...attachments],
        date: (!asNew && editingEstimate && editingEstimate.date) ? editingEstimate.date : new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };

      if (editingContext?.type === 'workOrder') {
        const woId = editingContext.woId;
        const finalWOItem = {
          ...editingEstimate,
          ...estimateData,
        };
        console.log('Saving WO estimate:', finalWOItem);
        if (asNew) {
          finalWOItem.id = Date.now();
          finalWOItem.serialNumber = generateId('sn');
          setWorkOrders(workOrders.map(wo => {
            if (wo.id === woId) return { ...wo, items: [finalWOItem, ...wo.items] };
            return wo;
          }));
        } else {
          setWorkOrders(workOrders.map(wo => {
            if (wo.id === woId) {
              return { ...wo, items: wo.items.map(i => i.serialNumber === finalWOItem.serialNumber ? finalWOItem : i) };
            }
            return wo;
          }));
        }
      } else {
        console.log('Saving normal estimate:', estimateData);
        if (asNew || !editingEstimate) setEstimates([estimateData, ...estimates]);
        else setEstimates(estimates.map(e => e.id === estimateData.id ? estimateData : e));
      }

      setViewState('list');
      setEditingEstimate(null);
      setEditingContext(null);
      setPendingSaveData(null);
      calculatorDraftRef.current = null;
      window.scrollTo(0, 0);
    };

    const handleGlobalKeyDown = (e) => {
      if (e.altKey && e.key === 'Enter') {
        e.preventDefault();
        addMaterial();
      }
    };

    return (
      <div
        className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8 "
        onKeyDown={handleGlobalKeyDown}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Factory className="w-6 h-6 text-blue-600" />
            {editingEstimate ? 'تعديل التقدير' : 'حاسبة تكلفة منتج جديد'}
          </h2>
          <button onClick={handleCloseDirectly} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
        </div>

        <div className="mb-8 bg-slate-50 p-4 rounded-lg border border-slate-100">
          <h3 className="font-semibold text-slate-700 mb-4 border-b border-slate-200 pb-2">1. المواصفات الفنية الأساسية (إلزامية)</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">وصف المنتج *</label>
              <input type="text" className="w-full p-2 border border-slate-300 rounded outline-none focus:border-blue-500" value={specs.desc} onChange={e => setSpecs({ ...specs, desc: e.target.value })} placeholder="مثال: مقطورة 3 محور" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">الشاصية *</label>
              <input type="text" className="w-full p-2 border border-slate-300 rounded outline-none focus:border-blue-500" value={specs.chassis} onChange={e => setSpecs({ ...specs, chassis: e.target.value })} placeholder="نوع الشاصية" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">الطول (م) *</label>
              <input type="number" className="w-full p-2 border border-slate-300 rounded text-center outline-none focus:border-blue-500" value={specs.length} onChange={e => setSpecs({ ...specs, length: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">العرض (م) *</label>
              <input type="number" className="w-full p-2 border border-slate-300 rounded text-center outline-none focus:border-blue-500" value={specs.width} onChange={e => setSpecs({ ...specs, width: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">الارتفاع (م) *</label>
              <input type="number" className="w-full p-2 border border-slate-300 rounded text-center outline-none focus:border-blue-500" value={specs.height} onChange={e => setSpecs({ ...specs, height: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">التصنيف</label>
              <select className="w-full p-2 border border-slate-300 rounded outline-none focus:border-blue-500 bg-white" value={specs.categoryId || ''} onChange={e => setSpecs({ ...specs, categoryId: e.target.value })}>
                <option value="">بدون تصنيف</option>
                {estimateCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-slate-700 mb-1">ملاحظات (اختياري)</label>
              <input type="text" className="w-full p-2 border border-slate-300 rounded outline-none focus:border-blue-500" value={specs.notes} onChange={e => setSpecs({ ...specs, notes: e.target.value })} placeholder="هذه الملاحظة تظهر في أوامر التصنيع ولن تظهر في الفواتير..." />
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row-reverse gap-6 mb-8 items-start">
          <div className="w-full lg:w-1/4 sticky top-6 self-start bg-slate-50 border border-slate-200 rounded-lg p-4 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-200 pb-2"><List className="w-5 h-5 text-blue-600" /> قائمة الأقسام</h3>
            <ul className="space-y-2 max-h-[80vh] overflow-y-auto pr-1">
              {(() => {
                const usedSectionIds = [...new Set(materials.map(m => m.worksOf).filter(Boolean))];
                const sectionsToRender = [
                  ...worksOf,
                  ...usedSectionIds.filter(id => !worksOf.some(w => w.id === id)).map(id => ({ id, name: 'قسم محذوف (' + id.substring(0,6) + ')', isDeleted: true }))
                ];
                return sectionsToRender.map(w => {
                  const sectionMats = materials.filter(m => m.worksOf === w.id);
                  const sectionTotal = sectionMats.reduce((sum, m) => sum + (m.qty * m.price), 0);
                  return (
                    <li key={`nav-${w.id}`}>
                      <div className="w-full p-3 rounded-md hover:bg-blue-50 border border-transparent hover:border-blue-100 transition-colors flex justify-between items-center group bg-white shadow-sm gap-2">
                        <button
                          onClick={() => {
                            const el = document.getElementById(`section-${w.id}`);
                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }}
                          className="min-w-0 flex-1 text-right outline-none"
                        >
                          <span className={`font-semibold text-sm truncate block ${w.isDeleted ? 'text-red-500' : 'text-slate-700 group-hover:text-blue-700'}`}>{w.name}</span>
                        </button>
                        <div className="flex flex-shrink-0 items-center gap-1.5">
                          <span className="font-bold text-slate-600 text-xs bg-slate-50 px-2 py-1 rounded shadow-sm border border-slate-100 dir-ltr whitespace-nowrap">{formatCurrency(sectionTotal)}</span>
                          <button onClick={(e) => { e.stopPropagation(); clearSection(w.id, w.name); }} className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-all outline-none" title="تفريغ القسم">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                });
              })()}
            </ul>
          </div>

          <div className="w-full lg:w-3/4 space-y-6">
            {(() => {
              const usedSectionIds = [...new Set(materials.map(m => m.worksOf).filter(Boolean))];
              const sectionsToRender = [
                ...worksOf,
                ...usedSectionIds.filter(id => !worksOf.some(w => w.id === id)).map(id => ({ id, name: 'قسم محذوف (' + id.substring(0,6) + ')', isDeleted: true }))
              ];
              return sectionsToRender.map(w => {
              const sectionMats = materials.filter(m => m.worksOf === w.id);
              const sectionTotal = sectionMats.reduce((sum, m) => sum + (m.qty * m.price), 0);

              return (
                <div key={w.id} id={`section-${w.id}`} className="relative bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden scroll-m-20">
                  <div className="flex justify-between items-center bg-slate-50 p-3 border-b border-slate-200">
                    <button onClick={() => toggleSection(w.id)} className="flex items-center gap-3 hover:text-blue-600 transition-colors">
                      <div className="p-1 bg-white border border-slate-200 rounded shadow-sm text-slate-500 hover:bg-blue-50 hover:text-blue-600">
                        {expandedSections[w.id] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                      <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                        {w.name} {w.isDeleted && <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded mr-2">(محذوف)</span>}
                        <span className="text-sm font-semibold px-3 py-1 bg-slate-200/70 text-slate-700 rounded-full mr-2" dir="ltr">{formatCurrency(sectionTotal)}</span>
                      </h3>
                    </button>
                    <div className="flex gap-2">
                      <button onClick={() => addMaterial(w.id)} className="text-sm bg-blue-100 text-blue-700 px-3 py-1.5 rounded-md hover:bg-blue-200 flex items-center gap-1 font-medium"><Plus className="w-4 h-4" /> إضافة مادة (سطر)</button>
                    </div>
                  </div>
                  {expandedSections[w.id] && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-sm">
                        <thead className="bg-white text-slate-600 border-b border-slate-200">
                          <tr>
                            <th className="p-3 w-8 text-center border-r border-slate-200">#</th>
                            <th className="p-3 w-12 text-center" title="إظهار/إخفاء في المواصفات"><Eye className="w-4 h-4 mx-auto" /></th>
                            <th className="p-3 w-64 border-r border-slate-200">البند (وصف العمل)</th>
                            <th className="p-3 border-r border-slate-200">البيان / اسم المادة</th>
                            <th className="p-3 w-20 text-center border-r border-slate-200">الوحدة</th>
                            <th className="p-3 w-20 text-center border-r border-slate-200">الكمية</th>
                            <th className="p-3 w-28 text-center border-r border-slate-200">سعر الوحدة</th>
                            <th className="p-3 w-28 text-center border-r border-slate-200">الإجمالي</th>
                            <th className="p-3 w-12 text-center"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {materials.filter(m => m.worksOf === w.id).map((mat, idx) => (
                            <tr key={mat.id} className={`border-b border-slate-100 transition-colors duration-200 hover:bg-blue-50/30 ${mat.isVisible === false ? 'opacity-40 grayscale bg-slate-100' : (!mat.name ? 'opacity-60 bg-slate-50/50' : 'bg-white')}`}>
                              <td className="p-2 border-r border-slate-100 text-center text-slate-400 font-mono text-xs">{idx + 1}</td>
                              <td className="p-2 text-center">
                                <button onClick={() => toggleVisibility(mat.id)} className={`p-1 rounded border shadow-sm ${mat.isVisible === false ? 'text-slate-300 bg-white border-slate-200' : 'text-blue-500 hover:bg-blue-50 border-slate-200'}`} title={mat.isVisible === false ? 'إظهار في الطباعة' : 'إخفاء من الطباعة'}>
                                  {mat.isVisible === false ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              </td>
                              <td className="p-2 border-r border-slate-100 font-semibold text-slate-700">
                                <textarea
                                  placeholder="اكتب وصف المادة..."
                                  className={`w-full p-2 border-b border-transparent outline-none resize-none overflow-hidden leading-tight ${masterItems.some(i => i.worksOfId === mat.worksOf && normalizeText(i.name) === normalizeText(mat.itemName || '')) && (mat.itemName || '').trim() !== '' ? 'bg-transparent text-slate-800 cursor-default' : 'focus:border-slate-300 focus:bg-white bg-transparent border-slate-200 hover:border-slate-300'}`}
                                  rows={1}
                                  value={mat.itemName || ''}
                                  readOnly={masterItems.some(i => i.worksOfId === mat.worksOf && normalizeText(i.name) === normalizeText(mat.itemName || '')) && (mat.itemName || '').trim() !== ''}
                                  onChange={e => {
                                    e.target.style.height = 'auto';
                                    e.target.style.height = (e.target.scrollHeight) + 'px';
                                    updateMaterial(mat.id, 'itemName', e.target.value);
                                  }}
                                />
                              </td>
                              <td className="p-2 border-r border-slate-100 group" onClick={() => { setMaterialModal({ matId: mat.id, worksOfId: w.id }); setModalSearch(''); }}>
                                <div className={`w-full p-2 border rounded whitespace-pre-wrap leading-tight overflow-hidden text-right min-h-[40px] cursor-pointer hover:border-blue-400 transition-colors ${!mat.name ? 'text-slate-400 bg-slate-50 border-dashed border-slate-300' : 'bg-white border-slate-300 text-slate-800 font-semibold shadow-sm'}`}>
                                  {mat.name || mat.fullName || 'اضغط لاختيار المادة...'}
                                </div>
                              </td>
                              <td className="p-2 border-r border-slate-100"><input type="text" disabled={!mat.name} className={`w-full p-2 border border-slate-300 rounded text-center outline-none ${!mat.name ? 'bg-slate-100 cursor-not-allowed opacity-50' : 'focus:border-blue-500'}`} value={mat.unit || ''} onChange={e => updateMaterial(mat.id, 'unit', e.target.value)} /></td>
                              <td className="p-2 border-r border-slate-100"><input id={`mat-qty-${mat.id}`} type="number" min="1" disabled={!mat.name} className={`w-full p-2 border border-slate-300 rounded text-center outline-none ${!mat.name ? 'bg-slate-100 cursor-not-allowed opacity-50' : 'focus:border-blue-500'}`} value={mat.qty} onChange={e => updateMaterial(mat.id, 'qty', e.target.value)} /></td>
                              <td className="p-2 border-r border-slate-100" onClick={() => { if(mat.name) setPriceModal({ matId: mat.id, price: mat.price }) }}>
                                <div className={`w-full p-2 border rounded text-center min-h-[40px] flex items-center justify-center transition-colors font-mono font-semibold ${!mat.name ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-blue-500 bg-white border-slate-300 text-slate-800 shadow-sm'}`}>
                                  {mat.price}
                                </div>
                              </td>
                              <td className="p-2 text-center font-semibold text-slate-700 border-r border-slate-100 dir-ltr bg-slate-50/50">{formatCurrency(mat.qty * mat.price)}</td>
                              <td className="p-1 border-r border-slate-100">
                                <div className="flex gap-1 justify-center items-center h-full">
                                  <div className="flex flex-col gap-1">
                                    <button onClick={() => moveMaterial(mat.id, 'up')} className="text-slate-400 hover:text-blue-500 disabled:opacity-30 p-0.5 rounded hover:bg-blue-50 bg-white shadow-sm border"><ArrowUp className="w-3 h-3" /></button>
                                    <button onClick={() => moveMaterial(mat.id, 'down')} className="text-slate-400 hover:text-blue-500 disabled:opacity-30 p-0.5 rounded hover:bg-blue-50 bg-white shadow-sm border"><ArrowDown className="w-3 h-3" /></button>
                                  </div>
                                  <button onClick={() => removeMaterial(mat.id)} className="text-slate-400 hover:text-red-500 p-2 bg-white border rounded shadow-sm hover:bg-red-50 ml-1" disabled={materials.length === 1}><Trash2 className="w-4 h-4" /></button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {materials.filter(m => m.worksOf === w.id).length === 0 && (
                            <tr><td colSpan={9} className="p-4 text-center text-slate-400">لم يتم إضافة بنود في هذا القسم بعد.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            });
            })()}

            
          </div>
        </div>

        <div className="mb-8 bg-slate-50 p-4 rounded-lg border border-slate-100">
          <div className="flex justify-between items-center mb-4 border-b border-slate-200 pb-2">
            <h3 className="font-semibold text-slate-700">3. المرفقات (صور فقط)</h3>
            <label className="cursor-pointer bg-slate-200 text-slate-700 hover:bg-slate-300 px-4 py-2 rounded font-medium flex items-center gap-2">
              <Plus className="w-4 h-4" /> إضافة صورة
              <input type="file" className="hidden" accept="image/*" multiple onChange={handleFileUpload} />
            </label>
          </div>
          {attachments.length === 0 ? (
            <div className="text-center text-slate-400 py-4">لا توجد مرفقات.</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {attachments.map((att, i) => (
                <div key={i} className="border border-slate-200 bg-white p-2 rounded relative group">
                  <button onClick={() => removeAttachment(i)} className="absolute top-1 left-1 bg-red-500 text-white rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"><X className="w-4 h-4" /></button>
                  <img src={att.data} alt={att.name} className="w-full h-32 object-cover rounded" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-800 p-6 rounded-xl text-white shadow-md flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex gap-8 border-b md:border-b-0 md:border-l border-slate-600 pb-4 md:pb-0 md:pl-8 w-full md:w-auto">
            <div><div className="text-slate-400 text-sm mb-1">إجمالي التكلفة</div><div className="text-2xl font-bold text-red-400 dir-ltr">{formatCurrency(totalCost)}</div></div>
            <div><div className="text-slate-400 text-sm mb-1">صافي الربح</div><div className="text-2xl font-bold text-green-400 dir-ltr">{formatCurrency(profit)}</div></div>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
            <div className="w-full md:w-32">
              <label className="text-slate-400 text-xs block mb-1">نسبة الربح %</label>
              <div className="relative"><input type="number" className="w-full p-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white font-bold outline-none text-center text-lg pl-6" value={profitPercentage} onChange={handlePercentageChange} /><span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span></div>
            </div>
            <div className="w-full md:w-48">
              <label className="text-slate-400 text-xs block mb-1">سعر البيع المقترح</label>
              <input type="number" readOnly className="w-full p-2.5 bg-slate-700/50 border border-slate-600/50 rounded-lg text-slate-300 font-bold outline-none text-center text-lg cursor-default" value={sellPrice} />
            </div>
            {editingEstimate ? (
              <div className="flex flex-col gap-2 w-full md:w-auto">
                {editingContext && editingContext.type === 'workOrder' ? (
                  <button onClick={() => handleSaveClick(false)} className="w-full bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-lg font-bold shadow-lg flex items-center justify-center gap-2"><Save className="w-5 h-5" /> حفظ التعديلات</button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => handleSaveClick(false)} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-bold shadow-lg flex items-center justify-center gap-2"><Save className="w-5 h-5" /> حفظ</button>
                    <button onClick={() => handleSaveClick(true)} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-lg font-bold shadow-lg flex items-center justify-center gap-2" title="لتجنب التكرار يرجى تغيير أحد الأبعاد أو الوصف أو الملاحظات"><Plus className="w-5 h-5" /> حفظ كجديد</button>
                  </div>
                )}
              </div>
            ) : (
              <button onClick={() => handleSaveClick(false)} className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-lg font-bold shadow-lg flex items-center justify-center gap-2"><Save className="w-5 h-5" /> حفظ التقدير</button>
            )}
          </div>
        </div>

        {pendingStructureData && (
          <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col ">
              <div className="p-6 border-b border-slate-200">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">تأكيد هيكلة التقدير</h2>
                <p className="text-sm text-slate-500 mt-2">يحتوي هذا التقدير على أقسام أو بنود غير مسجلة في النظام (ربما تم حذفها). يرجى تحديد الإجراء لكل منها:</p>
              </div>
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-6">
                {pendingStructureData.missingSections.length > 0 && (
                  <div>
                    <h3 className="font-bold text-slate-700 mb-3">الأقسام المفقودة:</h3>
                    <div className="space-y-3">
                      {pendingStructureData.missingSections.map((sec, i) => (
                        <div key={i} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-4">
                          <div className="flex-1 font-bold text-red-600">{sec.name}</div>
                          <select className="w-full md:w-auto p-2 border rounded outline-none text-sm" value={sec.action} onChange={e => {
                            const newSecs = [...pendingStructureData.missingSections];
                            newSecs[i].action = e.target.value;
                            setPendingStructureData({...pendingStructureData, missingSections: newSecs});
                          }}>
                            <option value="delete">حذف القسم بجميع مواده من هذا التقدير</option>
                            <option value="keep">إبقاء مواد القسم في هذا التقدير فقط</option>
                            <option value="restore">استعادة القسم إلى النظام</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {pendingStructureData.missingItems.length > 0 && (
                  <div>
                    <h3 className="font-bold text-slate-700 mb-3">البنود المفقودة (أو المضافة يدويًا):</h3>
                    <div className="space-y-3">
                      {pendingStructureData.missingItems.map((item, i) => (
                        <div key={i} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-4">
                          <div className="flex-1">
                            <div className="font-bold text-slate-800">{item.name}</div>
                            <div className="text-sm text-slate-500">القسم: {item.sectionName || 'قسم محذوف'}</div>
                          </div>
                          <select className="w-full md:w-auto p-2 border rounded outline-none text-sm" value={item.action} onChange={e => {
                            const newItems = [...pendingStructureData.missingItems];
                            newItems[i].action = e.target.value;
                            setPendingStructureData({...pendingStructureData, missingItems: newItems});
                          }}>
                            <option value="delete">حذف البند ومواده من هذا التقدير</option>
                            <option value="keep">إبقاء في التقدير فقط دون إضافته للنظام</option>
                            <option value="restore">إضافة البند إلى النظام</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="p-6 border-t border-slate-200 bg-white rounded-b-xl flex justify-end gap-4">
                <button onClick={() => setPendingStructureData(null)} className="px-6 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-100">إلغاء</button>
                <button onClick={applyStructureUpdates} className="bg-blue-600 text-white px-8 py-2 rounded-lg font-bold hover:bg-blue-700">تأكيد ومتابعة</button>
              </div>
            </div>
          </div>
        )}

        {pendingSaveData && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col ">
              <div className="p-6 border-b border-slate-200">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">تأكيد تحديث أسعار المواد</h2>
                <p className="text-sm text-slate-500 mt-2">لقد قمت بتغيير أسعار بعض المواد عن السعر المرجعي المحفوظ. يرجى تحديد الإجراء المناسب لكل مادة قبل الحفظ:</p>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                <div className="space-y-4">
                  {pendingSaveData.changedMaterials.map((change, i) => (
                    <div key={i} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-4">
                      <div className="flex-1">
                        <div className="font-bold text-slate-800">{change.name}</div>
                        <div className="flex gap-4 mt-2 text-sm">
                          <span className="text-slate-500">السعر المرجعي: <span className="font-bold text-slate-700">{formatCurrency(change.oldPrice)}</span></span>
                          <span className="text-blue-600 font-bold">السعر الجديد المدخل: {formatCurrency(change.newPrice)}</span>
                        </div>
                      </div>
                      <div className="w-full md:w-auto min-w-[250px]">
                        <select 
                          className="w-full p-2 border border-slate-300 rounded outline-none text-sm font-medium focus:border-blue-500 bg-slate-50"
                          value={change.action}
                          onChange={e => {
                            const val = e.target.value;
                            const newChanges = [...pendingSaveData.changedMaterials];
                            newChanges[i].action = val;
                            setPendingSaveData({ ...pendingSaveData, changedMaterials: newChanges });
                          }}
                        >
                          <option value="update">تحديث السعر المرجعي بالجديد ({change.newPrice})</option>
                          <option value="ignore">استخدام الجديد ({change.newPrice}) هنا فقط</option>
                          <option value="revert">إرجاع السعر للمرجعي القديم ({change.oldPrice})</option>
                          <option value="modify">تعديل واعتماد سعر آخر يدويًا...</option>
                        </select>
                        {change.action === 'modify' && (
                          <div className="mt-2">
                            <input 
                              type="number" 
                              placeholder="أدخل السعر الجديد هنا..."
                              className="w-full p-2 border border-blue-400 rounded outline-none text-sm"
                              value={change.modifiedPrice}
                              onChange={e => {
                                const newChanges = [...pendingSaveData.changedMaterials];
                                newChanges[i].modifiedPrice = Number(e.target.value);
                                setPendingSaveData({ ...pendingSaveData, changedMaterials: newChanges });
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 border-t border-slate-200 bg-white rounded-b-xl flex justify-end gap-4">
                <button onClick={() => setPendingSaveData(null)} className="px-6 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-100">إلغاء الحفظ والعودة</button>
                <button 
                  onClick={() => executeSave(pendingSaveData.asNew, pendingSaveData.changedMaterials, pendingSaveData.finalMats, pendingSaveData.newSections, pendingSaveData.itemsToNotSave)} 
                  className="bg-blue-600 text-white px-8 py-2 rounded-lg font-bold hover:bg-blue-700 shadow-md flex items-center gap-2"
                >
                  <Save className="w-5 h-5" /> تأكيد الإجراءات وحفظ التقدير
                </button>
              </div>
            </div>
          </div>
        )}

        {pendingPriceUpdate && (
          <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col ">
              <div className="p-6 border-b border-slate-200">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">تحديث أسعار المواد من الدليل</h2>
                <p className="text-sm text-slate-500 mt-2">بعض المواد في هذا التقدير تختلف أسعارها عن الأسعار الحالية في الدليل المرجعي. يمكنك مراجعتها وتحديثها أدناه:</p>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                <div className="space-y-4">
                  {pendingPriceUpdate.changedMaterials.map((change, i) => (
                    <div key={i} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-4">
                      <div className="flex-1">
                        <div className="font-bold text-slate-800">{change.name}</div>
                        <div className="flex gap-4 mt-2 text-sm">
                          <span className="text-slate-500">السعر القديم (المحفوظ بالتقدير): <span className="font-bold text-slate-700">{formatCurrency(change.oldPrice)}</span></span>
                          <span className="text-blue-600 font-bold">السعر الجديد (في الدليل): {formatCurrency(change.newPrice)}</span>
                        </div>
                      </div>
                      <div className="w-full md:w-auto min-w-[250px]">
                        <select 
                          className="w-full p-2 border border-slate-300 rounded outline-none text-sm font-medium focus:border-emerald-500 bg-slate-50"
                          value={change.action}
                          onChange={e => {
                            const val = e.target.value;
                            const newChanges = [...pendingPriceUpdate.changedMaterials];
                            newChanges[i].action = val;
                            setPendingPriceUpdate({ ...pendingPriceUpdate, changedMaterials: newChanges });
                          }}
                        >
                          <option value="accept">تحديث واعتماد السعر الجديد ({change.newPrice})</option>
                          <option value="reject">إبقاء السعر القديم دون تغيير ({change.oldPrice})</option>
                          <option value="modify">اعتماد سعر آخر مخصص...</option>
                        </select>
                        {change.action === 'modify' && (
                          <div className="mt-2">
                            <input 
                              type="number" 
                              placeholder="أدخل السعر المخصص..."
                              className="w-full p-2 border border-emerald-400 rounded outline-none text-sm"
                              value={change.modifiedPrice}
                              onChange={e => {
                                const newChanges = [...pendingPriceUpdate.changedMaterials];
                                newChanges[i].modifiedPrice = Number(e.target.value);
                                setPendingPriceUpdate({ ...pendingPriceUpdate, changedMaterials: newChanges });
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 border-t border-slate-200 bg-white rounded-b-xl flex justify-end gap-4">
                <button onClick={() => setPendingPriceUpdate(null)} className="px-6 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-100">إلغاء وإغلاق (عدم التحديث)</button>
                <button 
                  onClick={() => applyPriceUpdates(pendingPriceUpdate.changedMaterials)} 
                  className="bg-emerald-600 text-white px-8 py-2 rounded-lg font-bold hover:bg-emerald-700 shadow-md flex items-center gap-2"
                >
                  <Save className="w-5 h-5" /> تطبيق التحديثات المختارة في المحرر
                </button>
              </div>
            </div>
          </div>
        )}

        {showClosePrompt && (
          <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col ">
              <div className="p-6 border-b border-slate-200">
                <h2 className="text-xl font-bold text-slate-800">إغلاق التقدير</h2>
                <p className="text-sm text-slate-500 mt-2">لديك تقدير مفتوح، ماذا تريد أن تفعل قبل الإغلاق؟</p>
              </div>
              <div className="p-6 flex flex-col gap-3 bg-slate-50 rounded-b-xl">
                <button onClick={() => { setShowClosePrompt(false); handleSaveClick(false); }} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 shadow flex items-center justify-center gap-2">
                  <Save className="w-5 h-5" /> حفظ التقدير والإغلاق
                </button>
                <button onClick={() => { setShowClosePrompt(false); handleSaveClick(true); }} className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold hover:bg-emerald-700 shadow flex items-center justify-center gap-2">
                  <Plus className="w-5 h-5" /> حفظ كجديد والإغلاق
                </button>
                <button onClick={() => { setShowClosePrompt(false); setViewState('list'); setEditingEstimate(null); setEditingContext(null); calculatorDraftRef.current = null; }} className="w-full bg-red-100 text-red-600 py-3 rounded-lg font-bold hover:bg-red-200">
                  إغلاق دون حفظ التغييرات
                </button>
                <button onClick={() => setShowClosePrompt(false)} className="w-full bg-slate-200 text-slate-700 py-3 rounded-lg font-bold hover:bg-slate-300 mt-2">
                  إلغاء والعودة للتقدير
                </button>
              </div>
            </div>
          </div>
        )}

        
      {materialModal && (
          <div className="fixed inset-0 bg-slate-900/60 z-[9999] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
              <div className="bg-slate-800 text-white p-4 flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-lg flex items-center gap-2 mb-1.5"><Search className="w-5 h-5 text-blue-400" /> اختيار أو إضافة مادة</h3>
                  <div className="flex items-center flex-wrap gap-2 mt-1">
                    <span className="text-white font-bold bg-slate-700 px-3 py-1 rounded-md text-sm shadow-sm">{worksOf.find(w => w.id === materialModal.worksOfId)?.name || 'القسم غير معروف'}</span>
                    <span className="text-white font-bold text-lg">{materials.find(m => m.id === materialModal.matId)?.itemName || 'بند مخصص'}</span>
                  </div>
                </div>
                <button onClick={() => setMaterialModal(null)} className="text-slate-400 hover:text-white p-1 bg-slate-700/50 rounded hover:bg-red-500"><X className="w-5 h-5" /></button>
              </div>
              {showNewMaterialForm ? (
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50 flex flex-col gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">اسم المادة (الكامل) <span className="text-red-500">*</span></label>
                    <input autoFocus type="text" className="w-full p-2 border border-slate-300 rounded outline-none focus:border-blue-500" value={newMatForm.name} onChange={e => setNewMatForm({...newMatForm, name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">الاسم المختصر (اختياري)</label>
                    <input type="text" className="w-full p-2 border border-slate-300 rounded outline-none focus:border-blue-500" value={newMatForm.shortName} onChange={e => setNewMatForm({...newMatForm, shortName: e.target.value})} />
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-bold text-slate-700 mb-1">السعر الافتراضي <span className="text-red-500">*</span></label>
                      <input type="number" className="w-full p-2 border border-slate-300 rounded outline-none focus:border-blue-500 dir-ltr" value={newMatForm.defaultPrice} onChange={e => setNewMatForm({...newMatForm, defaultPrice: e.target.value})} />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-bold text-slate-700 mb-1">الوحدة</label>
                      <input type="text" className="w-full p-2 border border-slate-300 rounded outline-none focus:border-blue-500" value={newMatForm.unit} onChange={e => setNewMatForm({...newMatForm, unit: e.target.value})} />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4 pt-4 border-t border-slate-200">
                    <button onClick={() => {
                      if (!newMatForm.name.trim() || newMatForm.defaultPrice === '') return alert('يرجى إدخال اسم المادة والسعر الافتراضي.');
                      selectModalMaterial(null);
                      setShowNewMaterialForm(false);
                    }} className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 shadow-md transition-colors">حفظ واعتماد المادة</button>
                    <button onClick={() => setShowNewMaterialForm(false)} className="flex-1 bg-slate-200 text-slate-700 font-bold py-3 rounded-lg hover:bg-slate-300 transition-colors">إلغاء والعودة للبحث</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="p-4 bg-slate-50 border-b border-slate-200">
                <input 
                  autoFocus
                  type="text"
                  placeholder="ابحث عن مادة أو اكتب اسماً جديداً لإضافته..."
                  className="w-full p-3 border-2 border-blue-400 rounded-lg outline-none text-lg shadow-sm"
                  value={modalSearch}
                  onChange={e => setModalSearch(e.target.value)}
                />
              </div>
              <div className="flex-1 overflow-y-auto p-4 bg-slate-100 flex flex-col gap-2">
                {activeModalSuggestions.map((mm) => (
                  <button 
                    key={mm.id} 
                    onClick={() => selectModalMaterial(mm)}
                    className="w-full text-right bg-white p-4 rounded-lg border border-slate-200 shadow-sm hover:border-blue-400 hover:shadow-md transition-all flex justify-between items-center group"
                  >
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800 text-lg">{mm.shortName || mm.name}</span>
                      {mm.shortName && mm.shortName !== mm.name && <span className="text-slate-500 text-sm">{mm.name}</span>}
                    </div>
                    <div className="flex items-center gap-4">
                      {mm.worksOfIds?.includes(materialModal.worksOfId) && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-bold">مرتبط بالقسم</span>}
                      <span className="bg-slate-100 text-slate-700 font-mono px-3 py-1 rounded font-bold dir-ltr border border-slate-200">{formatCurrency(mm.defaultPrice)}</span>
                    </div>
                  </button>
                ))}
                
                {modalSearch.trim() !== '' && !masterMaterials.some(mm => mm.name.toLowerCase() === modalSearch.trim().toLowerCase() || (mm.shortName && mm.shortName.toLowerCase() === modalSearch.trim().toLowerCase())) && (
                  <button 
                    onClick={() => {
                      setNewMatForm({ name: modalSearch.trim(), shortName: modalSearch.trim(), defaultPrice: '', unit: 'قطعة' });
                      setShowNewMaterialForm(true);
                    }}
                    className="w-full text-right bg-blue-50 p-4 rounded-lg border-2 border-dashed border-blue-400 shadow-sm hover:bg-blue-100 transition-all flex justify-between items-center"
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-600 text-white p-2 rounded-lg"><Plus className="w-5 h-5" /></div>
                      <div>
                        <div className="font-bold text-blue-800 text-lg">إضافة كصنف جديد واعتماده</div>
                        <div className="text-blue-600 font-semibold">{modalSearch.trim()}</div>
                      </div>
                    </div>
                  </button>
                )}
                {activeModalSuggestions.length === 0 && modalSearch.trim() === '' && (
                  <div className="text-center p-8 text-slate-400 font-medium">اكتب للبحث عن المواد...</div>
                )}
              </div>
              </>
              )}
            </div>
          </div>
        )}

        {priceModal && (() => {
          const mat = materials.find(m => m.id === priceModal.matId);
          if (!mat) return null;
          const w = worksOf.find(w => w.id === mat.worksOf);
          const masterMat = mat.masterId ? masterMaterials.find(mm => mm.id === mat.masterId) : null;
          const currentTotal = mat.qty * Number(priceModal.price);

          const handleSaveLocal = () => {
            const updatedMaterials = materials.map(m => m.id === mat.id ? { ...m, price: Number(priceModal.price) } : m);
            if (calculatorDraftRef.current) calculatorDraftRef.current.materials = updatedMaterials;
            setMaterials(updatedMaterials);
            setPriceModal(null);
          };

          const handleSaveMaster = () => {
            const newPrice = Number(priceModal.price);
            const updatedMaterials = materials.map(m => m.id === mat.id ? { ...m, price: newPrice } : m);
            if (calculatorDraftRef.current) calculatorDraftRef.current.materials = updatedMaterials;
            setMaterials(updatedMaterials);
            if (masterMat) {
              setMasterMaterials(prev => prev.map(mm => mm.id === masterMat.id ? { ...mm, defaultPrice: newPrice } : mm));
            }
            setPriceModal(null);
          };

          return (
            <div className="fixed inset-0 bg-slate-900/60 z-[9999] flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
                <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
                  <h3 className="font-bold text-lg flex items-center gap-2">تعديل السعر</h3>
                  <button onClick={() => setPriceModal(null)} className="text-slate-400 hover:text-white p-1 bg-slate-700/50 rounded hover:bg-red-500"><X className="w-5 h-5" /></button>
                </div>
                
                <div className="p-6 bg-slate-50 flex flex-col gap-6">
                  <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold border border-slate-200">القسم</span>
                      <span className="font-bold text-slate-800 text-sm">{w?.name || 'القسم غير معروف'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold border border-slate-200">البند</span>
                      <span className="font-bold text-slate-800 text-sm">{mat.itemName || 'بند مخصص'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold border border-slate-200">المادة</span>
                      <span className="font-bold text-blue-700 text-sm">{mat.name || mat.fullName || 'مادة مخصصة'}</span>
                    </div>
                    
                    <div className="flex items-center gap-6 mt-2 pt-3 border-t border-slate-100">
                      <div><span className="text-slate-500 text-xs block mb-1">الكمية</span><span className="font-bold font-mono bg-slate-100 px-3 py-1 rounded border border-slate-200">{mat.qty}</span></div>
                      <div><span className="text-slate-500 text-xs block mb-1">الوحدة</span><span className="font-bold bg-slate-100 px-3 py-1 rounded border border-slate-200">{mat.unit || '-'}</span></div>
                      <div><span className="text-slate-500 text-xs block mb-1">الإجمالي (الجديد)</span><span className="font-bold text-emerald-600 font-mono bg-emerald-50 px-3 py-1 rounded border border-emerald-200">{formatCurrency(currentTotal)}</span></div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">سعر الوحدة الجديد</label>
                    <input 
                      autoFocus
                      type="number" 
                      min="0"
                      className="w-full p-4 border-2 border-blue-400 rounded-lg text-xl text-center outline-none focus:ring-4 focus:ring-blue-100 dir-ltr font-mono font-bold"
                      value={priceModal.price}
                      onChange={e => setPriceModal({ ...priceModal, price: e.target.value })}
                      onFocus={e => e.target.select()}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <button onClick={handleSaveLocal} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-lg shadow transition-colors flex items-center justify-center gap-2">
                      <Check className="w-5 h-5" /> الاستخدام هنا فقط
                    </button>
                    {masterMat && (
                      <button onClick={handleSaveMaster} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-lg shadow transition-colors flex items-center justify-center gap-2">
                        <Save className="w-5 h-5" /> تعديل السعر المرجعي واعتماده هنا
                      </button>
                    )}
                    <button onClick={() => setPriceModal(null)} className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-3.5 rounded-lg transition-colors mt-2">
                      إلغاء
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    );
  };
