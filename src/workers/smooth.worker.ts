/// <reference lib='webworker' />

import { type SmoothMsg } from '../constants';

const CHUNK_SIZE = 300;

const yieldControl = () => new Promise(resolve => setTimeout(resolve, 0));

async function smooth(
  { points, segments = 5, range }: SmoothMsg,
  taskId: number,
  taskRef: { id: number },
) {
  const len = points.length / 2;
  if (len < 2) return points;

  const cutStart = range ? range.cutStart : 0;
  const count = range ? range.count : len - 1;
  const isLast = range ? range.isLast : true;

  const resultLen = count * segments + (isLast ? 1 : 0);
  const result = new Float32Array(resultLen * 2);
  let writeIdx = 0;

  for (let i = 0; i < len - 1; i++) {
    if (taskId !== taskRef.id) return points;
    if (i > 0 && i % CHUNK_SIZE === 0) await yieldControl();

    const shouldExport = i >= cutStart && i < cutStart + count;

    const i0 = (i === 0 ? i : i - 1) * 2,
      i1 = i * 2,
      i2 = (i + 1) * 2,
      i3 = (i + 2 >= len ? i + 1 : i + 2) * 2;

    const p1x = points[i1],
      p1y = points[i1 + 1],
      p0x = points[i0],
      p0y = points[i0 + 1],
      p2x = points[i2],
      p2y = points[i2 + 1],
      p3x = points[i3],
      p3y = points[i3 + 1];

    if (shouldExport) {
      for (let j = 0; j < segments; j++) {
        const t = j / segments;
        const t2 = t * t;
        const t3 = t2 * t;
        result[writeIdx++] =
          0.5 *
          (2 * p1x +
            (-p0x + p2x) * t +
            (2 * p0x - 5 * p1x + 4 * p2x - p3x) * t2 +
            (-p0x + 3 * p1x - 3 * p2x + p3x) * t3);
        result[writeIdx++] =
          0.5 *
          (2 * p1y +
            (-p0y + p2y) * t +
            (2 * p0y - 5 * p1y + 4 * p2y - p3y) * t2 +
            (-p0y + 3 * p1y - 3 * p2y + p3y) * t3);
      }
    }
  }

  if (isLast) {
    result[writeIdx++] = points[(len - 1) * 2];
    result[writeIdx++] = points[(len - 1) * 2 + 1];
  }

  return result.slice(0, writeIdx);
}

const taskTracker = { id: 0 };

self.onmessage = async (e: MessageEvent<SmoothMsg>) => {
  const taskId = ++taskTracker.id;
  const result = await smooth(e.data, taskId, taskTracker);
  self.postMessage({ success: true, result }, [result.buffer]);
};
