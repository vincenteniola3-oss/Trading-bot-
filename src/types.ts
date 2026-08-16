export interface BotStatus {
  isRunning: boolean;
  lastScanTime: string;
  pid: number | null;
  exchange: string;
  testnet: boolean;
}

export interface TestStatus {
  lastRun: string;
  passed: boolean;
  output: string;
  totalTests: number;
  isRunning: boolean;
}

export interface MarketPair {
  symbol: string;
  price: number;
  dailyOpen: number;
  changePct: number;
  volume: number;
  isSignal: boolean;
  isLocked: boolean;
  exchange: string;
  justCrossed?: boolean;
  fundingRate?: number;
  fundingRatePct?: number;
  nextFundingTime?: number;
}

export interface Position {
  id: number;
  symbol: string;
  side: "buy" | "sell";
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  takeProfitPrice?: number;
  takeProfitType?: string;
  candleCloseTime?: number;
  dailyOpen: number;
  openedAt: string;
  unrealizedPnlUsdt: number;
  unrealizedPnlPct: number;
  exchange: string;
  isLive?: boolean;
  orderId?: string;
  fundingRate?: number;
  fundingRatePct?: number;
  nextFundingTime?: number;
  estimatedFundingFeeUsdt?: number;
}

export interface TradeHistoryItem {
  id: number;
  symbol: string;
  side: "buy" | "sell";
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnlPct: number;
  pnlUsdt: number;
  dailyOpen: number;
  openedAt: string;
  closedAt: string;
  durationSec: number;
  exchange: string;
  isLive?: boolean;
  orderId?: string;
}

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

export interface BinanceAccountInfo {
  connected: boolean;
  canTrade?: boolean;
  canDeposit?: boolean;
  canWithdraw?: boolean;
  feeTier?: number;
  walletBalance: number;
  availableBalance: number;
  unrealizedPnl: number;
  assets?: {
    asset: string;
    walletBalance: number;
    availableBalance: number;
    unrealizedProfit: number;
  }[];
  positions?: {
    symbol: string;
    positionAmt: number;
    entryPrice: number;
    unrealizedProfit: number;
    leverage: number;
    isolated: boolean;
    positionSide: string;
  }[];
  apiKeyMasked?: string | null;
  exchange?: string;
  error?: string;
}

export interface BotConfigState {
  apiKey: string;
  apiSecret: string;
  exchangeId: string;
  testnet: boolean;
  quoteCurrency: string;
  positionSizeMode: "fixed" | "percent";
  fixedTradeSizeUsdt: number;
  percentOfBalance: number;
  entryThresholdPct: number;
  takeProfitPct: number;
  telegramToken: string;
  telegramChatId: string;
  telegramEnabled: boolean;
  excludedSymbols: string;
}
