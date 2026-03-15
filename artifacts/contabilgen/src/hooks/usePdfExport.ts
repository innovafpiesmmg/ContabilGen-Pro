import { useState, RefObject } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import JSZip from "jszip";
import { saveAs } from "file-saver";

export interface PdfTab {
  id: string;
  label: string;
  ref: RefObject<HTMLDivElement | null>;
}

async function captureDivAsPdfBlob(
  el: HTMLElement,
  companyName: string,
  tabLabel: string,
): Promise<Blob> {
  const A4_W_MM = 210;
  const A4_H_MM = 297;
  const MARGIN_MM = 10;
  const CONTENT_W_MM = A4_W_MM - MARGIN_MM * 2;

  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    windowWidth: 1100,
  });

  const imgData = canvas.toDataURL("image/jpeg", 0.92);
  const imgWidthPx = canvas.width;
  const imgHeightPx = canvas.height;
  const ratio = imgHeightPx / imgWidthPx;
  const contentHeightMM = CONTENT_W_MM * ratio;

  const pxPerMM = imgWidthPx / CONTENT_W_MM;
  const pageHeightPx = A4_H_MM * pxPerMM;
  const totalPages = Math.ceil(imgHeightPx / pageHeightPx);

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  for (let page = 0; page < totalPages; page++) {
    if (page > 0) pdf.addPage();

    const HEADER_H = 14;
    const FOOTER_H = 8;
    const PRINT_H = A4_H_MM - MARGIN_MM * 2 - HEADER_H - FOOTER_H;

    pdf.setFillColor(248, 250, 252);
    pdf.rect(0, 0, A4_W_MM, HEADER_H + MARGIN_MM, "F");
    pdf.setFontSize(9);
    pdf.setTextColor(100, 116, 139);
    pdf.setFont("helvetica", "bold");
    pdf.text("ContabilGen Pro", MARGIN_MM, MARGIN_MM + 5);
    pdf.setFont("helvetica", "normal");
    pdf.text(companyName, MARGIN_MM, MARGIN_MM + 10);
    pdf.text(tabLabel, A4_W_MM - MARGIN_MM, MARGIN_MM + 5, { align: "right" });
    pdf.text(new Date().toLocaleDateString("es-ES"), A4_W_MM - MARGIN_MM, MARGIN_MM + 10, { align: "right" });
    pdf.setDrawColor(226, 232, 240);
    pdf.line(MARGIN_MM, MARGIN_MM + HEADER_H, A4_W_MM - MARGIN_MM, MARGIN_MM + HEADER_H);

    const srcY = page * pageHeightPx;
    const srcH = Math.min(pageHeightPx, imgHeightPx - srcY);

    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = imgWidthPx;
    sliceCanvas.height = srcH;
    const ctx = sliceCanvas.getContext("2d")!;
    const img = new Image();
    await new Promise<void>((res) => {
      img.onload = () => {
        ctx.drawImage(img, 0, srcY, imgWidthPx, srcH, 0, 0, imgWidthPx, srcH);
        res();
      };
      img.src = imgData;
    });

    const sliceData = sliceCanvas.toDataURL("image/jpeg", 0.92);
    const sliceRatio = srcH / imgWidthPx;
    const sliceHeightMM = Math.min(CONTENT_W_MM * sliceRatio, PRINT_H);

    pdf.addImage(
      sliceData,
      "JPEG",
      MARGIN_MM,
      MARGIN_MM + HEADER_H,
      CONTENT_W_MM,
      sliceHeightMM,
    );

    pdf.setFontSize(8);
    pdf.setTextColor(148, 163, 184);
    pdf.text(
      `Página ${page + 1} de ${totalPages}`,
      A4_W_MM / 2,
      A4_H_MM - MARGIN_MM,
      { align: "center" },
    );
  }

  return pdf.output("blob");
}

export function usePdfExport() {
  const [exporting, setExporting] = useState<string | null>(null);

  async function exportTab(
    el: HTMLElement,
    companyName: string,
    tabLabel: string,
    filename: string,
  ) {
    setExporting(tabLabel);
    try {
      const blob = await captureDivAsPdfBlob(el, companyName, tabLabel);
      saveAs(blob, filename);
    } finally {
      setExporting(null);
    }
  }

  async function exportAllAsZip(
    tabs: PdfTab[],
    companyName: string,
  ) {
    setExporting("zip");
    try {
      const zip = new JSZip();
      const folder = zip.folder(companyName.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s]/g, "").trim()) || zip;

      for (const tab of tabs) {
        if (!tab.ref.current) continue;
        const blob = await captureDivAsPdfBlob(
          tab.ref.current,
          companyName,
          tab.label,
        );
        folder.file(`${tab.id}_${tab.label.replace(/[/\\?%*:|"<>]/g, "-")}.pdf`, blob);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const safeName = companyName.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
      saveAs(zipBlob, `ContabilGen_${safeName}.zip`);
    } finally {
      setExporting(null);
    }
  }

  return { exporting, exportTab, exportAllAsZip };
}
