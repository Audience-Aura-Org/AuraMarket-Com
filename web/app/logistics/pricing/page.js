"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import {
  CheckCircle as CheckIcon,
  MapPin as MapPinIcon,
  Search as SearchIcon,
  Plus,
  Trash2,
  Save as SaveIcon,
  Loader2,
  RefreshCw,
  LineChart,
  LayoutDashboard,
  List,
  MapPin,
} from "lucide-react";
import { useAuthStore } from "@/hooks/useAuth";
import api from "@/services/api";
import { toast } from "react-hot-toast";
import Pagination from "@/components/common/Pagination";
import StatCard from "@/components/layout/StatCard";
import {
  LogisticsSubpageHeader,
  LogisticsShortcutsRow,
} from "@/components/logistics/LogisticsSubpageShell";

export default function LogisticsPricingPage() {
  const { user } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [zones, setZones] = useState([]);
  const [balance, setBalance] = useState(0);
  const [profile, setProfile] = useState({
    quartier_prices: [],
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedQuartiers, setSelectedQuartiers] = useState([]);
  const [newPrice, setNewPrice] = useState("");
  const [tableSelections, setTableSelections] = useState([]);
  const [bulkUpdatePrice, setBulkUpdatePrice] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    setMounted(true);
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [zonesRes, profileRes, walletRes] = await Promise.all([
        api.get("/logistics/zones"),
        api.get("/logistics/profile"),
        api.get("/wallet"),
      ]);

      if (zonesRes.data.success) setZones(zonesRes.data.data.zones);
      if (profileRes.data.success) {
        setProfile({
          quartier_prices: profileRes.data.data.firm.quartier_prices || [],
        });
      }
      if (walletRes.data.success) {
        setBalance(walletRes.data.data?.balance ?? 0);
      }
    } catch (err) {
      toast.error("Failed to sync pricing matrix.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddQuartier = () => {
    if (selectedQuartiers.length === 0 || !newPrice)
      return toast.error("Select at least one zone and set a price.");
    const newEntries = selectedQuartiers
      .filter(
        (q) => !profile.quartier_prices.some((existing) => existing.quartier === q)
      )
      .map((q) => ({ quartier: q, price: Number(newPrice) }));
    if (newEntries.length === 0)
      return toast.error("All selected zones already have a rate.");
    setProfile({
      ...profile,
      quartier_prices: [...profile.quartier_prices, ...newEntries],
    });
    setSelectedQuartiers([]);
    setNewPrice("");
  };

  const handleRemoveQuartierByName = (quartierName) => {
    const updated = profile.quartier_prices.filter((q) => q.quartier !== quartierName);
    setProfile({ ...profile, quartier_prices: updated });
    setTableSelections((prev) => prev.filter((n) => n !== quartierName));
  };

  const handleUpdateInlinePrice = (name, price) => {
    setProfile({
      ...profile,
      quartier_prices: profile.quartier_prices.map((q) =>
        q.quartier === name ? { ...q, price: Number(price) } : q
      ),
    });
  };

  const handleBulkDelete = () => {
    setProfile({
      ...profile,
      quartier_prices: profile.quartier_prices.filter(
        (q) => !tableSelections.includes(q.quartier)
      ),
    });
    setTableSelections([]);
    toast.success("Batch removal complete.");
  };

  const handleBulkUpdatePrice = () => {
    if (!bulkUpdatePrice) return toast.error("Set a target fee.");
    setProfile({
      ...profile,
      quartier_prices: profile.quartier_prices.map((q) =>
        tableSelections.includes(q.quartier)
          ? { ...q, price: Number(bulkUpdatePrice) }
          : q
      ),
    });
    setTableSelections([]);
    setBulkUpdatePrice("");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch("/logistics/pricing", {
        quartier_prices: profile.quartier_prices,
      });
      toast.success("Pricing matrix synchronized.");
    } catch (err) {
      toast.error("Protocol failure.");
    } finally {
      setSaving(false);
    }
  };

  const filtered = profile.quartier_prices.filter((q) =>
    q.quartier.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const currentPrices = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const regionCount = zones.filter((z) => z.type === "region").length;
  const quartierNetworkCount = zones.filter((z) => z.type === "quartier").length;
  const avgPrice =
    profile.quartier_prices.length > 0
      ? Math.round(
          profile.quartier_prices.reduce((a, q) => a + (Number(q.price) || 0), 0) /
            profile.quartier_prices.length
        )
      : 0;

  if (!mounted) return null;
  if (!user || user.role !== "logistics") return null;

  return (
    <div className="flex w-full min-w-0 flex-col bg-[var(--bg-primary)] pb-[max(7rem,env(safe-area-inset-bottom,1.25rem))] text-[var(--text-primary)] lg:pb-16">
      <LogisticsSubpageHeader
        Icon={LineChart}
        title="Route"
        accentTitle="pricing"
        tag="Last-mile matrix"
        hint="Set quartier fees customers see at checkout. Save to sync with the Aura network."
        actions={
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              fetchData();
            }}
            className="flex size-11 min-h-[2.75rem] min-w-[2.75rem] touch-manipulation items-center justify-center rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] transition hover:bg-white/5"
            aria-label="Refresh"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        }
      />

      <div className="mx-auto w-full min-w-0 max-w-[1600px] space-y-6 px-3 py-5 sm:space-y-8 sm:px-5 sm:py-6 md:px-8 md:py-8">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <StatCard
            label="Wallet"
            value={`${balance.toLocaleString()} XAF`}
            sub="Settlement balance"
            icon="account_balance_wallet"
            color="purple"
            href="/wallet"
          />
          <StatCard
            label="Priced routes"
            value={String(profile.quartier_prices.length)}
            sub="Active quartiers"
            icon="route"
            color="indigo"
          />
          <StatCard
            label="Coverage map"
            value={String(quartierNetworkCount)}
            sub="Network quartiers"
            icon="map"
            color="amber"
          />
          <StatCard
            label="Avg. fee"
            value={avgPrice ? `${avgPrice.toLocaleString()} XAF` : "—"}
            sub="Across priced zones"
            icon="payments"
            color="emerald"
          />
        </div>

        <LogisticsShortcutsRow
          links={[
            {
              label: "Dashboard",
              sub: "Ops overview",
              href: "/logistics/dashboard",
              icon: LayoutDashboard,
            },
            {
              label: "Manifests",
              sub: "Shipments",
              href: "/logistics/manifests",
              icon: List,
            },
            {
              label: "Live tracking",
              sub: "Status stream",
              href: "/logistics/tracking",
              icon: MapPin,
            },
          ]}
        />

        <section className="space-y-4 lg:space-y-6">
          <div className="flex items-center gap-3 lg:gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-purple-500/20 bg-purple-500/10 text-purple-600 shadow-sm lg:size-12 lg:rounded-2xl">
              <MapPinIcon className="size-5 lg:size-6" />
            </div>
            <h2 className="text-lg font-bold tracking-tight lg:text-2xl">
              Last-mile rates
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-10">
            <div className="space-y-6 lg:col-span-4">
              <div className="glass-panel space-y-6 rounded-[32px] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 p-6 lg:rounded-[40px] lg:p-8">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)] opacity-45">
                  Regions in catalog: {regionCount}
                </p>
                <div className="space-y-2">
                  <label className="ml-1 text-[10px] font-semibold tracking-tight text-[var(--text-secondary)] opacity-50">
                    Operation region
                  </label>
                  <select
                    value={selectedDistrict}
                    onChange={(e) => {
                      setSelectedDistrict(e.target.value);
                      setSelectedQuartiers([]);
                    }}
                    className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-4 py-3.5 text-xs font-semibold outline-none transition-all lg:rounded-2xl lg:px-6 lg:py-4"
                  >
                    <option value="">Select district…</option>
                    {zones
                      .filter((z) => z.type === "region")
                      .map((z) => (
                        <option key={z._id} value={z._id}>
                          {z.name}
                        </option>
                      ))}
                  </select>
                </div>

                {selectedDistrict && (
                  <div className="animate-in space-y-4 fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center justify-between px-1">
                      <label className="text-[10px] font-semibold tracking-tight text-[var(--text-secondary)] opacity-40">
                        Target zones
                      </label>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedQuartiers(
                              zones
                                .filter(
                                  (z) =>
                                    z.type === "quartier" &&
                                    z.parent_id?._id === selectedDistrict
                                )
                                .map((z) => z.name)
                            )
                          }
                          className="text-[10px] font-semibold tracking-tight text-[var(--accent)] transition-opacity hover:opacity-100"
                        >
                          Select all
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedQuartiers([])}
                          className="text-[10px] font-semibold tracking-tight text-rose-500 transition-opacity hover:opacity-100"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    <div className="no-scrollbar max-h-[160px] space-y-2 overflow-y-auto border-y border-[var(--glass-border)] py-2 pr-2 lg:max-h-[200px]">
                      {zones
                        .filter(
                          (z) =>
                            z.type === "quartier" &&
                            z.parent_id?._id === selectedDistrict
                        )
                        .map((z) => (
                          <div
                            key={z._id}
                            role="button"
                            tabIndex={0}
                            onClick={() =>
                              setSelectedQuartiers((prev) =>
                                prev.includes(z.name)
                                  ? prev.filter((n) => n !== z.name)
                                  : [...prev, z.name]
                              )
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setSelectedQuartiers((prev) =>
                                  prev.includes(z.name)
                                    ? prev.filter((n) => n !== z.name)
                                    : [...prev, z.name]
                                );
                              }
                            }}
                            className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 transition-all lg:rounded-2xl lg:p-4 ${
                              selectedQuartiers.includes(z.name)
                                ? "border-[var(--accent)]/40 bg-[var(--accent)]/10"
                                : "border-transparent hover:bg-[var(--bg-primary)]/40"
                            }`}
                          >
                            <span className="text-[10px] font-semibold tracking-tight lg:text-xs">
                              {z.name}
                            </span>
                            {selectedQuartiers.includes(z.name) && (
                              <CheckIcon className="size-3 text-[var(--accent)]" />
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="ml-1 text-[10px] font-semibold tracking-tight text-[var(--text-secondary)] opacity-50">
                    Base fee
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] py-3.5 pl-6 pr-16 text-xs font-semibold outline-none transition-all lg:rounded-2xl lg:py-4"
                    />
                    <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-semibold tracking-tight opacity-30">
                      XAF
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddQuartier}
                  className="w-full rounded-xl bg-[var(--text-primary)] py-4 font-semibold tracking-[0.2em] text-[var(--bg-primary)] shadow-2xl transition-all hover:-translate-y-0.5 hover:bg-[var(--accent)] hover:text-white lg:rounded-2xl lg:py-5 lg:text-xs"
                >
                  Add routes <Plus className="ml-2 inline size-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-4 lg:col-span-8 lg:gap-6">
              <div className="glass-panel relative flex min-h-[min(420px,65vh)] flex-col overflow-hidden rounded-[28px] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 shadow-2xl sm:min-h-[480px] lg:min-h-[500px] lg:rounded-[40px]">
                <div className="flex flex-col gap-4 border-b border-[var(--glass-border)] p-5 md:flex-row md:items-center md:justify-between lg:p-8">
                  <div className="flex flex-1 items-center gap-4">
                    <SearchIcon className="size-4 opacity-20" />
                    <input
                      placeholder="Search zone network…"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full border-none bg-transparent !text-base placeholder:!text-base font-semibold tracking-tight outline-none"
                    />
                  </div>
                  <p className="text-[10px] font-semibold tracking-[0.2em] opacity-40">
                    {profile.quartier_prices.length} active
                  </p>
                </div>
                {tableSelections.length > 0 && (
                  <div className="animate-in flex flex-col gap-4 border-b border-[var(--glass-border)] bg-[var(--accent)]/10 p-3 duration-500 slide-in-from-top-4 md:flex-row md:items-center md:justify-between lg:p-5">
                    <div className="flex flex-1 flex-wrap items-center gap-4">
                      <label className="whitespace-nowrap text-[10px] font-semibold opacity-40">
                        Bulk rate:
                      </label>
                      <input
                        type="number"
                        placeholder="Enter fee…"
                        value={bulkUpdatePrice}
                        onChange={(e) => setBulkUpdatePrice(e.target.value)}
                        className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-4 py-2.5 text-xs font-semibold shadow-inner outline-none md:w-32"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={handleBulkUpdatePrice}
                        className="flex-1 rounded-xl bg-[var(--accent)] px-6 py-2.5 text-[10px] font-semibold text-white shadow-lg transition-all hover:scale-[1.02] md:flex-none"
                      >
                        Apply
                      </button>
                      <button
                        type="button"
                        onClick={handleBulkDelete}
                        className="flex-1 rounded-xl bg-rose-500/10 px-6 py-2.5 text-[10px] font-semibold text-rose-600 transition-all hover:bg-rose-500 hover:text-white md:flex-none"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
                <div className="no-scrollbar flex-1 overflow-x-auto overscroll-x-contain">
                  <table className="min-w-[520px] w-full border-collapse text-left">
                    <thead className="sticky top-0 z-10 bg-[var(--bg-secondary)]/95 backdrop-blur-xl">
                      <tr>
                        <th className="w-10 px-6 py-3 lg:px-8 lg:py-4">
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() =>
                              setTableSelections(
                                tableSelections.length === profile.quartier_prices.length
                                  ? []
                                  : profile.quartier_prices.map((q) => q.quartier)
                              )
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setTableSelections(
                                  tableSelections.length === profile.quartier_prices.length
                                    ? []
                                    : profile.quartier_prices.map((q) => q.quartier)
                                );
                              }
                            }}
                            className={`flex size-4 cursor-pointer items-center justify-center rounded-full border-2 transition-all lg:size-5 ${
                              tableSelections.length === profile.quartier_prices.length &&
                              profile.quartier_prices.length > 0
                                ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                                : "border-slate-300/80 hover:border-[var(--accent)]/50 dark:border-white/20"
                            }`}
                          >
                            {tableSelections.length === profile.quartier_prices.length &&
                              profile.quartier_prices.length > 0 && (
                                <CheckIcon className="size-2.5 lg:size-3" />
                              )}
                          </div>
                        </th>
                        <th className="px-6 py-3 text-[10px] font-semibold tracking-[0.2em] opacity-30 lg:px-8 lg:py-4">
                          Transit zone
                        </th>
                        <th className="px-6 py-3 text-[10px] font-semibold tracking-[0.2em] opacity-30 lg:px-8 lg:py-4">
                          Operational fee
                        </th>
                        <th className="px-6 py-3 text-right lg:px-8 lg:py-4" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--glass-border)]/10">
                      {currentPrices.map((q) => (
                        <tr
                          key={q.quartier}
                          className={`group transition-all hover:bg-[var(--accent)]/5 ${
                            tableSelections.includes(q.quartier) ? "bg-[var(--accent)]/5" : ""
                          }`}
                        >
                          <td className="border-none px-6 py-4 lg:px-8 lg:py-5">
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() =>
                                setTableSelections((prev) =>
                                  prev.includes(q.quartier)
                                    ? prev.filter((n) => n !== q.quartier)
                                    : [...prev, q.quartier]
                                )
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  setTableSelections((prev) =>
                                    prev.includes(q.quartier)
                                      ? prev.filter((n) => n !== q.quartier)
                                      : [...prev, q.quartier]
                                  );
                                }
                              }}
                              className={`flex size-4 cursor-pointer items-center justify-center rounded-full border-2 transition-all lg:size-5 ${
                                tableSelections.includes(q.quartier)
                                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                                  : "border-slate-300/80 group-hover:border-[var(--accent)]/50 dark:border-white/20"
                              }`}
                            >
                              {tableSelections.includes(q.quartier) && (
                                <CheckIcon className="size-2.5 lg:size-3" />
                              )}
                            </div>
                          </td>
                          <td className="border-none px-6 py-4 lg:px-8 lg:py-5">
                            <p className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">
                              {q.quartier}
                            </p>
                          </td>
                          <td className="border-none px-6 py-4 lg:px-8 lg:py-5">
                            <div className="group/input flex items-center gap-2">
                              <input
                                type="number"
                                value={q.price}
                                onChange={(e) =>
                                  handleUpdateInlinePrice(q.quartier, e.target.value)
                                }
                                className="w-20 rounded-lg border border-transparent bg-[var(--bg-secondary)]/30 px-3 py-2 font-mono text-xs font-bold text-indigo-600 outline-none shadow-inner transition-all hover:border-[var(--glass-border)] focus:border-[var(--accent)] lg:w-28 lg:text-sm"
                              />
                              <span className="text-[10px] font-semibold opacity-20">
                                XAF
                              </span>
                            </div>
                          </td>
                          <td className="border-none px-6 py-4 text-right lg:px-8 lg:py-5">
                            <button
                              type="button"
                              onClick={() => handleRemoveQuartierByName(q.quartier)}
                              className="flex size-8 items-center justify-center rounded-xl opacity-0 shadow-sm transition-all hover:bg-rose-500 hover:text-white group-hover:opacity-100 lg:size-10"
                            >
                              <Trash2 className="size-3.5 lg:size-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-auto border-t border-[var(--glass-border)] bg-[var(--bg-secondary)]/10 p-6">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                  />
                </div>
              </div>
              <div className="flex justify-center pt-2 lg:pt-4">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex w-full items-center justify-center gap-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-8 py-4 font-semibold tracking-[0.2em] text-white shadow-2xl transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-40 lg:w-auto lg:rounded-[24px] lg:px-12 lg:py-5 lg:text-xs"
                >
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <SaveIcon className="size-4" />
                  )}
                  Sync matrix with Aura network
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
