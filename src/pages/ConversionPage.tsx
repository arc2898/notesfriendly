import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Download,
  Loader2,
  X,
  FileText,
  ImagePlus,
  FileType,
  Presentation,
  FileImage,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type ProgressCb = (pct: number) => void;

interface ConversionOption {
  from: string;
  to: string;
  Icon: LucideIcon;
  accept: string;
  convert: (file: File, onProgress?: ProgressCb) => Promise<{ blob: Blob; filename: string }>;
}

// ---------- Conversions ----------

async function pdfToText(file: File): Promise<{ blob: Blob; filename: string }> {
  const { pdfjs } = await import("@/lib/pdfWorker");
  const data = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data }).promise;
  let out = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    const text = tc.items.map((it: any) => ("str" in it ? it.str : "")).join(" ");
    out += text + "\n\n";
  }
  const blob = new Blob([out.trim()], { type: "text/plain" });
  return { blob, filename: file.name.replace(/\.pdf$/i, ".txt") };
}

async function txtToPdf(file: File): Promise<{ blob: Blob; filename: string }> {
  const { PDFDocument, StandardFonts } = await import("pdf-lib");
  const text = await file.text();
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 11;
  const lineHeight = 14;
  const margin = 50;
  const pageWidth = 595;
  const pageHeight = 842;
  const maxWidth = pageWidth - margin * 2;

  const wrapLine = (line: string): string[] => {
    if (!line) return [""];
    const words = line.split(/\s+/);
    const lines: string[] = [];
    let current = "";
    for (const w of words) {
      const test = current ? current + " " + w : w;
      if (font.widthOfTextAtSize(test, fontSize) > maxWidth && current) {
        lines.push(current);
        current = w;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
  };

  const allLines = text.split(/\r?\n/).flatMap(wrapLine);
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;
  for (const line of allLines) {
    if (y < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    // Strip non-WinAnsi chars to avoid encoding errors
    const safe = line.replace(/[^\x20-\x7E]/g, "?");
    page.drawText(safe, { x: margin, y, size: fontSize, font });
    y -= lineHeight;
  }
  const bytes = await pdfDoc.save();
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  return { blob, filename: file.name.replace(/\.txt$/i, ".pdf") };
}

function rasterizeViaCanvas(file: File, type: "image/jpeg" | "image/png", ext: string): Promise<{ blob: Blob; filename: string }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      if (type === "image/jpeg") {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (blob) resolve({ blob, filename: file.name.replace(/\.[^.]+$/, ext) });
          else reject(new Error("Canvas conversion failed"));
        },
        type,
        0.92,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

const imageToJpg = (f: File) => rasterizeViaCanvas(f, "image/jpeg", ".jpg");
const imageToPng = (f: File) => rasterizeViaCanvas(f, "image/png", ".png");

async function pdfToPptx(file: File, onProgress?: ProgressCb): Promise<{ blob: Blob; filename: string }> {
  const { pdfjs } = await import("@/lib/pdfWorker");
  const JSZip = (await import("jszip")).default;
  const data = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data }).promise;
  const numPages = Math.min(pdf.numPages, 50);
  const pageImages: ArrayBuffer[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
    const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png"));
    pageImages.push(await blob.arrayBuffer());
    onProgress?.(Math.round((i / numPages) * 95));
  }

  const zip = new JSZip();
  let contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>`;
  for (let i = 0; i < pageImages.length; i++) {
    contentTypes += `\n  <Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
  }
  contentTypes += `\n</Types>`;
  zip.file("[Content_Types].xml", contentTypes);

  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`,
  );

  let slideList = "";
  let presRels = "";
  for (let i = 0; i < pageImages.length; i++) {
    slideList += `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`;
    presRels += `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`;
  }

  zip.file(
    "ppt/presentation.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldIdLst>${slideList}</p:sldIdLst>
  <p:sldSz cx="12192000" cy="6858000"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`,
  );

  zip.file(
    "ppt/_rels/presentation.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${presRels}
</Relationships>`,
  );

  for (let i = 0; i < pageImages.length; i++) {
    zip.file(`ppt/media/image${i + 1}.png`, pageImages[i]);
    zip.file(
      `ppt/slides/_rels/slide${i + 1}.xml.rels`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${i + 1}.png"/>
</Relationships>`,
    );
    zip.file(
      `ppt/slides/slide${i + 1}.xml`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      <p:pic>
        <p:nvPicPr><p:cNvPr id="2" name="Image${i + 1}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>
        <p:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
        <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="12192000" cy="6858000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
      </p:pic>
    </p:spTree>
  </p:cSld>
</p:sld>`,
    );
  }

  const pptxBlob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });
  return { blob: pptxBlob, filename: file.name.replace(/\.pdf$/i, ".pptx") };
}

async function pdfToImagesZip(file: File, onProgress?: ProgressCb): Promise<{ blob: Blob; filename: string }> {
  const { pdfjs } = await import("@/lib/pdfWorker");
  const JSZip = (await import("jszip")).default;
  const data = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data }).promise;
  const numPages = Math.min(pdf.numPages, 100);
  const zip = new JSZip();
  const base = file.name.replace(/\.pdf$/i, "");
  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
    const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.9));
    zip.file(`${base}-page-${String(i).padStart(3, "0")}.jpg`, await blob.arrayBuffer());
    onProgress?.(Math.round((i / numPages) * 95));
  }
  const out = await zip.generateAsync({ type: "blob" });
  return { blob: out, filename: `${base}-images.zip` };
}

const CONVERSIONS: ConversionOption[] = [
  { from: "PDF", to: "TXT", Icon: FileText, accept: ".pdf", convert: pdfToText },
  { from: "PDF", to: "JPG (zip)", Icon: FileImage, accept: ".pdf", convert: pdfToImagesZip },
  { from: "PDF", to: "PPTX", Icon: Presentation, accept: ".pdf", convert: pdfToPptx },
  { from: "TXT", to: "PDF", Icon: FileType, accept: ".txt", convert: txtToPdf },
  { from: "PNG", to: "JPG", Icon: FileImage, accept: ".png", convert: imageToJpg },
  { from: "JPG", to: "PNG", Icon: FileImage, accept: ".jpg,.jpeg", convert: imageToPng },
  { from: "WEBP", to: "JPG", Icon: FileImage, accept: ".webp", convert: imageToJpg },
  { from: "WEBP", to: "PNG", Icon: FileImage, accept: ".webp", convert: imageToPng },
];

export default function ConversionPage() {
  const [selectedConversion, setSelectedConversion] = useState<ConversionOption | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ blob: Blob; filename: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleSelectConversion = (conv: ConversionOption) => {
    setSelectedConversion(conv);
    setSelectedFile(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.accept = conv.accept;
      fileInputRef.current.click();
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
    e.target.value = "";
  };

  const handleConvert = async () => {
    if (!selectedFile || !selectedConversion) return;
    setConverting(true);
    setProgress(0);
    setResult(null);
    try {
      const res = await selectedConversion.convert(selectedFile, setProgress);
      setProgress(100);
      setResult(res);
      toast.success("Conversion complete");
    } catch (err: any) {
      console.error(err);
      toast.error("Conversion failed: " + (err?.message || "Unknown error"));
    }
    setConverting(false);
  };

  const handleDownload = () => {
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setSelectedConversion(null);
    setSelectedFile(null);
    setResult(null);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="p-4 space-y-6 fade-in max-w-lg mx-auto">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-foreground">File Conversion</h2>
        <p className="text-sm text-muted-foreground">Convert files between formats locally in your browser</p>
      </div>

      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />

      {selectedFile && selectedConversion && (
        <div className="glass rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <selectedConversion.Icon className="h-5 w-5 text-primary" />
              <span className="text-sm font-bold text-foreground">
                {selectedConversion.from}
                <ArrowRight className="inline h-3 w-3 mx-1.5 text-muted-foreground" />
                {selectedConversion.to}
              </span>
            </div>
            <Button variant="ghost" size="icon" onClick={reset} className="h-8 w-8 rounded-lg" aria-label="Cancel and reset">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-3 bg-secondary/30 rounded-xl p-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">{formatSize(selectedFile.size)}</p>
            </div>
          </div>

          {!result ? (
            <div className="space-y-2">
              <Button onClick={handleConvert} disabled={converting} className="w-full h-11 rounded-xl font-semibold">
                {converting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Converting{progress > 0 ? ` ${progress}%` : "..."}
                  </>
                ) : (
                  <>Convert to {selectedConversion.to}</>
                )}
              </Button>
              {converting && progress > 0 && (
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full bg-primary transition-all duration-200" style={{ width: `${progress}%` }} />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl p-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <selectedConversion.Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{result.filename}</p>
                  <p className="text-xs text-muted-foreground">{formatSize(result.blob.size)}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleDownload} className="flex-1 h-11 rounded-xl font-semibold">
                  <Download className="h-4 w-4" /> Download
                </Button>
                <Button variant="outline" onClick={reset} className="h-11 rounded-xl">
                  <RefreshCw className="h-4 w-4" /> New
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <Button
        variant="outline"
        onClick={() => navigate("/img-to-pdf")}
        className="w-full h-auto py-4 rounded-2xl justify-start gap-4 border-primary/30"
      >
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <ImagePlus className="h-5 w-5 text-primary" />
        </div>
        <div className="text-left">
          <p className="font-semibold text-foreground text-sm">Images to PDF</p>
          <p className="text-xs text-muted-foreground font-normal">Combine, reorder & download as PDF</p>
        </div>
        <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
      </Button>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {selectedFile ? "Or choose another" : "Quick Conversions"}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {CONVERSIONS.map((conv) => (
            <Button
              key={`${conv.from}-${conv.to}`}
              variant="outline"
              onClick={() => handleSelectConversion(conv)}
              className="h-14 rounded-xl justify-start gap-2.5 px-3"
            >
              <conv.Icon className="h-4 w-4 text-primary shrink-0" />
              <span className="font-semibold text-foreground">{conv.from}</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <span className="font-semibold text-foreground">{conv.to}</span>
            </Button>
          ))}
        </div>
      </div>

      <p className="text-[10px] text-center text-muted-foreground/60">
        All conversions happen locally in your browser. No files are uploaded.
      </p>
    </div>
  );
}
