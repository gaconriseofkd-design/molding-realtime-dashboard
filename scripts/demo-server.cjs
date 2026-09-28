const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5005;
const DIRECTORY = path.join(__dirname, '../dist_demo_thang6');

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.woff': 'application/font-woff',
  '.ttf': 'application/font-ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'application/font-otf',
  '.wasm': 'application/wasm'
};

const server = http.createServer((request, response) => {
  let filePath = path.join(DIRECTORY, request.url === '/' ? 'index.html' : request.url);
  let extname = String(path.extname(filePath)).toLowerCase();

  // Handle SPA routing: if file doesn't exist and doesn't have an extension, serve index.html
  if (!fs.existsSync(filePath) && extname === '') {
    filePath = path.join(DIRECTORY, 'index.html');
    extname = '.html';
  }

  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        fs.readFile(path.join(DIRECTORY, 'index.html'), (err, content) => {
          if (err) {
            response.writeHead(500);
            response.end('Lỗi máy chủ: ' + err.code);
          } else {
            response.writeHead(200, { 'Content-Type': 'text/html' });
            response.end(content, 'utf-8');
          }
        });
      } else {
        response.writeHead(500);
        response.end('Lỗi máy chủ: ' + error.code);
      }
    } else {
      response.writeHead(200, { 'Content-Type': contentType });
      response.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n============================================================`);
  console.log(` DEMO MOLDING REALTIME - DU LIEU THANG 6/2026 `);
  console.log(`============================================================\n`);
  console.log(` Server dang chay tai: http://localhost:${PORT}`);
  console.log(` Ban co the dong cua so nay de tat server.\n`);
});
