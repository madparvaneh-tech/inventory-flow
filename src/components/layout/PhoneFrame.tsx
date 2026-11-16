import { type ReactNode } from 'react';

export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-[#ded7c8] dark:bg-black flex justify-center items-center p-5">
      <div className="w-[390px] h-[844px] bg-cream dark:bg-[#0E0D0B] rounded-[44px] overflow-hidden relative shadow-[0_30px_80px_rgba(0,0,0,0.25),0_0_0_10px_#111] flex flex-col">
        {children}
      </div>
    </div>
  );
}