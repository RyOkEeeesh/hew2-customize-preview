/// <reference lib='webworker' />

import type { IslMsg } from "../constants";

function separateIslands({ positions, normals }: IslMsg) {
  const numFaces = positions.length / 9;
  const faceVisited = new Uint8Array(numFaces);
  const islands: { position: Float32Array; normal: Float32Array }[] = [];

  const precision = 10000;
  const getVertexKey = (fIdx: number, vIdx: number): string => {
    const offset = fIdx * 9 + vIdx * 3;
    const x = Math.round(positions[offset] * precision);
    const y = Math.round(positions[offset + 1] * precision);
    const z = Math.round(positions[offset + 2] * precision);
    return `${x},${y},${z}`;
  };

  // 1. 頂点キーから面インデックスへのマップを作成
  const vertexToFaces = new Map<string, number[]>();
  for (let i = 0; i < numFaces; i++) {
    for (let v = 0; v < 3; v++) {
      const key = getVertexKey(i, v);
      let faces = vertexToFaces.get(key);
      if (!faces) {
        faces = [];
        vertexToFaces.set(key, faces);
      }
      faces.push(i);
    }
  }

  // 2. 面を探索して島を抽出
  for (let i = 0; i < numFaces; i++) {
    if (faceVisited[i]) continue;

    const currentIslandFaces: number[] = [];
    const queue = [i];
    faceVisited[i] = 1;

    let head = 0;
    while (head < queue.length) {
      const faceIdx = queue[head++];
      currentIslandFaces.push(faceIdx);

      // その面の全頂点について隣接する面をチェック
      for (let v = 0; v < 3; v++) {
        const key = getVertexKey(faceIdx, v);
        const neighborFaces = vertexToFaces.get(key);

        if (neighborFaces) {
          for (let k = 0; k < neighborFaces.length; k++) {
            const nFace = neighborFaces[k];
            if (faceVisited[nFace] === 0) {
              faceVisited[nFace] = 1;
              queue.push(nFace);
            }
          }
        }
      }
    }

    // 3. 抽出した面データからFloat32Arrayを生成
    const islandSize = currentIslandFaces.length;
    const pos = new Float32Array(islandSize * 9);
    const norm = new Float32Array(islandSize * 9);

    for (let j = 0; j < islandSize; j++) {
      const fIdx = currentIslandFaces[j];
      const srcOffset = fIdx * 9;
      const dstOffset = j * 9;
      pos.set(positions.subarray(srcOffset, srcOffset + 9), dstOffset);
      norm.set(normals.subarray(srcOffset, srcOffset + 9), dstOffset);
    }

    islands.push({ position: pos, normal: norm });
  }

  return islands;
}

self.onmessage = (e: MessageEvent<IslMsg>) => {
  const result = separateIslands(e.data);

  // Transferable Objects を使用してメインスレッドに高速返却
  const transfer = result.flatMap((isl) => [
    isl.position.buffer,
    isl.normal.buffer,
  ]);
  self.postMessage({ success: true, result }, transfer);
};
