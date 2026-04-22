import { create } from 'zustand';
import {
  type BarPos,
  type OptionType,
  TOOL_MAP,
  type ToolType,
} from "./constants";
import { type Vector3Like } from "three";

export type History = {
  undo: () => void | Promise<void>;
  redo: () => void | Promise<void>;
  dispose?: () => void;
}

type HistoryState = {
  undoStack: History[];
  redoStack: History[];
  pushHistory: (cmd: History) => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  clearHistory: () => void;
};

const MAX_HISTORY = 50;

export const useHistory = create<HistoryState>((set, get) => ({
  undoStack: [],
  redoStack: [],

  pushHistory: cmd => {
    const { undoStack, redoStack } = get();
    redoStack.forEach(c => c.dispose?.());
    const newUndoStack = [...undoStack, cmd];
    if (newUndoStack.length > MAX_HISTORY) {
      const removed = newUndoStack.shift();
      removed?.dispose?.();
    }

    set({
      undoStack: newUndoStack,
      redoStack: [],
    });
  },

  undo: async () => {
    const { undoStack, redoStack } = get();
    if (undoStack.length === 0) return;

    const cmd = undoStack[undoStack.length - 1];
    await cmd.undo();

    set({
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, cmd],
    });
  },

  redo: async () => {
    const { undoStack, redoStack } = get();
    if (redoStack.length === 0) return;

    const cmd = redoStack[redoStack.length - 1];
    await cmd.redo();

    set({
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, cmd],
    });
  },

  clearHistory: () => {
    const { undoStack, redoStack } = get();
    [...undoStack, ...redoStack].forEach(c => c.dispose?.());
    set({ undoStack: [], redoStack: [] });
  },
}));

type ToolsState = {
  tool: ToolType;
  lineChaikin: boolean;
  lineSmooth: boolean;
  width: number;
  baseColor: string;
  color: string;
  colors: string[];
  hue: number;

  setTool: (t: ToolType) => void;
  setLineChaikin: (b: boolean) => void;
  setLineSmooth: (b: boolean) => void;
  setWidth: (w: number | ((prev: number) => number)) => void;
  setBaseColor: (c: string) => void;
  setColor: (c: string) => void;
  setHue: (h: number) => void;
  setColors: (c: string[]) => void;
  pushColors: (c: string) => void;
};

const maxClrLen = 5;

const getRandomColor = () => {
  const letters = '0123456789abcdef';
  const color = ['#'];
  for (let i = 0; i < 6; i++) color.push(letters[Math.floor(Math.random() * letters.length)]);
  return color.join('');
};

export const useTools = create<ToolsState>((set, get) => ({
  tool: 'preview',
  lineChaikin: true,
  lineSmooth: true,
  width: 20,
  baseColor: null!,
  color: getRandomColor(),
  hue: 0,
  colors: Array.from({ length: maxClrLen }, getRandomColor),

  setTool: tool => set({ tool }),
  setLineChaikin: (lineChaikin: boolean) => set({ lineChaikin }),
  setLineSmooth: (lineSmooth: boolean) => set({ lineSmooth }),
  setWidth: w => set(state => ({ width: typeof w === 'function' ? w(state.width) : w })),
  setBaseColor: baseColor => set({ baseColor }),
  setColor: color => set({ color }),
  setHue: hue => set({ hue }),
  setColors: colors => set({ colors }),
  pushColors: color => {
    if (color === get().baseColor) return;
    if (get().colors.find(c => c === color)) return;
    set({
      colors: [color, ...get().colors.filter(c => c !== color)].slice(0, maxClrLen),
    });
  },
}));

type OptionsOrder = Record<ToolType, OptionType[]>;

type SettingState = {
  toolBarPos: BarPos;
  toolsOrder: ToolType[];

  optionBarPos: BarPos;
  optionsOrder: OptionsOrder;

  setToolBarPos: (p: BarPos) => void;
  setToolsOrder: (t: ToolType[]) => void;
  setOptionBarPos: (p: BarPos) => void;
  setOptionsOrder: (o: OptionsOrder) => void;
  setToolOptionsOrder: (t: ToolType, o: OptionType[]) => void;
};

export const useSetting = create<SettingState>((set, get) => ({
  toolBarPos: 'l',
  toolsOrder: Object.keys(TOOL_MAP) as ToolType[],

  optionBarPos: 'l',
  optionsOrder: Object.entries(TOOL_MAP).reduce(
    (acc, [key, value]) => {
      acc[key as ToolType] = value.option;
      return acc;
    },
    {} as Record<ToolType, OptionType[]>,
  ),

  setToolBarPos: toolBarPos => set({ toolBarPos }),
  setToolsOrder: toolsOrder => set({ toolsOrder }),
  setOptionBarPos: optionBarPos => set({ optionBarPos }),
  setOptionsOrder: optionsOrder => set({ optionsOrder }),
  setToolOptionsOrder: (tool, op) =>
    set({
      optionsOrder: {
        ...get().optionsOrder,
        [tool]: op,
      },
    }),
}));

type TaskState = {
  working: string | null;
  setWorking: (w: string | null) => void;
}

export const useTasks = create<TaskState>(set => ({
  working: 'ロード中',
  setWorking: working => set({ working }),
}))

type OtherState = {
  trigger: boolean;
  defCamPos: Vector3Like;
  setTrigger: (t: boolean) => void;
  setDefCamPos: (v: Vector3Like) => void;
};

export const useOther = create<OtherState>(set => ({
  trigger: false,
  defCamPos: { x: 0, y: 0, z: 0 },
  setTrigger: trigger => set({ trigger }),
  setDefCamPos: defCamPos => set({ defCamPos }),
}));