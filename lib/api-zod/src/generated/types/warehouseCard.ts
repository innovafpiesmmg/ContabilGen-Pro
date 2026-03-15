export interface WarehouseMovement {
  date: string;
  concept: string;
  document: string;
  entryQty: number;
  entryUnitCost: number;
  entryTotal: number;
  exitQty: number;
  exitUnitCost: number;
  exitTotal: number;
  balanceQty: number;
  balanceUnitCost: number;
  balanceTotal: number;
}

export interface WarehouseCard {
  productCode: string;
  productDescription: string;
  accountCode: string;
  valuationMethod: string;
  movements: WarehouseMovement[];
}
