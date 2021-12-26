import cors from "cors";
import express from "express";
import bodyParser from "body-parser";

import authRouter from "./router/auth";
import derivativesRouter from "./router/derivatives";

const app: express.Application = express();

app.use(express.json({ limit: "50mb" }));
app.use(bodyParser.json({ limit: "50mb" }));

app.use(cors());

app.get(
  "/alive",
  (req: express.Request, res: express.Response, next: express.NextFunction) =>
    res.status(200).send("Data server is alive")
);

app.use("/auth", authRouter);
app.use("/derivatives", derivativesRouter);

export default app;
