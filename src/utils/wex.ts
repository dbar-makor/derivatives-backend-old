import { IDRVInterface, IWEXInterface } from "../model/shared/derivatives";

// Convert WEX array to dates only array
export const WEXDatesArray = (array: IWEXInterface[]) => {
  return array.map((date: IWEXInterface) => date.Date);
};

// Formatting WEX date
export const formatWEXDate = (date: string) => {
  const splitedDay = date.split("/")[0];
  const splitedMonth = date.split("/")[1];
  const removeLeadingZeroMonth = parseInt(splitedMonth, 10);
  const splitedYear = date.split("/")[2];
  return (date = `${removeLeadingZeroMonth}/${splitedDay}/${splitedYear}`);
};
