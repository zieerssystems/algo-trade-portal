import sys
import time
import json
import logging
from datetime import datetime, timedelta
from NorenRestApiPy.NorenApi import NorenApi
import pyotp  # <-- TOTP support

# Setup logging
logging.basicConfig(level=logging.INFO)
logging.getLogger('NorenRestApiPy.NorenApi').setLevel(logging.WARNING)
logging.getLogger('urllib3.connectionpool').setLevel(logging.WARNING)

# Custom API Wrapper
class ShoonyaApiPy(NorenApi):
    def __init__(self):
        super().__init__(
            host='https://api.shoonya.com/NorenWClientTP/',
            websocket='wss://api.shoonya.com/NorenWSTP/'
        )
        global api
        api = self

# Logging helper
def log_json(tag, data):
    # Convert datetime objects to strings
    def default_converter(o):
        if isinstance(o, datetime):
            return o.isoformat()
        raise TypeError(f"Object of type {o.__class__.__name__} is not JSON serializable")

    print(json.dumps({
        "tag": tag,
        "timestamp": datetime.now().isoformat(),
        "data": data
    }, indent=2, default=default_converter))

# Strategy Runner
def run_scalping_strategy(params):
    api = ShoonyaApiPy()

    # Destructure params
    token = params["token"]  # This is the TOTP key, not OTP
    user = params["user"]
    password = params["password"]
    vc = params["vc"]
    app_key = params["app_key"]
    imei = params["imei"]
    exch = params["exch"]
    stock_name = params["stock_name"]
    price_type = params["price_type"]
    initialBuyPrice = float(params["initial_buy_price"])
    targetPriceDiff = float(params["target_price_diff"])
    entryDiffPrice = float(params["entry_diff_price"])
    lotSize = int(params["lot_size"])
    maxOpenPosition = int(params["max_open_position"])
    duration = int(params["duration"])
    market_closing_time = params["market_closing_time"]
    debugOn = params["debug_on"] == 'True'

    # Convert TOTP key to current OTP
    try:
        otp = pyotp.TOTP(token).now()
    except Exception as e:
        log_json("OTP Error", {"error": str(e)})
        return

    # Debug login inputs
    log_json("Login Inputs", {
        "user": user,
        "otp": otp,
        "vc": vc,
        "app_key_length": len(app_key),
        "imei": imei
    })

    # Try login
    loginStatus = None
    try:
        loginStatus = api.login(
            userid=user,
            password=password,
            twoFA=otp,
            vendor_code=vc,
            api_secret=app_key,
            imei=imei
        )
    except Exception as e:
        log_json("Login Exception", {"error": str(e)})

    log_json("Raw Login Response", loginStatus)

    if loginStatus is None:
        log_json("Login Failed", {"reason": "Login returned None. Possible token or session error."})
        return
    elif loginStatus.get("stat") != "Ok":
        log_json("Login Failed", loginStatus)
        return

    log_json("Login Successful", loginStatus)

    # Market Time Setup
    current_time = datetime.now()
    closing_time = datetime.strptime(market_closing_time, "%H:%M:%S")
    closing_time_combined = datetime.combine(current_time.date(), closing_time.time())
    closing_time_minus_30_min = closing_time_combined - timedelta(minutes=30)
    closing_time_minus_1_min = closing_time_combined - timedelta(minutes=1)

    # Log the calculated times for debugging
    log_json("Market Times", {
        "closing_time_combined": str(closing_time_combined),
        "closing_time_minus_30_min": str(closing_time_minus_30_min),
        "closing_time_minus_1_min": str(closing_time_minus_1_min)  # Log this variable
    })

    # Optional: Fetch Market Data
    try:
        quotes = api.get_quotes(exchange=exch, token=stock_name)  # Use the actual stock token
        limits = api.get_limits()
        log_json("Market Quote", quotes)
        log_json("Cash Limit", limits)
    except Exception as e:
        log_json("API Error", {"error": str(e)})

    # Strategy Info
    stopLossInRs = entryDiffPrice * (maxOpenPosition + 1)
    runtime_info = {
        "initialBuyPrice": initialBuyPrice,
        "stopLoss": stopLossInRs,
        "strategyEndsAt": str(current_time + timedelta(seconds=duration)),
        "closingTime": str(closing_time_combined),
        "closingTimeMinus30Min": str(closing_time_minus_30_min)
    }
    log_json("Strategy Runtime Info", runtime_info)

    # Initialize order parameters
    buyOrderParams = {
        "buy_or_sell": "B",
        "product_type": "C",
        "exchange": exch,
        "tradingsymbol": stock_name,
        'quantity': lotSize,
        'discloseqty': 0,
        "price_type": price_type,
        'price': initialBuyPrice,
        'retention': 'DAY',
        'remarks': 'By MERN Backend',
    }

    sellOrderParams = {
        "buy_or_sell": "S",
        "product_type": "C",
        "exchange": exch,
        "tradingsymbol": stock_name,
        'quantity': lotSize,
        'discloseqty': 0,
        "price_type": "MKT",
        'price': 0,
        'retention': 'DAY',
        'remarks': 'By MERN Backend',
    }

    # Initial cash check
    initialLimit = api.get_limits()
    log_json("Initial Limits", initialLimit)
    initialCash = float(initialLimit['cash'])
    log_json("Initial Cash", initialCash)

    start_time = datetime.now()
    EndTime = start_time + timedelta(minutes=duration)
    log_json("Strategy End Time", EndTime)

    netPurchasedQty = 0
    LppArray = []  # lastPurchasedPrice

    # Check any existing position available
    position = api.get_positions()
    log_json("Initial Positions", position)

    if position is not None:
        for entry in position:
            if entry['tsym'] == stock_name:
                daybuyamt = entry['lp']
                netPurchasedQty = entry['netqty']
                nextBuyPrice = float(daybuyamt) - float(entryDiffPrice)
                log_json("Existing Position", {
                    "stock_name": stock_name,
                    "purchased_at": daybuyamt,
                    "netPurchasedQty": netPurchasedQty,
                    "nextBuyPrice": nextBuyPrice
                })
                break

    # If no existing position available then buy at limit price
    current_time = datetime.now()
    if float(netPurchasedQty) < 1 and current_time < closing_time_minus_30_min:
        orderStatus = api.place_order(**buyOrderParams)
        log_json("Initial Buy Order Status", orderStatus)

        if orderStatus is None:
            log_json("Error", "Order placement returned None")
            return

        orderNo = orderStatus.get("norenordno")
        if orderNo is None:
            log_json("Error", "Order number is None in order status")
            return

        singleOrderStatus = api.single_order_history(orderNo)
        log_json("Initial Buy Order History", singleOrderStatus)

        while singleOrderStatus and singleOrderStatus[0]["status"] == 'OPEN':
            time.sleep(0.5)
            log_json("Waiting for Initial Buy Order Execution", {"orderNo": orderNo})
            singleOrderStatus = api.single_order_history(orderNo)

        if singleOrderStatus and singleOrderStatus[0]["status"] == 'COMPLETE':
            LppArray.append(singleOrderStatus[0]["avgprc"])
            nextBuyPrice = float(singleOrderStatus[0]["avgprc"]) - float(entryDiffPrice)
            log_json("Initial Buy Completed", {"nextBuyPrice": nextBuyPrice})
        elif singleOrderStatus and singleOrderStatus[0]["status"] == 'REJECTED':
            log_json("Initial Buy Order Rejected", singleOrderStatus)
            return
    else:
        order_book = api.get_order_book()
        log_json("Order Book", order_book)
        if order_book is not None:
            for item in reversed(order_book):
                if item.get('tsym') == stock_name and item.get('status') == 'COMPLETE':
                    trantype = item.get('trantype')
                    avgprc = item.get('avgprc')
                    if trantype == 'B':
                        LppArray.append(avgprc)
                    if trantype == 'S':
                        if LppArray:
                            LppArray.pop()

    # If no open position then wait till order getting executed
    if not LppArray:
        while True:
            position = api.get_positions()
            log_json("Waiting for Position", position)
            time.sleep(0.2)
            netPurchasedQtyInPos = 0
            if position is not None:
                for entry in position:
                    if entry['tsym'] == stock_name:
                        daybuyamt = entry['daybuyavgprc']
                        netPurchasedQtyInPos = entry['netqty']
                        if int(netPurchasedQtyInPos) > 0:
                            for _ in range(int(netPurchasedQtyInPos)):
                                LppArray.append(daybuyamt)
                            log_json("Position Updated", {
                                "stock_name": stock_name,
                                "purchased_at": daybuyamt,
                                "netPurchasedQty": netPurchasedQtyInPos
                            })
                            break
            if netPurchasedQtyInPos > 0:
                break

    # Start Algo trade
    lastSoldPrice = 0
    while True:
        position = api.get_positions()
        log_json("Current Position", position)
        time.sleep(0.2)

        if position is not None:
            for entry in position:
                if entry['tsym'] == stock_name:
                    daybuyamt = entry['daybuyavgprc']
                    netPurchasedQty = entry['netqty']
                    break

        # Fetch LTP data
        quotes = api.get_quotes(exch, stock_name)
        log_json("Quotes", quotes)
        time.sleep(1)
        ltp = quotes.get("lp") if quotes else None

        if ltp is not None:
            if LppArray:
                curIndex = int(float(netPurchasedQty) / float(lotSize)) - 1
                if curIndex < 0:
                    curIndex = 0
                if curIndex >= len(LppArray):
                    curIndex = 0

                tp = round(float(LppArray[curIndex]) + float(targetPriceDiff), 2)
                log_json("Position Info", {
                    "dayAvgPurPrice": daybuyamt,
                    "netQty": netPurchasedQty,
                    "nextBuyPrice": nextBuyPrice,
                    "LppArraySize": len(LppArray),
                    "curIndex": curIndex,
                    "LPP": LppArray[curIndex],
                    "TP": tp,
                    "LTP": ltp
                })

                if curIndex < len(LppArray) and float(ltp) < float(LppArray[curIndex]) - float(stopLossInRs):
                    slp = float(LppArray[curIndex]) - float(stopLossInRs)
                    position = api.get_positions()
                    time.sleep(0.2)
                    if position is not None:
                        for entry in position:
                            if entry['tsym'] == stock_name:
                                daybuyamt = entry['daybuyavgprc']
                                netPurchasedQty = entry['netqty']
                                break
                    sellOrderParams["quantity"] = netPurchasedQty
                    orderStatus = api.place_order(**sellOrderParams)
                    log_json("Stop Loss Sell Order Status", orderStatus)

                    if orderStatus is None:
                        log_json("Error", "Order placement returned None")
                        return

                    orderNo = orderStatus.get("norenordno")
                    if orderNo is None:
                        log_json("Error", "Order number is None in order status")
                        return

                    singleOrderStatus = api.single_order_history(orderNo)
                    log_json("Stop Loss Sell Order History", singleOrderStatus)

                    while singleOrderStatus and singleOrderStatus[0]["status"] == 'OPEN':
                        time.sleep(0.5)
                        log_json("Waiting for Stop Loss Sell Order Execution", {"orderNo": orderNo})
                        singleOrderStatus = api.single_order_history(orderNo)

                    log_json("Stop Loss Hit", {
                        "ltp": ltp,
                        "qty": netPurchasedQty,
                        "buyAmt": LppArray[curIndex],
                        "slp": slp,
                        "sl": stopLossInRs
                    })
                    LppArray = []
                    nextBuyPrice = float(ltp) - entryDiffPrice
                    break

                if curIndex < len(LppArray) and float(ltp) > (float(LppArray[curIndex]) + float(targetPriceDiff)) and (float(netPurchasedQty) > 0):
                    tp = float(LppArray[curIndex]) + float(targetPriceDiff)
                    tp_order = float(ltp) - 0.05
                    sellOrderParamsLMT = {
                        "buy_or_sell": "S",
                        "product_type": "C",
                        "exchange": exch,
                        "tradingsymbol": stock_name,
                        'quantity': lotSize,
                        'discloseqty': 0,
                        "price_type": "LMT",
                        'price': tp_order,
                        'retention': 'DAY',
                        'remarks': 'By MERN Backend LMT',
                    }
                    orderStatus = api.place_order(**sellOrderParams)
                    log_json("Profit Booking Sell Order Status", orderStatus)

                    if orderStatus is None:
                        log_json("Error", "Order placement returned None")
                        return

                    orderNo = orderStatus.get("norenordno")
                    if orderNo is None:
                        log_json("Error", "Order number is None in order status")
                        return

                    singleOrderStatus = api.single_order_history(orderNo)
                    log_json("Profit Booking Sell Order History", singleOrderStatus)

                    while singleOrderStatus and singleOrderStatus[0]["status"] == 'OPEN':
                        time.sleep(0.5)
                        log_json("Waiting for Profit Booking Sell Order Execution", {"orderNo": orderNo})
                        singleOrderStatus = api.single_order_history(orderNo)

                    sizeOfPArray = len(LppArray)
                    lastSoldPrice = singleOrderStatus[0]["avgprc"]
                    log_json("Profit Booked", {
                        "qtySold": 1,
                        "soldAt": lastSoldPrice,
                        "buyPrice": LppArray[curIndex],
                        "targetPriceDiff": targetPriceDiff,
                        "TP": tp,
                        "sizeOfPArray": sizeOfPArray
                    })
                    if len(LppArray) > (int(netPurchasedQty) - 1):
                        LppArray.pop(int(netPurchasedQty) - 1)
                    nextBuyPrice = float(lastSoldPrice) - float(entryDiffPrice)

                current_time = datetime.now()
                if current_time < closing_time_minus_30_min:
                    if float(ltp) < float(nextBuyPrice) and float(netPurchasedQty) <= float(maxOpenPosition):
                        orderStatus = api.place_order(**buyOrderParams)
                        log_json("Buy Order Status", orderStatus)

                        if orderStatus is None:
                            log_json("Error", "Order placement returned None")
                            return

                        orderNo = orderStatus.get("norenordno")
                        if orderNo is None:
                            log_json("Error", "Order number is None in order status")
                            return

                        singleOrderStatus = api.single_order_history(orderNo)
                        log_json("Buy Order History", singleOrderStatus)

                        while singleOrderStatus and singleOrderStatus[0]["status"] == 'OPEN':
                            time.sleep(0.5)
                            log_json("Waiting for Buy Order Execution", {"orderNo": orderNo})
                            singleOrderStatus = api.single_order_history(orderNo)

                        if singleOrderStatus and singleOrderStatus[0]["status"] == 'COMPLETE':
                            LppArray.append(singleOrderStatus[0]["avgprc"])
                            nextBuyPrice = float(nextBuyPrice) - float(entryDiffPrice)
                            log_json("Buy Completed", {"nextBuyPrice": nextBuyPrice})
                        if singleOrderStatus and singleOrderStatus[0]["status"] == 'REJECTED':
                            log_json("Buy Order Rejected", singleOrderStatus)
                            return
        else:
            current_time = datetime.now()
            if current_time < closing_time_minus_30_min:
                log_json("Waiting to Buy", {"ltp": ltp, "nextBuyPrice": nextBuyPrice})
                if float(ltp) < float(nextBuyPrice):
                    orderStatus = api.place_order(**buyOrderParams)
                    log_json("Second Buy Order Status", orderStatus)

                    if orderStatus is None:
                        log_json("Error", "Order placement returned None")
                        return

                    orderNo = orderStatus.get("norenordno")
                    if orderNo is None:
                        log_json("Error", "Order number is None in order status")
                        return

                    singleOrderStatus = api.single_order_history(orderNo)
                    log_json("Second Buy Order History", singleOrderStatus)

                    while singleOrderStatus and singleOrderStatus[0]["status"] == 'OPEN':
                        time.sleep(0.5)
                        log_json("Waiting for Second Buy Order Execution", {"orderNo": orderNo})
                        singleOrderStatus = api.single_order_history(orderNo)

                    if singleOrderStatus and singleOrderStatus[0]["status"] == 'COMPLETE':
                        LppArray.append(singleOrderStatus[0]["avgprc"])
                        nextBuyPrice = float(singleOrderStatus[0]["avgprc"]) - float(entryDiffPrice)
                        log_json("Second Buy Completed", {"nextBuyPrice": nextBuyPrice})
                    if singleOrderStatus and singleOrderStatus[0]["status"] == 'REJECTED':
                        log_json("Second Buy Order Rejected", singleOrderStatus)
                        return

        # Check end time
        current_time = datetime.now()
        if current_time > EndTime or current_time > closing_time_minus_1_min:
            timespent = current_time - start_time
            log_json("Time Spent", {
                "timespent": str(timespent),
                "start_time": start_time,
                "current_time": current_time,
                "closing_time_minus_1_min": closing_time_minus_1_min,
                "closing_time": closing_time_combined
            })

            if float(netPurchasedQty) > 0 and current_time < closing_time_combined:
                sellOrderParams["quantity"] = netPurchasedQty
                sellOrderResponse = api.place_order(**sellOrderParams)
                log_json("End Time Sell Order Status", sellOrderResponse)

                if sellOrderResponse is None:
                    log_json("Error", "Order placement returned None")
                    return

                orderNo = sellOrderResponse.get("norenordno")
                if orderNo is None:
                    log_json("Error", "Order number is None in order status")
                    return

                singleOrderStatus = api.single_order_history(orderNo)
                log_json("End Time Sell Order History", singleOrderStatus)

                while singleOrderStatus and singleOrderStatus[0]["status"] == 'OPEN':
                    time.sleep(0.5)
                    log_json("Waiting for End Time Sell Order Execution", {"orderNo": orderNo})
                    singleOrderStatus = api.single_order_history(orderNo)

                LppArray = []
                if sellOrderResponse is not None:
                    order_id = sellOrderResponse['norenordno']
                    log_json("End Time Sell Order Placed", {"order_id": order_id})
                else:
                    log_json("End Time Sell Order Failed", {})
            else:
                log_json("End Time Reached", {"reason": "No quantity to sell or market closed."})
            break

        time.sleep(1)

    # Calculate profit
    funds = api.get_limits()
    balance_cash = float(funds['cash'])
    profit = balance_cash - initialCash
    log_json("Trading Session Profit", {
        "initialCash": initialCash,
        "balanceCash": balance_cash,
        "profit": profit
    })

    # Logout
    def logout(user_id):
        ret1 = api.logout()
        log_json("Logout Response", ret1)
        log_json("User Logged Out", {"user_id": user_id})

    try:
        logout(user)
    except Exception as e:
        log_json("Logout Error", {"error": str(e)})

# Main Entrypoint
if __name__ == "__main__":
    try:
        input_data = sys.stdin.read()
        params = json.loads(input_data)
        log_json("Received Params", params)
        run_scalping_strategy(params)
    except Exception as e:
        log_json("Startup Error", {"error": str(e)})


# import sys
# import time
# import json
# import logging
# from datetime import datetime, timedelta
# from NorenRestApiPy.NorenApi import NorenApi
# import pyotp  # <-- TOTP support

# # Setup logging
# logging.basicConfig(level=logging.INFO)
# logging.getLogger('NorenRestApiPy.NorenApi').setLevel(logging.WARNING)
# logging.getLogger('urllib3.connectionpool').setLevel(logging.WARNING)

# # Custom API Wrapper
# class ShoonyaApiPy(NorenApi):
#     def __init__(self):
#         super().__init__(
#             host='https://api.shoonya.com/NorenWClientTP/',
#             websocket='wss://api.shoonya.com/NorenWSTP/'
#         )
#         global api
#         api = self

# # Logging helper
# def log_json(tag, data):
#     # Convert datetime objects to strings
#     def default_converter(o):
#         if isinstance(o, datetime):
#             return o.isoformat()
#         raise TypeError(f"Object of type {o.__class__.__name__} is not JSON serializable")

#     print(json.dumps({
#         "tag": tag,
#         "timestamp": datetime.now().isoformat(),
#         "data": data
#     }, indent=2, default=default_converter))

# # Strategy Runner
# def run_scalping_strategy(params):
#     api = ShoonyaApiPy()

#     # Destructure params
#     token = params["token"]  # This is the TOTP key, not OTP
#     user = params["user"]
#     password = params["password"]
#     vc = params["vc"]
#     app_key = params["app_key"]
#     imei = params["imei"]
#     exch = params["exch"]
#     stock_name = params["stock_name"]
#     price_type = params["price_type"]
#     initialBuyPrice = float(params["initial_buy_price"])
#     targetPriceDiff = float(params["target_price_diff"])
#     entryDiffPrice = float(params["entry_diff_price"])
#     lotSize = int(params["lot_size"])
#     maxOpenPosition = int(params["max_open_position"])
#     duration = int(params["duration"])
#     market_closing_time = params["market_closing_time"]
#     debugOn = params["debug_on"] == 'True'

#     # Convert TOTP key to current OTP
#     try:
#         otp = pyotp.TOTP(token).now()
#     except Exception as e:
#         log_json("OTP Error", {"error": str(e)})
#         return

#     # Debug login inputs
#     log_json("Login Inputs", {
#         "user": user,
#         "otp": otp,
#         "vc": vc,
#         "app_key_length": len(app_key),
#         "imei": imei
#     })

#     # Try login
#     loginStatus = None
#     try:
#         loginStatus = api.login(
#             userid=user,
#             password=password,
#             twoFA=otp,
#             vendor_code=vc,
#             api_secret=app_key,
#             imei=imei
#         )
#     except Exception as e:
#         log_json("Login Exception", {"error": str(e)})

#     log_json("Raw Login Response", loginStatus)

#     if loginStatus is None:
#         log_json("Login Failed", {"reason": "Login returned None. Possible token or session error."})
#         return
#     elif loginStatus.get("stat") != "Ok":
#         log_json("Login Failed", loginStatus)
#         return

#     log_json("Login Successful", loginStatus)

#     # Market Time Setup
#     current_time = datetime.now()
#     closing_time = datetime.strptime(market_closing_time, "%H:%M:%S")
#     closing_time_combined = datetime.combine(current_time.date(), closing_time.time())
#     closing_time_minus_30_min = closing_time_combined - timedelta(minutes=30)
#     closing_time_minus_1_min = closing_time_combined - timedelta(minutes=1)

#     # Log the calculated times for debugging
#     log_json("Market Times", {
#         "closing_time_combined": str(closing_time_combined),
#         "closing_time_minus_30_min": str(closing_time_minus_30_min),
#         "closing_time_minus_1_min": str(closing_time_minus_1_min)
#     })

#     # Optional: Fetch Market Data
#     try:
#         quotes = api.get_quotes(exchange=exch, token=stock_name)  # Use the actual stock token
#         limits = api.get_limits()
#         log_json("Market Quote", quotes)
#         log_json("Cash Limit", limits)
#     except Exception as e:
#         log_json("API Error", {"error": str(e)})

#     # Strategy Info
#     stopLossInRs = entryDiffPrice * (maxOpenPosition + 1)
#     runtime_info = {
#         "initialBuyPrice": initialBuyPrice,
#         "stopLoss": stopLossInRs,
#         "strategyEndsAt": str(current_time + timedelta(seconds=duration)),
#         "closingTime": str(closing_time_combined),
#         "closingTimeMinus30Min": str(closing_time_minus_30_min)
#     }
#     log_json("Strategy Runtime Info", runtime_info)

#     # Initialize order parameters
#     buyOrderParams = {
#         "buy_or_sell": "B",
#         "product_type": "C",
#         "exchange": exch,
#         "tradingsymbol": stock_name,
#         'quantity': lotSize,
#         'discloseqty': 0,
#         "price_type": price_type,
#         'price': initialBuyPrice,
#         'retention': 'DAY',
#         'remarks': 'By MERN Backend',
#     }

#     sellOrderParams = {
#         "buy_or_sell": "S",
#         "product_type": "C",
#         "exchange": exch,
#         "tradingsymbol": stock_name,
#         'quantity': lotSize,
#         'discloseqty': 0,
#         "price_type": "MKT",
#         'price': 0,
#         'retention': 'DAY',
#         'remarks': 'By MERN Backend',
#     }

#     # Initial cash check
#     initialLimit = api.get_limits()
#     log_json("Initial Limits", initialLimit)
#     initialCash = float(initialLimit['cash'])
#     log_json("Initial Cash", initialCash)

#     # Check if initial cash is sufficient
#     if initialCash < initialBuyPrice * lotSize:
#         log_json("Error", "Insufficient funds to place the initial order.")
#         return

#     start_time = datetime.now()
#     EndTime = start_time + timedelta(minutes=duration)
#     log_json("Strategy End Time", EndTime)

#     netPurchasedQty = 0
#     LppArray = []  # lastPurchasedPrice

#     # Check any existing position available
#     position = api.get_positions()
#     log_json("Initial Positions", position)

#     if position is not None:
#         for entry in position:
#             if entry['tsym'] == stock_name:
#                 daybuyamt = entry['lp']
#                 netPurchasedQty = entry['netqty']
#                 nextBuyPrice = float(daybuyamt) - float(entryDiffPrice)
#                 log_json("Existing Position", {
#                     "stock_name": stock_name,
#                     "purchased_at": daybuyamt,
#                     "netPurchasedQty": netPurchasedQty,
#                     "nextBuyPrice": nextBuyPrice
#                 })
#                 break

#     # If no existing position available then buy at limit price
#     current_time = datetime.now()
#     if float(netPurchasedQty) < 1 and current_time < closing_time_minus_30_min:
#         log_json("Placing Initial Buy Order", buyOrderParams)
#         orderStatus = api.place_order(**buyOrderParams)
#         log_json("Initial Buy Order Status", orderStatus)

#         if orderStatus is None:
#             log_json("Error", "Order placement returned None")
#             return

#         orderNo = orderStatus.get("norenordno")
#         if orderNo is None:
#             log_json("Error", "Order number is None in order status")
#             return

#         singleOrderStatus = api.single_order_history(orderNo)
#         log_json("Initial Buy Order History", singleOrderStatus)

#         while singleOrderStatus and singleOrderStatus[0]["status"] == 'OPEN':
#             time.sleep(0.5)
#             log_json("Waiting for Initial Buy Order Execution", {"orderNo": orderNo})
#             singleOrderStatus = api.single_order_history(orderNo)
#             log_json("Updated Order Status", singleOrderStatus)

#         if singleOrderStatus and singleOrderStatus[0]["status"] == 'COMPLETE':
#             LppArray.append(singleOrderStatus[0]["avgprc"])
#             nextBuyPrice = float(singleOrderStatus[0]["avgprc"]) - float(entryDiffPrice)
#             log_json("Initial Buy Completed", {"nextBuyPrice": nextBuyPrice})
#         elif singleOrderStatus and singleOrderStatus[0]["status"] == 'REJECTED':
#             log_json("Initial Buy Order Rejected", singleOrderStatus)
#             log_json("Error", "Insufficient funds or margin shortfall.")
#             return
#     else:
#         order_book = api.get_order_book()
#         log_json("Order Book", order_book)
#         if order_book is not None:
#             for item in reversed(order_book):
#                 if item.get('tsym') == stock_name and item.get('status') == 'COMPLETE':
#                     trantype = item.get('trantype')
#                     avgprc = item.get('avgprc')
#                     if trantype == 'B':
#                         LppArray.append(avgprc)
#                     if trantype == 'S':
#                         if LppArray:
#                             LppArray.pop()

#     # If no open position then wait till order getting executed
#     if not LppArray:
#         while True:
#             position = api.get_positions()
#             log_json("Waiting for Position", position)
#             time.sleep(0.2)
#             netPurchasedQtyInPos = 0
#             if position is not None:
#                 for entry in position:
#                     if entry['tsym'] == stock_name:
#                         daybuyamt = entry['daybuyavgprc']
#                         netPurchasedQtyInPos = entry['netqty']
#                         if int(netPurchasedQtyInPos) > 0:
#                             for _ in range(int(netPurchasedQtyInPos)):
#                                 LppArray.append(daybuyamt)
#                             log_json("Position Updated", {
#                                 "stock_name": stock_name,
#                                 "purchased_at": daybuyamt,
#                                 "netPurchasedQty": netPurchasedQtyInPos
#                             })
#                             break
#             if netPurchasedQtyInPos > 0:
#                 break

#     # Start Algo trade
#     lastSoldPrice = 0
#     while True:
#         position = api.get_positions()
#         log_json("Current Position", position)
#         time.sleep(0.2)

#         if position is not None:
#             for entry in position:
#                 if entry['tsym'] == stock_name:
#                     daybuyamt = entry['daybuyavgprc']
#                     netPurchasedQty = entry['netqty']
#                     break

#         # Fetch LTP data
#         quotes = api.get_quotes(exch, stock_name)
#         log_json("Quotes", quotes)
#         time.sleep(1)
#         ltp = quotes.get("lp") if quotes else None

#         if ltp is not None:
#             if LppArray:
#                 curIndex = int(float(netPurchasedQty) / float(lotSize)) - 1
#                 if curIndex < 0:
#                     curIndex = 0
#                 if curIndex >= len(LppArray):
#                     curIndex = 0

#                 tp = round(float(LppArray[curIndex]) + float(targetPriceDiff), 2)
#                 log_json("Position Info", {
#                     "dayAvgPurPrice": daybuyamt,
#                     "netQty": netPurchasedQty,
#                     "nextBuyPrice": nextBuyPrice,
#                     "LppArraySize": len(LppArray),
#                     "curIndex": curIndex,
#                     "LPP": LppArray[curIndex],
#                     "TP": tp,
#                     "LTP": ltp
#                 })

#                 if curIndex < len(LppArray) and float(ltp) < float(LppArray[curIndex]) - float(stopLossInRs):
#                     slp = float(LppArray[curIndex]) - float(stopLossInRs)
#                     position = api.get_positions()
#                     time.sleep(0.2)
#                     if position is not None:
#                         for entry in position:
#                             if entry['tsym'] == stock_name:
#                                 daybuyamt = entry['daybuyavgprc']
#                                 netPurchasedQty = entry['netqty']
#                                 break
#                     sellOrderParams["quantity"] = netPurchasedQty
#                     orderStatus = api.place_order(**sellOrderParams)
#                     log_json("Stop Loss Sell Order Status", orderStatus)

#                     if orderStatus is None:
#                         log_json("Error", "Order placement returned None")
#                         return

#                     orderNo = orderStatus.get("norenordno")
#                     if orderNo is None:
#                         log_json("Error", "Order number is None in order status")
#                         return

#                     singleOrderStatus = api.single_order_history(orderNo)
#                     log_json("Stop Loss Sell Order History", singleOrderStatus)

#                     while singleOrderStatus and singleOrderStatus[0]["status"] == 'OPEN':
#                         time.sleep(0.5)
#                         log_json("Waiting for Stop Loss Sell Order Execution", {"orderNo": orderNo})
#                         singleOrderStatus = api.single_order_history(orderNo)
#                         log_json("Updated Order Status", singleOrderStatus)

#                     log_json("Stop Loss Hit", {
#                         "ltp": ltp,
#                         "qty": netPurchasedQty,
#                         "buyAmt": LppArray[curIndex],
#                         "slp": slp,
#                         "sl": stopLossInRs
#                     })
#                     LppArray = []
#                     nextBuyPrice = float(ltp) - entryDiffPrice
#                     break

#                 if curIndex < len(LppArray) and float(ltp) > (float(LppArray[curIndex]) + float(targetPriceDiff)) and (float(netPurchasedQty) > 0):
#                     tp = float(LppArray[curIndex]) + float(targetPriceDiff)
#                     tp_order = float(ltp) - 0.05
#                     sellOrderParamsLMT = {
#                         "buy_or_sell": "S",
#                         "product_type": "C",
#                         "exchange": exch,
#                         "tradingsymbol": stock_name,
#                         'quantity': lotSize,
#                         'discloseqty': 0,
#                         "price_type": "LMT",
#                         'price': tp_order,
#                         'retention': 'DAY',
#                         'remarks': 'By MERN Backend LMT',
#                     }
#                     orderStatus = api.place_order(**sellOrderParams)
#                     log_json("Profit Booking Sell Order Status", orderStatus)

#                     if orderStatus is None:
#                         log_json("Error", "Order placement returned None")
#                         return

#                     orderNo = orderStatus.get("norenordno")
#                     if orderNo is None:
#                         log_json("Error", "Order number is None in order status")
#                         return

#                     singleOrderStatus = api.single_order_history(orderNo)
#                     log_json("Profit Booking Sell Order History", singleOrderStatus)

#                     while singleOrderStatus and singleOrderStatus[0]["status"] == 'OPEN':
#                         time.sleep(0.5)
#                         log_json("Waiting for Profit Booking Sell Order Execution", {"orderNo": orderNo})
#                         singleOrderStatus = api.single_order_history(orderNo)
#                         log_json("Updated Order Status", singleOrderStatus)

#                     sizeOfPArray = len(LppArray)
#                     lastSoldPrice = singleOrderStatus[0]["avgprc"]
#                     log_json("Profit Booked", {
#                         "qtySold": 1,
#                         "soldAt": lastSoldPrice,
#                         "buyPrice": LppArray[curIndex],
#                         "targetPriceDiff": targetPriceDiff,
#                         "TP": tp,
#                         "sizeOfPArray": sizeOfPArray
#                     })
#                     if len(LppArray) > (int(netPurchasedQty) - 1):
#                         LppArray.pop(int(netPurchasedQty) - 1)
#                     nextBuyPrice = float(lastSoldPrice) - float(entryDiffPrice)

#                 current_time = datetime.now()
#                 if current_time < closing_time_minus_30_min:
#                     if float(ltp) < float(nextBuyPrice) and float(netPurchasedQty) <= float(maxOpenPosition):
#                         orderStatus = api.place_order(**buyOrderParams)
#                         log_json("Buy Order Status", orderStatus)

#                         if orderStatus is None:
#                             log_json("Error", "Order placement returned None")
#                             return

#                         orderNo = orderStatus.get("norenordno")
#                         if orderNo is None:
#                             log_json("Error", "Order number is None in order status")
#                             return

#                         singleOrderStatus = api.single_order_history(orderNo)
#                         log_json("Buy Order History", singleOrderStatus)

#                         while singleOrderStatus and singleOrderStatus[0]["status"] == 'OPEN':
#                             time.sleep(0.5)
#                             log_json("Waiting for Buy Order Execution", {"orderNo": orderNo})
#                             singleOrderStatus = api.single_order_history(orderNo)
#                             log_json("Updated Order Status", singleOrderStatus)

#                         if singleOrderStatus and singleOrderStatus[0]["status"] == 'COMPLETE':
#                             LppArray.append(singleOrderStatus[0]["avgprc"])
#                             nextBuyPrice = float(nextBuyPrice) - float(entryDiffPrice)
#                             log_json("Buy Completed", {"nextBuyPrice": nextBuyPrice})
#                         if singleOrderStatus and singleOrderStatus[0]["status"] == 'REJECTED':
#                             log_json("Buy Order Rejected", singleOrderStatus)
#                             return
#         else:
#             current_time = datetime.now()
#             if current_time < closing_time_minus_30_min:
#                 log_json("Waiting to Buy", {"ltp": ltp, "nextBuyPrice": nextBuyPrice})
#                 if float(ltp) < float(nextBuyPrice):
#                     orderStatus = api.place_order(**buyOrderParams)
#                     log_json("Second Buy Order Status", orderStatus)

#                     if orderStatus is None:
#                         log_json("Error", "Order placement returned None")
#                         return

#                     orderNo = orderStatus.get("norenordno")
#                     if orderNo is None:
#                         log_json("Error", "Order number is None in order status")
#                         return

#                     singleOrderStatus = api.single_order_history(orderNo)
#                     log_json("Second Buy Order History", singleOrderStatus)

#                     while singleOrderStatus and singleOrderStatus[0]["status"] == 'OPEN':
#                         time.sleep(0.5)
#                         log_json("Waiting for Second Buy Order Execution", {"orderNo": orderNo})
#                         singleOrderStatus = api.single_order_history(orderNo)
#                         log_json("Updated Order Status", singleOrderStatus)

#                     if singleOrderStatus and singleOrderStatus[0]["status"] == 'COMPLETE':
#                         LppArray.append(singleOrderStatus[0]["avgprc"])
#                         nextBuyPrice = float(singleOrderStatus[0]["avgprc"]) - float(entryDiffPrice)
#                         log_json("Second Buy Completed", {"nextBuyPrice": nextBuyPrice})
#                     if singleOrderStatus and singleOrderStatus[0]["status"] == 'REJECTED':
#                         log_json("Second Buy Order Rejected", singleOrderStatus)
#                         return

#         # Check end time
#         current_time = datetime.now()
#         if current_time > EndTime or current_time > closing_time_minus_1_min:
#             timespent = current_time - start_time
#             log_json("Time Spent", {
#                 "timespent": str(timespent),
#                 "start_time": start_time,
#                 "current_time": current_time,
#                 "closing_time_minus_1_min": closing_time_minus_1_min,
#                 "closing_time": closing_time_combined
#             })

#             if float(netPurchasedQty) > 0 and current_time < closing_time_combined:
#                 sellOrderParams["quantity"] = netPurchasedQty
#                 sellOrderResponse = api.place_order(**sellOrderParams)
#                 log_json("End Time Sell Order Status", sellOrderResponse)

#                 if sellOrderResponse is None:
#                     log_json("Error", "Order placement returned None")
#                     return

#                 orderNo = sellOrderResponse.get("norenordno")
#                 if orderNo is None:
#                     log_json("Error", "Order number is None in order status")
#                     return

#                 singleOrderStatus = api.single_order_history(orderNo)
#                 log_json("End Time Sell Order History", singleOrderStatus)

#                 while singleOrderStatus and singleOrderStatus[0]["status"] == 'OPEN':
#                     time.sleep(0.5)
#                     log_json("Waiting for End Time Sell Order Execution", {"orderNo": orderNo})
#                     singleOrderStatus = api.single_order_history(orderNo)
#                     log_json("Updated Order Status", singleOrderStatus)

#                 LppArray = []
#                 if sellOrderResponse is not None:
#                     order_id = sellOrderResponse['norenordno']
#                     log_json("End Time Sell Order Placed", {"order_id": order_id})
#                 else:
#                     log_json("End Time Sell Order Failed", {})
#             else:
#                 log_json("End Time Reached", {"reason": "No quantity to sell or market closed."})
#             break

#         time.sleep(1)

#     # Calculate profit
#     funds = api.get_limits()
#     balance_cash = float(funds['cash'])
#     profit = balance_cash - initialCash
#     log_json("Trading Session Profit", {
#         "initialCash": initialCash,
#         "balanceCash": balance_cash,
#         "profit": profit
#     })

#     # Logout
#     def logout(user_id):
#         ret1 = api.logout()
#         log_json("Logout Response", ret1)
#         log_json("User Logged Out", {"user_id": user_id})

#     try:
#         logout(user)
#     except Exception as e:
#         log_json("Logout Error", {"error": str(e)})

# # Main Entry Point
# if __name__ == "__main__":
#     try:
#         input_data = sys.stdin.read()
#         params = json.loads(input_data)
#         log_json("Received Params", params)
#         run_scalping_strategy(params)
#     except Exception as e:
#         log_json("Startup Error", {"error": str(e)})
