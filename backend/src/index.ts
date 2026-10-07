import http from "http";
import { createApp } from "./app";
import { config } from "./config";
import { ensureUploadDir } from "./lib/media";
import { prisma } from "./lib/prisma";
import { initSocket } from "./socket";
import { runExpiryJob } from "./services/listings";

async function main() {
  await ensureUploadDir();
  await prisma.$connect();
  const app = createApp();
  const server = http.createServer(app);
  initSocket(server);
  server.listen(config.port, () => {
    console.log(`ALVER API http://localhost:${config.port}`);
    console.log(`Swagger http://localhost:${config.port}/api/docs`);
  });
  setInterval(() => {
    runExpiryJob().catch((error) => console.error("Müddət yoxlaması alınmadı", error));
  }, 60 * 60 * 1000);
  runExpiryJob().catch((error) => console.error("Müddət yoxlaması alınmadı", error));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
