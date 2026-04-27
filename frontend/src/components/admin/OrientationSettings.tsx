'use client';

export function OrientationSettings({ event, updateSettings }: any) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-white font-semibold mb-3">Display Orientation</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {[
            { key: 'auto', label: 'Auto Detect', desc: 'Responsive to device orientation' },
            { key: 'landscape', label: 'Landscape Only', desc: 'Force horizontal layout' },
            { key: 'portrait', label: 'Portrait Only', desc: 'Force vertical layout' },
          ].map(opt => (
            <button key={opt.key}
              onClick={() => updateSettings('displayOrientation', opt.key)}
              className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all ${
                ((event.settings?.displayOrientation as string) || 'auto') === opt.key
                  ? 'border-violet-500 bg-violet-500/10'
                  : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-600'
              }`}>
              <span className="font-semibold text-sm text-white">{opt.label}</span>
              <span className="text-xs text-zinc-500 mt-1">{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-zinc-800 pt-5">
        <h3 className="text-white font-semibold mb-3">Preview Layout</h3>
        <div className="space-y-3">
          <div>
            <label className="flex items-center justify-between py-2">
              <span className="text-sm text-zinc-200">Preview window height</span>
              <span className="text-violet-300 font-bold">{(event.settings?.previewHeightPercent as number) || 60}%</span>
            </label>
            <input type="range" min="40" max="80" step="5"
              value={(event.settings?.previewHeightPercent as number) || 60}
              onChange={e => updateSettings('previewHeightPercent', Number(e.target.value))}
              className="w-full accent-violet-500" />
            <p className="text-zinc-500 text-xs mt-1">On vertical screens, larger = better preview visibility</p>
          </div>

          <div>
            <label className="flex items-center justify-between py-2">
              <span className="text-sm text-zinc-200">Controls height</span>
              <span className="text-violet-300 font-bold">{100 - ((event.settings?.previewHeightPercent as number) || 60)}%</span>
            </label>
            <p className="text-zinc-500 text-xs">Remaining space for buttons and countdown</p>
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-800 pt-5">
        <h3 className="text-white font-semibold mb-3">Mobile Optimizations</h3>
        <div className="space-y-3">
          <label className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 cursor-pointer hover:border-zinc-600 transition-colors">
            <div>
              <p className="text-sm font-medium text-white">Full-screen on Mobile</p>
              <p className="text-xs text-zinc-500 mt-0.5">Remove browser UI for immersive experience</p>
            </div>
            <input type="checkbox" checked={(event.settings?.fullscreenMobile as boolean) ?? true}
              onChange={e => updateSettings('fullscreenMobile', e.target.checked)}
              className="w-4 h-4" />
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 cursor-pointer hover:border-zinc-600 transition-colors">
            <div>
              <p className="text-sm font-medium text-white">Lock Rotation</p>
              <p className="text-xs text-zinc-500 mt-0.5">Prevent accidental device rotation during capture</p>
            </div>
            <input type="checkbox" checked={(event.settings?.lockRotation as boolean) ?? false}
              onChange={e => updateSettings('lockRotation', e.target.checked)}
              className="w-4 h-4" />
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 cursor-pointer hover:border-zinc-600 transition-colors">
            <div>
              <p className="text-sm font-medium text-white">Adjust for Notch/Safe Area</p>
              <p className="text-xs text-zinc-500 mt-0.5">Add padding for notched displays (iPhone X, etc.)</p>
            </div>
            <input type="checkbox" checked={(event.settings?.adjustSafeArea as boolean) ?? true}
              onChange={e => updateSettings('adjustSafeArea', e.target.checked)}
              className="w-4 h-4" />
          </label>
        </div>
      </div>
    </div>
  );
}
