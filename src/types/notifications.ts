export type ReportKind =
  | "daily-sales"
  | "product-sales"
  | "current-stock"
  | "low-stock"
  | "non-moving"
  | "profit-summary";

export interface ReportIntent {
  report: ReportKind;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
}

export interface InboxNotification {
  id: string;
  title: string;
  message: string;
  created_at: string;
  read: boolean;
  intent?: ReportIntent;
}
