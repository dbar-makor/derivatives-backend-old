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

import { IWEXInterface, IDVRInterface } from "../model/shared/derivatives";

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

    const base64DVRFile = req.body[1].file;
    const DVRFileTwo = base64DVRFile!.split(";base64,").pop();

    fs.writeFileSync(`data/fileOne.csv`, WEXFileOne!, {
      encoding: "base64",
    });

    fs.writeFileSync(`data/fileTwo.csv`, DVRFileTwo!, {
      encoding: "base64",
    });

    const WEXResult: IWEXInterface[] = [];
    fs.createReadStream(`data/fileOne.csv`)
      .pipe(csv())
      .on("data", (data: IWEXInterface) => {
        WEXResult.push(data);
      });

    const DVRResult: IDVRInterface[] = [];
    fs.createReadStream(`data/fileTwo.csv`)
      .pipe(csv())
      .on("data", (data: IDVRInterface) => {
        DVRResult.push(data);
      })
      .on("end", () => {
        derivativesActions();
      });

    const derivativesActions = () => {
      console.log(typeof WEXResult[100].Date);
      console.log(WEXResult[100]);

      // WEXResult.forEach((elemet) => {
      //   console.log("wex: " + elemet["Average Price"]);
      // });

      // DVRResult.forEach((elemet) => {
      //   console.log("dvr: " + elemet.date);
      // });
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
