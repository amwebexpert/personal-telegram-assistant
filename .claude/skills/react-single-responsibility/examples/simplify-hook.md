# Simplify a Hook — Before / After

## Scenario: Broad hook handling fetch + filter + pagination

---

### Before

```ts
// use-markets.ts  — does too many things
import { useState, useEffect } from 'react';

export const useMarkets = () => {
  const [markets, setMarkets] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    setIsLoading(true);
    fetch('/api/markets')
      .then(r => r.json())
      .then(data => { setMarkets(data); setIsLoading(false); })
      .catch(e => { setError(e.message); setIsLoading(false); });
  }, []);

  const filtered = markets
    .filter(m => statusFilter === 'all' || m.status === statusFilter)
    .filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  return {
    markets: paginated,
    isLoading,
    error,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    page,
    setPage,
    totalPages,
  };
};
```

---

### After

**Step 1 — Extract pure filtering utility** (`use-markets.utils.ts`):

```ts
// use-markets.utils.ts
interface Market { id: string; name: string; status: string; }

interface FilterMarketsArgs {
  markets: Market[];
  searchTerm: string;
  statusFilter: string;
}

export const filterMarkets = ({ markets, searchTerm, statusFilter }: FilterMarketsArgs): Market[] =>
  markets
    .filter(m => statusFilter === 'all' || m.status === statusFilter)
    .filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()));
```

**Step 2 — Split into three focused hooks**:

```ts
// use-markets-fetch.ts  — one concern: data fetching
import { useState, useEffect } from 'react';

interface Market { id: string; name: string; status: string; }

interface UseMarketsFetchResult {
  markets: Market[];
  isLoading: boolean;
  error: string | null;
}

export const useMarketsFetch = (): UseMarketsFetchResult => {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    fetch('/api/markets')
      .then(r => r.json())
      .then(data => { setMarkets(data); setIsLoading(false); })
      .catch(e => { setError(e.message); setIsLoading(false); });
  }, []);

  return { markets, isLoading, error };
};
```

```ts
// use-markets-filter.ts  — one concern: search + status filter
import { useState } from 'react';
import { filterMarkets } from './use-markets.utils';

interface Market { id: string; name: string; status: string; }

interface UseMarketsFilterArgs { markets: Market[]; }

export const useMarketsFilter = ({ markets }: UseMarketsFilterArgs) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = filterMarkets({ markets, searchTerm, statusFilter });

  return { filtered, searchTerm, setSearchTerm, statusFilter, setStatusFilter };
};
```

```ts
// use-pagination.ts  — one concern: page state (reusable across features)
import { useState } from 'react';

interface UsePaginationArgs { totalItems: number; pageSize?: number; }

export const usePagination = ({ totalItems, pageSize = 10 }: UsePaginationArgs) => {
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(totalItems / pageSize);
  const offset = (page - 1) * pageSize;

  return { page, setPage, totalPages, offset, pageSize };
};
```

**Step 3 — Thin orchestrator hook** (or wire directly in the component):

```ts
// use-markets.ts  — orchestrates the three focused hooks
import { useMarketsFetch } from './use-markets-fetch';
import { useMarketsFilter } from './use-markets-filter';
import { usePagination } from './use-pagination';

export const useMarkets = () => {
  const { markets, isLoading, error } = useMarketsFetch();
  const { filtered, searchTerm, setSearchTerm, statusFilter, setStatusFilter } =
    useMarketsFilter({ markets });
  const { page, setPage, totalPages, offset, pageSize } =
    usePagination({ totalItems: filtered.length });

  const paginated = filtered.slice(offset, offset + pageSize);

  return {
    markets: paginated,
    isLoading,
    error,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    page,
    setPage,
    totalPages,
  };
};
```

---

### What changed

| Before | After |
|--------|-------|
| 1 hook, 3 concerns | 3 focused hooks + 1 orchestrator |
| Filter logic inline | `filterMarkets` pure function in `.utils.ts` |
| Pagination logic coupled to markets | `usePagination` is reusable anywhere |
| All state in one bag | Each hook returns only its own slice |
