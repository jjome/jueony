export { planIntegerSeries } from '../domain/table-auto-fill.ts';
export type { IntegerSeries } from '../domain/table-auto-fill.ts';
export { planTableSeries } from '../domain/table-series.ts';
export type { TableSeries, DateFillUnit } from '../domain/table-series.ts';
export { planTableFormulaCopy, planTableFormulaRecalculation } from '../domain/table-formula-plan.ts';
export type FormulaFillOutput = 'formula' | 'value';
export type TableAutoFillPreview = { seedCount: number; step: number; description: string; values: readonly string[]; cells: readonly { row: number; column: number; text: string }[] };
