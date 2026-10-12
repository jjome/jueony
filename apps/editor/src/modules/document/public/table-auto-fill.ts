export { planIntegerSeries } from '../domain/table-auto-fill.ts';
export type { IntegerSeries } from '../domain/table-auto-fill.ts';
export { planTableSeries } from '../domain/table-series.ts';
export type { TableSeries } from '../domain/table-series.ts';
export type TableAutoFillPreview = { step: number; description: string; values: readonly string[]; cells: readonly { row: number; column: number; text: string }[] };
