import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { encode as encodeQr } from 'uqr';

export async function buildRecoveryKitPdf(input: {
  email: string;
  phrase: string;
  base32: string;
  createdAt: Date;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const mono = await doc.embedFont(StandardFonts.Courier);
  const ink = rgb(0.05, 0.07, 0.09);
  const muted = rgb(0.42, 0.45, 0.5);

  page.drawText('Secrelyte recovery kit', { x: 56, y: 730, size: 22, font, color: ink });
  page.drawText(input.email, { x: 56, y: 706, size: 11, font: mono, color: muted });
  page.drawText(input.createdAt.toISOString().slice(0, 10), {
    x: 56,
    y: 690,
    size: 11,
    font: mono,
    color: muted,
  });

  const warning =
    'Secrelyte cannot recover this vault. If you lose the password and this sheet, the data is gone.';
  page.drawText(warning, { x: 56, y: 650, size: 11, font, color: ink, maxWidth: 500 });

  page.drawText('24-word phrase', { x: 56, y: 610, size: 12, font, color: ink });
  const words = input.phrase.split(' ');
  words.forEach((word, i) => {
    const col = i < 12 ? 0 : 1;
    const row = i % 12;
    const x = 56 + col * 250;
    const y = 580 - row * 16;
    page.drawText(`${String(i + 1).padStart(2, '0')}  ${word}`, {
      x,
      y,
      size: 11,
      font: mono,
      color: ink,
    });
  });

  page.drawText('Base32 fallback', { x: 56, y: 360, size: 12, font, color: ink });
  page.drawText(input.base32, { x: 56, y: 340, size: 10, font: mono, color: ink, maxWidth: 500 });

  const qr = encodeQr(`secrelyte-rk:${input.base32}`, { border: 2 });
  const originX = 400;
  const originY = 80;
  const cell = 3.2;
  for (let y = 0; y < qr.size; y += 1) {
    for (let x = 0; x < qr.size; x += 1) {
      if (qr.data[y]?.[x]) {
        page.drawRectangle({
          x: originX + x * cell,
          y: originY + (qr.size - 1 - y) * cell,
          width: cell,
          height: cell,
          color: ink,
        });
      }
    }
  }

  page.drawText('Print this. Photographing it is a copy you cannot revoke.', {
    x: 56,
    y: 48,
    size: 9,
    font,
    color: muted,
    maxWidth: 320,
  });

  return doc.save();
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

export function downloadBytes(filename: string, bytes: Uint8Array, type: string): void {
  const blob = new Blob([asArrayBuffer(bytes)], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
