import * as pdfjs from "pdfjs-dist";
// Vite-friendly worker URL
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

export { pdfjs };
