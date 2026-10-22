import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Papa from 'papaparse';
import { Transaction } from '@/types/fraud';
import { supabase } from '@/integrations/supabase/client';

export function buildCSVBlob(transactions: Transaction[]): Blob {
  const rows = transactions.map(t => ({
    transaction_id: t.id,
    card_holder: t.cardHolder,
    card_number: t.cardNumber,
    amount: t.amount,
    currency: t.currency,
    merchant: t.merchant,
    category: t.category,
    location: t.location,
    device: t.deviceType,
    ip_address: t.ipAddress,
    timestamp: t.timestamp.toISOString(),
    risk_score: t.riskScore,
    confidence: (t.riskScore / 100).toFixed(4),
    prediction: t.status === 'approved' ? 'LEGITIMATE' : 'FRAUD',
    status: t.status,
    fraud_indicators: t.fraudIndicators.join('; '),
  }));

  const csv = Papa.unparse(rows);
  return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
}

export function downloadCSV(transactions: Transaction[], filename = 'fraud-predictions.csv') {
  triggerDownload(buildCSVBlob(transactions), filename);
}

export function buildPDFDoc(
  transactions: Transaction[],
  metrics: { accuracy: number; precision: number; recall: number; f1: number; rocAuc: number }
): jsPDF {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 36, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('FraudGuard Detection Report', 14, 18);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 200, 230);
  doc.text(`Generated ${new Date().toLocaleString()}`, 14, 27);

  doc.setTextColor(20, 20, 20);
  let y = 48;

  // Summary
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Executive Summary', 14, y);
  y += 6;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const flagged = transactions.filter(t => t.status !== 'approved').length;
  const volume = transactions.reduce((s, t) => s + t.amount, 0);
  doc.text(
    [
      `Total Transactions Analyzed: ${transactions.length}`,
      `Total Volume: $${volume.toLocaleString()}`,
      `Flagged / Blocked / Reviewing: ${flagged} (${((flagged / transactions.length) * 100).toFixed(2)}%)`,
      `Average Risk Score: ${(transactions.reduce((s, t) => s + t.riskScore, 0) / transactions.length).toFixed(1)}`,
    ],
    14,
    y + 5
  );
  y += 32;

  // Metrics
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Model Performance Metrics', 14, y);
  y += 4;
  autoTable(doc, {
    startY: y + 2,
    head: [['Metric', 'Score']],
    body: [
      ['Accuracy', `${(metrics.accuracy * 100).toFixed(2)}%`],
      ['Precision', `${(metrics.precision * 100).toFixed(2)}%`],
      ['Recall', `${(metrics.recall * 100).toFixed(2)}%`],
      ['F1-Score', `${(metrics.f1 * 100).toFixed(2)}%`],
      ['ROC-AUC', metrics.rocAuc.toFixed(4)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 10 },
  });

  // Top transactions
  const top = [...transactions].sort((a, b) => b.riskScore - a.riskScore).slice(0, 25);
  autoTable(doc, {
    startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10,
    head: [['ID', 'Holder', 'Amount', 'Merchant', 'Risk', 'Prediction']],
    body: top.map(t => [
      t.id,
      t.cardHolder,
      `$${t.amount.toLocaleString()}`,
      t.merchant,
      String(t.riskScore),
      t.status === 'approved' ? 'Legit' : 'FRAUD',
    ]),
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 9 },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 5 && data.cell.raw === 'FRAUD') {
        data.cell.styles.textColor = [220, 38, 38];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  return doc;
}

export function downloadPDFReport(
  transactions: Transaction[],
  metrics: { accuracy: number; precision: number; recall: number; f1: number; rocAuc: number },
  filename = 'fraud-detection-report.pdf'
) {
  buildPDFDoc(transactions, metrics).save(filename);
}

export async function saveReport(
  kind: 'csv' | 'pdf',
  title: string,
  transactions: Transaction[],
  metrics: { accuracy: number; precision: number; recall: number; f1: number; rocAuc: number }
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const filename = `${Date.now()}-${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${kind}`;
  const path = `${user.id}/${filename}`;
  let blob: Blob;
  if (kind === 'csv') blob = buildCSVBlob(transactions);
  else blob = buildPDFDoc(transactions, metrics).output('blob');

  const { error: upErr } = await supabase.storage.from('reports').upload(path, blob, {
    contentType: kind === 'csv' ? 'text/csv' : 'application/pdf',
  });
  if (upErr) return null;

  const fraudCount = transactions.filter(t => t.status !== 'approved').length;
  await supabase.from('reports').insert({
    user_id: user.id,
    title,
    kind,
    storage_path: path,
    summary: { transactionCount: transactions.length, fraudCount } as never,
  });
  await supabase.from('activity_logs').insert({
    user_id: user.id, actor_email: user.email, action: 'report_generated', metadata: { kind, title } as never,
  });
  return path;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
