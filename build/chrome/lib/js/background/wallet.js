/*
 * JavaScript for monitoring wallet info in the background.
 */
var wallet_info = {
  port: '',
  address: '',
  balance: '--',
  unlockedBalance: '--',
  height: '--',
  status: 'off',
  saveAuth: false,
  username: '',
  password: ''
};

// Listen for part of the extension requesting wallet info and reply:
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  // console.log(sender.tab ? "from a content script:" + sender.tab.url : "from the extension");
  if (!sender.tab ||
      sender.tab.url === "chrome-extension://" + chrome.runtime.id + "/data/html/send.html" ||
      sender.tab.url === "chrome-extension://" + chrome.runtime.id + "/data/html/keys.html" ||
      sender.tab.url === "chrome-extension://" + chrome.runtime.id + "/data/html/options.html") {
    if (request.greeting == "Monero monero-wallet-rpc Send Wallet Info") {
      sendResponse(wallet_info);
    } else if (request.greeting == "Monero monero-wallet-rpc Update Wallet Info") {
      wallet_info.port = request.newWalletPort;
      wallet_info.username = request.username;
      wallet_info.password = request.password;
      wallet_info.saveAuth = request.saveAuth;
      getAddress(wallet_info.port,
        function (resp) {
          wallet_info.address = resp.result.address;
          wallet_info.status = 'ok';
        },
        function (err) {
          wallet_info.status = 'off';
        }
      );
      sendResponse("Wallet info updated.");
    }
  }
});

// Get wallet status and address:
// var get_status = function () {
function get_status() {
  if (Number(wallet_info.port) >= 1 && Number(wallet_info.port) <= 65535) {
    getAddress(wallet_info.port,
      function (resp) {
        if (wallet_info.status == 'off') removeErrorBadge();
        wallet_info.status = 'ok';
        wallet_info.address = resp.result.address;
        setTimeout(get_status, 10000);
      },
      function (err) {
        console.log('get_status: off. ' + err + ' Trying again in 10 seconds.')
        wallet_info.status = 'off';
        addErrorBadge();
        setTimeout(get_status, 10000);
      }
    );
  } else {
    // If valid port hasn't been set, pause, then retry
    addErrorBadge();
    console.log('No port set.');
    setTimeout(get_status, 10000);
  }
};

// Setup polling to check wallet height:
//var get_height = function () {
function get_height() {
  if (Number(wallet_info.port) >= 1 && Number(wallet_info.port) <= 65535 && wallet_info.status == 'ok') {
    getHeight(wallet_info.port,
      function (resp) {
        // Update height, pause, then check again
        wallet_info.height = resp.result.height;
        setTimeout(get_height, 5000);
      },
      function (err) {
        wallet_info.status = 'off';
        setTimeout(get_height, 5000);
      }
    );
  } else {
    // If valid port hasn't been set, pause, then retry
    setTimeout(get_height, 5000);
  }
};

// Setup polling to check wallet balance:
// var get_balance = function () {
function get_balance() {
  if (Number(wallet_info.port) >= 1 && Number(wallet_info.port) <= 65535 && wallet_info.status == 'ok') {
    getBalance(wallet_info.port,
      function (resp) {
        var old_balance = wallet_info.balance;
        // Update balance, pause, then check again
        wallet_info.balance = coinsFromAtomic(resp.result.balance.toString());
        wallet_info.unlockedBalance = coinsFromAtomic(resp.result.unlocked_balance.toString());

        if (old_balance != wallet_info.balance) {
          updateBadge();
        }
        setTimeout(get_balance, 5000);
      },
      function (err) {
        wallet_info.status = 'off';
        setTimeout(get_balance, 5000);
      }
    );
  } else {
    // If valid port hasn't been set, pause, then retry
    if (wallet_info.status == 'ok') {
      chrome.runtime.openOptionsPage();
    }
    setTimeout(get_balance, 5000);
  }
};

function reset_auth() {
  if (chrome.extension.getViews().length === 1) {
    chrome.storage.sync.get({
      saveAuth: false,
      username: '',
      password: ''
    }, function(items) {
      wallet_info.saveAuth = items.saveAuth;
      if (wallet_info.saveAuth === false) {
          wallet_info.status = "off";
      }
      wallet_info.username = items.username;
      wallet_info.password = items.password;
      setTimeout(reset_auth, 10000);
    });
  } else {
    setTimeout(reset_auth, 10000);
  }
};

function updateBadge() {
  chrome.browserAction.setBadgeBackgroundColor({color: '#FC6622'});
  chrome.browserAction.setBadgeText({text:'!'});
}

function addErrorBadge() {
  chrome.browserAction.setBadgeBackgroundColor({color: '#DD3333'});
  chrome.browserAction.setBadgeText({text:'X'});
}

function removeErrorBadge() {
  chrome.browserAction.setBadgeText({text:''});
}

// Monitor wallet info from storage and json_rpc:
function monitorWalletInfo() {
  chrome.storage.sync.get({
    walletPort: '',
    saveAuth: false,
    username: '',
    password: ''
  }, function(items) {
    wallet_info.port = items.walletPort;

    // If port is not set, launch the start menu
    if (items.walletPort == undefined || items.walletPort == "") {
      chrome.storage.sync.set({
        walletPort: 18082
      },
      function() {
        var start_tab = chrome.tabs.create({url: '/data/html/start.html'});
      });
      wallet_info.port = 18082;
    }

    // If authentication is saved, add it to background page
    if (items.saveAuth === true) {
        wallet_info.username = items.username;
        wallet_info.password = items.password;
        wallet_info.saveAuth = true;
    }

    // Start wallet info polling:
    reset_auth();
    get_status();
    get_balance();
    get_height();
  });
}

monitorWalletInfo();
