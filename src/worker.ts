import * as THREE from 'three';
import { useRef, useEffect } from 'react';
import type { CSGMsg, CSGResult, CSGType, IslMsg, IslResult, LineHelperResult, SmoothRange, Vec2Arr } from './constants';

const CORES = 8;
// const CORES = navigator.hardwareConcurrency || 4;

export function Vec2ToArray32(points: Vec2Arr[]): Float32Array {
  const len = points.length;
  const arr = new Float32Array(len * 2);
  for (let i = 0; i < len; i++) {
    const p = points[i];
    arr[i * 2] = p[0];
    arr[i * 2 + 1] = p[1];
  }
  return arr;
}

export function array32ToVec2Arr(arr: Float32Array): Vec2Arr[] {
  const count = arr.length / 2;
  const result: Vec2Arr[] = new Array(count);
  for (let i = 0; i < count; i++) {
    result[i] = [arr[i * 2], arr[i * 2 + 1]];
  }
  return result;
}

export default function useWebWorker() {
  const csgWorkerRef = useRef<Worker>(null!);
  const islWorkerRef = useRef<Worker>(null!);
  const smoothWorkersRef = useRef<Worker[]>(null!);
  const chaikinWorkerRef = useRef<Worker>(null!);

  useEffect(() => {
    const csg = new Worker(new URL('./workers/csg.worker.ts', import.meta.url), { type: 'module' });
    const isl = new Worker(new URL('./workers/isl.worker.ts', import.meta.url), { type: 'module' });
    const smooth = Array.from({ length: CORES }, () => new Worker(new URL('./workers/smooth.worker.ts', import.meta.url), { type: 'module' }));
    const chaikin = new Worker(new URL('./workers/chaikin.worker.ts', import.meta.url), { type: 'module' });

    csgWorkerRef.current = csg;
    islWorkerRef.current = isl;
    smoothWorkersRef.current = smooth;
    chaikinWorkerRef.current = chaikin;

    return () => {
      csg.terminate();
      isl.terminate();
      smooth.forEach(w => w.terminate());
      chaikin.terminate();
    };
  }, []);

  function postCsgWorker(geoA: THREE.BufferGeometry, geoB: THREE.BufferGeometry, type: CSGType): Promise<CSGResult> {
    return new Promise((resolve, reject) => {
      const CSGWorker = csgWorkerRef.current;
      if (!CSGWorker) return reject(new Error('CSGWorker not initialized'));

      const handleMessage = (e: MessageEvent<CSGResult>) => {
        CSGWorker.removeEventListener('message', handleMessage);
        CSGWorker.removeEventListener('error', handleError);
        if (e.data.success) resolve(e.data);
        else reject(new Error(e.data.error || 'CSG calculation failed'));
      };

      const handleError = (err: ErrorEvent) => {
        CSGWorker.removeEventListener('message', handleMessage);
        CSGWorker.removeEventListener('error', handleError);
        reject(err);
      };

      CSGWorker.addEventListener('message', handleMessage);
      CSGWorker.addEventListener('error', handleError);

      const msg: CSGMsg = {
        type,
        obj: {
          positionA: geoA.attributes.position.array.slice(),
          normalA: geoA.attributes.normal.array.slice(),
          indexA: geoA.index ? geoA.index.array.slice() : undefined,
          positionB: geoB.attributes.position.array.slice(),
          normalB: geoB.attributes.normal.array.slice(),
          indexB: geoB.index ? geoB.index.array.slice() : undefined,
        },
      };

      const transfer: ArrayBufferLike[] = [msg.obj.positionA.buffer, msg.obj.normalA.buffer, msg.obj.positionB.buffer, msg.obj.normalB.buffer];
      if (msg.obj.indexA) transfer.push(msg.obj.indexA.buffer);
      if (msg.obj.indexB) transfer.push(msg.obj.indexB.buffer);

      CSGWorker.postMessage(msg, transfer);
    });
  }

  function postIslWorker(mesh: THREE.Mesh): Promise<IslResult> {
    return new Promise((resolve, reject) => {
      const islWorker = islWorkerRef.current;
      if (!islWorker) return reject(new Error('IslWorker not initialized'));

      const handleMessage = (e: MessageEvent<IslResult>) => {
        islWorker.removeEventListener('message', handleMessage);
        islWorker.removeEventListener('error', handleError);
        if (e.data.success) resolve(e.data);
        else reject(new Error('IslWorker calculation failed'));
      };

      const handleError = (err: ErrorEvent) => {
        islWorker.removeEventListener('message', handleMessage);
        islWorker.removeEventListener('error', handleError);
        reject(err);
      };

      islWorker.addEventListener('message', handleMessage);
      islWorker.addEventListener('error', handleError);

      const geo = mesh.geometry.clone();

      const msg: IslMsg = {
        positions: geo.attributes.position.array.slice(),
        normals: geo.attributes.normal.array.slice(),
      };
      const transfer: ArrayBufferLike[] = [msg.positions.buffer, msg.normals.buffer];

      islWorker.postMessage(msg, transfer);
    });
  }

  function useSmoothWorker(worker: Worker, points: Float32Array, range?: SmoothRange): Promise<Float32Array> {
    return new Promise(resolve => {
      const handleMessage = (e: MessageEvent<LineHelperResult>) => {
        worker.removeEventListener('message', handleMessage);
        resolve(e.data.result);
      };
      worker.addEventListener('message', handleMessage);
      worker.postMessage({ points, range }, [points.buffer]);
    });
  }

  async function singleSmooth(arr: Float32Array) {
    const worker = smoothWorkersRef.current[0];
    if (!worker) return arr;
    return await useSmoothWorker(worker, arr);
  }

  async function postSmoothWorker(points: Vec2Arr[]): Promise<Vec2Arr[]> {
    const arr = Vec2ToArray32(points);
    const totalPoints = points.length;

    if (totalPoints < 100) {
      const result = await singleSmooth(arr);
      return array32ToVec2Arr(result);
    }

    const workers = smoothWorkersRef.current;
    if (workers.some(w => w === null)) return points;

    const pointsPerWorker = Math.ceil(totalPoints / CORES);
    const promises: Promise<Float32Array>[] = [];

    for (let i = 0; i < CORES; i++) {
      const startIdx = Math.max(0, i * pointsPerWorker - 2);
      const endIdx = Math.min(totalPoints - 1, (i + 1) * pointsPerWorker + 1);

      const subPoints = arr.slice(startIdx * 2, (endIdx + 1) * 2);

      const cutStart = i === 0 ? 0 : i * pointsPerWorker - startIdx;
      const count = i === CORES - 1 ? totalPoints - i * pointsPerWorker : pointsPerWorker;

      const range: SmoothRange = {
        cutStart,
        count,
        isLast: i === CORES - 1,
      };

      promises.push(useSmoothWorker(workers[i], subPoints, range));
    }

    const results = await Promise.all(promises);

    const totalLen = results.reduce((acc, r) => acc + r.length, 0);
    const combined = new Float32Array(totalLen);
    let offset = 0;
    for (const res of results) {
      combined.set(res, offset);
      offset += res.length;
    }

    return array32ToVec2Arr(combined);
  }

  function postChaikinWorker(points: Vec2Arr[]): Promise<Vec2Arr[]> {
    return new Promise(resolve => {
      const chaikinWorker = chaikinWorkerRef.current;
      if (!chaikinWorker) {
        resolve(points);
        return;
      }

      const arr = Vec2ToArray32(points);
      const handleMessage = (e: MessageEvent<LineHelperResult>) => {
        chaikinWorker.removeEventListener('message', handleMessage);
        resolve(array32ToVec2Arr(e.data.result));
      };
      chaikinWorker.addEventListener('message', handleMessage);

      chaikinWorker.postMessage({ points: arr }, [arr.buffer]);
    });
  }
  return { postCsgWorker, postIslWorker, postSmoothWorker, postChaikinWorker };
}
