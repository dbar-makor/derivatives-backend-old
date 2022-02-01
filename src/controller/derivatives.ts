import fs from "fs";
import csv from "csv-parser";
import util from "util";
import moment from "moment";
import converter from "json-2-csv";
import rp from "request-promise";
import _ from "lodash";

import ServerGlobal from "../server-global";

import User from "../model/user";
import Derivative from "../model/derivative";
import { IDRV, IWEX, IBAML, IDASH } from "../model/shared/derivatives";

import { removeCommas, separateGroups } from "../utils/derivatives";
import {
  DASHDateFormat,
  DASHGroupBy,
  DASHModifiyDollarSign,
  DASHModifiyTotalCharge,
  DASHSeparateDatesObject,
  DASHUniqueDatesArray,
} from "../utils/dash";
import {
  BAMLDateFormat,
  BAMLUniqueDatesArray,
  BAMLSeparateDatesObject,
  BAMLGroupBy,
  BAMLModifiyTotalCharge,
} from "../utils/baml";
import {
  WEXSeparateDatesObject,
  WEXUniqueDatesArray,
  WEXGroupBy,
  sourceDateFormat,
  sourceTotalCharge,
  WEXExpiryFormat,
} from "../utils/wex";
import {
  targetDateFormat,
  DRVSeparateDatesObject,
  targetGroupBy,
  targetExpiryMonth,
  targetExpiryYear,
  biggerThanOneGroupsDRV,
  equalToOneGroupsDRV,
} from "../utils/drv";

import {
  IAddDerivativesRequest,
  IGetDerivativesRequest,
  IGetDerivativeRequest,
  IDownloadFileRequest,
} from "../model/express/request/derivatives";
import {
  IAddDerivativesResponse,
  IGetDerivativesResponse,
  IGetDerivativeResponse,
  IDownloadFileResponse,
} from "../model/express/response/derivatives";

import { log } from "console";

const addDerivatives = async (
  req: IAddDerivativesRequest,
  res: IAddDerivativesResponse,
) => {
  ServerGlobal.getInstance().logger.info(
    `<addDerivatives>: Start processing request`,
  );

  // Find user by ID
  const userByID = await User.findByPk(req.userId);

  if (!userByID) {
    ServerGlobal.getInstance().logger.error(
      `<editProfile>: Failed to get user details for user id ${req.userId}`,
    );

    res.status(401).send({
      success: false,
      message: "Could not find user",
    });
    return;
  }

  try {
    const formattedCurrentDate = moment(new Date()).format(
      "DD-MM-YYYY-HH-mm-ss",
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
        "<addDerivatives>: Failed because floorBrokerId is invalid",
      );

      res.status(400).send({
        success: false,
        message: "invalid floorBrokerId",
      });
      return;
    }

    const firstFile = req.body.files[0];
    const secondFile = req.body.files[1];

    // Validate files
    if (!firstFile.file || !secondFile.file) {
      ServerGlobal.getInstance().logger.error(
        "<[WEX] addDerivatives>: Failed because files are invalid",
      );

      res.status(400).send({
        success: false,
        message: "invalid files",
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
        "<addDerivatives>: Failed to process sourceBase64/DRVBase64",
      );

      res.status(400).send({
        success: false,
        message: "invalid files",
      });
      return;
    }

    const sourceBase64Splited = sourceBase64.split(";base64,").pop();
    const DRVBase64Splited = DRVBase64.split(";base64,").pop();
    const sourceFileName = `assets/${fileName}-${userByID.username}-${formattedCurrentDate}.csv`;
    const DRVFileName = `assets/DRV-${userByID.username}-${formattedCurrentDate}.csv`;

    // Writing files to dir
    fs.writeFileSync(sourceFileName, sourceBase64Splited!, {
      encoding: "base64",
    });
    fs.writeFileSync(DRVFileName, DRVBase64Splited!, {
      encoding: "base64",
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
      `<addDerivatives>: Successfully created the files to dir`,
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

      let targetGrouped: IDRV[] = [];
      let targetUnique: IDRV[] = [];

      let DASHGroupedCalculated: IDASH[] = [];
      let DASHUniqueCalculated: IDASH[] = [];

      let DASHGroupedByDRV: IDASH[] = [];
      let DASHunresolved: IDASH[] = [];
      let DASH1V1Matched: IDASH[] = [];

      let reconciliation_charge: IReconciliationCharge[] = [];

      // Modifing DRV
      const targetModified = DRV.map((element) => {
        const modifiedDate = targetDateFormat(element.date!);
        const modifiedSide = element.side?.charAt(0).toLowerCase();
        const modifiedQuantity = Number(removeCommas(element.quantity!));
        const modifiedSymbol = element.symbol?.toLowerCase();
        const modifiedExpiry = targetDateFormat(element.expiry!);
        const modifiedExpiryMonthOnly = targetExpiryMonth(element.expiry!);
        const modifiedExpiryYearOnly = targetExpiryYear(element.expiry!);
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

      const DRVSeparatedByDates = DRVSeparateDatesObject(targetModified);

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
      const targetGroups = targetGroupBy(targetModified, (element: IDRV) => {
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
      const targetGroupKeys = Object.keys(targetGroups);

      // Sum quantity, weight average price
      for (const key of targetGroupKeys) {
        let weightAverageExecQty = 0;
        let totalExecQty = 0;
        const result: IDRV[] = [
          ...targetGroups[key]
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

        if (targetGroups[key].length === 1) {
          targetUnique = targetUnique.concat(result);
        } else {
          targetGrouped = targetGrouped.concat(result);
        }
      }

      const DRVGroupedCalculatedKey = targetGrouped.map(
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
          const reconciliationCharge = targetGrouped.splice(match, 1)
            .map((e) => e.reconciliationCharge)
            .flat();
          // object.reconciliationCharge = reconciliationCharge;
          DASHGroupedMatched.push(object);
          DRVGroupedMatched.push(...targetGrouped.splice(match, 1));
        } else {
          DASHGroupedUnmatched.push(object);
        }
      }

      const DRVGroupedUnmatched = targetGrouped;

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
      const unmatchSumCharge = totalCharge - matchedSumCharge;

      // Matched count
      const matchCount = DASHModified.length - DASHunresolved.length;

      // matched Sum Percentage
      const matchSumPercentage = (matchCount * 100) / DASHModified.length;

      // unmatched Sum Percentage
      const unmatchSumPercentage = (unmatchSumCharge / totalCharge) * 100;

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
        matchCount: matchCount,
        matchSumCharge: matchedSumCharge,
        matchSumPercentage: matchSumPercentage,
        unmatchCount: DASHunresolved.length,
        unmatchGroupCount: DASHGroupedUnmatched.length,
        unmatchSumCharge: unmatchSumCharge,
        unmatchSumPercentage: unmatchSumPercentage,
        unresolved: `unresolved-${userByID.username}-${formattedCurrentDate}.csv`
      });

      res.status(200).send({
        success: true,
        message: "Successfully added derivative"
      });
      return;
    };

    const BAMLActions = async () => {
      let targetGrouped: IDRV[] = [];

      let BAMLGroupedByDRV: IBAML[] = [];
      let BAMLGroupedCalculated: IBAML[] = [];
      let BAMLunresolved: IBAML[] = [];
      let BAML1V1Matched: IBAML[] = [];

      let reconciliation_charge: IReconciliationCharge[] = [];

      // Modifing DRV
      const targetModified = DRV.map((element) => {
        const modifiedDate = targetDateFormat(element.date!);
        const modifiedSide = element.side?.charAt(0).toLowerCase();
        const modifiedQuantity = Number(removeCommas(element.quantity!));
        const modifiedSymbol = element.symbol?.toLowerCase();
        const modifiedExpiry = targetDateFormat(element.expiry!);
        const modifiedExpiryMonthOnly = targetExpiryMonth(element.expiry!);
        const modifiedExpiryYearOnly = targetExpiryYear(element.expiry!);
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

      const DRVSeparatedByDates = DRVSeparateDatesObject(targetModified);

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
      const targetGroups = targetGroupBy(targetModified, (element: IDRV) => {
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
      const targetGroupKeys = Object.keys(targetGroups);

      // Sum quantity, weight average price
      for (const key of targetGroupKeys) {
        let weightAverageExecQty = 0;
        let totalExecQty = 0;
        const result: IDRV[] = [
          ...targetGroups[key]
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

        targetGrouped = targetGrouped.concat(result);
      }

      let BAMLByDRVGroupedMatched: IBAML[] = [];
      let BAMLByDRVGrouped: IBAML[] = [];

      const map = new Map(
        targetGrouped.map(
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
      const unmatchSumCharge = totalCharge - matchedSumCharge;

      // Matched count
      const matchCount = BAMLModified.length - BAMLunresolved.length;

      // matched Sum Percentage
      const matchSumPercentage = (matchCount * 100) / BAMLModified.length;

      // unmatched Sum Percentage
      const unmatchSumPercentage = (unmatchSumCharge / totalCharge) * 100;

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
        matchCount: matchCount,
        matchSumCharge: matchedSumCharge,
        matchSumPercentage: matchSumPercentage,
        unmatchCount: BAMLunresolved.length,
        unmatchGroupCount: BAMLByDRVGrouped.length,
        unmatchSumCharge: unmatchSumCharge,
        unmatchSumPercentage: unmatchSumPercentage,
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
      let sourceUnique: IWEX[] = [];
      let sourceGrouped: IWEX[] = [];
      let sourceCancledPairs: IWEX[] = [];
      let sourceMatchedPairs: IWEX[] = [];
      const sourceGroupsMatches: IWEX[] = [];
      const sourceGroupsUnmatchesNVN: IWEX[] = [];
      const sourceGroupsUnmatchesNV1: IWEX[] = [];
      const sourceGroupsUnmatches1V1: IWEX[] = [];

      let targetUnique: IDRV[] = [];
      let targetGrouped: IDRV[] = [];
      const targetMatches: IDRV[] = [];
      const targetGroupsUnmatchesNVN: IDRV[] = [];
      const targetGroupsUnmatchesNV1: IDRV[] = [];
      const targetGroupsUnmatches1V1: IDRV[] = [];

      // Modifing target
      const targetModified: IDRV[] = DRV.map((element) => {
        const modifiedDate = targetDateFormat(element.date!);
        const modifiedSide = element.side?.charAt(0).toLowerCase();
        const modifiedQuantity = Number(removeCommas(element.quantity!));
        const modifiedSymbol = element.symbol?.toLowerCase();
        const modifiedExpiry = targetDateFormat(element.expiry!);
        const modifiedExpiryMonthOnly = targetExpiryMonth(element.expiry!);
        const modifiedExpiryYearOnly = targetExpiryYear(element.expiry!);
        const modifiedStrike = Number(removeCommas(element.strike));
        const modifiedOption = element.option?.charAt(0).toLowerCase();
        const modifiedPrice = Number(
          Number(removeCommas(element.price!)).toFixed(2),
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
          modifiedPrice,
        };
      });

      // Modifing source
      const sourceModified: IWEX[] = source.map((element: IWEX) => {
        const modifiedDate = sourceDateFormat(element.Date!);
        const modifiedUser = element.User?.toLowerCase();
        const modifiedSide = element.Side?.charAt(0).toLowerCase();
        const modifiedExecQty = Number(
          removeCommas(element["Exec Qty"]?.toString()!),
        );
        const modifiedSecurity = element.Security?.toLowerCase();
        const modifiedRoot = element.Root?.toLowerCase();
        const modifiedExpiry = WEXExpiryFormat(element.Expiry!);
        const modifiedStrike = Number(
          removeCommas(element.Strike?.toString().replace("$", "")),
        );
        const modifiedCallPut = element["Call/Put"]?.toLowerCase();
        const modifiedAveragePrice = Number(
          Number(
            removeCommas(element["Average Price"]?.replace("$", "")),
          ).toFixed(2),
        );
        const modifiedPortfolio =
          element.Portfolio?.split("-")[0].toLowerCase();
        const modifiedCommissionType =
          element["Commission Type"]?.toLowerCase();
        const modifiedCommissionRate = Number(element["Commission Rate"]);
        const modifiedTotalCharge = sourceTotalCharge(element["Total Charge"]!);

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
          modifiedTotalCharge,
        };
      });

      // Check for files validity
      if (!targetModified || !sourceModified) {
        ServerGlobal.getInstance().logger.error(
          "<addDerivatives>: Failed because files are invalid",
        );

        res.status(400).send({
          success: false,
          message: "invalid files",
        });
        return;
      }

      // Run over each row cancel inverse pairs
      for (let i = 0; i < sourceModified.length; i++) {
        // Run over each row starting from the outer element's position
        for (let j = i + 1; j < sourceModified.length; j++) {
          const {
            modifiedUser: user_i,
            modifiedDate: date_i,
            Route: route_i,
            modifiedSide: side_i,
            modifiedSecurity: security_i,
            modifiedRoot: root_i,
            modifiedExpiry: expiry_i,
            modifiedStrike: strike_i,
            modifiedCallPut: callPut_i,
            modifiedAveragePrice: averagePrice_i,
            modifiedTotalCharge: totalCharge_i,
            modifiedPortfolio: portfolio_i,
            modifiedCommissionType: commissionType_i,
            modifiedExecQty: execQty_i,
            removed: removed_i,
          } = sourceModified[i];
          const {
            modifiedUser: user_j,
            modifiedDate: date_j,
            Route: route_j,
            modifiedSide: side_j,
            modifiedSecurity: security_j,
            modifiedRoot: root_j,
            modifiedExpiry: expiry_j,
            modifiedStrike: strike_j,
            modifiedCallPut: callPut_j,
            modifiedAveragePrice: averagePrice_j,
            modifiedTotalCharge: totalCharge_j,
            modifiedPortfolio: portfolio_j,
            modifiedCommissionType: commissionType_j,
            modifiedExecQty: execQty_j,
            removed: removed_j,
          } = sourceModified[j];
          if (
            !removed_i &&
            !removed_j &&
            execQty_i === execQty_j! * -1 &&
            totalCharge_i === totalCharge_j! * -1 &&
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
            portfolio_i === portfolio_j
          ) {
            sourceModified[i].removed = true;
            sourceModified[j].removed = true;
          }
        }

        sourceMatchedPairs = sourceModified.filter((element) => {
          return element.removed;
        });

        sourceCancledPairs = sourceModified.filter((element) => {
          return !element.removed;
        });
      }

      // Push cancled pairs into source matches
      sourceGroupsMatches.push(...sourceMatchedPairs);

      // Grouping WEX by Date, User, Side, Security, Root, Expiry, Strike, CallPut, Portfolio, CommissionType, CommissionRate
      const sourceGroups = WEXGroupBy(sourceCancledPairs, (element: IWEX) => {
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
          element.modifiedCommissionRate,
        ];
      });

      // Get WEX group keys
      const sourceGroupKeys = Object.keys(sourceGroups);

      // Sum exec qty, weight average price and sum total charge & build & link reconciliation charge object
      for (const key of sourceGroupKeys) {
        let weightAverageExecQty = 0;
        let totalExecQty = 0;
        const result: IWEX[] = [
          ...sourceGroups[key]
            .reduce((array, object) => {
              const key = `${object.modifiedDate}-${object.modifiedSide}-${object.modifiedSecurity}-${object.modifiedRoot}-${object.modifiedExpiry}-${object.modifiedStrike}-${object.modifiedCallPut}-${object.modifiedPortfolio}-${object.modifiedCommissionType}-${object.modifiedCommissionRate}`;
              const item: IWEX =
                array.get(key) ||
                Object.assign({}, object, {
                  modifiedExecQty: 0,
                  modifiedAveragePrice: 0,
                  modifiedTotalCharge: 0,
                  groupsSeparated: [],
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
                  (weightAverageExecQty / totalExecQty + Number.EPSILON) * 100,
                ) / 100;

              // Sum total charge
              item.modifiedTotalCharge = Number(
                (
                  item.modifiedTotalCharge! + object.modifiedTotalCharge!
                ).toFixed(2),
              );

              return array.set(key, item);
            }, new Map())
            .values(),
        ];

        // Add key to result
        const modifiedResult: IDRV[] = result.map((element) => {
          const string = `${element.modifiedDate}|${element.modifiedSide}|${element.modifiedRoot}|${element.modifiedStrike}|${element.modifiedExpiry}|${element.modifiedCallPut}|${element.modifiedAveragePrice}|${element.modifiedExecQty}`;
          return {
            ...element,
            key: string,
          };
        });

        if (sourceGroups[key].length === 1) {
          sourceUnique = sourceUnique.concat(modifiedResult);
        } else {
          sourceGrouped = sourceGrouped.concat(modifiedResult);
        }
      }

      // Grouping DRV by drv_trade_id, floor_broker, date, side, component_type, contract_type, symbol, expiry, strike, option, client_id
      const targetGroups = targetGroupBy(targetModified, (element: IDRV) => {
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
          element.client_id,
        ];
      });

      // Get DRV group keys
      const targetGroupKeys = Object.keys(targetGroups);

      // Sum quantity, weight average price & build & link reconciliation charge object
      for (const key of targetGroupKeys) {
        let weightAverageExecQty = 0;
        let totalExecQty = 0;
        const result: IDRV[] = [
          ...targetGroups[key]
            .reduce((array, object) => {
              const key = `${object.drv_trade_id}-${object.floor_broker}-${object.modifiedDate}-${object.modifiedSide}-${object.component_type}-${object.contract_type}-${object.modifiedSymbol}-${object.modifiedExpiry}-${object.modifiedStrike}-${object.modifiedOption}-${object.client_id}`;
              const item: IDRV =
                array.get(key) ||
                Object.assign({}, object, {
                  modifiedQuantity: 0,
                  modifiedPrice: 0,
                  groupsSeparated: [],
                });

              // Push object fields
              item.groupsSeparated = [...item.groupsSeparated!, object];

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
                  (weightAverageExecQty / totalExecQty + Number.EPSILON) * 100,
                ) / 100;

              return array.set(key, item);
            }, new Map())
            .values(),
        ];

        // Add key to result
        const modifiedResult: IDRV[] = result.map((element) => {
          const string = `${element.modifiedDate}|${element.modifiedSide}|${element.modifiedSymbol}|${element.modifiedStrike}|${element.modifiedExpiry}|${element.modifiedOption}|${element.modifiedPrice}|${element.modifiedQuantity}`;
          return {
            ...element,
            key: string,
          };
        });

        if (targetGroups[key].length === 1) {
          targetUnique = targetUnique.concat(modifiedResult);
        } else {
          targetGrouped = targetGrouped.concat(modifiedResult);
        }
      }

      //- |-------------------| -//
      //- |-----  N V N  -----| -//
      //- |-------------------| -//

      // Run through each row on source, get source matches, unmatches & target unmatches
      for (const sourceObject of sourceGrouped) {
        // Check for match between source & target
        const targetObject = targetGrouped.find(({ key }) => {
          const isMatch = sourceObject.key === key;
          return isMatch;
        });

        if (targetObject) {
          // Check if match as already exist by id
          const targetIds = sourceGroupsMatches.map(({ targetId }) => targetId);
          if (
            targetIds.includes(
              targetObject.drv_trade_client_account_execution_id,
            )
          ) {
            sourceGroupsUnmatchesNVN.push(sourceObject);
            continue;
          }

          for (const match of sourceObject.groupsSeparated!) {
            sourceGroupsMatches.push({
              ...match,
              targetId: targetObject.drv_trade_client_account_execution_id,
            });
          }

          // Add charge to target matches
          if (!targetObject.groupsSeparated) {
            const sourceTotalCharge = sourceObject.modifiedTotalCharge!;
            const sourceQuantitySum = sourceObject.modifiedExecQty!;

            const targetWithCharge: IDRV = {
              ...targetObject,
              charge:
                (Number(targetObject.quantity) * sourceTotalCharge) /
                sourceQuantitySum,
            };

            targetMatches.push(targetWithCharge);
          } else {
            // Iterate over target matches to add charge
            for (const target of targetObject.groupsSeparated) {
              const sourceTotalCharge = sourceObject.modifiedTotalCharge!;
              const sourceQuantitySum = sourceObject.modifiedExecQty!;

              const targetWithCharge: IDRV = {
                ...target,
                charge:
                  (Number(target.quantity) * sourceTotalCharge) /
                  sourceQuantitySum,
              };

              targetMatches.push(targetWithCharge);
            }
          }
        } else {
          sourceGroupsUnmatchesNVN.push(sourceObject);
        }
      }

      // Run through each row on target, get target unmatches
      for (const targetObject of targetGrouped) {
        const sourceObject = sourceGrouped.find(
          ({ key }) => key === targetObject.key,
        );

        if (!sourceObject) {
          targetGroupsUnmatchesNVN.push(targetObject);
        }
      }

      //- |-------------------| -//
      //- |-----  N V 1  -----| -//
      //- |-------------------| -//

      // Separate target unmatches and push then into target unique array
      const targetUnmatches = separateGroups(targetGroupsUnmatchesNVN);
      targetUnique.push(...(targetUnmatches as IDRV[]));

      // Run through each row on source, get source matches, unmatches & target unmatches
      for (const sourceObject of sourceGroupsUnmatchesNVN) {
        // Check for match between source & target
        const targetObject = targetUnique.find(({ key }) => {
          const isMatch = sourceObject.key === key;
          return isMatch;
        });

        if (targetObject) {
          // Check if match as already exist by id
          const targetIds = sourceGroupsMatches.map(({ targetId }) => targetId);
          if (
            targetIds.includes(
              targetObject.drv_trade_client_account_execution_id,
            )
          ) {
            sourceGroupsUnmatchesNV1.push(sourceObject);
            continue;
          }

          for (const match of sourceObject.groupsSeparated!) {
            sourceGroupsMatches.push({
              ...match,
              targetId: targetObject.drv_trade_client_account_execution_id,
            });
          }

          // Add charge to target matches
          if (!targetObject.groupsSeparated) {
            const sourceTotalCharge = sourceObject.modifiedTotalCharge!;
            const sourceQuantitySum = sourceObject.modifiedExecQty!;

            const targetWithCharge: IDRV = {
              ...targetObject,
              charge:
                (Number(targetObject.quantity) * sourceTotalCharge) /
                sourceQuantitySum,
            };

            targetMatches.push(targetWithCharge);
          } else {
            // Iterate over target matches to add charge
            for (const target of targetObject.groupsSeparated) {
              const sourceTotalCharge = sourceObject.modifiedTotalCharge!;
              const sourceQuantitySum = sourceObject.modifiedExecQty!;

              const targetWithCharge: IDRV = {
                ...target,
                charge:
                  (Number(target.quantity) * sourceTotalCharge) /
                  sourceQuantitySum,
              };

              targetMatches.push(targetWithCharge);
            }
          }
        } else {
          sourceGroupsUnmatchesNV1.push(sourceObject);
        }
      }

      // Run through each row on target, get target unmatches
      for (const targetObject of targetUnique) {
        const sourceObject = sourceGroupsUnmatchesNVN.find(
          ({ key }) => key === targetObject.key,
        );

        if (!sourceObject) {
          targetGroupsUnmatchesNV1.push(targetObject);
        }
      }

      //- |-------------------| -//
      //- |-----  1 V 1  -----| -//
      //- |-------------------| -//

      sourceUnique.push(
        ...(separateGroups(sourceGroupsUnmatchesNV1) as IWEX[]),
      );

      // Run through each row on source, get source matches, unmatches & target unmatches
      for (const sourceObject of sourceUnique) {
        // Check for match between source & target
        const targetObject = targetGroupsUnmatchesNV1.find(({ key }) => {
          const isMatch = sourceObject.key === key;
          return isMatch;
        });

        if (targetObject) {
          // Check if match as already exist by id
          const targetIds = sourceGroupsMatches.map(({ targetId }) => targetId);
          if (
            targetIds.includes(
              targetObject.drv_trade_client_account_execution_id,
            )
          ) {
            sourceGroupsUnmatches1V1.push(sourceObject);
            continue;
          }

          sourceGroupsMatches.push({
            ...sourceObject,
            targetId: targetObject.drv_trade_client_account_execution_id,
          });

          if (!targetObject.groupsSeparated) {
            // Add charge to target matches
            const sourceTotalCharge = sourceObject.modifiedTotalCharge!;
            const sourceQuantitySum = sourceObject.modifiedExecQty!;

            const targetWithCharge: IDRV = {
              ...targetObject,
              charge:
                (Number(targetObject.quantity) * sourceTotalCharge) /
                sourceQuantitySum,
            };

            targetMatches.push(targetWithCharge);
          } else {
            // Iterate over target matches to add charge
            for (const target of targetObject.groupsSeparated) {
              const sourceTotalCharge = sourceObject.modifiedTotalCharge!;
              const sourceQuantitySum = sourceObject.modifiedExecQty!;

              const targetWithCharge: IDRV = {
                ...target,
                charge:
                  (Number(target.quantity) * sourceTotalCharge) /
                  sourceQuantitySum,
              };

              targetMatches.push(targetWithCharge);
            }
          }
        } else {
          sourceGroupsUnmatches1V1.push(sourceObject);
        }
      }

      // Run through each row on target, get target unmatches
      for (const targetObject of targetUnique) {
        const sourceObject = sourceGroupsUnmatches1V1.find(
          ({ key }) => key === targetObject.key,
        );

        if (!sourceObject) {
          targetGroupsUnmatches1V1.push(targetObject);
        }
      }

      // Total charge
      const totalCharge =
        Math.round(
          (sourceModified.reduce(
            (a, b) => a + (b.modifiedTotalCharge || 0),
            0,
          ) +
            Number.EPSILON) *
            100,
        ) / 100;

      // Unmatched sum charge
      const unmatchSumCharge =
        Math.round(
          (sourceGroupsUnmatches1V1.reduce(
            (a, b) => a + (b!.modifiedTotalCharge || 0),
            0,
          ) +
            Number.EPSILON) *
            100,
        ) / 100;

      // Matched sum Charge
      const matchSumCharge =
        Math.round(
          (sourceGroupsMatches.reduce(
            (a, b) => a + (b!.modifiedTotalCharge || 0),
            0,
          ) +
            Number.EPSILON) *
            100,
        ) / 100;

      // Total count
      const totalCount = sourceModified.length;

      // Match count
      const matchCount = sourceGroupsMatches.length;

      // Unmatch count
      const unmatchCount = sourceGroupsUnmatches1V1.length;

      // Unmatch group count
      const unmatchGroupCount = sourceGroupsUnmatchesNV1.length;

      // matched Sum Percentage
      const matchSumPercentage =
        Math.round(
          ((matchCount * 100) / sourceModified.length + Number.EPSILON) * 100,
        ) / 100;

      // unmatched Sum Percentage
      const unmatchSumPercentage = Number(
        ((unmatchSumCharge / totalCharge) * 100).toFixed(2),
      );

      // Delete all modified fields
      sourceGroupsUnmatches1V1.forEach((element) => {
        delete element.drv_trade_client_account_execution_id;
        delete element.modifiedCommissionType;
        delete element.modifiedCommissionRate;
        delete element.modifiedTotalCharge;
        delete element.modifiedAveragePrice;
        delete element.modifiedPortfolio;
        delete element.modifiedSecurity;
        delete element.modifiedExecQty;
        delete element.modifiedCallPut;
        delete element.groupsSeparated;
        delete element.modifiedExpiry;
        delete element.modifiedStrike;
        delete element.modifiedDate;
        delete element.modifiedUser;
        delete element.modifiedSide;
        delete element.modifiedRoot;
        delete element.key;
      });

      // Convert JSON to CSV file
      converter.json2csv(sourceGroupsUnmatches1V1, (err, csv) => {
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

        fs.writeFileSync(
          `assets/unresolved-${userByID.username}-${formattedCurrentDate}.csv`,
          csv,
        );

        ServerGlobal.getInstance().logger.info(
          `<addDerivatives>: Successfully created the unresolved-${userByID.username}-${formattedCurrentDate}.csv to dir`,
        );
      });

      // Saving the derivative document in DB
      await Derivative.create({
        date: formattedCurrentDate,
        floorBrokerId: floorBrokerId,
        username: userByID.username,
        source: `${fileName}-${userByID.username}-${formattedCurrentDate}.csv`,
        drv: `DRV-${userByID.username}-${formattedCurrentDate}.csv`,
        totalCount,
        totalCharge,
        matchCount,
        matchSumCharge,
        matchSumPercentage,
        unmatchCount,
        unmatchGroupCount,
        unmatchSumCharge,
        unmatchSumPercentage,
        unresolved: `unresolved-${userByID.username}-${formattedCurrentDate}.csv`,
      });

      res.status(200).send({
        success: true,
        message: "Successfully added derivative",
      });
      return;
    };

    const BAMLActions = async () => {
      let sourceUnique: IWEX[] = [];
      let sourceGrouped: IWEX[] = [];
      const sourceGroupsMatches: IWEX[] = [];
      const sourceGroupsUnmatchesNVN: IWEX[] = [];
      const sourceGroupsUnmatchesNV1: IWEX[] = [];
      const sourceGroupsUnmatches1V1: IWEX[] = [];

      let targetUnique: IDRV[] = [];
      let targetGrouped: IDRV[] = [];
      const targetMatches: IDRV[] = [];
      const targetGroupsUnmatchesNVN: IDRV[] = [];
      const targetGroupsUnmatchesNV1: IDRV[] = [];
      const targetGroupsUnmatches1V1: IDRV[] = [];

      // Modifing target
      const targetModified: IDRV[] = DRV.map((element) => {
        const modifiedDate = targetDateFormat(element.date!);
        const modifiedSide = element.side?.charAt(0).toLowerCase();
        const modifiedQuantity = Number(removeCommas(element.quantity!));
        const modifiedSymbol = element.symbol?.toLowerCase();
        const modifiedExpiry = targetDateFormat(element.expiry!);
        const modifiedExpiryMonthOnly = targetExpiryMonth(element.expiry!);
        const modifiedExpiryYearOnly = targetExpiryYear(element.expiry!);
        const modifiedStrike = Number(removeCommas(element.strike));
        const modifiedOption = element.option?.charAt(0).toLowerCase();
        const modifiedPrice = Number(
          Number(removeCommas(element.price!)).toFixed(2),
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
          modifiedPrice,
        };
      });

      // Modifing source
      const sourceModified: IWEX[] = source.map((element: IWEX) => {
        const modifiedDate = sourceDateFormat(element.Date!);
        const modifiedUser = element.User?.toLowerCase();
        const modifiedSide = element.Side?.charAt(0).toLowerCase();
        const modifiedExecQty = Number(
          removeCommas(element["Exec Qty"]?.toString()!),
        );
        const modifiedSecurity = element.Security?.toLowerCase();
        const modifiedRoot = element.Root?.toLowerCase();
        const modifiedExpiry = WEXExpiryFormat(element.Expiry!);
        const modifiedStrike = Number(
          removeCommas(element.Strike?.toString().replace("$", "")),
        );
        const modifiedCallPut = element["Call/Put"]?.toLowerCase();
        const modifiedAveragePrice = Number(
          Number(
            removeCommas(element["Average Price"]?.replace("$", "")),
          ).toFixed(2),
        );
        const modifiedPortfolio =
          element.Portfolio?.split("-")[0].toLowerCase();
        const modifiedCommissionType =
          element["Commission Type"]?.toLowerCase();
        const modifiedCommissionRate = Number(element["Commission Rate"]);
        const modifiedTotalCharge = sourceTotalCharge(element["Total Charge"]!);

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
          modifiedTotalCharge,
        };
      });

      // Check for files validity
      if (!targetModified || !sourceModified) {
        ServerGlobal.getInstance().logger.error(
          "<addDerivatives>: Failed because files are invalid",
        );

        res.status(400).send({
          success: false,
          message: "invalid files",
        });
        return;
      }

      // Grouping source by Date, User, Side, Security, Root, Expiry, Strike, CallPut, Portfolio, CommissionType, CommissionRate
      const sourceGroups = WEXGroupBy(sourceModified, (element: IWEX) => {
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
          element.modifiedCommissionRate,
        ];
      });

      // Get source group keys
      const sourceGroupKeys = Object.keys(sourceGroups);

      // Sum exec qty, weight average price and sum total charge & build & link reconciliation charge object
      for (const key of sourceGroupKeys) {
        let weightAverageExecQty = 0;
        let totalExecQty = 0;
        const result: IWEX[] = [
          ...sourceGroups[key]
            .reduce((array, object) => {
              const key = `${object.modifiedDate}-${object.modifiedSide}-${object.modifiedSecurity}-${object.modifiedRoot}-${object.modifiedExpiry}-${object.modifiedStrike}-${object.modifiedCallPut}-${object.modifiedPortfolio}-${object.modifiedCommissionType}-${object.modifiedCommissionRate}`;
              const item: IWEX =
                array.get(key) ||
                Object.assign({}, object, {
                  modifiedExecQty: 0,
                  modifiedAveragePrice: 0,
                  modifiedTotalCharge: 0,
                  groupsSeparated: [],
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
                  (weightAverageExecQty / totalExecQty + Number.EPSILON) * 100,
                ) / 100;

              // Sum total charge
              item.modifiedTotalCharge = Number(
                (
                  item.modifiedTotalCharge! + object.modifiedTotalCharge!
                ).toFixed(2),
              );

              return array.set(key, item);
            }, new Map())
            .values(),
        ];

        // Add key to result
        const modifiedResult: IDRV[] = result.map((element) => {
          const keyString = `${element.modifiedDate}|${element.modifiedSide}|${element.modifiedRoot}|${element.modifiedStrike}|${element.modifiedExpiry}|${element.modifiedCallPut}|${element.modifiedAveragePrice}|${element.modifiedExecQty}`;
          return {
            ...element,
            key: keyString,
          };
        });

        if (sourceGroups[key].length === 1) {
          sourceUnique = sourceUnique.concat(modifiedResult);
        } else {
          sourceGrouped = sourceGrouped.concat(modifiedResult);
        }
      }

      // Grouping target by drv_trade_id, floor_broker, date, side, component_type, contract_type, symbol, expiry, strike, option, client_id
      const targetGroups = targetGroupBy(targetModified, (element: IDRV) => {
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
          element.client_id,
        ];
      });

      // Get target group keys
      const targetGroupKeys = Object.keys(targetGroups);

      // Sum quantity, weight average price & build & link reconciliation charge object
      for (const key of targetGroupKeys) {
        let weightAverageExecQty = 0;
        let totalExecQty = 0;
        const result: IDRV[] = [
          ...targetGroups[key]
            .reduce((array, object) => {
              const key = `${object.drv_trade_id}-${object.floor_broker}-${object.modifiedDate}-${object.modifiedSide}-${object.component_type}-${object.contract_type}-${object.modifiedSymbol}-${object.modifiedExpiry}-${object.modifiedStrike}-${object.modifiedOption}-${object.client_id}`;
              const item: IDRV =
                array.get(key) ||
                Object.assign({}, object, {
                  modifiedQuantity: 0,
                  modifiedPrice: 0,
                  groupsSeparated: [],
                });

              // Push object fields
              item.groupsSeparated = [...item.groupsSeparated!, object];

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
                  (weightAverageExecQty / totalExecQty + Number.EPSILON) * 100,
                ) / 100;

              return array.set(key, item);
            }, new Map())
            .values(),
        ];

        // Add key to result
        const modifiedResult: IDRV[] = result.map((element) => {
          const string = `${element.modifiedDate}|${element.modifiedSide}|${element.modifiedSymbol}|${element.modifiedStrike}|${element.modifiedExpiry}|${element.modifiedOption}|${element.modifiedPrice}|${element.modifiedQuantity}`;
          return {
            ...element,
            key: string,
          };
        });

        if (targetGroups[key].length === 1) {
          targetUnique = targetUnique.concat(modifiedResult);
        } else {
          targetGrouped = targetGrouped.concat(modifiedResult);
        }
      }

      //- |-------------------| -//
      //- |-----  N V N  -----| -//
      //- |-------------------| -//

      // Run through each row on source, get source matches, unmatches & target unmatches
      for (const sourceObject of sourceGrouped) {
        // Check for match between source & target
        const targetObject = targetGrouped.find(({ key }) => {
          const isMatch = sourceObject.key === key;
          return isMatch;
        });

        if (targetObject) {
          // Check if match as already exist by id
          const targetIds = sourceGroupsMatches.map(({ targetId }) => targetId);
          if (
            targetIds.includes(
              targetObject.drv_trade_client_account_execution_id,
            )
          ) {
            sourceGroupsUnmatchesNVN.push(sourceObject);
            continue;
          }

          for (const match of sourceObject.groupsSeparated!) {
            sourceGroupsMatches.push({
              ...match,
              targetId: targetObject.drv_trade_client_account_execution_id,
            });
          }

          // Add charge to target matches
          if (!targetObject.groupsSeparated) {
            const sourceTotalCharge = sourceObject.modifiedTotalCharge!;
            const sourceQuantitySum = sourceObject.modifiedExecQty!;

            const targetWithCharge: IDRV = {
              ...targetObject,
              charge:
                (Number(targetObject.quantity) * sourceTotalCharge) /
                sourceQuantitySum,
            };

            targetMatches.push(targetWithCharge);
          } else {
            // Iterate over target matches to add charge
            for (const target of targetObject.groupsSeparated) {
              const sourceTotalCharge = sourceObject.modifiedTotalCharge!;
              const sourceQuantitySum = sourceObject.modifiedExecQty!;

              const targetWithCharge: IDRV = {
                ...target,
                charge:
                  (Number(target.quantity) * sourceTotalCharge) /
                  sourceQuantitySum,
              };

              targetMatches.push(targetWithCharge);
            }
          }
        } else {
          sourceGroupsUnmatchesNVN.push(sourceObject);
        }
      }

      // Run through each row on target, get target unmatches
      for (const targetObject of targetGrouped) {
        const sourceObject = sourceGrouped.find(
          ({ key }) => key === targetObject.key,
        );

        if (!sourceObject) {
          targetGroupsUnmatchesNVN.push(targetObject);
        }
      }

      //- |-------------------| -//
      //- |-----  N V 1  -----| -//
      //- |-------------------| -//

      // Separate target unmatches and push then into target unique array
      const targetUnmatches = separateGroups(targetGroupsUnmatchesNVN);
      targetUnique.push(...(targetUnmatches as IDRV[]));

      // Run through each row on source, get source matches, unmatches & target unmatches
      for (const sourceObject of sourceGroupsUnmatchesNVN) {
        // Check for match between source & target
        const targetObject = targetUnique.find(({ key }) => {
          const isMatch = sourceObject.key === key;
          return isMatch;
        });

        if (targetObject) {
          // Check if match as already exist by id
          const targetIds = sourceGroupsMatches.map(({ targetId }) => targetId);
          if (
            targetIds.includes(
              targetObject.drv_trade_client_account_execution_id,
            )
          ) {
            sourceGroupsUnmatchesNV1.push(sourceObject);
            continue;
          }

          for (const match of sourceObject.groupsSeparated!) {
            sourceGroupsMatches.push({
              ...match,
              targetId: targetObject.drv_trade_client_account_execution_id,
            });
          }

          // Add charge to target matches
          if (!targetObject.groupsSeparated) {
            const sourceTotalCharge = sourceObject.modifiedTotalCharge!;
            const sourceQuantitySum = sourceObject.modifiedExecQty!;

            const targetWithCharge: IDRV = {
              ...targetObject,
              charge:
                (Number(targetObject.quantity) * sourceTotalCharge) /
                sourceQuantitySum,
            };

            targetMatches.push(targetWithCharge);
          } else {
            // Iterate over target matches to add charge
            for (const target of targetObject.groupsSeparated) {
              const sourceTotalCharge = sourceObject.modifiedTotalCharge!;
              const sourceQuantitySum = sourceObject.modifiedExecQty!;

              const targetWithCharge: IDRV = {
                ...target,
                charge:
                  (Number(target.quantity) * sourceTotalCharge) /
                  sourceQuantitySum,
              };

              targetMatches.push(targetWithCharge);
            }
          }
        } else {
          sourceGroupsUnmatchesNV1.push(sourceObject);
        }
      }

      // Run through each row on target, get target unmatches
      for (const targetObject of targetUnique) {
        const sourceObject = sourceGroupsUnmatchesNVN.find(
          ({ key }) => key === targetObject.key,
        );

        if (!sourceObject) {
          targetGroupsUnmatchesNV1.push(targetObject);
        }
      }

      //- |-------------------| -//
      //- |-----  1 V 1  -----| -//
      //- |-------------------| -//

      sourceUnique.push(
        ...(separateGroups(sourceGroupsUnmatchesNV1) as IWEX[]),
      );

      // Run through each row on source, get source matches, unmatches & target unmatches
      for (const sourceObject of sourceUnique) {
        // Check for match between source & target
        const targetObject = targetGroupsUnmatchesNV1.find(({ key }) => {
          const isMatch = sourceObject.key === key;
          return isMatch;
        });

        if (targetObject) {
          // Check if match as already exist by id
          const targetIds = sourceGroupsMatches.map(({ targetId }) => targetId);
          if (
            targetIds.includes(
              targetObject.drv_trade_client_account_execution_id,
            )
          ) {
            sourceGroupsUnmatches1V1.push(sourceObject);
            continue;
          }

          sourceGroupsMatches.push({
            ...sourceObject,
            targetId: targetObject.drv_trade_client_account_execution_id,
          });

          if (!targetObject.groupsSeparated) {
            // Add charge to target matches
            const sourceTotalCharge = sourceObject.modifiedTotalCharge!;
            const sourceQuantitySum = sourceObject.modifiedExecQty!;

            const targetWithCharge: IDRV = {
              ...targetObject,
              charge:
                (Number(targetObject.quantity) * sourceTotalCharge) /
                sourceQuantitySum,
            };

            targetMatches.push(targetWithCharge);
          } else {
            // Iterate over target matches to add charge
            for (const target of targetObject.groupsSeparated) {
              const sourceTotalCharge = sourceObject.modifiedTotalCharge!;
              const sourceQuantitySum = sourceObject.modifiedExecQty!;

              const targetWithCharge: IDRV = {
                ...target,
                charge:
                  (Number(target.quantity) * sourceTotalCharge) /
                  sourceQuantitySum,
              };

              targetMatches.push(targetWithCharge);
            }
          }
        } else {
          sourceGroupsUnmatches1V1.push(sourceObject);
        }
      }

      // Run through each row on target, get target unmatches
      for (const targetObject of targetUnique) {
        const sourceObject = sourceGroupsUnmatches1V1.find(
          ({ key }) => key === targetObject.key,
        );

        if (!sourceObject) {
          targetGroupsUnmatches1V1.push(targetObject);
        }
      }

      // Total charge
      const totalCharge =
        Math.round(
          (sourceModified.reduce(
            (a, b) => a + (b.modifiedTotalCharge || 0),
            0,
          ) +
            Number.EPSILON) *
            100,
        ) / 100;

      // Unmatched sum charge
      const unmatchSumCharge =
        Math.round(
          (sourceGroupsUnmatches1V1.reduce(
            (a, b) => a + (b!.modifiedTotalCharge || 0),
            0,
          ) +
            Number.EPSILON) *
            100,
        ) / 100;

      // Matched sum Charge
      const matchSumCharge =
        Math.round(
          (sourceGroupsMatches.reduce(
            (a, b) => a + (b!.modifiedTotalCharge || 0),
            0,
          ) +
            Number.EPSILON) *
            100,
        ) / 100;

      // Total count
      const totalCount = sourceModified.length;

      // Match count
      const matchCount = sourceGroupsMatches.length;

      // Unmatch count
      const unmatchCount = sourceGroupsUnmatches1V1.length;

      // Unmatch group count
      const unmatchGroupCount = sourceGroupsUnmatchesNV1.length;

      // matched Sum Percentage
      const matchSumPercentage =
        Math.round(
          ((matchCount * 100) / sourceModified.length + Number.EPSILON) * 100,
        ) / 100;

      // unmatched Sum Percentage
      const unmatchSumPercentage = Number(
        ((unmatchSumCharge / totalCharge) * 100).toFixed(2),
      );

      // Delete all modified fields
      sourceGroupsUnmatches1V1.forEach((element) => {
        delete element.drv_trade_client_account_execution_id;
        delete element.modifiedCommissionType;
        delete element.modifiedCommissionRate;
        delete element.modifiedTotalCharge;
        delete element.modifiedAveragePrice;
        delete element.modifiedPortfolio;
        delete element.modifiedSecurity;
        delete element.modifiedExecQty;
        delete element.modifiedCallPut;
        delete element.groupsSeparated;
        delete element.modifiedExpiry;
        delete element.modifiedStrike;
        delete element.modifiedDate;
        delete element.modifiedUser;
        delete element.modifiedSide;
        delete element.modifiedRoot;
        delete element.key;
      });

      // Convert JSON to CSV file
      converter.json2csv(sourceGroupsUnmatches1V1, (err, csv) => {
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

        fs.writeFileSync(
          `assets/unresolved-${userByID.username}-${formattedCurrentDate}.csv`,
          csv,
        );

        ServerGlobal.getInstance().logger.info(
          `<addDerivatives>: Successfully created the unresolved-${userByID.username}-${formattedCurrentDate}.csv to dir`,
        );
      });

      // Saving the derivative document in DB
      await Derivative.create({
        date: formattedCurrentDate,
        floorBrokerId: floorBrokerId,
        username: userByID.username,
        source: `${fileName}-${userByID.username}-${formattedCurrentDate}.csv`,
        drv: `DRV-${userByID.username}-${formattedCurrentDate}.csv`,
        totalCount,
        totalCharge,
        matchCount,
        matchSumCharge,
        matchSumPercentage,
        unmatchCount,
        unmatchGroupCount,
        unmatchSumCharge,
        unmatchSumPercentage,
        unresolved: `unresolved-${userByID.username}-${formattedCurrentDate}.csv`,
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
      message: "Successfully retrieved derivatives",
      data: derivatives.map((derivative) => ({
        id: derivative.id,
        date: derivative.date,
        wex: derivative.source,
        drv: derivative.drv,
        username: derivative.username,
        matchCount: derivative.matchCount,
        matchSumPercentage: derivative.matchSumPercentage,
        unmatchCount: derivative.unmatchCount,
        unresolved: derivative.unresolved,
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
  res: IGetDerivativeResponse,
) => {
  ServerGlobal.getInstance().logger.info(
    `<getDerivative>: Start processing request`,
  );

  try {
    // Get derivative
    const derivative = await Derivative.findOne({
      order: [["id", "DESC"]],
    });

    // Check if derivatives are valid
    if (!derivative) {
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
      `<getDerivative>: Successfully got derivative`,
    );

    res.status(200).send({
      success: true,
      message: "Successfully retrieved derivative",
      data: {
        wex: derivative.source,
        username: derivative.username,
        totalCount: derivative.totalCount,
        totalCharge: derivative.totalCharge,
        matchCount: derivative.matchCount,
        matchSumCharge: derivative.matchSumCharge,
        matchSumPercentage: derivative.matchSumPercentage,
        unmatchCount: derivative.unmatchCount,
        unmatchGroupCount: derivative.unmatchGroupCount,
        unmatchSumCharge: derivative.unmatchSumCharge,
        unmatchSumPercentage: derivative.unmatchSumPercentage,
        unresolved: derivative.unresolved,
      },
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

const downloadFile = async (
  req: IDownloadFileRequest,
  res: IDownloadFileResponse,
) => {
  ServerGlobal.getInstance().logger.info(
    `<downloadFiles>: Start processing request`,
  );

  try {
    const fileName = req.params.fileId;
    const filePath = __dirname + "../../../assets/" + fileName;

    // Check file path
    if (!filePath) {
      ServerGlobal.getInstance().logger.error(
        "<getDerivative>: Failed to get file",
      );

      res.status(400).send({
        success: false,
        message: "file is invalid",
      });
      return;
    }

    ServerGlobal.getInstance().logger.info(
      `<getDerivative>: Successfully downloaded file: ${fileName}`,
    );

    res.status(200).download(filePath, fileName);
    return;
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

export { addDerivatives, getDerivatives, getDerivative, downloadFile };
