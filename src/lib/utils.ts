import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatIST(value: string | Date | null | undefined, includeTime = true): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return String(value);

  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(includeTime
      ? { hour: '2-digit', minute: '2-digit', hour12: true }
      : {}),
  };
  return `${new Intl.DateTimeFormat('en-IN', options).format(date)}${includeTime ? ' IST' : ''}`;
}

export function formatINR(amount: number | string | null | undefined): string {
  const num = Number(amount ?? 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(num) ? num : 0);
}

export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (val: string | number) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const csv = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadTablePDF(params: {
  title: string;
  subtitle: string;
  headers: string[];
  rows: (string | number)[][];
  filename: string;
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 595, 76, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text('IMPACT CAMPUS · Impact College of Engineering & Applied Sciences, Bengaluru', 40, 32);
  doc.setFontSize(10);
  doc.setTextColor(203, 213, 225);
  doc.text(`${params.title} · Generated ${formatIST(new Date())}`, 40, 52);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.text(params.subtitle, 40, 102);

  autoTable(doc, {
    startY: 118,
    head: [params.headers],
    body: params.rows.map((r) => r.map(String)),
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save(params.filename);
}
