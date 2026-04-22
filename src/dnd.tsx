import { type Dispatch, type SetStateAction, useState } from "react";
import {
  type DragEndEvent,
  type DraggableAttributes,
  DndContext,
  closestCenter,
  useSensors,
  useSensor,
  PointerSensor,
  KeyboardSensor,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  restrictToHorizontalAxis,
  restrictToVerticalAxis,
  restrictToParentElement,
} from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";

type DisabledState = {
  disabled: boolean;
  setDisabled: Dispatch<SetStateAction<boolean>>;
};

export interface SortableRenderProps extends DisabledState {
  isDragging: boolean;
  listeners: any | undefined;
  attributes: DraggableAttributes;
}

interface SortableItemProps extends DisabledState {
  id: string;
  children: (props: SortableRenderProps) => React.JSX.Element;
}

export function SortableItem({
  id,
  disabled,
  setDisabled,
  children,
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : "auto",
  };

  return (
    <div ref={setNodeRef} style={style} className="pointer-events-auto">
      {children({ isDragging, attributes, listeners, disabled, setDisabled })}
    </div>
  );
}

type DndProps = {
  id: string;
  isBeside: boolean;
  items: string[];
  setItems: (a: any[]) => void;
  children: (props: DisabledState) => React.JSX.Element[];
};

export function Dnd({ id, isBeside, setItems, items, children }: DndProps) {
  const [disabled, setDisabled] = useState<boolean>(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 1,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  return (
    <DndContext
      sensors={sensors}
      id={id}
      collisionDetection={closestCenter}
      modifiers={[
        isBeside ? restrictToHorizontalAxis : restrictToVerticalAxis,
        restrictToParentElement,
      ]}
      onDragEnd={({ active, over }: DragEndEvent) => {
        if (over == null || active.id === over.id) return;
        const oldIndex = items.findIndex((t) => t === active.id);
        const newIndex = items.findIndex((t) => t === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        setItems(newItems);
      }}
    >
      <SortableContext
        items={items}
        strategy={
          isBeside ? horizontalListSortingStrategy : verticalListSortingStrategy
        }
      >
        {children({ disabled, setDisabled })}
      </SortableContext>
    </DndContext>
  );
}
