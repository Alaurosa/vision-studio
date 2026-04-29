/** Public URL for Lucas portfolio assets (folder name contains a space). */
export function lucasImage(filename: string): string {
  const folder = encodeURIComponent("lucas portfolio");
  const file = encodeURIComponent(filename);
  return `/images/${folder}/${file}`;
}
