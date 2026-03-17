import React, { useState } from 'react';
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';

export interface KanbanColumn<T> {
  id: string;
  title: string;
  color: string;
  items: T[];
}

interface KanbanBoardProps<T extends { id: string }> {
  columns: KanbanColumn<T>[];
  renderCard: (item: T, isDragging?: boolean) => React.ReactNode;
  onDrop: (itemId: string, fromColumnId: string, toColumnId: string) => void;
  isLoading?: boolean;
  emptyLabel?: string;
}

function SortableCard<T extends { id: string }>({
  item,
  renderCard,
}: {
  item: T;
  renderCard: (item: T, isDragging?: boolean) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={cn(
        'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-40'
      )}
    >
      {renderCard(item, isDragging)}
    </div>
  );
}

export default function KanbanBoard<T extends { id: string }>({
  columns,
  renderCard,
  onDrop,
  isLoading,
  emptyLabel = 'Nenhum item',
}: KanbanBoardProps<T>) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const columnForItem = (itemId: string) =>
    columns.find((col) => col.items.some((i) => i.id === itemId));

  const handleDragStart = (e: DragStartEvent) =>
    setActiveId(String(e.active.id));

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;

    const fromCol = columnForItem(String(active.id));
    const toCol =
      columns.find((col) => col.id === String(over.id)) ??
      columnForItem(String(over.id));

    if (fromCol && toCol && fromCol.id !== toCol.id) {
      onDrop(String(active.id), fromCol.id, toCol.id);
    }
  };

  const activeItem = activeId
    ? columns.flatMap((c) => c.items).find((i) => i.id === activeId)
    : null;

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="min-w-[280px] bg-slate-100 rounded-2xl h-64 animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => (
          <div
            key={col.id}
            className="min-w-[280px] max-w-[320px] flex-shrink-0 flex flex-col gap-2"
          >
            {/* Column header */}
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white border border-slate-200">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: col.color }}
                />
                <span className="text-sm font-semibold text-slate-700">
                  {col.title}
                </span>
              </div>
              <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                {col.items.length}
              </span>
            </div>

            {/* Drop zone */}
            <SortableContext
              items={col.items.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div
                id={col.id}
                className="flex flex-col gap-2 min-h-[120px] p-2 rounded-xl bg-slate-50 border border-dashed border-slate-200"
              >
                {col.items.length === 0 ? (
                  <div className="text-xs text-slate-400 text-center py-8">
                    {emptyLabel}
                  </div>
                ) : (
                  col.items.map((item) => (
                    <SortableCard
                      key={item.id}
                      item={item}
                      renderCard={renderCard}
                    />
                  ))
                )}
              </div>
            </SortableContext>
          </div>
        ))}
      </div>

      <DragOverlay>
        {activeItem ? renderCard(activeItem, true) : null}
      </DragOverlay>
    </DndContext>
  );
}
