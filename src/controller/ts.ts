import fs from "fs";
import csv from "csv-parser";
import moment from "moment";
import converter from "json-2-csv";
import rp from "request-promise";

import ServerGlobal from "../server-global";

import User from "../model/user";
import Derivative from "../model/derivative";
import {
  IDASH,
  IDASHObject,
  IDASH,
  IDRV,
  IDRVObject,
  IReconciliationCharge,
  IWEX,
  IWEXObject,
  INVNReconciliationCharge
} from "../model/shared/derivatives";

import { removeCommas } from "../utils/derivatives";
import {
  DASHDateFormat,
  DASHGroupBy,
  DASHModifiyDollarSign,
  DASHModifiyTotalExchangeFees,
  DASHSeparateDatesObject,
  DASHUniqueDatesArray
} from "../utils/dash";
import {
  DASHDateFormat,
  DASHUniqueDatesArray,
  DASHSeparateDatesObject,
  DASHGroupBy,
  DASHModifiyTotalCharge,
  equalToOneGroupsDASH
} from "../utils/DASH";
import {
  WEXSeparateDatesObject,
  WEXUniqueDatesArray,
  WEXGroupBy,
  WEXDateFormat,
  WEXModifiyTotalCharge,
  WEXExpiryFormat
} from "../utils/wex";
import {
  DRVDateFormat,
  DRVSeparateDatesObject,
  DRVGroupBy,
  DRVUniqueDatesArray,
  DRVExpiryToMonthOnly,
  DRVExpiryToYearOnly,
  biggerThanOneGroupsDRV,
  equalToOneGroupsDRV
} from "../utils/drv";

import {
  IAddDerivativesRequest,
  IGetDerivativesRequest,
  IGetDerivativeRequest,
  IDownloadFilesRequest
} from "../model/express/request/derivatives";
import {
  IAddDerivativesResponse,
  IGetDerivativesResponse,
  IGetDerivativeResponse
} from "../model/express/response/derivatives";

import { log } from "console";

const addDerivatives = async (
  req: IAddDerivativesRequest,
  res: IAddDerivativesResponse
) => {
  ServerGlobal.getInstance().logger.info(
    `<addDerivatives>: Start processing request`
  );

  // Find user
  const userByID = await User.findByPk(req.user_id);

  if (!userByID) {
    ServerGlobal.getInstance().logger.error(
      `<editProfile>: Failed to get user details for user id ${req.user_id}`
    );

    res.status(401).send({
      success: false,
      message: "Could not find user"
    });
    return;
  }

  try {
    const currentDate = new Date();
    const formattedCurrentDate = moment(currentDate).format(
      "DD-MM-YYYY-HH-mm-ss"
    );

    const floorBrokerId = req.body.floorBrokerId.toString();
    let fileName = "";

    if (floorBrokerId === "6") {
      fileName = "Dash";
    } else if (floorBrokerId === "14") {
      fileName = "WEX";
    } else if (floorBrokerId === "23") {
      fileName = "Broadcort";
    } else {
      ServerGlobal.getInstance().logger.error(
        "<addDerivatives>: Failed because floorBrokerId is invalid"
      );

      res.status(400).send({
        success: false,
        message: "invalid floorBrokerId"
      });
      return;
    }

    const firstFile = req.body.files[0];
    const secondFile = req.body.files[1];

    let sourceBase64: string | undefined;
    let DRVBase64: string | undefined;

    // Checking files by ID
    if (firstFile.id === "source") {
      sourceBase64 = firstFile.file;
      DRVBase64 = secondFile.file;
    } else {
      sourceBase64 = secondFile.file;
      DRVBase64 = firstFile.file;
    }

    // Check if sourceBase64 or DRVBase64 are valid
    if (!sourceBase64 || !DRVBase64) {
      ServerGlobal.getInstance().logger.error(
        "<addDerivatives>: Failed to process base64WEX/base64DRV"
      );

      res.status(400).send({
        success: false,
        message: "invalid files"
      });
      return;
    }

    const sourceBase64Splited = sourceBase64.split(";base64,").pop();
    const DRVBase64Splited = DRVBase64.split(";base64,").pop();
    const sourceFileName = `assets/${fileName}-${userByID.username}-${formattedCurrentDate}.csv`;
    const DRVFileName = `assets/DRV-${userByID.username}-${formattedCurrentDate}.csv`;

    // Writing files to dir
    fs.writeFileSync(sourceFileName, sourceBase64Splited!, {
      encoding: "base64"
    });
    fs.writeFileSync(DRVFileName, DRVBase64Splited!, {
      encoding: "base64"
    });

    let source: IWEX[] | IDASH[] | IDASH[] = [];
    const DRV: IDRV[] = [];

    // Parsing csv file to JSON
    fs.createReadStream(sourceFileName)
      .pipe(csv())
      .on("data", (data: IWEX | IDASH | IDASH) => {
        source.push(data);
      });
    fs.createReadStream(DRVFileName)
      .pipe(csv())
      .on("data", (data: IDRV) => {
        DRV.push(data);
      })
      .on("end", () => {
        if (fileName === "Dash") {
          DASHActions();
        } else if (fileName === "WEX") {
          WEXActions();
        } else if (fileName === "Broadcort") {
          DASHActions();
        }
      });

    ServerGlobal.getInstance().logger.info(
      `<addDerivatives>: Successfully created the files to dir`
    );

    // var util = require("util");
    // fs.writeFileSync(
    //   "DASH.txt",
    //   util.inspect(reconciliation_charge, {
    //     showHidden: true,
    //     depth: null,
    //     maxArrayLength: null,
    //   }),
    // );

    const DASHActions = async () => {
      let DRVGroupedCalculated: IDRV[] = [];

      let DASHGroupedByDRV: IDASH[] = [];
      let DASHGroupedCalculated: IDASH[] = [];
      let DASHunresolved: IDASH[] = [];
      let DASH1V1Matched: IDASH[] = [];

      let reconciliation_charge: IReconciliationCharge[] = [];

      // Modifing DRV
      const DRVModified = DRV.map((element) => {
        const modifiedDate = DRVDateFormat(element.date!);
        const modifiedSide = element.side?.charAt(0).toLowerCase();
        const modifiedQuantity = Number(removeCommas(element.quantity!));
        const modifiedSymbol = element.symbol?.toLowerCase();
        const modifiedExpiry = DRVDateFormat(element.expiry!);
        const modifiedExpiryMonthOnly = DRVExpiryToMonthOnly(element.expiry!);
        const modifiedExpiryYearOnly = DRVExpiryToYearOnly(element.expiry!);
        const modifiedStrike = Number(removeCommas(element.strike));
        const modifiedOption = element.option?.charAt(0).toLowerCase();
        const modifiedPrice = Number(
          Number(removeCommas(element.price!)).toFixed(2)
        );

        return {
          ...element,
          modifiedDate,
          modifiedSide,
          modifiedQuantity,
          modifiedSymbol,
          modifiedExpiry,
          modifiedExpiryMonthOnly,
          modifiedExpiryYearOnly,
          modifiedStrike,
          modifiedOption,
          modifiedPrice
        };
      });

      // Modifing DASH
      const DASHModified = source.map((element: IDASH) => {
        const modifiedUser = element.USER?.toLowerCase();
        const modifiedExchange = element.EXCHANGE?.toLowerCase();
        const modifiedSymbol = element.SYMBOL?.toLowerCase();
        const modifiedExpiration = DASHDateFormat(element.EXPIRATION!);
        const modifiedDate = DASHDateFormat(element.DATE!);
        const modifiedBS = element["B/S"]?.toLowerCase();
        const modifiedStrike = DASHModifiyDollarSign(element.STRIKE!);
        const modifiedCP = element["C/P"]?.toLowerCase();
        const modifiedPremium = DASHModifiyDollarSign(element.PREMIUM!);
        const modifiedFilledQty = Number(removeCommas(element["FILLED QTY"]));
        const modifiedTotalExchangeFees = DASHModifiyTotalExchangeFees(
          element["TOTAL EXCHANGE FEES"]!
        );

        return {
          ...element,
          modifiedUser,
          modifiedExchange,
          modifiedSymbol,
          modifiedExpiration,
          modifiedDate,
          modifiedBS,
          modifiedStrike,
          modifiedCP,
          modifiedPremium,
          modifiedFilledQty,
          modifiedTotalExchangeFees
        };
      });

      const DRVSeparatedByDates = DRVSeparateDatesObject(DRVModified);

      // Grouping DASH by Trade Date, Exch, B/S, P/C, Class, Sym, Mo, Yr, Strike, O/C, CFM, Ex Brok
      const DASHGrouped = DASHGroupBy(DASHModified, (element: IDASH) => {
        return [
          element.modifiedUser,
          element.modifiedExchange,
          element.modifiedSymbol,
          element.modifiedExpiration
        ];
      });

      // Get DASH group keys
      const DASHGroupedKeys = Object.keys(DASHGrouped);

      // Sum filled qty, weight average premium and sum total exchange fees
      for (const key of DASHGroupedKeys) {
        let weightAverageQty = 0;
        let totalQty = 0;
        const result: IDASH[] = [
          ...DASHGrouped[key]
            .reduce((array, object) => {
              const key = `${object.USER}-${object.EXCHANGE}-${object.SYMBOL}-${object.EXPIRATION}`;
              const item: IDASH =
                array.get(key) ||
                Object.assign({}, object, {
                  modifiedFilledQty: 0,
                  modifiedPremium: 0,
                  modifiedTotalExchangeFees: 0,
                  groupsSeparated: []
                });

              // Get reconciliation charge fields
              item.groupsSeparated = [...item.groupsSeparated!, object];

              // Sum filled qty
              item.modifiedFilledQty =
                item.modifiedFilledQty! + object.modifiedFilledQty!;

              // Weight average price
              const curWeightAverageQty =
                object.modifiedFilledQty! * object.modifiedPremium!;

              weightAverageQty += curWeightAverageQty;
              totalQty += object.modifiedFilledQty!;

              item.modifiedPremium =
                Math.round(
                  (weightAverageQty / totalQty + Number.EPSILON) * 100
                ) / 100;

              // Sum total exchange fees
              item.modifiedTotalExchangeFees = Number(
                (
                  item.modifiedTotalExchangeFees! +
                  object.modifiedTotalExchangeFees!
                ).toFixed(2)
              );

              return array.set(key, item);
            }, new Map())
            .values()
        ];

        DASHGroupedCalculated = DASHGroupedCalculated.concat(result);
      }

      // Grouping DRV by drv_trade_id, floor_broker, date, side, component_type, contract_type, symbol, expiry, strike, option, client_id
      const DRVGrouped = DRVGroupBy(DRVModified, (element: IDRV) => {
        return [
          element.drv_trade_id,
          element.floor_broker,
          element.modifiedDate,
          element.modifiedSide,
          element.component_type,
          element.contract_type,
          element.modifiedSymbol,
          element.modifiedExpiry,
          element.modifiedStrike,
          element.modifiedOption,
          element.client_id
        ];
      });

      // Get DRV group keys
      const DRVGroupKeys = Object.keys(DRVGrouped);

      // Sum quantity, weight average price
      for (const key of DRVGroupKeys) {
        let weightAverageExecQty = 0;
        let totalExecQty = 0;
        const result: IDRV[] = [
          ...DRVGrouped[key]
            .reduce((array, object) => {
              const key = `${object.drv_trade_id}-${object.floor_broker}-${object.modifiedDate}-${object.modifiedSide}-${object.component_type}-${object.contract_type}-${object.modifiedSymbol}-${object.modifiedExpiry}-${object.modifiedStrike}-${object.modifiedOption}-${object.client_id}`;
              const item: IDRV =
                array.get(key) ||
                Object.assign({}, object, {
                  modifiedQuantity: 0,
                  modifiedPrice: 0,
                  reconciliationCharge: []
                });

              // Get reconciliation charge fields
              item.reconciliationCharge = [
                ...item.reconciliationCharge!,
                {
                  drv_trade_client_account_execution_id:
                    object.drv_trade_client_account_execution_id,
                  quantity: object.modifiedQuantity
                }
              ];

              // Sum qty
              item.modifiedQuantity =
                item.modifiedQuantity! + object.modifiedQuantity!;

              // Weight average price
              const curWeightAverageExecQty =
                object.modifiedQuantity! * object.modifiedPrice!;

              weightAverageExecQty += curWeightAverageExecQty;
              totalExecQty += object.modifiedQuantity!;

              item.modifiedPrice =
                Math.round(
                  (weightAverageExecQty / totalExecQty + Number.EPSILON) * 100
                ) / 100;

              return array.set(key, item);
            }, new Map())
            .values()
        ];

        DRVGroupedCalculated = DRVGroupedCalculated.concat(result);
      }

      let DASHByDRVGroupedMatched: IDASH[] = [];
      let DASHByDRVGrouped: IDASH[] = [];

      const map = new Map(
        DRVGroupedCalculated.map(
          ({
            modifiedDate,
            modifiedSide,
            modifiedSymbol,
            modifiedStrike,
            modifiedExpiry,
            modifiedOption,
            modifiedPrice,
            modifiedQuantity,
            reconciliationCharge
          }) => [
            modifiedDate +
              "/" +
              modifiedSide +
              "/" +
              modifiedSymbol +
              "/" +
              modifiedOption +
              "/" +
              modifiedQuantity +
              "/" +
              modifiedPrice +
              "/" +
              modifiedStrike +
              "/" +
              modifiedExpiryMonthOnly +
              "/" +
              modifiedExpiryYearOnly,
            reconciliationCharge
          ]
        )
      );

      for (const object of DASHGroupedCalculated) {
        const match = map.get(
          object.modifiedTradeDate +
            "/" +
            object.modifiedBS +
            "/" +
            object.modifiedSym +
            "/" +
            object.modifiedPC +
            "/" +
            object.modifiedQty +
            "/" +
            object.modifiedPrice +
            "/" +
            object.modifiedStrike +
            "/" +
            object.Mo +
            "/" +
            object.Yr
        );

        if (match) {
          object.reconciliationCharge = match;
          DASHByDRVGroupedMatched.push(object);
        } else {
          DASHByDRVGrouped.push(object);
        }
      }

      const result2 = DASHByDRVGroupedMatched.map(
        ({ groupsSeparated }) => groupsSeparated!
      ).flat();

      // Return reconciliation charge, total charge and exec qty
      const DASHReconciliationChargesNVNAndNV1: INVNReconciliationCharge[] =
        DASHByDRVGroupedMatched.map((object) => {
          return {
            drvId: object.drv_trade_client_account_execution_id,
            reconciliationCharge: object.reconciliationCharge,
            totalCharge: object.modifiedTotalCharges,
            execQtySum: object.modifiedQty
          };
        });

      // Get matched N V N rows object
      const matchedNVNAndNV1: IReconciliationCharge[] =
        DASHReconciliationChargesNVNAndNV1.map(
          ({ reconciliationCharge, totalCharge, execQtySum }) => {
            const quantity = reconciliationCharge!.map((e) => e.quantity);

            if (quantity.length === 1) {
              return reconciliationCharge!.map(
                ({ drv_trade_client_account_execution_id }) => ({
                  drv_trade_floor_broker_id: floorBrokerId,
                  drv_trade_client_account_execution_id:
                    drv_trade_client_account_execution_id,
                  charge: totalCharge
                })
              );
            } else {
              return reconciliationCharge!.map(
                ({ drv_trade_client_account_execution_id, quantity }) => ({
                  drv_trade_floor_broker_id: floorBrokerId,
                  drv_trade_client_account_execution_id:
                    drv_trade_client_account_execution_id,
                  charge: (totalCharge! * quantity!) / execQtySum!
                })
              );
            }
          }
        ).flat();

      // Get DASH unmatched rows by group DASH
      const DASHByDRVGroup = DASHModified.filter((row) =>
        DASHByDRVGrouped.find(
          ({
            modifiedTradeDate,
            modifiedBS,
            modifiedSym,
            modifiedPC,
            modifiedQty,
            modifiedPrice,
            modifiedStrike,
            Mo,
            Yr
          }) =>
            row.modifiedTradeDate === modifiedTradeDate &&
            row.modifiedBS === modifiedBS &&
            row.modifiedSym === modifiedSym &&
            row.modifiedPC === modifiedPC &&
            row.modifiedQty === modifiedQty &&
            row.modifiedPrice === modifiedPrice &&
            row.modifiedStrike === modifiedStrike &&
            row.Mo === Mo &&
            row.Yr === Yr
        )
      );

      const DASHVDRVUniqueDates = DASHUniqueDatesArray(DASHByDRVGroup);
      const DASHVDRVSeparatedByDates = DASHSeparateDatesObject(DASHByDRVGroup);

      // Group DASH V 1 DRV
      for (const date of DASHVDRVUniqueDates) {
        // Check if date is valid
        if (!date) {
          ServerGlobal.getInstance().logger.error(
            "<addDerivatives>: Failed because date is invalid"
          );

          res.status(400).send({
            success: false,
            message: "date is invalid"
          });
          return;
        }

        const DASHUnmatched = DASHVDRVSeparatedByDates[date].filter(
          (row) =>
            !DRVSeparatedByDates[date].find(
              ({
                modifiedDate,
                modifiedSide,
                modifiedSymbol,
                modifiedStrike,
                modifiedOption,
                modifiedPrice,
                modifiedQuantity,
                modifiedExpiryMonthOnly,
                modifiedExpiryYearOnly
              }) =>
                row.modifiedTradeDate === modifiedDate &&
                row.modifiedBS === modifiedSide &&
                row.modifiedSym === modifiedSymbol &&
                row.modifiedPC === modifiedOption &&
                row.modifiedQty === modifiedQuantity &&
                row.modifiedPrice === modifiedPrice &&
                row.modifiedStrike === modifiedStrike &&
                row.Mo === modifiedExpiryMonthOnly &&
                row.Yr === modifiedExpiryYearOnly
            )
        );

        const DASHMatched = DASHVDRVSeparatedByDates[date].filter((row) =>
          DRVSeparatedByDates[date].find(
            ({
              modifiedDate,
              modifiedSide,
              modifiedSymbol,
              modifiedStrike,
              modifiedOption,
              modifiedPrice,
              modifiedQuantity,
              modifiedExpiryMonthOnly,
              modifiedExpiryYearOnly,
              drv_trade_client_account_execution_id
            }) => {
              row.drv_trade_client_account_execution_id =
                drv_trade_client_account_execution_id;
              return (
                row.modifiedTradeDate === modifiedDate &&
                row.modifiedBS === modifiedSide &&
                row.modifiedSym === modifiedSymbol &&
                row.modifiedPC === modifiedOption &&
                row.modifiedQty === modifiedQuantity &&
                row.modifiedPrice === modifiedPrice &&
                row.modifiedStrike === modifiedStrike &&
                row.Mo === modifiedExpiryMonthOnly &&
                row.Yr === modifiedExpiryYearOnly
              );
            }
          )
        );

        DASHGroupedByDRV = DASHGroupedByDRV.concat(DASHUnmatched);

        DASH1V1Matched = DASH1V1Matched.concat(DASHMatched);
      }

      // Get matched rows object
      const matched1V1: IReconciliationCharge[] = DASH1V1Matched.map(
        ({ drv_trade_client_account_execution_id, modifiedTotalCharges }) => {
          return {
            drv_trade_floor_broker_id: floorBrokerId,
            drv_trade_client_account_execution_id,
            charge: modifiedTotalCharges
          };
        }
      );

      const DASHGroupedByDASH = DASHByDRVGroup.filter((row) =>
        DASHGroupedByDRV.find(
          ({
            modifiedTradeDate,
            modifiedBS,
            modifiedSym,
            modifiedPC,
            modifiedQty,
            modifiedPrice,
            modifiedStrike,
            Mo,
            Yr
          }) =>
            row.modifiedTradeDate === modifiedTradeDate &&
            row.modifiedBS === modifiedBS &&
            row.modifiedSym === modifiedSym &&
            row.modifiedPC === modifiedPC &&
            row.modifiedQty === modifiedQty &&
            row.modifiedPrice === modifiedPrice &&
            row.modifiedStrike === modifiedStrike &&
            row.Mo === Mo &&
            row.Yr === Yr
        )
      );

      const DASHByGroupedDASHUniqueDates =
        DASHUniqueDatesArray(DASHGroupedByDASH);
      const DASHByGroupedDASHSeparatedByDates =
        DASHSeparateDatesObject(DASHGroupedByDASH);

      // 1 DASH V 1 DRV
      for (const date of DASHByGroupedDASHUniqueDates) {
        // Check if date is valid
        if (!date) {
          ServerGlobal.getInstance().logger.error(
            "<addDerivatives>: Failed because date is invalid"
          );

          res.status(400).send({
            success: false,
            message: "date is invalid"
          });
          return;
        }

        const DASHUnmatched = DASHByGroupedDASHSeparatedByDates[date].filter(
          (row) =>
            !DRVSeparatedByDates[date].find(
              ({
                modifiedDate,
                modifiedSide,
                modifiedSymbol,
                modifiedStrike,
                modifiedOption,
                modifiedPrice,
                modifiedQuantity,
                modifiedExpiryMonthOnly,
                modifiedExpiryYearOnly
              }) =>
                row.modifiedTradeDate === modifiedDate &&
                row.modifiedBS === modifiedSide &&
                row.modifiedSym === modifiedSymbol &&
                row.modifiedPC === modifiedOption &&
                row.modifiedQty === modifiedQuantity &&
                row.modifiedPrice === modifiedPrice &&
                row.modifiedStrike === modifiedStrike &&
                row.Mo === modifiedExpiryMonthOnly &&
                row.Yr === modifiedExpiryYearOnly
            )
        );

        DASHunresolved = DASHunresolved.concat(DASHUnmatched);
      }

      // Concating matched objects
      reconciliation_charge = reconciliation_charge.concat(
        matchedNVNAndNV1,
        matched1V1
      );

      // // POST request to makor-X API
      // const options = {
      //   method: "POST",
      //   uri: `${process.env.MAKOR_X_URL}${process.env.MAKOR_X_API_KEY}`,
      //   body: {
      //     reconciliation_charge,
      //   },
      //   json: true,
      // };
      // rp(options)
      //   .then(() => {
      //     ServerGlobal.getInstance().logger.error(
      //       "<addDerivatives>: Successfully sent reconciliation_charge to makor-x API",
      //     );
      //   })
      //   .catch(() => {
      //     ServerGlobal.getInstance().logger.error(
      //       "<addDerivatives>: Falied to send the reconciliation_charge to makor-x API",
      //     );
      //   });

      // Total charge
      const totalCharge = DASHModified.reduce(
        (a, b) => a + (b.modifiedTotalCharges || 0),
        0
      );

      // Unmatched charge
      const unmatchedCharge = DASHunresolved.reduce(
        (prev, { modifiedTotalCharges }) => prev + modifiedTotalCharges!,
        0
      );

      // Matched Sum Charge
      const matchedSumCharge = totalCharge - unmatchedCharge;

      // Unmatched Sum Charge
      const unmatchedSumCharge = totalCharge - matchedSumCharge;

      // Matched count
      const matchedCount = DASHModified.length - DASHunresolved.length;

      // matched Sum Percentage
      const matchedSumPercentage = (matchedCount * 100) / DASHModified.length;

      // unmatched Sum Percentage
      const unmatchedSumPercentage = (unmatchedSumCharge / totalCharge) * 100;

      // Delete all modified fields
      DASHunresolved.forEach((element) => {
        delete element.modifiedTradeDate;
        delete element.modifiedExch;
        delete element.modifiedBS;
        delete element.modifiedPC;
        delete element.modifiedClass;
        delete element.modifiedSym;
        delete element.modifiedStrike;
        delete element.modifiedPrice;
        delete element.modifiedQty;
        delete element.modifiedOC;
        delete element.modifiedCFM;
        delete element.modifiedExBrok;
        delete element.modifiedTotalCharges;
        delete element.drv_trade_client_account_execution_id;
        delete element.reconciliationCharge;
      });

      // Convert JSON to CSV file
      converter.json2csv(result2, (err, csv) => {
        if (err) {
          ServerGlobal.getInstance().logger.info(
            `<addDerivatives>: Failed to convert file to csv because of error: ${err}`
          );

          res.status(400).send({
            success: false,
            message: "Failed to convert file to csv"
          });
          return;
        }

        if (!csv) {
          ServerGlobal.getInstance().logger.info(
            "<addDerivatives>: Failed to convert file to csv"
          );

          res.status(400).send({
            success: false,
            message: "Failed to convert file to csv"
          });
          return;
        }

        fs.writeFileSync(
          `assets/unresolved-${userByID.username}-${formattedCurrentDate}.csv`,
          csv
        );

        ServerGlobal.getInstance().logger.info(
          `<addDerivatives>: Successfully created the unresolved-${userByID.username}-${formattedCurrentDate}.csv to dir`
        );
      });

      // Saving the derivative document in DB
      await Derivative.create({
        date: formattedCurrentDate,
        floorBrokerId: floorBrokerId,
        username: userByID.username,
        source: `${fileName}-${userByID.username}-${formattedCurrentDate}.csv`,
        drv: `DRV-${userByID.username}-${formattedCurrentDate}.csv`,
        totalCount: DASHModified.length,
        totalCharge: totalCharge,
        matchedCount: matchedCount,
        matchSumCharge: matchedSumCharge,
        matchedSumPercentage: matchedSumPercentage,
        unmatchedCount: DASHunresolved.length,
        unmatchedGroupCount: DASHByDRVGrouped.length,
        unmatchedSumCharge: unmatchedSumCharge,
        unmatchedSumPercentage: unmatchedSumPercentage,
        unresolved: `unresolved-${userByID.username}-${formattedCurrentDate}.csv`
      });

      res.status(200).send({
        success: true,
        message: "Successfully added derivative"
      });
      return;
    };
  } catch (e) {
    ServerGlobal.getInstance().logger.error(
      `<addDerivatives>: Failed to add derivatives data because of server error: ${e}`
    );

    res.status(500).send({
      success: false,
      message: "Server error"
    });
    return;
  }
};
