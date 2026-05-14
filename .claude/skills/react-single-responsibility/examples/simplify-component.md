# Simplify a Component — Before / After

## Scenario: God Component

A single component mixes data formatting, fetch logic, and rendering for multiple sub-sections.

---

### Before

```tsx
// market-list.tsx  (~180 lines — exceeds 150-line limit)
import { useState, useEffect } from 'react';

export const MarketList = () => {
  const [markets, setMarkets] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setIsLoading(true);
    fetch('/api/markets')
      .then(r => r.json())
      .then(data => { setMarkets(data); setIsLoading(false); })
      .catch(e => { setError(e.message); setIsLoading(false); });
  }, []);

  const filtered = markets.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedMarket = markets.find(m => m.id === selectedId);

  const formatStatus = (status: string) => {
    if (status === 'active') return 'Open';
    if (status === 'closed') return 'Closed';
    return 'Unknown';
  };

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      {filtered.map(market => (
        <div key={market.id} onClick={() => setSelectedId(market.id)}>
          <span>{market.name}</span>
          <span>{formatStatus(market.status)}</span>
        </div>
      ))}
      {selectedMarket && (
        <div>
          <h2>{selectedMarket.name}</h2>
          <p>{formatStatus(selectedMarket.status)}</p>
          <p>{selectedMarket.description}</p>
        </div>
      )}
    </div>
  );
};
```

---

### After

**Step 1 — Extract pure utility** (`market-list.utils.ts`):

```ts
// market-list.utils.ts
export const formatMarketStatus = (status: string): string => {
  if (status === 'active') return 'Open';
  if (status === 'closed') return 'Closed';
  return 'Unknown';
};
```

**Step 2 — Extract fetch + filter logic into a hook** (`use-market-list.ts`):

```ts
// use-market-list.ts
import { useState, useEffect } from 'react';

interface Market { id: string; name: string; status: string; description: string; }

interface UseMarketListResult {
  markets: Market[];
  isLoading: boolean;
  error: string | null;
}

export const useMarketList = (): UseMarketListResult => {
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

**Step 3 — Extract sub-components** (`market-list-item.tsx`, `market-list-detail.tsx`):

```tsx
// market-list-item.tsx
import { formatMarketStatus } from './market-list.utils';

interface MarketListItemProps {
  name: string;
  status: string;
  onClick: () => void;
}

export const MarketListItem = ({ name, status, onClick }: MarketListItemProps) => (
  <div onClick={onClick}>
    <span>{name}</span>
    <span>{formatMarketStatus(status)}</span>
  </div>
);
```

```tsx
// market-list-detail.tsx
import { formatMarketStatus } from './market-list.utils';

interface Market { id: string; name: string; status: string; description: string; }

interface MarketListDetailProps { market: Market; }

export const MarketListDetail = ({ market }: MarketListDetailProps) => (
  <div>
    <h2>{market.name}</h2>
    <p>{formatMarketStatus(market.status)}</p>
    <p>{market.description}</p>
  </div>
);
```

**Step 4 — Lean container component** (`market-list.tsx`):

```tsx
// market-list.tsx  (~30 lines)
import { useState } from 'react';
import { useMarketList } from './use-market-list';
import { MarketListItem } from './market-list-item';
import { MarketListDetail } from './market-list-detail';

export const MarketList = () => {
  const { markets, isLoading, error } = useMarketList();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  const filtered = markets.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const selectedMarket = markets.find(m => m.id === selectedId);

  return (
    <div>
      <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      {filtered.map(market => (
        <MarketListItem
          key={market.id}
          name={market.name}
          status={market.status}
          onClick={() => setSelectedId(market.id)}
        />
      ))}
      {selectedMarket && <MarketListDetail market={selectedMarket} />}
    </div>
  );
};
```

---

### What changed

| Before | After |
|--------|-------|
| 1 file, ~180 lines | 5 files, each ≤ 50 lines |
| `formatStatus` inline | `formatMarketStatus` in `market-list.utils.ts` |
| fetch + state in component | `useMarketList` hook |
| render logic inline | `MarketListItem`, `MarketListDetail` sub-components |
| Selected item stored as full object | Selected item stored as ID; derived with `.find()` |
