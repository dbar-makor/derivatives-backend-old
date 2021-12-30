import fs from "fs";
import csv from "csv-parser";
import moment from "moment";
import converter from "json-2-csv";

import ServerGlobal from "../server-global";

import Derivative from "../model/derivative";
import User from "../model/user";

import { removeCommas } from "../utils/derivatives";
import {
  WEXDatesObject,
  WEXUniqueDatesArray,
  WEXGroupBy,
  WEXDateFormat,
  formatWEXExpiry,
  WEXModifiyTotalCharge,
} from "../utils/wex";
import {
  DRVDateFormat,
  DRVExpiryFormat,
  DRVDatesObject,
  DRVGroupBy,
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

import { IDRV, IWEX } from "../model/shared/derivatives";

const addDerivatives = async (
  req: IAddDerivativesRequest,
  res: IAddDerivativesResponse
) => {
  ServerGlobal.getInstance().logger.info(
    `<addDerivatives>: Start processing request`
  );

  // Find the user
  const userByID = await User.findByPk(req.user_id);

  if (!userByID) {
    ServerGlobal.getInstance().logger.error(
      `<editProfile>: Failed to get user details for user id ${req.user_id}`
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
      "DD-MM-YYYY-HH-mm-ss"
    );

    const base64WEX = req.body[0].file;
    const base64DRV = req.body[1].file;
    const DRV: IDRV[] = [];
    const WEX: IWEX[] = [];
    let WEXCanceledPairs: IWEX[] = [];
    let WEXunresolved: IWEX[] = [];
    let WEXGroupedByDRV: IWEX[] = [];
    let WEXByGroupedWEX: IWEX[] = [];
    let WEXByGroupedDRV: IWEX[] = [];
    let WEXGroupedCalc: IWEX[] = [];
    let DRVGroupedCalc: IDRV[] = [];
    let WEXVDRV: IWEX[] = [];

    // Check if WEX base64WEX/base64WEX are valid
    if (!base64WEX || !base64DRV) {
      ServerGlobal.getInstance().logger.error(
        "<addDerivatives>: Failed to process base64WEX/base64DRV"
      );

      res.status(400).send({
        success: false,
        message: "invalid files",
      });
      return;
    }

    const WEXSplited = base64WEX.split(";base64,").pop();
    const DRVSplited = base64DRV.split(";base64,").pop();

    // Check if WEX base64WEX/base64WEX are valid
    if (!WEXSplited && !DRVSplited) {
      ServerGlobal.getInstance().logger.error(
        "<addDerivatives>: Failed to process WEXSplited/DRVSplited"
      );

      res.status(400).send({
        success: false,
        message: "invalid files",
      });
      return;
    }

    fs.writeFileSync(
      `assets/WEX-${userByID.username}-${formattedCurrentDate}.csv`,
      WEXSplited!,
      {
        encoding: "base64",
      }
    );
    fs.writeFileSync(
      `assets/DRV-${userByID.username}-${formattedCurrentDate}.csv`,
      DRVSplited!,
      {
        encoding: "base64",
      }
    );

    fs.createReadStream(
      `assets/WEX-${userByID.username}-${formattedCurrentDate}.csv`
    )
      .pipe(csv())
      .on("data", (data: IWEX) => {
        WEX.push(data);
      });
    fs.createReadStream(
      `assets/DRV-${userByID.username}-${formattedCurrentDate}.csv`
    )
      .pipe(csv())
      .on("data", (data: IDRV) => {
        DRV.push(data);
      })
      .on("end", () => {
        derivativesActions();
      });

    ServerGlobal.getInstance().logger.info(
      `<addDerivatives>: Successfully created the files to dir`
    );

    const derivativesActions = async () => {
      // Modifing DRV
      const modifiedDRV = DRV.map((element) => {
        const modifiedDate = DRVDateFormat(element.date!);
        const modifiedSide = element.side?.charAt(0).toLowerCase();
        const modifiedQuantity = Number(
          removeCommas(element.quantity?.toString()!)
        );
        const modifiedSymbol = element.symbol?.toLowerCase();
        const modifiedExpiry = DRVDateFormat(element.expiry!);
        const modifiedStrike = Number(removeCommas(element.strike));
        const modifiedOption = element.option?.charAt(0).toLowerCase();
        const modifiedPrice = Number(
          Number(removeCommas(element.price?.toString())).toFixed(2)
        );
        const modifiedDRVTradeClientAccountExecutionID = Number(
          element.drv_trade_client_account_execution_id
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
          modifiedDRVTradeClientAccountExecutionID,
        };
      });

      // Modifing WEX
      const modifiedWEX = WEX.map((element) => {
        const modifiedDate = WEXDateFormat(element.Date!);
        const modifiedUser = element.User?.toLowerCase();
        const modifiedSide = element.Side?.charAt(0).toLowerCase();
        const modifiedExecQty = Number(
          removeCommas(element["Exec Qty"]?.toString()!)
        );
        const modifiedSecurity = element.Security?.toLowerCase();
        const modifiedRoot = element.Root?.toLowerCase();
        const modifiedExpiry = formatWEXExpiry(element.Expiry!);
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
          modifiedTotalCharge,
        };
      });

      const WEXUniqueDates = WEXUniqueDatesArray(modifiedWEX);
      const WEXSeparatedByDates = WEXDatesObject(modifiedWEX);
      const DRVSeparatedByDates = DRVDatesObject(modifiedDRV);
      // Remove cancelling pairs from WEX
      for (const date of WEXUniqueDates) {
        // Check if date is valid
        if (!date) {
          ServerGlobal.getInstance().logger.error(
            "<addDerivatives>: Failed because date is invalid"
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
          }
        );

        WEXCanceledPairs = WEXCanceledPairs.concat(
          WEXCanceledPairsSeparatedByDates
        );
      }

      const WEXCanceledPairsSeparatedByDates = WEXDatesObject(WEXCanceledPairs);

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

      // grouping WEX
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
                  (weightAverageExecQty / totalExecQty + Number.EPSILON) * 100
                ) / 100;

              item.modifiedTotalCharge = Number(
                (
                  item.modifiedTotalCharge! + object.modifiedTotalCharge!
                ).toFixed(2)
              );

              return array.set(key, item);
            }, new Map())
            .values(),
        ];

        WEXGroupedCalc = WEXGroupedCalc.concat(groupedWEXArrayCalculated);
      }

      const WEXGroupedUniqueDates = WEXUniqueDatesArray(WEXGroupedCalc);
      const WEXGroupedSeparatedByDates = WEXDatesObject(WEXGroupedCalc);

      // Grouping DRV by drv_trade_id, floor_broker, date, side, component_type, contract_type, symbol, expiry, strike, option, client_id
      const DRVGrouped = DRVGroupBy(modifiedDRV, (element: IDRV) => {
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

      // group DRV
      for (const element of DRVGroupedKeys) {
        let weightAverageExecQty = 0;
        let totalExecQty = 0;
        const groupedDRVArrayCalculated: IDRV[] = [
          ...DRVGrouped[element]
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
                  (weightAverageExecQty / totalExecQty + Number.EPSILON) * 100
                ) / 100;

              return array.set(key, item);
            }, new Map())
            .values(),
        ];

        DRVGroupedCalc = DRVGroupedCalc.concat(groupedDRVArrayCalculated);
      }

      const DRVGroupedSeparatedByDates = DRVDatesObject(DRVGroupedCalc);

      // group WEX V group DRV
      for (const date of WEXGroupedUniqueDates) {
        // Check if date is valid
        if (!date) {
          ServerGlobal.getInstance().logger.error(
            "<addDerivatives>: Failed because date is invalid"
          );

          res.status(400).send({
            success: false,
            message: "date is invalid",
          });
          return;
        }

        const WEXGroupedByDRV = WEXGroupedSeparatedByDates[date].filter(
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
                WEXRow.modifiedExpiry === modifiedExpiry
            )
        );

        WEXByGroupedDRV = WEXByGroupedDRV.concat(WEXGroupedByDRV);
      }

      const WEXGroupedUniqueDatesByDRVGrouped =
        WEXUniqueDatesArray(WEXByGroupedDRV);
      const WEXByDRVGroupedSeparatedByDates = WEXDatesObject(WEXByGroupedDRV);

      // group WEX V WEX
      for (const date of WEXGroupedUniqueDatesByDRVGrouped) {
        // Check if date is valid
        if (!date) {
          ServerGlobal.getInstance().logger.error(
            "<addDerivatives>: Failed because date is invalid"
          );

          res.status(400).send({
            success: false,
            message: "date is invalid",
          });
          return;
        }

        const filterdGroupedByWEX = WEXCanceledPairsSeparatedByDates[
          date
        ].filter((WEXRow) =>
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
              WEXRow.modifiedCommissionRate === modifiedCommissionRate
          )
        );

        WEXVDRV = WEXVDRV.concat(filterdGroupedByWEX);
      }

      const WEXVDRVUniqueDates = WEXUniqueDatesArray(WEXVDRV);
      const WEXVDRVSeparatedByDates = WEXDatesObject(WEXVDRV);

      // group WEX V 1 DRV
      for (const date of WEXVDRVUniqueDates) {
        // Check if date is valid
        if (!date) {
          ServerGlobal.getInstance().logger.error(
            "<addDerivatives>: Failed because date is invalid"
          );

          res.status(400).send({
            success: false,
            message: "date is invalid",
          });
          return;
        }

        const filteredWEXGrouped = WEXVDRVSeparatedByDates[date].filter(
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
                WEXRow.modifiedExpiry === modifiedExpiry
            )
        );

        WEXGroupedByDRV = WEXGroupedByDRV.concat(filteredWEXGrouped);
      }

      const WEXUniqueDatesGroupedByFilteredDRV =
        WEXUniqueDatesArray(WEXGroupedByDRV);
      const WEXGroupedByDRVSeparatedByDates = WEXDatesObject(WEXGroupedByDRV);

      //  1 WEX V 1 WEX
      for (const date of WEXUniqueDatesGroupedByFilteredDRV) {
        // Check if date is valid
        if (!date) {
          ServerGlobal.getInstance().logger.error(
            "<addDerivatives>: Failed because date is invalid"
          );

          res.status(400).send({
            success: false,
            message: "date is invalid",
          });
          return;
        }

        const filterdGroupedByWEX = WEXVDRVSeparatedByDates[date!].filter(
          (WEXRow) =>
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
                WEXRow.modifiedCommissionRate === modifiedCommissionRate
            )
        );

        WEXByGroupedWEX = WEXByGroupedWEX.concat(filterdGroupedByWEX);
      }

      const WEXByGroupedWEXUniqueDates = WEXUniqueDatesArray(WEXByGroupedWEX);
      const WEXByGroupedWEXSeparatedByDates = WEXDatesObject(WEXByGroupedWEX);

      // 1 WEX V 1 DRV
      for (const date of WEXByGroupedWEXUniqueDates) {
        // Check if date is valid
        if (!date) {
          ServerGlobal.getInstance().logger.error(
            "<addDerivatives>: Failed because date is invalid"
          );

          res.status(400).send({
            success: false,
            message: "date is invalid",
          });
          return;
        }

        const filteredByDRV = WEXByGroupedWEXSeparatedByDates[date].filter(
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
                WEXRow.modifiedExpiry === modifiedExpiry
            )
        );

        WEXunresolved = WEXunresolved.concat(filteredByDRV);
      }

      // Total charge
      const totalCharge = modifiedWEX.reduce(
        (n, { modifiedTotalCharge }) => n + modifiedTotalCharge,
        0
      );

      // Unmatched unresolved charge
      const unmatchedUnresolvedCharge = WEXunresolved.reduce(
        (n, { modifiedTotalCharge }) => n + modifiedTotalCharge!,
        0
      );

      // Matched Sum Charge
      const matchedSumCharge = totalCharge - unmatchedUnresolvedCharge;

      // Unmatched Sum Charge
      const unmatchedSumCharge = totalCharge - matchedSumCharge;

      // Matched rows
      const matchedCount = modifiedWEX.length - WEXunresolved.length;

      // matched Sum Percentage
      const matchedSumPercentage = (matchedCount * 100) / modifiedWEX.length;

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
      converter.json2csv(WEXunresolved, (err, csv) => {
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
        username: userByID.username,
        wex: `WEX-${userByID.username}-${formattedCurrentDate}.csv`,
        drv: `DRV-${userByID.username}-${formattedCurrentDate}.csv`,
        totalCount: modifiedWEX.length,
        totalCharge: totalCharge,
        matchedCount: matchedCount,
        matchSumCharge: matchedSumCharge,
        matchedSumPercentage: matchedSumPercentage,
        unmatchedCount: WEXunresolved.length,
        unmatchedGroupCount: WEXByGroupedDRV.length,
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

    // Check if derivatives are valid
    if (!derivatives) {
      ServerGlobal.getInstance().logger.error(
        "<getDerivatives>: Failed to get derivatives"
      );

      res.status(400).send({
        success: false,
        message: "derivatives are invalid",
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
      `<getDerivatives>: Failed to get derivatives because of server error: ${e}`
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
  res: IGetDerivativeResponse
) => {
  ServerGlobal.getInstance().logger.info(
    `<getDerivative>: Start processing request`
  );

  try {
    // Get derivative
    const derivative = await Derivative.findOne({
      order: [["id", "DESC"]],
    });

    // Check if derivatives are valid
    if (!derivative) {
      ServerGlobal.getInstance().logger.error(
        "<getDerivative>: Failed to get derivatives"
      );

      res.status(400).send({
        success: false,
        message: "derivatives are invalid",
      });
      return;
    }

    ServerGlobal.getInstance().logger.info(
      `<getDerivatives>: Successfully got derivative`
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
      `<getDerivatives>: Failed to get derivatives because of server error: ${e}`
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
    `<getDerivativeFiles>: Start processing request`
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
        message: "file is invalid",
      });
      return;
    }

    res.download(filePath, fileName);
  } catch (e) {
    ServerGlobal.getInstance().logger.error(
      `<getDerivatives>: Failed to download files because of server error: ${e}`
    );

    res.status(500).send({
      success: false,
      message: "Server error",
    });
    return;
  }
};

export { addDerivatives, getDerivatives, getDerivative, getDerivativeFiles };
