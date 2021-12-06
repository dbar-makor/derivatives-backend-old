import fs from "fs";
import csv from "csv-parser";
import moment from "moment";
import shortid from "shortid";
import converter from "json-2-csv";

import ServerGlobal from "../server-global";

import Derivative from "../model/derivative";

import {
  IaddDerivativesRequest,
  IGetDerivativesRequest,
} from "../model/express/request/derivatives";
import {
  IaddDerivativesResponse,
  IGetDerivativesResponse,
} from "../model/express/response/derivatives";

import {
  IWEXInterface,
  IDRVInterface,
  IWEXInterfaceObjectOfArrays,
} from "../model/shared/derivatives";

const addDerivatives = async (
  req: IaddDerivativesRequest,
  res: IaddDerivativesResponse
) => {
  ServerGlobal.getInstance().logger.info(
    `<addDerivatives>: Start processing request`
  );

  try {
    const base64WEXFile = req.body[0].file;
    const base64DRVFile = req.body[1].file;
    const WEXFile: IWEXInterface[] = [];
    const DRVFile: IDRVInterface[] = [];
    let finalWEXArray: IWEXInterface[] = [];
    let filteredWEXArraySeparatedByDates: IWEXInterface[] = [];
    const uid = "ID_" + shortid.generate() + "_";
    const date = new Date();
    const formattedDate = moment(date).format("DD/MM/YYYY");

    // Check if WEX file is valid
    if (!base64WEXFile) {
      ServerGlobal.getInstance().logger.error(
        "<addDerivatives>: Failed to process WEX file because the file is invalid"
      );

      res.status(400).send({
        success: false,
        message: "WEX file is invalid",
      });
      return;
    }

    // Check if DRV file is valid
    if (!base64DRVFile) {
      ServerGlobal.getInstance().logger.error(
        "<addDerivatives>: Failed to process DRV file because the file is invalid"
      );

      res.status(400).send({
        success: false,
        message: "DRV file is invalid",
      });
      return;
    }

    const WEXFileOne = base64WEXFile.split(";base64,").pop();
    const DRVFileTwo = base64DRVFile.split(";base64,").pop();

    ServerGlobal.getInstance().logger.info(
      `<addDerivatives>: Successfully splited the files`
    );

    fs.writeFileSync(`assets/${uid}WEXFile.csv`, WEXFileOne!, {
      encoding: "base64",
    });

    fs.writeFileSync(`assets/${uid}DRVFile.csv`, DRVFileTwo!, {
      encoding: "base64",
    });

    ServerGlobal.getInstance().logger.info(
      `<addDerivatives>: Successfully encoded the files`
    );

    fs.createReadStream(`assets/${uid}WEXFile.csv`)
      .pipe(csv())
      .on("data", (data: IWEXInterface) => {
        WEXFile.push(data);
      });

    fs.createReadStream(`assets/${uid}DRVFile.csv`)
      .pipe(csv())
      .on("data", (data: IDRVInterface) => {
        DRVFile.push(data);
      })
      .on("end", () => {
        derivativesActions();
      });

    const derivativesActions = async () => {
      // Map WEXFile returns date only
      const WEXDateArray = WEXFile.map((r) => r.Date);

      // Filter WEXDateArray returns unique dates
      const uniqueDateArray = WEXDateArray.filter((item, pos) => {
        return WEXDateArray.indexOf(item) == pos;
      });

      // Separate WEXFile result by date
      const WEXFileArraySeparatedByDates: IWEXInterfaceObjectOfArrays =
        WEXFile.reduce((r, WEX) => {
          r[WEX.Date!] = r[WEX.Date!] || [];
          r[WEX.Date!].push(WEX);
          return r;
        }, Object.create(null));

      for (const date of uniqueDateArray) {
        // Run over each row in date
        for (let i = 0; i < WEXFileArraySeparatedByDates[date!].length; i++) {
          // Run over each row starting from the outer element's position
          for (
            let j = i + 1;
            j < WEXFileArraySeparatedByDates[date!].length;
            j++
          ) {
            const { "Exec Qty": execQty_i, removed: removed_i } =
              WEXFileArraySeparatedByDates[date!][i];
            const { "Exec Qty": execQty_j, removed: removed_j } =
              WEXFileArraySeparatedByDates[date!][j];
            const numberExecQty_i = Number(execQty_i);
            const numberExecQty_j = Number(execQty_j);
            if (
              !removed_i &&
              !removed_j &&
              numberExecQty_i === numberExecQty_j * -1
            ) {
              WEXFileArraySeparatedByDates[date!][i].removed = true;
              WEXFileArraySeparatedByDates[date!][j].removed = true;
            }
          }
        }

        filteredWEXArraySeparatedByDates = WEXFileArraySeparatedByDates[
          date!
        ].filter((element) => {
          return !element.removed;
        });

        finalWEXArray = finalWEXArray.concat(filteredWEXArraySeparatedByDates);
      }

      // // convert JSON array to CSV string
      converter.json2csv(finalWEXArray, (err, csv) => {
        if (err) {
          ServerGlobal.getInstance().logger.info(
            `<addDerivatives>: Failed to convert file to csv because of error: ${err}`
          );

          res.status(400).send({
            success: false,
            message: "Failed to convert file to csv",
          });
          return;
        }

        if (!csv) {
          ServerGlobal.getInstance().logger.info(
            "<addDerivatives>: Failed to convert file to csv"
          );

          res.status(400).send({
            success: false,
            message: "Failed to convert file to csv",
          });
          return;
        }

        fs.writeFileSync(`assets/${uid}FilteredWEXFile.csv`, csv);
        // print CSV string
        console.log(csv);
      });

      // Calculate matched rows
      const matchedRows = WEXFile.length - finalWEXArray.length;

      // Calculate complete percentage
      const completePercentage = finalWEXArray.length / (WEXFile.length * 100);

      // Saving the derivative document in DB
      await Derivative.create({
        date: formattedDate,
        wex: `${uid}WEXFile.csv`,
        drv: `${uid}DRVFile.csv`,
        matched: matchedRows,
        unmatched: finalWEXArray.length,
        unknown: 0,
        complete: completePercentage,
        derivatives: `${uid}FilteredWEXFile.csv`,
        username: "hey",
      });
    };
  } catch (e) {
    ServerGlobal.getInstance().logger.error(
      `<addDerivatives>: Failed to add derivatives data because of server error: ${e}`
    );

    res.status(500).send({
      success: false,
      message: "Server error",
    });
    return;
  }
};

const getDerivatives = async (
  req: IGetDerivativesRequest,
  res: IGetDerivativesResponse
) => {
  ServerGlobal.getInstance().logger.info(
    `<getDerivatives>: Start processing request`
  );

  try {
    // Get derivatives
    const derivatives = await Derivative.findAll();

    ServerGlobal.getInstance().logger.info(
      `<getDerivatives>: Successfully got the derivatives`
    );

    res.status(200).send({
      success: true,
      message: "Successfully retrieved movies",
      data: derivatives.map((derivative) => ({
        id: derivative.id,
        date: derivative.date,
        wex: derivative.wex,
        drv: derivative.drv,
        matched: derivative.matched,
        unmatched: derivative.unmatched,
        unknown: derivative.unknown,
        complete: derivative.complete,
        derivatives: derivative.derivatives,
        username: derivative.username,
      })),
    });
    return;
  } catch (e) {
    ServerGlobal.getInstance().logger.error(
      `<getDerivatives>: Failed to get derivatives because of server error: ${e}`
    );

    res.status(500).send({
      success: false,
      message: "Server error",
    });
    return;
  }
};

export { addDerivatives, getDerivatives };
