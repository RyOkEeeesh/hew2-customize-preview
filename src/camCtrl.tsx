import {
  Box3,
  Vector3,
  type Vector3Like,
  Object3D,
  PerspectiveCamera as perCam,
  MathUtils,
  Group,
  MOUSE,
} from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useOther } from './store';
import { useShallow } from 'zustand/react/shallow';
import { getCenter } from './threeUnits';

const _box = new Box3();
const _center = new Vector3();
const _size = new Vector3();
const _v3 = new Vector3();
const _dir = new Vector3();

const initComPosY = 100;

const _vertices = Array.from({ length: 8 }, () => new Vector3());

function fitObject(camera: perCam, object: Object3D, offset = 1.1) {
  object.updateMatrixWorld(true);
  _box.setFromObject(object);
  _box.getCenter(_center);
  _box.getSize(_size);

  let idx = 0;
  for (let x = 0; x <= 1; x++) {
    for (let y = 0; y <= 1; y++) {
      for (let z = 0; z <= 1; z++) {
        _vertices[idx++].set(
          x === 0 ? _box.min.x : _box.max.x,
          y === 0 ? _box.min.y : _box.max.y,
          z === 0 ? _box.min.z : _box.max.z,
        );
      }
    }
  }

  _dir.subVectors(camera.position, _center).normalize();

  const fov = MathUtils.degToRad(camera.fov);
  const aspect = camera.aspect;

  const maxDim = Math.max(_size.x, _size.y, _size.z);
  const distForHeight = maxDim / (2 * Math.tan(fov / 2));
  const distForWidth = distForHeight / aspect;

  let low = 0;
  let high = Math.max(distForHeight, distForWidth) * 2;

  for (let i = 0; i < 20; i++) {
    const mid = (low + high) / 2;
    camera.position.copy(_center).addScaledVector(_dir, mid);
    camera.lookAt(_center);
    camera.updateMatrixWorld();
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

    let fits = true;
    for (const v of _vertices) {
      _v3.copy(v).project(camera);
      if (Math.abs(_v3.x) > 1 || Math.abs(_v3.y) > 1) {
        fits = false;
        break;
      }
    }
    if (fits) high = mid;
    else low = mid;
  }

  camera.position.copy(_center).addScaledVector(_dir, high * offset);
  camera.lookAt(_center);
}

type CamCtrlProps = {
  targetRef: RefObject<Group>;
}

export function CamCtrl({ targetRef }: CamCtrlProps) {
  const [ctrlEnable, setCtrlEnable] = useState<boolean>(false);
  const { defCamPos, setDefCamPos } = useOther(useShallow(s => ({ ...s })));
  const { camera, size } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null!);
  const bounds = useRef(new Box3());
  const animateFlagRef = useRef<boolean>(false);

  const { gl } = useThree();
  const lastRightClickTime = useRef<number>(0);

  const handleRightDblClick = (e: MouseEvent) => {
    if (e.button !== 2) return;

    const now = performance.now();
    const diff = now - lastRightClickTime.current;
    if (diff < 300) {
      animateFlagRef.current = true;
    }

    lastRightClickTime.current = now;
  };

  const isFirstRef = useRef<boolean>(true);
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSizeRef = useRef<{ width: number; height: number }>({ width: size.width, height: size.height });

  useEffect(() => {
    if (isFirstRef.current) {
      isFirstRef.current = false;
      return;
    }
    if (size.width === lastSizeRef.current.width && size.height === lastSizeRef.current.height) {
      return;
    }
    lastSizeRef.current = { width: size.width, height: size.height };

    if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
    resizeTimerRef.current = setTimeout(() => {
      if (!controlsRef.current || !targetRef.current) return;

      const cam = camera as perCam;

      const beforePosition: Vector3Like = { x: cam.position.x, y: cam.position.y, z: cam.position.z };
      const beforeTarget: Vector3Like = { x: controlsRef.current.target.x, y: controlsRef.current.target.y, z: controlsRef.current.target.z };

      cam.position.copy(defCamPos);
      fitObject(cam, targetRef.current, 1.1);
      setDefCamPos({
        x: cam.position.x,
        y: cam.position.y,
        z: cam.position.z,
      });

      cam.position.copy(beforePosition);
      controlsRef.current.target.copy(beforeTarget);

      controlsRef.current.update();
      resizeTimerRef.current = null;
    }, 200);
  }, [size.width, size.height]);

  useLayoutEffect(() => {
    const dom = gl.domElement;
    dom.addEventListener('mousedown', handleRightDblClick);
    const preventDefault = (e: Event) => e.preventDefault();
    dom.addEventListener('contextmenu', preventDefault);

    return () => {
      dom.removeEventListener('mousedown', handleRightDblClick);
      dom.removeEventListener('contextmenu', preventDefault);
    };
  }, [gl]);

  useLayoutEffect(() => {
    if (!targetRef.current || !controlsRef.current) return;
    fitObject(camera as perCam, targetRef.current, 1.1);

    const { x, y, z } = camera.position;

    setDefCamPos({ x, y, z });

    camera.position.set(x, initComPosY, z);
    camera.lookAt(_center);

    animateFlagRef.current = true;

    targetRef.current.updateMatrixWorld(true);
    bounds.current.setFromObject(targetRef.current);
    controlsRef.current.target.copy(_center);
    controlsRef.current.maxDistance = y + 10;
    controlsRef.current.update();
  }, [targetRef, camera])

  const stiffness = 10;
  const isdragging = useRef(false);

  const ctrlClamp = (delta: number) => {
    const controls = controlsRef.current;
    const target = controls.target;
    const b = bounds.current;
    if (b.isEmpty()) return;

    const clampedX = MathUtils.clamp(target.x, b.min.x, b.max.x);
    const clampedZ = MathUtils.clamp(target.z, b.min.z, b.max.z);

    const offsetX = target.x - clampedX;
    const offsetZ = target.z - clampedZ;

    if (isdragging.current) {
      const limit = 2;
      const hardClampedX = MathUtils.clamp(target.x, b.min.x - limit, b.max.x + limit);
      const hardClampedZ = MathUtils.clamp(target.z, b.min.z - limit, b.max.z + limit);

      if (target.x !== hardClampedX || target.z !== hardClampedZ) {
        const diffX = hardClampedX - target.x;
        const diffZ = hardClampedZ - target.z;
        target.x = hardClampedX;
        camera.position.x += diffX;
        target.z = hardClampedZ;
        camera.position.z += diffZ;

        controls.update();
      }
    } else {
      if (Math.abs(offsetX) > 0.001 || Math.abs(offsetZ) > 0.001) {
        const ratio = 1 - Math.exp(-stiffness * delta);
        const moveX = offsetX * ratio;
        const moveZ = offsetZ * ratio;

        target.x -= moveX;
        camera.position.x -= moveX;
        target.z -= moveZ;
        camera.position.z -= moveZ;

        controls.update();
      }
    }
  }

  const camMoveDefPos = (delta: number) => {
    setCtrlEnable(false);
    const smoothness = 5;
    const threshold = 0.05;

    _center.copy(getCenter(targetRef.current));

    camera.position.x = MathUtils.damp(camera.position.x, defCamPos.x, smoothness, delta);
    camera.position.y = MathUtils.damp(camera.position.y, defCamPos.y, smoothness, delta);
    camera.position.z = MathUtils.damp(camera.position.z, defCamPos.z, smoothness, delta);

    const controls = controlsRef.current;
    if (controls) {
      controls.target.x = MathUtils.damp(controls.target.x, _center.x, smoothness, delta);
      controls.target.y = MathUtils.damp(controls.target.y, _center.y, smoothness, delta);
      controls.target.z = MathUtils.damp(controls.target.z, _center.z, smoothness, delta);

      controls.update();
    }

    const distance = camera.position.distanceTo(defCamPos);
    const targetDistance = controls.target.distanceTo(_center);

    if (distance < threshold && targetDistance < threshold) {
      camera.position.copy(defCamPos);
      controls.target.copy(_center);
      controls.update();
      setCtrlEnable(true);
      return true;
    }

    return false;
  }

  useFrame((_, delta) => {
    if (animateFlagRef.current) {
      if (camMoveDefPos(delta)) animateFlagRef.current = false;
    }

    if (!controlsRef.current) return;
    ctrlClamp(delta);
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, initComPosY, 0]} fov={45} />
      <OrbitControls
        enabled={ctrlEnable}
        ref={controlsRef}
        makeDefault
        enableRotate={false}
        mouseButtons={{
          LEFT: undefined,
          MIDDLE: MOUSE.DOLLY,
          RIGHT: MOUSE.PAN,
        }}
        onStart={() => (isdragging.current = true)}
        onEnd={() => (isdragging.current = false)}
        maxDistance={defCamPos.y + 10}
        minDistance={1}
      />
    </>
  );
}