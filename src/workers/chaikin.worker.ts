/// <reference lib='webworker' />

import { type ChaikinMsg } from '../constants';

function chaikin({ points, iterations = 2 }: ChaikinMsg) {
  let len = points.length;
  if (len < 4) return points;

  let maxPoints = (len / 2 - 2) * Math.pow(2, iterations) + 2;
  let bufA = new Float32Array(maxPoints * 2);
  let bufB = new Float32Array(maxPoints * 2);

  bufA.set(points);
  let currentBuf = bufA;
  let nextBuf = bufB;
  let currentLen = len;

  for (let i = 0; i < iterations; i++) {
    const numPoints = currentLen / 2;
    let nextIdx = 0;

    nextBuf[nextIdx++] = currentBuf[0];
    nextBuf[nextIdx++] = currentBuf[1];

    for (let j = 0; j < numPoints - 1; j++) {
      const i0 = j << 1;
      const i1 = i0 + 2;
      
      const p0x = currentBuf[i0];
      const p0y = currentBuf[i0 + 1];
      const p1x = currentBuf[i1];
      const p1y = currentBuf[i1 + 1];

      if (j > 0) {
        nextBuf[nextIdx++] = p0x * 0.75 + p1x * 0.25;
        nextBuf[nextIdx++] = p0y * 0.75 + p1y * 0.25;
      }
      if (j < numPoints - 2) {
        nextBuf[nextIdx++] = p0x * 0.25 + p1x * 0.75;
        nextBuf[nextIdx++] = p0y * 0.25 + p1y * 0.75;
      }
    }

    nextBuf[nextIdx++] = currentBuf[currentLen - 2];
    nextBuf[nextIdx++] = currentBuf[currentLen - 1];

    let temp = currentBuf;
    currentBuf = nextBuf;
    nextBuf = temp;
    currentLen = nextIdx;
  }

  return currentBuf.slice(0, currentLen);
}

self.onmessage = (e: MessageEvent<ChaikinMsg>) => {
  const result = chaikin(e.data);
  self.postMessage({ result }, [result.buffer]);
};