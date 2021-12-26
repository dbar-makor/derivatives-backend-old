import { IWEXInterface } from "../model/shared/derivatives";

// Convert WEX array to unique dates only array
export const WEXUniqueDatesArray = (array: IWEXInterface[]) => {
  const dates = array.map((date: IWEXInterface) => date.Date);
  const uniqueDates = dates.filter((item, pos) => dates.indexOf(item) == pos);

  return uniqueDates;
};

// Formatting WEX date
export const WEXFormatDate = (date: string) => {
  const splitedDay = date.split("/")[0];
  const splitedMonth = date.split("/")[1];
  const removeLeadingZeroMonth = parseInt(splitedMonth, 10);
  const splitedYear = date.split("/")[2];
  return (date = `${removeLeadingZeroMonth}/${splitedDay}/${splitedYear}`);
};

// Grouping WEX array
export const WEXGroupBy = (
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
