import { IWEX, IWEXObject } from "../model/shared/derivatives";

// Convert WEX array to unique dates only array
export const WEXUniqueDatesArray = (array: IWEX[]) => {
  if (!array) {
    return array;
  }

  const dates = array.map((date: IWEX) => date.modifiedDate);
  const uniqueDates = dates.filter((item, pos) => dates.indexOf(item) == pos);

  return uniqueDates;
};

// Formatting WEX expiry
export const WEXExpiryFormat = (date: string) => {
  if (!date) {
    return date;
  }

  if (date.includes("-")) {
    const year = date!.split("-")[0];
    const month = date.split("-")[1];
    const removeLeadingZeroMonth = parseInt(month, 10);
    const day = date.split("-")[2];
    return (date = `${removeLeadingZeroMonth}/${day}/${year}`);
  }

  const day = date!.split("/")[1];
  const removeLeadingZeroDay = parseInt(day, 10);
  const month = date.split("/")[0];
  const removeLeadingZeroMonth = parseInt(month, 10);
  const year = date.split("/")[2];
  return (date = `${removeLeadingZeroMonth}/${removeLeadingZeroDay}/${year}`);
};

// Format WEX date
export const sourceDateFormat = (date: string) => {
  if (!date) {
    return date;
  }

  const day = date.toString().split("/")[0];
  const removeLeadingZeroDay = parseInt(day, 10);
  const month = date.toString().split("/")[1];
  const removeLeadingZeroMonth = parseInt(month, 10);
  const year = date.toString().split("/")[2];
  return (date = `${removeLeadingZeroMonth}/${removeLeadingZeroDay}/${year}`);
};

// Grouping WEX array
export const sourceGroupBy = (
  array: IWEX[],
  f: (element: IWEX) => (string | number | undefined)[]
) => {
  if (!array) {
    return array;
  }

  const groups: { [key: string]: IWEX[] } = {};

  array.forEach((object) => {
    const group = f(object).join("-");

    groups[group] = groups[group] || [];
    groups[group].push(object);
  });
  return groups;
};

// Separate WEX Array by date
export const WEXSeparateDatesObject = (array: IWEX[]) => {
  if (!array) {
    return array;
  }

  const result: IWEXObject = array.reduce((arr, WEX) => {
    arr[WEX.modifiedDate!] = arr[WEX.modifiedDate!] || [];
    arr[WEX.modifiedDate!].push(WEX);
    return arr;
  }, Object.create(null));
  return result;
};

// Modify total charge
export const sourceTotalCharge = (totalCharge: string) => {
  if (!totalCharge) {
    return Number(totalCharge);
  }

  if (totalCharge.includes("(")) {
    return -Math.abs(Number(totalCharge.replace("$", "").replace(/[()]/g, "")));
  }

  return Number(totalCharge.replace("$", ""));
};
