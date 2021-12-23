import fs from "fs";
import csv from "csv-parser";
import moment from "moment";
import converter from "json-2-csv";

import ServerGlobal from "../server-global";

import Derivative from "../model/derivative";
import User from "../model/user";

import { removeCommas } from "../utils/derivatives";
import { WEXDatesArray } from "../utils/wex";

import {
  IaddDerivativesRequest,
  IGetDerivativesRequest,
  IGetDerivativeRequest,
  IDownloadFilesRequest,
} from "../model/express/request/derivatives";
import {
  IaddDerivativesResponse,
  IGetDerivativesResponse,
  IGetDerivativeResponse,
} from "../model/express/response/derivatives";

import {
  IWEXInterface,
  IDRVInterface,
  IWEXInterfaceObjectOfArrays,
  IDRVInterfaceObjectOfArrays,
} from "../model/shared/derivatives";

const addDerivatives = async (
  req: IaddDerivativesRequest,
  res: IaddDerivativesResponse
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
    const base64WEX = req.body[0].file;
    const base64DRV = req.body[1].file;
    const WEX: IWEXInterface[] = [];
    const DRVArray: IDRVInterface[] = [];
    const date = new Date();
    const formattedDate = moment(date).format("DD-MM-YYYY-HH-mm-ss");
    let canceledInversePairsWEXArray: IWEXInterface[] = [];
    let WEXArrayFilteredByDRV: IWEXInterface[] = [];
    let WEXGroupedArrayFilteredByDRV: IWEXInterface[] = [];
    let WEXfilterdByGroupedWEX: IWEXInterface[] = [];
    let WEXfilterdByGroupedDRV: IWEXInterface[] = [];
    let unresolved: IWEXInterface[] = [];
    let WEXArrayGrouped: IWEXInterface[] = [];
    let DRVArrayGrouped: IDRVInterface[] = [];

    // Check if WEX file is valid
    if (!base64WEX) {
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
    if (!base64DRV) {
      ServerGlobal.getInstance().logger.error(
        "<addDerivatives>: Failed to process DRV file because the file is invalid"
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
      `<addDerivatives>: Successfully splited the files`
    );

    fs.writeFileSync(
      `assets/WEX-${userByID.username}-${formattedDate}.csv`,
      WEXSplited!,
      {
        encoding: "base64",
      }
    );

    fs.writeFileSync(
      `assets/DRV-${userByID.username}-${formattedDate}.csv`,
      DRVSplited!,
      {
        encoding: "base64",
      }
    );

    ServerGlobal.getInstance().logger.info(
      `<addDerivatives>: Successfully encoded the files`
    );

    fs.createReadStream(`assets/WEX-${userByID.username}-${formattedDate}.csv`)
      .pipe(csv())
      .on("data", (data: IWEXInterface) => {
        WEX.push(data);
      });

    fs.createReadStream(`assets/DRV-${userByID.username}-${formattedDate}.csv`)
      .pipe(csv())
      .on("data", (data: IDRVInterface) => {
        DRVArray.push(data);
      })
      .on("end", () => {
        derivativesActions();
      });

    ServerGlobal.getInstance().logger.info(
      `<addDerivatives>: Successfully created the files to dir`
    );

    const derivativesActions = async () => {
      // Map WEX returns date only
      const WEXDates = WEXDatesArray(WEX);

      // Filter WEXDateArray returns unique dates
      const uniqueDateWEXArray = WEXDates.filter((item, pos) => {
        return WEXDates.indexOf(item) == pos;
      });

      // Separate WEX result by date
      const WEXArraySeparatedByDates: IWEXInterfaceObjectOfArrays = WEX.reduce(
        (arr, WEX) => {
          arr[WEX.Date!] = arr[WEX.Date!] || [];
          arr[WEX.Date!].push(WEX);
          return arr;
        },
        Object.create(null)
      );

      // Separate DRV result by date
      const DRVArraySeparatedByDates: IDRVInterfaceObjectOfArrays =
        DRVArray.reduce((arr, DRV) => {
          arr[DRV.date!] = arr[DRV.date!] || [];
          arr[DRV.date!].push(DRV);
          return arr;
        }, Object.create(null));

      // First step
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
              totalCharge_i?.toString().substring(1).replace(/[()]/g, "")
            );
            const numberTotalCharge_j = Number(
              totalCharge_j?.toString().substring(1).replace(/[()]/g, "")
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

            const subAveragePrice_i = averagePrice_i
              ?.toString()
              .replace("$", "");
            const subAveragePrice_j = averagePrice_j
              ?.toString()
              .replace("$", "");

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
              subAveragePrice_i === subAveragePrice_j &&
              lowerCaseCommissionType_i === lowerCaseCommissionType_j &&
              subLowerCasePortfolio_i === subLowerCasePortfolio_j
            ) {
              WEXArraySeparatedByDates[date!][i].removed = true;
              WEXArraySeparatedByDates[date!][j].removed = true;
            } else {
              WEXArraySeparatedByDates[date!][i].Side =
                WEXArraySeparatedByDates[date!][i].Side?.charAt(
                  0
                ).toLowerCase();
              WEXArraySeparatedByDates[date!][j].Side =
                WEXArraySeparatedByDates[date!][j].Side?.charAt(
                  0
                ).toLowerCase();
              WEXArraySeparatedByDates[date!][i]["Exec Qty"] = removeCommas(
                WEXArraySeparatedByDates[date!][i]["Exec Qty"]!.toString()
              );
              WEXArraySeparatedByDates[date!][j]["Exec Qty"] = removeCommas(
                WEXArraySeparatedByDates[date!][j]["Exec Qty"]!.toString()
              );
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
          canceledInversePairsWEXArraySeparatedByDates
        );
      }

      // Separate canceled inverse pair WEX result by date
      const canceledInversePairsWEXArraySeparatedByDates: IWEXInterfaceObjectOfArrays =
        canceledInversePairsWEXArray.reduce((arr, WEX) => {
          arr[WEX.Date!] = arr[WEX.Date!] || [];
          arr[WEX.Date!].push(WEX);
          return arr;
        }, Object.create(null));

      // Formatting WEX date
      const formatWEXDate = (date: string) => {
        const splitedDay = date.split("/")[0];
        const splitedMonth = date.split("/")[1];
        const removeLeadingZeroMonth = parseInt(splitedMonth, 10);
        const splitedYear = date.split("/")[2];
        return (date = `${removeLeadingZeroMonth}/${splitedDay}/${splitedYear}`);
      };

      // Formatting DRV date
      const formatDRVDate = (date: string) => {
        const splitedMonth = date.split("/")[0];
        const removeLeadingZeroMonth = parseInt(splitedMonth, 10);
        const checkIfRemoveLeadingZeroMonth = isNaN(removeLeadingZeroMonth)
          ? ""
          : removeLeadingZeroMonth;
        const splitedDayAndYear = date.substring(date.indexOf("/"));
        return (date = `${checkIfRemoveLeadingZeroMonth}${splitedDayAndYear}`);
      };

      // Second step
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
                removeCommas(WEXRow["Exec Qty"]!.toString()) ===
                  removeCommas(quantity!.toString()) &&
                Number(
                  WEXRow["Average Price"]?.toString().replace("$", "")
                ).toFixed(2) === Number(price).toFixed(2) &&
                Number(WEXRow.Strike?.substring(1)) === Number(strike) &&
                formatWEXDate(WEXRow.Expiry!) === formatDRVDate(expiry!)
            )
        );

        WEXArrayFilteredByDRV = WEXArrayFilteredByDRV.concat(filteredByDRV);
      }

      // Separate WEX Array Filtered By DRV by date
      const WEXArrayFilteredByDRVSeparatedByDates: IWEXInterfaceObjectOfArrays =
        WEXArrayFilteredByDRV.reduce((arr, WEX) => {
          arr[WEX.Date!] = arr[WEX.Date!] || [];
          arr[WEX.Date!].push(WEX);
          return arr;
        }, Object.create(null));

      const groupByWEX = (
        array: IWEXInterface[],
        f: (element: IWEXInterface) => (string | undefined)[]
      ) => {
        const groups: { [key: string]: IWEXInterface[] } = {};

        array.forEach((object) => {
          const group = f(object).join("-");

          groups[group] = groups[group] || [];
          groups[group].push(object);
        });
        return groups;
      };

      // Grouping WEX by date, user, side, security, root, expiry, strike, call/put, portfolio, commission type, commission rate
      const groupedWEXArray = groupByWEX(
        WEXArrayFilteredByDRV,
        (element: IWEXInterface) => {
          return [
            element.Date,
            element.User,
            element.Side,
            element.Security,
            element.Root,
            element.Expiry,
            element.Strike,
            element["Call/Put"],
            element.Portfolio,
            element["Commission Type"],
            element["Commission Rate"],
          ];
        }
      );

      // Get WEX group keys
      const groupedWEXArrayKeys = Object.keys(groupedWEXArray);

      // Third step
      for (const element of groupedWEXArrayKeys) {
        let weightAverageExecQty = 0;
        let totalExecQty = 0;
        const groupedWEXArrayCalculated: IWEXInterface[] = [
          ...groupedWEXArray[element]
            .reduce((array, object) => {
              const key = `${object.Date}-${object.Side}-${object.Security}-${object.Root}-${object.Expiry}-${object.Strike}-${object["Call/Put"]}-${object.Portfolio}-${object["Commission Type"]}-${object["Commission Rate"]}`;
              const item: IWEXInterface =
                array.get(key) ||
                Object.assign({}, object, {
                  "Exec Qty": 0,
                  "Average Price": 0,
                  "Total Charge": 0,
                });

              const numberItemExecQty = Number(item["Exec Qty"]);
              const numberObjectExecQty = Number(object["Exec Qty"]);

              item["Exec Qty"] = (
                numberItemExecQty + numberObjectExecQty
              ).toString();

              const curWeightAverageExecQty =
                numberObjectExecQty *
                Number(object["Average Price"]?.toString().replace("$", ""));

              weightAverageExecQty += curWeightAverageExecQty;
              totalExecQty += numberObjectExecQty;

              item["Average Price"] =
                Math.round((weightAverageExecQty / totalExecQty) * 100) / 100;

              item["Total Charge"] = parseFloat(
                Number(
                  item["Total Charge"]!.toString()
                    .substring(1)
                    .replace(/[()]/g, "")
                ) +
                  Number(
                    object["Total Charge"]!.toString()
                      .substring(1)
                      .replace(/[()]/g, "")
                  ).toString()
              ).toFixed(2);

              return array.set(key, item);
            }, new Map())
            .values(),
        ];

        WEXArrayGrouped = WEXArrayGrouped.concat(groupedWEXArrayCalculated);
      }

      // Map WEX grouped returns date only
      const WEXGroupedDateArray = WEXArrayGrouped.map((r) => r.Date);

      // Filter WEXDateArray returns unique dates
      const uniqueDateWEXGroupedArray = WEXGroupedDateArray.filter(
        (item, pos) => {
          return WEXGroupedDateArray.indexOf(item) == pos;
        }
      );

      // Separate WEX grouped by date
      const WEXGroupedArraySeparatedByDates: IWEXInterfaceObjectOfArrays =
        WEXArrayGrouped.reduce((arr, WEX) => {
          arr[WEX.Date!] = arr[WEX.Date!] || [];
          arr[WEX.Date!].push(WEX);
          return arr;
        }, Object.create(null));

      // Fourth step
      for (const date of uniqueDateWEXGroupedArray) {
        const filteredWEXGrouped = WEXGroupedArraySeparatedByDates[
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
                removeCommas(WEXRow["Exec Qty"]!.toString()) ===
                  removeCommas(quantity!.toString()) &&
                Number(
                  WEXRow["Average Price"]?.toString().replace("$", "")
                ).toFixed(2) === Number(price).toFixed(2) &&
                Number(WEXRow.Strike?.substring(1)) === Number(strike) &&
                formatWEXDate(WEXRow.Expiry!) === formatDRVDate(expiry!)
            )
        );

        WEXGroupedArrayFilteredByDRV =
          WEXGroupedArrayFilteredByDRV.concat(filteredWEXGrouped);
      }

      // Map WEX Grouped Array Filtered By DRV returns date only
      const dateWEXGroupedArrayFilteredByDRV = WEXGroupedArrayFilteredByDRV.map(
        (r) => r.Date
      );

      // Filter WEXDateArray returns unique dates
      const uniqueDateWEXGroupedArrayFilteredByDRV =
        dateWEXGroupedArrayFilteredByDRV.filter((item, pos) => {
          return dateWEXGroupedArrayFilteredByDRV.indexOf(item) == pos;
        });

      // Separate WEX grouped by date
      const WEXGroupedArrayFilteredByDRVSeparatedByDates: IWEXInterfaceObjectOfArrays =
        WEXGroupedArrayFilteredByDRV.reduce((arr, WEX) => {
          arr[WEX.Date!] = arr[WEX.Date!] || [];
          arr[WEX.Date!].push(WEX);
          return arr;
        }, Object.create(null));

      // Fifth step
      for (const date of uniqueDateWEXGroupedArrayFilteredByDRV) {
        const filterdGroupedByWEX = WEXArrayFilteredByDRVSeparatedByDates[
          date!
        ].filter((WEXRow) =>
          WEXGroupedArrayFilteredByDRVSeparatedByDates[date!].find(
            ({
              Date,
              User,
              Side,
              Security,
              Root,
              Expiry,
              Strike,
              "Call/Put": callPut,
              Portfolio,
              "Commission Type": commissionType,
              "Commission Rate": commissionRate,
            }) =>
              WEXRow.Date === Date &&
              WEXRow.User?.toLowerCase() === User?.toLowerCase() &&
              WEXRow.Side!.charAt(0).toLowerCase() ===
                Side!.charAt(0).toLowerCase() &&
              WEXRow.Security!.toLowerCase() === Security!.toLowerCase() &&
              WEXRow.Root!.toLowerCase() === Root!.toLowerCase() &&
              formatWEXDate(WEXRow.Expiry!) === formatWEXDate(Expiry!) &&
              WEXRow.Strike === Strike &&
              WEXRow["Call/Put"]?.toLowerCase() === callPut?.toLowerCase() &&
              WEXRow.Portfolio?.split("-")[0].toLowerCase() ===
                Portfolio?.split("-")[0].toLowerCase() &&
              WEXRow["Commission Type"]?.toLowerCase() ===
                commissionType?.toLowerCase() &&
              WEXRow["Commission Rate"] === commissionRate
          )
        );

        WEXfilterdByGroupedWEX =
          WEXfilterdByGroupedWEX.concat(filterdGroupedByWEX);
      }

      // Map WEXfilterdByGroupedWEX returns date only
      const WEXfilterdByGroupedWEXGrouped = WEXfilterdByGroupedWEX.map(
        (r) => r.Date
      );

      // Filter date WEXfilterdByGroupedWEX returns unique dates
      const uniqueDateWEXfilterdByGroupedWEX =
        WEXfilterdByGroupedWEXGrouped.filter((item, pos) => {
          return WEXfilterdByGroupedWEXGrouped.indexOf(item) == pos;
        });

      const groupByDRV = (
        array: IDRVInterface[],
        f: (element: IDRVInterface) => (string | undefined)[]
      ) => {
        const groups: { [key: string]: IDRVInterface[] } = {};

        array.forEach((object) => {
          const group = f(object).join("-");

          groups[group] = groups[group] || [];
          groups[group].push(object);
        });
        return groups;
      };

      // Grouping DRV by drv_trade_id, floor_broker, date, side, component_type, contract_type, symbol, expiry, strike, option, client_id
      const groupedDRVArray = groupByDRV(DRVArray, (element: IDRVInterface) => {
        return [
          element.drv_trade_id,
          element.floor_broker,
          element.date,
          element.side,
          element.component_type,
          element.contract_type,
          element.symbol,
          element.expiry,
          element.strike,
          element.option,
          element.client_id,
        ];
      });

      // Get WEX group keys
      const groupedDRVArrayKeys = Object.keys(groupedDRVArray);

      // Sixth step
      for (const element of groupedDRVArrayKeys) {
        let weightAverageExecQty = 0;
        let totalExecQty = 0;
        const groupedDRVArrayCalculated: IDRVInterface[] = [
          ...groupedDRVArray[element]
            .reduce((array, object) => {
              const key = `${object.drv_trade_id}-${object.floor_broker}-${object.date}-${object.side}-${object.component_type}-${object.contract_type}-${object.symbol}-${object.expiry}-${object.strike}-${object.option}-${object.client_id}`;
              const item: IDRVInterface =
                array.get(key) ||
                Object.assign({}, object, {
                  quantity: 0,
                  price: 0,
                });

              const numberItemExecQty = Number(item.quantity);
              const numberObjectExecQty = Number(object.quantity);

              item.quantity = (
                numberItemExecQty + numberObjectExecQty
              ).toString();

              const curWeightAverageExecQty =
                numberObjectExecQty * Number(object.price);

              weightAverageExecQty += curWeightAverageExecQty;
              totalExecQty += numberObjectExecQty;

              item.price =
                Math.round((weightAverageExecQty / totalExecQty) * 100) / 100;

              return array.set(key, item);
            }, new Map())
            .values(),
        ];

        DRVArrayGrouped = DRVArrayGrouped.concat(groupedDRVArrayCalculated);
      }

      // Separate DRV Array Grouped by date
      const DRVArrayGroupedSeparatedByDates: IDRVInterfaceObjectOfArrays =
        DRVArrayGrouped.reduce((arr, WEX) => {
          arr[WEX.date!] = arr[WEX.date!] || [];
          arr[WEX.date!].push(WEX);
          return arr;
        }, Object.create(null));

      // Seventh step
      for (const date of uniqueDateWEXfilterdByGroupedWEX) {
        const filterdGroupedByWEX = WEXGroupedArraySeparatedByDates[
          date!
        ].filter(
          (WEXRow) =>
            !DRVArrayGroupedSeparatedByDates[date!].find(
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
                removeCommas(WEXRow["Exec Qty"]!.toString()) ===
                  removeCommas(quantity!.toString()) &&
                Number(
                  WEXRow["Average Price"]?.toString().replace("$", "")
                ).toFixed(2) === Number(price).toFixed(2) &&
                Number(WEXRow.Strike?.substring(1)) === Number(strike) &&
                formatWEXDate(WEXRow.Expiry!) === formatDRVDate(expiry!)
            )
        );

        WEXfilterdByGroupedDRV =
          WEXfilterdByGroupedDRV.concat(filterdGroupedByWEX);
      }

      // Map WEXfilterdByGroupedDRV returns date only
      const dateWEXfilterdByGroupedDRV = WEXfilterdByGroupedDRV.map(
        (r) => r.Date
      );

      // Filter dateWEXfilterdByGroupedDRV returns unique dates
      const uniqueDatedateWEXfilterdByGroupedDRV =
        dateWEXfilterdByGroupedDRV.filter((item, pos) => {
          return dateWEXfilterdByGroupedDRV.indexOf(item) == pos;
        });

      // Separate WEXfilterdByGroupedDRV by date
      const WEXfilterdByGroupedDRVSeparatedByDates: IWEXInterfaceObjectOfArrays =
        WEXfilterdByGroupedDRV.reduce((arr, WEX) => {
          arr[WEX.Date!] = arr[WEX.Date!] || [];
          arr[WEX.Date!].push(WEX);
          return arr;
        }, Object.create(null));

      // Fifth step
      for (const date of uniqueDatedateWEXfilterdByGroupedDRV) {
        const filterdGroupedByWEX = WEXArrayFilteredByDRVSeparatedByDates[
          date!
        ].filter((WEXRow) =>
          WEXfilterdByGroupedDRVSeparatedByDates[date!].find(
            ({
              Date,
              User,
              Side,
              Security,
              Root,
              Expiry,
              Strike,
              "Call/Put": callPut,
              Portfolio,
              "Commission Type": commissionType,
              "Commission Rate": commissionRate,
            }) =>
              WEXRow.Date === Date &&
              WEXRow.User?.toLowerCase() === User?.toLowerCase() &&
              WEXRow.Side!.charAt(0).toLowerCase() ===
                Side!.charAt(0).toLowerCase() &&
              WEXRow.Security!.toLowerCase() === Security!.toLowerCase() &&
              WEXRow.Root!.toLowerCase() === Root!.toLowerCase() &&
              formatWEXDate(WEXRow.Expiry!) === formatWEXDate(Expiry!) &&
              WEXRow.Strike === Strike &&
              WEXRow["Call/Put"]?.toLowerCase() === callPut?.toLowerCase() &&
              WEXRow.Portfolio?.split("-")[0].toLowerCase() ===
                Portfolio?.split("-")[0].toLowerCase() &&
              WEXRow["Commission Type"]?.toLowerCase() ===
                commissionType?.toLowerCase() &&
              WEXRow["Commission Rate"] === commissionRate
          )
        );

        unresolved = unresolved.concat(filterdGroupedByWEX);
      }

      // convert JSON array to CSV file
      converter.json2csv(unresolved, (err, csv) => {
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
          `assets/unresolved-${userByID.username}-${formattedDate}.csv`,
          csv
        );

        ServerGlobal.getInstance().logger.info(
          `<addDerivatives>: Successfully created the unresolved-${userByID.username}-${formattedDate}.csv to dir`
        );
      });

      // Calculate matched rows
      const matchedRows = WEX.length - unresolved.length;

      console.log("matchedRows " + matchedRows);

      // Calculate complete percentage
      const completePercentageRows = (matchedRows * 100) / WEX.length;

      // Saving the derivative document in DB
      await Derivative.create({
        date: formattedDate,
        wex: `WEX-${userByID.username}-${formattedDate}.csv`,
        drv: `DRV-${userByID.username}-${formattedDate}.csv`,
        matched: matchedRows,
        unmatched: unresolved.length,
        unknown: 0,
        complete: completePercentageRows,
        unresolved: `unresolved-${userByID.username}-${formattedDate}.csv`,
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
        unresolved: derivative.unresolved,
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
      `<getDerivatives>: Successfully got the derivatives`
    );

    res.status(200).send({
      success: true,
      message: "Successfully retrieved movies",
      data: {
        wex: derivative.wex,
        drv: derivative.drv,
        matched: derivative.matched,
        unmatched: derivative.unmatched,
        unknown: derivative.unknown,
        complete: derivative.complete,
        unresolved: derivative.unresolved,
        username: derivative.username,
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
