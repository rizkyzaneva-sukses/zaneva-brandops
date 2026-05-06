'use client';

import { useState, useEffect } from 'react';
import { getCurrentWeek, getWeekOptions, formatNum } from '@/lib/utils';

interface Brand { id: string; name: string; }
interface KpiItem { id: string; name: string; unit: string; category: string; order_num: number; }
interface KpiBrandConfig { kpi_item_id: string; kpi_name: string; is_enabled: boolean; kpi_item: KpiItem; }
interface ExistingTarget { kpi_item_id: string; target_value: number; }

export default function KpiTargetPage() {
  const week = getCurrentWeek();
  const weekOptions = getWeekOptions(6);

  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedWeek, setSelectedWeek] = useState(week.week_label);
  const [kpiConfigs, setKpiConfigs] = useState<KpiBrandConfig[]>([]);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [prevTargets, setPrevTargets] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    fetch('/api/brands?status=active').then(r => r.json()).then(data => { setBrands(data); if (data[0]) setSelectedBrand(data[0].id); });
  }, []);

  useEffect(() => {
    if (!selectedBrand) return;
    // Load KPI configs for brand
    fetch(`/api/kpi-monitor/items?brand_id=${selectedBrand}&enabled_only=true`)
      .then(r => r.json())
      .then(setKpiConfigs);
  }, [selectedBrand]);

  useEffect(() => {
    if (!selectedBrand || !selectedWeek) return;
    // Load existing targets for selected week
    fetch(`/api/kpi-targets?brand_id=${selectedBrand}&week_label=${encodeURIComponent(selectedWeek)}`)
      .then(r => r.json())
      .then((data: ExistingTarget[]) => {
        const map: Record<string, string> = {};
        data.forEach(t => { map[t.kpi_item_id] = String(t.target_value); });
        setTargets(map);
      });

    // Load previous week targets for reference
    const weekIdx = weekOptions.findIndex(w => w.week_label === selectedWeek);
    if (weekIdx < weekOptions.length - 1) {
      const prevWeek = weekOptions[weekIdx + 1];
      fetch(`/api/kpi-targets?brand_id=${selectedBrand}&week_label=${encodeURIComponent(prevWeek.week_label)}`)
        .then(r => r.json())
        .then((data: ExistingTarget[]) => {
          const map: Record<string, number> = {};
          data.forEach(t => { map[t.kpi_item_id] = t.target_value; });
          setPrevTargets(map);
        });
    }
  }, [selectedBrand, selectedWeek]);

  function copyFromPrevious() {
    const newTargets: Record<string, string> = {};
    Object.entries(prevTargets).forEach(([id, val]) => { newTargets[id] = String(val); });
    setTargets(newTargets);
  }

  async function handleSave() {
    if (!selectedBrand) return;
    setSaving(true);

    const selectedWeekData = weekOptions.find(w => w.week_label === selectedWeek);
    if (!selectedWeekData) return;

    const selectedBrandData = brands.find(b => b.id === selectedBrand);
    const payload = kpiConfigs
      .filter(c => targets[c.kpi_item_id])
      .map(c => ({
        brand_id: selectedBrand,
        brand_name: selectedBrandData?.name || '',
        kpi_item_id: c.kpi_item_id,
        kpi_name: c.kpi_name,
        week_label: selectedWeek,
        week_start_date: selectedWeekData.week_start,
        week_end_date: selectedWeekData.week_end,
        target_value: parseFloat(targets[c.kpi_item_id] || '0'),
      }));

    const res = await fetch('/api/kpi-targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targets: payload }),
    });

    setSaving(false);
    if (res.ok) {
      setToast('✅ Target KPI berhasil disimpan!');
      setTimeout(() => setToast(''), 3000);
    }
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Target KPI</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Set target KPI mingguan per brand</p>
      </div>

      {/* Selectors */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Brand</label>
            <select className="input" value={selectedBrand} onChange={e => setSelectedBrand(e.target.value)}>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Minggu</label>
            <select className="input" value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)}>
              {weekOptions.map(w => <option key={w.week_label} value={w.week_label}>{w.week_label}</option>)}
            </select>
          </div>
        </div>

        {Object.keys(prevTargets).length > 0 && (
          <button className="btn btn-secondary btn-sm" onClick={copyFromPrevious}>
            📋 Copy dari Minggu Sebelumnya
          </button>
        )}
      </div>

      {/* KPI Targets Table */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Tabel Target — {selectedWeek}</h3>
        <table className="table">
          <thead>
            <tr>
              <th>KPI</th>
              <th>Unit</th>
              <th>Target Minggu Ini</th>
              <th>Target Minggu Lalu</th>
            </tr>
          </thead>
          <tbody>
            {kpiConfigs.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Pilih brand untuk melihat KPI</td></tr>
            ) : kpiConfigs.map(config => (
              <tr key={config.kpi_item_id}>
                <td>
                  <div style={{ fontWeight: 500 }}>{config.kpi_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{config.kpi_item.category.replace('_', ' ')}</div>
                </td>
                <td style={{ color: 'var(--text-muted)', fontSize: 12, textTransform: 'capitalize' }}>{config.kpi_item.unit}</td>
                <td>
                  <input
                    className="input"
                    type="number"
                    value={targets[config.kpi_item_id] || ''}
                    onChange={e => setTargets(p => ({ ...p, [config.kpi_item_id]: e.target.value }))}
                    placeholder="0"
                    style={{ maxWidth: 160 }}
                  />
                </td>
                <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                  {prevTargets[config.kpi_item_id] ? formatNum(prevTargets[config.kpi_item_id], config.kpi_item.unit) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving || !selectedBrand}>
          {saving ? 'Menyimpan...' : '💾 Simpan Semua Target'}
        </button>
      </div>

      {toast && <div className="toast toast-success">{toast}</div>}
    </div>
  );
}
