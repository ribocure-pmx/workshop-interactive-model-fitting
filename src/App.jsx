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
const SYNTH = { E0: 100, Emax: 80, ED50: 1, h: 1 };
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
      b: { label: 'Slope b', min: -200, max: 50, step: 0.5, defaultValue: -20 },
    },
    fn: (x, p) => 100 + p.b * x,
    eq: (p) => `y = 100 + b·x  (b=${fmt(p.b)})`,
  },
  'Log-linear': {
    id: 'Log-linear',
    params: {
      b: { label: 'Slope b', min: -200, max: 50, step: 0.5, defaultValue: -50 },
    },
    fn: (x, p) => 100 + p.b * (Math.log10(x + LOG_OFFSET) - Math.log10(LOG_OFFSET)),
    eq: (p) => `y = a + b·log10(x + ε)  (a=${fmt(100 - p.b * Math.log10(LOG_OFFSET))}, b=${fmt(p.b)})`,
  },
  Emax: {
    id: 'Emax',
    params: {
      Emax: { label: 'Emax', min: 0, max: 100, step: 0.5, defaultValue: 70 },
      ED50: { label: 'ED50', min: 0.001, max: 3, step: 0.001, defaultValue: 1.5 },
      h: { label: 'Hill h', min: 0.2, max: 4, step: 0.05, defaultValue: 1.5 },
    },
    fn: (x, p) => {
      const num = p.Emax * Math.pow(x, p.h);
      const den = Math.pow(p.ED50, p.h) + Math.pow(x, p.h);
      const inh = den > 0 ? num / den : 0;
      return 100 - inh;
    },
    eq: (p) => `y = 100 − (Emax·x^h)/(ED50^h + x^h)  (Emax=${fmt(p.Emax)}, ED50=${fmt(p.ED50)}, h=${fmt(p.h)})`,
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
  const [stateByModel, setStateByModel] = useState(() => {
    const initial = {};
    Object.keys(models).forEach(key => {
      initial[key] = Object.fromEntries(
        Object.entries(models[key].params).map(([k, v]) => [k, v.defaultValue])
      );
    });
    return initial;
  });
  
  const params = stateByModel[modelKey];
  const update = (k, val) => setStateByModel((s) => ({ 
    ...s, 
    [modelKey]: { ...s[modelKey], [k]: val } 
  }));
  const reset = () => setStateByModel((s) => ({ 
    ...s, 
    [modelKey]: defaults 
  }));
  
  return { params, update, reset, cfg };
}

function rss(obs, pred) {
  return obs.reduce((acc, y, i) => acc + Math.pow(y - (pred[i] ?? 0), 2), 0);
}

function clampResponse(y) {
  return Math.max(0, Math.min(120, y));
}

export default function App() {
  const [modelKey, setModelKey] = useState('Linear');
  const { params, update, reset, cfg } = useModelState(modelKey);

  const curve = useMemo(() => {
    const xs = Array.from({ length: 501 }, (_, i) => i * 0.01);
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

            <div className="mt-6 flex items-center justify-end">
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
                <ComposedChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }} syncId="doseResponse">
                  <defs>
                    <clipPath id="curve-clip">
                      <rect x="0" y="0" width="100%" height="100%" />
                    </clipPath>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="x"
                    type="number"
                    domain={[0, 5]}
                    ticks={[0, 1, 2, 3, 4, 5]}
                    label={{ value: 'Dose (mg/kg)', position: 'insideBottomRight', offset: -5 }}
                  />
                  <YAxis
                    dataKey="y"
                    domain={[0, 120]}
                    ticks={[0, 20, 40, 60, 80, 100, 120]}
                    label={{ value: 'Knockdown D15 (%)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip formatter={(val, name) => [fmt(val), name]} />
                  <Legend verticalAlign="top" height={36} />
                  <Line name={`${modelKey} model`} data={curve} type="monotone" dataKey="y" stroke="#8884d8" dot={false} strokeWidth={3} isAnimationActive={false} />
                  <Scatter name="Data" data={demoData} fill="#111827" shape="circle" r={5} isAnimationActive={false} />
                  <ReferenceLine y={100} stroke="#9CA3AF" strokeDasharray="4 4" />
                </ComposedChart>
              </ResponsiveContainer>
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
