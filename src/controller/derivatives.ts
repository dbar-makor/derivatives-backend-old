import fs from "fs";
import csv from "csv-parser";

import ServerGlobal from "../server-global";

import {
  IaddDerivativesDataRequest,
  IGetDerivativesDataRequest,
} from "../model/express/request/derivatives";
import {
  IaddDerivativesDataResponse,
  IGetDerivativesDataResponse,
} from "../model/express/response/derivatives";

import {
  IWEXInterface,
  IDRVInterface,
  IWEXInterfaceArrayOfArrays,
} from "../model/shared/derivatives";

const addDerivativesData = async (
  req: IaddDerivativesDataRequest,
  res: IaddDerivativesDataResponse
) => {
  ServerGlobal.getInstance().logger.info(
    `<addDerivativesData>: Start processing request`
  );

  try {
    const base64WEXFile = req.body[0].file;
    const WEXFileOne = base64WEXFile!.split(";base64,").pop();

    const base64DRVFile = req.body[1].file;
    const DRVFileTwo = base64DRVFile!.split(";base64,").pop();

    fs.writeFileSync(`data/fileOne.csv`, WEXFileOne!, {
      encoding: "base64",
    });

    fs.writeFileSync(`data/fileTwo.csv`, DRVFileTwo!, {
      encoding: "base64",
    });

    const WEXFile: IWEXInterface[] = [];
    fs.createReadStream(`data/fileOne.csv`)
      .pipe(csv())
      .on("data", (data: IWEXInterface) => {
        WEXFile.push(data);
      });

    const DRVFile: IDRVInterface[] = [];
    fs.createReadStream(`data/fileTwo.csv`)
      .pipe(csv())
      .on("data", (data: IDRVInterface) => {
        DRVFile.push(data);
      })
      .on("end", () => {
        derivativesActions();
      });

    const derivativesActions = () => {
      // Map WEXFile returns date only
      const WEXDateArray = WEXFile.map((r) => r.Date);

      // Filter WEXDateArray returns unique dates
      const uniqueDateArray = WEXDateArray.filter((item, pos) => {
        return WEXDateArray.indexOf(item) == pos;
      });

      // Separate WEX result by date
      const WEXFileArraySeparatedByDates: IWEXInterfaceArrayOfArrays =
        WEXFile.reduce((r, WEX) => {
          r[WEX.Date!] = r[WEX.Date!] || [];
          r[WEX.Date!].push(WEX);
          return r;
        }, Object.create(null));

      // // Filter Exec Qty
      // const filterExecQty = (date: IWEXInterface[]) => {
      //   // Convert all negative numbers to positive
      //   const convertNumberToPositive = (ExecQty: number) => {
      //     // Check the number is negative
      //     if (ExecQty < 0) {
      //       // Multiply number with -1 to make it positive
      //       ExecQty = ExecQty * -1;
      //     }
      //     // Return the positive number
      //     return ExecQty;
      //   };

      //   // Filter all unequal or oppisite Exec Qty
      //   const arrayEqualExecQty = date.filter((ExecQty, index) => {
      //     let reminder = Array.from(
      //       date.map((ExecQty) =>
      //         convertNumberToPositive(Number(ExecQty["Exec Qty"]!))
      //       )
      //     );
      //     reminder.splice(index, 1);
      //     return (
      //       reminder.indexOf(Number(ExecQty["Exec Qty"])) == -1 &&
      //       reminder.indexOf(-ExecQty["Exec Qty"]!) == -1
      //     );
      //   });

      //   return arrayEqualExecQty;
      // };

      for (const date of uniqueDateArray) {
        // arrayOfArrays = filterExecQty(WEXFileArraySeparatedByDates[date!]);
        // console.log(arrayOfArrays);

        const t = WEXFileArraySeparatedByDates[date!];
        console.log(t.length);
      }
    };
  } catch {}
};

const getDerivativesData = async (
  req: IGetDerivativesDataRequest,
  res: IGetDerivativesDataResponse
) => {
  ServerGlobal.getInstance().logger.info(
    `<getCountriesData>: Start processing request`
  );
};

export { addDerivativesData, getDerivativesData };
