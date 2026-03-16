// src/domains/dados/configs/entity-registry.ts

export type ColumnType = 'text' | 'number' | 'select' | 'boolean' | 'date';

export interface ColumnDef {
  key: string;           // DB column name
  label: string;         // Display name in PT-BR
  type: ColumnType;
  required: boolean;
  options?: string[];    // For 'select' type
  editable?: boolean;    // Can be bulk-edited (default true)
  exportable?: boolean;  // Include in exports (default true)
}

export interface EntityConfig {
  key: string;           // Unique identifier (e.g., 'materiais')
  table: string;         // Supabase table name
  label: string;         // PT-BR display name
  labelPlural: string;   // PT-BR plural
  icon: string;          // lucide-react icon name
  updateKeys: string[];  // Fields used to identify existing records (first match wins)
  columns: ColumnDef[];
  requiredColumns: string[];  // Must be non-empty for import
  templateExamples: Record<string, string>[]; // 2-3 example rows for template
  bulkActions?: {        // Actions available in batch
    field: string;
    label: string;
    type: ColumnType;
    options?: string[];
  }[];
  importOrder: number;   // Recommended import order (for dependency resolution)
}

// Registry — imported by all consumers
const registry = new Map<string, EntityConfig>();

export function registerEntity(config: EntityConfig) {
  registry.set(config.key, config);
}

export function getEntity(key: string): EntityConfig | undefined {
  return registry.get(key);
}

export function getAllEntities(): EntityConfig[] {
  return Array.from(registry.values()).sort((a, b) => a.importOrder - b.importOrder);
}

