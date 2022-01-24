import fs from "fs";
import csv from "csv-parser";
import util from "util";
import moment from "moment";
import converter from "json-2-csv";
import rp from "request-promise";

import ServerGlobal from "../server-global";

import User from "../model/user";
import Derivative from "../model/derivative";
import {
  IDRV,
  IWEX,
  IBAML,
  IDASH,
  IReconciliationCharge,
  INVNReconciliationCharge
} from "../model/shared/derivatives";

import { removeCommas, separateGroups } from "../utils/derivatives";
import {
  DASHDateFormat,
  DASHGroupBy,
  DASHModifiyDollarSign,
  DASHModifiyTotalCharge,
  DASHSeparateDatesObject,
  DASHUniqueDatesArray
} from "../utils/dash";
import {
  BAMLDateFormat,
  BAMLUniqueDatesArray,
  BAMLSeparateDatesObject,
  BAMLGroupBy,
  BAMLModifiyTotalCharge
} from "../utils/baml";
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
  DRVExpiryToMonthOnly,
  DRVExpiryToYearOnly,
  biggerThanOneGroupsDRV,
  equalToOneGroupsDRV
} from "../utils/drv";

import {
  IAddDerivativesRequest,
  IGetDerivativesRequest,
  IGetDerivativeRequest,
  IDownloadFileRequest
} from "../model/express/request/derivatives";
import {
  IAddDerivativesResponse,
  IGetDerivativesResponse,
  IGetDerivativeResponse,
  IDownloadFileResponse
} from "../model/express/response/derivatives";

import { log } from "console";

const addDerivatives = async (
  req: IAddDerivativesRequest,
  res: IAddDerivativesResponse
) => {
  ServerGlobal.getInstance().logger.info(
    `<addDerivatives>: Start processing request`
  );

  // Find user by ID
  const userByID = await User.findByPk(req.userId);

  if (!userByID) {
    ServerGlobal.getInstance().logger.error(
      `<editProfile>: Failed to get user details for user id ${req.userId}`
    );

    res.status(401).send({
      success: false,
      message: "Could not find user"
    });
    return;
  }

  try {
    const formattedCurrentDate = moment(new Date()).format(
      "DD-MM-YYYY-HH-mm-ss"
    );
    const floorBrokerId = req.body.floorBrokerId.toString();

    let fileName = "";

    // Assigning file name
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

    // Validate files
    if (!firstFile.file || !secondFile.file) {
      ServerGlobal.getInstance().logger.error(
        "<[WEX] addDerivatives>: Failed because files are invalid"
      );

      res.status(400).send({
        success: false,
        message: "invalid files"
      });
      return;
    }

    let sourceBase64: string;
    let DRVBase64: string | undefined;

    // Assigning files by ID
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
        "<addDerivatives>: Failed to process sourceBase64/DRVBase64"
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

    let source: IWEX[] | IBAML[] | IDASH[] = [];
    const DRV: IDRV[] = [];

    // Parsing csv file to JSON
    fs.createReadStream(sourceFileName)
      .pipe(csv())
      .on("data", (data: IWEX | IBAML | IDASH) => {
        source.push(data);
      });
    fs.createReadStream(DRVFileName)
      .pipe(csv())
      .on("data", (data: IDRV) => {
        DRV.push(data);
      })
      .on("end", () => {
        if (fileName === "Dash") {
          // DASHActions();
        } else if (fileName === "WEX") {
          WEXActions();
        } else {
          // BAMLActions();
        }
      });

    ServerGlobal.getInstance().logger.info(
      `<addDerivatives>: Successfully created the files to dir`
    );

    // const util = require("util");
    // fs.writeFileSync(
    //   "baml.txt",
    //   util.inspect(reconciliation_charge, {
    //     showHidden: true,
    //     depth: null,
    //     maxArrayLength: null,
    //   }),
    // );

    /** 
    const DASHActions = async () => {
      let DASHGroupedMatched: IDASH[] = [];
      let DASHGroupedUnmatched: IDASH[] = [];

      let DRVGroupedMatched: IDRV[] = [];

      let DRVGroupedCalculated: IDRV[] = [];
      let DRVUniqueCalculated: IDRV[] = [];

      let DASHGroupedCalculated: IDASH[] = [];
      let DASHUniqueCalculated: IDASH[] = [];

      let DASHGroupedByDRV: IDASH[] = [];
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
        const modifiedBS = element["B/S"]?.charAt(0).toLowerCase();
        const modifiedStrike = DASHModifiyDollarSign(element.STRIKE!);
        const modifiedCP = element["C/P"]?.toLowerCase();
        const modifiedPremium = DASHModifiyDollarSign(element.PREMIUM!);
        const modifiedFilledQty = Number(removeCommas(element["FILLED QTY"]));
        const modifiedTotalExchangeFees = DASHModifiyTotalCharge(
          element["TOTAL EXCHANGE FEES"]!
        );
        const modifiedBPCR$ = DASHModifiyTotalCharge(element.BPCR$!);
        const totalCharge = modifiedTotalExchangeFees + modifiedBPCR$;

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
          modifiedTotalExchangeFees,
          modifiedBPCR$,
          totalCharge
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
                  totalCharge: 0,
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

              // Sum total charge
              item.totalCharge = Number(
                (item.totalCharge! + object.totalCharge!).toFixed(2)
              );

              return array.set(key, item);
            }, new Map())
            .values()
        ];

        if (DASHGrouped[key].length === 1) {
          DASHUniqueCalculated = DASHUniqueCalculated.concat(result);
        } else {
          DASHGroupedCalculated = DASHGroupedCalculated.concat(result);
        }
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
                  reconciliationCharge: [],
                  groupsSeparated: []
                });

              // Get reconciliation charge fields
              item.groupsSeparated = [...item.groupsSeparated!, object];

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

        if (DRVGrouped[key].length === 1) {
          DRVUniqueCalculated = DRVUniqueCalculated.concat(result);
        } else {
          DRVGroupedCalculated = DRVGroupedCalculated.concat(result);
        }
      }

      const DRVGroupedCalculatedKey = DRVGroupedCalculated.map(
        ({
          modifiedDate,
          modifiedSide,
          modifiedSymbol,
          modifiedStrike,
          modifiedExpiry,
          modifiedOption,
          modifiedPrice,
          modifiedQuantity
        }) =>
          modifiedDate +
          "|" +
          modifiedSide +
          "|" +
          modifiedSymbol +
          "|" +
          modifiedStrike +
          "|" +
          modifiedExpiry +
          "|" +
          modifiedOption +
          "|" +
          modifiedPrice +
          "|" +
          modifiedQuantity
      );

      for (const object of DASHGroupedCalculated) {
        const string =
          object.modifiedDate +
          "|" +
          object.modifiedBS +
          "|" +
          object.modifiedSymbol +
          "|" +
          object.modifiedStrike +
          "|" +
          object.modifiedExpiration +
          "|" +
          object.modifiedCP +
          "|" +
          object.modifiedPremium +
          "|" +
          object.modifiedFilledQty;

        const match = DRVGroupedCalculatedKey.indexOf(string);

        if (match >= 0) {
          const reconciliationCharge = DRVGroupedCalculated.splice(match, 1)
            .map((e) => e.reconciliationCharge)
            .flat();
          log("hey: " + JSON.stringify(reconciliationCharge));
          // object.reconciliationCharge = reconciliationCharge;
          DASHGroupedMatched.push(object);
          DRVGroupedMatched.push(...DRVGroupedCalculated.splice(match, 1));
        } else {
          DASHGroupedUnmatched.push(object);
        }
      }

      const DRVGroupedUnmatched = DRVGroupedCalculated;

      log("drv match: " + DRVGroupedMatched.length);
      log("dash match: " + DASHGroupedMatched.length);

      log("drv unmatch: " + DRVGroupedUnmatched.length);
      log("dash unmatch: " + DASHGroupedUnmatched.length);

      // Return reconciliation charge, total charge and exec qty
      const DASHReconciliationCharge: INVNReconciliationCharge[] =
        DASHGroupedMatched.map((object) => {
          return {
            drvId: object.drv_trade_client_account_execution_id,
            reconciliationCharge: object.reconciliationCharge,
            totalCharge: object.totalCharge,
            execQtySum: object.modifiedFilledQty
          };
        });

      // Get matched N V N rows object
      const matchedNVNAndNV1: IReconciliationCharge[] =
        DASHReconciliationCharge.map(
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
        DASHGroupedUnmatched.find(
          ({
            modifiedDate,
            modifiedBS,
            modifiedSymbol,
            modifiedStrike,
            modifiedExpiration,
            modifiedCP,
            modifiedPremium,
            modifiedFilledQty
          }) =>
            row.modifiedDate === modifiedDate &&
            row.modifiedBS === modifiedBS &&
            row.modifiedSymbol === modifiedSymbol &&
            row.modifiedStrike === modifiedStrike &&
            row.modifiedExpiration === modifiedExpiration &&
            row.modifiedCP === modifiedCP &&
            row.modifiedPremium === modifiedPremium &&
            row.modifiedFilledQty === modifiedFilledQty
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
                modifiedExpiry,
                modifiedOption,
                modifiedPrice,
                modifiedQuantity
              }) =>
                row.modifiedDate === modifiedDate &&
                row.modifiedBS === modifiedSide &&
                row.modifiedSymbol === modifiedSymbol &&
                row.modifiedStrike === modifiedStrike &&
                row.modifiedExpiration === modifiedExpiry &&
                row.modifiedCP === modifiedOption &&
                row.modifiedPremium === modifiedPrice &&
                row.modifiedFilledQty === modifiedQuantity
            )
        );

        const DASHMatched = DASHVDRVSeparatedByDates[date].filter((row) =>
          DRVSeparatedByDates[date].find(
            ({
              modifiedDate,
              modifiedSide,
              modifiedSymbol,
              modifiedStrike,
              modifiedExpiry,
              modifiedOption,
              modifiedPrice,
              modifiedQuantity,
              drv_trade_client_account_execution_id
            }) => {
              row.drv_trade_client_account_execution_id =
                drv_trade_client_account_execution_id;
              return (
                row.modifiedDate === modifiedDate &&
                row.modifiedBS === modifiedSide &&
                row.modifiedSymbol === modifiedSymbol &&
                row.modifiedStrike === modifiedStrike &&
                row.modifiedExpiration === modifiedExpiry &&
                row.modifiedCP === modifiedOption &&
                row.modifiedPremium === modifiedPrice &&
                row.modifiedFilledQty === modifiedQuantity
              );
            }
          )
        );

        DASHGroupedByDRV = DASHGroupedByDRV.concat(DASHUnmatched);

        DASH1V1Matched = DASH1V1Matched.concat(DASHMatched);
      }

      // Get matched rows object
      const matched1V1: IReconciliationCharge[] = DASH1V1Matched.map(
        ({
          drv_trade_client_account_execution_id,
          modifiedTotalExchangeFees
        }) => {
          return {
            drv_trade_floor_broker_id: floorBrokerId,
            drv_trade_client_account_execution_id,
            charge: modifiedTotalExchangeFees
          };
        }
      );

      const DASHGroupedByDASH = DASHByDRVGroup.filter((row) =>
        DASHGroupedByDRV.find(
          ({
            modifiedDate,
            modifiedBS,
            modifiedSymbol,
            modifiedStrike,
            modifiedExpiration,
            modifiedCP,
            modifiedPremium,
            modifiedFilledQty
          }) =>
            row.modifiedDate === modifiedDate &&
            row.modifiedBS === modifiedBS &&
            row.modifiedSymbol === modifiedSymbol &&
            row.modifiedStrike === modifiedStrike &&
            row.modifiedExpiration === modifiedExpiration &&
            row.modifiedCP === modifiedCP &&
            row.modifiedPremium === modifiedPremium &&
            row.modifiedFilledQty === modifiedFilledQty
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
                modifiedExpiry,
                modifiedOption,
                modifiedPrice,
                modifiedQuantity
              }) =>
                row.modifiedDate === modifiedDate &&
                row.modifiedBS === modifiedSide &&
                row.modifiedSymbol === modifiedSymbol &&
                row.modifiedStrike === modifiedStrike &&
                row.modifiedExpiration === modifiedExpiry &&
                row.modifiedCP === modifiedOption &&
                row.modifiedPremium === modifiedPrice &&
                row.modifiedFilledQty === modifiedQuantity
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
        (a, b) => a + (b.totalCharge || 0),
        0
      );

      // Unmatched charge
      const unmatchedCharge = DASHunresolved.reduce(
        (prev, { totalCharge }) => prev + totalCharge!,
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
        delete element.modifiedUser;
        delete element.modifiedExchange;
        delete element.modifiedSymbol;
        delete element.modifiedExpiration;
        delete element.modifiedDate;
        delete element.modifiedBS;
        delete element.modifiedStrike;
        delete element.modifiedCP;
        delete element.modifiedPremium;
        delete element.modifiedFilledQty;
        delete element.modifiedTotalExchangeFees;
        delete element.modifiedBPCR$;
        delete element.totalCharge;
        delete element.drv_trade_client_account_execution_id;
        delete element.quantitySum;
        delete element.drv_trade_client_account_execution_id;
        delete element.reconciliationCharge;
      });

      // Convert JSON to CSV file
      converter.json2csv(DASHunresolved, (err, csv) => {
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
        unmatchedGroupCount: DASHGroupedUnmatched.length,
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

    const BAMLActions = async () => {
      let DRVGroupedCalculated: IDRV[] = [];

      let BAMLGroupedByDRV: IBAML[] = [];
      let BAMLGroupedCalculated: IBAML[] = [];
      let BAMLunresolved: IBAML[] = [];
      let BAML1V1Matched: IBAML[] = [];

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

      // Modifing BAML
      const BAMLModified = source.map((element: IBAML) => {
        const modifiedTradeDate = BAMLDateFormat(element["Trade Date"]!);
        const modifiedExch = element.Exch?.toLowerCase();
        const modifiedBS = element["B/S"]?.toLowerCase();
        const modifiedPC = element["P/C"]?.toLowerCase();
        const modifiedClass = element.Class?.toLowerCase();
        const modifiedSym = element.Sym?.toLowerCase();
        const modifiedStrike = Number(removeCommas(element.Strike));
        const modifiedPrice = Number(
          Number(removeCommas(element.Price)).toFixed(2)
        );
        const modifiedQty = Number(removeCommas(element.Qty!));
        const modifiedOC = element["O/C"]?.toLowerCase();
        const modifiedCFM = element.CFM?.toLowerCase();
        const modifiedExBrok = element["Ex Brok"]?.toLowerCase();
        const modifiedTotalCharges = Number(
          BAMLModifiyTotalCharge(
            removeCommas(element["Total Charges"])!.toString()
          )
        );

        return {
          ...element,
          modifiedTradeDate,
          modifiedExch,
          modifiedBS,
          modifiedPC,
          modifiedClass,
          modifiedSym,
          modifiedStrike,
          modifiedPrice,
          modifiedQty,
          modifiedOC,
          modifiedCFM,
          modifiedExBrok,
          modifiedTotalCharges
        };
      });

      const DRVSeparatedByDates = DRVSeparateDatesObject(DRVModified);

      // Grouping BAML by Trade Date, Exch, B/S, P/C, Class, Sym, Mo, Yr, Strike, O/C, CFM, Ex Brok
      const BAMLGrouped = BAMLGroupBy(BAMLModified, (element: IBAML) => {
        return [
          element.modifiedTradeDate,
          element.modifiedExch,
          element.modifiedBS,
          element.modifiedPC,
          element.modifiedClass,
          element.modifiedSym,
          element.Mo,
          element.Yr,
          element.modifiedStrike,
          element.modifiedOC,
          element.modifiedCFM,
          element.modifiedExBrok
        ];
      });

      // Get BAML group keys
      const BAMLGroupedKeys = Object.keys(BAMLGrouped);

      // Sum exec qty, weight average price and sum total charges
      for (const key of BAMLGroupedKeys) {
        let weightAverageQty = 0;
        let totalQty = 0;
        const result: IBAML[] = [
          ...BAMLGrouped[key]
            .reduce((array, object) => {
              const key = `${object.modifiedTradeDate}-${object.modifiedExch}-${object.modifiedBS}-${object.modifiedPC}-${object.modifiedClass}-${object.modifiedSym}-${object.Mo}-${object.Yr}-${object.modifiedStrike}-${object.modifiedOC}-${object.modifiedCFM}-${object.modifiedExBrok}`;
              const item: IBAML =
                array.get(key) ||
                Object.assign({}, object, {
                  modifiedQty: 0,
                  modifiedPrice: 0,
                  modifiedTotalCharges: 0,
                  groupsSeparated: []
                });

              // Get reconciliation charge fields
              item.groupsSeparated = [...item.groupsSeparated!, object];

              // Sum qty
              item.modifiedQty = item.modifiedQty! + object.modifiedQty!;

              // Weight average price
              const curWeightAverageQty =
                object.modifiedQty! * object.modifiedPrice!;

              weightAverageQty += curWeightAverageQty;
              totalQty += object.modifiedQty!;

              item.modifiedPrice =
                Math.round(
                  (weightAverageQty / totalQty + Number.EPSILON) * 100
                ) / 100;

              // Sum total charges
              item.modifiedTotalCharges = Number(
                (
                  item.modifiedTotalCharges! + object.modifiedTotalCharges!
                ).toFixed(2)
              );

              return array.set(key, item);
            }, new Map())
            .values()
        ];

        BAMLGroupedCalculated = BAMLGroupedCalculated.concat(result);
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

      let BAMLByDRVGroupedMatched: IBAML[] = [];
      let BAMLByDRVGrouped: IBAML[] = [];

      const map = new Map(
        DRVGroupedCalculated.map(
          ({
            modifiedDate,
            modifiedSide,
            modifiedSymbol,
            modifiedOption,
            modifiedQuantity,
            modifiedPrice,
            modifiedStrike,
            modifiedExpiryMonthOnly,
            modifiedExpiryYearOnly,
            reconciliationCharge
          }) => [
            modifiedDate +
              "|" +
              modifiedSide +
              "|" +
              modifiedSymbol +
              "|" +
              modifiedOption +
              "|" +
              modifiedQuantity +
              "|" +
              modifiedPrice +
              "|" +
              modifiedStrike +
              "|" +
              modifiedExpiryMonthOnly +
              "|" +
              modifiedExpiryYearOnly,
            reconciliationCharge
          ]
        )
      );

      for (const object of BAMLGroupedCalculated) {
        const match = map.get(
          object.modifiedTradeDate +
            "|" +
            object.modifiedBS +
            "|" +
            object.modifiedSym +
            "|" +
            object.modifiedPC +
            "|" +
            object.modifiedQty +
            "|" +
            object.modifiedPrice +
            "|" +
            object.modifiedStrike +
            "|" +
            object.Mo +
            "|" +
            object.Yr
        );

        if (match) {
          object.reconciliationCharge = match;
          BAMLByDRVGroupedMatched.push(object);
        } else {
          BAMLByDRVGrouped.push(object);
        }
      }

      const result2 = BAMLByDRVGroupedMatched.map(
        ({ groupsSeparated }) => groupsSeparated!
      ).flat();

      // Return reconciliation charge, total charge and exec qty
      const BAMLReconciliationChargesNVNAndNV1: INVNReconciliationCharge[] =
        BAMLByDRVGroupedMatched.map((object) => {
          return {
            drvId: object.drv_trade_client_account_execution_id,
            reconciliationCharge: object.reconciliationCharge,
            totalCharge: object.modifiedTotalCharges,
            execQtySum: object.modifiedQty
          };
        });

      // Get matched N V N rows object
      const matchedNVNAndNV1: IReconciliationCharge[] =
        BAMLReconciliationChargesNVNAndNV1.map(
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

      // Get BAML unmatched rows by group BAML
      const BAMLByDRVGroup = BAMLModified.filter((row) =>
        BAMLByDRVGrouped.find(
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

      const BAMLVDRVUniqueDates = BAMLUniqueDatesArray(BAMLByDRVGroup);
      const BAMLVDRVSeparatedByDates = BAMLSeparateDatesObject(BAMLByDRVGroup);

      // Group BAML V 1 DRV
      for (const date of BAMLVDRVUniqueDates) {
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

        const BAMLUnmatched = BAMLVDRVSeparatedByDates[date].filter(
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

        const BAMLMatched = BAMLVDRVSeparatedByDates[date].filter((row) =>
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

        BAMLGroupedByDRV = BAMLGroupedByDRV.concat(BAMLUnmatched);

        BAML1V1Matched = BAML1V1Matched.concat(BAMLMatched);
      }

      // Get matched rows object
      const matched1V1: IReconciliationCharge[] = BAML1V1Matched.map(
        ({ drv_trade_client_account_execution_id, modifiedTotalCharges }) => {
          return {
            drv_trade_floor_broker_id: floorBrokerId,
            drv_trade_client_account_execution_id,
            charge: modifiedTotalCharges
          };
        }
      );

      const BAMLGroupedByBAML = BAMLByDRVGroup.filter((row) =>
        BAMLGroupedByDRV.find(
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

      const BAMLByGroupedBAMLUniqueDates =
        BAMLUniqueDatesArray(BAMLGroupedByBAML);
      const BAMLByGroupedBAMLSeparatedByDates =
        BAMLSeparateDatesObject(BAMLGroupedByBAML);

      // 1 BAML V 1 DRV
      for (const date of BAMLByGroupedBAMLUniqueDates) {
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

        const BAMLUnmatched = BAMLByGroupedBAMLSeparatedByDates[date].filter(
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

        BAMLunresolved = BAMLunresolved.concat(BAMLUnmatched);
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
      const totalCharge = BAMLModified.reduce(
        (a, b) => a + (b.modifiedTotalCharges || 0),
        0
      );

      // Unmatched charge
      const unmatchedCharge = BAMLunresolved.reduce(
        (prev, { modifiedTotalCharges }) => prev + modifiedTotalCharges!,
        0
      );

      // Matched Sum Charge
      const matchedSumCharge = totalCharge - unmatchedCharge;

      // Unmatched Sum Charge
      const unmatchedSumCharge = totalCharge - matchedSumCharge;

      // Matched count
      const matchedCount = BAMLModified.length - BAMLunresolved.length;

      // matched Sum Percentage
      const matchedSumPercentage = (matchedCount * 100) / BAMLModified.length;

      // unmatched Sum Percentage
      const unmatchedSumPercentage = (unmatchedSumCharge / totalCharge) * 100;

      // Delete all modified fields
      BAMLunresolved.forEach((element) => {
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
        totalCount: BAMLModified.length,
        totalCharge: totalCharge,
        matchedCount: matchedCount,
        matchSumCharge: matchedSumCharge,
        matchedSumPercentage: matchedSumPercentage,
        unmatchedCount: BAMLunresolved.length,
        unmatchedGroupCount: BAMLByDRVGrouped.length,
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

    */

    const WEXActions = async () => {
      let WEXGroupedMatched: IWEX[] = [];
      let WEXGroupedUnmatched: IWEX[] = [];

      let DRVGroupedMatched: IDRV[] = [];
      let DRVGroupedUnmatched: IDRV[] = [];

      let DRVGroupedCalculated: IDRV[] = [];
      let DRVUniqueCalculated: IDRV[] = [];

      let WEXGroupedCalculated: IWEX[] = [];
      let WEXUniqueCalculated: IWEX[] = [];

      let WEXunresolved: IWEX[] = [];
      let WEX1V1Matched: IWEX[] = [];

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

      // Modifing WEX
      const WEXModified = source.map((element: IWEX) => {
        const modifiedDate = WEXDateFormat(element.Date!);
        const modifiedUser = element.User?.toLowerCase();
        const modifiedSide = element.Side?.charAt(0).toLowerCase();
        const modifiedExecQty = Number(
          removeCommas(element["Exec Qty"]?.toString()!)
        );
        const modifiedSecurity = element.Security?.toLowerCase();
        const modifiedRoot = element.Root?.toLowerCase();
        const modifiedExpiry = WEXExpiryFormat(element.Expiry!);
        const modifiedStrike = Number(
          removeCommas(element.Strike?.toString().replace("$", ""))
        );
        const modifiedCallPut = element["Call/Put"]?.toLowerCase();
        const modifiedAveragePrice = Number(
          Number(
            removeCommas(element["Average Price"]?.replace("$", ""))
          ).toFixed(2)
        );
        const modifiedPortfolio =
          element.Portfolio?.split("-")[0].toLowerCase();
        const modifiedCommissionType =
          element["Commission Type"]?.toLowerCase();
        const modifiedCommissionRate = Number(element["Commission Rate"]);
        const modifiedTotalCharge = WEXModifiyTotalCharge(
          element["Total Charge"]!
        );

        return {
          ...element,
          modifiedDate,
          modifiedUser,
          modifiedSide,
          modifiedExecQty,
          modifiedSecurity,
          modifiedRoot,
          modifiedExpiry,
          modifiedStrike,
          modifiedCallPut,
          modifiedAveragePrice,
          modifiedPortfolio,
          modifiedCommissionType,
          modifiedCommissionRate,
          modifiedTotalCharge
        };
      });

      // Check for files validity
      if (
        DRVModified.map((e) => e.drv_trade_id)[0] === undefined ||
        WEXModified.map((e) => e.Date)[0] === undefined
      ) {
        ServerGlobal.getInstance().logger.error(
          "<addDerivatives>: Failed because files are invalid"
        );

        res.status(400).send({
          success: false,
          message: "invalid files"
        });
        return;
      }

      // Grouping WEX by Date, User, Side, Security, Root, Expiry, Strike, CallPut, Portfolio, CommissionType, CommissionRate
      const WEXGrouped = WEXGroupBy(WEXModified, (element: IWEX) => {
        return [
          element.modifiedDate,
          element.modifiedUser,
          element.modifiedSide,
          element.modifiedSecurity,
          element.modifiedRoot,
          element.modifiedExpiry,
          element.modifiedStrike,
          element.modifiedCallPut,
          element.modifiedPortfolio,
          element.modifiedCommissionType,
          element.modifiedCommissionRate
        ];
      });

      // Get WEX group keys
      const WEXGroupedKeys = Object.keys(WEXGrouped);

      // Sum exec qty, weight average price and sum total charge & build & link reconciliation charge object
      for (const key of WEXGroupedKeys) {
        let weightAverageExecQty = 0;
        let totalExecQty = 0;
        const result: IWEX[] = [
          ...WEXGrouped[key]
            .reduce((array, object) => {
              const key = `${object.modifiedDate}-${object.modifiedSide}-${object.modifiedSecurity}-${object.modifiedRoot}-${object.modifiedExpiry}-${object.modifiedStrike}-${object.modifiedCallPut}-${object.modifiedPortfolio}-${object.modifiedCommissionType}-${object.modifiedCommissionRate}`;
              const item: IWEX =
                array.get(key) ||
                Object.assign({}, object, {
                  modifiedExecQty: 0,
                  modifiedAveragePrice: 0,
                  modifiedTotalCharge: 0,
                  groupsSeparated: []
                });

              // Get reconciliation charge fields
              item.groupsSeparated = [...item.groupsSeparated!, object];

              // Sum qty
              item.modifiedExecQty =
                item.modifiedExecQty! + object.modifiedExecQty!;

              // Weight average price
              const curWeightAverageExecQty =
                object.modifiedExecQty! * object.modifiedAveragePrice!;

              weightAverageExecQty += curWeightAverageExecQty;
              totalExecQty += object.modifiedExecQty!;

              item.modifiedAveragePrice =
                Math.round(
                  (weightAverageExecQty / totalExecQty + Number.EPSILON) * 100
                ) / 100;

              // Sum total charge
              item.modifiedTotalCharge = Number(
                (
                  item.modifiedTotalCharge! + object.modifiedTotalCharge!
                ).toFixed(2)
              );

              return array.set(key, item);
            }, new Map())
            .values()
        ];

        if (WEXGrouped[key].length === 1) {
          WEXUniqueCalculated = WEXUniqueCalculated.concat(result);
        } else {
          WEXGroupedCalculated = WEXGroupedCalculated.concat(result);
        }
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

      // Sum quantity, weight average price & build & link reconciliation charge object
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
                  reconciliationCharge: [],
                  groupsSeparated: []
                });

              // Get reconciliation charge fields
              item.groupsSeparated = [...item.groupsSeparated!, object];

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

        if (DRVGrouped[key].length === 1) {
          DRVUniqueCalculated = DRVUniqueCalculated.concat(result);
        } else {
          DRVGroupedCalculated = DRVGroupedCalculated.concat(result);
        }
      }

      log(1);
      // ----- N VS N ----- //

      // Return DRV grouped calculated keys
      const DRVGroupedCalculatedKeys = DRVGroupedCalculated.map(
        ({
          modifiedDate,
          modifiedSide,
          modifiedSymbol,
          modifiedStrike,
          modifiedExpiry,
          modifiedOption,
          modifiedPrice,
          modifiedQuantity
        }) =>
          modifiedDate +
          "|" +
          modifiedSide +
          "|" +
          modifiedSymbol +
          "|" +
          modifiedStrike +
          "|" +
          modifiedExpiry +
          "|" +
          modifiedOption +
          "|" +
          modifiedPrice +
          "|" +
          modifiedQuantity
      );

      // Loop through WEX grouped calculated
      for (const object of WEXGroupedCalculated) {
        const string =
          object.modifiedDate +
          "|" +
          object.modifiedSide +
          "|" +
          object.modifiedRoot +
          "|" +
          object.modifiedStrike +
          "|" +
          object.modifiedExpiry +
          "|" +
          object.modifiedCallPut +
          "|" +
          object.modifiedAveragePrice +
          "|" +
          object.modifiedExecQty;

        const match = DRVGroupedCalculatedKeys.indexOf(string);

        if (match >= 0) {
          const reconciliationCharge = DRVGroupedCalculated.splice(match, 1)
            .map((e) => e.reconciliationCharge)
            .flat();

          object.reconciliationCharge = reconciliationCharge;

          WEXGroupedMatched.push(object);
          DRVGroupedMatched.push(...DRVGroupedCalculated.splice(match, 1));
        } else {
          WEXGroupedUnmatched.push(object);
        }
      }

      // ----- N VS 1 ----- //

      // Assign DRV grouped calculated to DRV grouped unmatched
      DRVGroupedUnmatched = DRVGroupedCalculated;

      // Separate DRV grouped unmatched
      const DRVUnmatched = separateGroups(DRVGroupedUnmatched);

      // Concat DRV unmatched to DRV unique calculated
      DRVUniqueCalculated = DRVUniqueCalculated.concat(DRVUnmatched as IDRV[]);

      // Return DRV unique calculated keys
      const DRVUniqueCalculatedKeys = DRVUniqueCalculated.map(
        ({
          modifiedDate,
          modifiedSide,
          modifiedSymbol,
          modifiedStrike,
          modifiedExpiry,
          modifiedOption,
          modifiedPrice,
          modifiedQuantity
        }) =>
          modifiedDate +
          "|" +
          modifiedSide +
          "|" +
          modifiedSymbol +
          "|" +
          modifiedStrike +
          "|" +
          modifiedExpiry +
          "|" +
          modifiedOption +
          "|" +
          modifiedPrice +
          "|" +
          modifiedQuantity
      );

      // Loop through WEX grouped unmatched
      for (const object of WEXGroupedUnmatched) {
        const string =
          object.modifiedDate +
          "|" +
          object.modifiedSide +
          "|" +
          object.modifiedRoot +
          "|" +
          object.modifiedStrike +
          "|" +
          object.modifiedExpiry +
          "|" +
          object.modifiedCallPut +
          "|" +
          object.modifiedAveragePrice +
          "|" +
          object.modifiedExecQty;

        const match = DRVUniqueCalculatedKeys.indexOf(string);

        if (match >= 0) {
          const reconciliationCharge = DRVUniqueCalculated.splice(match, 1)
            .map((e) => e.reconciliationCharge)
            .flat();

          object.reconciliationCharge = reconciliationCharge;

          WEXGroupedMatched.push(object);
          DRVGroupedMatched.push(...DRVUniqueCalculated.splice(match, 1));
        } else {
          WEXGroupedUnmatched.push(object);
        }
      }

      // ----- 1 VS 1 ----- //

      // Separate WEX grouped unmatched
      const WEXUnmatched = separateGroups(WEXGroupedUnmatched);

      // Concat wex unmatched to WEX unique calculated
      WEXUniqueCalculated = WEXUniqueCalculated.concat(WEXUnmatched as IWEX[]);

      // Return DRV unique calculated keys
      const DRVUniqueCalculatedKeys1V1 = DRVUniqueCalculated.map(
        ({
          modifiedDate,
          modifiedSide,
          modifiedSymbol,
          modifiedStrike,
          modifiedExpiry,
          modifiedOption,
          modifiedPrice,
          modifiedQuantity
        }) =>
          modifiedDate +
          "|" +
          modifiedSide +
          "|" +
          modifiedSymbol +
          "|" +
          modifiedStrike +
          "|" +
          modifiedExpiry +
          "|" +
          modifiedOption +
          "|" +
          modifiedPrice +
          "|" +
          modifiedQuantity
      );

      // Loop through WEX unique calculated
      for (const object of WEXUniqueCalculated) {
        const string =
          object.modifiedDate +
          "|" +
          object.modifiedSide +
          "|" +
          object.modifiedRoot +
          "|" +
          object.modifiedStrike +
          "|" +
          object.modifiedExpiry +
          "|" +
          object.modifiedCallPut +
          "|" +
          object.modifiedAveragePrice +
          "|" +
          object.modifiedExecQty;

        const match = DRVUniqueCalculatedKeys1V1.indexOf(string);

        if (match >= 0) {
          const reconciliationCharge = DRVUniqueCalculated.splice(match, 1)
            .map((e) => e.reconciliationCharge)
            .flat();

          object.reconciliationCharge = reconciliationCharge;

          WEXGroupedMatched.push(object);
          DRVGroupedMatched.push(...DRVUniqueCalculated.splice(match, 1));
        } else {
          WEXGroupedUnmatched.push(object);
        }
      }

      // Return reconciliation charge, total charge and exec qty
      const WEXReconciliationCharges: INVNReconciliationCharge[] =
        WEXGroupedMatched.map((object) => {
          return {
            reconciliationCharge: object.reconciliationCharge,
            totalCharge: object.modifiedTotalCharge,
            execQtySum: object.modifiedExecQty
          };
        });

      // Return matched reconciliation charge N V N rows object
      const reconciliationCharge: IReconciliationCharge[] =
        WEXReconciliationCharges.map(
          ({ reconciliationCharge, totalCharge, execQtySum }) => {
            return reconciliationCharge!.map((element) => ({
              drv_trade_floor_broker_id: floorBrokerId,
              drv_trade_client_account_execution_id:
                element!.drv_trade_client_account_execution_id,
              charge: (totalCharge! * element!.quantity!) / execQtySum!
            }));
          }
        ).flat();

      log(reconciliationCharge);

      // Total charge
      const totalCharge = WEXModified.reduce(
        (a, b) => a + (b.modifiedTotalCharge || 0),
        0
      );

      // Unmatched charge
      const unmatchedCharge = WEXGroupedUnmatched.reduce(
        (prev, { modifiedTotalCharge }) => prev + modifiedTotalCharge!,
        0
      );

      // Matched Sum Charge
      const matchedSumCharge = totalCharge - unmatchedCharge;

      // Unmatched Sum Charge
      const unmatchedSumCharge = totalCharge - matchedSumCharge;

      // Matched count
      const matchedCount = WEXModified.length - WEXGroupedUnmatched.length;

      // matched Sum Percentage
      const matchedSumPercentage = (matchedCount * 100) / WEXModified.length;

      // unmatched Sum Percentage
      const unmatchedSumPercentage = Number(
        ((unmatchedSumCharge / totalCharge) * 100).toFixed(2)
      );

      // Delete all modified fields
      WEXGroupedUnmatched.forEach((element) => {
        delete element.modifiedDate;
        delete element.modifiedUser;
        delete element.modifiedSide;
        delete element.modifiedExecQty;
        delete element.modifiedSecurity;
        delete element.modifiedRoot;
        delete element.modifiedExpiry;
        delete element.modifiedStrike;
        delete element.modifiedCallPut;
        delete element.modifiedAveragePrice;
        delete element.modifiedPortfolio;
        delete element.modifiedCommissionType;
        delete element.modifiedCommissionRate;
        delete element.modifiedTotalCharge;
        delete element.drv_trade_client_account_execution_id;
        delete element.reconciliationCharge;
      });

      // Convert JSON to CSV file
      converter.json2csv(WEXGroupedUnmatched, (err, csv) => {
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
        totalCount: WEXModified.length,
        totalCharge,
        matchedCount,
        matchSumCharge: matchedSumCharge,
        matchedSumPercentage: matchedSumPercentage,
        unmatchedCount: WEXunresolved.length,
        unmatchedGroupCount: WEXGroupedUnmatched.length,
        unmatchedSumCharge,
        unmatchedSumPercentage,
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

    // Check if derivatives are valid
    if (!derivatives) {
      ServerGlobal.getInstance().logger.error(
        "<getDerivatives>: Failed to get derivatives"
      );

      res.status(400).send({
        success: false,
        message: "derivatives are invalid"
      });
      return;
    }

    ServerGlobal.getInstance().logger.info(
      `<getDerivatives>: Successfully got the derivatives`
    );

    res.status(200).send({
      success: true,
      message: "Successfully retrieved derivatives",
      data: derivatives.map((derivative) => ({
        id: derivative.id,
        date: derivative.date,
        wex: derivative.source,
        drv: derivative.drv,
        username: derivative.username,
        matchedCount: derivative.matchedCount,
        matchedSumPercentage: derivative.matchedSumPercentage,
        unmatchedCount: derivative.unmatchedCount,
        unresolved: derivative.unresolved
      }))
    });
    return;
  } catch (e) {
    ServerGlobal.getInstance().logger.error(
      `<getDerivatives>: Failed to get derivatives because of server error: ${e}`
    );

    res.status(500).send({
      success: false,
      message: "Server error"
    });
    return;
  }
};

const getDerivative = async (
  req: IGetDerivativeRequest,
  res: IGetDerivativeResponse
) => {
  ServerGlobal.getInstance().logger.info(
    `<getDerivative>: Start processing request`
  );

  try {
    // Get derivative
    const derivative = await Derivative.findOne({
      order: [["id", "DESC"]]
    });

    // Check if derivatives are valid
    if (!derivative) {
      ServerGlobal.getInstance().logger.error(
        "<getDerivative>: Failed to get derivatives"
      );

      res.status(400).send({
        success: false,
        message: "derivatives are invalid"
      });
      return;
    }

    ServerGlobal.getInstance().logger.info(
      `<getDerivative>: Successfully got derivative`
    );

    res.status(200).send({
      success: true,
      message: "Successfully retrieved derivative",
      data: {
        wex: derivative.source,
        username: derivative.username,
        totalCount: derivative.totalCount,
        totalCharge: derivative.totalCharge,
        matchedCount: derivative.matchedCount,
        matchSumCharge: derivative.matchSumCharge,
        matchedSumPercentage: derivative.matchedSumPercentage,
        unmatchedCount: derivative.unmatchedCount,
        unmatchedGroupCount: derivative.unmatchedGroupCount,
        unmatchedSumCharge: derivative.unmatchedSumCharge,
        unmatchedSumPercentage: derivative.unmatchedSumPercentage,
        unresolved: derivative.unresolved
      }
    });
    return;
  } catch (e) {
    ServerGlobal.getInstance().logger.error(
      `<getDerivatives>: Failed to get derivatives because of server error: ${e}`
    );

    res.status(500).send({
      success: false,
      message: "Server error"
    });
    return;
  }
};

const downloadFile = async (
  req: IDownloadFileRequest,
  res: IDownloadFileResponse
) => {
  ServerGlobal.getInstance().logger.info(
    `<downloadFiles>: Start processing request`
  );

  try {
    const fileName = req.params.fileId;
    const filePath = __dirname + "../../../assets/" + fileName;

    // Check file path
    if (!filePath) {
      ServerGlobal.getInstance().logger.error(
        "<getDerivative>: Failed to get file"
      );

      res.status(400).send({
        success: false,
        message: "file is invalid"
      });
      return;
    }

    ServerGlobal.getInstance().logger.info(
      `<getDerivative>: Successfully downloaded file: ${fileName}`
    );

    res.status(200).download(filePath, fileName);
    return;
  } catch (e) {
    ServerGlobal.getInstance().logger.error(
      `<getDerivatives>: Failed to download files because of server error: ${e}`
    );

    res.status(500).send({
      success: false,
      message: "Server error"
    });
    return;
  }
};

export { addDerivatives, getDerivatives, getDerivative, downloadFile };
