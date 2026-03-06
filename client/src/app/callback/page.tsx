"use client";
import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function CallbackHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const token = searchParams.get("token");
    const userId = searchParams.get("user_id");

    if (token && userId) {
      localStorage.setItem("playsync_token", token);
      localStorage.setItem("user_id", userId);
      router.push("/dashboard");
    }
  }, [searchParams, router]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      <p className="text-slate-500 font-medium">Đang xác thực...</p>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background-light">
      <Suspense fallback={<div>Loading...</div>}>
        <CallbackHandler />
      </Suspense>
    </main>
  );
}