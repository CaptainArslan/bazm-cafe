export type SafeCustomer = {
  id: string;
  name: string;
  phone: string | null;
  imagePath: string | null;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
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
