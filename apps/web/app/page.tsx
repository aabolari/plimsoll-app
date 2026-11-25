"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AssetCard } from "@/components/AssetCard";
import { Skeleton, nowSecs } from "@/components/ui";
import { config } from "@/lib/config";
import { loadAssets, type AssetView } from "@/lib/data";
import { Tier, tierLabel } from "@plimsoll/sdk";

const TIER_FILTERS: { value: string | null; label: string }[] = [
  { value: null, label: "All" },
  {
    value: String(Tier.Transcribed),
    label: `Tier 1 · ${tierLabel(Tier.Transcribed)}`,
  },
  {
    value: String(Tier.IssuerSigned),
    label: `Tier 2 · ${tierLabel(Tier.IssuerSigned)}`,
  },
  {
    value: String(Tier.AuditorSigned),
    label: `Tier 3 · ${tierLabel(Tier.AuditorSigned)}`,
  },
];

function TierFilter({
  tier,
  setTier,
}: {
  tier: string | null;
  setTier: (next: string | null) => void;
}) {
  const active = tier !== null;
  return (
    <div className="row mt" role="group" aria-label="Filter assets by coverage tier">
      <span className="sub">Filter by tier:</span>
      {TIER_FILTERS.map((f) => (
        <button
          key={f.label}
          type="button"
          onClick={() => setTier(f.value)}
          aria-pressed={tier === f.value ? true : undefined}
          aria-current={tier === f.value ? "true" : undefined}
          className={`pill ${tier === f.value ? "pill-covered" : ""}`}
        >
          {f.label}
        </button>
      ))}
      {active && (
        <button
          type="button"
          onClick={() => setTier(null)}
          className="button secondary"
        >
          Clear filter
        </button>
      )}
    </div>
  );
}

function HomeContent() {
  const [assets, setAssets] = useState<AssetView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(nowSecs());

  const searchParams = useSearchParams();
  const router = useRouter();
  const tier = searchParams.get("tier");

  const setTier = useCallback(
    (next: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next) params.set("tier", next);
      else params.delete("tier");
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [searchParams, router],
  );

  useEffect(() => {
    let cancelled = false;
    loadAssets()
      .then((list) => {
        if (!cancelled) {
          setAssets(list);
          setNow(nowSecs());
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!assets) return null;
    if (!tier) return assets;
    const t = Number(tier);
    return assets.filter((a) => a.coverage?.tier === t);
  }, [assets, tier]);

  const source = assets?.[0]?.source;

  return (
    <>
      <section className="hero">
        <div className="eyebrow">Reserve coverage for Stellar-issued assets</div>
        <h1>Is it backed? Check before you take it.</h1>
        <p>
          Plimsoll puts each asset&apos;s circulating supply and its latest signed reserve report
          side by side on-chain. You see the ratio, who signed it and how old it is. Any Soroban
          contract can refuse an asset that falls below the line.
        </p>
      </section>

      <div className="spread mt">
        <h2 style={{ margin: 0 }}>Listed assets</h2>
        <span className="sub">
          {source === "indexer"
            ? "Read from the Plimsoll indexer"
            : source === "chain"
              ? `Read directly from the coverage ledger on ${config.networkName}`
              : null}
        </span>
      </div>

      <TierFilter tier={tier} setTier={setTier} />

      {error ? (
        <p className="notice notice-bad mt" role="alert">
          Could not load assets: {error}
        </p>
      ) : null}

      <div className="grid mt" aria-busy={assets === null}>
        {assets === null && !error
          ? [0, 1].map((i) => (
              <div className="card" key={i} style={{ display: "grid", gap: 12 }}>
                <Skeleton height={26} width="40%" />
                <Skeleton height={36} width="55%" />
                <Skeleton height={14} />
                <Skeleton height={14} width="70%" />
              </div>
            ))
          : filtered?.map((a) => <AssetCard key={a.sac} asset={a} now={now} />)}
      </div>

      {assets && filtered!.length === 0 ? (
        tier ? (
          <p className="notice notice-info mt">
            No assets match this filter.{" "}
            <button
              type="button"
              onClick={() => setTier(null)}
              className="button secondary"
            >
              Clear filter
            </button>
          </p>
        ) : (
          <p className="notice notice-info mt">
            No assets listed yet. <Link href="/list/">List the first one</Link>.
          </p>
        )
      ) : null}

      <h2>How a reading is made</h2>
      <ol className="steps">
        <li className="card">
          <h3>Supply from the ledger</h3>
          <p className="sub">
            The indexer sums every holding of the asset: trustlines, claimable balances, liquidity
            pools and contract balances. It posts the total on-chain with a hash of the breakdown.
          </p>
        </li>
        <li className="card">
          <h3>Reserves from a signer</h3>
          <p className="sub">
            The issuer&apos;s own account, a registered auditor, or a registered transcriber posts
            the reserve figure with a hash of the source document. The signer decides the tier.
          </p>
        </li>
        <li className="card">
          <h3>One call to check</h3>
          <p className="sub">
            <code>is_covered(asset, min_bps, max_age, min_tier)</code> answers yes or no for any
            contract. <Link href="/integrate/">See the integration guide</Link>.
          </p>
        </li>
      </ol>
    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<Skeleton height={40} width="40%" />}>
      <HomeContent />
    </Suspense>
  );
}
