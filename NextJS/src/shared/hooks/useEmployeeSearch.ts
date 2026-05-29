"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import useSWR from "swr";
import { ApiResponse } from "@/app/types/types";

interface UseEmployeeSearchOptions<T> {
  searchFn: (cedula: string) => Promise<ApiResponse<T>>;
  onFound?: (employee: T) => void;
  namespace?: string;
}

interface UseEmployeeSearchReturn<T> {
  employee: T | null;
  isLoading: boolean;
  hasSearched: boolean;
  search: (cedula: string) => void;
  clear: () => void;
}

function extractEmployee<T>(data: ApiResponse<T>): T | null {
  const payload = data?.data;
  if (!payload) return null;
  if (data?.status === "error") return null;
  if (Array.isArray(payload) && payload.length === 0) return null;
  return payload as T;
}

export function useEmployeeSearch<T>(
  options: UseEmployeeSearchOptions<T>
): UseEmployeeSearchReturn<T> {
  const { searchFn, onFound, namespace = "" } = options;
  const [cedula, setCedula] = useState<string | null>(null);

  const swrKey = cedula ? ["employee-search", namespace, cedula] : null;

  const { data, isLoading } = useSWR(swrKey, () => searchFn(cedula!));

  const employee = data ? extractEmployee(data) : null;

  const prevEmployeeRef = useRef<T | null>(null);

  useEffect(() => {
    if (employee && employee !== prevEmployeeRef.current) {
      onFound?.(employee);
    }
    prevEmployeeRef.current = employee;
  }, [employee, onFound]);

  const search = useCallback(
    (id: string) => {
      setCedula(id);
    },
    []
  );

  const clear = useCallback(() => {
    setCedula(null);
  }, []);

  const hasSearched = !!cedula && !isLoading;

  return { employee, isLoading, hasSearched, search, clear };
}
