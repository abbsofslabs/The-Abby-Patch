import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { HexColorPicker } from 'react-colorful';
import logo from '../assets/abby-patch-logo.png';
import { useAuth } from '../context/AuthContext';
import {
  createFabric,
  fetchFabricsForStore,
  mapFabricRow,
  uploadFabricImage,
} from '../utils/supabase/fabrics';
import { createStore, fetchStoreByOwner, updateStore } from '../utils/supabase/stores';

export default function StorePortal() {
  const { user, profile, signOut } = useAuth();
  const [store, setStore] = useState(null);
  const [fabrics, setFabrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingStore, setSavingStore] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [storeName, setStoreName] = useState('');
  const [address, setAddress] = useState('');
  const [storeEmail, setStoreEmail] = useState(user?.email ?? '');

  const [fabricName, setFabricName] = useState('');
  const [pricePerYard, setPricePerYard] = useState('12.99');
  const [primaryColor, setPrimaryColor] = useState('#C4898C');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');

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

  useEffect(() => {
    if (!imageFile) {
      setImagePreview('');
      return undefined;
    }

    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  if (profile && profile.role !== 'store') {
    return <Navigate to="/design" replace />;
  }

  const handleSaveStore = async (event) => {
    event.preventDefault();
    if (!user) {
      return;
    }

    setSavingStore(true);
    setError('');
    setNotice('');

    try {
      if (store) {
        const updated = await updateStore({
          storeId: store.id,
          storeName: storeName.trim(),
          address: address.trim(),
          email: storeEmail.trim(),
        });
        setStore(updated);
        setNotice('Store profile updated.');
        return;
      }

      const created = await createStore({
        ownerId: user.id,
        storeName: storeName.trim(),
        address: address.trim(),
        email: storeEmail.trim(),
      });
      setStore(created);
      setNotice('Store profile saved. You can upload fabrics now.');
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
    setNotice('');

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
      setNotice('Fabric added. Customers can find it by searching your store name.');
    } catch (uploadError) {
      setError(uploadError.message || 'Unable to upload fabric.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="abby-patch abby-patch__store-page">
      <div className="abby-patch__store-shell">
        <header className="abby-patch__store-topbar">
          <div>
            <img src={logo} alt="The Abby Patch" className="abby-patch__logo" />
            <p className="abby-patch__store-kicker">Store account</p>
            <h1 className="abby-patch__store-heading">Shop dashboard</h1>
            <p className="abby-patch__store-lede">
              This is not the quilt designer. Set up your shop, then upload fabric photos so
              customers can paint with your inventory and see pricing.
            </p>
          </div>
          <div className="abby-patch__header-actions">
            <span className="abby-patch__user-email">{user?.email}</span>
            <button
              type="button"
              className="abby-patch__button abby-patch__button--secondary"
              onClick={() => signOut()}
            >
              Sign out
            </button>
          </div>
        </header>

        <ol className="abby-patch__store-steps">
          <li className={store ? 'is-done' : 'is-active'}>1. Store info</li>
          <li className={store ? 'is-active' : ''}>2. Upload fabrics</li>
          <li className={fabrics.length ? 'is-done' : ''}>3. Customers find you by name</li>
        </ol>

        {loading ? (
          <p className="abby-patch__auth-loading">Loading store…</p>
        ) : (
          <>
            <section className="abby-patch__panel abby-patch__store-section">
              <h2 className="abby-patch__section-title">Store information</h2>
              <p className="abby-patch__tool-box-desc">
                Customers search by your store name when designing quilts.
              </p>
              <form className="abby-patch__store-form" onSubmit={handleSaveStore}>
                <div className="abby-patch__input-group abby-patch__input-group--full">
                  <label htmlFor="store-name">Store name</label>
                  <input
                    id="store-name"
                    value={storeName}
                    onChange={(event) => setStoreName(event.target.value)}
                    required
                    placeholder="e.g. Cotton & Thread Quilt Shop"
                  />
                </div>
                <div className="abby-patch__input-group abby-patch__input-group--full">
                  <label htmlFor="store-address">Address</label>
                  <input
                    id="store-address"
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    required
                    placeholder="Street, city, state"
                  />
                </div>
                <div className="abby-patch__input-group abby-patch__input-group--full">
                  <label htmlFor="store-email">Store email</label>
                  <input
                    id="store-email"
                    type="email"
                    value={storeEmail}
                    onChange={(event) => setStoreEmail(event.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="abby-patch__button" disabled={savingStore}>
                  {savingStore
                    ? 'Saving…'
                    : store
                      ? 'Update store profile'
                      : 'Save store profile'}
                </button>
              </form>
            </section>

            {store ? (
              <section className="abby-patch__panel abby-patch__store-section">
                <h2 className="abby-patch__section-title">Upload fabric</h2>
                <p className="abby-patch__tool-box-desc">
                  Add a photo, price per yard, and primary color. Customers can paint quilt blocks
                  with this fabric instead of the built-in color palette.
                </p>
                <form className="abby-patch__store-form" onSubmit={handleUploadFabric}>
                  <div className="abby-patch__input-group abby-patch__input-group--full">
                    <label htmlFor="fabric-name">Fabric name</label>
                    <input
                      id="fabric-name"
                      value={fabricName}
                      onChange={(event) => setFabricName(event.target.value)}
                      placeholder="e.g. Meadow floral"
                    />
                  </div>
                  <div className="abby-patch__input-group abby-patch__input-group--full">
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
                  <div className="abby-patch__input-group abby-patch__input-group--full">
                    <label htmlFor="fabric-image">Fabric image</label>
                    <input
                      id="fabric-image"
                      type="file"
                      accept="image/*"
                      onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
                      required
                    />
                    {imagePreview && (
                      <img
                        src={imagePreview}
                        alt="Fabric preview"
                        className="abby-patch__fabric-upload-preview"
                      />
                    )}
                  </div>
                  <div className="abby-patch__input-group abby-patch__input-group--full">
                    <label>Primary color (used on the quilt grid)</label>
                    <div className="abby-patch__store-color-picker">
                      <HexColorPicker color={primaryColor} onChange={setPrimaryColor} />
                      <span className="abby-patch__legend-hex">{primaryColor.toUpperCase()}</span>
                    </div>
                  </div>
                  <button type="submit" className="abby-patch__button" disabled={uploading}>
                    {uploading ? 'Uploading…' : 'Add fabric to catalog'}
                  </button>
                </form>
              </section>
            ) : (
              <section className="abby-patch__panel abby-patch__store-section">
                <h2 className="abby-patch__section-title">Upload fabric</h2>
                <p className="abby-patch__tool-box-desc">
                  Save your store information first, then you can upload fabric images here.
                </p>
              </section>
            )}

            {store && (
              <section className="abby-patch__panel abby-patch__store-section">
                <h2 className="abby-patch__section-title">
                  Your fabrics ({fabrics.length})
                </h2>
                {fabrics.length ? (
                  <ul className="abby-patch__store-fabric-list">
                    {fabrics.map((fabric) => (
                      <li key={fabric.id} className="abby-patch__store-fabric-card">
                        <img src={fabric.imageUrl} alt={fabric.name} />
                        <div>
                          <strong>{fabric.name}</strong>
                          <p>
                            {fabric.primaryColor.toUpperCase()} · $
                            {fabric.pricePerYard.toFixed(2)}/yd
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

        {notice && <p className="abby-patch__auth-notice">{notice}</p>}
        {error && <p className="abby-patch__auth-error">{error}</p>}

        <p className="abby-patch__store-footnote">
          Looking for the quilt designer? That&apos;s for customer accounts.{' '}
          <Link to="/">Back to home</Link>
        </p>
      </div>
    </div>
  );
}
