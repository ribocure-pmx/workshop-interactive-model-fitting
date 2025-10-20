import React, { useMemo, useState } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Scatter,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

// Synthetic reference data generated from an inhibitory Emax model.
const SYNTH = { E0: 100, Emax: 80, ED50: 0.01, h: 1 };
const DOSES = [0.5, 1, 2, 3];

function emaxPred(d, p) {
  const num = p.Emax * Math.pow(d, p.h);
  const den = Math.pow(p.ED50, p.h) + Math.pow(d, p.h);
  const drop = den > 0 ? num / den : 0;
  return p.E0 - drop;
}

const demoData = DOSES.map((x) => ({ x, y: emaxPred(x, SYNTH) }));

const LOG_OFFSET = 1e-3;

const models = {
  Linear: {
    id: 'Linear',
    params: {
      a: { label: 'Intercept a', min: 0, max: 120, step: 0.5, defaultValue: 100 },
      b: { label: 'Slope b', min: -200, max: 50, step: 0.5, defaultValue: -30 },
    },
    fn: (x, p) => p.a + p.b * x,
    eq: (p) => `y = a + b·x  (a=${fmt(p.a)}, b=${fmt(p.b)})`,
  },
  'Log-linear': {
    id: 'Log-linear',
    params: {
      a: { label: 'Intercept a', min: 0, max: 120, step: 0.5, defaultValue: 100 },
      b: { label: 'Slope b', min: -200, max: 50, step: 0.5, defaultValue: -60 },
    },
    fn: (x, p) => p.a + p.b * Math.log10(x + LOG_OFFSET),
    eq: (p) => `y = a + b·log10(x + ${LOG_OFFSET})  (a=${fmt(p.a)}, b=${fmt(p.b)})`,
  },
  Emax: {
    id: 'Emax',
    params: {
      E0: { label: 'Baseline E0', min: 50, max: 120, step: 0.5, defaultValue: 100 },
      Emax: { label: 'Max drop Emax', min: 0, max: 100, step: 0.5, defaultValue: 60 },
      ED50: { label: 'ED50', min: 0.001, max: 3, step: 0.001, defaultValue: 0.5 },
      h: { label: 'Hill h', min: 0.2, max: 4, step: 0.05, defaultValue: 1.0 },
    },
    fn: (x, p) => {
      const num = p.Emax * Math.pow(x, p.h);
      const den = Math.pow(p.ED50, p.h) + Math.pow(x, p.h);
      const inh = den > 0 ? num / den : 0;
      return p.E0 - inh;
    },
    eq: (p) => `y = E0 − (Emax·x^h)/(ED50^h + x^h)  (E0=${fmt(p.E0)}, Emax=${fmt(p.Emax)}, ED50=${fmt(p.ED50)}, h=${fmt(p.h)})`,
  },
};

function fmt(x, digits = 2) {
  return Number(x).toFixed(digits);
}

function useModelState(modelKey) {
  const cfg = models[modelKey];
  const defaults = Object.fromEntries(
    Object.entries(cfg.params).map(([k, v]) => [k, v.defaultValue]),
  );
  const [state, setState] = useState(defaults);
  const update = (k, val) => setState((s) => ({ ...s, [k]: val }));
  const reset = () => setState(defaults);
  return { params: state, update, reset, cfg };
}

function rss(obs, pred) {
  return obs.reduce((acc, y, i) => acc + Math.pow(y - (pred[i] ?? 0), 2), 0);
}

function clampResponse(y) {
  return Math.max(0, Math.min(120, y));
}

export default function App() {
  const [modelKey, setModelKey] = useState('Emax');
  const { params, update, reset, cfg } = useModelState(modelKey);

  const curve = useMemo(() => {
    const xs = Array.from({ length: 321 }, (_, i) => i * 0.01);
    return xs.map((x) => ({ x, y: clampResponse(models[modelKey].fn(x, params)) }));
  }, [params, modelKey]);

  const preds = useMemo(
    () => demoData.map((d) => models[modelKey].fn(d.x, params)),
    [params, modelKey],
  );
  const rssVal = useMemo(
    () => rss(demoData.map((d) => d.y), preds),
    [preds],
  );

  return (
    <div className="min-h-screen w-full bg-white text-gray-900">
      <div className="max-w-6xl mx-auto p-6">
        <header className="mb-4 flex items-center justify-between">
             <h1 className="text-2xl font-semibold">Interactive Dose–Response Fitting</h1>
          <div className="text-sm text-gray-600">Knockdown @ D15 vs dose (mg/kg)</div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div
            key={modelKey}
            className="md:col-span-1 bg-gray-50 rounded-2xl p-4 shadow-sm border border-gray-200"
          >
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1" htmlFor="model-select">
                Model
              </label>
              <select
                id="model-select"
                className="w-full rounded-xl border-gray-300 focus:ring-2 focus:ring-indigo-500 p-2"
                value={modelKey}
                onChange={(e) => setModelKey(e.target.value)}
              >
                {Object.keys(models).map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-3 text-sm bg-white border border-gray-200 rounded-xl p-3">
              <div className="font-medium mb-1">Equation</div>
              <div className="font-mono text-xs leading-5">{models[modelKey].eq(params)}</div>
            </div>

            <div className="space-y-4">
              {Object.entries(cfg.params).map(([k, meta]) => (
                <SliderRow
                  key={k}
                  label={meta.label}
                  min={meta.min}
                  max={meta.max}
                  step={meta.step}
                  value={params[k]}
                  onChange={(v) => update(k, v)}
                />
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button
                className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300"
                onClick={reset}
                title="Reset parameters to defaults"
                type="button"
              >
                Reset
              </button>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wide text-gray-500">Fit criterion</div>
                <div className="text-base font-semibold">RSS = {fmt(rssVal, 1)}</div>
              </div>
            </div>

            <details className="mt-3 text-sm text-gray-600">
              <summary className="cursor-pointer select-none">Notes</summary>
              <ul className="list-disc ml-5 mt-2 space-y-1">
                <li>Data points are % remaining (100% at dose 0).</li>
                <li>Log-linear uses a fixed offset of {LOG_OFFSET} for numerical stability.</li>
                <li>RSS is Σ (y<sub>i</sub> − ŷ<sub>i</sub>)² at the observed doses.</li>
              </ul>
            </details>
          </div>

          <div className="md:col-span-2 bg-white rounded-2xl p-4 shadow-sm border border-gray-200">
            <div className="h-[420px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={curve} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="x"
                    type="number"
                    domain={[0, 3.2]}
                    label={{ value: 'Dose (mg/kg)', position: 'insideBottomRight', offset: -5 }}
                  />
                  <YAxis
                    dataKey="y"
                    domain={[0, 120]}
                    ticks={[0, 20, 40, 60, 80, 100, 120]}
                    label={{ value: '% remaining', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip formatter={(val, name) => [fmt(val), name]} />
                  <Legend verticalAlign="top" height={36} />
                  <Scatter name="Data" data={demoData} fill="#111827" shape="circle" r={5} isAnimationActive={false} />
                  <Line name={`${modelKey} model`} type="monotone" dataKey="y" dot={false} strokeWidth={3} />
                  <ReferenceLine y={100} stroke="#9CA3AF" strokeDasharray="4 4" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 text-xs text-gray-500">
              Data: synthetic Emax at doses 0.5, 1, 2, 3 mg/kg; y is % remaining. Move sliders to see RSS update.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SliderRow({ label, min, max, step, value, onChange }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm tabular-nums font-semibold">{fmt(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-indigo-600"
      />
      <div className="flex justify-between text-xs text-gray-500">
        <span>{fmt(min)}</span>
        <span>{fmt(max)}</span>
      </div>
    </div>
  );
}
