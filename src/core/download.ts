// Local file downloads. The blob is created in memory; Pickit never contacts a server.

const MIME: Record<string, string> = {
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.css': 'text/css',
  '.scss': 'text/plain',
};

/** Saves text as a file from an extension page. No download permission is required. */
export function downloadText(filename: string, text: string, extension: string): void {
  const blob = new Blob([text], { type: MIME[extension] ?? 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith(extension) ? filename : `${filename}${extension}`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
