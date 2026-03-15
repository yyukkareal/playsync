// src/components/courses/SearchBox.tsx
'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useSearch } from '@/hooks/useSearch';
import { Course } from '@/types/course';

const WEEKDAY: Record<string, string> = {
  '2': 'Thứ 2',
  '3': 'Thứ 3',
  '4': 'Thứ 4',
  '5': 'Thứ 5',
  '6': 'Thứ 6',
  '7': 'Thứ 7',
  '8': 'CN',
};

function timeToMinutes(t: string): number {
  const [h, m] = t.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
}

function hasConflict(course: Course, selectedCodes: Set<string>, allResults: Course[]): boolean {
  if (!course.schedules?.length) return false;
  const selectedCourses = allResults.filter(
    (r) => selectedCodes.has(r.course_code) && r.course_code !== course.course_code,
  );
  for (const sel of selectedCourses) {
    for (const a of course.schedules) {
      for (const b of sel.schedules ?? []) {
        if (a.weekday !== b.weekday) continue;
        const aStart = timeToMinutes(a.start_time);
        const aEnd = timeToMinutes(a.end_time);
        const bStart = timeToMinutes(b.start_time);
        const bEnd = timeToMinutes(b.end_time);
        // Overlap: start_new < end_existing AND end_new > start_existing
        if (aStart < bEnd && aEnd > bStart) return true;
      }
    }
  }
  return false;
}

function getTimeOfDay(start_time: string): 'Sáng' | 'Trưa' | 'Chiều' {
  const hour = parseInt(start_time.slice(0, 2), 10);
  if (hour < 10) return 'Sáng';
  if (hour < 14) return 'Trưa';
  return 'Chiều';
}

const TIME_ORDER = ['Sáng', 'Trưa', 'Chiều'];

interface SearchBoxProps {
  onSelect: (course: Course) => void;
  onRemove: (courseCode: string) => void;
  selectedCodes: Set<string>;
  addingCode: string | null;
  onResetSearch?: () => void;
}

export const SearchBox: React.FC<SearchBoxProps> = ({
  onSelect,
  onRemove,
  selectedCodes,
  addingCode,
  onResetSearch,
}) => {
  if (process.env.NODE_ENV !== 'production') {
    console.count('[render] SearchBox');
  }

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  const [animatingCode, setAnimatingCode] = useState<string | null>(null);
  const { results, isSearching } = useSearch(query);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const subjectNames = useMemo(
    () => Array.from(new Set(results.map((c) => c.course_name))),
    [results],
  );
  const sections = useMemo(
    () => (selectedSubject ? results.filter((c) => c.course_name === selectedSubject) : []),
    [results, selectedSubject],
  );
  const { grouped, sortedBuckets } = useMemo(() => {
    const seenSlots = new Set<string>();
    const dedupedSections = sections.filter((course) => {
      if (!course.schedules?.length) return true;
      const key = course.schedules
        .map((s) => `${s.weekday}|${s.start_time}|${s.end_time}|${s.room}`)
        .join(',');
      if (seenSlots.has(key)) return false;
      seenSlots.add(key);
      return true;
    });

    const nextGrouped = dedupedSections.reduce<Record<string, Course[]>>((acc, course) => {
      const firstSchedule = course.schedules?.[0];
      const bucket = firstSchedule ? getTimeOfDay(firstSchedule.start_time) : 'Chiều';
      if (!acc[bucket]) acc[bucket] = [];
      acc[bucket].push(course);
      return acc;
    }, {});

    const WEEKDAY_ORDER: Record<string, number> = {
      '1': 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5, '0': 6,
    };

    Object.keys(nextGrouped).forEach((bucket) => {
      nextGrouped[bucket].sort((a, b) => {
        const sa = a.schedules?.[0];
        const sb = b.schedules?.[0];
        if (!sa || !sb) return 0;
        const dayDiff =
          (WEEKDAY_ORDER[String(sa.weekday)] ?? 99) -
          (WEEKDAY_ORDER[String(sb.weekday)] ?? 99);
        if (dayDiff !== 0) return dayDiff;
        return sa.start_time.localeCompare(sb.start_time);
      });
    });

    const nextSortedBuckets = TIME_ORDER.filter((t) => nextGrouped[t]);

    return { grouped: nextGrouped, sortedBuckets: nextSortedBuckets };
  }, [sections]);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative w-full min-h-0" ref={containerRef}>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
          value={query}
          onChange={(e) => {
            const nextQuery = e.target.value;
            setQuery(nextQuery);
            setSelectedSubject(null);
            setIsOpen(nextQuery.trim().length > 0);
          }}
          onFocus={() => { if (query.trim()) setIsOpen(true); }}
          placeholder="Tìm môn học (ví dụ: MIS, Marketing...)"
          autoComplete="off"
        />
        {isSearching && (
          <div className="absolute right-3 top-3 h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
        )}
      </div>

      {isOpen && !selectedSubject && (
        <div
          className="absolute z-10 mt-1 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-md"
          style={{ maxHeight: 'clamp(200px, 40vh, 420px)' }}
        >
          {results.length === 0 ? (
            <div className="px-4 py-4 text-sm text-slate-500">
              Không tìm thấy môn nào
            </div>
          ) : (
            subjectNames.map((name) => (
              <div
                key={name}
                className="cursor-pointer border-b border-slate-100 px-4 py-3 text-sm text-slate-700 last:border-b-0 hover:bg-slate-50"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setSelectedSubject(name);
                  setIsOpen(false);
                }}
              >
                {name}
              </div>
            ))
          )}
        </div>
      )}

      {selectedSubject && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <button
            type="button"
            className="mb-2 text-xs font-medium text-slate-500 hover:text-slate-700"
            onMouseDown={(e) => {
              e.preventDefault();
              setSelectedSubject(null);
              setIsOpen(true);
              setQuery('');
              onResetSearch?.();
              setTimeout(() => inputRef.current?.focus(), 50);
            }}
          >
            ← Đổi môn
          </button>

          <p className="mb-3 text-sm font-semibold text-slate-800">{selectedSubject}</p>

          <div className="space-y-4">
            {sortedBuckets.map((bucket, i) => (
              <div key={bucket} className={i > 0 ? 'border-t border-slate-100 pt-3' : ''}>
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {bucket}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {grouped[bucket].map((course) => {
                    const alreadyAdded = selectedCodes.has(course.course_code);
                    const isAdding = addingCode === course.course_code;
                    const isConflict = !alreadyAdded && hasConflict(course, selectedCodes, results);
                    const sched = course.schedules?.[0];
                    const fallback = course.course_code.split('_').at(-1) ?? course.course_code;
                    const dayLabel = sched ? (WEEKDAY[String(sched.weekday)] ?? '?') : '';
                    const timeLabel = sched
                      ? `${sched.start_time.slice(0, 5)}–${sched.end_time.slice(0, 5)}`
                      : fallback;
                    const roomLabel = sched?.room ?? '';

                    return (
                      <button
                        key={course.course_code}
                        type="button"
                        style={animatingCode === course.course_code
                          ? { animation: 'chipPop 0.35s cubic-bezier(0.34,1.56,0.64,1) both' }
                          : undefined}
                        className={`flex flex-col items-start rounded-xl border px-2.5 py-2 text-left transition ${
                          alreadyAdded
                            ? 'cursor-pointer border-transparent bg-emerald-50 hover:bg-red-50'
                            : isConflict
                            ? 'cursor-not-allowed border-transparent bg-slate-100 opacity-40'
                            : 'border-slate-200 bg-white hover:border-slate-400'
                        }`}
                        onMouseEnter={() => alreadyAdded && setHoveredCode(course.course_code)}
                        onMouseLeave={() => setHoveredCode(null)}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          if (isAdding || isConflict) return;
                          if (alreadyAdded) {
                            onRemove(course.course_code);
                            return;
                          }

                          setAnimatingCode(course.course_code);
                          setTimeout(() => setAnimatingCode(null), 350);
                          const previouslySelected = sections.find(
                            (s) => s.course_code !== course.course_code && selectedCodes.has(s.course_code),
                          );
                          if (previouslySelected) onRemove(previouslySelected.course_code);
                          onSelect(course);
                        }}
                      >
                        {isAdding ? (
                          <div className="mx-auto my-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                        ) : (
                          <>
                            <div
                              className={`mb-1 text-xs font-semibold ${
                                alreadyAdded
                                  ? hoveredCode === course.course_code ? 'text-red-500' : 'text-emerald-600'
                                  : 'text-slate-400'
                              }`}
                            >
                              {alreadyAdded ? (
                                hoveredCode === course.course_code ? '✕' : (
                                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ display: 'inline' }}>
                                    <polyline
                                      points="3 8 6.5 11.5 13 5"
                                      stroke="currentColor"
                                      strokeWidth="2.5"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      style={{
                                        strokeDasharray: 20,
                                        strokeDashoffset: 0,
                                        animation: 'checkDraw 0.3s 0.05s ease forwards',
                                      }}
                                    />
                                  </svg>
                                )
                              ) : dayLabel}
                            </div>
                            <div className={`text-xs font-medium leading-snug ${alreadyAdded ? 'text-emerald-700' : 'text-slate-800'}`}>
                              {timeLabel}
                            </div>
                            {roomLabel ? (
                              <div className="mt-0.5 w-full truncate text-xs text-slate-400">{roomLabel}</div>
                            ) : null}
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
