import { IDASH, IDASHObject } from "../model/shared/derivatives";
import { removeCommas } from "./derivatives";

// Formatting DASH date
export const DASHDateFormat = (date: string) => {
  if (!date) {
    return date;
  }

  if (date.includes("-")) {
    const day = date.split("-")[1];
    const removeLeadingZeroDay = parseInt(day, 10);
    const month = date.split("-")[2];
    const removeLeadingZeroMonth = parseInt(month, 10);
    const year = date.split("-")[0];
    return (date = `${removeLeadingZeroDay}/${removeLeadingZeroMonth}/${year}`);
  }

  const day = date.split("/")[0];
  const removeLeadingZeroDay = parseInt(day, 10);
  const month = date.split("/")[1];
  const removeLeadingZeroMonth = parseInt(month, 10);
  const year = date.split("/")[2];
  return (date = `${removeLeadingZeroDay}/${removeLeadingZeroMonth}/${year}`);
};

// Modify dollar sign
export const DASHModifiyDollarSign = (number: string) => {
  if (!number) {
    return Number(number);
  }

  return Number(removeCommas(number.replace("$", "")));
};

// Modify total exchange fees
export const DASHModifiyTotalExchangeFees = (number: string) => {
  if (isNaN(Number(number))) {
    return 0;
  }

  return Number(removeCommas(number));
};

// Convert DASH to unique dates only
export const DASHUniqueDatesArray = (array: IDASH[]) => {
  if (!array) {
    return array;
  }

  const dates = array.map((date: IDASH) => date.modifiedDate);
  const uniqueDates = dates.filter((item, pos) => dates.indexOf(item) == pos);

  return uniqueDates;
};

// Separate DASH Array by date
export const DASHSeparateDatesObject = (array: IDASH[]) => {
  if (!array) {
    return array;
  }

  const result: IDASHObject = array.reduce((arr, DASH) => {
    arr[DASH.modifiedDate!] = arr[DASH.modifiedDate!] || [];
    arr[DASH.modifiedDate!].push(DASH);
    return arr;
  }, Object.create(null));
  return result;
};

// Grouping DASH array
export const DASHGroupBy = (
  array: IDASH[],
  f: (element: IDASH) => (string | number | undefined)[],
) => {
  if (!array) {
    return array;
  }

  const groups: { [key: string]: IDASH[] } = {};

  array.forEach((object) => {
    const group = f(object).join("-");

    groups[group] = groups[group] || [];
    groups[group].push(object);
  });
  return groups;
};
