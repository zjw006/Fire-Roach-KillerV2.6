/**
 * @fileoverview 特效工作台颜色字段组件
 * @description 统一的粒子颜色编辑器：色板（点击打开取色器）+ hex 显示 + 透明度滑杆。
 *              色板底层垫棋盘格以直观表现透明度；原生 color input 透明覆盖在色板上。
 */

import { rgbaToHex, type Rgba } from './effectLabUtils';

interface ColorFieldProps {
  /** 中文字段名 */
  label: string;
  /** 原始键名或格式提示（HSL/RGBA/键名） */
  sub?: string;
  /** 当前代表色 */
  value: Rgba;
  /** 是否显示透明度滑杆 */
  hasAlpha: boolean;
  /** 用户选定新颜色（原生取色器不含 alpha，由组件保留当前 a） */
  onPick: (c: Rgba) => void;
}

export function ColorField({ label, sub, value, hasAlpha, onPick }: ColorFieldProps) {
  const hex = rgbaToHex(value.r, value.g, value.b);

  const pickHex = (h: string) => {
    onPick({
      r: parseInt(h.slice(1, 3), 16),
      g: parseInt(h.slice(3, 5), 16),
      b: parseInt(h.slice(5, 7), 16),
      a: value.a,
    });
  };

  return (
    <div className="rounded-md border border-zinc-800/70 bg-zinc-950/40 px-2 py-2">
      <div className="flex items-center gap-2">
        {/* 色板：棋盘格底 + 实色层 + 透明 color input */}
        <label
          className="relative h-7 w-11 shrink-0 cursor-pointer overflow-hidden rounded border border-zinc-700 transition-colors hover:border-orange-600/60"
          style={{
            background: 'repeating-conic-gradient(#52525b 0% 25%, #27272a 0% 50%) 0 0 / 10px 10px',
          }}
          title="点击打开取色器"
        >
          <span
            className="absolute inset-0"
            style={{ backgroundColor: `rgba(${value.r}, ${value.g}, ${value.b}, ${value.a})` }}
          />
          <input
            type="color"
            value={hex}
            onChange={(e) => pickHex(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-zinc-300">
            {label}
            {sub && <span className="ml-1 font-mono text-[10px] text-zinc-600">{sub}</span>}
          </div>
          <div className="font-mono text-[10px] text-orange-200/80">
            {hex}
            {hasAlpha ? ` · α ${value.a.toFixed(2)}` : ''}
          </div>
        </div>
      </div>
      {hasAlpha && (
        <div className="mt-1.5 flex items-center gap-2">
          <span className="w-8 shrink-0 text-[10px] text-zinc-500">透明度</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={value.a}
            onChange={(e) => onPick({ ...value, a: Number(e.target.value) })}
            className="h-1 flex-1 cursor-pointer accent-orange-500"
          />
        </div>
      )}
    </div>
  );
}
