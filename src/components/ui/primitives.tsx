import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'teal' | 'gold';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({
  className,
  variant = 'primary',
  size = 'md',
  children,
  ...props
}) => {
  const variants = {
    primary:
      'wine-gradient text-white border border-[#5A242B]/40 hover:brightness-105 shadow-sm disabled:opacity-50',
    secondary:
      'bg-[#F7F3EE] text-[#5A242B] hover:bg-[#EFE7DE] border border-[#E5DDD3] dark:bg-[#2A1A1D] dark:text-[#E5B8BE] dark:border-[#42292D] dark:hover:bg-[#362125] disabled:opacity-50',
    teal:
      'bg-[#16A34A] text-white hover:bg-[#15803D] border border-[#16A34A] dark:bg-[#16A34A] dark:text-white dark:hover:bg-[#15803D] dark:border-[#16A34A] shadow-xs disabled:opacity-50',
    gold:
      'bg-[#D4AF37] text-[#1F2937] hover:bg-[#C6A12E] border border-[#BD9827] font-semibold shadow-xs disabled:opacity-50',
    outline:
      'bg-white/95 text-[#1F2937] border border-[#E5E7EB] hover:bg-[#F7F3EE] hover:border-[#8B3A44]/40 dark:bg-[#221618] dark:text-[#FAF6F5] dark:border-[#38262A] dark:hover:bg-[#2D1D20] disabled:opacity-50',
    ghost:
      'bg-transparent text-[#4B5563] hover:bg-[#F7F3EE] dark:text-[#D1C4C6] dark:hover:bg-[#26191B] border border-transparent disabled:opacity-50',
    danger:
      'bg-[#B91C1C] text-white hover:bg-[#991B1B] border border-[#B91C1C] shadow-xs disabled:opacity-50',
  };

  const sizes = {
    sm: 'px-3.5 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-sm',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium whitespace-nowrap shrink-0 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#722F37] focus-visible:ring-offset-1 cursor-pointer disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

export const Surface: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => (
  <div
    className={cn(
      'glass-surface border border-[#E5E7EB] dark:border-[#332326] rounded-[20px]',
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({
  className,
  ...props
}) => (
  <input
    className={cn(
      'w-full rounded-xl border border-[#E5E7EB] dark:border-[#38262A] bg-white/95 dark:bg-[#150E10] px-3.5 py-2 text-sm text-[#1F2937] dark:text-[#FAF6F5] placeholder:text-[#6B7280] dark:placeholder:text-[#8E7D80] focus:outline-none focus:ring-2 focus:ring-[#722F37]/35 focus:border-[#722F37] transition-colors',
      className
    )}
    {...props}
  />
);

export const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({
  className,
  ...props
}) => (
  <textarea
    className={cn(
      'w-full rounded-xl border border-[#E5E7EB] dark:border-[#38262A] bg-white/95 dark:bg-[#150E10] px-3.5 py-2 text-sm text-[#1F2937] dark:text-[#FAF6F5] placeholder:text-[#6B7280] dark:placeholder:text-[#8E7D80] focus:outline-none focus:ring-2 focus:ring-[#722F37]/35 focus:border-[#722F37] transition-colors',
      className
    )}
    {...props}
  />
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({
  className,
  children,
  ...props
}) => (
  <select
    className={cn(
      'w-full rounded-xl border border-[#E5E7EB] dark:border-[#38262A] bg-white/95 dark:bg-[#150E10] px-3.5 py-2 text-sm text-[#1F2937] dark:text-[#FAF6F5] focus:outline-none focus:ring-2 focus:ring-[#722F37]/35 focus:border-[#722F37] transition-colors',
      className
    )}
    {...props}
  >
    {children}
  </select>
);

export const FieldLabel: React.FC<{
  children: React.ReactNode;
  required?: boolean;
}> = ({ children, required }) => (
  <label className="block text-xs font-medium text-[#374151] dark:text-[#D1C4C6] mb-1.5">
    {children}
    {required && <span className="text-[#722F37] dark:text-[#D48A94] ml-0.5">*</span>}
  </label>
);

export const StatusText: React.FC<{
  tone: 'success' | 'warning' | 'danger' | 'neutral' | 'info';
  children: React.ReactNode;
}> = ({ tone, children }) => {
  const tones = {
    success: 'text-[#15803D] dark:text-[#4ADE80]',
    warning: 'text-[#8A6D0B] dark:text-[#D4AF37]',
    danger: 'text-[#B91C1C] dark:text-[#F87171]',
    info: 'text-[#722F37] dark:text-[#D48A94]',
    neutral: 'text-[#6B7280] dark:text-[#B5A5A8]',
  };
  return (
    <span className={cn('text-xs font-semibold inline-flex items-center gap-1.5', tones[tone])}>
      {children}
    </span>
  );
};

export const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  helper?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: 'blue' | 'teal' | 'amber' | 'neutral' | 'brick' | 'gold' | 'success' | 'wine';
  onClick?: () => void;
}> = ({ label, value, helper, icon, accent = 'wine', onClick }) => {
  const iconBoxColors = {
    blue: 'bg-[#F7F3EE] text-[#722F37] dark:bg-[#2D1A1D] dark:text-[#D48A94]',
    brick: 'bg-[#F7F3EE] text-[#722F37] dark:bg-[#2D1A1D] dark:text-[#D48A94]',
    wine: 'bg-[#F7F3EE] text-[#722F37] dark:bg-[#2D1A1D] dark:text-[#D48A94]',
    teal: 'bg-[#16A34A]/12 text-[#15803D] dark:bg-[#16A34A]/20 dark:text-[#4ADE80]',
    success: 'bg-[#16A34A]/12 text-[#15803D] dark:bg-[#16A34A]/20 dark:text-[#4ADE80]',
    amber: 'bg-[#D4AF37]/18 text-[#8A6D0B] dark:bg-[#D4AF37]/15 dark:text-[#D4AF37]',
    gold: 'bg-[#D4AF37]/18 text-[#8A6D0B] dark:bg-[#D4AF37]/15 dark:text-[#D4AF37]',
    neutral: 'bg-[#F7F3EE] text-[#6B7280] dark:bg-[#26191B] dark:text-[#B5A5A8]',
  };
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'text-left w-full glass-surface border border-[#E5E7EB] dark:border-[#332326] rounded-[20px] p-5 transition-all duration-150',
        onClick &&
          'hover:border-[#722F37]/50 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-10px_rgba(114,47,55,0.18)] cursor-pointer'
      )}
    >
      <div className="flex items-center justify-between gap-2 text-xs text-[#6B7280] dark:text-[#B5A5A8]">
        <span className="font-medium">{label}</span>
        {icon && (
          <span
            className={cn(
              'w-8 h-8 rounded-xl flex items-center justify-center shrink-0',
              iconBoxColors[accent]
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <div className="mt-2.5 text-2xl font-bold font-mono tabular-nums text-[#1F2937] dark:text-[#FAF6F5]">
        {value}
      </div>
      {helper && <div className="mt-1.5 text-xs text-[#6B7280] dark:text-[#B5A5A8]">{helper}</div>}
    </Wrapper>
  );
};

export const TabBar: React.FC<{
  tabs: { id: string; label: string; count?: number }[];
  activeTab: string;
  onChange: (id: string) => void;
}> = ({ tabs, activeTab, onChange }) => (
  <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F7F3EE] dark:bg-[#221618] rounded-2xl border border-[#E5E7EB] dark:border-[#332326]">
    {tabs.map((t) => {
      const active = t.id === activeTab;
      return (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            'px-3.5 py-1.5 text-xs font-medium rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5',
            active
              ? 'bg-white dark:bg-[#120B0D] text-[#722F37] dark:text-[#D48A94] shadow-sm font-semibold'
              : 'text-[#6B7280] dark:text-[#B5A5A8] hover:text-[#1F2937] dark:hover:text-[#FAF6F5]'
          )}
        >
          <span>{t.label}</span>
          {t.count !== undefined && (
            <span className="font-mono text-[11px] opacity-80 tabular-nums">({t.count})</span>
          )}
        </button>
      );
    })}
  </div>
);

export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  maxWidth?: string;
  children: React.ReactNode;
}> = ({ open, onClose, title, subtitle, maxWidth = 'max-w-xl', children }) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#160B0D]/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          'w-full bg-white dark:bg-[#1B1214] border border-[#E5E7EB] dark:border-[#332326] rounded-[24px] shadow-2xl max-h-[90vh] flex flex-col overflow-hidden',
          maxWidth
        )}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-[#E5E7EB] dark:border-[#332326] bg-[#FCFAF8] dark:bg-[#221618]">
          <div>
            <h3 className="text-base font-semibold text-[#1F2937] dark:text-[#FAF6F5]">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8] mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-xl text-[#6B7280] hover:text-[#722F37] hover:bg-[#F7F3EE] dark:hover:bg-[#312124] dark:hover:text-[#FAF6F5] cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

export const EmptyState: React.FC<{
  title: string;
  description: string;
  action?: React.ReactNode;
}> = ({ title, description, action }) => (
  <div className="py-12 px-6 text-center border border-dashed border-[#D6D9DF] dark:border-[#38262A] bg-[#F7F3EE]/70 dark:bg-[#181012] rounded-[20px]">
    <p className="text-sm font-medium text-[#1F2937] dark:text-[#FAF6F5]">{title}</p>
    <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8] mt-1 max-w-md mx-auto">
      {description}
    </p>
    {action && <div className="mt-4">{action}</div>}
  </div>
);
