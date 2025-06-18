import time
import json
import logging
import sys
from datetime import datetime, time as dtime
from NorenRestApiPy.NorenApi import NorenApi
import pyotp

# Logging setup
logging.basicConfig(level=logging.INFO)
logging.getLogger('NorenRestApiPy.NorenApi').setLevel(logging.WARNING)
logging.getLogger('urllib3.connectionpool').setLevel(logging.WARNING)

class ShoonyaApiPy(NorenApi):
    def __init__(self):
        super().__init__(
            host='https://api.shoonya.com/NorenWClientTP/',
            websocket='wss://api.shoonya.com/NorenWSTP/'
        )
        global api
        api = self

def log_json(tag, data):
    print(json.dumps({
        "tag": tag,
        "timestamp": datetime.now().isoformat(),
        "data": data
    }, indent=2), flush=True)

def is_market_open():
    now = datetime.now()
    return dtime(9, 15) <= now.time() <= dtime(15, 30)

def is_at_lower_circuit(lp, lc):
    try:
        return abs(lp - lc) / lc < 0.005
    except:
        return False

# ✅ Stock lists inside Python
circuit_stock_lists = {
    "Nifty 50": [
        "RELIANCE-EQ", "HDFCBANK-EQ", "INFY-EQ", "ICICIBANK-EQ", "TCS-EQ", "KOTAKBANK-EQ",
        "SPANDANA-EQ","AGSTRA-EQ","NEWGEN-EQ","SUZLON-EQ","RAMANEWS-BE","SWSOLAR-EQ","PCJEWELLER-EQ","BGRENERGY-EQ","NAVKARURB-EQ","SADHNANIQ-BE","BCG-EQ","RELINFRA-EQ","INDOTECH-EQ","GOACARBON-EQ","DISHTV-BE","VERTOZ-BE","VAKRANGEE-EQ","KPIGREEN-EQ"
        # add full Nifty 50 list
    ],
    "Nifty 100": [
        "RELIANCE-EQ", "HDFCBANK-EQ", "INFY-EQ", "ICICIBANK-EQ", "TCS-EQ", "KOTAKBANK-EQ",
        "SBIN-EQ", "ADANIENT-EQ", "BAJAJ-AUTO-EQ"
        # add full Nifty 100 list
    ],
    "Custom": [
        "NAVKARURB-EQ", "INDOTECH-EQ", "GOACARBON-EQ", "PCJEWELLER-EQ", "BCG-EQ", "SUZLON-EQ"
    ]
}

def check_lower_circuit_stocks(stock_list_name):
    stocks = circuit_stock_lists.get(stock_list_name)
    if not stocks:
        log_json("Invalid stock list name", {"input": stock_list_name})
        return

    log_json("Stocks Loaded", {"type": stock_list_name, "count": len(stocks)})

    # ⬇️ Shoonya credentials
    user, password = "FA71897", "Zieers@2026"
    vc, app_key, imei = "FA71897_U", "036e0ee3e72de505cd7fe9cbcf16c7e8", "abc1234"
    totp_secret = "7O66IG4Y23562OZ3ZC3B2Z66S5T37265"
    exchange = "NSE"

    api = ShoonyaApiPy()
    otp = pyotp.TOTP(totp_secret).now()

    login_response = api.login(
        userid=user, password=password, twoFA=otp,
        vendor_code=vc, api_secret=app_key, imei=imei
    )
    if login_response.get("stat") != "Ok":
        log_json("Login Failed", login_response)
        return
    log_json("Login Successful", {"user": user})

    token_map = {}
    for stock in stocks:
        try:
            scrip = api.searchscrip(exchange, stock.split('-')[0])
            if scrip and scrip.get("values"):
                token_map[stock] = scrip['values'][0].get('token')
        except Exception as e:
            log_json("Token Fetch Error", {"stock": stock, "error": str(e)})

    recent_lc_stocks = {}

    while is_market_open():
        current_time = time.time()
        at_lower_circuit = []

        for stock, token in token_map.items():
            try:
                quote = api.get_quotes(exchange, token)
                if not quote:
                    continue

                lp = float(quote.get("lp", 0) or 0)
                lc = float(quote.get("lc", 0) or 0)

                if not lp or not lc:
                    continue

                if is_at_lower_circuit(lp, lc):
                    at_lower_circuit.append(stock)
                    recent_lc_stocks[stock] = current_time
                elif stock in recent_lc_stocks and current_time - recent_lc_stocks[stock] < 10:
                    at_lower_circuit.append(stock)
                elif stock in recent_lc_stocks:
                    del recent_lc_stocks[stock]

            except Exception as e:
                log_json("Quote Fetch Error", {"stock": stock, "error": str(e)})

        if not at_lower_circuit:
            log_json("No Stocks at Lower Circuit", {})
            time.sleep(30)
            continue

        log_json("Stocks at Lower Circuit", at_lower_circuit)

        for stock in at_lower_circuit:
            try:
                token = token_map[stock]
                quote = api.get_quotes(exchange, token)
                if not quote:
                    continue

                sq1 = int(quote.get("sq1", 0) or 0)
                ltp = float(quote.get("lp", 0) or 0)

                log_json("sq1 & ltp check", {"stock": stock, "sq1": sq1, "ltp": ltp})

                if sq1 >= 10 or ltp <= 100:
                    continue

                limits = api.get_limits()
                balance = float(limits.get("cash", 0) or 0)
                log_json("Available Cash", {"stock": stock, "balance": balance})

                if balance < ltp:
                    log_json("Insufficient Balance", {"stock": stock, "ltp": ltp, "balance": balance})
                    continue

                limit_price = round(ltp + 0.05, 2)
                log_json("Placing Buy Order", {"stock": stock, "limit_price": limit_price})

                order_resp = api.place_order(
                    buy_or_sell='B', product_type='C',
                    exchange=exchange, tradingsymbol=stock,
                    quantity=1, discloseqty=0, price_type='LMT',
                    price=limit_price, retention='DAY',
                    remarks='Auto LC Buy - LMT'
                )

                if not order_resp or order_resp.get("stat") != "Ok":
                    log_json("Buy Order Failed", {"stock": stock, "response": order_resp})
                    continue

                log_json("Buy Order Placed", {"stock": stock, "order_id": order_resp.get("norenordno")})
                order_id = order_resp.get("norenordno")
                time.sleep(2)

                buy_price = None
                orders = api.get_order_book()
                for o in orders:
                    if o.get("norenordno") == order_id and o.get("status") == "COMPLETE":
                        buy_price = float(o.get("avgprc", 0) or 0)
                        break

                if not buy_price:
                    log_json("Buy Price Not Found", {"stock": stock})
                    continue

                stop_loss = round(buy_price * 0.99, 2)
                sell_price = round(buy_price * 1.015, 2)
                log_json("Stop Loss Initialized", {
                    "stock": stock,
                    "buy_price": buy_price,
                    "stop_loss": stop_loss,
                    "sell_price": sell_price
                })

                while is_market_open():
                    quote = api.get_quotes(exchange, token)
                    ltp = float(quote.get("lp", 0) or 0)
                    if ltp <= stop_loss:
                        sell = api.place_order(
                            buy_or_sell='S', product_type='C',
                            exchange=exchange, tradingsymbol=stock,
                            quantity=1, discloseqty=0, price_type='LMT',
                            price=sell_price, retention='DAY',
                            remarks='Auto SL Sell'
                        )
                        log_json("Stop Loss Triggered", {"stock": stock, "sell_order": sell})
                        break
                    time.sleep(5)

            except Exception as e:
                log_json("Processing Error", {"stock": stock, "error": str(e)})

            time.sleep(10)

        time.sleep(30)

    log_json("Market Closed", {})

if __name__ == "__main__":
    try:
        input_json = sys.stdin.read()
        data = json.loads(input_json)
        selected = data.get("circuit")
        if selected:
            check_lower_circuit_stocks(selected)
        else:
            log_json("No circuit type provided", {})
    except Exception as e:
        log_json("Script Input Error", {"error": str(e)})


