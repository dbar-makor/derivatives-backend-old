import { IWEXInterface } from "../model/shared/derivatives";

// Convert WEX array to dates only array
export const WEXDatesArray = (array: IWEXInterface[]) => {
  return array.map((date: IWEXInterface) => date.Date);
};
