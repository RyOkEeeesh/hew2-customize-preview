import * as THREE from 'three';
import { MeshType, type ToolType, type Vec2Arr } from "./constants";
import useWebWorker from './worker';
import { useHistory, useTasks, useTools } from './store';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import { type ThreeEvent, type EventHandlers } from '@react-three/fiber';
import { type MeshState, createMesh, getCenter, getMat, isMeshState, meshDispose, updateGeometryFin, updateGeometryPre } from './threeUnits';
import { v4 as uuid } from 'uuid';
import { useShallow } from 'zustand/react/shallow';

function useToolOps() {
  const { postCsgWorker, postIslWorker } = useWebWorker();

  const applySubtraction = async (targetMesh: MeshState, convexMesh: THREE.Mesh) => {
    targetMesh.updateMatrixWorld(true);
    convexMesh.updateMatrixWorld(true);

    const targetGeo = BufferGeometryUtils.mergeVertices(targetMesh.geometry.clone());
    targetGeo.applyMatrix4(targetMesh.matrixWorld);

    const cutterGeo = BufferGeometryUtils.mergeVertices(convexMesh.geometry.clone());
    cutterGeo.applyMatrix4(convexMesh.matrixWorld);

    try {
      const res = await postCsgWorker(targetGeo, cutterGeo, 'sub');

      if (res.success && res.result) {
        const newGeo = new THREE.BufferGeometry();
        newGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(res.result.position), 3));
        newGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(res.result.normal), 3));
        if (res.result.index) {
          newGeo.setIndex(new THREE.BufferAttribute(new Uint32Array(res.result.index), 1));
        }

        if (targetMesh.parent) {
          const inverseParentMat = targetMesh.parent.matrixWorld.clone().invert();
          newGeo.applyMatrix4(inverseParentMat);
        }

        const newMesh = createMesh(newGeo, targetMesh.material, targetMesh.userData.meshType);
        newMesh.castShadow = true;
        newMesh.receiveShadow = true;

        return newMesh;
      }
    } catch (e) {
      console.error('CSG Error:', e);
    }
    return null;
  };

  const getSeparateMeshes = async (mesh: MeshState) => {
    const res = await postIslWorker(mesh);
    if (!res.success || !res.result) return [mesh];

    const meshArr: MeshState[] = [];
    for (const { position, normal } of res.result) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
      const newMesh = createMesh(geo, getMat(mesh).clone(), mesh.userData.meshType);
      newMesh.castShadow = true;
      newMesh.receiveShadow = true;
      meshArr.push(newMesh);
    }
    return meshArr;
  };

  return { applySubtraction, getSeparateMeshes };
}

type setAction = Dispatch<SetStateAction<ActionState | null>>;

type ToolHandlerReturn = {
  editMeshHandlers: Partial<EventHandlers>;
  editGroupHandlers: Partial<EventHandlers>;
};

type BaseAction = {
  id: string;
  type: ToolType;
};

interface PenAction extends BaseAction {
  type: 'pen';
  points: [number, number][];
  width: number;
}

type ToolProps = {
  setAction: setAction;
  baseMat: THREE.MeshStandardMaterial;
  editMeshRef: RefObject<THREE.Mesh>;
  editGroupRef: RefObject<THREE.Group>;
  baseConcaveRef: RefObject<MeshState>;
  preMeshRef: RefObject<THREE.Mesh>;
};

function usePen({ setAction, baseConcaveRef, preMeshRef }: ToolProps): ToolHandlerReturn {
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const pointsRef = useRef<Vec2Arr[]>(null!);

  const { postChaikinWorker, postSmoothWorker } = useWebWorker();
  const { setWorking } = useTasks.getState();

  const resetPre = () => {
    if (!preMeshRef.current) return;
    preMeshRef.current.geometry.deleteAttribute('position');
    preMeshRef.current.geometry.setIndex(null);
    preMeshRef.current.visible = false;
  };

  const handleFinDrawing = async () => {
    if (!isDrawing) return;
    if (pointsRef.current.length < 2) {
      resetPre();
      setIsDrawing(false);
      return;
    }

    const { width, lineChaikin, lineSmooth } = useTools.getState();

    setWorking('線の角を丸くする');
    if (lineChaikin) pointsRef.current = await postChaikinWorker(pointsRef.current);
    setWorking('線をなめらかにする');
    if (lineSmooth) pointsRef.current = await postSmoothWorker(pointsRef.current);

    setAction({
      id: uuid(),
      type: 'pen',
      points: pointsRef.current,
      width,
    });
    setIsDrawing(false);
    pointsRef.current = [];
    resetPre();
    setWorking(null);
  };

  const pointerEventTmpVec3 = new THREE.Vector3();

  const editMeshHandlers = {
    onPointerDown: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      if (e.button !== 0) return;
      setIsDrawing(true);
      pointerEventTmpVec3.copy(e.point);
      baseConcaveRef.current.worldToLocal(pointerEventTmpVec3);
      pointsRef.current = [[pointerEventTmpVec3.x, pointerEventTmpVec3.y]];
    },
    onPointerUp: handleFinDrawing,
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      pointerEventTmpVec3.copy(e.point);
      preMeshRef.current.visible = true;
      if (!isDrawing) return;

      const { width, color } = useTools.getState();
      baseConcaveRef.current.worldToLocal(pointerEventTmpVec3);
      if (pointsRef.current.length) {
        const lastPoint = pointsRef.current[pointsRef.current.length - 1];
        const dist = Math.sqrt(Math.pow(pointerEventTmpVec3.x - lastPoint[0], 2) + Math.pow(pointerEventTmpVec3.y - lastPoint[1], 2));
        if (dist < 0.05) return;
      }
      pointsRef.current.push([pointerEventTmpVec3.x, pointerEventTmpVec3.y]);
      getMat(preMeshRef.current as MeshState).color.set(color);
      updateGeometryPre(preMeshRef.current.geometry, pointsRef.current, width);
    },
    onPointerLeave: handleFinDrawing,
  };

  return { editMeshHandlers, editGroupHandlers: {} };
}

interface BucketAction extends BaseAction {
  type: 'bucket';
  oldClr: THREE.Color;
  newClr: THREE.Color;
}

function useBucket({ setAction }: ToolProps): ToolHandlerReturn {
  const editGroupHandlers = {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      const { color: activeColor } = useTools.getState();
      const mesh = e.object;
      if (!isMeshState(mesh)) return;
      const mat = getMat(mesh);

      if (mesh.userData.originalColor === undefined) {
        mesh.userData.originalColor = mat.color.clone();
      }
      mat.color.set(activeColor);
    },

    onPointerOut: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      const mesh = e.object;
      if (!isMeshState(mesh)) return;
      const mat = getMat(mesh);

      if (mesh.userData.originalColor) {
        mat.color.copy(mesh.userData.originalColor);
        delete mesh.userData.originalColor;
      }
    },

    onPointerDown: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      if (e.button !== 0) return;
      const mesh = e.object;
      if (!isMeshState(mesh)) return;
      const { color } = useTools.getState();
      const mat = getMat(mesh);

      const oldClr = mesh.userData.originalColor?.clone() || mat.color.clone();
      const newClr = new THREE.Color(color);

      if (oldClr.equals(newClr)) return;

      setAction({
        id: mesh.userData.id,
        type: 'bucket',
        oldClr,
        newClr,
      });

      delete mesh.userData.originalColor;
    },
  };

  return { editMeshHandlers: {}, editGroupHandlers };
}

interface EraserAction extends BaseAction {
  type: 'eraser';
  points: [number, number][];
  width: number;
}

function useEraser({ setAction, baseMat, baseConcaveRef, preMeshRef }: ToolProps): ToolHandlerReturn {
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const pointsRef = useRef<Vec2Arr[]>(null!);

  const { setWorking } = useTasks.getState();

  const resetPre = () => {
    if (!preMeshRef.current) return;
    preMeshRef.current.geometry.deleteAttribute('position');
    preMeshRef.current.geometry.setIndex(null);
    preMeshRef.current.visible = false;
  };

  const handleFinDrawing = () => {
    if (!isDrawing) return;
    if (pointsRef.current.length < 2) {
      resetPre();
      setIsDrawing(false);
      return;
    }

    const { width } = useTools.getState();

    setAction({
      id: uuid(),
      type: 'eraser',
      points: pointsRef.current,
      width,
    });
    setIsDrawing(false);
    pointsRef.current = [];
    resetPre();
    setWorking(null);
  };

  const pointerEventTmpVec3 = new THREE.Vector3();

  const editMeshHandlers = {
    onPointerDown: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      if (e.button !== 0) return;
      setIsDrawing(true);
      pointerEventTmpVec3.copy(e.point);
      baseConcaveRef.current.worldToLocal(pointerEventTmpVec3);
      pointsRef.current = [[pointerEventTmpVec3.x, pointerEventTmpVec3.y]];
    },
    onPointerUp: handleFinDrawing,
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      pointerEventTmpVec3.copy(e.point);
      preMeshRef.current.visible = true;
      if (!isDrawing) return;
      const { width } = useTools.getState();
      baseConcaveRef.current.worldToLocal(pointerEventTmpVec3);
      if (pointsRef.current.length) {
        const lastPoint = pointsRef.current[pointsRef.current.length - 1];
        const dist = Math.sqrt(Math.pow(pointerEventTmpVec3.x - lastPoint[0], 2) + Math.pow(pointerEventTmpVec3.y - lastPoint[1], 2));
        if (dist < 0.05) return;
      }
      pointsRef.current.push([pointerEventTmpVec3.x, pointerEventTmpVec3.y]);
      getMat(preMeshRef.current as MeshState).color.copy(baseMat.color);
      updateGeometryPre(preMeshRef.current.geometry, pointsRef.current, width);
    },
    onPointerLeave: handleFinDrawing,
  };

  return { editMeshHandlers, editGroupHandlers: {} };
}

type ActionState = PenAction | BucketAction | EraserAction;

export function useToolHandlers(baseMat: THREE.MeshStandardMaterial) {
  const editMeshRef = useRef<THREE.Mesh>(null!);
  const editGroupRef = useRef<THREE.Group>(null!);
  const preMeshRef = useRef<THREE.Mesh>(null!);
  const baseConcaveRef = useRef<MeshState>(null!);

  const { working, setWorking } = useTasks(useShallow(s => ({ ...s })));
  const [action, setAction] = useState<ActionState | null>(null);
  const toolProps: ToolProps = { setAction, baseMat, editMeshRef, editGroupRef, preMeshRef, baseConcaveRef };
  const EMPTY = { editMeshHandlers: {}, editGroupHandlers: {} };
  const handler: Record<Partial<ToolType>, ToolHandlerReturn> = {
    preview: EMPTY,
    pen: usePen(toolProps),
    bucket: useBucket(toolProps),
    eraser: useEraser(toolProps),
  };

  const { pushHistory } = useHistory.getState();
  const { tool } = useTools(useShallow(s => ({ ...s })));
  const { applySubtraction, getSeparateMeshes } = useToolOps();

  const tmpCenterVec3Ref = useRef<THREE.Vector3>(new THREE.Vector3());

  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const downVecRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, -1));
  const originRef = useRef<THREE.Vector3>(new THREE.Vector3());

  const inheritColors = (newMeshes: MeshState[], oldMeshes: MeshState[]) => {
    if (oldMeshes.length === 0) return;

    for (const target of newMeshes) {
      const targetCenter = tmpCenterVec3Ref.current.copy(getCenter(target));
      originRef.current.copy(tmpCenterVec3Ref.current).setZ(10);
      raycasterRef.current.set(originRef.current, downVecRef.current);

      const intersects = raycasterRef.current.intersectObjects(oldMeshes);

      if (intersects.length > 0) {
        const hitMesh = intersects[0].object as MeshState;
        getMat(target).color.copy(getMat(hitMesh).color);
      } else {
        let minSqDist = Infinity;
        let closestColor = getMat(oldMeshes[0]).color;

        for (const old of oldMeshes) {
          const distSq = targetCenter.distanceToSquared(getCenter(old));
          if (distSq < minSqDist) {
            minSqDist = distSq;
            closestColor = getMat(old).color;
          }
        }
        getMat(target).color.copy(closestColor);
      }
    }
  };

  const getConvexMat = () => {
    const { color } = useTools.getState();
    const mats = [baseMat.clone(), baseMat];
    mats[0].color.set(color);
    return mats;
  };

  const syncRotation = (mesh: THREE.Mesh) => mesh.quaternion.copy(baseConcaveRef.current.quaternion);

  const buildConcave = async () => {
    const children = editGroupRef.current.children;
    const len = children.length;
    let concave = baseConcaveRef.current;
    let didSub = false;

    for (let i = 0; i < len; i++) {
      const mesh = children[i];
      if (isMeshState(mesh) && mesh.userData.meshType !== MeshType.Concave) {
        const result = await applySubtraction(concave, mesh);
        if (result) {
          concave = result;
          didSub = true;
        }
      }
    }

    if (!didSub) return [concave];
    return await getSeparateMeshes(concave);
  };

  useEffect(() => {
    if (!editMeshRef.current || !editGroupRef.current) return;
    baseConcaveRef.current = createMesh(editMeshRef.current.geometry.clone(), baseMat.clone(), MeshType.Concave);
    baseConcaveRef.current.position.copy(editMeshRef.current.position);
    baseConcaveRef.current.rotation.copy(editMeshRef.current.rotation);
    baseConcaveRef.current.updateMatrix();
    baseConcaveRef.current.updateMatrixWorld();
    editGroupRef.current.add(baseConcaveRef.current);
  }, [editMeshRef]);

  useEffect(() => {
    if (!action) return;

    const getCommand = async () => {
      if (action.type === 'pen') {
        setWorking('ジオメトリを作成中');
        const group = editGroupRef.current;
        const geo = new THREE.BufferGeometry();
        updateGeometryFin(geo, action.points, action.width);
        const mesh = createMesh(geo, getConvexMat(), MeshType.Stroke, action.id);
        syncRotation(mesh);
        group.add(mesh);

        setWorking('カラーマッピング中');
        const oldConcaves: MeshState[] = [];
        for (const child of group.children) {
          if (isMeshState(child) && child.userData.meshType === MeshType.Concave) {
            oldConcaves.push(child);
          }
        }

        const newConcaves = await buildConcave();
        inheritColors(newConcaves, oldConcaves);
        group.remove(...oldConcaves);
        group.add(...newConcaves);

        setWorking(null);

        return {
          undo: () => {
            group.remove(mesh);
            group.remove(...newConcaves);
            group.add(...oldConcaves);
          },
          redo: () => {
            group.add(mesh);
            group.remove(...oldConcaves);
            group.add(...newConcaves);
          },
          dispose: () => {
            for (const m of newConcaves) meshDispose(m);
            meshDispose(mesh);
          },
        };
      }
      // Bucket Action
      if (action.type === 'bucket') {
        const { id, newClr, oldClr } = action;
        const mesh = editGroupRef.current.children.filter(isMeshState).find(m => m.userData.id === id);
        if (!mesh) return null;

        getMat(mesh).color.copy(newClr);

        return {
          undo: () => {
            getMat(mesh).color.copy(oldClr);
          },
          redo: () => {
            getMat(mesh).color.copy(newClr);
          },
        };
      }
      // Eraser Action
      if (action.type === 'eraser') {
        const group = editGroupRef.current;
        const { points, width } = action;

        setWorking('消すオブジェクトを探索中');

        const targets: Set<MeshState> = new Set();

        const len = points.length;
        for (let i = 0; i < len; i++) {
          if (i % 3 !== 0) continue;
          originRef.current.set(points[i][0], 0, 10);
          raycasterRef.current.set(originRef.current, downVecRef.current);

          const intersects = raycasterRef.current.intersectObjects(group.children, true);
          for (const hit of intersects) {
            const obj = hit.object;
            if (isMeshState(obj) && obj.userData.meshType !== MeshType.Concave) {
              targets.add(obj);
            }
          }
        }

        if (targets.size === 0) return;

        const geo = new THREE.BufferGeometry();
        updateGeometryFin(geo, points, width);
        const eraserMesh = new THREE.Mesh(geo);
        syncRotation(eraserMesh);
        eraserMesh.updateMatrixWorld(true);

        const oldConvex: MeshState[] = [];
        const newConvex: MeshState[] = [];

        setWorking('消しゴム実行中');
        for (const target of targets) {
          const result = await applySubtraction(target, eraserMesh);
          if (result) {
            const isl = await getSeparateMeshes(result);
            oldConvex.push(target);
            newConvex.push(...isl);
          }
        }

        group.remove(...oldConvex);
        group.add(...newConvex);

        setWorking('カラーマッピング中');
        const oldConcaves: MeshState[] = [];
        for (const child of group.children) {
          if (isMeshState(child) && child.userData.meshType === MeshType.Concave) {
            oldConcaves.push(child);
          }
        }

        const newConcaves = await buildConcave();

        inheritColors(newConcaves, oldConcaves);
        group.remove(...oldConcaves);
        group.add(...newConcaves);

        geo.dispose();
        setWorking(null);

        return {
          undo: () => {
            group.remove(...newConvex, ...newConcaves);
            group.add(...oldConvex, ...oldConvex);
          },
          redo: () => {
            group.remove(...oldConvex, ...oldConvex);
            group.add(...newConvex, ...newConcaves);
          },
          dispose: () => {
            for (const m of newConvex) meshDispose(m);
            for (const m of newConcaves) meshDispose(m);
          },
        };
      }
      return null;
    };

    const processAction = async () => {
      const command = await getCommand();
      if (command) pushHistory(command);
      setAction(null);
    };

    processAction();
  }, [action]);

  return {
    refs: { editMeshRef, editGroupRef, preMeshRef },
    handlers: working ? EMPTY : handler[tool],
    camControlsEnabled: tool === 'preview',
  };
}
