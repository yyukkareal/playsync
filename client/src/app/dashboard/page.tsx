"use client";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [user, setUser] = useState<{id: string} | null>(null);

  useEffect(() => {
    // Kiểm tra xem token đã nằm trong túi chưa
    const token = localStorage.getItem("playsync_token");
    const userId = localStorage.getItem("user_id");
    
    if (!token) {
      window.location.href = "/"; // Chưa login thì đuổi về trang chủ
    } else {
      setUser({ id: userId || "" });
    }
  }, []);

  return (
    <main className="min-h-screen bg-neutral-background p-6 flex flex-col items-center">
      <div className="max-w-[640px] w-full space-y-8">
        {/* Header Dashboard */}
        <header className="flex justify-between items-center py-4 border-b border-neutral-border">
          <h1 className="text-xl font-bold text-neutral-text">My Schedule</h1>
          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center font-bold">
            {user?.id}
          </div>
        </header>

        {/* Empty State / Course List Placeholder */}
        <div className="bg-neutral-surface border border-neutral-border rounded-lg p-12 text-center shadow-card">
          <div className="text-4xl mb-4">📚</div>
          <h3 className="text-lg font-medium text-neutral-text">No courses synced yet</h3>
          <p className="text-neutral-secondary text-sm mt-2">
            Start by searching for your courses or importing your TMU timetable.
          </p>
          
          <button className="mt-8 bg-primary hover:bg-primary-hover text-neutral-text font-semibold px-6 py-2 rounded-md transition-all">
            + Add Course
          </button>
        </div>

        {/* Action Bottom */}
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-[640px] px-6">
           <button className="w-full bg-accent-orange text-white font-bold py-4 rounded-lg shadow-lg hover:brightness-110 transition-all uppercase tracking-wider">
              Sync to Google Calendar
           </button>
        </div>
      </div>
    </main>
  );
}