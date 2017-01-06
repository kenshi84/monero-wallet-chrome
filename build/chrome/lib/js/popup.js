var wallet_info = {
  port: '',
  address: '',
  balance: '0',
  unlockedBalance: '0',
  height: '0',
  status: "off",
  saveUserAgent: false,
  userAgent: ''
};

document.addEventListener('DOMContentLoaded', function () {

  // Get wallet info from settings:
  chrome.storage.sync.get({
    walletPort: '',
    saveUserAgent: false,
    userAgent: ''
  }, function (items) {
    // Once ready, update information:
    wallet_info.port = items.walletPort;
    wallet_info.saveUserAgent = items.saveUserAgent;
    wallet_info.userAgent = items.userAgent;
    if (Number(wallet_info.port) >= 1 && Number(wallet_info.port) <= 65535) {
      check_correct_user_agent(wallet_info);
      get_wallet_info();
    } else {
      // If wallet port is not set correctly, take them to the options page.
      chrome.runtime.openOptionsPage();
    }
  });

  document.getElementById("login-whats-this").addEventListener("click", function () {
      chrome.tabs.create({url: '/data/html/start.html'});
  });

  // Login with valid User Agent
  document.getElementById('user-agent-form').addEventListener('submit', function (e) {
    e.preventDefault();
    wallet_info.saveUserAgent = true;
    wallet_info.userAgent = String(document.getElementById('user-agent').value);

    var request = {
      greeting: "Monero monero-wallet-cli Update Wallet Info",
      newWalletPort: wallet_info.port,
      saveUserAgent: wallet_info.saveUserAgent,
      userAgent: wallet_info.userAgent
    };
    chrome.runtime.sendMessage(request, function (resp) {
      console.log(resp);
      check_correct_user_agent(wallet_info);
    });
    
    return false;
  });

  contactsDB.open(function () { console.log('Contacts DB initialized.'); });
  outgoingTxsDB.open(function () { console.log('Outgoing Txs DB initialized.'); });

  startButtonListeners();

  document.getElementById('send-button').addEventListener('click', confirmSend);

  document.getElementById('send-contact-0').addEventListener('click', function () {
    chooseSendContacts('send-dest-0');
  });

  document.getElementById('save-contact-0').addEventListener('click', function () {
    chooseSaveContacts('send-dest-0');
  });

  document.getElementById('random-pay-id').addEventListener('click', function () {
    // Check if integrated payment ID is selected:
    var int_pay_id = checkIntegrated();

    var random_pay_id;

    if (int_pay_id == 1) {
      random_pay_id = genRandomHexPayID('integrated');
    } else {
      random_pay_id = genRandomHexPayID('');
    }

    document.getElementById('receive-pay-id').value = random_pay_id;
  });

  // Handle new contact form submissions.
  document.getElementById('save-contact-button').addEventListener('click', function () {
    document.getElementById('save-contact-button').disabled = true;
    storeNewContact();
  });

  removeBadge();

});

function removeBadge() {
  chrome.browserAction.setBadgeText({text:''});
}

var check_correct_user_agent = function (info) {
  if (info.saveUserAgent === true) {
    getAddress(wallet_info.port,
      function (resp) {
        if (resp.hasOwnProperty('result')) {
          var status = document.getElementById('user-agent-success');
          status.style.display = 'inline-block'
          setTimeout(function () {
            status.style.display = 'none';
            document.getElementById('set-user-agent').style.display = 'none';
          }, 50);
        } else {
          var status = document.getElementById('user-agent-error');
          status.style.display = 'inline-block'
          setTimeout(function() {
            status.style.display = 'none';
          }, 5000);
        }
      },
      function (error) {
        console.log(error);
        var status = document.getElementById('user-agent-error');
        status.style.display = 'inline-block'
        setTimeout(function() {
          status.style.display = 'none';
        }, 5000);
      }
    );
  }
}

var get_wallet_info = function () {
  var request = {greeting: "Monero monero-wallet-cli Send Wallet Info"};
  chrome.runtime.sendMessage(request, function (resp) {
    wallet_info.port = resp.port;

    if (resp.status == 'ok') {
      wallet_info.status = resp.status;

      document.getElementById('wallet-status-online').style.display = 'inline-block';
      document.getElementById('wallet-status-offline').style.display = 'none';

      if (wallet_info.balance != resp.balance) {
        wallet_info.balance = resp.balance;
        document.getElementById('balance').textContent = numberWithCommas(wallet_info.balance);
        document.getElementById('send-total-balance').textContent = numberWithCommas(resp.balance);
      }

      if (wallet_info.unlocked_balance != resp.unlockedBalance) {
        wallet_info.unlocked_balance = resp.unlockedBalance;
        document.getElementById('unlocked-balance').textContent = numberWithCommas(wallet_info.unlocked_balance);
        document.getElementById('send-unlocked-balance').textContent = numberWithCommas(resp.unlockedBalance);
      }

      if (wallet_info.height != resp.height) {
        wallet_info.height = resp.height;
        document.getElementById('wallet-height').textContent = wallet_info.height;
      }

      if (wallet_info.address != resp.address) {
        wallet_info.address = resp.address;
        document.getElementById('address-string').textContent = wallet_info.address;
        document.getElementById('address-string-ell').textContent = '...';
        var qrcode = new QRCode("address-qr", {
          text: "monero:" + wallet_info.address,
          width: 192,
          height: 192,
          colorDark : "#000000",
          colorLight : "#ffffff",
          correctLevel : QRCode.CorrectLevel.H
        });
      }

    } else {
      wallet_info.status = resp.status;

      document.getElementById('wallet-status-online').style.display = 'none';
      document.getElementById('wallet-status-offline').style.display = 'inline-block';
    }

    setTimeout(get_wallet_info, 5000);
  });
};

function makeReceiveQR() {
  document.getElementById('receive-qr-info').style.display = 'block';
  var amount =  document.getElementById('receive-amount').value;
  var payment_id =  document.getElementById('receive-pay-id').value;

  // Check if integrated payment ID is selected:
  var int_pay_id = checkIntegrated();

  // Make QR code:
  if (int_pay_id == 1) {
    receiveIntegratedQR(payment_id, amount);
  } else {
    receiveNormalQR(payment_id, amount);
  }
}

function checkIntegrated () {
  var int_pay_id = '';
  var radios1 = document.getElementsByName('int-pay-id');
  for (var i = 0; i < radios1.length; i++) {
    if (radios1[i].checked) {
	  int_pay_id = radios1[i].value;
	  break;
	}
  }
  return int_pay_id;
}

function receiveIntegratedQR (payment_id, amount) {
  makeIntegratedAddress(wallet_info.port, payment_id,
    function (resp) {
      console.log(resp);
      if (resp.hasOwnProperty('result')) {
        document.getElementById('receive-qr').innerHTML = '';

        var integrated_address = resp.result.integrated_address;
        var amnt_str = String(amount);

        var uri_string = 'monero:' + integrated_address;
        if (amnt_str.length > 0) uri_string += '?amount=' + amnt_str;

        var qrcode = new QRCode('receive-qr', {
          text: uri_string,
          width: 192,
          height: 192,
          colorDark : '#000000',
          colorLight : '#FFFFFF',
          correctLevel : QRCode.CorrectLevel.H
        });

        document.getElementById('receive-integrated-address').innerHTML = '';
        document.getElementById('receive-integrated-address').innerHTML = integrated_address;
        document.getElementById('receive-integrated-address-ell').innerHTML = '...';
      }
    },
    function (error) {
      console.log(error);
    }
  );
}

function receiveNormalQR (payment_id, amount) {
  var amnt_str   = String(amount);
  var pay_id_str = String(payment_id);

  var uri_string = 'monero:' + wallet_info.address;
  if (amnt_str.length > 0)   uri_string += '?amount=' + amnt_str;
  if (pay_id_str.length > 0) uri_string += '?payment_id=' + pay_id_str;

  document.getElementById('receive-qr').innerHTML = '';
  var qrcode = new QRCode('receive-qr', {
    text: uri_string,
    width: 192,
    height: 192,
    colorDark : '#000000',
    colorLight : '#FFFFFF',
    correctLevel : QRCode.CorrectLevel.H
  });

  document.getElementById('receive-integrated-address').innerHTML = '';
  document.getElementById('receive-integrated-address-ell').innerHTML = '';
}

function getAllIndices(transfers, tx_hash) {
  var indices = [];
  for (var i = 0; i < transfers.length; i++) {
    if (transfers[i].tx_hash == tx_hash) {
      indices.push(i);
    }
  }
  return indices;
}

function fillIncomingTransactionTable(tx_table_id, transfer_type) {
  incomingTransfers(wallet_info.port, transfer_type,
    function (resp) { // Successfully get transfers

      var transfers = resp.result.transfers;
      var unique_transfers = [];

      // Clear table and re-insert header:
      var table = document.getElementById(tx_table_id);
      table.innerHTML = '<tr id="tx-line-top"><th class="tx-number">#</th><th class="tx-amount">Amount</th><th class="tx-hash">Hash</th></tr>';

      // Loop through all incoming transfers, and group by tx hash
      var k = 0;
      var l_tr = transfers.length;
      for (var i = 0; i < l_tr; i++) {
        var transfer_i = transfers[i];
        var transfer_hash = transfer_i.tx_hash;

        // If this is the first time seeing a tx hash, get all instances and process them
        if (unique_transfers.indexOf(transfer_hash) == -1) {
          unique_transfers.push(transfer_hash);

          // Many txs have multiple outputs. Sum output amounts for the given tx hash
          var transfer_indices = getAllIndices(transfers, transfer_hash);
          var transfer_amount = 0;
          for (var j = 0; j < transfer_indices.length; j++) {
            transfer_amount += Number(transfers[transfer_indices[j]].amount);
          }

          // Insert a new row into the table and add tx information
          var row = table.insertRow(1);
          row.id = 'tx-row-' + k;
          row.className = 'tx-row';
          if (k%2 == 0) {
            row.style.background = '#F0F0F0';
          }

          var number = row.insertCell(0);
          number.className = 'tx-number';
          number.id = 'tx-number-' + k;
          number.innerHTML = String(k+1);

          var amount = row.insertCell(1);
          amount.className = 'tx-amount';
          amount.id = 'tx-amount-' + k;
          amount.innerHTML = coinsFromAtomic(transfer_amount.toString()) + " &nbsp;";

          var hash   = row.insertCell(2);
          hash.className = 'tx-hash';
          hash.id = 'tx-hash-' + k;
          hash.innerHTML = '<div class="in-tx-hash"><a target="_blank" href="http://moneroblocks.info/search/' + transfer_hash + '">' + transfer_hash + '</a></div><div class="in-tx-hash-ell">...</div>';

          k += 1;
        }
      }
    },
    function (err) { // There was an error getting transfers
      document.getElementById('txs-error').innerHTML = 'There was an error retrieving your incoming transactions.';
      document.getElementById('txs-error').style.display = 'inline-block';
    }
  );
}

function fillOutgoingTransactionTable(tx_table_id, transfer_type) {
  outgoingTxsDB.fetchOutgoingTxs( function (outgoingTxs) { // Successfully get transfers

    // Clear table and re-insert header:
    var table = document.getElementById(tx_table_id);
    table.innerHTML = '<tr id="tx-line-top"><th class="tx-number">#</th><th class="tx-amount">Amount</th><th class="tx-hash">Info</th></tr>';

    // Loop through all incoming transfers, and group by tx hash
    var l_tr = outgoingTxs.length;
    for (var i = 0; i < l_tr; i++) {

      // Get info for this transaction
      var pay_id = outgoingTxs[i].payment_id
      var hashes = outgoingTxs[i].tx_hash_list;
      var dests  = outgoingTxs[i].destinations;
      var Ndests = dests.length;

      // Some txs have multiple destinations - sum to get total
      var total_amount = 0;
      for (var j = 0; j < Ndests; j++) {
        total_amount += Number(dests[j].amount);
      }

      // Insert a new row into the table and add tx information
      var row = table.insertRow(1);
      row.id = 'tx-row-' + i;
      row.className = 'tx-row';
      if (i%2 == 0) {
        row.style.background = '#F0F0F0';
      }

      var number = row.insertCell(0);
      number.className = 'tx-number';
      number.id = 'tx-number-' + i;
      number.innerHTML = String(i+1);

      var amount = row.insertCell(1);
      amount.className = 'tx-amount';
      amount.id = 'tx-amount-' + i;
      amount.innerHTML = coinsFromAtomic(total_amount.toString()) + " &nbsp;";

      var info   = row.insertCell(2);
      info.className = 'tx-hash';
      info.id = 'tx-hash-' + i;

      var show_info = document.createElement('div');
      show_info.className = 'outgoing-tx-toggle-show';
      show_info.id = 'out-tx-show-' + i;
      show_info.innerHTML = 'Show Details';
      info.appendChild(show_info);

      var hide_info = document.createElement('div');
      hide_info.className = 'outgoing-tx-toggle-hide';
      hide_info.id = 'out-tx-hide-' + i;
      hide_info.innerHTML = 'Hide Details';
      info.appendChild(hide_info);

      var info_details = document.createElement('div');
      info_details.className = 'outgoing-tx-details';
      info_details.id = 'out-tx-details-' + i;

      var pay_div = document.createElement('div');
      pay_div.className = 'outgoing-pay-id';
      pay_div.innerHTML = '<div class="out-pay-id-link"><span class="bold">Payment ID:</span> <a target="_blank" href="http://moneroblocks.info/search/' + pay_id + '">' + pay_id + '</a></div><div class="in-tx-hash-ell">...</div>';
      info_details.appendChild(pay_div);

      var dest_title = document.createElement('div');
      dest_title.className = 'out-title';
      dest_title.innerHTML = '<span class="bold">Destinations:</span>';
      info_details.appendChild(dest_title);

      for (var j = 0; j < Ndests; j++) {
        var dest_j = document.createElement('div');
        dest_j.className = 'outgoing-dest';
        dest_j.innerHTML = '<div class="out-dest-type">Address:</div><div class="out-dest-field">' + dests[j].address + '</div><div class="in-tx-hash-ell">...</div><br>';
        dest_j.innerHTML += '<div class="out-dest-type">Amount:</div><div class="out-dest-field">' + coinsFromAtomic(dests[j].amount.toString()) + '</div>';
        info_details.appendChild(dest_j);
      }

      var hash_list = document.createElement('div');
      hash_list.className = 'outgoing-hashes';
      hash_list.innerHTML = '<span class="bold">Tx Hashes:</span><br>';
      for (var j = 0; j < hashes.length; j++) {
        hash_list.innerHTML += '<div class="outgoing-hash-link"><a target="_blank" href="http://moneroblocks.info/search/' + hashes[i] + '">' + hashes[i] + '</a></div><div class="in-tx-hash-ell">...</div><br>';
      }
      info_details.appendChild(hash_list);


      info.appendChild(info_details);

      document.getElementById(show_info.id).addEventListener('click', function () {
        document.getElementById(info_details.id).style.display = 'inline-block';
        document.getElementById(show_info.id).style.display = 'none';
        document.getElementById(hide_info.id).style.display = 'inline-block';
      });

      document.getElementById(hide_info.id).addEventListener('click', function () {
        document.getElementById(info_details.id).style.display = 'none';
        document.getElementById(show_info.id).style.display = 'inline-block';
        document.getElementById(hide_info.id).style.display = 'none';
      });

    }
  });
}

// Update the list of contacts.
function chooseSendContacts(addr_form_id) {
  document.getElementById('send-contact-list').style.display = 'block';
  // contactsDB.open(function () {
    contactsDB.fetchContacts(function(contacts) {

      var contactList = document.getElementById('send-contacts');
      contactList.innerHTML = '';

      for (var i = 0; i < contacts.length; i++) {
        // Read the contacts backwards (most recent first).
        var contact = contacts[(contacts.length - 1 - i)];

        var li = document.createElement('li');
        li.id = 'send-contact-' + contact.timestamp;

        var contactName = document.createElement('span');
        contactName.className = 'send-contact-name';
        contactName.innerHTML = contact.name;
        contactName.setAttribute("data-id", contact.xmr_address);
        li.appendChild(contactName);

        contactList.appendChild(li);

        // Setup an event listener for the checkbox.
        li.addEventListener('click', function(e) {
          var addr = String(e.target.getAttribute('data-id'));
          document.getElementById(addr_form_id).value = addr;
          document.getElementById('send-contact-list').style.display = 'none';
        });
      }

    });
  // });
}

// Update the list of contacts.
function chooseSaveContacts(addr_form_id) {
  document.getElementById('save-contact-dialog').style.display = 'block';
  document.getElementById('save-contact-addr').value = document.getElementById(addr_form_id).value;
  document.getElementById('save-contact-button').disabled = false;
}

function storeNewContact () {
  var contactName = document.getElementById('save-contact-name');
  var contactAddr = document.getElementById('save-contact-addr');
  var contactInfo = document.getElementById('save-contact-info');

  // Get the contact.
  var name = contactName.value;
  var xmr_addr = contactAddr.value;
  var info = contactInfo.value;

  // Check to make sure the name and xmr_addr are not blank (or just spaces).
  if (name.replace(/ /g,'') != '' && xmr_addr.replace(/ /g,'') != '') {
    // Create the contact.
    contactsDB.createContact(name, xmr_addr, info, function(contact) {
      var status = document.getElementById('save-success');
      status.innerHTML = 'Contact saved successfully.';
      status.style.display = 'block';
      setTimeout(function() {
        status.style.display = 'none';
      }, 5000);
    });
  }

  // Reset the input fields.
  contactName.value = '';
  contactAddr.value = '';
  contactInfo.value = '';

  document.getElementById('save-contact-dialog').style.display = 'none';
}

function confirmSend () {

  document.getElementById('send-confirm-popup').style.display = 'block';
  document.querySelector('#verify-send-checkbox').checked = false;
  document.getElementById("send-confirm-yes").disabled = true;

  var addresses = document.getElementsByClassName('send-input-dest');
  var amounts = document.getElementsByClassName('send-input-amount');
  var pay_id = document.getElementById('send-pay-id').value;
  var mixin = document.getElementById('send-mixin').value;

  if (pay_id == "" || pay_id == undefined) {
    document.getElementById('send-confirm-payid').innerHTML = 'none';
  } else {
    document.getElementById('send-confirm-payid').innerHTML = pay_id;
  }

  if (mixin == "" || mixin == undefined) {
    document.getElementById('send-confirm-mixin').innerHTML = '3';
  } else {
    document.getElementById('send-confirm-mixin').innerHTML = mixin;
  }

  // Add all destinations to list:
  var ul = document.getElementById('send-confirm-list');
  ul.innerHTML = '';
  for (var i = 0; i < addresses.length; i++) {
    var address = addresses[i].value;
    var amount = amounts[i].value;

    var li = document.createElement('li');
    li.id = 'send-confirm-' + i;

    // Add address to confirm list item:
    var addr_head = document.createElement('div');
    addr_head.className = 'send-confirm-header';
    addr_head.innerHTML = 'Address:';
    li.appendChild(addr_head);

    var addr = document.createElement('div');
    addr.className = 'send-confirm-field';
    addr.innerHTML = address.substring(0,48) + ' ' + address.substring(48,address.length);
    li.appendChild(addr);

    // Add amount to confirm list item:
    var amnt_head = document.createElement('div');
    amnt_head.className = 'send-confirm-header';
    amnt_head.innerHTML = 'Amount:';
    li.appendChild(amnt_head);

    var amnt = document.createElement('div');
    amnt.className = 'send-confirm-field';
    if (amount != '') amnt.innerHTML = amount + ' XMR';
    li.appendChild(amnt);

    if (i%2 == 0) {
      li.style.background = '#F0F0F0';
    }

    // Add completed item to list:
    ul.appendChild(li);
  }

  document.querySelector('#verify-send-checkbox').addEventListener('change', function () {
    if (document.querySelector('#verify-send-checkbox').checked) {
      document.getElementById("send-confirm-yes").disabled = false;
    } else {
      document.getElementById("send-confirm-yes").disabled = true;
    }
  });

  document.getElementById('send-confirm-yes').onclick = function () {
    document.getElementById("send-confirm-yes").disabled = true;
    document.querySelector('#verify-send-checkbox').checked = false;
    sendMonero();
    document.getElementById('send-confirm-popup').style.display = 'none';
  };
  document.getElementById('send-confirm-no').onclick = function () {
    document.getElementById('send-confirm-popup').style.display = 'none';
  };

}

// Send Monero to destination on button click
function sendMonero () {
  var addresses = document.getElementsByClassName('send-input-dest');
  var amounts = document.getElementsByClassName('send-input-amount');
  var dests = [];
  for (var i=0; i < addresses.length; i++) {
    var amnt = JSONbig.parse(coinsToAtomic(amounts[i].value));
    var addr = addresses[i].value;
    if (JSONbig.stringify(amnt).length > 0 && addr.length > 0) {
      dests.push({amount: amnt, address: addr });
    }
  }

  var pay_id = document.getElementById('send-pay-id').value;
  var mixin = Number(document.getElementById('send-mixin').value);

  if (pay_id.length == 0) { pay_id = undefined; }
  if (mixin.length == 0 || mixin < 3) { mixin = 3; }

  var fee = undefined, unlock_time = undefined, get_tx_key = true, new_algo = true;

  transferSplit(wallet_info.port, dests, pay_id, fee, mixin, unlock_time, get_tx_key, new_algo,
    function (resp) {
      console.log(resp);
      if (resp.hasOwnProperty("result")) {
        // Send successful:
        var tx_hash_list = resp.result.tx_hash_list;
        var status = document.getElementById('send-success');
        var tx_hashes = [];
        for (var i=0; i < tx_hash_list.length; i++) {
          tx_hashes.push(tx_hash_list[i]);
          document.getElementById('send-txhashlist-popup').innerHTML += tx_hash_list[i] + '<br>';
        }

        outgoingTxsDB.createOutgoingTx(pay_id, dests, tx_hashes, function(contact) {
          console.log('Outgoing tx successfully stored in database.');
        });

        status.style.display = 'block';
        setTimeout(function() {
          status.style.display = 'none';
        }, 20000);
      } else if (resp.hasOwnProperty("error")) {
        // Send unsuccessful:
        var status = document.getElementById('send-error');
        status.innerHTML = "Error: " + resp.error.message;
        status.style.display = 'block';
        setTimeout(function() {
          status.style.display = 'none';
        }, 10000);
      } else {
        // Unknown error:
        var status = document.getElementById('send-error');
        status.innerHTML = 'There was an error sending your transaction.';
        status.style.display = 'block';
        setTimeout(function() {
          status.style.display = 'none';
        }, 10000);
      }
    },
    function (err) {
      var status = document.getElementById('send-error');
      status.innerHTML = 'There was an error connecting to monero-wallet-cli.';
      status.style.display = 'block';
      setTimeout(function() {
        status.style.display = 'none';
      }, 10000);
    }
  );
}
