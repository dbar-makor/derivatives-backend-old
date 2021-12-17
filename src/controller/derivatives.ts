import fs from "fs";
import csv from "csv-parser";
import moment from "moment";
import shortid from "shortid";
import converter from "json-2-csv";

import ServerGlobal from "../server-global";

import Derivative from "../model/derivative";
import User from "../model/user";

import {
  IaddDerivativesRequest,
  IGetDerivativesRequest,
  IGetDerivativeRequest,
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

    ServerGlobal.getInstance().logger.info(
      `<addDerivatives>: Successfully created the files to dir`,
    );

    const derivativesActions = async () => {
      // Map WEX returns date only
      const WEXDateArray = WEXArray.map((r) => r.Date);

      // Check if WEX date array is valid
      if (!WEXDateArray) {
        ServerGlobal.getInstance().logger.error(
          "<addDerivatives>: Failed because WEX date array is invalid",
        );

        res.status(400).send({
          success: false,
          message: "WEX date array is invalid",
        });
        return;
      }

      ServerGlobal.getInstance().logger.info(
        `<addDerivatives>: Successfully mapped WEX date array`,
      );

      // Filter WEXDateArray returns unique dates
      const uniqueDateWEXArray = WEXDateArray.filter((item, pos) => {
        return WEXDateArray.indexOf(item) == pos;
      });

      // Check if unique WEX date array is valid
      if (!uniqueDateWEXArray) {
        ServerGlobal.getInstance().logger.error(
          "<addDerivatives>: Failed because unique WEX date array is invalid",
        );

        res.status(400).send({
          success: false,
          message: "Unique WEX date array is invalid",
        });
        return;
      }

      ServerGlobal.getInstance().logger.info(
        `<addDerivatives>: Successfully filtered WEX date array`,
      );

      // Separate WEX result by date
      const WEXArraySeparatedByDates: IWEXInterfaceObjectOfArrays =
        WEXArray.reduce((arr, WEX) => {
          arr[WEX.Date!] = arr[WEX.Date!] || [];
          arr[WEX.Date!].push(WEX);
          return arr;
        }, Object.create(null));

      // Check if WEX array separated by dates is valid
      if (!WEXArraySeparatedByDates) {
        ServerGlobal.getInstance().logger.error(
          "<addDerivatives>: Failed because WEX array separated by dates is invalid",
        );

        res.status(400).send({
          success: false,
          message: "WEX array separated by dates is invalid",
        });
        return;
      }

      ServerGlobal.getInstance().logger.info(
        `<addDerivatives>: Successfully separated WEX array`,
      );

      // Separate DRV result by date
      const DRVArraySeparatedByDates: IDRVInterfaceObjectOfArrays =
        DRVArray.reduce((arr, DRV) => {
          arr[DRV.date!] = arr[DRV.date!] || [];
          arr[DRV.date!].push(DRV);
          return arr;
        }, Object.create(null));

      // Check if DRV array separated by dates is valid
      if (!DRVArraySeparatedByDates) {
        ServerGlobal.getInstance().logger.error(
          "<addDerivatives>: Failed because DRV array separated by dates is invalid",
        );

        res.status(400).send({
          success: false,
          message: "DRV array separated by dates is invalid",
        });
        return;
      }

      ServerGlobal.getInstance().logger.info(
        `<addDerivatives>: Successfully separated DRV array`,
      );

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

            // Lower case user
            const lowerCaseUser_i = user_i!.toLowerCase();
            const lowerCaseUser_j = user_j!.toLowerCase();

            // Lower case route
            const lowerCaseRoute_i = route_i!.toLowerCase();
            const lowerCaseRoute_j = route_j!.toLowerCase();

            // Lower case side and first char only
            const lowerCaseFirstCharSide_i = side_i!.charAt(0).toLowerCase();
            const lowerCaseFirstCharSide_j = side_j!.charAt(0).toLowerCase();

            // Lower case security
            const lowerCaseSecurity_i = security_i!.toLowerCase();
            const lowerCaseSecurity_j = security_j!.toLowerCase();

            // Lower case root
            const lowerCaseRoot_i = root_i!.toLowerCase();
            const lowerCaseRoot_j = root_j!.toLowerCase();

            // Lower case call/put
            const lowerCaseCallPut_i = callPut_i!.toLowerCase();
            const lowerCaseCallPut_j = callPut_j!.toLowerCase();

            // Lower case commission type
            const lowerCaseCommissionType_i = commissionType_i!.toLowerCase();
            const lowerCaseCommissionType_j = commissionType_j!.toLowerCase();

            // Remove all chars after first dash and lower case
            const subLowerCasePortfolio_i = portfolio_i
              ?.split("-")[0]
              .toLowerCase();
            const subLowerCasePortfolio_j = portfolio_j
              ?.split("-")[0]
              .toLowerCase();

            if (
              !removed_i &&
              !removed_j &&
              numberExecQty_i === numberExecQty_j * -1 &&
              numberTotalCharge_i === numberTotalCharge_j &&
              lowerCaseUser_i === lowerCaseUser_j &&
              date_i === date_j &&
              lowerCaseRoute_i === lowerCaseRoute_j &&
              lowerCaseFirstCharSide_i === lowerCaseFirstCharSide_j &&
              lowerCaseSecurity_i === lowerCaseSecurity_j &&
              lowerCaseRoot_i === lowerCaseRoot_j &&
              expiry_i === expiry_j &&
              strike_i === strike_j &&
              lowerCaseCallPut_i === lowerCaseCallPut_j &&
              averagePrice_i === averagePrice_j &&
              lowerCaseCommissionType_i === lowerCaseCommissionType_j &&
              subLowerCasePortfolio_i === subLowerCasePortfolio_j
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

      // Check if canceled inverse pairs WEX array separated by dates is valid
      if (!canceledInversePairsWEXArraySeparatedByDates) {
        ServerGlobal.getInstance().logger.error(
          "<addDerivatives>: Failed because canceled inverse pairs WEX array separated by dates is invalid",
        );

        res.status(400).send({
          success: false,
          message:
            "canceled inverse pairs WEX array separated by dates is invalid",
        });
        return;
      }

      ServerGlobal.getInstance().logger.info(
        `<addDerivatives>: Successfully separated canceled inverse pairs WEX array`,
      );

      const formatDate = (date: string) => {
        const WEXRowExpiryYear = date.substring(0, 4);
        const WEXRowExpiryMonth = date.substring(5, 7);
        const numberWEXRowExpiryMonth = parseInt(WEXRowExpiryMonth!, 10);
        const WEXRowExpiryDay = date.substring(8, 10);
        const numberWEXRowExpiryDay = parseInt(WEXRowExpiryDay!, 10);
        return (date = `${numberWEXRowExpiryMonth}/${numberWEXRowExpiryDay}/${WEXRowExpiryYear}`);
      };

      for (const date of uniqueDateWEXArray) {
        const filteredByDRV = canceledInversePairsWEXArraySeparatedByDates[
          date!
        ].filter(
          (WEXRow) =>
            !DRVArraySeparatedByDates[date!].find(
              ({
                date,
                side,
                symbol,
                expiry,
                strike,
                option,
                price,
                quantity,
              }) =>
                WEXRow.Date === date &&
                WEXRow.Side!.charAt(0).toLowerCase() ===
                  side!.charAt(0).toLowerCase() &&
                WEXRow.Root!.toLowerCase() === symbol!.toLowerCase() &&
                WEXRow["Call/Put"]?.charAt(0).toLowerCase() ===
                  option?.charAt(0).toLowerCase() &&
                Number(WEXRow["Exec Qty"]) === Number(quantity) &&
                Number(WEXRow["Average Price"]?.substring(1)).toFixed(2) ===
                  Number(price).toFixed(2) &&
                Number(WEXRow.Strike?.substring(1)) === Number(strike) &&
                formatDate(WEXRow.Expiry!) === expiry,
            ),
        );

        WEXArrayFilteredByDRV = WEXArrayFilteredByDRV.concat(filteredByDRV);
      }

      // Separate WEX array filtered by DRV result by date
      const WEXArrayFilteredByDRVSeparatedByDates: IWEXInterfaceObjectOfArrays =
        canceledInversePairsWEXArray.reduce((arr, WEX) => {
          arr[WEX.Date!] = arr[WEX.Date!] || [];
          arr[WEX.Date!].push(WEX);
          return arr;
        }, Object.create(null));

      // Check if WEX array filtered by DRV separated by dates is valid
      if (!WEXArrayFilteredByDRVSeparatedByDates) {
        ServerGlobal.getInstance().logger.error(
          "<addDerivatives>: Failed because WEX array filtered by DRV separated by dates is invalid",
        );

        res.status(400).send({
          success: false,
          message: "WEX array filtered by DRV separated by dates is invalid",
        });
        return;
      }

      // 1. Group by all conditions
      // 2. Sum quantity
      // 3. Average the average price
      // 4. check against terget
      // 5. delete all group if match

      for (const date of uniqueDateWEXArray) {
        // Run over each row in date
        for (let i = 0; i < WEXArraySeparatedByDates[date!].length; i++) {
          // Run over each row starting from the outer element's position
          for (let j = i + 1; j < WEXArraySeparatedByDates[date!].length; j++) {
            const {
              User: user_i,
              Date: date_i,
              Side: side_i,
              Security: security_i,
              Root: root_i,
              Expiry: expiry_i,
              Strike: strike_i,
              "Call/Put": callPut_i,
              Portfolio: portfolio_i,
              "Commission Type": commissionType_i,
              "Commission Rate": commissionRate_i,
            } = WEXArraySeparatedByDates[date!][i];
            const {
              User: user_j,
              Date: date_j,
              Side: side_j,
              Security: security_j,
              Root: root_j,
              Expiry: expiry_j,
              Strike: strike_j,
              "Call/Put": callPut_j,
              Portfolio: portfolio_j,
              "Commission Type": commissionType_j,
              "Commission Rate": commissionRate_j,
            } = WEXArraySeparatedByDates[date!][j];

            // Lower case user
            const lowerCaseUser_i = user_i!.toLowerCase();
            const lowerCaseUser_j = user_j!.toLowerCase();

            // Lower case side and first char only
            const lowerCaseFirstCharSide_i = side_i!.charAt(0).toLowerCase();
            const lowerCaseFirstCharSide_j = side_j!.charAt(0).toLowerCase();

            // Lower case security
            const lowerCaseSecurity_i = security_i!.toLowerCase();
            const lowerCaseSecurity_j = security_j!.toLowerCase();

            // Lower case root
            const lowerCaseRoot_i = root_i!.toLowerCase();
            const lowerCaseRoot_j = root_j!.toLowerCase();

            // Lower case call/put
            const lowerCaseCallPut_i = callPut_i!.toLowerCase();
            const lowerCaseCallPut_j = callPut_j!.toLowerCase();

            // Lower case commission type
            const lowerCaseCommissionType_i = commissionType_i!.toLowerCase();
            const lowerCaseCommissionType_j = commissionType_j!.toLowerCase();

            // Cast to number commission rate
            const numberCommissionRate_i = Number(commissionRate_i);
            const numberCommissionRate_j = Number(commissionRate_j);

            // Remove all chars after first dash and lower case
            const subLowerCasePortfolio_i = portfolio_i
              ?.split("-")[0]
              .toLowerCase();
            const subLowerCasePortfolio_j = portfolio_j
              ?.split("-")[0]
              .toLowerCase();

            if (
              lowerCaseUser_i === lowerCaseUser_j &&
              date_i === date_j &&
              lowerCaseFirstCharSide_i === lowerCaseFirstCharSide_j &&
              lowerCaseSecurity_i === lowerCaseSecurity_j &&
              lowerCaseRoot_i === lowerCaseRoot_j &&
              expiry_i === expiry_j &&
              strike_i === strike_j &&
              lowerCaseCallPut_i === lowerCaseCallPut_j &&
              lowerCaseCommissionType_i === lowerCaseCommissionType_j &&
              numberCommissionRate_i === numberCommissionRate_j &&
              subLowerCasePortfolio_i === subLowerCasePortfolio_j
            ) {
            }
          }
        }
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

        ServerGlobal.getInstance().logger.info(
          `<addDerivatives>: Successfully created the ${uid}FilteredWEXFile.csv to dir`,
        );
      });

      // Calculate matched rows
      const matchedRows = WEXArray.length - WEXArrayFilteredByDRV.length;

      // Calculate complete percentage
      const completePercentageRows = (matchedRows * 100) / WEXArray.length;

      // Find the user
      const userByID = await User.findByPk(req.user_id);

      if (!userByID) {
        ServerGlobal.getInstance().logger.error(
          `<editProfile>: Failed to get user details for user id ${req.user_id}`,
        );

        res.status(401).send({
          success: false,
          message: "Could not find user",
        });
        return;
      }

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
        username: userByID.username,
      });

      res.status(200).send({
        success: true,
        message: "Successfully added derivative",
      });
      return;
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

const getDerivative = async (
  req: IGetDerivativeRequest,
  res: IGetDerivativesResponse,
) => {
  ServerGlobal.getInstance().logger.info(
    `<getDerivative>: Start processing request`,
  );

  try {
    // Get derivatives
    const derivatives = await Derivative.findAll();

    // Check if derivatives are valid
    if (!derivatives) {
      ServerGlobal.getInstance().logger.error(
        "<getDerivative>: Failed to get derivatives",
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
