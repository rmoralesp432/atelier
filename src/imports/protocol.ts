import type { ImportDetail } from './detail';
import type { ImportOptions, PreparedImport } from './mesh';

export type ImportRequest =
  | { type: 'load'; file: File; detail: ImportDetail }
  | {
      type: 'prepare';
      revision: number;
      options: ImportOptions;
      separate: boolean;
      checkSolids: boolean;
    }
  | { type: 'take'; revision: number };
export type ImportInfo = {
  name: string;
  format: string;
  triangles: number;
  sourceTriangles: number;
  parts?: number;
  warnings: string[];
};
export type ImportPreview = {
  dimensions: PreparedImport['dimensions'];
  count: number;
  solids: number;
};
export type ImportReply =
  | { type: 'progress'; text: string }
  | { type: 'loaded'; info: ImportInfo }
  | { type: 'preview'; revision: number; preview: ImportPreview }
  | { type: 'result'; revision: number; prepared: PreparedImport }
  | { type: 'error'; revision?: number; text: string };
