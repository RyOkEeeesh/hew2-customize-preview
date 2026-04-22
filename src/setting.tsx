import { type RefObject, useEffect, useId, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useSetting } from './store';
import { clsx } from 'clsx';
import { LuSettings2 } from 'react-icons/lu';
import { motion, AnimatePresence } from 'framer-motion';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import { type BarPos } from './constants';
import InputLabel from '@mui/material/InputLabel';


type SettingTableProps = {
  contentRef: RefObject<HTMLDivElement>;
}

type SettingHeading = {
  id: string;
  text: string;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
}

function SettingTable({ contentRef }: SettingTableProps) {
  const [headings, setHeadings] = useState<SettingHeading[]>([]);
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    if (!contentRef.current) return;

    const container = contentRef.current;
    const elements = Array.from(
      container.querySelectorAll('.setting-table-head')
    ) as HTMLHeadingElement[];

    const mapped: SettingHeading[] = elements.map(el => ({
      id: el.id,
      text: el.innerText,
      onPointerDown: (e) => {
        e.preventDefault();
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }));

    setHeadings(mapped);

    const observer = new IntersectionObserver(
      entries => {
        const intersectingEntries = entries.filter(entry => entry.isIntersecting);

        if (intersectingEntries.length > 0) {
          const topmostEntry = intersectingEntries.reduce((prev, curr) => {
            return prev.boundingClientRect.top < curr.boundingClientRect.top ? prev : curr;
          });

          setActiveId(topmostEntry.target.id);
        }
      },
      {
        root: container,
        rootMargin: '0% 0px -50% 0px',
        threshold: 0
      }
    );

    elements.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [contentRef]);

  return (
    <div className='w-30 flex flex-col gap-2 border-r border-zinc-200 dark:border-zinc-600'>
      {headings.map(h => (
        <div
          key={h.id}
          className={clsx(
            'text-[14px] select-none cursor-pointer transition-colors',
            h.id === activeId ? 'font-bold text-blue-500' : 'text-txclr'
          )}
          onPointerDown={h.onPointerDown}
        >
          {h.text}
        </div>
      ))}
    </div>
  );
}

type SettingSectionProps = {
  title: string;
  children?: React.JSX.Element;
}

function SettingSection({ title, children }: SettingSectionProps) {
  return (
    <div className='flex flex-col gap-3'>
      <h2 className='setting-table-head' id={title}>{title}</h2>
      {children}
    </div>
  )
}

const POS_MAP: Record<BarPos, string> = {
  t: '上',
  b: '下',
  l: '左',
  r: '右',
}

type PosSectionProps = {
  val: BarPos;
  setVal: (p: BarPos) => void;
}

function PosSection({ val, setVal }: PosSectionProps) {
  const baseId = useId();
  const labelId = `${baseId}-label`;

  return (
    <FormControl
      variant='standard'
      sx={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
      }}
    >
      <InputLabel
        id={labelId}
        shrink
        sx={{
          position: 'static',
          transform: 'none',
          color: 'var(--txt-clr)',
          fontSize: '16px',
          cursor: 'pointer'
        }}
      >
        位置
      </InputLabel>

      <Select
        labelId={labelId}
        value={val}
        onChange={(e) => setVal(e.target.value as BarPos)}
        inputProps={{
          id: baseId,
        }}
        sx={{
          minWidth: 60,
          color: 'var(--txt-clr)',
          textAlign: 'center',
          '&:before': {
            borderBottom: '1px solid var(--txt-clr)',
          },
          '&:hover:not(.Mui-disabled):before': {
            borderBottom: '1px solid var(--txt-clr)',
          },
          '& .MuiSelect-icon': { color: 'var(--txt-clr)' },
        }}
      >
        {Object.entries(POS_MAP).map(([k, v]) => (
          <MenuItem key={`tool-${k}`} value={k} sx={{ justifyContent: 'center' }}>
            {v}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function ToolBarSetting() {
  const { toolBarPos, setToolBarPos } = useSetting(useShallow(s => ({ ...s })));
  return (
    <SettingSection title='ツールバー'>
      <PosSection val={toolBarPos} setVal={setToolBarPos} />
    </SettingSection>
  )
}

function OptionBarSetting() {
  const { optionBarPos, setOptionBarPos } = useSetting(useShallow(s => ({ ...s })));
  return (
    <SettingSection title='オプションバー'>
      <PosSection val={optionBarPos} setVal={setOptionBarPos} />
    </SettingSection>
  )
}

export default function Setting() {
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const contentRef = useRef<HTMLDivElement>(null!);
  return (
    <>
      <button
        className='absolute top-0 right-0 z-200 cursor-pointer'
        onPointerDown={() => setIsOpen(true)}
      >
        <LuSettings2 color='#3f3f46' size={36} />
      </button>
      <AnimatePresence>
        {isOpen && <motion.div
          key='setting'
          className='absolute h-full w-full top-0 left-0 bg-bgclr/50 text-txclr center z-250'
          initial={{ opacity: 0, transition: { duration: 0.05 } }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.05 } }}
          onPointerDown={() => setIsOpen(false)}
        >
          <div
            className='w-100 h-100 bg-bgclr rounded-2xl flex gap-4 px-4 py-8 overflow-hidden'
            onPointerDown={e => e.stopPropagation()}
          >
            <SettingTable contentRef={contentRef} />
            <div ref={contentRef} className='flex-1 h-full overflow-y-scroll scrollbar-hide flex flex-col gap-8 py-2'>

              <ToolBarSetting />
              <OptionBarSetting />

            </div>
          </div>
        </motion.div>}
      </AnimatePresence>
    </>
  )
}