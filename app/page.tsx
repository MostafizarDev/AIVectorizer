"use client";

import { ChangeEvent, DragEvent, MouseEvent, WheelEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownToLine, CloudUpload, WandSparkles, ZoomIn, ZoomOut, Maximize, Undo2, Redo2, Palette, Layers3, Image as ImageIcon, Shapes, ScanLine, Trash2, Sparkles, LoaderCircle, RotateCcw, ShieldCheck } from "lucide-react";

type Panel = "background" | "palette" | "regions" | "geometry" | "corners";
type View = "compare" | "vector" | "outlines";
const selector = "path,polygon,polyline,rect,circle,ellipse";
const accepted = ["image/png", "image/jpeg", "image/webp"];

function parse(svg: string) {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (doc.querySelector("parsererror") || doc.documentElement.tagName.toLowerCase() !== "svg") throw new Error("Invalid SVG output.");
  return doc;
}
function annotate(svg: string) {
  const doc = parse(svg);
  doc.querySelectorAll(selector).forEach((n, i) => n.setAttribute("data-av-id", String(i + 1)));
  return new XMLSerializer().serializeToString(doc);
}
function editSvg(svg: string, fn: (doc: Document) => void) {
  const doc = parse(svg); fn(doc); return new XMLSerializer().serializeToString(doc);
}
function readShapes(svg: string) {
  if (!svg) return [];
  return Array.from(parse(svg).querySelectorAll(selector)).map((n, i) => ({
    id: n.getAttribute("data-av-id") || String(i + 1),
    tag: n.tagName.toLowerCase(),
    fill: n.getAttribute("fill") || n.closest("[fill]")?.getAttribute("fill") || "#808080"
  }));
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [mode, setMode] = useState("graphic");
  const [colors, setColors] = useState(24);
  const [upscale, setUpscale] = useState(2);
  const [mergeStrength, setMergeStrength] = useState(22);
  const [processInfo, setProcessInfo] = useState("");
  const [detail, setDetail] = useState(88);
  const [speckle, setSpeckle] = useState(2);
  const [corner, setCorner] = useState("medium");
  const [svg, setSvg] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);
  const [view, setView] = useState<View>("compare");
  const [panel, setPanel] = useState<Panel>("palette");
  const [selectedId, setSelectedId] = useState("");
  const [zoom, setZoom] = useState(1);
  const [zoomOrigin, setZoomOrigin] = useState("center center");
  const [bg, setBg] = useState("checker");
  const [cornerStyle, setCornerStyle] = useState("round");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); }, [sourceUrl]);
  const shapes = useMemo(() => { try { return readShapes(svg); } catch { return []; } }, [svg]);
  const palette = useMemo(() => Array.from(new Set(shapes.map(s => s.fill).filter(c => c !== "none"))), [shapes]);
  const selected = shapes.find(s => s.id === selectedId);

  function commit(next: string) {
    if (!next || next === svg) return;
    setHistory(h => [...h.slice(-39), svg]); setFuture([]); setSvg(next);
  }
  function loadFile(next: File) {
    setError(""); setSvg(""); setHistory([]); setFuture([]); setSelectedId("");
    if (!accepted.includes(next.type)) { setError("Choose a PNG, JPG, or WebP image."); return; }
    if (next.size > 20 * 1024 * 1024) { setError("Image exceeds the 20 MB limit."); return; }
    const url = URL.createObjectURL(next);
    setSourceUrl(old => { if (old) URL.revokeObjectURL(old); return url; });
    setFile(next); setView("compare");
  }
  function onInput(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = "";
  }
  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) loadFile(f);
  }
  async function vectorize() {
    if (!file) { inputRef.current?.click(); return; }
    setBusy(true); setError("");
    try {
      const data = new FormData();
      data.append("file", file); data.append("mode", mode); data.append("colors", String(colors));
      data.append("detail", String(detail)); data.append("speckle", String(speckle)); data.append("corner", corner);
      data.append("upscale", String(upscale)); data.append("mergeStrength", String(mergeStrength));
      const response = await fetch("/api/vectorize", { method: "POST", body: data });
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || "Vectorization failed."); }
      const originalSize = response.headers.get("X-AV-Original-Dimensions") || "—";
      const processedSize = response.headers.get("X-AV-Processed-Dimensions") || "—";
      const scaleUsed = response.headers.get("X-AV-Upscale-Factor") || "—";
      const mergedColors = response.headers.get("X-AV-Colors-Merged") || "0";
      setProcessInfo("Source " + originalSize + " → enhanced " + processedSize + " · " + scaleUsed + "× resampling · " + mergedColors + " fill instances merged");
      const next = annotate(await response.text());
      const testUrl = URL.createObjectURL(new Blob([next], { type: "image/svg+xml" }));
      try {
        const image = new Image();
        await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("SVG preview failed to load.")); image.src = testUrl; });
      } finally { URL.revokeObjectURL(testUrl); }
      setSvg(next); setHistory([]); setFuture([]); setView("vector"); setZoom(1); setSelectedId("");
    } catch (e) { setError(e instanceof Error ? e.message : "Vectorization failed."); }
    finally { setBusy(false); }
  }
  function undo() {
    if (!history.length) return;
    setFuture(f => [svg, ...f].slice(0, 40)); setSvg(history[history.length - 1]); setHistory(h => h.slice(0, -1)); setSelectedId("");
  }
  function redo() {
    if (!future.length) return;
    setHistory(h => [...h, svg].slice(-40)); setSvg(future[0]); setFuture(f => f.slice(1)); setSelectedId("");
  }
  function recolor(oldColor: string, newColor: string) {
    commit(editSvg(svg, doc => doc.querySelectorAll(selector).forEach(n => {
      if ((n.getAttribute("fill") || n.closest("[fill]")?.getAttribute("fill")) === oldColor) n.setAttribute("fill", newColor);
    })));
  }
  function recolorSelected(color: string) {
    if (!selectedId) return;
    commit(editSvg(svg, doc => doc.querySelector('[data-av-id="' + selectedId + '"]')?.setAttribute("fill", color)));
  }
  function deleteSelected() {
    if (!selectedId) return;
    commit(editSvg(svg, doc => doc.querySelector('[data-av-id="' + selectedId + '"]')?.remove()));
    setSelectedId("");
  }
  function moveSelected(dx: number, dy: number) {
    if (!selectedId) return;
    commit(editSvg(svg, doc => {
      const n = doc.querySelector('[data-av-id="' + selectedId + '"]');
      if (n) n.setAttribute("transform", (n.getAttribute("transform") || "") + " translate(" + dx + " " + dy + ")");
    }));
  }
  function removeWhite() {
    commit(editSvg(svg, doc => doc.querySelectorAll(selector).forEach(n => {
      const c = (n.getAttribute("fill") || "").toLowerCase().replace(/\s/g, "");
      if (["white", "#fff", "#ffffff", "rgb(255,255,255)"].includes(c)) n.remove();
    })));
    setSelectedId("");
  }
  function setCorners(style: string) {
    setCornerStyle(style);
    commit(editSvg(svg, doc => doc.querySelectorAll(selector).forEach(n => {
      n.setAttribute("stroke-linejoin", style);
      n.setAttribute("stroke-linecap", style === "round" ? "round" : "butt");
    })));
  }
  function download() {
    if (!svg) return;
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url;
    a.download = (file?.name.replace(/\.[^.]+$/, "") || "artwork") + "-vector.svg"; a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function zoomAtPointer(e: WheelEvent<HTMLDivElement>) {
    e.preventDefault();
    const target = e.target as Element;
    const artwork = target.closest?.(".svg-stage, .compare-panes img") as HTMLElement | null;
    if (artwork) {
      const rect = artwork.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
      setZoomOrigin(x + "px " + y + "px");
    } else {
      setZoomOrigin("center center");
    }
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    setZoom(z => Math.max(0.1, Math.min(5, Number((z * factor).toFixed(3)))));
  }
  function fitToScreen() {
    if (!svg || !canvasRef.current) { setZoom(1); return; }
    try {
      const root = parse(svg).documentElement;
      const viewBox = root.getAttribute("viewBox")?.trim().split(/[ ,]+/).map(Number);
      const width = viewBox && viewBox.length === 4 ? viewBox[2] : Number.parseFloat(root.getAttribute("width") || "1000");
      const height = viewBox && viewBox.length === 4 ? viewBox[3] : Number.parseFloat(root.getAttribute("height") || "1000");
      const area = canvasRef.current;
      const fit = Math.min((area.clientWidth - 64) / width, (area.clientHeight - 64) / height);
      setZoom(Math.max(0.1, Math.min(5, Number.isFinite(fit) ? fit : 1)));
    } catch { setZoom(1); }
  }
  function reset() {
    setFile(null); setSvg(""); setHistory([]); setFuture([]); setError(""); setSelectedId(""); setZoom(1); setProcessInfo("");
    setSourceUrl(old => { if (old) URL.revokeObjectURL(old); return ""; });
  }
  function selectShape(e: MouseEvent<HTMLDivElement>) {
    const target = e.target as Element;
    const shape = target.closest?.("[data-av-id]");
    setSelectedId(shape?.getAttribute("data-av-id") || "");
  }
  const renderedSvg = useMemo(() => {
    if (!svg) return "";
    try {
      return editSvg(svg, doc => doc.querySelectorAll(selector).forEach(n => {
        n.setAttribute("stroke-linejoin", cornerStyle);
        if (n.getAttribute("data-av-id") === selectedId) {
          n.setAttribute("stroke", "#27d9ff"); n.setAttribute("stroke-width", "2.5"); n.setAttribute("data-av-selected", "true");
      }}));
    } catch { return svg; }
  }, [svg, selectedId, cornerStyle]);

  const panelButton = (id: Panel, label: string, Icon: typeof Palette) =>
    <button className={"tool-panel-button " + (panel === id ? "active" : "")} onClick={() => setPanel(id)}><Icon size={15}/><span>{label}</span><span className="panel-chevron">›</span></button>;

  return <main className="shell editor-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><WandSparkles size={19}/></div><div>AIVectorizer<small>VECTOR STUDIO</small></div></div>
      <div className="top-actions"><span className="status">● Editor workspace</span><button className="ghost-btn" onClick={() => inputRef.current?.click()}>New image</button></div>
    </header>

    <section className="editor-page">
      <div className="editor-heading"><div><div className="eyebrow">Vector editing workspace</div><h1>Refine result</h1><p>{file ? file.name : "Upload an image to begin."}</p></div>
        <div className="editor-heading-actions"><button className="secondary-btn" onClick={undo} disabled={!history.length}><Undo2 size={14}/> Undo</button><button className="secondary-btn" onClick={redo} disabled={!future.length}><Redo2 size={14}/> Redo</button><button className="primary-btn" onClick={download} disabled={!svg}><ArrowDownToLine size={14}/> Download</button></div>
      </div>

      <div className="editor-toolbar">
        <div className="view-tabs"><button className={view==="compare"?"active":""} onClick={() => setView("compare")} disabled={!file}>Compare</button><button className={view==="vector"?"active":""} onClick={() => setView("vector")} disabled={!svg}>Vector</button><button className={view==="outlines"?"active":""} onClick={() => setView("outlines")} disabled={!svg}>Outlines</button></div>
        <div className="zoom-tools"><button title="Zoom out" onClick={() => setZoom(z => Math.max(.1, +(z-.1).toFixed(2)))} disabled={!svg}><ZoomOut size={17}/></button><span>{Math.round(zoom*100)}%</span><button title="Zoom in" onClick={() => setZoom(z => Math.min(5, +(z+.1).toFixed(2)))} disabled={!svg}><ZoomIn size={17}/></button><button title="Fit to screen" onClick={fitToScreen} disabled={!svg}><Maximize size={16}/></button><button title="Actual size" onClick={() => setZoom(1)} disabled={!svg}>1:1</button></div>
        <div className="toolbar-spacer"/><button className="primary-btn toolbar-vectorize" onClick={vectorize} disabled={busy}>{busy ? <><LoaderCircle size={14}/> Processing…</> : <><Sparkles size={14}/> Vectorize</>}</button><button className="download-toolbar" onClick={download} disabled={!svg}><ArrowDownToLine size={15}/> Download SVG</button>
      </div>

      <div className="editor-layout">
        <aside className="editor-sidebar">
          <div className="sidebar-title">Refine result</div>
          <div className="sidebar-scroll">
            {panelButton("background", "Background", ImageIcon)}
            {panel==="background" && <div className="panel-content"><p>Set the preview background or remove pure white vector shapes.</p><div className="background-options"><button className={bg==="checker"?"selected":""} onClick={() => setBg("checker")}>Transparent</button><button className={bg==="white"?"selected":""} onClick={() => setBg("white")}>White</button><button className={bg==="black"?"selected":""} onClick={() => setBg("black")}>Black</button></div><button className="panel-action" onClick={removeWhite} disabled={!svg}>Remove white shapes</button><small>Only exact white fills are removed. Inspect before export.</small></div>}
            {panelButton("palette", "Palette", Palette)}
            {panel==="palette" && <div className="panel-content"><p>Change every region using a color, or recolor only the selected shape.</p>{palette.length ? palette.map(c => <div className="palette-row" key={c}><i className="swatch" style={{background:c}}/><code>{c}</code><input type="color" aria-label={"Replace "+c} value={/^#[0-9a-f]{6}$/i.test(c)?c:"#808080"} onChange={e => recolor(c,e.target.value)}/></div>) : <small>Palette appears after vectorization.</small>}{selected && <div className="selected-color"><label>Selected shape color</label><input type="color" value={/^#[0-9a-f]{6}$/i.test(selected.fill)?selected.fill:"#808080"} onChange={e => recolorSelected(e.target.value)}/></div>}</div>}
            {panelButton("regions", "Regions", Layers3)}
            {panel==="regions" && <div className="panel-content"><p>{shapes.length} SVG shapes found. Select one to edit.</p><div className="region-list">{shapes.slice(0,300).map((s,i) => <button key={s.id} className={selectedId===s.id?"chosen":""} onClick={() => setSelectedId(s.id)}><i className="swatch tiny" style={{background:s.fill}}/>{s.tag} {i+1}<small>#{s.id}</small></button>)}</div>{shapes.length>300 && <small>Showing first 300 shapes.</small>}</div>}
            {panelButton("geometry", "Geometry", Shapes)}
            {panel==="geometry" && <div className="panel-content"><p>Select a region, then move or delete it.</p><div className="nudge-grid"><span/><button disabled={!selectedId} onClick={() => moveSelected(0,-1)}>↑</button><span/><button disabled={!selectedId} onClick={() => moveSelected(-1,0)}>←</button><button disabled={!selectedId} onClick={() => moveSelected(0,1)}>↓</button><button disabled={!selectedId} onClick={() => moveSelected(1,0)}>→</button></div><button className="panel-action danger" disabled={!selectedId} onClick={deleteSelected}><Trash2 size={13}/> Delete selected shape</button><small>Move uses SVG coordinate units. Use Undo to reverse edits.</small></div>}
            {panelButton("corners", "Corners", ScanLine)}
            {panel==="corners" && <div className="panel-content"><p>Change line joins on the SVG shapes.</p><div className="background-options vertical"><button className={cornerStyle==="round"?"selected":""} onClick={() => setCorners("round")}>Round</button><button className={cornerStyle==="miter"?"selected":""} onClick={() => setCorners("miter")}>Sharp / Miter</button><button className={cornerStyle==="bevel"?"selected":""} onClick={() => setCorners("bevel")}>Bevel</button></div><small>Changes stroke joins only; does not redraw path geometry.</small></div>}
          </div>
          <div className="sidebar-history"><button onClick={undo} disabled={!history.length}><Undo2 size={14}/> Undo</button><button onClick={redo} disabled={!future.length}><Redo2 size={14}/> Redo</button></div>
          <button className="sidebar-download" onClick={download} disabled={!svg}><ArrowDownToLine size={15}/> Download</button>
        </aside>

        <section className="editor-canvas-area">
          {!file ? <div className={"upload-zone editor-upload "+(dragging?"dragging":"")} onDragOver={e => {e.preventDefault();setDragging(true);}} onDragLeave={() => setDragging(false)} onDrop={onDrop}><div className="upload-icon"><CloudUpload size={27}/></div><h3>Drop your image here</h3><p>PNG, JPG or WebP · Up to 20 MB</p><button className="primary-btn" onClick={() => inputRef.current?.click()}>Choose image</button></div> :
            <div ref={canvasRef} className={"editor-canvas "+bg} onClick={selectShape} onWheel={zoomAtPointer}>
              {view==="compare" ? <div className="compare-panes"><div><span className="canvas-label">Original</span><img src={sourceUrl} alt="Original artwork" style={{transform:"scale("+zoom+")",transformOrigin:zoomOrigin}}/></div><div><span className="canvas-label">Vector</span>{svg ? <div className="svg-stage" style={{transform:"scale("+zoom+")",transformOrigin:zoomOrigin}} dangerouslySetInnerHTML={{__html:renderedSvg}}/> : <div className="empty-vector">Vectorize image to see result</div>}</div></div> :
              svg ? <div className={"svg-stage "+(view==="outlines"?"outlines":"")} style={{transform:"scale("+zoom+")"}} dangerouslySetInnerHTML={{__html:renderedSvg}}/> : <div className="empty-vector">Click Vectorize image to create SVG.</div>}
            </div>}
          {busy && <div className="processing-overlay"><LoaderCircle className="spin" size={22}/> Vectorizing artwork…</div>}
          {error && <div className="error editor-error">{error}</div>}
          <div className="canvas-status"><span>{svg ? shapes.length+" shapes" : "No vector yet"}</span><span>{selected ? "Selected "+selected.tag+" #"+selected.id : "Click a vector shape to select it"}</span><span>{Math.round(zoom*100)}%</span></div>
        </section>
      </div>

      {processInfo && <div className="process-info minimal-process-info">{processInfo}</div>}
      <details className="card settings editor-settings minimal-settings"><summary>Advanced settings</summary><div className="settings-heading"><div><h2>Vectorization settings</h2></div><button className="secondary-btn" onClick={reset}><RotateCcw size={13}/> Clear workspace</button></div>
        <div className="settings-grid"><div className="control"><div className="control-top">Mode</div><div className="mode-switch full"><button className={mode==="graphic"?"active":""} onClick={() => setMode("graphic")}>Graphic</button><button className={mode==="photo"?"active":""} onClick={() => setMode("photo")}>Photo</button></div></div>
          <div className="control"><div className="control-top"><label htmlFor="upscale">Enhancement upscale</label><output>{upscale}×</output></div><select id="upscale" value={upscale} onChange={e => setUpscale(Number(e.target.value))}><option value={1}>1× · Original size</option><option value={2}>2× · Recommended</option><option value={3}>3× · Maximum detail</option></select><small className="control-hint">Upscaling improves resampling quality, not lost source detail.</small></div>
          <div className="control"><div className="control-top"><label htmlFor="merge">Color merge strength</label><output>{mergeStrength}</output></div><input id="merge" type="range" min="0" max="80" value={mergeStrength} onChange={e => setMergeStrength(Number(e.target.value))}/><small className="control-hint">Higher values merge more similar SVG fill colors.</small></div>
          <div className="control"><div className="control-top"><label htmlFor="colors">Color count</label><output>{colors}</output></div><input id="colors" type="range" min="2" max="64" value={colors} onChange={e => setColors(Number(e.target.value))}/></div>
          <div className="control"><div className="control-top"><label htmlFor="detail">Detail level</label><output>{detail}%</output></div><input id="detail" type="range" min="0" max="100" value={detail} onChange={e => setDetail(Number(e.target.value))}/></div>
          <div className="control"><div className="control-top"><label htmlFor="speckle">Speckle reduction</label><output>{speckle}</output></div><input id="speckle" type="range" min="0" max="20" value={speckle} onChange={e => setSpeckle(Number(e.target.value))}/></div>
          <div className="control"><div className="control-top"><label htmlFor="corner">Tracing corners</label></div><select id="corner" value={corner} onChange={e => setCorner(e.target.value)}><option value="sharp">Sharp</option><option value="medium">Balanced</option><option value="smooth">Smooth</option></select></div>
          <div className="control settings-run"><button className="primary-btn" onClick={vectorize} disabled={busy}>{busy ? <><LoaderCircle size={14}/> Processing…</> : <><Sparkles size={14}/> Vectorize image</>}</button></div>
        </div>
      </details>
      <div className="editor-footnote"><ShieldCheck size={14}/> Download SVG to save your vector artwork.</div>
    </section>
    <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onInput}/>
    <footer className="footer"><span>© {new Date().getFullYear()} AIVectorizer Studio</span><span>SVG Editor · Early development</span></footer>
  </main>;
}
