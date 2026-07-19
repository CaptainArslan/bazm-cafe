export type SafeCustomer = {
  id: string;
  name: string;
  phone: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CustomerFinancialSummary = {
  orderCount: number;
  unpaidOrderCount: number;
  partiallyPaidOrderCount: number;
  outstandingBalance: string;
};

export type CustomerDetail = SafeCustomer & {
  summary: CustomerFinancialSummary;
};
