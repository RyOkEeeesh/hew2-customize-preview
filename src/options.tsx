import React, { useState, useRef, useEffect, type Dispatch, type SetStateAction } from 'react';
import { colord } from 'colord';
import { useTools } from './store';
import { useShallow } from 'zustand/react/shallow';
import { RiExpandWidthFill, RiGuideFill } from 'react-icons/ri';
import { type OptionType, SOURCE_MAX, SOURCE_MIN } from './constants';
import clsx from 'clsx';
import { MdKeyboardArrowUp, MdKeyboardArrowDown } from 'react-icons/md';
import { type IconBaseProps, type IconType } from 'react-icons';
import Switch from '@mui/material/Switch';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';

type ChildrenProps = {
  setDisabled: Dispatch<SetStateAction<boolean>>;
};

type OptionMapType = Record<
  OptionType,
  {
    Icon: IconType | (() => React.JSX.Element);
    Children: (props: ChildrenProps) => React.JSX.Element;
  }
>;

const OPTIONS_MAP: OptionMapType = {
  color: {
    Icon: ColorIcon,
    Children: ColorPicker,
  },
  width: {
    Icon: RiExpandWidthFill,
    Children: Width,
  },
  lineHelper: {
    Icon: RiGuideFill,
    Children: LineHelper,
  },
};

function ColorIcon() {
  const { color } = useTools(useShallow(s => ({ ...s })));
  return (
    <div
      className='h-8 w-8 rounded-full border border-white 2xl:h-10 2xl:w-10'
      style={{
        backgroundColor: color,
      }}
    />
  );
}

type CircleColorProps = {
  color: string;
};

function CircleColor({ color }: CircleColorProps) {
  const { setColor } = useTools(useShallow(s => ({ ...s })));
  return (
    <button
      className='h-6 w-6 rounded-full border border-white transition-transform duration-150 hover:scale-120'
      onClick={() => setColor(color)}
      style={{
        backgroundColor: color,
      }}
      title={color}
    />
  );
}

function ColorPicker({ setDisabled }: ChildrenProps) {
  const { baseColor, color, hue, colors, setColor, setHue, pushColors } = useTools(
    useShallow(s => ({ ...s })),
  );
  const [sv, setSv] = useState({ s: colord(color).toHsv().s, v: colord(color).toHsv().v });
  const [query, setQuery] = useState<string>(colord(color).toHex().substring(0, 7));
  const hsv = colord(color).toHsv();
  const satRef = useRef<HTMLDivElement>(null);
  const nowSaturationChangeRef = useRef<boolean>(false);
  const nowHexChangeRef = useRef<boolean>(false);

  useEffect(() => {
    pushColors(color);
    if (!nowSaturationChangeRef.current) {
      const newHsv = colord(color).toHsv();
      if (newHsv.s !== 0 && newHsv.v !== 0) setHue(newHsv.h);
    }
    if (!nowHexChangeRef.current) setQuery(color);
  }, [color]);

  const updateSaturation = (e: React.PointerEvent | PointerEvent) => {
    if (!satRef.current) return;
    const rect = satRef.current.getBoundingClientRect();
    const x = Math.min(rect.width, Math.max(0, e.clientX - rect.left));
    const y = Math.min(rect.height, Math.max(0, e.clientY - rect.top));

    const s = (x / rect.width) * 100;
    const v = 100 - (y / rect.height) * 100;
    setSv({ s, v });

    const newColor = colord({ h: hue, s, v }).toHex().substring(0, 7);
    setColor(newColor);
  };

  return (
    <div>
      <div className='flex w-full flex-row-reverse items-center justify-between'>
        {[baseColor, ...colors].map(c => (
          <CircleColor key={c} color={c} />
        ))}
      </div>
      {/* Saturation */}
      <div className='mt-2 w-50 overflow-hidden bg-transparent font-sans select-none'>
        <div
          ref={satRef}
          onPointerDown={e => {
            e.stopPropagation();
            nowSaturationChangeRef.current = true;
            setDisabled(true);
            updateSaturation(e);

            const handleMove = (moveEvent: PointerEvent) => updateSaturation(moveEvent);
            const handleUp = () => {
              nowSaturationChangeRef.current = false;
              setDisabled(false);
              window.removeEventListener('pointermove', handleMove);
              window.removeEventListener('pointerup', handleUp);
            };

            window.addEventListener('pointermove', handleMove);
            window.addEventListener('pointerup', handleUp);
          }}
          className='relative h-36 cursor-crosshair touch-none overflow-hidden rounded-2xl'
          style={{ backgroundColor: `hsl(${hue}, 100%, 50%)` }}
        >
          <div className='absolute inset-0 bg-linear-to-r from-white to-transparent' />
          <div className='absolute inset-0 bg-linear-to-t from-black to-transparent' />
          <div
            className='pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm'
            style={{
              left: `${sv.s}%`,
              top: `${100 - sv.v}%`,
            }}
          />
        </div>

        <div className='mt-3'>
          <div className='flex items-center gap-2.5'>
            <div
              className='h-7 w-7 shrink-0 rounded-full border border-gray-100 shadow-inner'
              style={{ background: colord(hsv).toHex().substring(0, 7) }}
            />
            <div className='relative h-2.5 w-full'>
              {/* Hue */}
              <input
                type='range'
                min='0'
                max='359'
                value={hue}
                onPointerDown={e => {
                  e.stopPropagation();
                  setDisabled(true);
                }}
                onPointerUp={() => setDisabled(false)}
                onChange={e => {
                  const newH = Number(e.target.value);
                  setHue(newH);

                  const newColor = colord({ ...colord(color).toHsv(), h: newH })
                    .toHex()
                    .substring(0, 7);
                  setColor(newColor);
                }}
                className={clsx(
                  'absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-full outline-none',
                  `[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-gray-300 [&::-webkit-slider-thumb]:bg-white/30`,
                )}
                style={{
                  background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
                }}
              />
            </div>
          </div>

          <div className='mt-2.5 flex gap-1'>
            <div className='flex-1'>
              {/* Hex */}
              <input
                className='w-full rounded border border-gray-300 py-0.5 text-center text-[14px] outline-none focus:border-blue-400'
                value={query}
                onChange={e => {
                  const val = e.target.value;
                  setQuery(val.includes('#') ? val : `#${val}`);

                  const c = colord(val);
                  if (c.isValid()) {
                    const newColor = c.toHex().substring(0, 7);
                    setColor(newColor);
                  }
                }}
                onFocus={() => {
                  nowHexChangeRef.current = true;
                  setDisabled(true);
                }}
                onBlur={() => {
                  setDisabled(false);
                  nowHexChangeRef.current = false;
                  setQuery(colord(color).toHex().substring(0, 7));
                }}
                maxLength={7}
              />
              <span className='mt-1 block text-center text-[10px] text-gray-400 uppercase'>
                Hex
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Width({ setDisabled }: ChildrenProps) {
  const icon: IconBaseProps = { size: 16 };
  const { width, setWidth } = useTools(useShallow(s => ({ ...s })));
  const [query, setQuery] = useState<number>(width);

  const disableUp = width >= SOURCE_MAX;
  const disableDown = width <= SOURCE_MIN;
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInputtingRef = useRef<boolean>(false);
  const isArrowPressingRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isInputtingRef.current) setQuery(width);
  }, [width]);

  const handlePress = (delta: number) =>
    setWidth(prev => Math.min(SOURCE_MAX, Math.max(SOURCE_MIN, prev + delta)));

  const handlePressStart = (delta: number) => {
    isArrowPressingRef.current = true;
    handlePress(delta);
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => handlePress(delta), 60);
    }, 450);
  };

  const handlePressEnd = () => {
    isArrowPressingRef.current = false;
    setDisabled(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const targetType = e.currentTarget.type;
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
    if (
      e.key === 'ArrowUp' ||
      e.key === 'ArrowDown' ||
      (targetType === 'range' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft'))
    )
      e.preventDefault();
    if (isArrowPressingRef.current) return;
    if (!disableUp && (e.key === 'ArrowUp' || (targetType === 'range' && e.key === 'ArrowRight')))
      handlePressStart(1);
    if (
      !disableDown &&
      (e.key === 'ArrowDown' || (targetType === 'range' && e.key === 'ArrowLeft'))
    )
      handlePressStart(-1);
  };

  const handleInputKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isArrowPressingRef.current) return;
    const targetType = e.currentTarget.type;
    if (
      e.key === 'ArrowUp' ||
      e.key === 'ArrowDown' ||
      (targetType === 'range' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft'))
    )
      handlePressEnd();
  };

  return (
    <div className='center gap-2'>
      <input
        className={clsx(
          'h-2 w-30 cursor-pointer appearance-none rounded-full bg-zinc-300 accent-blue-500 outline-none',
          `[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-zinc-300 [&::-webkit-slider-thumb]:bg-white`,
        )}
        value={width}
        type='range'
        min={SOURCE_MIN}
        max={SOURCE_MAX}
        onKeyDown={handleInputKeyDown}
        onKeyUp={handleInputKeyUp}
        onPointerDown={e => {
          e.stopPropagation();
          setDisabled(true);
        }}
        onPointerUp={() => setDisabled(false)}
        onChange={e => {
          const n = Number(e.target.value);
          if (isNaN(n)) return;
          setWidth(Math.min(SOURCE_MAX, Math.max(SOURCE_MIN, n)));
        }}
      />
      <div className='center gap-1'>
        <input
          type='text'
          value={query === 0 ? '' : query}
          min={SOURCE_MIN}
          max={SOURCE_MAX}
          maxLength={3}
          onChange={e => {
            isInputtingRef.current = true;
            const n = Number(e.target.value);
            if (isNaN(n)) return;
            setQuery(n);
            setWidth(Math.min(SOURCE_MAX, Math.max(SOURCE_MIN, n)));
          }}
          onKeyDown={handleInputKeyDown}
          onKeyUp={handleInputKeyUp}
          onFocus={e => {
            e.stopPropagation();
            setDisabled(true);
          }}
          onBlur={() => {
            isInputtingRef.current = false;
            setDisabled(false);
            setQuery(p => {
              const n = Math.min(SOURCE_MAX, Math.max(SOURCE_MIN, p));
              setWidth(n);
              return n;
            });
          }}
          className='block w-8 border-b-2 border-transparent pt-0.5 text-center outline-none focus:border-zinc-300'
        />
        <div className='center flex-col gap-1'>
          <button
            className={clsx(
              'center rounded-sm hover:bg-zinc-600',
              disableUp ? 'cursor-default opacity-50' : 'cursor-pointer',
            )}
            onPointerDown={e => {
              e.stopPropagation();
              setDisabled(true);
              handlePressStart(1);
            }}
            onPointerUp={handlePressEnd}
            onPointerLeave={handlePressEnd}
            disabled={disableUp}
          >
            <MdKeyboardArrowUp {...icon} />
          </button>
          <button
            className={clsx(
              'center rounded-sm hover:bg-zinc-600',
              disableDown ? 'cursor-default opacity-50' : 'cursor-pointer',
            )}
            onPointerDown={e => {
              e.stopPropagation();
              setDisabled(true);
              handlePressStart(-1);
            }}
            onPointerUp={handlePressEnd}
            onPointerLeave={handlePressEnd}
            disabled={disableDown}
          >
            <MdKeyboardArrowDown {...icon} />
          </button>
        </div>
      </div>
    </div>
  );
}

type LineSwitchProps = {
  val: boolean;
  setVal: (b: boolean) => void;
  label: string;
}

function LineSwitch({ val, setVal, label }: LineSwitchProps) {
  return (
    <FormGroup>
      <FormControlLabel
        className='text-[14px]'
        control={
          <Switch
            color='primary'
            checked={val}
            onChange={(_, checked) => setVal(checked)}
          />
        }
        label={label}
        labelPlacement='start'
      />
    </FormGroup>
  )
}

function LineHelper() {
  const { lineChaikin, lineSmooth, setLineChaikin, setLineSmooth } = useTools.getState()
  return (
    <FormControl className='w-28 center'>
      <LineSwitch val={lineChaikin} setVal={setLineChaikin} label='角補正' />
      <LineSwitch val={lineSmooth} setVal={setLineSmooth} label='線補正' />
    </FormControl>
  );
}

export default OPTIONS_MAP;
