import { useState, useMemo } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

export interface TreeNode {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
  badgeVariant?: 'default' | 'secondary' | 'outline';
  children?: TreeNode[];
  data?: unknown;
}

interface TreeViewProps {
  nodes: TreeNode[];
  selectedId?: string;
  onSelect?: (node: TreeNode) => void;
  searchable?: boolean;
  defaultExpandAll?: boolean;
  className?: string;
}

function filterNodes(nodes: TreeNode[], query: string): TreeNode[] {
  if (!query) return nodes;
  const lower = query.toLowerCase();
  const result: TreeNode[] = [];
  for (const node of nodes) {
    const filteredChildren = node.children ? filterNodes(node.children, query) : undefined;
    const matches = node.label.toLowerCase().includes(lower);
    if (matches || (filteredChildren && filteredChildren.length > 0)) {
      result.push({ ...node, children: filteredChildren });
    }
  }
  return result;
}

function collectIds(nodes: TreeNode[]): Set<string> {
  const ids = new Set<string>();
  function walk(list: TreeNode[]) {
    for (const n of list) {
      ids.add(n.id);
      if (n.children) walk(n.children);
    }
  }
  walk(nodes);
  return ids;
}

interface NodeItemProps {
  node: TreeNode;
  depth: number;
  selectedId?: string;
  onSelect?: (node: TreeNode) => void;
  expanded: Set<string>;
  onToggle: (id: string) => void;
}

function NodeItem({ node, depth, selectedId, onSelect, expanded, onToggle }: NodeItemProps) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  const isSelected = node.id === selectedId;

  function handleClick() {
    if (hasChildren) onToggle(node.id);
    onSelect?.(node);
  }

  return (
    <div>
      <div
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={hasChildren ? isExpanded : undefined}
        tabIndex={0}
        className={cn(
          'flex items-center gap-1.5 py-1.5 pr-2 rounded-lg cursor-pointer text-sm select-none outline-none',
          'focus-visible:ring-2 focus-visible:ring-blue-400',
          isSelected
            ? 'bg-blue-50 text-blue-700 font-medium'
            : 'text-slate-700 hover:bg-slate-100',
        )}
        style={{ paddingLeft: 8 + depth * 20 }}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        {hasChildren ? (
          <ChevronRight
            size={14}
            className={cn(
              'shrink-0 transition-transform duration-150',
              isExpanded && 'rotate-90',
            )}
          />
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        {node.icon && <span className="shrink-0">{node.icon}</span>}
        <span className="flex-1 truncate">{node.label}</span>
        {node.badge !== undefined && (
          <Badge variant={node.badgeVariant ?? 'secondary'} className="ml-auto text-xs">
            {node.badge}
          </Badge>
        )}
      </div>
      {hasChildren && isExpanded && (
        <div role="group">
          {node.children!.map((child) => (
            <NodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TreeView({
  nodes,
  selectedId,
  onSelect,
  searchable = false,
  defaultExpandAll = false,
  className,
}: TreeViewProps) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    if (defaultExpandAll) return collectIds(nodes);
    return new Set<string>();
  });

  const visibleNodes = useMemo(() => filterNodes(nodes, query), [nodes, query]);

  const effectiveExpanded = useMemo(() => {
    if (query) return collectIds(visibleNodes);
    return expanded;
  }, [query, visibleNodes, expanded]);

  function handleToggle(id: string) {
    if (query) return; // no manual toggle while searching
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className={cn('flex flex-col gap-1', className)} role="tree">
      {searchable && (
        <div className="relative mb-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <Input
            placeholder="Buscar..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8 h-8 text-sm rounded-xl"
          />
        </div>
      )}
      {visibleNodes.length === 0 ? (
        <p className="text-sm text-slate-400 px-2 py-3 text-center">
          {query ? 'Nenhum resultado encontrado.' : 'Nenhum item.'}
        </p>
      ) : (
        visibleNodes.map((node) => (
          <NodeItem
            key={node.id}
            node={node}
            depth={0}
            selectedId={selectedId}
            onSelect={onSelect}
            expanded={effectiveExpanded}
            onToggle={handleToggle}
          />
        ))
      )}
    </div>
  );
}
