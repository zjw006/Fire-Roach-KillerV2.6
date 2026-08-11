/**
 * @fileoverview 特效工作台参数面板
 * @description 递归遍历配置对象自动生成表单，具备颜色感知能力：
 *              - HSL/RGBA 键族（hue/saturation/lightness 或 r/g/b/a 及其 Min/Max 变体）
 *                自动合并为一个取色器（ColorField），平移写回保持区间宽度；
 *              - 颜色字符串（#hex / rgba() / hsla()）→ 取色器 + 透明度滑杆；
 *              - number → 滑杆+数值输入；其余字符串 → 文本框；嵌套对象 → 可折叠分组。
 *              所有修改原地写入 BALANCE_CONFIG 并触发 onChange。
 */

import { useState } from 'react';
import { ColorField } from './ColorField';
import type { AnyRecord } from './effectLabUtils';
import {
  detectColorKeys,
  guessRange,
  groupLabelFor,
  labelFor,
  parseColorToRgba,
  readHslGroup,
  readRgbaGroup,
  writeColorString,
  writeHslGroup,
  writeRgbaGroup,
} from './effectLabUtils';

export interface ParamSection {
  title: string;
  obj: AnyRecord;
  /** 分组提示（如共享参数警告） */
  hint?: string;
  /** 配置路径（如 'ash' / 'physics.ash'），单特效导出使用 */
  path?: string;
  /** 仅渲染指定字段（顺序与 keys 一致）；省略则渲染全部。写入仍作用于 obj 原对象 */
  keys?: string[];
}

interface ParamPanelProps {
  sections: ParamSection[];
  onChange: () => void;
}

const ALPHA_KEYS = ['a', 'aMin', 'aMax', 'alphaMin', 'alphaMax'];

export function ParamPanel({ sections, onChange }: ParamPanelProps) {
  return (
    <div className="space-y-2">
      {sections.map((sec) => (
        <ModuleSection key={`${sec.path}|${sec.title}`} sec={sec} onChange={onChange} />
      ))}
    </div>
  );
}

/**
 * 参数模块卡片（参考 Unity Particle System 的模块面板）：
 * 头部 = 折叠箭头 + 强调条 + 标题 + 配置路径徽标 + 共享组徽标；内容为自动生成的字段表单。
 */
function ModuleSection({ sec, onChange }: { sec: ParamSection; onChange: () => void }) {
  const [open, setOpen] = useState(true);
  // 仅 physics.* 为多特效共享组；render.xxx 等点号路径是渲染器专属配置，不算共享
  const shared = sec.path?.startsWith('physics.') ?? false;
  return (
    <div className="overflow-hidden rounded-md border border-[#2e2e33] bg-[#1e1e21]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 bg-[#232328] px-2.5 py-1.5 text-left transition-colors hover:bg-[#26262c]"
      >
        <span
          className="font-mono text-[9px] text-zinc-500 transition-transform"
          style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
        >
          ▼
        </span>
        <span className="h-3 w-1 rounded-sm bg-orange-500/70" />
        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-zinc-300">
          {sec.title}
        </span>
        {shared && (
          <span
            className="shrink-0 rounded border border-amber-700/50 bg-amber-950/40 px-1 py-px font-mono text-[8px] leading-3 text-amber-500"
            title="共享配置组：改动会同时影响引用它的其他特效"
          >
            共享
          </span>
        )}
        {sec.path && (
          <span className="shrink-0 font-mono text-[8px] tracking-wider text-zinc-600">
            {sec.path}
          </span>
        )}
      </button>
      {open && (
        <div className="px-2.5 pb-2.5 pt-1.5">
          {sec.hint && (
            <p className="pb-1.5 text-[10px] leading-4 text-amber-500/80">⚠ {sec.hint}</p>
          )}
          <div className="space-y-2">
            <ParamGroup obj={sec.obj} keys={sec.keys} onChange={onChange} />
          </div>
        </div>
      )}
    </div>
  );
}

function ParamGroup({
  obj,
  keys,
  onChange,
}: {
  obj: AnyRecord;
  keys?: string[];
  onChange: () => void;
}) {
  // keys 过滤：仅渲染指定字段（顺序与 keys 一致），写入仍作用于 obj 原对象
  const allowed = keys ? new Set(keys) : null;
  const order = keys ? new Map(keys.map((k, i) => [k, i])) : null;
  // 颜色键族（hue/sat/... 或 r/g/b/...）从普通字段中剥离，合并为一个取色器
  // keys 过滤时仅在可见键范围内检测，避免把被隐藏的颜色键族错误剥离
  const detectSource = allowed
    ? Object.fromEntries(Object.entries(obj).filter(([k]) => allowed.has(k)))
    : obj;
  const color = detectColorKeys(detectSource);
  const colorKeySet = new Set(color?.keys ?? []);
  let entries = Object.entries(obj).filter(([k]) => !colorKeySet.has(k));
  if (allowed) {
    entries = entries
      .filter(([k]) => allowed.has(k))
      .sort((a, b) => (order!.get(a[0]) ?? 0) - (order!.get(b[0]) ?? 0));
  }

  return (
    <>
      {color && (
        <ColorField
          label="颜色"
          sub={color.kind === 'hsl' ? 'HSL' : 'RGBA'}
          value={color.kind === 'hsl' ? readHslGroup(obj) : readRgbaGroup(obj)}
          hasAlpha={color.kind === 'rgba' && color.keys.some((k) => ALPHA_KEYS.includes(k))}
          onPick={(c) => {
            if (color.kind === 'hsl') writeHslGroup(obj, c);
            else writeRgbaGroup(obj, c);
            onChange();
          }}
        />
      )}
      {entries.map(([key, value]) => {
        if (typeof value === 'number') {
          return <NumberField key={key} name={key} obj={obj} onChange={onChange} />;
        }
        if (typeof value === 'string') {
          const parsed = parseColorToRgba(value);
          if (parsed) {
            return (
              <ColorField
                key={key}
                label={labelFor(key)}
                sub={key}
                value={parsed}
                hasAlpha
                onPick={(c) => {
                  obj[key] = writeColorString(value, c);
                  onChange();
                }}
              />
            );
          }
          return <StringField key={key} name={key} obj={obj} onChange={onChange} />;
        }
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
          const sub = value as AnyRecord;
          // 纯颜色组（全部键均为颜色键族）→ 直接渲染取色器，不再包裹折叠层
          const subColor = detectColorKeys(sub);
          const subKeys = Object.keys(sub);
          if (subColor && subColor.keys.length === subKeys.length) {
            return (
              <ColorField
                key={key}
                label={groupLabelFor(key)}
                sub={key}
                value={subColor.kind === 'hsl' ? readHslGroup(sub) : readRgbaGroup(sub)}
                hasAlpha={
                  subColor.kind === 'rgba' && subColor.keys.some((k) => ALPHA_KEYS.includes(k))
                }
                onPick={(c) => {
                  if (subColor.kind === 'hsl') writeHslGroup(sub, c);
                  else writeRgbaGroup(sub, c);
                  onChange();
                }}
              />
            );
          }
          return (
            <details key={key} className="rounded-md border border-zinc-800/70 bg-zinc-950/40">
              <summary className="cursor-pointer select-none px-2 py-1.5 text-[11px] font-medium text-zinc-500 hover:text-zinc-300 transition-colors">
                {groupLabelFor(key)}
                <span className="ml-1.5 font-mono text-zinc-600">{key}</span>
              </summary>
              <div className="px-2 pb-2 pt-1 space-y-2">
                <ParamGroup obj={sub} onChange={onChange} />
              </div>
            </details>
          );
        }
        return null;
      })}
    </>
  );
}

/** 数值字段：滑杆 + 精确数值输入（双写同步，原地修改 obj） */
function NumberField({
  name,
  obj,
  onChange,
}: {
  name: string;
  obj: AnyRecord;
  onChange: () => void;
}) {
  const value = obj[name] as number;
  const range = guessRange(name, value);

  const commit = (v: number) => {
    obj[name] = v;
    onChange();
  };

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-0.5">
        <label className="text-[11px] text-zinc-400 group-hover:text-zinc-300 transition-colors">
          {labelFor(name)}
          <span className="ml-1 font-mono text-zinc-600">{name}</span>
        </label>
        <input
          type="number"
          value={value}
          step={range.step}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (e.target.value.trim() !== '' && Number.isFinite(v)) commit(v);
          }}
          className="w-20 rounded border border-zinc-800 bg-zinc-950 px-1.5 py-0.5 text-right font-mono text-[11px] text-orange-200 outline-none focus:border-orange-600/60"
        />
      </div>
      <input
        type="range"
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        onChange={(e) => commit(Number(e.target.value))}
        className="h-1 w-full cursor-pointer accent-orange-500"
      />
    </div>
  );
}

/** 普通字符串字段（非颜色字符串） */
function StringField({
  name,
  obj,
  onChange,
}: {
  name: string;
  obj: AnyRecord;
  onChange: () => void;
}) {
  const value = obj[name] as string;

  return (
    <div className="flex items-center justify-between gap-2">
      <label className="text-[11px] text-zinc-400">
        {labelFor(name)}
        <span className="ml-1 font-mono text-zinc-600">{name}</span>
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          obj[name] = e.target.value;
          onChange();
        }}
        className="w-44 rounded border border-zinc-800 bg-zinc-950 px-1.5 py-0.5 font-mono text-[11px] text-orange-200 outline-none focus:border-orange-600/60"
      />
    </div>
  );
}
