import { Transaction } from '@/types/fraud';

export interface FeatureContribution {
  feature: string;
  label: string;
  value: number; // -1..1 SHAP-style contribution
  description: string;
}

const highRiskLocations = ['Lagos, NG', 'Moscow, RU', 'Dubai, AE', 'Mumbai, IN'];
const highRiskMerchants = ['Crypto Exchange', 'Wire Transfer', 'Online Gaming', 'Luxury Goods'];

/** Deterministic pseudo-random from string. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) / 2147483647;
}

export function explainTransaction(t: Transaction): {
  confidence: number;
  contributions: FeatureContribution[];
  reasoning: string;
} {
  const seed = hash(t.id);
  const hour = t.timestamp.getHours();
  const offHours = hour < 6 || hour > 22;
  const amountZ = Math.min(1, Math.max(-1, (t.amount - 200) / 5000));
  const locRisk = highRiskLocations.includes(t.location) ? 0.7 + seed * 0.2 : -0.2 - seed * 0.2;
  const merchRisk = highRiskMerchants.includes(t.merchant) ? 0.55 + seed * 0.25 : -0.15 - seed * 0.1;
  const timeRisk = offHours ? 0.4 + seed * 0.15 : -0.2;
  const velocity = (t.riskScore / 100 - 0.5) * 1.4;
  const deviceRisk = t.deviceType === 'Mobile' && t.riskScore > 60 ? 0.3 : -0.1;

  const contributions: FeatureContribution[] = [
    { feature: 'amount_z', label: 'Transaction amount', value: amountZ, description: `$${t.amount.toLocaleString()} vs. typical cardholder spend` },
    { feature: 'location', label: 'Location risk', value: Math.max(-1, Math.min(1, locRisk)), description: `${t.location} — geographic risk profile` },
    { feature: 'merchant', label: 'Merchant category', value: Math.max(-1, Math.min(1, merchRisk)), description: `${t.merchant} baseline risk` },
    { feature: 'time', label: 'Time of day', value: Math.max(-1, Math.min(1, timeRisk)), description: offHours ? `Off-hours activity at ${hour}:00` : `Business hours (${hour}:00)` },
    { feature: 'velocity', label: 'Card velocity', value: Math.max(-1, Math.min(1, velocity)), description: 'Recent transaction cadence for this card' },
    { feature: 'device', label: 'Device signal', value: Math.max(-1, Math.min(1, deviceRisk)), description: `${t.deviceType} • ${t.ipAddress}` },
  ].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  const confidence = Math.min(0.999, Math.max(0.51, 0.5 + Math.abs(t.riskScore - 50) / 100 + seed * 0.05));

  const top = contributions[0];
  const reasoning =
    t.status === 'approved'
      ? `Model predicts legitimate with ${(confidence * 100).toFixed(1)}% confidence. Strongest supporting signal: ${top.label.toLowerCase()}.`
      : `Model flags this as suspicious with ${(confidence * 100).toFixed(1)}% confidence. Primary risk driver: ${top.label.toLowerCase()} — ${top.description.toLowerCase()}.`;

  return { confidence, contributions, reasoning };
}
