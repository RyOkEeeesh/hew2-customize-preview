import * as THREE from "three";
import {
  DENT,
  RANGE_MIN,
  RANGE_MAX,
  SOURCE_MIN,
  SOURCE_MAX,
  MeshType,
  type Vec2Arr,
} from "./constants";
import { v4 as uuid } from "uuid";

export type MeshUserData = {
  isMesh: true;
  id: string;
  meshType: MeshType;
  originalColor?: THREE.Color;
};

type MatType = THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[];

export type MeshState = THREE.Mesh<THREE.BufferGeometry, MatType> & {
  userData: MeshUserData;
};

export function createMesh(
  geometry: THREE.BufferGeometry,
  materials: MatType,
  meshType: MeshType,
  id?: string,
): MeshState {
  const mesh = new THREE.Mesh(geometry, materials) as MeshState;
  mesh.userData.isMesh = true;
  mesh.userData.id = id ?? uuid();
  mesh.userData.meshType = meshType;
  return mesh;
}

export function isMeshState(obj: THREE.Object3D): obj is MeshState {
  return (
    obj instanceof THREE.Mesh && (obj.userData as MeshUserData).isMesh === true
  );
}

const _BOX_1 = new THREE.Box3();
const _BOX_2 = new THREE.Box3();
export function checkCollision(mesh1: THREE.Mesh, mesh2: THREE.Mesh): boolean {
  if (!mesh1 || !mesh2) return false;
  mesh1.updateMatrixWorld();
  mesh2.updateMatrixWorld();
  _BOX_1.setFromObject(mesh1);
  _BOX_2.setFromObject(mesh2);
  return _BOX_1.intersectsBox(_BOX_2);
}

const _CENTER_VEC3 = new THREE.Vector3();

export function getCenter(obj: THREE.Object3D): THREE.Vector3Like {
  _BOX_1.setFromObject(obj);
  _BOX_1.getCenter(_CENTER_VEC3);
  const { x, y, z } = _CENTER_VEC3;
  return { x, y, z };
}

export function getMat(m: MeshState): THREE.MeshStandardMaterial {
  return Array.isArray(m.material) ? m.material[0] : m.material;
}

export function meshDispose(mesh: MeshState): void {
  mesh.geometry.dispose();
  getMat(mesh).dispose();
}

export function arrToVec2(nums: Vec2Arr): THREE.Vector2Like {
  return { x: nums[0], y: nums[1] };
}

export function normalizeWidth(value: number): number {
  return (
    ((value - SOURCE_MIN) / (SOURCE_MAX - SOURCE_MIN)) *
      (RANGE_MAX - RANGE_MIN) +
    RANGE_MIN
  );
}

export function denormalizeWidth(value: number): number {
  return (
    ((value - RANGE_MIN) / (RANGE_MAX - RANGE_MIN)) *
      (SOURCE_MAX - SOURCE_MIN) +
    SOURCE_MIN
  );
}

const MAX_VERTICES = 4000;
const tmpDir = new THREE.Vector2();
const tmpNormal = new THREE.Vector2();

export function updateGeometryPre(
  geo: THREE.BufferGeometry,
  points: Vec2Arr[],
  width: number,
) {
  if (points.length < 2) {
    geo.setDrawRange(0, 0);
    geo.clearGroups();
    return;
  }

  let posAttr = geo.getAttribute("position") as THREE.BufferAttribute;
  let indexAttr = geo.getIndex() as THREE.BufferAttribute;

  if (!posAttr) {
    const posArray = new Float32Array(MAX_VERTICES * 4 * 3);
    posAttr = new THREE.BufferAttribute(posArray, 3);
    geo.setAttribute("position", posAttr);
  }
  if (!indexAttr) {
    const indexArray = new Uint32Array(MAX_VERTICES * 30);
    indexAttr = new THREE.Uint32BufferAttribute(indexArray, 1);
    geo.setIndex(indexAttr);
  }

  const radius = normalizeWidth(width) / 2;
  const depth = DENT;

  const vertices = posAttr.array as Float32Array;
  const indices = indexAttr.array as Uint32Array;

  let vIdx = 0;
  const topIndices: number[] = [];
  const otherIndices: number[] = [];

  for (let i = 0; i < points.length; i++) {
    const curr = arrToVec2(points[i]);
    if (i < points.length - 1) {
      tmpDir
        .set(points[i + 1][0] - curr.x, points[i + 1][1] - curr.y)
        .normalize();
    } else if (i > 0) {
      const p = arrToVec2(points[i - 1]);
      tmpDir.set(points[i - 1][0] - p.x, points[i - 1][1] - p.y).normalize();
    }
    tmpNormal.set(-tmpDir.y, tmpDir.x).multiplyScalar(radius);

    vertices[vIdx++] = curr.x + tmpNormal.x;
    vertices[vIdx++] = curr.y + tmpNormal.y;
    vertices[vIdx++] = depth;
    vertices[vIdx++] = curr.x - tmpNormal.x;
    vertices[vIdx++] = curr.y - tmpNormal.y;
    vertices[vIdx++] = depth;
    vertices[vIdx++] = curr.x + tmpNormal.x;
    vertices[vIdx++] = curr.y + tmpNormal.y;
    vertices[vIdx++] = 0;
    vertices[vIdx++] = curr.x - tmpNormal.x;
    vertices[vIdx++] = curr.y - tmpNormal.y;
    vertices[vIdx++] = 0;

    const currIdx = 4 * i;

    if (i === 0) {
      otherIndices.push(currIdx + 0, currIdx + 2, currIdx + 1);
      otherIndices.push(currIdx + 1, currIdx + 2, currIdx + 3);
    }

    if (i > 0) {
      const prev = 4 * (i - 1);
      // 天面
      topIndices.push(prev + 0, prev + 1, currIdx + 0);
      topIndices.push(prev + 1, currIdx + 1, currIdx + 0);
      // 底面と側面
      otherIndices.push(prev + 2, currIdx + 2, prev + 3);
      otherIndices.push(prev + 3, currIdx + 2, currIdx + 3);
      otherIndices.push(prev + 0, currIdx + 0, prev + 2);
      otherIndices.push(prev + 2, currIdx + 0, currIdx + 2);
      otherIndices.push(prev + 1, prev + 3, currIdx + 1);
      otherIndices.push(prev + 3, currIdx + 3, currIdx + 1);
    }

    if (i === points.length - 1 && i > 0) {
      otherIndices.push(currIdx + 0, currIdx + 1, currIdx + 2);
      otherIndices.push(currIdx + 1, currIdx + 3, currIdx + 2);
    }
  }

  const allIndices = [...topIndices, ...otherIndices];
  for (let i = 0; i < allIndices.length; i++) {
    indices[i] = allIndices[i];
  }

  posAttr.updateRanges[0] = { start: 0, count: vIdx };
  posAttr.needsUpdate = true;
  indexAttr.updateRanges[0] = { start: 0, count: allIndices.length };
  indexAttr.needsUpdate = true;

  geo.setDrawRange(0, allIndices.length);
  geo.clearGroups();
  geo.addGroup(0, topIndices.length, 0);
  geo.addGroup(topIndices.length, otherIndices.length, 1);

  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
}

const _CURR = new THREE.Vector2();
const _NEXT = new THREE.Vector2();
const _DIR = new THREE.Vector2();
const _NORMAL = new THREE.Vector2();

function calculateNormal(i: number, points: Vec2Arr[], radius: number) {
  const p = points[i];
  _CURR.set(p[0], p[1]);

  if (i < points.length - 1) {
    const pNext = points[i + 1];
    _NEXT.set(pNext[0], pNext[1]);
    _DIR.subVectors(_NEXT, _CURR).normalize();
  } else {
    const pPrev = points[i - 1];
    _NEXT.set(pPrev[0], pPrev[1]);
    _DIR.subVectors(_CURR, _NEXT).normalize();
  }

  _NORMAL.set(-_DIR.y, _DIR.x).multiplyScalar(radius);
}

export function updateGeometryFin(
  geo: THREE.BufferGeometry,
  points: Vec2Arr[],
  width: number,
) {
  if (points.length < 2) {
    geo.deleteAttribute("position");
    geo.setIndex(null);
    return;
  }

  const radius = normalizeWidth(width) / 2;
  const shape = new THREE.Shape();

  for (let i = 0; i < points.length; i++) {
    calculateNormal(i, points, radius);
    const x = _CURR.x + _NORMAL.x;
    const y = _CURR.y + _NORMAL.y;

    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }

  for (let i = points.length - 1; i >= 0; i--) {
    calculateNormal(i, points, radius);
    const x = _CURR.x - _NORMAL.x;
    const y = _CURR.y - _NORMAL.y;

    shape.lineTo(x, y);
  }

  shape.closePath();

  const extrudeSettings = {
    depth: DENT,
    bevelEnabled: false,
  };

  const newGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);

  geo.copy(newGeo);
  newGeo.dispose();
}
