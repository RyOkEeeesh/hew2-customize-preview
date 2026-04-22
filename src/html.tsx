import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useSetting, useHistory, useTools, useOther } from './store';
import { TOOL_MAP, type OptionType, type ToolType } from './constants';
import { clsx } from 'clsx';
import { IconContext } from 'react-icons';
import { LuRedo2, LuUndo2, LuSave } from 'react-icons/lu';
import { Dnd, SortableItem, type SortableRenderProps } from './dnd';
import OPTIONS_MAP from './options';
import Setting from './setting';

const BTN = 'w-10 h-10 min-w-10 min-h-10 2xl:w-12 2xl:h-12 2xl:min-w-12 2xl:min-h-12 center bg-zinc-700 rounded-3xl';
const OTHER_BTN = clsx(BTN, 'transform transition-all duration-100');
const OTHER_BTN_ABLE = 'cursor-pointer active:scale-90 pointer-events-auto';

function OtherTools() {
  const { trigger, setTrigger } = useOther.getState();
  const { undo, redo, canUndo, canRedo } = useHistory(
    useShallow(s => ({
      undo: s.undo,
      redo: s.redo,
      canUndo: s.undoStack.length > 0,
      canRedo: s.redoStack.length > 0,
    }))
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        if (e.shiftKey) redo();
        else undo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return (
    <>
      <button
        className={clsx(OTHER_BTN, canUndo ? OTHER_BTN_ABLE : 'opacity-50')}
        onClick={undo}
        disabled={!canUndo}
        title='元に戻す'
      >
        <LuUndo2 />
      </button>
      <button
        className={clsx(OTHER_BTN, canRedo ? OTHER_BTN_ABLE : 'opacity-50')}
        onClick={redo}
        disabled={!canRedo}
        title='やり直す'
      >
        <LuRedo2 />
      </button>
      <button
        className={clsx(OTHER_BTN, trigger ? 'opacity-50' : OTHER_BTN_ABLE)}
        onClick={() => setTrigger(true)}
        disabled={trigger}
        title='保存'
      >
        <LuSave />
      </button>
    </>
  )
}

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!ref.current) return;

    const el = ref.current;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setSize({
        width: rect.width,
        height: rect.height,
      });
    };

    update();

    const observer = new ResizeObserver(update);
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  return { ref, size };
}

interface ToolBtnProps extends SortableRenderProps {
  t: ToolType;
}

function ToolBtn({ t, isDragging, attributes, listeners }: ToolBtnProps) {
  const { tool, setTool } = useTools(useShallow(s => ({ ...s })));
  const { title, Icon } = TOOL_MAP[t];
  const isTool = tool === t;
  return (
    <button
      {...attributes}
      {...listeners}
      className={clsx(BTN, 'transform transition-transform duration-150', isTool ? 'scale-120' : !isDragging && 'hover:scale-110 cursor-pointer', isDragging && 'cursor-grabbing')}
      onClick={() => setTool(t)}
      disabled={isTool}
      title={title}
    >
      <Icon />
    </button>
  )
}

function Toolbar() {
  const { toolBarPos, toolsOrder, setToolsOrder } = useSetting(useShallow(s => ({ ...s })));
  const isBeside = toolBarPos === 't' || toolBarPos === 'b';

  return (
    <div className={clsx(isBeside ? 'w-full h-13 2xl:h-16' : 'h-full w-13 2xl:w-16', 'center gap-4', !isBeside && 'flex-col')}>
      <div className={clsx(isBeside ? 'h-full' : 'w-full', 'center gap-4', !isBeside && 'flex-col')}>
        <Dnd
          id='toolbar'
          isBeside={isBeside}
          setItems={setToolsOrder}
          items={toolsOrder}
        >
          {props =>
            toolsOrder.map(t => (
              <SortableItem key={t} id={t} {...props}>{
                props => <ToolBtn t={t} {...props} />
              }</SortableItem>
            ))
          }
        </Dnd>
      </div>
      <OtherTools />
    </div>
  );
}

interface OptionBtnProps extends SortableRenderProps {
  op: OptionType;
}

function OptionBtn({ op, isDragging, attributes, listeners, disabled, setDisabled }: OptionBtnProps) {
  const { ref, size } = useElementSize<HTMLDivElement>();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isHovering, setIsHovering] = useState<boolean>(false);
  const { Icon, Children } = OPTIONS_MAP[op];

  useEffect(() => {
    if (!disabled && !isHovering) {
      setIsOpen(false);
    }
  }, [disabled, isHovering]);

  useEffect(() => {
    if (isDragging) {
      setIsOpen(false);
      setIsHovering(false);
    }
  }, [isDragging]);

  return (
    <div
      {...attributes}
      {...listeners}
      onPointerEnter={() => {
        setIsHovering(true);
        if (!isDragging) setIsOpen(true);
      }}
      onPointerLeave={() => {
        setIsHovering(false);
        if (!disabled) setIsOpen(false);
      }}
      className={clsx(
        BTN,
        'px-0 overflow-hidden',
        !isDragging && 'transition-all duration-300'
      )}
      style={isOpen && !isDragging
        ? { width: size.width, height: size.height }
        : { width: undefined, height: undefined }
      }
    >
      <div ref={ref} className='p-3'>
        {isOpen ? <Children setDisabled={setDisabled} /> : <Icon />}
      </div>
    </div>
  );
}
function OptionBar() {
  const { tool } = useTools(useShallow(s => ({ ...s })));
  const { toolBarPos, optionBarPos, optionsOrder, setToolOptionsOrder } = useSetting(useShallow(s => ({ ...s })));
  const items = optionsOrder[tool];
  const isBeside = optionBarPos === 't' || optionBarPos === 'b';
  const isStart = optionBarPos === 't' || optionBarPos === 'l';

  const toolbarSpacing = {
    t: 'pb-13 2xl:pb-16',
    b: 'pt-13 2xl:pt-16',
    l: 'pr-13 2xl:pr-16',
    r: 'pl-13 2xl:pl-16',
  };

  const containerClasses = clsx(
    isBeside ? 'w-full' : 'h-full',
    'absolute center',
    isStart ? 'top-0 left-0 items-start' : 'bottom-0 right-0 items-end',
    !isBeside && (toolBarPos === 't' || toolBarPos === 'b') && toolbarSpacing[toolBarPos],
    isBeside && (toolBarPos === 'l' || toolBarPos === 'r') && toolbarSpacing[toolBarPos]
  );

  return (
    <div className={containerClasses}>
      <div className={clsx(
        'text-neutral-100 flex justify-center gap-4 p-1',
        isBeside ? 'h-full flex-row' : 'w-full flex-col',
        isStart ? 'items-start' : 'items-end',
      )}>
        <Dnd
          id='optionbar'
          isBeside={isBeside}
          setItems={e => setToolOptionsOrder(tool, e)}
          items={items}
        >
          {props =>
            items.map(o => (
              <SortableItem key={o} id={o} {...props}>
                {props => <OptionBtn op={o} {...props} />}
              </SortableItem>
            ))
          }
        </Dnd>
      </div>
    </div>
  );
}

export default function HtmlUI() {
  const { toolBarPos } = useSetting(useShallow(s => ({ ...s })));
  return (
    <IconContext.Provider value={{ color: '#fff', size: '24px' }}>
      <Setting />
      <div
        className={clsx('absolute h-full w-full pointer-events-none z-50 flex', toolBarPos === 'r' && 'flex-row-reverse', toolBarPos === 't' && 'flex-col', toolBarPos === 'b' && 'flex-col-reverse')}
      >
        <Toolbar />
        <div className='relative h-full w-full pointer-events-none' >
          <OptionBar />
        </div>
      </div>
    </IconContext.Provider>
  );
}