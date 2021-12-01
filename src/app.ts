import express from "express";
import cors from "cors";
import bodyParser from "body-parser";

import countriesRouter from "./router/derivatives";

const app: express.Application = express();

app.use(express.json({ limit: "50mb" }));
app.use(bodyParser.json({ limit: "50mb" }));

app.use(cors());

app.get(
  "/alive",
  (req: express.Request, res: express.Response, next: express.NextFunction) =>
    res.status(200).send("Data server is alive")
);

app.use("/derivatives", countriesRouter);

export default app;
