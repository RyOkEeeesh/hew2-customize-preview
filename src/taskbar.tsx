import { useShallow } from 'zustand/react/shallow';
import { useTasks, useTools } from './store';
import { useEffect, useRef } from 'react';
import { TOOL_MAP } from './constants';

const alpha = 0.1;

export default function Taskbar() {
  const { working } = useTasks(useShallow(s => ({ ...s })));
  const { tool } = useTools(useShallow(s => ({ ...s })));

  const toolDisRef = useRef<HTMLParagraphElement>(null!);
  const FPSDisRef = useRef<HTMLParagraphElement>(null!);
  const memoryRef = useRef<HTMLParagraphElement>(null!);

  useEffect(() => {
    let smoothedFPS = 0;

    const loop = (timePrev: number) => {
      requestAnimationFrame((time) => {
        const delta = (time - timePrev) / 1000;
        const currentFPS = 1 / delta;
        smoothedFPS = alpha * currentFPS + (1 - alpha) * smoothedFPS;
        if (FPSDisRef.current) FPSDisRef.current.textContent = `${smoothedFPS.toFixed(1)} FPS`;

        if ('memory' in performance && memoryRef.current) {
          const memory = (performance as any).memory;
          const usedMB = (memory.usedJSHeapSize / 1024 / 1024).toFixed(1);
          const totalMB = (memory.totalJSHeapSize / 1024 / 1024).toFixed(1);
          memoryRef.current.textContent = `${usedMB} / ${totalMB} MB`;
        }

        loop(time);
      });
    };

    loop(performance.now());
  }, []);

  useEffect(() => {
    if (!toolDisRef.current) return;
    toolDisRef.current.textContent = TOOL_MAP[tool].title;
  }, [tool]);

  return (
    <div className='h-task-h w-full text-[12px] bg-bgclr text-txclr flex items-center justify-between px-4 select-none'>
      <div className='flex gap-2'>
        <p ref={toolDisRef} />
        {working && (
          <div className='flex items-center gap-1'>
            <div className='loader' />
            <p>{working}</p>
          </div>)
        }
      </div>
      <div className='flex flex-row-reverse gap-2'>
        <p ref={FPSDisRef} />
        <p ref={memoryRef} />
      </div>
    </div>
  )
}