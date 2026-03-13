// src/components/courses/SearchBox.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSearch } from '@/hooks/useSearch';
import { Course } from '@/types/course';

interface SearchBoxProps {
  onSelect: (course: Course) => void;
  selectedCodes: Set<string>;
  addingCode: string | null;
}

export const SearchBox: React.FC<SearchBoxProps> = ({ onSelect, selectedCodes, addingCode }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const { results, isSearching } = useSearch(query);
  const containerRef = useRef<HTMLDivElement>(null);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="search-wrap" ref={containerRef} style={{ position: 'relative' }}>
      <div className="search-input-row">
        <input
          className="search-input"
          value={query}
          onChange={(e) => {
            const nextQuery = e.target.value;
            setQuery(nextQuery);
            setIsOpen(nextQuery.trim().length > 0);
          }}
          onFocus={() => { if (query.trim()) setIsOpen(true); }}
          placeholder="Tìm môn học (ví dụ: MIS, Marketing...)"
          autoComplete="off"
        />
        {isSearching && <div className="spinner" />}
      </div>

      {isOpen && (
        <div className="search-dropdown">
          {results.length === 0 ? (
            <div style={{ padding: '16px', color: 'var(--ink-muted)' }}>
              Không tìm thấy môn nào 📭
            </div>
          ) : (
            results.map((course) => {
              const alreadyAdded = selectedCodes.has(course.course_code);
              const isAdding = addingCode === course.course_code;
              
              return (
                <div
                  key={course.course_code}
                  className={`dropdown-item ${alreadyAdded ? 'already-added' : ''}`}
                  onMouseDown={(e) => {
                    // Dùng onMouseDown thay vì onClick để tránh bị blur input làm đóng dropdown trước khi click kịp trigger
                    e.preventDefault();
                    if (!alreadyAdded && !isAdding) onSelect(course);
                  }}
                >
                  <div className="dropdown-item-left">
                    <div className="dropdown-course-name">{course.course_name}</div>
                  </div>
                  <div className="dropdown-meta">
                    <span className="dropdown-code">{course.course_code}</span>
                    {alreadyAdded && <span className="dropdown-added-badge">✓ Đã thêm</span>}
                    {isAdding && <div className="spinner" />}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
