import { Canvas } from '@react-three/fiber';
import { Loader2 } from 'lucide-react';
import HtmlUI from './html';
import Taskbar from './taskbar';
import Scene from './scene';
import { useOther } from './store';
import { useShallow } from 'zustand/react/shallow';

export default function Customize() {
  const { trigger } = useOther(useShallow(s => ({ ...s })));

  return (
    <div className='nv relative w-full overflow-hidden bg-zinc-100'>
      <div className='display'>
        <HtmlUI />
        <Canvas
          className='block'
          shadows
          style={{
            width: '100%',
            height: '100%',
          }}
        >
          <Scene />
        </Canvas>
      </div>
      <Taskbar />
      {trigger && (
        <div className='center pointer-events-none absolute inset-0 z-50 bg-black/20 backdrop-blur-sm'>
          <div className='flex flex-col items-center gap-2 rounded-xl bg-white p-4 shadow-2xl'>
            <Loader2 className='animate-spin text-blue-500' size={32} />
            <p className='text-sm font-medium text-gray-600'>Saving...</p>
          </div>
        </div>
      )}
    </div>
  );
}
