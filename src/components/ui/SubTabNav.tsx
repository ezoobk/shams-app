import React from 'react';
import type { LucideIcon } from 'lucide-react';

export interface SubTabItem {
  id: string;
  label: string;
  icon: LucideIcon;
  count?: number;
}

interface SubTabNavProps {
  tabs: SubTabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  title?: string;
  description?: string;
  className?: string;
}

export const SubTabNav: React.FC<SubTabNavProps> = ({
  tabs,
  activeTab,
  onChange,
  title,
  description,
  className = ''
}) => {
  // If only 1 tab is available (e.g. restricted by permissions), don't render switcher bar
  if (tabs.length <= 1) return null;

  return (
    <div className={`mb-6 flex items-center justify-between flex-wrap gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-xs ${className}`}>
      <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                isActive
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-mono font-bold ${
                  isActive ? 'bg-blue-50 text-blue-700' : 'bg-slate-200 text-slate-700'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {(title || description) && (
        <div className="text-left hidden md:block px-2">
          {title && <div className="text-xs font-bold text-slate-700">{title}</div>}
          {description && <div className="text-[11px] text-slate-400">{description}</div>}
        </div>
      )}
    </div>
  );
};
