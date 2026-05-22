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
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
      <div className="mx-auto max-w-md space-y-4 p-8 text-center">
        <h2 className="text-2xl font-bold">出现错误</h2>
        <p className="text-slate-400">{error.message || "应用遇到了意外错误"}</p>
        <button
          onClick={reset}
          className="rounded-xl bg-blue-600 px-6 py-2 text-sm font-medium hover:bg-blue-500"
        >
          重试
        </button>
      </div>
    </div>
  );
}
