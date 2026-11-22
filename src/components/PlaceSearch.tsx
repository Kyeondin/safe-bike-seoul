"use client";

import { useEffect, useId, useState } from "react";
import type { ApiResponse } from "@/lib/types";
import type { Place } from "@/lib/places";

type Props = {
  label: string;
  color: string;
  value: Place | null;
  onChange: (p: Place | null) => void;
};

type SearchState = { query: string; results: Place[]; error: string | null };

/** 카카오 로컬 키워드 검색(/api/search). 입력 후 300ms 디바운스 */
export default function PlaceSearch({ label, color, value, onChange }: Props) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [search, setSearch] = useState<SearchState | null>(null);
  const listId = useId();
  const q = query.trim();
  // 선택된 장소명 그대로면 검색하지 않음
  const shouldSearch = open && q.length > 0 && q !== value?.name;

  useEffect(() => {
    if (!shouldSearch) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => r.json() as Promise<ApiResponse<Place[]>>)
        .then((json) => {
          if (!json.ok) throw new Error(json.error);
          setSearch({ query: q, results: json.data, error: null });
          setActive(0);
        })
        .catch((err: unknown) => {
          if (ctrl.signal.aborted) return;
          setSearch({ query: q, results: [], error: err instanceof Error ? err.message : "검색에 실패했습니다." });
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q, shouldSearch]);

  const current = search?.query === q ? search : null;
  const loading = shouldSearch && !current;
  const results = current?.results ?? [];

  const select = (p: Place) => {
    onChange(p);
    setQuery(p.name);
    setOpen(false);
  };

  return (
    <div className="relative">
      <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
        <span className="w-10 shrink-0 text-xs font-semibold text-slate-500">{label}</span>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={(e) => {
            setOpen(true);
            e.currentTarget.select();
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") setActive((i) => Math.min(i + 1, results.length - 1));
            if (e.key === "ArrowUp") setActive((i) => Math.max(i - 1, 0));
            if (e.key === "Enter" && results[active]) select(results[active]);
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="장소·주소 검색 (서울)"
          className="w-full bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400 md:text-sm"
          role="combobox"
          aria-label={`${label} 검색`}
          aria-expanded={open && shouldSearch}
          aria-controls={listId}
          aria-autocomplete="list"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              onChange(null);
            }}
            className="p-1 text-slate-400 hover:text-slate-600"
            aria-label={`${label} 지우기`}
          >
            ✕
          </button>
        )}
      </label>

      {open && shouldSearch && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {loading && <li className="px-3 py-2 text-sm text-slate-400">검색 중…</li>}
          {current?.error && (
            <li className="px-3 py-2 text-sm text-red-600">
              장소 검색 실패: {current.error}
            </li>
          )}
          {current && !current.error && results.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-500">&lsquo;{q}&rsquo; 검색 결과가 없습니다. (서울 지역만 검색)</li>
          )}
          {results.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(p)}
                className={`w-full px-3 py-2 text-left ${i === active ? "bg-emerald-50" : "hover:bg-slate-50"}`}
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-slate-900">{p.name}</span>
                  {p.category && <span className="text-[10px] text-slate-400">{p.category}</span>}
                </div>
                <div className="text-xs text-slate-500">{p.address}</div>
              </button>
            </li>
          ))}
          {results.length > 0 && <li className="px-3 pt-1 text-right text-[10px] text-slate-400">검색: 카카오 로컬</li>}
        </ul>
      )}
    </div>
  );
}
