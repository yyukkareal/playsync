// src/hooks/useCourses.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchAPI } from '@/lib/api';
import { SelectedCourse } from '@/types/course';

export function useCourses() {
  const [courses, setCourses] = useState<SelectedCourse[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCourses = useCallback(async () => {
    try {
      const res = await fetchAPI('/api/users/me/courses');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setCourses(data.courses || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const addCourse = async (code: string, name: string) => {
    try {
      const res = await fetchAPI('/api/users/me/courses', {
        method: 'POST',
        body: JSON.stringify({ course_code: code }),
      });
      
      if (res.ok) {
        setCourses(prev => [...prev, { code, name }]);
        return { success: true };
      }
      const err = await res.json();
      return { success: false, message: err.detail };
    } catch (err) {
      return { success: false, message: 'Lỗi kết nối' };
    }
  };

  const removeCourse = async (code: string) => {
    try {
      const res = await fetchAPI(`/api/users/me/courses/${code}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setCourses(prev => prev.filter(c => c.code !== code));
        return true;
      }
      return false;
    } catch (err) {
      return false;
    }
  };

  return { courses, loading, addCourse, removeCourse };
}