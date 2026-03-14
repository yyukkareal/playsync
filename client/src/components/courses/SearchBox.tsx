// src/components/courses/SearchBox.tsx
'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useSearch } from '@/hooks/useSearch';
import { Course } from '@/types/course';

const WEEKDAY: Record<string, string> = {
  '2': 'T2',
  '3': 'T3',
  '4': 'T4',
  '5': 'T5',
  '6': 'T6',
  '7': 'T7',
  '8': 'CN',
};

function getTimeOfDay(start_time: string): 'Sáng' | 'Trưa' | 'Chiều' {
  const hour = parseInt(start_time.slice(0, 2), 10);
  if (hour < 10) return 'Sáng';
  if (hour < 14) return 'Trưa';
  return 'Chiều';
}

const TIME_ORDER = ['Sáng', 'Trưa', 'Chiều'];

interface SearchBoxProps {
  onSelect: (course: Course) => void;
  selectedCodes: Set<string>;
  addingCode: string | null;
}

export const SearchBox: React.FC<SearchBoxProps> = ({ onSelect, selectedCodes, addingCode }) => {
  if (process.env.NODE_ENV !== 'production') {
    console.count('[render] SearchBox');
  }

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const { results, isSearching } = useSearch(query);
  const containerRef = useRef<HTMLDivElement>(null);
  const subjectNames = useMemo(
    () => [...new Set(results.map((c) => c.course_name))],
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
        <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-md">
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
        <div className="mt-3 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
          <button
            type="button"
            className="mb-2 text-xs font-medium text-slate-500 hover:text-slate-700"
            onMouseDown={(e) => {
              e.preventDefault();
              setSelectedSubject(null);
              setIsOpen(true);
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
                        className={`flex flex-col items-start rounded-xl border px-2.5 py-2 text-left transition ${
                          alreadyAdded
                            ? 'cursor-default border-transparent bg-emerald-50'
                            : 'border-slate-200 bg-white hover:border-slate-400'
                        }`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          if (!alreadyAdded && !isAdding) onSelect(course);
                        }}
                      >
                        {isAdding ? (
                          <div className="mx-auto my-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                        ) : (
                          <>
                            <div className={`mb-1 text-xs font-semibold ${alreadyAdded ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {alreadyAdded ? '✓' : dayLabel}
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
