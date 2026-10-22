import { Transaction } from '@/types/fraud';

export interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  rocAuc: number;
  confusion: { tp: number; fp: number; tn: number; fn: number };
  rocCurve: { fpr: number; tpr: number }[];
  prCurve: { recall: number; precision: number }[];
}

// Treat riskScore >= 50 as predicted fraud, and status !== 'approved' as truth (for demo purposes)
export function computeModelMetrics(transactions: Transaction[]): ModelMetrics {
  const threshold = 50;
  let tp = 0, fp = 0, tn = 0, fn = 0;

  // Simulated ground truth: for the demo, ground truth is slightly noisier than status
  const labeled = transactions.map(t => {
    const truth = t.status !== 'approved' ? 1 : 0;
    // introduce small noise to ground truth so metrics aren't perfect
    const noisyTruth = Math.random() < 0.05 ? 1 - truth : truth;
    const pred = t.riskScore >= threshold ? 1 : 0;
    return { score: t.riskScore / 100, truth: noisyTruth, pred };
  });

  labeled.forEach(({ truth, pred }) => {
    if (pred === 1 && truth === 1) tp++;
    else if (pred === 1 && truth === 0) fp++;
    else if (pred === 0 && truth === 0) tn++;
    else fn++;
  });

  const accuracy = (tp + tn) / labeled.length;
  const precision = tp / Math.max(tp + fp, 1);
  const recall = tp / Math.max(tp + fn, 1);
  const f1 = (2 * precision * recall) / Math.max(precision + recall, 1e-9);

  // ROC curve
  const sorted = [...labeled].sort((a, b) => b.score - a.score);
  const P = sorted.filter(s => s.truth === 1).length || 1;
  const N = sorted.filter(s => s.truth === 0).length || 1;
  let tpCum = 0, fpCum = 0;
  const rocCurve: { fpr: number; tpr: number }[] = [{ fpr: 0, tpr: 0 }];
  const prCurve: { recall: number; precision: number }[] = [];
  sorted.forEach(({ truth }) => {
    if (truth === 1) tpCum++; else fpCum++;
    rocCurve.push({ fpr: fpCum / N, tpr: tpCum / P });
    prCurve.push({ recall: tpCum / P, precision: tpCum / Math.max(tpCum + fpCum, 1) });
  });

  // AUC via trapezoidal rule
  let auc = 0;
  for (let i = 1; i < rocCurve.length; i++) {
    auc += ((rocCurve[i].fpr - rocCurve[i - 1].fpr) * (rocCurve[i].tpr + rocCurve[i - 1].tpr)) / 2;
  }

  return {
    accuracy,
    precision,
    recall,
    f1,
    rocAuc: auc,
    confusion: { tp, fp, tn, fn },
    rocCurve,
    prCurve,
  };
}
