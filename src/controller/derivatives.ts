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
  res: IaddDerivativesDataResponse,
) => {
  ServerGlobal.getInstance().logger.info(
    `<addDerivativesData>: Start processing request`,
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

      // Separate WEXFile result by date
      const WEXFileArraySeparatedByDates: IWEXInterfaceArrayOfArrays =
        WEXFile.reduce((r, WEX) => {
          r[WEX.Date!] = r[WEX.Date!] || [];
          r[WEX.Date!].push(WEX);
          return r;
        }, Object.create(null));

      let finalWEXArray: IWEXInterface[] = [];
      let filteredWEXArraySeparatedByDates: IWEXInterface[] = [];
      for (const date of uniqueDateArray) {
        // Run over each row in date
        for (let i = 0; i < WEXFileArraySeparatedByDates[date!].length; i++) {
          // Run over each row starting from the outer element's position
          for (
            let j = i + 1;
            j < WEXFileArraySeparatedByDates[date!].length;
            j++
          ) {
            const { "Exec Qty": execQty_i, removed: removed_i } =
              WEXFileArraySeparatedByDates[date!][i];
            const { "Exec Qty": execQty_j, removed: removed_j } =
              WEXFileArraySeparatedByDates[date!][j];
            const numberExecQty_i = Number(execQty_i);
            const numberExecQty_j = Number(execQty_j);
            if (
              !removed_i &&
              !removed_j &&
              numberExecQty_i === numberExecQty_j * -1
            ) {
              WEXFileArraySeparatedByDates[date!][i].removed = true;
              WEXFileArraySeparatedByDates[date!][j].removed = true;
            }
          }
        }

        filteredWEXArraySeparatedByDates = WEXFileArraySeparatedByDates[
          date!
        ].filter((element) => {
          return !element.removed;
        });

        finalWEXArray = finalWEXArray.concat(filteredWEXArraySeparatedByDates);
      }

      console.log(finalWEXArray);
    };
  } catch {}
};

const getDerivativesData = async (
  req: IGetDerivativesDataRequest,
  res: IGetDerivativesDataResponse,
) => {
  ServerGlobal.getInstance().logger.info(
    `<getCountriesData>: Start processing request`,
  );
};

export { addDerivativesData, getDerivativesData };

// Filter Exec Qty
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
//         convertNumberToPositive(Number(ExecQty["Exec Qty"]!)),
//       ),
//     );
//     reminder.splice(index, 1);
//     return (
//       reminder.indexOf(Number(ExecQty["Exec Qty"])) == -1 &&
//       reminder.indexOf(-ExecQty["Exec Qty"]!) == -1
//     );
//   });

//   return arrayEqualExecQty;
// };
