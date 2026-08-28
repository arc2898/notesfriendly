import { useState, useRef, useCallback } from "react";
import {
  ImagePlus,
  X,
  RotateCw,
  Trash2,
  GripVertical,
  FileDown,
  Pencil,
  ArrowLeft,
  Loader2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface ImageItem {
  id: string;
  file: File;
  url: string;
  rotation: number;
  naturalW: number;
  naturalH: number;
}

export default function ImgToPdfPage() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [pdfName, setPdfName] = useState("converted");
  const [generating, setGenerating] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const addImages = useCallback((files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const url = URL.createObjectURL(file);
      const img = new window.Image();
      img.onload = () => {
        setImages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            file,
            url,
            rotation: 0,
            naturalW: img.naturalWidth,
            naturalH: img.naturalHeight,
          },
        ]);
      };
      img.src = url;
    });
  }, []);

  const removeImage = (id: string) => {
    setImages((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) URL.revokeObjectURL(item.url);
      return prev.filter((i) => i.id !== id);
    });
  };

  const rotateImage = (id: string) => {
    setImages((prev) =>
      prev.map((i) => (i.id === id ? { ...i, rotation: (i.rotation + 90) % 360 } : i)),
    );
  };

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setImages((prev) => {
      const arr = [...prev];
      const [moved] = arr.splice(dragIdx, 1);
      arr.splice(idx, 0, moved);
      return arr;
    });
    setDragIdx(idx);
  };
  const handleDragEnd = () => setDragIdx(null);

  const renderRotated = async (item: ImageItem): Promise<Blob> => {
    const img = new window.Image();
    img.src = item.url;
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("Failed to load image"));
    });
    const rotated = item.rotation % 180 !== 0;
    const w = rotated ? item.naturalH : item.naturalW;
    const h = rotated ? item.naturalW : item.naturalH;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, w, h);
    ctx.translate(w / 2, h / 2);
    ctx.rotate((item.rotation * Math.PI) / 180);
    ctx.drawImage(img, -item.naturalW / 2, -item.naturalH / 2);
    return await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.9));
  };

  const generatePdf = async () => {
    if (images.length === 0) return;
    setGenerating(true);
    try {
      const { PDFDocument } = await import("pdf-lib");
      const pdfDoc = await PDFDocument.create();

      for (const item of images) {
        const blob = await renderRotated(item);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const jpg = await pdfDoc.embedJpg(bytes);

        // Fit to A4 portrait/landscape based on orientation
        const a4 = { w: 595.28, h: 841.89 };
        const landscape = jpg.width > jpg.height;
        const pageW = landscape ? a4.h : a4.w;
        const pageH = landscape ? a4.w : a4.h;
        const page = pdfDoc.addPage([pageW, pageH]);

        const scale = Math.min(pageW / jpg.width, pageH / jpg.height);
        const drawW = jpg.width * scale;
        const drawH = jpg.height * scale;
        page.drawImage(jpg, {
          x: (pageW - drawW) / 2,
          y: (pageH - drawH) / 2,
          width: drawW,
          height: drawH,
        });
      }

      const pdfBytes = await pdfDoc.save();
      const pdfBlob = new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${pdfName || "converted"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded");
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to generate PDF: " + (err?.message || ""));
    }
    setGenerating(false);
  };

  return (
    <div className="p-4 pb-8 space-y-5 fade-in max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/conversion")} className="shrink-0 rounded-xl" aria-label="Back to conversions">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-xl font-bold text-foreground">Images to PDF</h2>
          <p className="text-xs text-muted-foreground">Combine images into a single PDF</p>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          addImages(e.target.files);
          e.target.value = "";
        }}
      />

      <Button
        variant="outline"
        onClick={() => fileRef.current?.click()}
        className="w-full h-auto py-8 rounded-2xl border-dashed border-2 border-primary/30 hover:border-primary/60 flex-col gap-2"
      >
        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <ImagePlus className="h-6 w-6 text-primary" />
        </div>
        <span className="text-sm font-semibold text-foreground">Add Images</span>
        <span className="text-xs text-muted-foreground font-normal">JPG, PNG, WEBP — multiple files</span>
      </Button>

      {images.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {images.length} image{images.length > 1 ? "s" : ""}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                images.forEach((i) => URL.revokeObjectURL(i.url));
                setImages([]);
              }}
              className="text-xs text-destructive hover:text-destructive h-8"
            >
              <Trash2 className="h-3 w-3" /> Clear all
            </Button>
          </div>

          <div className="space-y-2">
            {images.map((item, idx) => (
              <div
                key={item.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                className={`glass rounded-xl p-3 flex items-center gap-3 transition-all ${
                  dragIdx === idx ? "opacity-50 scale-95" : ""
                }`}
              >
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
                <div className="h-14 w-14 rounded-lg overflow-hidden bg-secondary/30 shrink-0 flex items-center justify-center">
                  <img
                    src={item.url}
                    alt=""
                    className="max-h-full max-w-full object-cover"
                    style={{ transform: `rotate(${item.rotation}deg)` }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.naturalW}×{item.naturalH} · {(item.file.size / 1024).toFixed(0)} KB
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => rotateImage(item.id)} className="h-8 w-8 rounded-lg" aria-label="Rotate image">
                    <RotateCw className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeImage(item.id)}
                    className="h-8 w-8 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
                    aria-label="Remove image"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Button variant="outline" onClick={() => fileRef.current?.click()} className="w-full h-11 rounded-xl border-dashed">
            <Plus className="h-4 w-4" /> Add more images
          </Button>

          <div className="glass rounded-xl p-4 space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Pencil className="h-3 w-3" /> File Name
            </label>
            <div className="flex items-center gap-2">
              <Input
                value={pdfName}
                onChange={(e) => setPdfName(e.target.value)}
                placeholder="my-document"
                className="flex-1 h-11 rounded-xl"
              />
              <span className="text-sm text-muted-foreground font-mono">.pdf</span>
            </div>
          </div>

          <Button
            onClick={generatePdf}
            disabled={generating || images.length === 0}
            className="w-full h-12 rounded-xl font-semibold text-base"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Generating...
              </>
            ) : (
              <>
                <FileDown className="h-5 w-5" /> Download PDF
              </>
            )}
          </Button>
        </div>
      )}

      <p className="text-[10px] text-center text-muted-foreground/60">
        Everything happens locally in your browser. No images are uploaded.
      </p>
    </div>
  );
}
