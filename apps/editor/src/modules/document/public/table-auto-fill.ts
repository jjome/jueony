export { planIntegerSeries } from '../domain/table-auto-fill.ts';
export type { IntegerSeries } from '../domain/table-auto-fill.ts';
export type TableAutoFillPreview = { step: number; values: readonly string[]; cells: readonly { row: number; column: number; text: string }[] };
