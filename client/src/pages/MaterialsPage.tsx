import { useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Package, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { rollsDb, consumablesDb } from '../lib/db';
import { PRODUCT_TYPES, CONSUMABLE_CATEGORIES } from '../config';
import type { Roll, Consumable } from '../types/models';
import type { ProductType, ConsumableCategory } from '../config';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { cn } from '../lib/utils';

// ── Helpers ───────────────────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  BOPP: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  UL: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  Natural: 'bg-green-500/20 text-green-300 border-green-500/30',
  Laminated: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
};
const CAT_COLORS: Record<string, string> = {
  Ink: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  Thread: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  Filler: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  Custom: 'bg-accent/20 text-accent border-accent/30',
};

// ─────────────────────────────────────────────────────────────────────────────
// ROLLS
// ─────────────────────────────────────────────────────────────────────────────
const emptyRoll: Omit<Roll, 'id'> = {
  rollNo: '', type: 'BOPP', size: '', quality: '', meter: 0,
  grossWeight: 0, netWeight: 0, createdAt: new Date().toISOString(),
};

function RollForm({ initial, onSave, onClose }: {
  initial: Omit<Roll, 'id'>;
  onSave: (data: Omit<Roll, 'id'>) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState(initial);
  const set = (k: keyof typeof f, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  function submit() {
    if (!f.rollNo.trim()) { toast.error('Roll No. is required'); return; }
    onSave(f);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Roll No. *</label>
          <input className="input-field font-mono" value={f.rollNo} onChange={(e) => set('rollNo', e.target.value)} placeholder="NF-R-001" autoFocus />
        </div>
        <div>
          <label className="label">Type</label>
          <select className="input-field" value={f.type} onChange={(e) => set('type', e.target.value as ProductType)}>
            {PRODUCT_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Size</label>
          <input className="input-field" value={f.size} onChange={(e) => set('size', e.target.value)} placeholder="500mm × 5000m" />
        </div>
        <div>
          <label className="label">Quality</label>
          <input className="input-field" value={f.quality} onChange={(e) => set('quality', e.target.value)} placeholder="Premium / Standard" />
        </div>
        <div>
          <label className="label">Meter</label>
          <input className="input-field font-mono" type="number" min="0" value={f.meter || ''} onChange={(e) => set('meter', parseFloat(e.target.value) || 0)} placeholder="5000" />
        </div>
        <div>
          <label className="label">G.WT (kg)</label>
          <input className="input-field font-mono" type="number" min="0" step="0.1" value={f.grossWeight || ''} onChange={(e) => set('grossWeight', parseFloat(e.target.value) || 0)} placeholder="82.5" />
        </div>
        <div>
          <label className="label">N.WT (kg)</label>
          <input className="input-field font-mono" type="number" min="0" step="0.1" value={f.netWeight || ''} onChange={(e) => set('netWeight', parseFloat(e.target.value) || 0)} placeholder="80.0" />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={submit} className="btn-primary flex-1 justify-center">Save Roll</button>
      </div>
    </div>
  );
}

function RollsSection() {
  const [rolls, setRolls]   = useState<Roll[]>(() => rollsDb.getAll());
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [modal, setModal]   = useState<{ type: 'add' | 'edit'; roll?: Roll } | null>(null);

  const reload = useCallback(() => setRolls(rollsDb.getAll()), []);

  function handleSave(data: Omit<Roll, 'id'>) {
    if (modal?.type === 'edit' && modal.roll) {
      rollsDb.update(modal.roll.id, data);
      toast.success('Roll updated');
    } else {
      rollsDb.create(data);
      toast.success('Roll added');
    }
    reload();
    setModal(null);
  }

  function handleDelete(id: string) {
    rollsDb.delete(id);
    toast.success('Roll deleted');
    reload();
  }

  const filtered = rolls.filter((r) =>
    (!search || r.rollNo.toLowerCase().includes(search.toLowerCase()) || r.quality.toLowerCase().includes(search.toLowerCase())) &&
    (!typeFilter || r.type === typeFilter)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search roll no. or quality…" className="input-field pl-9" />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input-field w-36">
          <option value="">All Types</option>
          {PRODUCT_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <button onClick={() => setModal({ type: 'add' })} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Roll
        </button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {['Roll No.', 'Type', 'Size', 'Quality', 'Meter', 'G.WT', 'N.WT', ''].map((h) => (
                  <th key={h} className="table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8}>
                  <EmptyState icon={Package} title="No rolls found"
                    action={{ label: 'Add First Roll', onClick: () => setModal({ type: 'add' }) }} />
                </td></tr>
              ) : filtered.map((r) => (
                <tr key={r.id} className="table-row">
                  <td className="table-cell font-mono text-accent font-medium">{r.rollNo}</td>
                  <td className="table-cell">
                    <span className={cn('badge border text-xs', TYPE_COLORS[r.type])}>{r.type}</span>
                  </td>
                  <td className="table-cell text-white/70">{r.size}</td>
                  <td className="table-cell text-white/70">{r.quality}</td>
                  <td className="table-cell font-mono">{r.meter.toLocaleString('en-IN')} m</td>
                  <td className="table-cell font-mono">{r.grossWeight} kg</td>
                  <td className="table-cell font-mono">{r.netWeight} kg</td>
                  <td className="table-cell">
                    <div className="flex gap-1.5">
                      <button onClick={() => setModal({ type: 'edit', roll: r })} className="p-1.5 rounded hover:bg-accent/20 text-muted hover:text-accent transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded hover:bg-red-500/20 text-muted hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-2 border-t border-accent/10 text-muted text-xs">{filtered.length} rolls</div>
      </div>

      {modal && (
        <Modal open onClose={() => setModal(null)}
          title={modal.type === 'add' ? 'Add Roll' : 'Edit Roll'} size="md">
          <RollForm
            initial={modal.roll ?? { ...emptyRoll, createdAt: new Date().toISOString() }}
            onSave={handleSave}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSUMABLES
// ─────────────────────────────────────────────────────────────────────────────
const emptyConsumable: Omit<Consumable, 'id'> = {
  category: 'Ink', name: '', quantity: 0, unit: 'kg', notes: '', createdAt: new Date().toISOString(),
};

function ConsumableForm({ initial, onSave, onClose }: {
  initial: Omit<Consumable, 'id'>;
  onSave: (data: Omit<Consumable, 'id'>) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState(initial);
  const set = (k: keyof typeof f, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  function submit() {
    if (!f.name.trim()) { toast.error('Name is required'); return; }
    onSave(f);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Category</label>
          <select className="input-field" value={f.category} onChange={(e) => set('category', e.target.value as ConsumableCategory)}>
            {CONSUMABLE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Name *</label>
          <input className="input-field" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. White Ink (Flexo)" autoFocus />
        </div>
        <div>
          <label className="label">Quantity</label>
          <input className="input-field font-mono" type="number" min="0" step="0.1" value={f.quantity || ''} onChange={(e) => set('quantity', parseFloat(e.target.value) || 0)} placeholder="0" />
        </div>
        <div>
          <label className="label">Unit</label>
          <input className="input-field" value={f.unit} onChange={(e) => set('unit', e.target.value)} placeholder="kg / litre / bobbins" />
        </div>
      </div>
      <div>
        <label className="label">Notes</label>
        <input className="input-field" value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Optional notes" />
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
        <button onClick={submit} className="btn-primary flex-1 justify-center">Save</button>
      </div>
    </div>
  );
}

function ConsumablesSection() {
  const [items, setItems] = useState<Consumable[]>(() => consumablesDb.getAll());
  const [activeCategory, setActiveCategory] = useState<ConsumableCategory | 'All'>('All');
  const [modal, setModal] = useState<{ type: 'add' | 'edit'; item?: Consumable } | null>(null);

  const reload = useCallback(() => setItems(consumablesDb.getAll()), []);

  function handleSave(data: Omit<Consumable, 'id'>) {
    if (modal?.type === 'edit' && modal.item) {
      consumablesDb.update(modal.item.id, data);
      toast.success('Consumable updated');
    } else {
      consumablesDb.create(data);
      toast.success('Consumable added');
    }
    reload();
    setModal(null);
  }

  function handleDelete(id: string) {
    consumablesDb.delete(id);
    toast.success('Deleted');
    reload();
  }

  const grouped = CONSUMABLE_CATEGORIES.map((cat) => ({
    cat,
    items: items.filter((i) => i.category === cat),
  })).filter(({ items, cat }) => items.length > 0 || activeCategory === cat || activeCategory === 'All');

  const visible = activeCategory === 'All'
    ? grouped
    : grouped.filter((g) => g.cat === activeCategory);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          {(['All', ...CONSUMABLE_CATEGORIES] as const).map((cat) => (
            <button key={cat}
              onClick={() => setActiveCategory(cat as ConsumableCategory | 'All')}
              className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                activeCategory === cat ? 'bg-primary text-white' : 'text-muted hover:text-white hover:bg-white/10')}
            >
              {cat}
              {cat !== 'All' && (
                <span className="ml-1.5 font-mono text-xs opacity-60">
                  {items.filter((i) => i.category === cat).length}
                </span>
              )}
            </button>
          ))}
        </div>
        <button onClick={() => setModal({ type: 'add' })} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Consumable
        </button>
      </div>

      {visible.map(({ cat, items: catItems }) => (
        <div key={cat} className="glass-card overflow-hidden">
          <div className="px-5 py-3 border-b border-accent/10 flex items-center gap-2">
            <span className={cn('badge border text-xs', CAT_COLORS[cat])}>{cat}</span>
            <span className="text-muted text-xs">{catItems.length} items</span>
          </div>
          {catItems.length === 0 ? (
            <div className="py-8 text-center text-muted text-sm">No {cat} items yet</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="table-header">Name</th>
                  <th className="table-header">Quantity</th>
                  <th className="table-header">Unit</th>
                  <th className="table-header">Notes</th>
                  <th className="table-header"></th>
                </tr>
              </thead>
              <tbody>
                {catItems.map((item) => (
                  <tr key={item.id} className="table-row">
                    <td className="table-cell font-medium">{item.name}</td>
                    <td className={cn('table-cell font-mono font-bold', item.quantity < 20 ? 'text-orange-400' : 'text-white')}>
                      {item.quantity}
                    </td>
                    <td className="table-cell text-muted">{item.unit}</td>
                    <td className="table-cell text-muted text-xs">{item.notes || '—'}</td>
                    <td className="table-cell">
                      <div className="flex gap-1.5">
                        <button onClick={() => setModal({ type: 'edit', item })} className="p-1.5 rounded hover:bg-accent/20 text-muted hover:text-accent transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded hover:bg-red-500/20 text-muted hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}

      {modal && (
        <Modal open onClose={() => setModal(null)}
          title={modal.type === 'add' ? 'Add Consumable' : 'Edit Consumable'} size="sm">
          <ConsumableForm
            initial={modal.item ?? { ...emptyConsumable, createdAt: new Date().toISOString() }}
            onSave={handleSave}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export function MaterialsPage() {
  const [tab, setTab] = useState<'rolls' | 'consumables'>('rolls');

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-header">Materials</h1>
        <p className="text-muted text-sm mt-1">Manage rolls stock and consumables inventory</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-navy/60 rounded-xl border border-accent/10 w-fit">
        {(['rolls', 'consumables'] as const).map((t) => (
          <button key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-5 py-2 rounded-lg text-sm font-medium transition-all capitalize',
              tab === t ? 'bg-primary text-white shadow' : 'text-muted hover:text-white'
            )}
          >
            {t === 'rolls' ? '🎞️ Rolls' : '🧪 Consumables'}
          </button>
        ))}
      </div>

      {tab === 'rolls' ? <RollsSection /> : <ConsumablesSection />}
    </div>
  );
}
