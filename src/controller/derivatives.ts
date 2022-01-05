import fs from "fs";
import csv from "csv-parser";
import moment from "moment";
import converter from "json-2-csv";

import ServerGlobal from "../server-global";

import User from "../model/user";
import Derivative from "../model/derivative";
import {
  IDRV,
  IDRVObject,
  IMatchedRows,
  IWEX,
  IWEXObject,
} from "../model/shared/derivatives";

import { removeCommas } from "../utils/derivatives";
import {
  WEXSeparateDatesObject,
  WEXUniqueDatesArray,
  WEXGroupBy,
  WEXDateFormat,
  WEXModifiyTotalCharge,
  WEXExpiryFormat,
} from "../utils/wex";
import {
  DRVDateFormat,
  DRVSeparateDatesObject,
  DRVGroupBy,
  DRVUniqueDatesArray,
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
    const floorBrokerId = req.body.floorBrokerId;
    let WEXBase64: string | undefined;
    let DRVBase64: string | undefined;
    const firstFile = req.body.files[0];
    const secondFile = req.body.files[1];

    if (firstFile.id === "WEX") {
      WEXBase64 = firstFile.file;
      DRVBase64 = secondFile.file;
    } else {
      DRVBase64 = firstFile.file;
      WEXBase64 = secondFile.file;
    }

    const DRV: IDRV[] = [];
    const WEX: IWEX[] = [];
    let WEXCanceledPairs: IWEX[] = [];
    let WEXVDRV: IWEX[] = [];
    let DVRSeparateGroups: IDRV[] = [];
    let WEXSeparateGroups: IWEX[] = [];
    let WEXGroupedByDRV: IWEX[] = [];
    let WEXByGroupedWEX: IWEX[] = [];
    let WEXByDRVGrouped: IWEX[] = [];
    let WEXGroupedCalculated: IWEX[] = [];
    let DRVGroupedCalculated: IDRV[] = [];
    let WEXunresolved: IWEX[] = [];
    let DRVGroupedMatched: IDRV[] = [];
    let WEXGroupedMatched: IWEX[] = [];
    let WEXGroupedV1Matched: IWEX[] = [];
    let DRVGroupedV1Matched: IDRV[] = [];
    let WEX1V1Matched: IWEX[] = [];
    let DRV1V1Matched: IDRV[] = [];
    let matchedCountMakorX: IMatchedRows[] = [];
    let matchedRows: IWEX[] = [];
    let matchedGroupedRows: IWEX[] = [];
    let qtySumArray: IDRV[] = [];

    // Check if WEX base64WEX/base64WEX are valid
    if (!WEXBase64 || !DRVBase64) {
      ServerGlobal.getInstance().logger.error(
        "<addDerivatives>: Failed to process base64WEX/base64DRV",
      );

      res.status(400).send({
        success: false,
        message: "invalid files",
      });
      return;
    }

    const WEXBase64Splited = WEXBase64.split(";base64,").pop();
    const DRVBase64Splited = DRVBase64.split(";base64,").pop();

    // Check if WEX base64WEX/base64WEX are valid
    if (!WEXBase64Splited && !DRVBase64Splited) {
      ServerGlobal.getInstance().logger.error(
        "<addDerivatives>: Failed to process WEXSplited/DRVSplited",
      );

      res.status(400).send({
        success: false,
        message: "invalid files",
      });
      return;
    }

    // Writing files to dir
    fs.writeFileSync(
      `assets/WEX-${userByID.username}-${formattedCurrentDate}.csv`,
      WEXBase64Splited!,
      {
        encoding: "base64",
      },
    );
    fs.writeFileSync(
      `assets/DRV-${userByID.username}-${formattedCurrentDate}.csv`,
      DRVBase64Splited!,
      {
        encoding: "base64",
      },
    );

    // Parsing csv file to JSON
    fs.createReadStream(
      `assets/WEX-${userByID.username}-${formattedCurrentDate}.csv`,
    )
      .pipe(csv())
      .on("data", (data: IWEX) => {
        WEX.push(data);
      });
    fs.createReadStream(
      `assets/DRV-${userByID.username}-${formattedCurrentDate}.csv`,
    )
      .pipe(csv())
      .on("data", (data: IDRV) => {
        DRV.push(data);
      })
      .on("end", () => {
        derivativesActions();
      });

    ServerGlobal.getInstance().logger.info(
      `<addDerivatives>: Successfully created the files to dir`,
    );

    const derivativesActions = async () => {
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

      // Modifing WEX
      const WEXModified = WEX.map((element) => {
        const modifiedDate = WEXDateFormat(element.Date!);
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
        const modifiedTotalCharge = WEXModifiyTotalCharge(
          element["Total Charge"]!,
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
          modifiedTotalCharge,
        };
      });

      const WEXUniqueDates = WEXUniqueDatesArray(WEXModified);
      const WEXSeparatedByDates = WEXSeparateDatesObject(WEXModified);
      const DRVSeparatedByDates = DRVSeparateDatesObject(DRVModified);

      // Remove cancelling pairs from WEX
      for (const date of WEXUniqueDates) {
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

        // Run over each row in date
        for (let i = 0; i < WEXSeparatedByDates[date].length; i++) {
          // Run over each row starting from the outer element's position
          for (let j = i + 1; j < WEXSeparatedByDates[date].length; j++) {
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
            } = WEXSeparatedByDates[date][i];
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
            } = WEXSeparatedByDates[date][j];
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
              WEXSeparatedByDates[date!][i].removed = true;
              WEXSeparatedByDates[date!][j].removed = true;
            }
          }
        }

        let WEXCanceledPairsSeparatedByDates: IWEX[] = [];

        WEXCanceledPairsSeparatedByDates = WEXSeparatedByDates[date].filter(
          (element) => {
            return !element.removed;
          },
        );

        WEXCanceledPairs = WEXCanceledPairs.concat(
          WEXCanceledPairsSeparatedByDates,
        );
      }

      const WEXCanceledPairsSeparatedByDates =
        WEXSeparateDatesObject(WEXCanceledPairs);

      // Grouping WEX by date, user, side, security, root, expiry, strike, call/put, portfolio, commission type, commission rate
      const WEXGrouped = WEXGroupBy(WEXCanceledPairs, (element: IWEX) => {
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
      const WEXGroupedKeys = Object.keys(WEXGrouped);

      // Sum exec qty, weight average price and sum total charge
      for (const element of WEXGroupedKeys) {
        let weightAverageExecQty = 0;
        let totalExecQty = 0;
        const groupedWEXArrayCalculated: IWEX[] = [
          ...WEXGrouped[element]
            .reduce((array, object) => {
              const key = `${object.modifiedDate}-${object.modifiedSide}-${object.modifiedSecurity}-${object.modifiedRoot}-${object.modifiedExpiry}-${object.modifiedStrike}-${object.modifiedCallPut}-${object.modifiedPortfolio}-${object.modifiedCommissionType}-${object.modifiedCommissionRate}`;
              const item: IWEX =
                array.get(key) ||
                Object.assign({}, object, {
                  modifiedExecQty: 0,
                  modifiedAveragePrice: 0,
                  modifiedTotalCharge: 0,
                });

              item.modifiedExecQty =
                item.modifiedExecQty! + object.modifiedExecQty!;

              const curWeightAverageExecQty =
                object.modifiedExecQty! * object.modifiedAveragePrice!;

              weightAverageExecQty += curWeightAverageExecQty;
              totalExecQty += object.modifiedExecQty!;

              item.modifiedAveragePrice =
                Math.round(
                  (weightAverageExecQty / totalExecQty + Number.EPSILON) * 100,
                ) / 100;

              item.modifiedTotalCharge = Number(
                (
                  item.modifiedTotalCharge! + object.modifiedTotalCharge!
                ).toFixed(2),
              );

              return array.set(key, item);
            }, new Map())
            .values(),
        ];

        WEXGroupedCalculated = WEXGroupedCalculated.concat(
          groupedWEXArrayCalculated,
        );
      }

      const WEXGroupedSeparatedByDates =
        WEXSeparateDatesObject(WEXGroupedCalculated);

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

      // Get WEX group keys
      const DRVGroupedKeys = Object.keys(DRVGrouped);

      // Sum quantity, weight average price
      for (const key of DRVGroupedKeys) {
        let weightAverageExecQty = 0;
        let totalExecQty = 0;
        const groupedDRVCalculated: IDRV[] = [
          ...DRVGrouped[key]
            .reduce((array, object) => {
              const key = `${object.drv_trade_id}-${object.floor_broker}-${object.modifiedDate}-${object.modifiedSide}-${object.component_type}-${object.contract_type}-${object.modifiedSymbol}-${object.modifiedExpiry}-${object.modifiedStrike}-${object.modifiedOption}-${object.client_id}`;
              const item: IDRV =
                array.get(key) ||
                Object.assign({}, object, {
                  modifiedQuantity: 0,
                  modifiedPrice: 0,
                });

              item.modifiedQuantity =
                item.modifiedQuantity! + object.modifiedQuantity!;

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

        DRVGroupedCalculated =
          DRVGroupedCalculated.concat(groupedDRVCalculated);
      }

      const DRVGroupedSeparatedByDates =
        DRVSeparateDatesObject(DRVGroupedCalculated);

      // Get WEX unmatched rows by group WEX V group DRV
      for (const date of WEXUniqueDates) {
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

        const WEXUnmatched = WEXGroupedSeparatedByDates[date].filter(
          (WEXRow) =>
            !DRVGroupedSeparatedByDates[date].find(
              ({
                modifiedDate,
                modifiedSide,
                modifiedSymbol,
                modifiedExpiry,
                modifiedStrike,
                modifiedOption,
                modifiedPrice,
                modifiedQuantity,
              }) =>
                WEXRow.modifiedDate === modifiedDate &&
                WEXRow.modifiedSide === modifiedSide &&
                WEXRow.modifiedRoot === modifiedSymbol &&
                WEXRow.modifiedCallPut === modifiedOption &&
                WEXRow.modifiedExecQty === modifiedQuantity &&
                WEXRow.modifiedAveragePrice === modifiedPrice &&
                WEXRow.modifiedStrike === modifiedStrike &&
                WEXRow.modifiedExpiry === modifiedExpiry,
            ),
        );

        const WEXMatched = WEXGroupedSeparatedByDates[date].filter((WEXRow) =>
          DRVGroupedSeparatedByDates[date].find(
            ({
              modifiedDate,
              modifiedSide,
              modifiedSymbol,
              modifiedExpiry,
              modifiedStrike,
              modifiedOption,
              modifiedPrice,
              modifiedQuantity,
            }) =>
              WEXRow.modifiedDate === modifiedDate &&
              WEXRow.modifiedSide === modifiedSide &&
              WEXRow.modifiedRoot === modifiedSymbol &&
              WEXRow.modifiedCallPut === modifiedOption &&
              WEXRow.modifiedExecQty === modifiedQuantity &&
              WEXRow.modifiedAveragePrice === modifiedPrice &&
              WEXRow.modifiedStrike === modifiedStrike &&
              WEXRow.modifiedExpiry === modifiedExpiry,
          ),
        );

        const DRVMatched = DRVGroupedSeparatedByDates[date].filter((DRVRow) =>
          WEXGroupedSeparatedByDates[date].find(
            ({
              modifiedDate,
              modifiedSide,
              modifiedRoot,
              modifiedExpiry,
              modifiedStrike,
              modifiedCallPut,
              modifiedAveragePrice,
              modifiedExecQty,
            }) =>
              DRVRow.modifiedDate === modifiedDate &&
              DRVRow.modifiedSide === modifiedSide &&
              DRVRow.modifiedSymbol === modifiedRoot &&
              DRVRow.modifiedOption === modifiedCallPut &&
              DRVRow.modifiedQuantity === modifiedExecQty &&
              DRVRow.modifiedPrice === modifiedAveragePrice &&
              DRVRow.modifiedStrike === modifiedStrike &&
              DRVRow.modifiedExpiry === modifiedExpiry,
          ),
        );

        WEXByDRVGrouped = WEXByDRVGrouped.concat(WEXUnmatched);

        WEXGroupedMatched = WEXGroupedMatched.concat(WEXMatched);
        DRVGroupedMatched = DRVGroupedMatched.concat(DRVMatched);
      }

      const WEXMatchedUniqueDates = WEXUniqueDatesArray(WEXGroupedMatched);
      const WEXMatchedSeparatedByDates =
        WEXSeparateDatesObject(WEXGroupedMatched);

      // Get WEX matched rows
      for (const date of WEXMatchedUniqueDates) {
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

        const WEXMatched = WEXGroupedSeparatedByDates[date].filter((WEXRow) =>
          WEXMatchedSeparatedByDates[date].find(
            ({
              modifiedDate,
              modifiedUser,
              modifiedSide,
              modifiedSecurity,
              modifiedRoot,
              modifiedExpiry,
              modifiedStrike,
              modifiedCallPut,
              modifiedPortfolio,
              modifiedCommissionType,
              modifiedCommissionRate,
            }) =>
              WEXRow.modifiedDate === modifiedDate &&
              WEXRow.modifiedUser === modifiedUser &&
              WEXRow.modifiedSide === modifiedSide &&
              WEXRow.modifiedSecurity === modifiedSecurity &&
              WEXRow.modifiedRoot === modifiedRoot &&
              WEXRow.modifiedExpiry === modifiedExpiry &&
              WEXRow.modifiedStrike === modifiedStrike &&
              WEXRow.modifiedCallPut === modifiedCallPut &&
              WEXRow.modifiedPortfolio === modifiedPortfolio &&
              WEXRow.modifiedCommissionType === modifiedCommissionType &&
              WEXRow.modifiedCommissionRate === modifiedCommissionRate,
          ),
        );

        WEXSeparateGroups = WEXSeparateGroups.concat(WEXMatched);
      }

      const DRVMatchedUniqueDates = DRVUniqueDatesArray(DRVGroupedMatched);
      const DRVMatchedSeparatedByDates =
        DRVSeparateDatesObject(DRVGroupedMatched);

      // Get DRV matched rows
      for (const date of DRVMatchedUniqueDates) {
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

        const DRVMatched = DRVSeparatedByDates[date].filter((DRVRow) =>
          DRVMatchedSeparatedByDates[date].find(
            ({
              drv_trade_id,
              floor_broker,
              modifiedDate,
              modifiedSide,
              component_type,
              contract_type,
              modifiedSymbol,
              modifiedExpiry,
              modifiedStrike,
              modifiedOption,
              client_id,
            }) =>
              DRVRow.drv_trade_id === drv_trade_id &&
              DRVRow.floor_broker === floor_broker &&
              DRVRow.modifiedDate === modifiedDate &&
              DRVRow.modifiedSide === modifiedSide &&
              DRVRow.component_type === component_type &&
              DRVRow.contract_type === contract_type &&
              DRVRow.modifiedSymbol === modifiedSymbol &&
              DRVRow.modifiedExpiry === modifiedExpiry &&
              DRVRow.modifiedStrike === modifiedStrike &&
              DRVRow.modifiedOption === modifiedOption &&
              DRVRow.client_id === client_id,
          ),
        );

        DVRSeparateGroups = DVRSeparateGroups.concat(DRVMatched);
      }

      for (let i = 0; i < DVRSeparateGroups.length; i++) {
        matchedRows.push({
          ...DVRSeparateGroups[i],
          ...WEXSeparateGroups.find(
            (WEXRow) =>
              WEXRow.modifiedDate === DVRSeparateGroups[i].modifiedDate &&
              WEXRow.modifiedSide === DVRSeparateGroups[i].modifiedSide &&
              WEXRow.modifiedRoot === DVRSeparateGroups[i].modifiedSymbol &&
              WEXRow.modifiedCallPut === DVRSeparateGroups[i].modifiedOption &&
              WEXRow.modifiedExecQty ===
                DVRSeparateGroups[i].modifiedQuantity &&
              WEXRow.modifiedAveragePrice ===
                DVRSeparateGroups[i].modifiedPrice &&
              WEXRow.modifiedStrike === DVRSeparateGroups[i].modifiedStrike &&
              WEXRow.modifiedExpiry === DVRSeparateGroups[i].modifiedExpiry,
          ),
        });
      }

      const matchedGroupVS1: IMatchedRows[] = matchedRows.map(
        ({ drv_trade_client_account_execution_id, modifiedTotalCharge }) => {
          return {
            charge: modifiedTotalCharge,
            drv_trade_client_account_execution_id,
            drv_trade_floor_broker_id: floorBrokerId,
          };
        },
      );

      const DRVMatchedUndefined = matchedRows.filter(
        (e) => e.modifiedUser === undefined,
      );

      const DRVMatched = matchedGroupVS1.filter((e) => e.charge !== undefined);

      const DRVMatchedGrouped = DRVGroupBy(
        DRVMatchedUndefined,
        (element: IDRV) => {
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
        },
      );

      // Get WEX group keys
      const DRVMatchedGroupedKeys = Object.keys(DRVMatchedGrouped);

      // Give DRV sum array
      for (const key of DRVMatchedGroupedKeys) {
        const qty = DRVMatchedGrouped[key].map(({ modifiedQuantity }) => {
          return modifiedQuantity;
        });

        const qtySum = qty.reduce((a, b) => a! + b!, 0);

        for (let i = 0; i < DRVMatchedGrouped[key].length; i++) {
          DRVMatchedGrouped[key][i].quantitySum = qtySum;
          qtySumArray = qtySumArray.concat(DRVMatchedGrouped[key][i]);
        }
      }

      for (let i = 0; i < qtySumArray.length; i++) {
        matchedGroupedRows.push({
          ...qtySumArray[i],
          ...WEXSeparateGroups.find(
            (WEXRow) =>
              WEXRow.modifiedDate === qtySumArray[i].modifiedDate &&
              WEXRow.modifiedSide === qtySumArray[i].modifiedSide &&
              WEXRow.modifiedRoot === qtySumArray[i].modifiedSymbol &&
              WEXRow.modifiedCallPut === qtySumArray[i].modifiedOption &&
              WEXRow.modifiedExecQty === qtySumArray[i].quantitySum &&
              WEXRow.modifiedAveragePrice === qtySumArray[i].modifiedPrice &&
              WEXRow.modifiedStrike === qtySumArray[i].modifiedStrike &&
              WEXRow.modifiedExpiry === qtySumArray[i].modifiedExpiry,
          ),
        });
      }

      const matchedGroupVGroup: IMatchedRows[] = matchedGroupedRows.map(
        ({
          drv_trade_client_account_execution_id,
          modifiedTotalCharge,
          quantitySum,
          modifiedQuantity,
        }) => {
          const chargeCalc =
            (Number(modifiedQuantity!) * modifiedTotalCharge!) / quantitySum!;

          return {
            charge: chargeCalc,
            drv_trade_client_account_execution_id,
            drv_trade_floor_broker_id: floorBrokerId,
          };
        },
      );

      const WEXGroupedUniqueDatesByDRVGrouped =
        WEXUniqueDatesArray(WEXByDRVGrouped);
      const WEXByDRVGroupedSeparatedByDates =
        WEXSeparateDatesObject(WEXByDRVGrouped);

      // Get WEX unmatched rows by group WEX V WEX
      for (const date of WEXGroupedUniqueDatesByDRVGrouped) {
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

        const WEXUnmatched = WEXCanceledPairsSeparatedByDates[date].filter(
          (WEXRow) =>
            WEXByDRVGroupedSeparatedByDates[date].find(
              ({
                modifiedDate,
                modifiedUser,
                modifiedSide,
                modifiedSecurity,
                modifiedRoot,
                modifiedExpiry,
                modifiedStrike,
                modifiedCallPut,
                modifiedPortfolio,
                modifiedCommissionType,
                modifiedCommissionRate,
              }) =>
                WEXRow.modifiedDate === modifiedDate &&
                WEXRow.modifiedUser === modifiedUser &&
                WEXRow.modifiedSide === modifiedSide &&
                WEXRow.modifiedSecurity === modifiedSecurity &&
                WEXRow.modifiedRoot === modifiedRoot &&
                WEXRow.modifiedExpiry === modifiedExpiry &&
                WEXRow.modifiedStrike === modifiedStrike &&
                WEXRow.modifiedCallPut === modifiedCallPut &&
                WEXRow.modifiedPortfolio === modifiedPortfolio &&
                WEXRow.modifiedCommissionType === modifiedCommissionType &&
                WEXRow.modifiedCommissionRate === modifiedCommissionRate,
            ),
        );

        WEXVDRV = WEXVDRV.concat(WEXUnmatched);
      }

      const WEXVDRVUniqueDates = WEXUniqueDatesArray(WEXVDRV);
      const WEXVDRVSeparatedByDates = WEXSeparateDatesObject(WEXVDRV);

      // Group WEX V 1 DRV
      for (const date of WEXVDRVUniqueDates) {
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

        const WEXUnmatched = WEXVDRVSeparatedByDates[date].filter(
          (WEXRow) =>
            !DRVSeparatedByDates[date].find(
              ({
                modifiedDate,
                modifiedSide,
                modifiedSymbol,
                modifiedExpiry,
                modifiedStrike,
                modifiedOption,
                modifiedPrice,
                modifiedQuantity,
              }) =>
                WEXRow.modifiedDate === modifiedDate &&
                WEXRow.modifiedSide === modifiedSide &&
                WEXRow.modifiedRoot === modifiedSymbol &&
                WEXRow.modifiedCallPut === modifiedOption &&
                WEXRow.modifiedExecQty === modifiedQuantity &&
                WEXRow.modifiedAveragePrice === modifiedPrice &&
                WEXRow.modifiedStrike === modifiedStrike &&
                WEXRow.modifiedExpiry === modifiedExpiry,
            ),
        );

        const WEXMatched = WEXVDRVSeparatedByDates[date].filter((WEXRow) =>
          DRVSeparatedByDates[date].find(
            ({
              modifiedDate,
              modifiedSide,
              modifiedSymbol,
              modifiedExpiry,
              modifiedStrike,
              modifiedOption,
              modifiedPrice,
              modifiedQuantity,
            }) =>
              WEXRow.modifiedDate === modifiedDate &&
              WEXRow.modifiedSide === modifiedSide &&
              WEXRow.modifiedRoot === modifiedSymbol &&
              WEXRow.modifiedCallPut === modifiedOption &&
              WEXRow.modifiedExecQty === modifiedQuantity &&
              WEXRow.modifiedAveragePrice === modifiedPrice &&
              WEXRow.modifiedStrike === modifiedStrike &&
              WEXRow.modifiedExpiry === modifiedExpiry,
          ),
        );

        const DRVMatched = DRVSeparatedByDates[date].filter((DRVRow) =>
          WEXVDRVSeparatedByDates[date].find(
            ({
              modifiedDate,
              modifiedSide,
              modifiedRoot,
              modifiedExpiry,
              modifiedStrike,
              modifiedCallPut,
              modifiedAveragePrice,
              modifiedExecQty,
            }) =>
              DRVRow.modifiedDate === modifiedDate &&
              DRVRow.modifiedSide === modifiedSide &&
              DRVRow.modifiedSymbol === modifiedRoot &&
              DRVRow.modifiedOption === modifiedCallPut &&
              DRVRow.modifiedQuantity === modifiedExecQty &&
              DRVRow.modifiedPrice === modifiedAveragePrice &&
              DRVRow.modifiedStrike === modifiedStrike &&
              DRVRow.modifiedExpiry === modifiedExpiry,
          ),
        );

        WEXGroupedByDRV = WEXGroupedByDRV.concat(WEXUnmatched);

        WEXGroupedV1Matched = WEXGroupedV1Matched.concat(WEXMatched);
        DRVGroupedV1Matched = DRVGroupedV1Matched.concat(DRVMatched);
      }

      // Give WEX drv_trade_client_account_execution_id
      for (let i = 0; i < WEXGroupedV1Matched.length; i++) {
        for (let j = i; j < DRVGroupedV1Matched.length; j++) {
          const DRVId =
            DRVGroupedV1Matched[i].drv_trade_client_account_execution_id;

          WEXGroupedV1Matched[i].drv_trade_client_account_execution_id = DRVId;
          WEXGroupedV1Matched[j].drv_trade_client_account_execution_id = DRVId;
        }
      }

      const matchedGroupV1: IMatchedRows[] = WEXGroupedV1Matched.map(
        ({ drv_trade_client_account_execution_id, modifiedTotalCharge }) => {
          const chargeCalc = modifiedTotalCharge;
          return {
            drv_trade_floor_broker_id: floorBrokerId,
            drv_trade_client_account_execution_id,
            charge: chargeCalc,
          };
        },
      );

      const WEXUniqueDatesGroupedByFilteredDRV =
        WEXUniqueDatesArray(WEXGroupedByDRV);
      const WEXGroupedByDRVSeparatedByDates =
        WEXSeparateDatesObject(WEXGroupedByDRV);

      //  1 WEX V 1 WEX
      for (const date of WEXUniqueDatesGroupedByFilteredDRV) {
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

        const WEXUnmatched = WEXVDRVSeparatedByDates[date!].filter((WEXRow) =>
          WEXGroupedByDRVSeparatedByDates[date!].find(
            ({
              modifiedDate,
              modifiedUser,
              modifiedSide,
              modifiedSecurity,
              modifiedRoot,
              modifiedExpiry,
              modifiedStrike,
              modifiedCallPut,
              modifiedPortfolio,
              modifiedCommissionType,
              modifiedCommissionRate,
            }) =>
              WEXRow.modifiedDate === modifiedDate &&
              WEXRow.modifiedUser === modifiedUser &&
              WEXRow.modifiedSide === modifiedSide &&
              WEXRow.modifiedSecurity === modifiedSecurity &&
              WEXRow.modifiedRoot === modifiedRoot &&
              WEXRow.modifiedExpiry === modifiedExpiry &&
              WEXRow.modifiedStrike === modifiedStrike &&
              WEXRow.modifiedCallPut === modifiedCallPut &&
              WEXRow.modifiedPortfolio === modifiedPortfolio &&
              WEXRow.modifiedCommissionType === modifiedCommissionType &&
              WEXRow.modifiedCommissionRate === modifiedCommissionRate,
          ),
        );

        WEXByGroupedWEX = WEXByGroupedWEX.concat(WEXUnmatched);
      }

      const WEXByGroupedWEXUniqueDates = WEXUniqueDatesArray(WEXByGroupedWEX);
      const WEXByGroupedWEXSeparatedByDates =
        WEXSeparateDatesObject(WEXByGroupedWEX);

      // 1 WEX V 1 DRV
      for (const date of WEXByGroupedWEXUniqueDates) {
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

        const WEXunresolvedByDRV = WEXByGroupedWEXSeparatedByDates[date].filter(
          (WEXRow) =>
            !DRVSeparatedByDates[date].find(
              ({
                modifiedDate,
                modifiedSide,
                modifiedSymbol,
                modifiedExpiry,
                modifiedStrike,
                modifiedOption,
                modifiedPrice,
                modifiedQuantity,
              }) =>
                WEXRow.modifiedDate === modifiedDate &&
                WEXRow.modifiedSide === modifiedSide &&
                WEXRow.modifiedRoot === modifiedSymbol &&
                WEXRow.modifiedCallPut === modifiedOption &&
                WEXRow.modifiedExecQty === modifiedQuantity &&
                WEXRow.modifiedAveragePrice === modifiedPrice &&
                WEXRow.modifiedStrike === modifiedStrike &&
                WEXRow.modifiedExpiry === modifiedExpiry,
            ),
        );

        const WEXMatched = WEXByGroupedWEXSeparatedByDates[date].filter(
          (WEXRow) =>
            DRVSeparatedByDates[date].find(
              ({
                modifiedDate,
                modifiedSide,
                modifiedSymbol,
                modifiedExpiry,
                modifiedStrike,
                modifiedOption,
                modifiedPrice,
                modifiedQuantity,
              }) =>
                WEXRow.modifiedDate === modifiedDate &&
                WEXRow.modifiedSide === modifiedSide &&
                WEXRow.modifiedRoot === modifiedSymbol &&
                WEXRow.modifiedCallPut === modifiedOption &&
                WEXRow.modifiedExecQty === modifiedQuantity &&
                WEXRow.modifiedAveragePrice === modifiedPrice &&
                WEXRow.modifiedStrike === modifiedStrike &&
                WEXRow.modifiedExpiry === modifiedExpiry,
            ),
        );

        const DRVMatched = DRVSeparatedByDates[date].filter((DRVRow) =>
          WEXByGroupedWEXSeparatedByDates[date].find(
            ({
              modifiedDate,
              modifiedSide,
              modifiedRoot,
              modifiedExpiry,
              modifiedStrike,
              modifiedCallPut,
              modifiedAveragePrice,
              modifiedExecQty,
            }) =>
              DRVRow.modifiedDate === modifiedDate &&
              DRVRow.modifiedSide === modifiedSide &&
              DRVRow.modifiedSymbol === modifiedRoot &&
              DRVRow.modifiedOption === modifiedCallPut &&
              DRVRow.modifiedQuantity === modifiedExecQty &&
              DRVRow.modifiedPrice === modifiedAveragePrice &&
              DRVRow.modifiedStrike === modifiedStrike &&
              DRVRow.modifiedExpiry === modifiedExpiry,
          ),
        );

        WEXunresolved = WEXunresolved.concat(WEXunresolvedByDRV);

        WEX1V1Matched = WEX1V1Matched.concat(WEXMatched);
        DRV1V1Matched = DRV1V1Matched.concat(DRVMatched);
      }

      // Give WEX drv_trade_client_account_execution_id
      for (let i = 0; i < DRV1V1Matched.length; i++) {
        for (let j = i + 1; j < WEX1V1Matched.length; j++) {
          const charge_i = WEX1V1Matched[i].modifiedTotalCharge;
          const charge_j = WEX1V1Matched[i].modifiedTotalCharge;

          DRV1V1Matched[i].charge = charge_i;
          DRV1V1Matched[j].charge = charge_j;
        }
      }

      const matched1V1: IMatchedRows[] = DRV1V1Matched.map(
        ({ drv_trade_client_account_execution_id, charge }) => {
          return {
            drv_trade_floor_broker_id: floorBrokerId,
            drv_trade_client_account_execution_id,
            charge,
          };
        },
      );

      console.log(matched1V1);

      matchedCountMakorX = matchedCountMakorX.concat(
        DRVMatched,
        matchedGroupVGroup,
        matchedGroupV1,
        matched1V1,
      );

      // Total charge
      const totalCharge = WEXModified.reduce(
        (n, { modifiedTotalCharge }) => n + modifiedTotalCharge,
        0,
      );

      // Unmatched unresolved charge
      const unmatchedUnresolvedCharge = WEXunresolved.reduce(
        (n, { modifiedTotalCharge }) => n + modifiedTotalCharge!,
        0,
      );

      // Matched Sum Charge
      const matchedSumCharge = totalCharge - unmatchedUnresolvedCharge;

      // Unmatched Sum Charge
      const unmatchedSumCharge = totalCharge - matchedSumCharge;

      // Matched count
      const matchedCount = WEXModified.length - WEXunresolved.length;

      // matched Sum Percentage
      const matchedSumPercentage = (matchedCount * 100) / WEXModified.length;

      // unmatched Sum Percentage
      const unmatchedSumPercentage = (unmatchedSumCharge / totalCharge) * 100;

      // Delete all modified fields
      WEXunresolved.forEach((elemet) => {
        delete elemet.modifiedDate;
        delete elemet.modifiedUser;
        delete elemet.modifiedSide;
        delete elemet.modifiedExecQty;
        delete elemet.modifiedSecurity;
        delete elemet.modifiedRoot;
        delete elemet.modifiedExpiry;
        delete elemet.modifiedStrike;
        delete elemet.modifiedCallPut;
        delete elemet.modifiedAveragePrice;
        delete elemet.modifiedPortfolio;
        delete elemet.modifiedCommissionType;
        delete elemet.modifiedCommissionRate;
        delete elemet.modifiedTotalCharge;
      });

      // convert JSON to CSV file
      converter.json2csv(matchedCountMakorX, (err, csv) => {
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
        wex: `WEX-${userByID.username}-${formattedCurrentDate}.csv`,
        drv: `DRV-${userByID.username}-${formattedCurrentDate}.csv`,
        totalCount: WEXModified.length,
        totalCharge: totalCharge,
        matchedCount: matchedCount,
        matchSumCharge: matchedSumCharge,
        matchedSumPercentage: matchedSumPercentage,
        unmatchedCount: WEXunresolved.length,
        unmatchedGroupCount: WEXByDRVGrouped.length,
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
        wex: derivative.wex,
        drv: derivative.drv,
        username: derivative.username,
        matchedCount: derivative.matchedCount,
        matchedSumPercentage: derivative.matchedSumPercentage,
        unmatchedCount: derivative.unmatchedCount,
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
      `<getDerivatives>: Successfully got derivative`,
    );

    res.status(200).send({
      success: true,
      message: "Successfully retrieved derivative",
      data: {
        wex: derivative.wex,
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

const getDerivativeFiles = async (req: IDownloadFilesRequest, res: any) => {
  ServerGlobal.getInstance().logger.info(
    `<getDerivativeFiles>: Start processing request`,
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

export { addDerivatives, getDerivatives, getDerivative, getDerivativeFiles };
