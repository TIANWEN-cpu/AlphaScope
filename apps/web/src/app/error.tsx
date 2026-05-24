"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050505] text-white">
      <div className="mx-auto max-w-md space-y-4 p-8 text-center">
        <h2 className="text-2xl font-display font-bold">出现错误</h2>
        <p className="text-neutral-400">{error.message || "应用遇到了意外错误"}</p>
        <button
          onClick={reset}
          className="rounded-xl bg-indigo-600 px-6 py-2 text-sm font-medium hover:bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.3)]"
        >
          重试
        </button>
      </div>
    </div>
  );
}
