"use client";

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine, Check, CircleHelp, CloudUpload, FileImage, LoaderCircle,
  RefreshCw, ShieldCheck, Sparkles, WandSparkles
} from "lucide-react";

type Mode = "graphic" | "photo";
type VectorResult = { svg: string; width: number; height: number; source: string };

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [mode, setMode] = useState<Mode>("graphic");
  const [colors, setColors] = useState(24);
  const [detail, setDetail] = useState(88);
  const [speckle, setSpeckle] = useState(2);
  const [corner, setCorner] = useState("medium");
  const [result, setResult] = useState<VectorResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [compare, setCompare] = useState<"original" | "vector">("original");

  useEffect(() => () => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  }, [sourceUrl]);

  function loadFile(next: File) {
    setError("");
    setResult(null);
    if (!ACCEPTED_TYPES.includes(next.type)) {
      setError("Please choose a PNG, JPG, or WebP image.");
      return;
    }
    if (next.size > MAX_FILE_SIZE) {
      setError("Image is larger than 20 MB. Please choose a smaller file.");
      return;
    }
    const url = URL.createObjectURL(next);
    setSourceUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return url;
    });
    setFile(next);
    setCompare("original");
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (selected) loadFile(selected);
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) loadFile(dropped);
  }

  async function vectorize() {
    if (!file) {
      inputRef.current?.click();
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("mode", mode);
      form.append("colors", String(colors));
      form.append("detail", String(detail));
      form.append("speckle", String(speckle));
      form.append("corner", corner);

      const response = await fetch("/api/vectorize", {
        method: "POST",
        body: form
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Vectorization failed.");
      }
      const svg = await response.text();
      const image = new Image();
      const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("The vector output could not be previewed."));
        image.src = svgUrl;
      });
      URL.revokeObjectURL(svgUrl);
      setResult({ svg, width: image.naturalWidth, height: image.naturalHeight, source: file.name });
      setCompare("vector");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Vectorization failed.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  function downloadSvg() {
    if (!result) return;
    const blob = new Blob([result.svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file?.name.replace(/\.[^.]+$/, "") + "-vector.svg";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function reset() {
    setFile(null);
    setResult(null);
    setError("");
    setSourceUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return "";
    });
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><WandSparkles size={19} /></div>
          <div>AIVectorizer<small>VECTOR STUDIO</small></div>
        </div>
        <div className="top-actions">
          <span className="status"><span style={{ marginRight: 6 }}>●</span> Server-side processing</span>
          <button className="ghost-btn" onClick={() => inputRef.current?.click()}>New image</button>
        </div>
      </header>

      <section className="workspace">
        <div className="hero">
          <div>
            <div className="eyebrow">Raster to vector workspace</div>
            <h1>Make every pixel a path.</h1>
            <p>Turn images into editable vector artwork. Create smoother, cleaner SVG artwork with adjustable tracing controls.</p>
          </div>
          <div className="hero-note">PRO WORKSPACE<br />Graphic &amp; photo vectorization</div>
        </div>

        <div className="workspace-grid">
          <div className="main-column">
            <section className="card">
              <div className="card-head">
                <div>
                  <div className="card-title">Your artwork</div>
                  <div className="card-sub">{file ? file.name : "Upload an image to get started"}</div>
                </div>
                <div className="mode-switch" aria-label="Preview mode">
                  <button className={compare === "original" ? "active" : ""} onClick={() => setCompare("original")} disabled={!file}>Original</button>
                  <button className={compare === "vector" ? "active" : ""} onClick={() => setCompare("vector")} disabled={!result}>Vector</button>
                </div>
              </div>

              <div
                className="canvas-wrap"
                onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
              >
                {!file ? (
                  <div className={`upload-zone ${dragging ? "dragging" : ""}`}>
                    <div className="upload-icon"><CloudUpload size={27} /></div>
                    <h3>Drop your image here</h3>
                    <p>Or browse files from your device<br />PNG, JPG or WebP · Up to 20 MB</p>
                    <button className="primary-btn" onClick={() => inputRef.current?.click()}>Choose image</button>
                    <div className="file-meta">Images are sent securely for temporary processing and are not saved to a user library.</div>
                  </div>
                ) : compare === "original" || !result ? (
                  <div className="preview-frame">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={sourceUrl} alt="Original uploaded artwork" className="preview-image" />
                  </div>
                ) : (
                  <div className="preview-frame checker">
                    <div dangerouslySetInnerHTML={{ __html: result.svg }} />
                  </div>
                )}
              </div>
              {error && <div style={{ padding: "0 18px 16px" }}><div className="error">{error}</div></div>}
              {busy && <div style={{ padding: "0 18px 18px" }}><div style={{ color: "#b7adff", fontSize: 11 }}>Vectorizing image…</div><div className="progress"><span /></div></div>}
            </section>

            <section className="card">
              <div className="card-head">
                <div>
                  <div className="card-title">Output</div>
                  <div className="card-sub">{result ? `${result.width} × ${result.height} px · SVG vector` : "Your vector file will appear here"}</div>
                </div>
                {result && <span className="preview-label"><Check size={11} style={{ display: "inline", marginRight: 4 }} />Ready to export</span>}
              </div>
              <div style={{ padding: 17 }}>
                {result ? (
                  <div className="result-actions">
                    <button className="primary-btn" onClick={downloadSvg}><ArrowDownToLine size={14} style={{ display: "inline", marginRight: 7 }} />Download SVG</button>
                    <button className="secondary-btn" onClick={() => setCompare("vector")}>Preview vector</button>
                    <button className="secondary-btn" onClick={reset}><RefreshCw size={13} style={{ display: "inline", marginRight: 6 }} />Start over</button>
                  </div>
                ) : (
                  <div style={{ color: "#788499", fontSize: 11, display: "flex", alignItems: "center", gap: 8 }}>
                    <FileImage size={16} /> SVG export becomes available after vectorization.
                  </div>
                )}
              </div>
            </section>
            <section className="card info-strip">
              <ShieldCheck size={16} color="#71d2a4" />
              <span>Processing runs on the AIVectorizer server. Uploaded images are handled for conversion and are not stored as projects.</span>
            </section>
          </div>

          <aside className="card settings">
            <div className="eyebrow">Fine-tune</div>
            <h2>Vector settings</h2>
            <div className="settings-intro">Choose a style and adjust the output to fit your artwork.</div>

            <div className="control">
              <div className="control-top"><span>Vectorization mode</span></div>
              <div className="mode-switch" style={{ width: "100%" }}>
                <button style={{ flex: 1 }} className={mode === "graphic" ? "active" : ""} onClick={() => setMode("graphic")}>Graphic</button>
                <button style={{ flex: 1 }} className={mode === "photo" ? "active" : ""} onClick={() => setMode("photo")}>Photo</button>
              </div>
              <div className="help">{mode === "graphic" ? "Optimized for logos, icons, flat artwork, and illustrations." : "Uses more colors to preserve photographic tones and soft detail."}</div>
            </div>

            <div className="control">
              <div className="control-top"><label htmlFor="colors">Color count</label><output>{colors}</output></div>
              <input id="colors" type="range" min="2" max="64" value={colors} onChange={(e) => setColors(Number(e.target.value))} />
              <div className="help">Fewer colors create simpler, cleaner vector artwork.</div>
            </div>

            <div className="control">
              <div className="control-top"><label htmlFor="detail">Detail level</label><output>{detail}%</output></div>
              <input id="detail" type="range" min="0" max="100" value={detail} onChange={(e) => setDetail(Number(e.target.value))} />
            </div>

            <div className="control">
              <div className="control-top"><label htmlFor="speckle">Speckle reduction</label><output>{speckle}</output></div>
              <input id="speckle" type="range" min="0" max="20" value={speckle} onChange={(e) => setSpeckle(Number(e.target.value))} />
              <div className="help">Removes small isolated shapes and image noise.</div>
            </div>

            <div className="control">
              <div className="control-top"><label htmlFor="corner">Corner handling</label></div>
              <select id="corner" value={corner} onChange={(e) => setCorner(e.target.value)}>
                <option value="sharp">Sharp</option>
                <option value="medium">Balanced</option>
                <option value="smooth">Smooth</option>
              </select>
            </div>

            <div className="settings-actions">
              <button className="primary-btn" disabled={busy} onClick={vectorize}>
                {busy ? <><LoaderCircle size={14} className="spin" style={{ display: "inline", marginRight: 7 }} />Processing…</> : <><Sparkles size={14} style={{ display: "inline", marginRight: 7 }} />Vectorize image</>}
              </button>
              <button className="secondary-btn" disabled={!file || busy} onClick={reset}>Clear workspace</button>
            </div>
            <div className="help" style={{ marginTop: 15, display: "flex", gap: 6 }}><CircleHelp size={13} /> Higher detail preserves more small regions; lower speckle removes isolated fragments.</div>
          </aside>
        </div>
      </section>

      <footer className="footer">
        <span>© {new Date().getFullYear()} AIVectorizer Studio</span>
        <span>Built for editable vector workflows · Early development</span>
      </footer>

      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onInputChange} />
    </main>
  );
}
