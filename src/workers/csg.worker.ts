/// <reference lib='webworker' />

import { BufferGeometry, type TypedArray, BufferAttribute } from 'three';
import {
  Evaluator,
  Brush,
  ADDITION,
  SUBTRACTION,
  INTERSECTION,
} from 'three-bvh-csg';
import type { CSGMsg } from '../constants';

const evaluator = new Evaluator();

self.onmessage = (e: MessageEvent<CSGMsg>) => {
  try {
    const { type, obj } = e.data;

    const createGeo = (
      pos: TypedArray,
      norm: TypedArray,
      index?: TypedArray,
    ) => {
      const geo = new BufferGeometry();

      const posAttr = pos instanceof Float32Array ? pos : new Float32Array(pos);
      const normAttr =
        norm instanceof Float32Array ? norm : new Float32Array(norm);

      geo.setAttribute('position', new BufferAttribute(posAttr, 3));
      geo.setAttribute('normal', new BufferAttribute(normAttr, 3));

      if (index) {
        const indexAttr =
          index instanceof Uint32Array ? index : new Uint32Array(index);
        geo.setIndex(new BufferAttribute(indexAttr, 1));
      }

      const uvCount = pos.length / 3;
      const uvs = new Float32Array(uvCount * 2);
      geo.setAttribute('uv', new BufferAttribute(uvs, 2));

      return geo;
    };

    const geoA = createGeo(obj.positionA, obj.normalA, obj.indexA);
    const geoB = createGeo(obj.positionB, obj.normalB, obj.indexB);

    const brushA = new Brush(geoA);
    const brushB = new Brush(geoB);
    brushB.position.set(0.0001, 0.0001, 0.0001);

    brushA.updateMatrixWorld();
    brushB.updateMatrixWorld();

    const opType =
      type === 'union' ? ADDITION : type === 'sub' ? SUBTRACTION : INTERSECTION;

    const resultMesh = evaluator.evaluate(brushA, brushB, opType);
    const resultGeo = resultMesh.geometry;

    const positionAttr = resultGeo.getAttribute('position');
    const position = positionAttr
      ? (positionAttr.array as Float32Array)
      : new Float32Array(0);

    const normalAttr = resultGeo.getAttribute('normal');
    const normal = normalAttr
      ? (normalAttr.array as Float32Array)
      : new Float32Array(0);

    const index = resultGeo.index
      ? (resultGeo.index.array as Uint32Array)
      : null;

    const transfer: ArrayBufferLike[] = [];
    if (position.buffer) transfer.push(position.buffer);
    if (normal.buffer) transfer.push(normal.buffer);
    if (index?.buffer) transfer.push(index.buffer);

    self.postMessage(
      {
        success: true,
        result: { position, normal, index },
      },
      transfer,
    );

    geoA.dispose();
    geoB.dispose();
    resultGeo.dispose();
  } catch (err: any) {
    console.error('CSGworker error:', err);
    self.postMessage({
      success: false,
      error: err?.message ?? 'Unknown error',
    });
  }
};
