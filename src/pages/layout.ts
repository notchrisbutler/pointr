type RenderPageOptions = {
  title: string;
  bodyAttributes?: string;
  styles: string;
  content: string;
  scriptPath: string;
};

const FOOTER_HTML = `
  <footer class="page-footer">
    <a href="https://github.com/notchrisbutler/pointr" target="_blank" rel="noopener">GitHub</a>
  </footer>`;

export function renderPage({
  title,
  bodyAttributes,
  styles,
  content,
  scriptPath,
}: RenderPageOptions): string {
  const attrs = bodyAttributes ? ` ${bodyAttributes}` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>${styles}</style>
</head>
<body${attrs}>
  ${content}
  ${FOOTER_HTML}
  <script src="${scriptPath}"></script>
</body>
</html>`;
}
