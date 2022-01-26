<?php

public function bank_of_america_merrill_lynch(Request $request) {
	self::$drv_trade_floor_broker_id = DrvTradeFloorBroker::query()
		->whereHas('Company', function ($query) {
			$query->whereName('oscar gruss');
		})
		->whereName('broadcort')
		->first()
		->id;
	if (!self::$drv_trade_floor_broker_id) {
		abort(400);
	}

	if (!$request->source_filename || !file_exists(storage_path("floor_broker/baml/{$request->source_filename}.csv"))) {
		abort(400);
	}
	if (!$request->target_filename || !file_exists(storage_path("floor_broker/makor-x/{$request->target_filename}.csv"))) {
		abort(400);
	}

	self::$source = CsvController::read(storage_path("floor_broker/baml/{$request->source_filename}.csv"));
	self::$target = CsvController::read(storage_path("floor_broker/makor-x/{$request->target_filename}.csv"), true);

	// +--------------+
	// |		TARGET		|
	// +--------------+

	foreach (self::$target as &$target_execution) {
		$target_execution['group_pattern'] = "{$target_execution['floor_broker']}|{$target_execution['date']}|{$target_execution['side']}|{$target_execution['component_type']}|{$target_execution['contract_type']}|{$target_execution['symbol']}|{$target_execution['expiry']}|{$target_execution['strike']}|{$target_execution['option']}|{$target_execution['client_id']}";
	}

	foreach (self::$target as &$target_execution) {
		$group = array_filter(self::$target, function ($value) use ($target_execution) {
			return $value['group_pattern'] == $target_execution['group_pattern'];
		});

		if (count($group) == 1) {
			$target_execution['group_drv_trade_client_account_execution_id'] = $target_execution['group_quantity'] = $target_execution['group_price'] = null;

		} else {
			$target_execution['group_drv_trade_client_account_execution_id'] = json_encode(array_column($group, 'quantity', 'drv_trade_client_account_execution_id'));
			$target_execution['group_quantity'] = array_sum(array_column($group,'quantity'));

			$weight_average = 0;
			if ($target_execution['group_quantity'] != 0) {
				foreach ($group as $single) {
					$weight_average += $single['quantity'] * $single['price'];
				}
				$weight_average = round($weight_average/$target_execution['group_quantity'],2);
			}

			$target_execution['group_price'] = $weight_average;
		}
	}

	foreach (self::$target as &$target_execution) {
		$date = strftime(static::$date_format, strtotime($target_execution['date']));
		$side = $target_execution['side'];
		$contract_type = $target_execution['option'] ?? 'future';
		$symbol = strtoupper($target_execution['symbol']);
		$expiry_month = intval(strftime('%m', strtotime($target_execution['expiry'])));
		$expiry_year = strftime('%Y', strtotime($target_execution['expiry']));
		$strike = floatval($target_execution['strike']);

		$target_execution['price'] = round($target_execution['price'],2);
		$target_execution['quantity'] = intval($target_execution['quantity']);

		$target_execution['match_unit_pattern'] = "{$date}|{$side}|{$contract_type}|{$symbol}|{$expiry_month}|{$expiry_year}|{$strike}|{$target_execution['price']}|{$target_execution['quantity']}";
		$target_execution['match_group_pattern'] = "{$date}|{$side}|{$contract_type}|{$symbol}|{$expiry_month}|{$expiry_year}|{$strike}|{$target_execution['group_price']}|{$target_execution['group_quantity']}";
	}

//		return self::$target;

	// +--------------+
	// |		SOURCE		|
	// +--------------+

	// [0] => Trade Date
// [1] => Exch
	// [2] => B/S
	// [3] => P/C
	// [4] => Qty
// [5] => Class
	// [6] => Sym
	// [7] => Mo
	// [8] => Yr
	// [9] => Strike
	// [10] => Price
// [11] => O/C
// [12] => CFM
// [13] => optional data
// [14] => Client Order ID
// [15] => Ex Brok
// [16] => MM ID
// [17] => CMTA
// [18] => Ex Firm
// [19] => Client ID
// [20] => Billing ID
// [21] => Account
// [22] => Trader
// [23] => CompID
// [24] => Cust ID
// [25] => Product Code
// [26] => Penny
// [27] => Parent Type
// [28] => ise_mt
// [29] => phlx_mt
// [30] => Liquidity
// [31] => Exec Rate
// [32] => Exec Charge
// [33] => Exch Trans Fees
// [34] => OCC Clrg Fees
	// [35] => Total Charges
// [36] => transaction_ID

	self::$header = array_merge(array_shift(self::$source), [
		'row',
		'quantity',
		'price',
		'charge',
		'group_pattern',
		'group_quantity',
		'group_price',
		'group_charge',
		'match_unit_pattern',
		'match_group_pattern',
	]);

//		return self::$header;

	foreach (self::$source as $row => &$source_execution) {
		$source_execution['row'] = $row+2;
		$source_execution['quantity'] = intval($source_execution[4]);
		$source_execution['price'] = doubleval($source_execution[10]);

		$charge = str_replace(',','',$source_execution[35]);
		$multiply = 1;
		if (str_contains($charge, '(')) {
			$multiply = -1;
			$charge = str_replace(['(',')'],'',$charge);
		}
		$source_execution['charge'] = doubleval($charge)*$multiply;

		//$source_execution['group_pattern'] = "{$source_execution[0]}|{$source_execution[1]}|{$source_execution[2]}|{$source_execution[3]}|{$source_execution[5]}|{$source_execution[6]}|{$source_execution[7]}|{$source_execution[8]}|{$source_execution[9]}|{$source_execution[11]}|{$source_execution[12]}|{$source_execution[15]}|{$source_execution[17]}|{$source_execution[18]}";
		$source_execution['group_pattern'] = "{$source_execution[0]}|{$source_execution[1]}|{$source_execution[2]}|{$source_execution[3]}|{$source_execution[5]}|{$source_execution[6]}|{$source_execution[7]}|{$source_execution[8]}|{$source_execution[9]}|{$source_execution[11]}|{$source_execution[12]}|{$source_execution[15]}";
	}

	foreach (self::$source as &$source_execution) {
		$group = array_filter(self::$source, function ($value) use ($source_execution) {
			return isset($value['group_pattern']) && $value['group_pattern'] == $source_execution['group_pattern'];
		});

		if (count($group) == 1) {
			$source_execution['group_quantity'] = $source_execution['group_price'] = $source_execution['group_charge'] = null;

		} else {
			$source_execution['group_quantity'] = array_sum(array_column($group,'quantity'));

			$weight_average = 0;
			if ($source_execution['group_quantity'] != 0) {
				foreach ($group as $single) {
					$weight_average += $single['quantity'] * $single['price'];
				}
				$weight_average = round($weight_average/$source_execution['group_quantity'],2);
			}

			$source_execution['group_price'] = $weight_average;
			$source_execution['group_charge'] = array_sum(array_column($group,'charge'));
		}
	}

	foreach (self::$source as &$source_execution) {
		$date = strftime(static::$date_format, strtotime($source_execution[0]));
		$side = strtoupper($source_execution[2][0]) == 'B' ? 'buy' : 'sell';
		$option_type = strtoupper($source_execution[3]) == 'C' ? 'call' : 'put';
		$symbol = strtoupper($source_execution[6]);
		$expiry_month = $source_execution[7];
		$expiry_year = $source_execution[8];
		$strike = floatval(str_replace(',','',$source_execution[9]));

		$source_execution['match_pattern'] = "{$date}|{$side}|{$option_type}|{$symbol}|{$expiry_month}|{$expiry_year}|{$strike}";
		$source_execution['match_unit_pattern'] = "{$date}|{$side}|{$option_type}|{$symbol}|{$expiry_month}|{$expiry_year}|{$strike}|{$source_execution['price']}|{$source_execution['quantity']}";
		$source_execution['match_group_pattern'] = "{$date}|{$side}|{$option_type}|{$symbol}|{$expiry_month}|{$expiry_year}|{$strike}|{$source_execution['group_price']}|{$source_execution['group_quantity']}";
	}

//		return self::$source;


	// +----------------+
	// |		MATCHING		|
	// +----------------+

	$source_group = [];
	$source_unit = [];
	$target_group = [];
	$target_unit = [];

	foreach (self::$source as $row => $source_execution) {
		if ($source_execution['group_quantity']) {

			if (!isset($source_group[$source_execution['match_group_pattern']])) {
				$source_group[$source_execution['match_group_pattern']] = [];
			}

			$source_group[$source_execution['match_group_pattern']][] = $source_execution;

		} else {
			if (!isset($source_unit[$source_execution['match_unit_pattern']])) {
				$source_unit[$source_execution['match_unit_pattern']] = [];
			}

			$source_unit[$source_execution['match_unit_pattern']][] = $source_execution;
		}
	}

	foreach (self::$target as $target_execution) {
		if ($target_execution['group_quantity']) {

			if (!isset($target_group[$target_execution['match_group_pattern']])) {
				$target_group[$target_execution['match_group_pattern']] = [];
			}

			$target_group[$target_execution['match_group_pattern']][] = $target_execution;

		} else {
			if (!isset($target_unit[$target_execution['match_unit_pattern']])) {
				$target_unit[$target_execution['match_unit_pattern']] = [];
			}

			$target_unit[$target_execution['match_unit_pattern']][] = $target_execution;
		}
	}

//		$count = 0;
//		foreach ($target_group as $executions) {
//			$count += count($executions);
//		}
//		foreach ($target_unit as $executions) {
//			$count += count($executions);
//		}
//		return $count;

	// N vs N

	$unset_keys = [];

	foreach ($source_group as $key => $source_executions) {

		if (array_key_exists($key, $target_group)) {

			foreach ($target_group[$key] as $target_execution) {
				self::$reconciliation_charge[] = [
					'drv_trade_floor_broker_id' => self::$drv_trade_floor_broker_id,
					'drv_trade_client_account_execution_id' => $target_execution['drv_trade_client_account_execution_id'],
					'charge' => ($target_execution['quantity'] * $source_executions[0]['group_charge']) / $source_executions[0]['group_quantity'],
					'rule' => 'N vs N',
				];
			}

			self::$match = array_merge(self::$match, $source_executions);

			$unset_keys[] = $key;
		}
	}

	foreach ($unset_keys as $unset_key) {
		unset($source_group[$unset_key]);
		unset($target_group[$unset_key]);
	}

	foreach ($target_group as $target_executions) {
		foreach ($target_executions as $target_execution) {
			if (!isset($target_unit[$target_execution['match_unit_pattern']])) {
				$target_unit[$target_execution['match_unit_pattern']] = [];
			}

			$target_unit[$target_execution['match_unit_pattern']][] = $target_execution;
		}
	}

	// N vs 1

	foreach ($source_group as $key => $source_executions) {
		if (array_key_exists($key, $target_unit)) {

			self::$reconciliation_charge[] = [
				'drv_trade_floor_broker_id' => self::$drv_trade_floor_broker_id,
				'drv_trade_client_account_execution_id' => $target_execution['drv_trade_client_account_execution_id'],
				'charge' => $source_executions[0]['group_charge'],
				'rule' => 'N vs 1',
			];

			unset($target_unit[$key]);
			self::$match = array_merge(self::$match, $source_executions);

		} else {
			foreach ($source_executions as $source_execution) {
				if (!isset($source_unit[$source_execution['match_unit_pattern']])) {
					$source_unit[$source_execution['match_unit_pattern']] = [];
				}

				$source_unit[$source_execution['match_unit_pattern']][] = $source_execution;
			}
			$source_group[$key] = [];
		}
	}

	// 1 vs 1

	foreach ($source_unit as $key => $source_executions) {

		if (array_key_exists($key, $target_unit)) {

			$total_charge = array_sum(array_column($source_unit[$key], 'charge'));
			$total_quantity = array_sum(array_column($target_unit[$key], 'quantity'));

			foreach ($target_unit[$key] as $target_execution) {
				self::$reconciliation_charge[] = [
					'drv_trade_floor_broker_id' => self::$drv_trade_floor_broker_id,
					'drv_trade_client_account_execution_id' => $target_execution['drv_trade_client_account_execution_id'],
					'charge' => ($target_execution['quantity'] * $total_charge) / $total_quantity,
					'rule' => '1 vs 1',
				];
			}

			unset($target_unit[$key]);
			self::$match = array_merge(self::$match, $source_executions);

		} else {
			self::$unmatch = array_merge(self::$unmatch, $source_executions);
		}
	}

	Log::debug('source: '.$request->source_filename);
	Log::debug('source count: '.count(self::$source));
	Log::debug('total charge: '.array_sum(array_column(self::$source, 'charge')));

	Log::debug('match count: '.count(self::$match));
	Log::debug('match sum charge: '.array_sum(array_column(self::$match, 'charge')));

	Log::debug('unmatch count: '.count(self::$unmatch));
//		Log::debug('unmatch group count: '.count(array_unique(array_column(self::$unmatch, 'group_pattern'))));
	Log::debug('unmatch sum charge: '.array_sum(array_column(self::$unmatch, 'charge')));
	Log::debug("\n\n\n\n\n\n\n\n\n\n");


	return json_encode(self::$reconciliation_charge);
//		self::$header = ['drv_trade_floor_broker_id','drv_trade_client_account_execution_id','charge','rule'];
//		return self::download(self::$reconciliation_charge, "reconciliation_charge {$request->source_filename} @ ".strftime('%Y%m%d%H%M%S'));

//		return self::$match;
//		return self::download(self::$unmatch, "unmatch {$request->source_filename} @ ".strftime('%Y%m%d%H%M%S'));

}
