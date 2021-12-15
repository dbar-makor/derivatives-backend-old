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
  IDownloadFilesRequest,
} from "../model/express/request/derivatives";
import {
  IaddDerivativesResponse,
  IGetDerivativesResponse,
} from "../model/express/response/derivatives";

import {
  IWEXInterface,
  IDRVInterface,
  IWEXInterfaceObjectOfArrays,
  IDRVInterfaceObjectOfArrays,
} from "../model/shared/derivatives";

const addDerivatives = async (
  req: IaddDerivativesRequest,
  res: IaddDerivativesResponse,
) => {
  ServerGlobal.getInstance().logger.info(
    `<addDerivatives>: Start processing request`,
  );

  try {
    const base64WEX = req.body[0].file;
    const base64DRV = req.body[1].file;
    const WEXArray: IWEXInterface[] = [];
    const DRVArray: IDRVInterface[] = [];
    let canceledInversePairsWEXArray: IWEXInterface[] = [];
    let matchingCriteriaWEXArray: IWEXInterface[] = [];
    let WEXArrayFilteredByDRV: IWEXInterface[] = [];
    const uid = "ID_" + shortid.generate() + "_";
    const date = new Date();
    const formattedDate = moment(date).format("DD/MM/YYYY");

    // Check if WEX file is valid
    if (!base64WEX) {
      ServerGlobal.getInstance().logger.error(
        "<addDerivatives>: Failed to process WEX file because the file is invalid",
      );

      res.status(400).send({
        success: false,
        message: "WEX file is invalid",
      });
      return;
    }

    // Check if DRV file is valid
    if (!base64DRV) {
      ServerGlobal.getInstance().logger.error(
        "<addDerivatives>: Failed to process DRV file because the file is invalid",
      );

      res.status(400).send({
        success: false,
        message: "DRV file is invalid",
      });
      return;
    }

    const WEXSplited = base64WEX.split(";base64,").pop();
    const DRVSplited = base64DRV.split(";base64,").pop();

    ServerGlobal.getInstance().logger.info(
      `<addDerivatives>: Successfully splited the files`,
    );

    fs.writeFileSync(`assets/${uid}WEXFile.csv`, WEXSplited!, {
      encoding: "base64",
    });

    fs.writeFileSync(`assets/${uid}DRVFile.csv`, DRVSplited!, {
      encoding: "base64",
    });

    ServerGlobal.getInstance().logger.info(
      `<addDerivatives>: Successfully encoded the files`,
    );

    fs.createReadStream(`assets/${uid}WEXFile.csv`)
      .pipe(csv())
      .on("data", (data: IWEXInterface) => {
        WEXArray.push(data);
      });

    fs.createReadStream(`assets/${uid}DRVFile.csv`)
      .pipe(csv())
      .on("data", (data: IDRVInterface) => {
        DRVArray.push(data);
      })
      .on("end", () => {
        derivativesActions();
      });

    const derivativesActions = async () => {
      // Map WEX returns date only
      const WEXDateArray = WEXArray.map((r) => r.Date);

      // Filter WEXDateArray returns unique dates
      const uniqueDateWEXArray = WEXDateArray.filter((item, pos) => {
        return WEXDateArray.indexOf(item) == pos;
      });

      // Separate WEX result by date
      const WEXArraySeparatedByDates: IWEXInterfaceObjectOfArrays =
        WEXArray.reduce((arr, WEX) => {
          arr[WEX.Date!] = arr[WEX.Date!] || [];
          arr[WEX.Date!].push(WEX);
          return arr;
        }, Object.create(null));

      // Separate DRV result by date
      const DRVArraySeparatedByDates: IDRVInterfaceObjectOfArrays =
        DRVArray.reduce((arr, DRV) => {
          arr[DRV.date!] = arr[DRV.date!] || [];
          arr[DRV.date!].push(DRV);
          return arr;
        }, Object.create(null));

      for (const date of uniqueDateWEXArray) {
        // Run over each row in date
        for (let i = 0; i < WEXArraySeparatedByDates[date!].length; i++) {
          // Run over each row starting from the outer element's position
          for (let j = i + 1; j < WEXArraySeparatedByDates[date!].length; j++) {
            const {
              User: user_i,
              Date: date_i,
              Route: route_i,
              Side: side_i,
              Security: security_i,
              Root: root_i,
              Expiry: expiry_i,
              Strike: strike_i,
              "Call/Put": callPut_i,
              "Average Price": averagePrice_i,
              "Total Charge": totalCharge_i,
              Portfolio: portfolio_i,
              "Commission Type": commissionType_i,
              "Exec Qty": execQty_i,
              removed: removed_i,
            } = WEXArraySeparatedByDates[date!][i];
            const {
              User: user_j,
              Date: date_j,
              Route: route_j,
              Side: side_j,
              Security: security_j,
              Root: root_j,
              Expiry: expiry_j,
              Strike: strike_j,
              "Call/Put": callPut_j,
              "Average Price": averagePrice_j,
              "Total Charge": totalCharge_j,
              Portfolio: portfolio_j,
              "Commission Type": commissionType_j,
              "Exec Qty": execQty_j,
              removed: removed_j,
            } = WEXArraySeparatedByDates[date!][j];

            // Cast exec qty to number
            const numberExecQty_i = Number(execQty_i);
            const numberExecQty_j = Number(execQty_j);

            // Remove total charge dollar sign and parenthesis from string and cast to number
            const numberTotalCharge_i = Number(
              totalCharge_i?.substring(1).replace(/[()]/g, ""),
            );
            const numberTotalCharge_j = Number(
              totalCharge_j?.substring(1).replace(/[()]/g, ""),
            );

            // Remove all chars after first -
            const subPortfolio_i = portfolio_i?.split("-")[0];
            const subPortfolio_j = portfolio_j?.split("-")[0];

            if (
              !removed_i &&
              !removed_j &&
              numberExecQty_i === numberExecQty_j * -1 &&
              numberTotalCharge_i === numberTotalCharge_j &&
              user_i === user_j &&
              date_i === date_j &&
              route_i === route_j &&
              side_i === side_j &&
              security_i === security_j &&
              root_i === root_j &&
              expiry_i === expiry_j &&
              strike_i === strike_j &&
              callPut_i === callPut_j &&
              averagePrice_i === averagePrice_j &&
              commissionType_i === commissionType_j &&
              subPortfolio_i === subPortfolio_j
            ) {
              WEXArraySeparatedByDates[date!][i].removed = true;
              WEXArraySeparatedByDates[date!][j].removed = true;
            }
          }
        }

        let canceledInversePairsWEXArraySeparatedByDates: IWEXInterface[] = [];

        canceledInversePairsWEXArraySeparatedByDates = WEXArraySeparatedByDates[
          date!
        ].filter((element) => {
          return !element.removed;
        });

        canceledInversePairsWEXArray = canceledInversePairsWEXArray.concat(
          canceledInversePairsWEXArraySeparatedByDates,
        );
      }

      // Separate canceled inverse pair WEX result by date
      const canceledInversePairsWEXArraySeparatedByDates: IWEXInterfaceObjectOfArrays =
        canceledInversePairsWEXArray.reduce((arr, WEX) => {
          arr[WEX.Date!] = arr[WEX.Date!] || [];
          arr[WEX.Date!].push(WEX);
          return arr;
        }, Object.create(null));

      for (const date of uniqueDateWEXArray) {
        const filteredByDRV = canceledInversePairsWEXArraySeparatedByDates[
          date!
        ].filter(
          (WEXRow) =>
            !DRVArraySeparatedByDates[date!].some((DRVRow) => {
              // Format expiry date
              const WEXRowExpiryYear = WEXRow.Expiry?.substring(0, 4);
              const WEXRowExpiryMonth = WEXRow.Expiry?.substring(5, 7);
              const numberWEXRowExpiryMonth = parseInt(WEXRowExpiryMonth!, 10);
              const WEXRowExpiryDay = WEXRow.Expiry?.substring(8, 10);
              const numberWEXRowExpiryDay = parseInt(WEXRowExpiryDay!, 10);
              const WEXRowFormatedExpiry = `${numberWEXRowExpiryMonth}/${numberWEXRowExpiryDay}/${WEXRowExpiryYear}`;

              DRVRow.date === WEXRow.Date &&
                DRVRow.side!.charAt(0) ===
                  WEXRow.Side!.charAt(0).toLowerCase() &&
                DRVRow.symbol === WEXRow.Root &&
                DRVRow.option?.charAt(0) ===
                  WEXRow["Call/Put"]!.charAt(0).toLowerCase() &&
                DRVRow.quantity === WEXRow["Exec Qty"] &&
                DRVRow.price === WEXRow["Average Price"]?.substring(1) &&
                Number(DRVRow.strike) === Number(WEXRow.Strike?.substring(1));
              DRVRow.expiry === WEXRowFormatedExpiry;
            }),
        );

        WEXArrayFilteredByDRV = WEXArrayFilteredByDRV.concat(filteredByDRV);
      }

      // convert JSON array to CSV file
      converter.json2csv(WEXArrayFilteredByDRV, (err, csv) => {
        if (err) {
          ServerGlobal.getInstance().logger.info(
            `<addDerivatives>: Failed to convert file to csv because of error: ${err}`,
          );

          res.status(400).send({
            success: false,
            message: "Failed to convert file to csv",
          });
          return;
        }

        if (!csv) {
          ServerGlobal.getInstance().logger.info(
            "<addDerivatives>: Failed to convert file to csv",
          );

          res.status(400).send({
            success: false,
            message: "Failed to convert file to csv",
          });
          return;
        }

        fs.writeFileSync(`assets/${uid}FilteredWEXFile.csv`, csv);
      });

      // Calculate matched rows
      const matchedRows = WEXArray.length - WEXArrayFilteredByDRV.length;

      // Calculate complete percentage
      const completePercentageRows =
        WEXArrayFilteredByDRV.length / (WEXArray.length * 100);

      console.log(WEXArrayFilteredByDRV.length);

      // Saving the derivative document in DB
      await Derivative.create({
        date: formattedDate,
        wex: `${uid}WEXFile.csv`,
        drv: `${uid}DRVFile.csv`,
        matched: matchedRows,
        unmatched: WEXArrayFilteredByDRV.length,
        unknown: 0,
        complete: completePercentageRows,
        derivatives: `${uid}FilteredWEXFile.csv`,
        username: "hey",
      });
    };
  } catch (e) {
    ServerGlobal.getInstance().logger.error(
      `<addDerivatives>: Failed to add derivatives data because of server error: ${e}`,
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
  res: IGetDerivativesResponse,
) => {
  ServerGlobal.getInstance().logger.info(
    `<getDerivatives>: Start processing request`,
  );

  try {
    // Get derivatives
    const derivatives = await Derivative.findAll();

    // Check if derivatives are valid
    if (!derivatives) {
      ServerGlobal.getInstance().logger.error(
        "<getDerivatives>: Failed to get derivatives",
      );

      res.status(400).send({
        success: false,
        message: "derivatives are invalid",
      });
      return;
    }

    ServerGlobal.getInstance().logger.info(
      `<getDerivatives>: Successfully got the derivatives`,
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
      `<getDerivatives>: Failed to get derivatives because of server error: ${e}`,
    );

    res.status(500).send({
      success: false,
      message: "Server error",
    });
    return;
  }
};

const getDerivativeFiles = async (req: IDownloadFilesRequest, res: any) => {
  ServerGlobal.getInstance().logger.info(
    `<getDerivativeFiles>: Start processing request`,
  );

  try {
    const fileName = req.params.fileId;
    const filePath = __dirname + "../../../assets/" + fileName;
    res.download(filePath, fileName);
  } catch (e) {
    ServerGlobal.getInstance().logger.error(
      `<getDerivatives>: Failed to download files because of server error: ${e}`,
    );

    res.status(500).send({
      success: false,
      message: "Server error",
    });
    return;
  }
};

export { addDerivatives, getDerivatives, getDerivativeFiles };
