import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".jpg": "image/jpeg" };
createServer(async (request,response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url,"http://localhost").pathname);
    const path = resolve(root,"." + (pathname === "/" ? "/index.html" : pathname));
    if (!path.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    const data = await readFile(path);
    response.writeHead(200,{ "Content-Type": types[extname(path)] || "application/octet-stream" }).end(data);
  } catch { response.writeHead(404).end(); }
}).listen(5500,"127.0.0.1");
