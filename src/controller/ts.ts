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
  IDRV,
  IDRVObject,
  IReconciliationCharge,
  IBAML,
  IBAMLObject,
  INVNReconciliationCharge,
} from "../model/shared/derivatives";

import { removeCommas } from "../utils/derivatives";
import {
  DASHDateFormat,
  DASHGroupBy,
  DASHModifiyDollarSign,
  DASHModifiyTotalExchangeFees,
  DASHSeparateDatesObject,
  DASHUniqueDatesArray,
} from "../utils/dash";
import {
  BAMLDateFormat,
  BAMLUniqueDatesArray,
  BAMLSeparateDatesObject,
  BAMLGroupBy,
  BAMLModifiyTotalCharge,
  equalToOneGroupsBAML,
} from "../utils/baml";
import {
  DRVDateFormat,
  DRVSeparateDatesObject,
  DRVGroupBy,
  DRVUniqueDatesArray,
  DRVExpiryToMonthOnly,
  DRVExpiryToYearOnly,
  biggerThanOneGroupsDRV,
  equalToOneGroupsDRV,
} from "../utils/drv";

import {
  IAddDerivativesRequest,
  IGetDerivativesRequest,
  IGetDerivativeRequest,
  IDownloadFilesRequest,
} from "../model/express/request/derivatives";
import {
  IAddDerivativesResponse,
  IGetDerivativesResponse,
  IGetDerivativeResponse,
} from "../model/express/response/derivatives";

import { log } from "console";

const addDerivatives = async (
  req: IAddDerivativesRequest,
  res: IAddDerivativesResponse,
) => {
  ServerGlobal.getInstance().logger.info(
    `<addDerivatives>: Start processing request`,
  );

  // Find user
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

  try {
    const currentDate = new Date();
    const formattedCurrentDate = moment(currentDate).format(
      "DD-MM-YYYY-HH-mm-ss",
    );

    const floorBrokerId = req.body.floorBrokerId.toString();
    let fileName = "";

    if (floorBrokerId === "6") {
      fileName = "Dash";
    } else if (floorBrokerId === "14") {
      fileName = "BAML";
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
        "<addDerivatives>: Failed to process base64BAML/base64DRV",
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

    let source: IBAML[] | IBAML[] | IDASH[] = [];
    const DRV: IDRV[] = [];

    // Parsing csv file to JSON
    fs.createReadStream(sourceFileName)
      .pipe(csv())
      .on("data", (data: IBAML | IBAML | IDASH) => {
        source.push(data);
      });
    fs.createReadStream(DRVFileName)
      .pipe(csv())
      .on("data", (data: IDRV) => {
        DRV.push(data);
      })
      .on("end", () => {
        if (fileName === "Dash") {
        } else if (fileName === "BAML") {
          BAMLActions();
        } else if (fileName === "Broadcort") {
          BAMLActions();
        }
      });

    const BAMLActions = async () => {
      let DRVGroupedCalculated: IDRV[] = [];
      let DRVGroupedEqualToOneCalculated: IDRV[] = [];
      let DRVGroupedBiggerThanOneCalculated: IDRV[] = [];

      let BAMLCanceledPairs: IBAML[] = [];
      let BAMLGroupedCalculated: IBAML[] = [];
      let BAMLNV1Matched: IBAML[] = [];
      let BAMLBiggerThanOneGroupsMatched: IBAML[] = [];
      let BAMLEqualToOneGroupsMatched: IBAML[] = [];

      let reconciliation_charge: IReconciliationCharge[] = [];

      // Modifing DRV
      const DRVModified = DRV.map((element) => {
        const modifiedDate = DRVDateFormat(element.date!);
        const modifiedSide = element.side?.charAt(0).toLowerCase();
        const modifiedQuantity = Number(
          removeCommas(element.quantity?.toString()!),
        );
        const modifiedSymbol = element.symbol?.toLowerCase();
        const modifiedExpiry = DRVDateFormat(element.expiry!);
        const modifiedStrike = Number(removeCommas(element.strike));
        const modifiedOption = element.option?.charAt(0).toLowerCase();
        const modifiedPrice = Number(
          Number(removeCommas(element.price?.toString())).toFixed(2),
        );

        return {
          ...element,
          modifiedDate,
          modifiedSide,
          modifiedQuantity,
          modifiedSymbol,
          modifiedExpiry,
          modifiedStrike,
          modifiedOption,
          modifiedPrice,
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
          Number(removeCommas(element.Price)).toFixed(2),
        );
        const modifiedQty = Number(removeCommas(element.Qty!));
        const modifiedOC = element["O/C"]?.toLowerCase();
        const modifiedCFM = element.CFM?.toLowerCase();
        const modifiedExBrok = element["Ex Brok"]?.toLowerCase();
        const modifiedTotalCharges = Number(
          BAMLModifiyTotalCharge(
            removeCommas(element["Total Charges"])!.toString(),
          ),
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
          modifiedTotalCharges,
        };
      });

      const BAMLUniqueDates = BAMLUniqueDatesArray(BAMLModified);
      const DRVSeparatedByDates = DRVSeparateDatesObject(DRVModified);

      // Grouping BAML by Trade Date, Exch, B/S, P/C, Class, Sym, Mo, Yr, Strike, O/C, CFM, Ex Brok
      const BAMLGrouped = BAMLGroupBy(BAMLCanceledPairs, (element: IBAML) => {
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
          element.modifiedExBrok,
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
                });

              // Sum qty
              item.modifiedQty = item.modifiedQty! + object.modifiedQty!;

              // Weight average price
              const curWeightAverageQty =
                object.modifiedQty! * object.modifiedPrice!;

              weightAverageQty += curWeightAverageQty;
              totalQty += object.modifiedQty!;

              item.modifiedPrice =
                Math.round(
                  (weightAverageQty / totalQty + Number.EPSILON) * 100,
                ) / 100;

              // Sum total charges
              item.modifiedTotalCharges = Number(
                (
                  item.modifiedTotalCharges! + object.modifiedTotalCharges!
                ).toFixed(2),
              );

              return array.set(key, item);
            }, new Map())
            .values(),
        ];

        BAMLGroupedCalculated = BAMLGroupedCalculated.concat(result);
      }

      const BAMLGroupedSeparatedByDates = BAMLSeparateDatesObject(
        BAMLGroupedCalculated,
      );

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
          element.client_id,
        ];
      });

      // Get DRV equal to one groups and group keys
      const DRVEqualToOneGroups = equalToOneGroupsDRV(DRVGrouped);
      const DRVEqualToOneGroupsKeys = Object.keys(DRVEqualToOneGroups);

      // Sum quantity, weight average price for equal to one groups
      for (const key of DRVEqualToOneGroupsKeys) {
        let weightAverageExecQty = 0;
        let totalExecQty = 0;
        const result: IDRV[] = [
          ...DRVEqualToOneGroups[key]
            .reduce((array, object) => {
              const key = `${object.drv_trade_id}-${object.floor_broker}-${object.modifiedDate}-${object.modifiedSide}-${object.component_type}-${object.contract_type}-${object.modifiedSymbol}-${object.modifiedExpiry}-${object.modifiedStrike}-${object.modifiedOption}-${object.client_id}`;
              const item: IDRV =
                array.get(key) ||
                Object.assign({}, object, {
                  modifiedQuantity: 0,
                  modifiedPrice: 0,
                });

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

        DRVGroupedEqualToOneCalculated =
          DRVGroupedEqualToOneCalculated.concat(result);
      }

      // Get DRV bigger than one groups and group keys
      const DRVBiggerThanOneGroups = biggerThanOneGroupsDRV(DRVGrouped);
      const DRVBiggerThanOneGroupKeys = Object.keys(DRVBiggerThanOneGroups);

      // Sum quantity, weight average price for bigger than one groups
      for (const key of DRVBiggerThanOneGroupKeys) {
        let weightAverageExecQty = 0;
        let totalExecQty = 0;
        const result: IDRV[] = [
          ...DRVBiggerThanOneGroups[key]
            .reduce((array, object) => {
              const key = `${object.drv_trade_id}-${object.floor_broker}-${object.modifiedDate}-${object.modifiedSide}-${object.component_type}-${object.contract_type}-${object.modifiedSymbol}-${object.modifiedExpiry}-${object.modifiedStrike}-${object.modifiedOption}-${object.client_id}`;
              const item: IDRV =
                array.get(key) ||
                Object.assign({}, object, {
                  modifiedQuantity: 0,
                  modifiedPrice: 0,
                  reconciliationCharge: [],
                });

              // Get reconciliation charge fields
              item.reconciliationCharge = [
                ...item.reconciliationCharge!,
                {
                  drv_trade_client_account_execution_id:
                    object.drv_trade_client_account_execution_id,
                  quantity: object.modifiedQuantity,
                },
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
                  (weightAverageExecQty / totalExecQty + Number.EPSILON) * 100,
                ) / 100;

              return array.set(key, item);
            }, new Map())
            .values(),
        ];

        DRVGroupedBiggerThanOneCalculated =
          DRVGroupedBiggerThanOneCalculated.concat(result);
      }

      DRVGroupedCalculated = DRVGroupedCalculated.concat(
        DRVGroupedBiggerThanOneCalculated,
        DRVGroupedEqualToOneCalculated,
      );

      const DRVBiggerThanOneGroupedSeparatedByDates = DRVSeparateDatesObject(
        DRVGroupedBiggerThanOneCalculated,
      );
      const DRVEqualToOneGroupedSeparatedByDates = DRVSeparateDatesObject(
        DRVGroupedEqualToOneCalculated,
      );

      const BAMLByDRVGrouped = BAMLGroupedCalculated.filter(
        (row) =>
          !DRVGroupedCalculated.find(
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
            }) =>
              row.modifiedTradeDate === modifiedDate &&
              row.modifiedBS === modifiedSide &&
              row.modifiedSym === modifiedSymbol &&
              row.modifiedPC === modifiedOption &&
              row.modifiedQty === modifiedQuantity &&
              row.modifiedPrice === modifiedPrice &&
              row.modifiedStrike === modifiedStrike &&
              row.Mo === modifiedExpiryMonthOnly &&
              row.Yr === modifiedExpiryYearOnly,
          ),
      );

      // Get BAML matched rows by group BAML V DRV bigger than one groups
      for (const date of BAMLUniqueDates) {
        // Check if date is valid
        if (!date) {
          ServerGlobal.getInstance().logger.error(
            "<addDerivatives>: Failed because date is invalid",
          );

          res.status(400).send({
            success: false,
            message: "date is invalid",
          });
          return;
        }

        // Check if file is valid
        if (
          !BAMLGroupedSeparatedByDates[date] ||
          !DRVBiggerThanOneGroupedSeparatedByDates[date]
        )
          break;

        const BAMLMatched = BAMLGroupedSeparatedByDates[date].filter((row) =>
          DRVBiggerThanOneGroupedSeparatedByDates[date].find(
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
              reconciliationCharge,
            }) => {
              row.reconciliationCharge = reconciliationCharge;
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
            },
          ),
        );

        BAMLBiggerThanOneGroupsMatched =
          BAMLBiggerThanOneGroupsMatched.concat(BAMLMatched);
      }

      // Return reconciliation charge, total charge and exec qty
      const BAMLReconciliationChargesNVN: INVNReconciliationCharge[] =
        BAMLBiggerThanOneGroupsMatched.map((object) => {
          return {
            reconciliationCharge: object.reconciliationCharge,
            totalCharge: object.modifiedTotalCharges,
            execQtySum: object.modifiedQty,
          };
        });

      // Get matched N V N rows object
      const matchedNVN: IReconciliationCharge[] =
        BAMLReconciliationChargesNVN.map(
          ({ reconciliationCharge, totalCharge, execQtySum }) =>
            reconciliationCharge!.map(
              ({ drv_trade_client_account_execution_id, quantity }) => ({
                drv_trade_floor_broker_id: floorBrokerId,
                drv_trade_client_account_execution_id:
                  drv_trade_client_account_execution_id,
                charge: (totalCharge! * quantity!) / execQtySum!,
              }),
            ),
        ).flat();

      // Get BAML matched rows by group BAML V DRV equal to one groups
      for (const date of BAMLUniqueDates) {
        // Check if date is valid
        if (!date) {
          ServerGlobal.getInstance().logger.error(
            "<addDerivatives>: Failed because date is invalid",
          );

          res.status(400).send({
            success: false,
            message: "date is invalid",
          });
          return;
        }

        // Check if file is valid
        if (
          !BAMLGroupedSeparatedByDates[date] ||
          !DRVEqualToOneGroupedSeparatedByDates[date]
        )
          break;

        const BAMLMatched = BAMLGroupedSeparatedByDates[date].filter((row) =>
          DRVEqualToOneGroupedSeparatedByDates[date].find(
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
              drv_trade_client_account_execution_id,
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
            },
          ),
        );

        BAMLEqualToOneGroupsMatched =
          BAMLEqualToOneGroupsMatched.concat(BAMLMatched);
      }

      // Get matched N V 1 rows object
      const matchedNV1: IReconciliationCharge[] =
        BAMLEqualToOneGroupsMatched.map(
          ({ drv_trade_client_account_execution_id, modifiedTotalCharges }) => {
            return {
              drv_trade_floor_broker_id: floorBrokerId,
              drv_trade_client_account_execution_id,
              charge: modifiedTotalCharges,
            };
          },
        );

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
            Yr,
          }) =>
            row.modifiedTradeDate === modifiedTradeDate &&
            row.modifiedBS === modifiedBS &&
            row.modifiedSym === modifiedSym &&
            row.modifiedPC === modifiedPC &&
            row.modifiedQty === modifiedQty &&
            row.modifiedPrice === modifiedPrice &&
            row.modifiedStrike === modifiedStrike &&
            row.Mo === Mo &&
            row.Yr === Yr,
        ),
      );

      const BAMLVDRVUniqueDates = BAMLUniqueDatesArray(BAMLByDRVGroup);
      const BAMLVDRVSeparatedByDates = BAMLSeparateDatesObject(BAMLByDRVGroup);

      // Group BAML V 1 DRV
      for (const date of BAMLVDRVUniqueDates) {
        // Check if date is valid
        if (!date) {
          ServerGlobal.getInstance().logger.error(
            "<addDerivatives>: Failed because date is invalid",
          );

          res.status(400).send({
            success: false,
            message: "date is invalid",
          });
          return;
        }

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
              drv_trade_client_account_execution_id,
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
            },
          ),
        );

        BAMLNV1Matched = BAMLNV1Matched.concat(BAMLMatched);
      }

      // Get matched 1 V 1 rows object
      const matched1V1: IReconciliationCharge[] = BAMLNV1Matched.map(
        ({ drv_trade_client_account_execution_id, modifiedTotalCharges }) => {
          return {
            drv_trade_floor_broker_id: floorBrokerId,
            drv_trade_client_account_execution_id,
            charge: modifiedTotalCharges,
          };
        },
      );

      const BAMLGroupedByDRV = BAMLByDRVGroup.filter(
        (row) =>
          !DRVModified.find(
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
            }) =>
              row.modifiedTradeDate === modifiedDate &&
              row.modifiedBS === modifiedSide &&
              row.modifiedSym === modifiedSymbol &&
              row.modifiedPC === modifiedOption &&
              row.modifiedQty === modifiedQuantity &&
              row.modifiedPrice === modifiedPrice &&
              row.modifiedStrike === modifiedStrike &&
              row.Mo === modifiedExpiryMonthOnly &&
              row.Yr === modifiedExpiryYearOnly,
          ),
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
            Yr,
          }) =>
            row.modifiedTradeDate === modifiedTradeDate &&
            row.modifiedBS === modifiedBS &&
            row.modifiedSym === modifiedSym &&
            row.modifiedPC === modifiedPC &&
            row.modifiedQty === modifiedQty &&
            row.modifiedPrice === modifiedPrice &&
            row.modifiedStrike === modifiedStrike &&
            row.Mo === Mo &&
            row.Yr === Yr,
        ),
      );

      const BAMLunresolved = BAMLGroupedByBAML.filter(
        (row) =>
          !DRVModified.find(
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
            }) =>
              row.modifiedTradeDate === modifiedDate &&
              row.modifiedBS === modifiedSide &&
              row.modifiedSym === modifiedSymbol &&
              row.modifiedPC === modifiedOption &&
              row.modifiedQty === modifiedQuantity &&
              row.modifiedPrice === modifiedPrice &&
              row.modifiedStrike === modifiedStrike &&
              row.Mo === modifiedExpiryMonthOnly &&
              row.Yr === modifiedExpiryYearOnly,
          ),
      );

      // Concating matched reconciliation_charge
      reconciliation_charge = reconciliation_charge.concat(
        matchedNVN,
        matchedNV1,
        matched1V1,
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
        (n, { modifiedTotalCharges }) => n + modifiedTotalCharges,
        0,
      );

      // Unmatched unresolved charge
      const unmatchedUnresolvedCharge = BAMLunresolved.reduce(
        (n, { modifiedTotalCharges }) => n + modifiedTotalCharges!,
        0,
      );

      // Matched Sum Charge
      const matchedSumCharge = totalCharge - unmatchedUnresolvedCharge;

      // Unmatched Sum Charge
      const unmatchedSumCharge = totalCharge - matchedSumCharge;

      // Matched count
      const matchedCount = BAMLModified.length - BAMLunresolved.length;

      // matched Sum Percentage
      const matchedSumPercentage = (matchedCount * 100) / BAMLModified.length;

      // unmatched Sum Percentage
      const unmatchedSumPercentage = (unmatchedSumCharge / totalCharge) * 100;

      // Delete all modified fields
      // BAMLunresolved.forEach((element) => {
      //   delete element.modifiedTradeDate;
      //   delete element.modifiedExch;
      //   delete element.modifiedBS;
      //   delete element.modifiedPC;
      //   delete element.modifiedClass;
      //   delete element.modifiedSym;
      //   delete element.modifiedStrike;
      //   delete element.modifiedPrice;
      //   delete element.modifiedQty;
      //   delete element.modifiedOC;
      //   delete element.modifiedCFM;
      //   delete element.modifiedExBrok;
      //   delete element.modifiedTotalCharges;
      //   delete element.drv_trade_client_account_execution_id;
      //   delete element.reconciliationCharge;
      // });

      // Convert JSON to CSV file
      converter.json2csv(reconciliation_charge, (err, csv) => {
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
        totalCount: BAMLModified.length,
        totalCharge: totalCharge,
        matchedCount: matchedCount,
        matchSumCharge: matchedSumCharge,
        matchedSumPercentage: matchedSumPercentage,
        unmatchedCount: BAMLunresolved.length,
        unmatchedGroupCount: BAMLByDRVGrouped.length,
        unmatchedSumCharge: unmatchedSumCharge,
        unmatchedSumPercentage: unmatchedSumPercentage,
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
