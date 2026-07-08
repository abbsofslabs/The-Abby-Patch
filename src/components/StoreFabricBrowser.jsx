import { useEffect, useMemo, useState } from 'react';
import { fetchFabricsForStore, mapFabricRow } from '../utils/supabase/fabrics';
import { listStores } from '../utils/supabase/stores';

export default function StoreFabricBrowser({
  selectedStore,
  selectedFabric,
  onSelectStore,
  onSelectFabric,
}) {
  const [query, setQuery] = useState(selectedStore?.store_name ?? '');
  const [allStores, setAllStores] = useState([]);
  const [fabrics, setFabrics] = useState([]);
  const [loadingStores, setLoadingStores] = useState(true);
  const [loadingFabrics, setLoadingFabrics] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoadingStores(true);
    setError('');

    listStores()
      .then((stores) => {
        if (active) {
          setAllStores(stores);
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError.message || 'Unable to load stores.');
        }
      })
      .finally(() => {
        if (active) {
          setLoadingStores(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedStore?.id) {
      setFabrics([]);
      return;
    }

    let active = true;
    setLoadingFabrics(true);
    setError('');

    fetchFabricsForStore(selectedStore.id)
      .then((rows) => {
        if (!active) {
          return;
        }
        setFabrics(rows.map((row) => mapFabricRow(row, selectedStore.store_name)));
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError.message || 'Unable to load fabrics.');
        }
      })
      .finally(() => {
        if (active) {
          setLoadingFabrics(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedStore]);

  const filteredStores = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return allStores;
    }

    return allStores.filter(
      (store) =>
        store.store_name.toLowerCase().includes(normalizedQuery) ||
        store.address.toLowerCase().includes(normalizedQuery)
    );
  }, [allStores, query]);

  const handleQueryChange = (event) => {
    const nextQuery = event.target.value;
    setQuery(nextQuery);
    setShowResults(true);

    if (!nextQuery.trim()) {
      onSelectStore(null);
      onSelectFabric(null);
    }
  };

  const handleSelectStore = (store) => {
    onSelectStore(store);
    onSelectFabric(null);
    setQuery(store.store_name);
    setShowResults(false);
  };

  const handleBlur = () => {
    window.setTimeout(() => setShowResults(false), 150);
  };

  return (
    <section className="abby-patch__store-browser abby-patch__panel">
      <h2 className="abby-patch__section-title">Shop store fabrics</h2>
      <p className="abby-patch__tool-box-desc">
        Search for a quilt shop by name, then pick a fabric to paint with on the grid. Pricing will
        show in your yardage calculator.
      </p>

      <div className="abby-patch__store-search-wrap">
        <label className="abby-patch__store-search-label" htmlFor="store-search">
          Store name
        </label>
        <input
          id="store-search"
          type="search"
          className="abby-patch__store-search-input"
          placeholder="Start typing a store name…"
          value={query}
          onChange={handleQueryChange}
          onFocus={() => setShowResults(true)}
          onBlur={handleBlur}
          autoComplete="off"
          role="combobox"
          aria-expanded={showResults}
          aria-controls="store-search-results"
        />

        {showResults && (
          <div className="abby-patch__store-results-panel" id="store-search-results">
            {loadingStores ? (
              <p className="abby-patch__store-results-empty">Loading stores…</p>
            ) : filteredStores.length ? (
              <ul className="abby-patch__store-results">
                {filteredStores.map((store) => (
                  <li key={store.id}>
                    <button
                      type="button"
                      className={`abby-patch__store-result ${
                        selectedStore?.id === store.id ? 'abby-patch__store-result--active' : ''
                      }`}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleSelectStore(store)}
                    >
                      <strong>{store.store_name}</strong>
                      <span>{store.address}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="abby-patch__store-results-empty">
                {allStores.length
                  ? 'No stores match that search.'
                  : 'No stores have signed up yet.'}
              </p>
            )}
          </div>
        )}
      </div>

      {selectedStore && (
        <div className="abby-patch__store-fabrics">
          <h3 className="abby-patch__cut-list-title">{selectedStore.store_name} fabrics</h3>
          {loadingFabrics ? (
            <p>Loading fabrics…</p>
          ) : fabrics.length ? (
            <ul className="abby-patch__store-fabric-picks">
              {fabrics.map((fabric) => (
                <li key={fabric.id}>
                  <button
                    type="button"
                    className={`abby-patch__store-fabric-pick ${
                      selectedFabric?.id === fabric.id ? 'abby-patch__store-fabric-pick--active' : ''
                    }`}
                    onClick={() => onSelectFabric(fabric)}
                  >
                    <img src={fabric.imageUrl} alt={fabric.name} />
                    <span>
                      <strong>{fabric.name}</strong>
                      <small>
                        ${fabric.pricePerYard.toFixed(2)}/yd · {fabric.primaryColor.toUpperCase()}
                      </small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p>This store has not uploaded fabrics yet.</p>
          )}
        </div>
      )}

      {error && <p className="abby-patch__auth-error">{error}</p>}
    </section>
  );
}
