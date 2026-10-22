import { Transaction, FraudAlert, DashboardStats } from '@/types/fraud';

const merchants = ['Amazon', 'Walmart', 'Target', 'Best Buy', 'Apple Store', 'Gas Station', 'Restaurant', 'ATM Withdrawal', 'Online Gaming', 'Crypto Exchange', 'Wire Transfer', 'Luxury Goods', 'Electronics Hub', 'Travel Agency'];
const categories = ['Retail', 'Food & Dining', 'Travel', 'Entertainment', 'Utilities', 'Healthcare', 'Financial Services', 'E-Commerce'];
const locations = ['New York, US', 'London, UK', 'Tokyo, JP', 'Lagos, NG', 'Moscow, RU', 'São Paulo, BR', 'Dubai, AE', 'Mumbai, IN', 'Berlin, DE', 'Sydney, AU', 'Toronto, CA', 'Paris, FR'];
const devices = ['Mobile', 'Desktop', 'Tablet', 'POS Terminal'];
const fraudTypes = ['Velocity anomaly', 'Geographic mismatch', 'Unusual amount', 'New device', 'Card-not-present high risk', 'Multiple declined attempts', 'Suspicious merchant category', 'Cross-border unusual pattern'];
const names = ['John Smith', 'Sarah Johnson', 'Michael Chen', 'Emma Wilson', 'James Brown', 'Olivia Davis', 'William Miller', 'Sophia Anderson', 'Robert Taylor', 'Isabella Thomas', 'David Martinez', 'Mia Garcia', 'Charles Lee', 'Ava Robinson', 'Daniel White'];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateCardNumber(): string {
  const prefix = ['4', '5', '37', '6'][Math.floor(Math.random() * 4)];
  return `${prefix}*** **** **** ${Math.floor(1000 + Math.random() * 9000)}`;
}

function generateIP(): string {
  return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

export function generateTransactions(count: number): Transaction[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const riskScore = Math.random() * 100;
    const status: Transaction['status'] =
      riskScore > 85 ? 'blocked' :
      riskScore > 65 ? 'flagged' :
      riskScore > 50 ? 'reviewing' : 'approved';
    
    const indicators: string[] = [];
    if (riskScore > 40) indicators.push(randomFrom(fraudTypes));
    if (riskScore > 60) indicators.push(randomFrom(fraudTypes));
    if (riskScore > 80) indicators.push(randomFrom(fraudTypes));

    return {
      id: `TXN-${String(100000 + i).slice(1)}`,
      cardNumber: generateCardNumber(),
      cardHolder: randomFrom(names),
      amount: Math.round((Math.random() * (riskScore > 70 ? 15000 : 500) + 5) * 100) / 100,
      currency: 'USD',
      merchant: randomFrom(merchants),
      category: randomFrom(categories),
      location: randomFrom(locations),
      timestamp: new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      riskScore: Math.round(riskScore),
      status,
      ipAddress: generateIP(),
      deviceType: randomFrom(devices),
      fraudIndicators: [...new Set(indicators)],
    };
  }).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

export function generateAlerts(transactions: Transaction[]): FraudAlert[] {
  return transactions
    .filter(t => t.riskScore > 50)
    .slice(0, 20)
    .map((t, i) => ({
      id: `ALT-${String(1000 + i).slice(1)}`,
      transactionId: t.id,
      severity: t.riskScore > 85 ? 'critical' : t.riskScore > 70 ? 'high' : t.riskScore > 55 ? 'medium' : 'low',
      type: t.fraudIndicators[0] || 'Suspicious activity',
      message: `${t.fraudIndicators[0] || 'Suspicious activity'} detected on ${t.cardHolder}'s card — $${t.amount.toLocaleString()} at ${t.merchant}`,
      timestamp: t.timestamp,
      acknowledged: Math.random() > 0.6,
    }));
}

export function computeStats(transactions: Transaction[]): DashboardStats {
  const blocked = transactions.filter(t => t.status === 'blocked').length;
  const flagged = transactions.filter(t => t.status === 'flagged').length;
  const totalVolume = transactions.reduce((s, t) => s + t.amount, 0);
  const avgRisk = transactions.reduce((s, t) => s + t.riskScore, 0) / transactions.length;

  return {
    totalTransactions: transactions.length,
    totalVolume: Math.round(totalVolume),
    fraudRate: Math.round(((blocked + flagged) / transactions.length) * 10000) / 100,
    blockedTransactions: blocked,
    flaggedTransactions: flagged,
    avgRiskScore: Math.round(avgRisk),
  };
}

export function getRiskColor(score: number): string {
  if (score >= 80) return 'text-destructive';
  if (score >= 60) return 'text-warning';
  if (score >= 40) return 'text-yellow-400';
  return 'text-success';
}

export function getStatusColor(status: Transaction['status']): string {
  switch (status) {
    case 'blocked': return 'bg-destructive/20 text-destructive border-destructive/30';
    case 'flagged': return 'bg-warning/20 text-warning border-warning/30';
    case 'reviewing': return 'bg-primary/20 text-primary border-primary/30';
    case 'approved': return 'bg-success/20 text-success border-success/30';
  }
}

export function getSeverityColor(severity: FraudAlert['severity']): string {
  switch (severity) {
    case 'critical': return 'bg-destructive/20 text-destructive border-destructive/30';
    case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'medium': return 'bg-warning/20 text-warning border-warning/30';
    case 'low': return 'bg-primary/20 text-primary border-primary/30';
  }
}
