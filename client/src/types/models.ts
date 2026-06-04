import type { ProductType, ConsumableCategory, OrderStatus } from '../config';

export interface Roll {
  id: string;
  rollNo: string;
  type: ProductType;
  size: string;
  quality: string;
  meter: number;
  grossWeight: number;
  netWeight: number;
  createdAt: string;
}

export interface Consumable {
  id: string;
  category: ConsumableCategory;
  name: string;
  quantity: number;
  unit: string;
  notes?: string;
  createdAt: string;
}

export interface Order {
  id: string;
  orderId: string;          // NF-YYYYMMDD-XXXX
  clientName: string;
  productType: ProductType;
  length: number;
  width: number;
  gsm: number;
  sizeDisplay: string;      // "25 × 30 + 0.96 gm"
  quantityKg?: number;
  quantityNos?: number;
  quantityUnit: 'KG' | 'Nos' | 'Both';
  status: OrderStatus;
  notes?: string;
  billNo?: string;
  dispatchDate?: string;
  createdAt: string;
  dispatchedAt?: string;
}
