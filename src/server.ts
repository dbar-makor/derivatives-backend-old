import http from "http";
import Debug from "debug";
import app from "./app";

import "./model/shared/associations";

import ServerGlobal from "./server-global";

const debug = Debug("node-react");

const normalizePort = (val: string) => {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    return val;
  }

  if (port >= 0) {
    return port;
  }

  return null;
};

const onError = (error: NodeJS.ErrnoException) => {
  if (error.syscall !== "listen") {
    throw error;
  }

  const addr = server.address();
  const bind = typeof addr === "string" ? "pipe " + addr : "port " + port;

  switch (error.code) {
    case "EACCES":
      console.error(bind + "requires elevated privileges");
      process.exit(1);
      break;
    case "EADDRINUSE":
      console.error(bind + " is already in use");
      process.exit(1);
      break;
    default:
      throw error;
  }
};

const onListening = () => {
  const addr = server.address();
  const bind = typeof addr === "string" ? "pipe " + addr : "port " + port;

  debug("Listening on " + bind);
};

const port = normalizePort(process.env.PORT || "3000");

app.set("port", port);

const server = http.createServer(app);

server.on("error", onError);
server.on("listening", onListening);

ServerGlobal.getInstance()
  .db.sync()
  .then(() => {
    ServerGlobal.getInstance().logger.info(
      "Successfully initiated connection for mysql datebase"
    );
    server.listen(port || 3000);

    ServerGlobal.getInstance().logger.info(`Server is running on port ${port}`);
  })
  .catch((e) => {
    console.log(e);
    ServerGlobal.getInstance().logger.info(
      `Failed to initiated connection for mysql database with error: ${e}`
    );
  });
