import { type TypedArray } from 'three';
import { type IconType } from 'react-icons';
import { Eraser } from 'lucide-react';
import { FaRegHand } from 'react-icons/fa6';
import { LuPen, LuPaintBucket } from 'react-icons/lu';

export type CSGType = 'union' | 'sub' | 'intersect';

export type CSGMsg = {
  type: CSGType;
  obj: {
    positionA: TypedArray;
    normalA: TypedArray;
    indexA?: TypedArray;
    positionB: TypedArray;
    normalB: TypedArray;
    indexB?: TypedArray;
  };
};

export type CSGResult = {
  success: boolean;
  result?: {
    position: Float32Array;
    normal: Float32Array;
    index: Uint32Array | null;
  };
  error?: string;
};

export type IslMsg = {
  positions: TypedArray;
  normals: TypedArray;
};

export type IslResult = {
  success: boolean;
  result: {
    position: Float32Array<ArrayBufferLike>;
    normal: Float32Array;
  }[];
};

export type SmoothRange = {
  cutStart: number;
  count: number;
  isLast: boolean;
};

export type SmoothMsg = {
  points: Float32Array;
  segments?: number;
  range?: SmoothRange;
};

export type ChaikinMsg = {
  points: Float32Array;
  iterations?: number;
};

export type LineHelperResult = {
  result: Float32Array;
};

export type Vec2Arr = [number, number];

export type ToolType = 'preview' | 'pen' | 'bucket' | 'eraser';
export type OptionType = 'width' | 'color' | 'lineHelper';

export type BarPos = 't' | 'r' | 'b' | 'l';

export const EXTERNAL_SHAPE = 6.5,
  THICKNESS = 0.5,
  DENT = 0.2,
  DIFFERENCE = 0.4,
  RANGE_MIN = 0.05,
  RANGE_MAX = 1,
  SOURCE_MIN = 1,
  SOURCE_MAX = 100;

export type ToolMapType = Record<
  ToolType,
  {
    option: OptionType[];
    title: string;
    Icon: IconType;
  }
>;

export const TOOL_MAP: ToolMapType = {
  preview: {
    option: [],
    title: 'プレビュー',
    Icon: FaRegHand,
  },
  pen: {
    option: ['width', 'color', 'lineHelper'],
    title: 'ペン',
    Icon: LuPen,
  },
  bucket: {
    option: ['color'],
    title: 'ペイント',
    Icon: LuPaintBucket,
  },
  eraser: {
    option: ['width'],
    title: '消しゴム',
    Icon: Eraser,
  },
};

export enum MeshType {
  Concave,
  Stroke,
  Paint,
  Erase,
}
