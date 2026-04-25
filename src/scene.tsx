import { useRef, useEffect, useMemo } from 'react';
import {
  Vector2,
  type MeshStandardMaterialParameters,
  MeshStandardMaterial,
  Fog,
  Group,
} from 'three';
import { PresentationControls } from '@react-three/drei';
import { DENT, DIFFERENCE, EXTERNAL_SHAPE, THICKNESS } from './constants';
import { CamCtrl } from './camCtrl';
import { useOther, useTasks, useTools } from './store';
import { useShallow } from 'zustand/react/shallow';
import useExporter from './export';
import { useToolHandlers } from './tools';

type Material = 'metal' | 'plastic';

const materialOfColor: Record<Material, MeshStandardMaterialParameters> = {
  metal: { color: '#666666', metalness: 0.6, roughness: 0.4, flatShading: true },
  plastic: { color: '#eeeeee', metalness: 0.1, roughness: 0.8 },
};

const lathePoints = [
  new Vector2(0, 0),
  new Vector2(EXTERNAL_SHAPE, 0),
  new Vector2(EXTERNAL_SHAPE, THICKNESS),
  new Vector2(EXTERNAL_SHAPE - DIFFERENCE, THICKNESS),
  new Vector2(EXTERNAL_SHAPE - DIFFERENCE, THICKNESS - DENT - 0.1),
  new Vector2(0, THICKNESS - DENT - 0.1),
];

function Manhole({ baseMat }: { baseMat: MeshStandardMaterial }) {
  const exportGroupRef = useRef<Group>(null!);

  const { refs, handlers, camControlsEnabled } = useToolHandlers(baseMat);
  const { editMeshRef, editGroupRef, preMeshRef } = refs;
  const { editMeshHandlers, editGroupHandlers } = handlers;

  const { trigger, setTrigger } = useOther(useShallow(s => ({ ...s })));
  const { exporter } = useExporter(exportGroupRef.current);

  useEffect(() => {
    if (!trigger) return;
    exporter(editMeshRef.current, preMeshRef.current).finally(() => setTrigger(false));
  }, [trigger]);

  return (
    <>
      <CamCtrl targetRef={exportGroupRef} />
      <PresentationControls
        enabled={camControlsEnabled}
        global
        snap
        rotation={[0, 0, 0]}
        polar={[-Math.PI / 3, Math.PI / 3]}
        azimuth={[-Math.PI / 2, Math.PI / 2]}
      >
        <group ref={exportGroupRef}>
          <group ref={editGroupRef} {...editGroupHandlers} />
          <mesh position={[0, -THICKNESS / 2, 0]} material={baseMat}>
            <latheGeometry args={[lathePoints, 128]} />
          </mesh>
          <mesh
            ref={editMeshRef}
            position={[0, THICKNESS / 2 - DENT, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            {...editMeshHandlers}
          >
            <circleGeometry args={[EXTERNAL_SHAPE - DIFFERENCE, 128]} />
            <meshStandardMaterial transparent opacity={0} />
          </mesh>
          <mesh
            ref={preMeshRef}
            visible={false}
            position={[0, THICKNESS / 2 - DENT, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            material={baseMat.clone()}
          >
            <bufferGeometry />
          </mesh>
        </group>
      </PresentationControls>
    </>
  );
}

type SceneProps = {
  material?: Material;
};

export default function Scene({ material = 'metal' }: SceneProps) {
  const baseMat = useMemo<MeshStandardMaterial>(() => new MeshStandardMaterial({ ...materialOfColor[material] }), [material]);
  const { setColor, setBaseColor } = useTools.getState();
  const { defCamPos } = useOther(useShallow(s => ({ ...s })));
  const { setWorking } = useTasks.getState();

  const fogRef = useRef<Fog>(null!);

  useEffect(() => {
    const hex = `#${baseMat.color.getHexString()}`;
    setColor(hex);
    setBaseColor(hex);
    setWorking(null);
  }, []);

  useEffect(() => {
    if (!fogRef.current) return;
    const dir = defCamPos.y
    fogRef.current.near = dir + 3;
    fogRef.current.far = dir + 20;
  }, [defCamPos]);

  return (
    <>
      <ambientLight color={0xffffff} intensity={1} />
      <directionalLight position={[0, 5, 0]} intensity={1} />
      <color attach="background" args={['#f0f0f0']} />
      <fog ref={fogRef} attach="fog" args={['#f0f0f0']} />
      <Manhole baseMat={baseMat} />
    </>
  );
}
