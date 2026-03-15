import type { AccountEntry } from "./accountEntry";

export type ExtraordinaryExpenseType = 'multa' | 'donacion' | 'perdida_inmovilizado' | 'ingreso_extraordinario' | 'otro';

export interface ExtraordinaryExpense {
  date: string;
  type: ExtraordinaryExpenseType;
  description: string;
  amount: number;
  accountCode: string;
  accountName: string;
  counterpartAccountCode: string;
  counterpartAccountName: string;
  journalNote?: string;
  accountDebits: AccountEntry[];
  accountCredits: AccountEntry[];
}
