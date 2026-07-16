import { memo, useCallback, useEffect, useState } from 'react';
import { formatDimension } from '../yardageCalculator';
import {
  deleteSavedDesign,
  listSavedDesigns,
  renameSavedDesign,
} from '../utils/supabase/designs';

function formatUpdatedAt(value) {
  if (!value) {
    return '';
  }
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function SavedDesignsPanel({ userId, activeDesignId, onOpenDesign, onDesignDeleted }) {
  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setDesigns([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const rows = await listSavedDesigns(userId);
      setDesigns(rows);
    } catch (loadError) {
      console.error(loadError);
      setError(loadError.message || 'Unable to load saved patterns.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleRename = useCallback(
    async (design) => {
      const nextName = window.prompt('Rename pattern', design.name);
      if (nextName == null) {
        return;
      }
      const trimmed = nextName.trim();
      if (!trimmed || trimmed === design.name) {
        return;
      }

      setBusyId(design.id);
      setError('');
      try {
        const updated = await renameSavedDesign(design.id, trimmed);
        setDesigns((prev) =>
          prev.map((item) => (item.id === design.id ? updated : item))
        );
      } catch (renameError) {
        console.error(renameError);
        setError(renameError.message || 'Unable to rename pattern.');
      } finally {
        setBusyId(null);
      }
    },
    []
  );

  const handleDelete = useCallback(
    async (design) => {
      const confirmed = window.confirm(
        `Delete “${design.name}”? This cannot be undone.`
      );
      if (!confirmed) {
        return;
      }

      setBusyId(design.id);
      setError('');
      try {
        await deleteSavedDesign(design.id);
        setDesigns((prev) => prev.filter((item) => item.id !== design.id));
        onDesignDeleted?.(design.id);
      } catch (deleteError) {
        console.error(deleteError);
        setError(deleteError.message || 'Unable to delete pattern.');
      } finally {
        setBusyId(null);
      }
    },
    [onDesignDeleted]
  );

  return (
    <section className="abby-patch__saved abby-patch__panel" aria-label="Saved patterns">
      <div className="abby-patch__saved-header">
        <h2 className="abby-patch__section-title">My patterns</h2>
        <button
          type="button"
          className="abby-patch__tool-button"
          onClick={refresh}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      <p className="abby-patch__saved-intro">
        Open a saved design to keep editing, then download a PDF when you&apos;re ready.
        Patterns are saved to your customer account.
      </p>

      {error && <p className="abby-patch__saved-error">{error}</p>}

      {loading ? (
        <p className="abby-patch__yardage-empty">Loading your patterns…</p>
      ) : designs.length === 0 ? (
        <p className="abby-patch__yardage-empty">
          No saved patterns yet. Design a quilt, then use Save pattern on the Design tab.
        </p>
      ) : (
        <ul className="abby-patch__saved-list">
          {designs.map((design) => {
            const isActive = design.id === activeDesignId;
            const sizeLabel =
              design.quiltWidth && design.quiltHeight
                ? `${formatDimension(design.quiltWidth)}×${formatDimension(design.quiltHeight)}″`
                : 'Custom size';

            return (
              <li
                key={design.id}
                className={`abby-patch__saved-card ${isActive ? 'abby-patch__saved-card--active' : ''}`}
              >
                <div className="abby-patch__saved-swatches" aria-hidden="true">
                  {(design.previewColors.length
                    ? design.previewColors
                    : ['#f5f2e9']
                  ).map((color) => (
                    <span
                      key={`${design.id}-${color}`}
                      className="abby-patch__saved-swatch"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>

                <div className="abby-patch__saved-meta">
                  <h3 className="abby-patch__saved-name">{design.name}</h3>
                  <p className="abby-patch__saved-detail">
                    {sizeLabel}
                    {isActive ? ' · open in designer' : ''}
                  </p>
                  <p className="abby-patch__saved-detail">
                    Updated {formatUpdatedAt(design.updatedAt)}
                  </p>
                </div>

                <div className="abby-patch__saved-actions">
                  <button
                    type="button"
                    className="abby-patch__button"
                    onClick={() => onOpenDesign(design)}
                    disabled={busyId === design.id}
                  >
                    {isActive ? 'Continue editing' : 'Open & edit'}
                  </button>
                  <button
                    type="button"
                    className="abby-patch__tool-button"
                    onClick={() => handleRename(design)}
                    disabled={busyId === design.id}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="abby-patch__tool-button abby-patch__tool-button--danger"
                    onClick={() => handleDelete(design)}
                    disabled={busyId === design.id}
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default memo(SavedDesignsPanel);
