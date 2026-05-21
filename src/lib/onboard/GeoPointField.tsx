"use client";

import { useState } from "react";

type GeoValue = {
  lat: number;
  lng: number;
  accuracy: number;
  capturedAt: string;
} | null;

export default function GeoPointField({
  name,
  initial,
  required,
}: {
  name: string;
  initial?: GeoValue;
  required?: boolean;
}) {
  const [value, setValue] = useState<GeoValue>(initial ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const capture = () => {
    if (!("geolocation" in navigator)) {
      setError("Your browser doesn't support location capture.");
      return;
    }
    setBusy(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setValue({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          capturedAt: new Date().toISOString(),
        });
        setBusy(false);
      },
      (err) => {
        setBusy(false);
        if (err.code === err.PERMISSION_DENIED) {
          setError(
            "Permission denied. You can still continue — we'll figure out your area from your pincode.",
          );
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setError("Location unavailable. Try again from a place with better signal.");
        } else if (err.code === err.TIMEOUT) {
          setError("Took too long. Try again?");
        } else {
          setError("Couldn't get your location.");
        }
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const clear = () => {
    setValue(null);
    setError(null);
  };

  return (
    <div className="space-y-2">
      <input
        type="hidden"
        name={name}
        value={value ? JSON.stringify(value) : ""}
        required={required && !value}
      />

      {value ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-5 h-5 text-emerald-700"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.019 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z"
              />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-emerald-900">
              Location captured
            </div>
            <div className="text-xs text-emerald-800 font-mono break-all">
              {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
            </div>
            <div className="text-xs text-emerald-700 mt-0.5">
              Accuracy: ±{Math.round(value.accuracy)}m
            </div>
          </div>
          <button
            type="button"
            onClick={capture}
            disabled={busy}
            className="text-xs text-emerald-900 underline hover:no-underline shrink-0"
          >
            {busy ? "Updating..." : "Recapture"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={capture}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-zinc-900 text-white text-base font-medium hover:bg-zinc-800 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-5 h-5"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.019 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z"
            />
          </svg>
          {busy ? "Getting location..." : "Use my current location"}
        </button>
      )}

      {error && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      {value && (
        <button
          type="button"
          onClick={clear}
          className="text-xs text-zinc-500 hover:text-zinc-900 underline"
        >
          Clear
        </button>
      )}
    </div>
  );
}
