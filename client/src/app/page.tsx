"use client";

export default function LandingPage() {
  const handleLogin = () => {
    // Gọi thẳng đến Backend Docker của bạn
    window.location.href = "http://localhost:8000/auth/google/login";
  };

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display antialiased">
      <header className="flex items-center justify-between border-b border-solid border-primary/10 px-4 md:px-10 py-4">
        <div className="flex items-center gap-4">
          <div className="size-6 text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-[28px]">sync</span>
          </div>
          <h2 className="text-lg font-bold leading-tight tracking-[-0.015em]">PlaySync</h2>
        </div>
        <button 
          onClick={handleLogin}
          className="flex min-w-[84px] cursor-pointer items-center justify-center rounded-xl h-10 px-5 bg-primary hover:bg-primary/90 text-slate-900 transition-colors text-sm font-bold"
        >
          Get Started
        </button>
      </header>

      <main className="flex-1 flex flex-col justify-center py-16 md:py-24 text-center">
        <div className="size-16 md:size-20 text-primary mb-4 mx-auto">
          <span className="material-symbols-outlined text-[64px] md:text-[80px]">auto_awesome</span>
        </div>
        <h1 className="text-5xl md:text-7xl font-black leading-tight tracking-[-0.033em] mb-6">
          Your learning, in sync.
        </h1>
        <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-10 px-4">
          A minimal, warm productivity tool for course synchronization. Stay focused on what matters.
        </p>
        
        <div className="flex justify-center">
          <button 
            onClick={handleLogin}
            className="flex min-w-[200px] items-center justify-center rounded-xl h-14 px-8 bg-primary hover:bg-primary/90 text-slate-900 text-lg font-bold transition-all shadow-lg shadow-primary/20"
          >
            Get Started for Free
          </button>
        </div>
      </main>
    </div>
  );
}