export interface IDRV {
  readonly drv_trade_id?: string;
  readonly drv_trade_client_trader_id?: string;
  readonly drv_trade_client_account_execution_id?: string;
  readonly floor_broker?: string;
  readonly date?: string;
  readonly side?: string;
  readonly quantity?: string;
  readonly component_type?: string;
  readonly contract_type?: string;
  readonly symbol?: string;
  readonly expiry?: string;
  readonly strike?: string;
  readonly option?: string;
  readonly price?: string;
  readonly client_id?: string;
  readonly client?: string;
  readonly trader?: string;
  modifiedDate?: string;
  modifiedSide?: string;
  modifiedQuantity?: number;
  modifiedSymbol?: string;
  modifiedExpiry?: string;
  modifiedExpiryMonthOnly?: string;
  modifiedExpiryYearOnly?: string;
  modifiedStrike?: number;
  modifiedOption?: string;
  modifiedPrice?: number;
  quantitySum?: number;
  charge?: number;
  reconciliationCharge?: {
    drv_trade_client_account_execution_id?: string;
    quantity?: number;
  }[];
  groupsSeparated?: IDRV[];
}

export interface IDASH {
  readonly USER?: string;
  readonly EXCHANGE?: string;
  readonly SYMBOL?: string;
  readonly EXPIRATION?: string;
  readonly DATE?: string;
  readonly "B/S"?: string;
  readonly STRIKE?: string;
  readonly "C/P"?: string;
  readonly PREMIUM?: string;
  readonly "FILLED QTY"?: string;
  readonly "TOTAL EXCHANGE FEES"?: string;
  readonly BPCR$?: string;
  modifiedUser?: string;
  modifiedExchange?: string;
  modifiedSymbol?: string;
  modifiedExpiration?: string;
  modifiedDate?: string;
  modifiedBS?: string;
  modifiedStrike?: number;
  modifiedCP?: string;
  modifiedPremium?: number;
  modifiedFilledQty?: number;
  modifiedTotalExchangeFees?: number;
  modifiedBPCR$?: number;
  totalCharge?: number;
  drv_trade_client_account_execution_id?: string;
  quantitySum?: number;
  reconciliationCharge?: {
    drv_trade_client_account_execution_id?: string;
    quantity?: number;
  }[];
  groupsSeparated?: IDASH[];
}

export interface IBAML {
  readonly "Trade Date"?: string;
  readonly Side?: string;
  readonly Exch?: string;
  readonly "B/S"?: string;
  readonly "P/C"?: string;
  readonly Qty?: string;
  readonly Class?: string;
  readonly Sym?: string;
  readonly Mo?: string;
  readonly Yr?: string;
  readonly Strike?: string;
  readonly Price?: string;
  readonly "O/C"?: string;
  readonly CFM?: string;
  readonly "Optional data"?: string;
  readonly Client_Order_ID?: string;
  readonly "Ex Brok"?: string;
  readonly "MM ID"?: string;
  readonly CMTA?: string;
  readonly "Ex Firm"?: string;
  readonly "Client ID"?: string;
  readonly "Billing ID"?: string;
  readonly Account?: string;
  readonly Trader?: string;
  readonly CompID?: string;
  readonly "Cust ID"?: string;
  readonly "Product Code"?: string;
  readonly Penny?: string;
  readonly Parent_Type?: string;
  readonly ise_mt?: string;
  readonly phlx_mt?: string;
  readonly Liquidity?: string;
  readonly "Exec Rate"?: string;
  readonly "Exec Charge"?: string;
  readonly "Exch Trans Fees"?: string;
  readonly "OCC Clrg Fees"?: string;
  readonly "Total Charges"?: string;
  readonly transaction_ID?: string;
  modifiedTradeDate?: string;
  modifiedExch?: string;
  modifiedBS?: string;
  modifiedPC?: string;
  modifiedClass?: string;
  modifiedSym?: string;
  modifiedStrike?: number;
  modifiedPrice?: number;
  modifiedQty?: number;
  modifiedOC?: string;
  modifiedCFM?: string;
  modifiedExBrok?: string;
  modifiedTotalCharges?: number;
  drv_trade_client_account_execution_id?: string;
  reconciliationCharge?: {
    drv_trade_client_account_execution_id?: string;
    quantity?: number;
  }[];
  groupsSeparated?: IBAML[];
}

export interface IWEX {
  readonly User?: string;
  readonly Date?: string;
  readonly Route?: string;
  readonly Side?: string;
  readonly "Exec Qty"?: string;
  readonly Security?: string;
  readonly Root?: string;
  readonly Expiry?: string;
  readonly Strike?: string;
  readonly "Call/Put"?: string;
  readonly "Average Price"?: string;
  readonly Portfolio?: string;
  readonly "Commission Type"?: string;
  readonly "Commission Rate"?: string;
  readonly "WEX Connect Rate"?: string;
  readonly "Exch. Fee Rate"?: string;
  readonly "Clearing Fee"?: string;
  readonly "Total Charge"?: string;
  modifiedDate?: string;
  modifiedUser?: string;
  modifiedSide?: string;
  modifiedExecQty?: number;
  modifiedSecurity?: string;
  modifiedRoot?: string;
  modifiedExpiry?: string;
  modifiedStrike?: number;
  modifiedCallPut?: string;
  modifiedAveragePrice?: number;
  modifiedPortfolio?: string;
  modifiedCommissionType?: string;
  modifiedCommissionRate?: number;
  modifiedTotalCharge?: number;
  modifiedQuantity?: number;
  drv_trade_client_account_execution_id?: string;
  removed?: boolean;
  reconciliationCharge?: {
    drv_trade_client_account_execution_id?: string;
    quantity?: number;
  }[];
  groupsSeparated?: IWEX[];
}

export interface IDRVObject {
  [key: string]: IDRV[];
}

export interface IDASHObject {
  [key: string]: IDASH[];
}

export interface IBAMLObject {
  [key: string]: IBAML[];
}

export interface IWEXObject {
  [key: string]: IWEX[];
}

export interface INVNReconciliationCharge {
  drv_trade_client_account_execution_id?: string;
  reconciliationCharge?: {
    drv_trade_client_account_execution_id?: string;
    quantity?: number;
  }[];
  totalCharge?: number;
  execQtySum?: number;
}

export interface IReconciliationCharge {
  drv_trade_floor_broker_id?: string;
  drv_trade_client_account_execution_id?: string;
  charge?: number;
}
