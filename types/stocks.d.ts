export type UOMStatus = "Active" | "Inactive" | "Allocated";
export type StockLocationStatus = "Active" | "Inactive" | "Allocated";
export type SupplierStatus = "Active" | "Inactive" | "Allocated";

export type UOM = {
  _id: string;
  clinicId: string;
  name: string;
  category: string;
  status: UOMStatus;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

export type StockLocation = {
  _id: string;
  clinicId: string;
  location: string;
  status: StockLocationStatus;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

export type Supplier = {
  _id: string;
  code: string;
  clinicId: string;
  branch: any;
  name: string;
  vatRegNo: string;
  telephone: string;
  mobile: string;
  email: string;
  url: string;
  creditDays: number;
  address: string;
  notes: string;
  status: SupplierStatus;
  openingBalance: number;
  openingBalanceType: "Debit" | "Credit";
  invoiceTotal: number;
  totalPaid: number;
  totalBalance: number;
  invoiceCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};
