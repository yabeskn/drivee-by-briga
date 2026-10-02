'use client';

import React, { useState, useEffect } from 'react';
import {
  Car,
  Bluetooth,
  Plus,
  Search,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Phone,
  Shield,
  Loader2,
  RefreshCw,
  X,
  Battery,
  MapPin,
} from 'lucide-react';
import type { EVVehicle } from '@/types/telematics';

export function FleetManagementTab() {
  const [vehicles, setVehicles] = useState<EVVehicle[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingVehicle, setEditingVehicle] = useState<EVVehicle | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formLicensePlate, setFormLicensePlate] = useState('');
  const [formBatteryCapacity, setFormBatteryCapacity] = useState('30');
  const [formBluetoothName, setFormBluetoothName] = useState('');
  const [formRentalPartner, setFormRentalPartner] = useState('');
  const [formRentalPhone, setFormRentalPhone] = useState('');
  const [formStatus, setFormStatus] = useState<'available' | 'in_service' | 'charging'>('available');

  const fetchVehicles = async (query = '') => {
    setIsLoading(true);
    try {
      const url = query ? `/api/admin/vehicles?q=${encodeURIComponent(query)}` : '/api/admin/vehicles';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && Array.isArray(data.vehicles)) {
        setVehicles(data.vehicles);
      }
    } catch (err) {
      console.error('Failed to load vehicles:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  const handleOpenAdd = () => {
    setEditingVehicle(null);
    setFormCode(`EV-0${vehicles.length + 1}`);
    setFormName('Wuling Air EV Long Range');
    setFormModel('Air EV 26.7 kWh');
    setFormLicensePlate('');
    setFormBatteryCapacity('26.7');
    setFormBluetoothName('');
    setFormRentalPartner('');
    setFormRentalPhone('');
    setFormStatus('available');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (v: EVVehicle) => {
    setEditingVehicle(v);
    setFormCode(v.code);
    setFormName(v.name);
    setFormModel(v.model);
    setFormLicensePlate(v.licensePlate);
    setFormBatteryCapacity(String(v.batteryCapacityKwh));
    setFormBluetoothName(v.bluetoothName || '');
    setFormRentalPartner(v.rentalPartnerName || '');
    setFormRentalPhone(v.rentalPartnerPhone || '');
    setFormStatus(v.status);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);

    try {
      const payload = {
        code: formCode,
        name: formName,
        model: formModel,
        licensePlate: formLicensePlate,
        batteryCapacityKwh: Number(formBatteryCapacity),
        bluetoothName: formBluetoothName,
        rentalPartnerName: formRentalPartner,
        rentalPartnerPhone: formRentalPhone,
        status: formStatus,
      };

      if (editingVehicle) {
        // Update
        const res = await fetch('/api/admin/vehicles', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingVehicle.id, ...payload }),
        });
        const data = await res.json();
        if (data.success) {
          setStatusMessage({ type: 'success', text: `Unit ${formCode} berhasil diperbarui!` });
          setIsModalOpen(false);
          fetchVehicles(searchQuery);
        } else {
          setStatusMessage({ type: 'error', text: data.error || 'Gagal menyimpan perubahan' });
        }
      } else {
        // Create
        const res = await fetch('/api/admin/vehicles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success) {
          setStatusMessage({ type: 'success', text: `Unit ${formCode} berhasil ditambahkan!` });
          setIsModalOpen(false);
          fetchVehicles(searchQuery);
        } else {
          setStatusMessage({ type: 'error', text: data.error || 'Gagal menambah unit baru' });
        }
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: (err as Error).message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/60 border border-zinc-800 p-5 rounded-2xl">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Car className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-semibold text-white tracking-tight">
              Manajemen Armada EV & Mitra Rental
            </h2>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Kelola identitas kendaraan, nama Bluetooth head unit, dan informasi pemilik rental untuk operasional desentralisasi.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => fetchVehicles(searchQuery)}
            className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
            title="Muat Ulang"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-medium text-xs transition-colors shadow-lg shadow-emerald-500/10"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Armada Baru</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-xl flex items-center space-x-3 border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span className="text-xs font-medium">{statusMessage.text}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          placeholder="Cari berdasarkan kode, plat nomor, nama Bluetooth, atau nama rental..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            fetchVehicles(e.target.value);
          }}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
        />
      </div>

      {/* Vehicles Table / Card Grid */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-7 h-7 text-emerald-400 animate-spin" />
            <p className="text-xs text-zinc-500">Memuat data armada...</p>
          </div>
        ) : vehicles.length === 0 ? (
          <div className="py-16 text-center text-zinc-500 text-xs">
            Belum ada kendaraan yang terdaftar atau cocok dengan pencarian.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/40 text-zinc-400 uppercase tracking-wider font-medium text-[10px]">
                  <th className="py-3 px-4">Unit & Plat</th>
                  <th className="py-3 px-4">Model & Baterai</th>
                  <th className="py-3 px-4">Bluetooth Head Unit</th>
                  <th className="py-3 px-4">Mitra Rental</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {vehicles.map((v) => (
                  <tr key={v.id || v.code} className="hover:bg-zinc-800/30 transition-colors">
                    {/* Unit & Plat */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-mono font-bold text-xs">
                          {v.code}
                        </div>
                        <div>
                          <div className="font-semibold text-white tracking-wide">{v.licensePlate}</div>
                          <div className="text-[11px] text-zinc-500">{v.name}</div>
                        </div>
                      </div>
                    </td>

                    {/* Model & Baterai */}
                    <td className="py-3.5 px-4">
                      <div className="text-zinc-200">{v.model}</div>
                      <div className="flex items-center space-x-1.5 text-[11px] text-zinc-400 mt-0.5">
                        <Battery className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{v.batteryCapacityKwh} kWh</span>
                      </div>
                    </td>

                    {/* Bluetooth Name */}
                    <td className="py-3.5 px-4">
                      {v.bluetoothName ? (
                        <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-sky-500/10 border border-sky-500/20 text-sky-300 font-mono text-[11px]">
                          <Bluetooth className="w-3.5 h-3.5 text-sky-400" />
                          <span>{v.bluetoothName}</span>
                        </div>
                      ) : (
                        <span className="text-zinc-500 italic text-[11px]">Belum diatur</span>
                      )}
                    </td>

                    {/* Mitra Rental */}
                    <td className="py-3.5 px-4">
                      <div className="text-zinc-200 font-medium">
                        {v.rentalPartnerName || 'Armada Internal'}
                      </div>
                      {v.rentalPartnerPhone && (
                        <div className="flex items-center space-x-1 text-[11px] text-zinc-500 mt-0.5">
                          <Phone className="w-3 h-3 text-zinc-400" />
                          <span>{v.rentalPartnerPhone}</span>
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                          v.status === 'available'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : v.status === 'in_service'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                        }`}
                      >
                        {v.status === 'available'
                          ? 'Tersedia'
                          : v.status === 'in_service'
                          ? 'Sedang Jalan'
                          : 'Charging / Servis'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleOpenEdit(v)}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Edit</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit / Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute right-4 top-4 text-zinc-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2.5 mb-5">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Car className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">
                  {editingVehicle ? `Edit Kendaraan (${editingVehicle.code})` : 'Daftarkan Kendaraan Baru'}
                </h3>
                <p className="text-[11px] text-zinc-400">
                  Konfigurasikan plat nomor, nama Bluetooth head unit, dan informasi pemilik rental.
                </p>
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">Kode Unit</label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-emerald-500 outline-none"
                    placeholder="EV-03"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">Plat Nomor</label>
                  <input
                    type="text"
                    required
                    value={formLicensePlate}
                    onChange={(e) => setFormLicensePlate(e.target.value.toUpperCase())}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white font-mono uppercase focus:border-emerald-500 outline-none"
                    placeholder="B 2345 BRG"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Nama Tampilan</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                  placeholder="Wuling BinguoEV Premium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">Model / Varian</label>
                  <input
                    type="text"
                    value={formModel}
                    onChange={(e) => setFormModel(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                    placeholder="BinguoEV (31.9 kWh)"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">Kapasitas Baterai (kWh)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formBatteryCapacity}
                    onChange={(e) => setFormBatteryCapacity(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                    placeholder="31.9"
                  />
                </div>
              </div>

              {/* Bluetooth Identifier Setting */}
              <div className="p-3.5 bg-zinc-950/70 border border-sky-500/20 rounded-xl space-y-2">
                <div className="flex items-center space-x-1.5 text-sky-400 text-xs font-semibold">
                  <Bluetooth className="w-4 h-4" />
                  <span>Nama Bluetooth Mobil (Head Unit)</span>
                </div>
                <input
                  type="text"
                  value={formBluetoothName}
                  onChange={(e) => setFormBluetoothName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-sky-200 font-mono focus:border-sky-500 outline-none"
                  placeholder="Contoh: WULING-AIR-01 atau RENTAL-BERKAH"
                />
                <p className="text-[10px] text-zinc-500">
                  Ubah nama ini jika pemilik rental mengganti head unit atau nama Bluetooth di pengaturan audio mobil.
                </p>
              </div>

              {/* Rental Partner Information */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">Nama Pemilik / Rental</label>
                  <input
                    type="text"
                    value={formRentalPartner}
                    onChange={(e) => setFormRentalPartner(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                    placeholder="CV Berkah Mobilindo"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">Nomor WhatsApp Rental</label>
                  <input
                    type="text"
                    value={formRentalPhone}
                    onChange={(e) => setFormRentalPhone(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                    placeholder="0812XXXXXXXX"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Status Operasional</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as any)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                >
                  <option value="available">Tersedia (Ready for Trip)</option>
                  <option value="in_service">Sedang Beroperasi</option>
                  <option value="charging">Sedang Charging / Perawatan</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center space-x-2 px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Simpan Kendaraan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
