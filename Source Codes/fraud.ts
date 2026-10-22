export interface Transaction {
  id: string;
  cardNumber: string;
  cardHolder: string;
  amount: number;
  currency: string;
  merchant: string;
  category: string;
  location: string;
  timestamp: Date;
  riskScore: number;
  status: 'approved' | 'flagged' | 'blocked' | 'reviewing';
  ipAddress: string;
  deviceType: string;
  fraudIndicators: string[];
}

export interface FraudAlert {
  id: string;
  transactionId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
}

export interface DashboardStats {
  totalTransactions: number;
  totalVolume: number;
  fraudRate: number;
  blockedTransactions: number;
  flaggedTransactions: number;
  avgRiskScore: number;
}
