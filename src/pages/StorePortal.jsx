import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { HexColorPicker } from 'react-colorful';
import logo from '../assets/abby-patch-logo.png';
import { useAuth } from '../context/AuthContext';
import {
  createFabric,
  fetchFabricsForStore,
  mapFabricRow,
  uploadFabricImage,
} from '../utils/supabase/fabrics';
import { createStore, fetchStoreByOwner } from '../utils/supabase/stores';

export default function StorePortal() {
  const { user, signOut } = useAuth();
  const [store, setStore] = useState(null);
  const [fabrics, setFabrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingStore, setSavingStore] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const [storeName, setStoreName] = useState('');
  const [address, setAddress] = useState('');
  const [storeEmail, setStoreEmail] = useState(user?.email ?? '');

  const [fabricName, setFabricName] = useState('');
  const [pricePerYard, setPricePerYard] = useState('12.99');
  const [primaryColor, setPrimaryColor] = useState('#C4898C');
  const [imageFile, setImageFile] = useState(null);

  const loadStore = useCallback(async () => {
    if (!user) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const existingStore = await fetchStoreByOwner(user.id);
      setStore(existingStore);
      if (existingStore) {
        setStoreName(existingStore.store_name);
        setAddress(existingStore.address);
        setStoreEmail(existingStore.email);
        const rows = await fetchFabricsForStore(existingStore.id);
        setFabrics(rows.map((row) => mapFabricRow(row, existingStore.store_name)));
      }
    } catch (loadError) {
      setError(loadError.message || 'Unable to load store.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadStore();
  }, [loadStore]);

  const handleSaveStore = async (event) => {
    event.preventDefault();
    if (!user) {
      return;
    }

    setSavingStore(true);
    setError('');

    try {
      if (store) {
        window.alert('Store profile editing will be added soon. Your store is already set up.');
        return;
      }

      const created = await createStore({
        ownerId: user.id,
        storeName: storeName.trim(),
        address: address.trim(),
        email: storeEmail.trim(),
      });
      setStore(created);
    } catch (saveError) {
      setError(saveError.message || 'Unable to save store profile.');
    } finally {
      setSavingStore(false);
    }
  };

  const handleUploadFabric = async (event) => {
    event.preventDefault();
    if (!store || !user || !imageFile) {
      setError('Choose a fabric image before uploading.');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const imageUrl = await uploadFabricImage(user.id, imageFile);
      const created = await createFabric({
        storeId: store.id,
        name: fabricName.trim() || 'Fabric',
        imageUrl,
        pricePerYard: Number(pricePerYard),
        primaryColor,
      });
      setFabrics((prev) => [mapFabricRow(created, store.store_name), ...prev]);
      setFabricName('');
      setImageFile(null);
    } catch (uploadError) {
      setError(uploadError.message || 'Unable to upload fabric.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="abby-patch abby-patch__store-page">
      <header className="abby-patch__header abby-patch__header--row">
        <div>
          <img src={logo} alt="The Abby Patch" className="abby-patch__logo" />
          <p className="abby-patch__tagline">Store dashboard</p>
        </div>
        <div className="abby-patch__header-actions">
          <Link to="/" className="abby-patch__button abby-patch__button--secondary">
            Home
          </Link>
          <button type="button" className="abby-patch__button abby-patch__button--secondary" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      {loading ? (
        <p>Loading store…</p>
      ) : (
        <>
          <section className="abby-patch__panel abby-patch__store-section">
            <h2 className="abby-patch__section-title">Store profile</h2>
            <form className="abby-patch__store-form" onSubmit={handleSaveStore}>
              <div className="abby-patch__input-group">
                <label htmlFor="store-name">Store name</label>
                <input
                  id="store-name"
                  value={storeName}
                  onChange={(event) => setStoreName(event.target.value)}
                  required
                  disabled={Boolean(store)}
                />
              </div>
              <div className="abby-patch__input-group">
                <label htmlFor="store-address">Address</label>
                <input
                  id="store-address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  required
                  disabled={Boolean(store)}
                />
              </div>
              <div className="abby-patch__input-group">
                <label htmlFor="store-email">Store email</label>
                <input
                  id="store-email"
                  type="email"
                  value={storeEmail}
                  onChange={(event) => setStoreEmail(event.target.value)}
                  required
                  disabled={Boolean(store)}
                />
              </div>
              {!store && (
                <button type="submit" className="abby-patch__button" disabled={savingStore}>
                  {savingStore ? 'Saving…' : 'Save store profile'}
                </button>
              )}
            </form>
          </section>

          {store && (
            <section className="abby-patch__panel abby-patch__store-section">
              <h2 className="abby-patch__section-title">Upload fabric</h2>
              <form className="abby-patch__store-form" onSubmit={handleUploadFabric}>
                <div className="abby-patch__input-group">
                  <label htmlFor="fabric-name">Fabric name</label>
                  <input
                    id="fabric-name"
                    value={fabricName}
                    onChange={(event) => setFabricName(event.target.value)}
                    placeholder="e.g. Meadow floral"
                  />
                </div>
                <div className="abby-patch__input-group">
                  <label htmlFor="fabric-price">Price per yard ($)</label>
                  <input
                    id="fabric-price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={pricePerYard}
                    onChange={(event) => setPricePerYard(event.target.value)}
                    required
                  />
                </div>
                <div className="abby-patch__input-group">
                  <label htmlFor="fabric-image">Fabric image</label>
                  <input
                    id="fabric-image"
                    type="file"
                    accept="image/*"
                    onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
                    required
                  />
                </div>
                <div className="abby-patch__input-group abby-patch__input-group--full">
                  <label>Primary color</label>
                  <div className="abby-patch__store-color-picker">
                    <HexColorPicker color={primaryColor} onChange={setPrimaryColor} />
                    <span className="abby-patch__legend-hex">{primaryColor.toUpperCase()}</span>
                  </div>
                </div>
                <button type="submit" className="abby-patch__button" disabled={uploading}>
                  {uploading ? 'Uploading…' : 'Add fabric'}
                </button>
              </form>
            </section>
          )}

          {store && (
            <section className="abby-patch__panel abby-patch__store-section">
              <h2 className="abby-patch__section-title">Your fabrics</h2>
              {fabrics.length ? (
                <ul className="abby-patch__store-fabric-list">
                  {fabrics.map((fabric) => (
                    <li key={fabric.id} className="abby-patch__store-fabric-card">
                      <img src={fabric.imageUrl} alt={fabric.name} />
                      <div>
                        <strong>{fabric.name}</strong>
                        <p>
                          {fabric.primaryColor.toUpperCase()} · ${fabric.pricePerYard.toFixed(2)}/yd
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No fabrics uploaded yet.</p>
              )}
            </section>
          )}
        </>
      )}

      {error && <p className="abby-patch__auth-error">{error}</p>}
    </div>
  );
}
