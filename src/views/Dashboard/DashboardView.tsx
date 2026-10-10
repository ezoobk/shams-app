import React, { useMemo } from 'react';
import { useWorkOrders } from '../../context/WorkOrdersContext';
import { useInvoices } from '../../context/InvoicesContext';
import { useCustomers } from '../../context/CustomersContext';
import { useEstimates } from '../../context/EstimatesContext';
import { useShippingOrders } from '../../context/ShippingOrdersContext';
import { useLetters } from '../../context/LettersContext';
import { LayoutDashboard, Factory, FileText, Users, Package, Truck, Archive, Settings, FileCheck2, Mail, Check } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

export const DashboardView = ({ setActiveTab }) => {
    const { workOrders } = useWorkOrders();
    const { invoices } = useInvoices();
    const { customers } = useCustomers();
    const { estimates } = useEstimates();
    const { shippingOrders } = useShippingOrders();
    const { letters } = useLetters();

    const getItemStatus = (item) => {
      const mfgStatus = item.mfgStatus || item.status || 'قيد التصنيع';
      const saleStatus = item.status === 'مباع' ? 'مباعة' : 'غير مباعة';
      return { mfgStatus, saleStatus };
    };
    const recentActivity = [
      ...workOrders.map(wo => ({ id: wo.id, date: wo.date, type: 'أمر تصنيع', title: wo.customerName || 'عام', data: wo, tab: 'workOrders' })),
      ...invoices.map(inv => ({ id: inv.id, date: inv.date, type: inv.type === 'مبدئية' ? 'فاتورة مبدئية' : 'فاتورة نهائية', title: inv.customerName, data: inv, tab: 'invoices', subTab: 'invoices' })),
      ...shippingOrders.map(so => ({ id: so.id, date: so.date, type: 'أمر نقل', title: so.destination, data: so, tab: 'invoices', subTab: 'shipping' })),
      ...letters.map(ltr => ({ id: ltr.id, date: ltr.date, type: 'مراسلة', title: ltr.subject, data: ltr, tab: 'invoices', subTab: 'letters' }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8);

    const activeWorkOrdersCount = workOrders.flatMap(wo => wo.items).filter(i => getItemStatus(i).mfgStatus !== 'جاهز').length;
    const readyWorkOrdersCount = workOrders.flatMap(wo => wo.items).filter(i => getItemStatus(i).mfgStatus === 'جاهز' && getItemStatus(i).saleStatus === 'غير مباعة').length;
    
    return (
      <div className="w-full max-w-6xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-300">
        <h1 className="text-3xl font-black text-slate-800">لوحة التحكم</h1>
        
        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <button onClick={() => { setActiveTab('estimates'); window.scrollTo(0, 0); }} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-500 hover:-translate-y-1 transition-all flex flex-col items-center justify-center gap-3 text-slate-700 hover:text-indigo-600">
             <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center"><FileText className="w-6 h-6" /></div>
             <span className="font-bold text-sm text-center">إنشاء فاتورة مبدئية</span>
          </button>
          <button onClick={() => { 
            window.localStorage.setItem('wo_filterMfg', JSON.stringify('جاهز'));
            window.localStorage.setItem('wo_filterSale', JSON.stringify('غير مباعة'));
            window.localStorage.setItem('wo_filterShipping', JSON.stringify('غير منقولة'));
            setActiveTab('workOrders');
            window.scrollTo(0, 0);
          }} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-500 hover:-translate-y-1 transition-all flex flex-col items-center justify-center gap-3 text-slate-700 hover:text-emerald-600">
             <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center"><FileCheck2 className="w-6 h-6" /></div>
             <span className="font-bold text-sm text-center">إنشاء فاتورة نهائية</span>
          </button>
          <button onClick={() => { setActiveTab('estimates'); window.scrollTo(0, 0); }} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-500 hover:-translate-y-1 transition-all flex flex-col items-center justify-center gap-3 text-slate-700 hover:text-blue-600">
             <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center"><Factory className="w-6 h-6" /></div>
             <span className="font-bold text-sm text-center">إنشاء أمر تصنيع</span>
          </button>
          <button onClick={() => { 
            window.localStorage.setItem('wo_filterMfg', JSON.stringify('جاهز'));
            window.localStorage.setItem('wo_filterSale', JSON.stringify('مباع'));
            window.localStorage.setItem('wo_filterShipping', JSON.stringify('غير منقولة'));
            setActiveTab('workOrders');
            window.scrollTo(0, 0);
          }} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-orange-500 hover:-translate-y-1 transition-all flex flex-col items-center justify-center gap-3 text-slate-700 hover:text-orange-600">
             <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center"><Truck className="w-6 h-6" /></div>
             <span className="font-bold text-sm text-center">إنشاء أمر نقل</span>
          </button>
          <button onClick={() => { 
            window.localStorage.setItem('shams_outbound_tab', JSON.stringify('letters'));
            window.localStorage.setItem('shams_letters_create', JSON.stringify(true));
            setActiveTab('invoices');
            window.scrollTo(0, 0);
          }} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-purple-500 hover:-translate-y-1 transition-all flex flex-col items-center justify-center gap-3 text-slate-700 hover:text-purple-600">
             <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center"><Mail className="w-6 h-6" /></div>
             <span className="font-bold text-sm text-center">إنشاء مراسلة</span>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-800 text-white p-5 rounded-xl shadow-lg relative overflow-hidden">
             <div className="relative z-10">
               <div className="text-slate-300 text-sm font-bold mb-1">قيد التصنيع</div>
               <div className="text-4xl font-black">{activeWorkOrdersCount} <span className="text-sm font-normal">منتج</span></div>
             </div>
             <Factory className="absolute -left-4 -bottom-4 w-24 h-24 text-slate-700 opacity-50" />
          </div>
          <div className="bg-emerald-600 text-white p-5 rounded-xl shadow-lg relative overflow-hidden">
             <div className="relative z-10">
               <div className="text-emerald-200 text-sm font-bold mb-1">جاهز للبيع</div>
               <div className="text-4xl font-black">{readyWorkOrdersCount} <span className="text-sm font-normal">منتج</span></div>
             </div>
             <Check className="absolute -left-4 -bottom-4 w-24 h-24 text-emerald-800 opacity-30" />
          </div>
          <div className="bg-indigo-600 text-white p-5 rounded-xl shadow-lg relative overflow-hidden">
             <div className="relative z-10">
               <div className="text-indigo-200 text-sm font-bold mb-1">إجمالي الفواتير</div>
               <div className="text-4xl font-black">{invoices.length}</div>
             </div>
             <FileText className="absolute -left-4 -bottom-4 w-24 h-24 text-indigo-800 opacity-30" />
          </div>
          <div className="bg-orange-500 text-white p-5 rounded-xl shadow-lg relative overflow-hidden">
             <div className="relative z-10">
               <div className="text-orange-200 text-sm font-bold mb-1">إجمالي العملاء</div>
               <div className="text-4xl font-black">{customers.length}</div>
             </div>
             <Users className="absolute -left-4 -bottom-4 w-24 h-24 text-orange-700 opacity-30" />
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h2 className="font-bold text-slate-800 flex items-center gap-2"><LayoutDashboard className="w-5 h-5 text-slate-500"/> أحدث السجلات والملفات المنشأة</h2>
          </div>
          <div className="overflow-x-auto w-full">
<table className="w-full text-right text-sm">
            <tbody>
              {recentActivity.map((activity, idx) => (
                <tr key={`${activity.id}-${idx}`} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => { if (activity.subTab) window.localStorage.setItem('shams_outbound_tab', JSON.stringify(activity.subTab)); setActiveTab(activity.tab); }}>
                  <td className="p-4 w-12 text-center">
                     {activity.type === 'أمر تصنيع' && <Factory className="w-5 h-5 text-blue-500 mx-auto" />}
                     {activity.type === 'أمر نقل' && <Truck className="w-5 h-5 text-emerald-500 mx-auto" />}
                     {activity.type === 'مراسلة' && <Mail className="w-5 h-5 text-purple-500 mx-auto" />}
                     {activity.type.includes('فاتورة') && <FileText className="w-5 h-5 text-indigo-500 mx-auto" />}
                  </td>
                  <td className="p-4 font-mono font-bold text-slate-800 w-64 whitespace-nowrap">{activity.id}</td>
                  <td className="p-4 text-slate-500 whitespace-nowrap">{new Date(activity.date).toLocaleDateString('ar-LY')}</td>
                  <td className="p-4 font-bold text-slate-700">{activity.title}</td>
                  <td className="p-4 text-left"><span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">{activity.type}</span></td>
                </tr>
              ))}
              {recentActivity.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400">لا توجد أي نشاطات بعد.</td></tr>}
            </tbody>
          </table>
</div>
        </div>
      </div>
    );
  };