import { useThree } from '@react-three/fiber';
import { WebGLRenderTarget, SRGBColorSpace, type Object3D, type PerspectiveCamera } from 'three';
import { GLTFExporter } from 'three-stdlib';
import { useOther } from './store';

const _ex = new GLTFExporter();

export default function useExporter(exportObj: Object3D) {
  const { gl, camera, scene } = useThree();
  async function exporter(...ignore: Object3D[]) {
    exportObj.updateWorldMatrix(true, true);
    const { defCamPos } = useOther.getState();

    const glbPromise = new Promise<Blob>((resolve, reject) => {
      ignore.forEach(o => o.visible = false);
      _ex.parse(
        exportObj,
        (result) => {
          const glb = new Blob([result as ArrayBuffer], {
            type: 'model/gltf-binary',
          });
          ignore.forEach(o => o.visible = true);
          resolve(glb);
        },
        (error) => {
          ignore.forEach(o => o.visible = true);
          reject(error);
        },
        { binary: true },
      );
    });

    const imagePromise = new Promise<string>((resolve, reject) => {
      try {
        const width = 512;
        const height = 512;
        const rt = new WebGLRenderTarget(width, height, {
          colorSpace: SRGBColorSpace,
        });

        const cam = camera as PerspectiveCamera;

        const originalAspect = cam.aspect;
        const originalPos = cam.position.clone();
        const originalQuat = cam.quaternion.clone();

        cam.aspect = width / height;
        cam.position.copy(defCamPos);
        cam.lookAt(0, 0, 0);
        cam.updateProjectionMatrix();

        const originalRT = gl.getRenderTarget();
        gl.setRenderTarget(rt);
        gl.render(scene, cam);
        const buffer = new Uint8Array(width * height * 4);
        gl.readRenderTargetPixels(rt, 0, 0, width, height, buffer);

        gl.setRenderTarget(originalRT);
        cam.aspect = originalAspect;
        cam.position.copy(originalPos);
        cam.quaternion.copy(originalQuat);
        cam.updateProjectionMatrix();

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('2D context unavailable');

        const imageData = ctx.createImageData(width, height);
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const src = (y * width + x) * 4;
            const dst = ((height - y - 1) * width + x) * 4;
            imageData.data[dst] = buffer[src];
            imageData.data[dst + 1] = buffer[src + 1];
            imageData.data[dst + 2] = buffer[src + 2];
            imageData.data[dst + 3] = buffer[src + 3];
          }
        }
        ctx.putImageData(imageData, 0, 0);

        rt.dispose();
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        reject(e);
      }
    });

    try {
      const [glb, image] = await Promise.all([glbPromise, imagePromise]);
      console.log('Generated:', {
        image: image.slice(0, 50) + '...',
        glbSize: glb.size,
      });
      // const t = await UploadFile({ image, glb });
      // if (t) window.location.href = t;
    } catch (error) {
      console.error('Save process failed:', error);
    }
  };

  return { exporter };
}