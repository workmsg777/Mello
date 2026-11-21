const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { CACHE, PROJECT, loadApplication } = require("./runtime.cjs");
fs.mkdirSync(CACHE, { recursive: true });
process.chdir(CACHE);
const application = loadApplication();
const { app } = application.require(path.join(PROJECT, "backend/src/app.ts"));
const server = http.createServer(app);
const io = application
  .require(path.join(PROJECT, "backend/src/realtime/chat-server.ts"))
  .createChatServer(server);
const port = Number(process.env.PORT || 4200);
server.listen(port, "127.0.0.1", () =>
  console.log(
    `QA API: http://127.0.0.1:${port}/api (dedicated QA database, console OTP only, push workers disabled)`,
  ),
);
async function stop() {
  await new Promise((resolve) => io.close(resolve));
  await application.sequelize.close();
  process.exit();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
