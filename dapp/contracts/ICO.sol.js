var Web3 = require("web3");
var SolidityEvent = require("web3/lib/web3/event.js");

(function() {
  // Planned for future features, logging, etc.
  function Provider(provider) {
    this.provider = provider;
  }

  Provider.prototype.send = function() {
    this.provider.send.apply(this.provider, arguments);
  };

  Provider.prototype.sendAsync = function() {
    this.provider.sendAsync.apply(this.provider, arguments);
  };

  var BigNumber = (new Web3()).toBigNumber(0).constructor;

  var Utils = {
    is_object: function(val) {
      return typeof val == "object" && !Array.isArray(val);
    },
    is_big_number: function(val) {
      if (typeof val != "object") return false;

      // Instanceof won't work because we have multiple versions of Web3.
      try {
        new BigNumber(val);
        return true;
      } catch (e) {
        return false;
      }
    },
    merge: function() {
      var merged = {};
      var args = Array.prototype.slice.call(arguments);

      for (var i = 0; i < args.length; i++) {
        var object = args[i];
        var keys = Object.keys(object);
        for (var j = 0; j < keys.length; j++) {
          var key = keys[j];
          var value = object[key];
          merged[key] = value;
        }
      }

      return merged;
    },
    promisifyFunction: function(fn, C) {
      var self = this;
      return function() {
        var instance = this;

        var args = Array.prototype.slice.call(arguments);
        var tx_params = {};
        var last_arg = args[args.length - 1];

        // It's only tx_params if it's an object and not a BigNumber.
        if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
          tx_params = args.pop();
        }

        tx_params = Utils.merge(C.class_defaults, tx_params);

        return new Promise(function(accept, reject) {
          var callback = function(error, result) {
            if (error != null) {
              reject(error);
            } else {
              accept(result);
            }
          };
          args.push(tx_params, callback);
          fn.apply(instance.contract, args);
        });
      };
    },
    synchronizeFunction: function(fn, instance, C) {
      var self = this;
      return function() {
        var args = Array.prototype.slice.call(arguments);
        var tx_params = {};
        var last_arg = args[args.length - 1];

        // It's only tx_params if it's an object and not a BigNumber.
        if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
          tx_params = args.pop();
        }

        tx_params = Utils.merge(C.class_defaults, tx_params);

        return new Promise(function(accept, reject) {

          var decodeLogs = function(logs) {
            return logs.map(function(log) {
              var logABI = C.events[log.topics[0]];

              if (logABI == null) {
                return null;
              }

              var decoder = new SolidityEvent(null, logABI, instance.address);
              return decoder.decode(log);
            }).filter(function(log) {
              return log != null;
            });
          };

          var callback = function(error, tx) {
            if (error != null) {
              reject(error);
              return;
            }

            var timeout = C.synchronization_timeout || 240000;
            var start = new Date().getTime();

            var make_attempt = function() {
              C.web3.eth.getTransactionReceipt(tx, function(err, receipt) {
                if (err) return reject(err);

                if (receipt != null) {
                  // If they've opted into next gen, return more information.
                  if (C.next_gen == true) {
                    return accept({
                      tx: tx,
                      receipt: receipt,
                      logs: decodeLogs(receipt.logs)
                    });
                  } else {
                    return accept(tx);
                  }
                }

                if (timeout > 0 && new Date().getTime() - start > timeout) {
                  return reject(new Error("Transaction " + tx + " wasn't processed in " + (timeout / 1000) + " seconds!"));
                }

                setTimeout(make_attempt, 1000);
              });
            };

            make_attempt();
          };

          args.push(tx_params, callback);
          fn.apply(self, args);
        });
      };
    }
  };

  function instantiate(instance, contract) {
    instance.contract = contract;
    var constructor = instance.constructor;

    // Provision our functions.
    for (var i = 0; i < instance.abi.length; i++) {
      var item = instance.abi[i];
      if (item.type == "function") {
        if (item.constant == true) {
          instance[item.name] = Utils.promisifyFunction(contract[item.name], constructor);
        } else {
          instance[item.name] = Utils.synchronizeFunction(contract[item.name], instance, constructor);
        }

        instance[item.name].call = Utils.promisifyFunction(contract[item.name].call, constructor);
        instance[item.name].sendTransaction = Utils.promisifyFunction(contract[item.name].sendTransaction, constructor);
        instance[item.name].request = contract[item.name].request;
        instance[item.name].estimateGas = Utils.promisifyFunction(contract[item.name].estimateGas, constructor);
      }

      if (item.type == "event") {
        instance[item.name] = contract[item.name];
      }
    }

    instance.allEvents = contract.allEvents;
    instance.address = contract.address;
    instance.transactionHash = contract.transactionHash;
  };

  // Use inheritance to create a clone of this contract,
  // and copy over contract's static functions.
  function mutate(fn) {
    var temp = function Clone() { return fn.apply(this, arguments); };

    Object.keys(fn).forEach(function(key) {
      temp[key] = fn[key];
    });

    temp.prototype = Object.create(fn.prototype);
    bootstrap(temp);
    return temp;
  };

  function bootstrap(fn) {
    fn.web3 = new Web3();
    fn.class_defaults  = fn.prototype.defaults || {};

    // Set the network iniitally to make default data available and re-use code.
    // Then remove the saved network id so the network will be auto-detected on first use.
    fn.setNetwork("default");
    fn.network_id = null;
    return fn;
  };

  // Accepts a contract object created with web3.eth.contract.
  // Optionally, if called without `new`, accepts a network_id and will
  // create a new version of the contract abstraction with that network_id set.
  function Contract() {
    if (this instanceof Contract) {
      instantiate(this, arguments[0]);
    } else {
      var C = mutate(Contract);
      var network_id = arguments.length > 0 ? arguments[0] : "default";
      C.setNetwork(network_id);
      return C;
    }
  };

  Contract.currentProvider = null;

  Contract.setProvider = function(provider) {
    var wrapped = new Provider(provider);
    this.web3.setProvider(wrapped);
    this.currentProvider = provider;
  };

  Contract.new = function() {
    if (this.currentProvider == null) {
      throw new Error("ICO error: Please call setProvider() first before calling new().");
    }

    var args = Array.prototype.slice.call(arguments);

    if (!this.unlinked_binary) {
      throw new Error("ICO error: contract binary not set. Can't deploy new instance.");
    }

    var regex = /__[^_]+_+/g;
    var unlinked_libraries = this.binary.match(regex);

    if (unlinked_libraries != null) {
      unlinked_libraries = unlinked_libraries.map(function(name) {
        // Remove underscores
        return name.replace(/_/g, "");
      }).sort().filter(function(name, index, arr) {
        // Remove duplicates
        if (index + 1 >= arr.length) {
          return true;
        }

        return name != arr[index + 1];
      }).join(", ");

      throw new Error("ICO contains unresolved libraries. You must deploy and link the following libraries before you can deploy a new version of ICO: " + unlinked_libraries);
    }

    var self = this;

    return new Promise(function(accept, reject) {
      var contract_class = self.web3.eth.contract(self.abi);
      var tx_params = {};
      var last_arg = args[args.length - 1];

      // It's only tx_params if it's an object and not a BigNumber.
      if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
        tx_params = args.pop();
      }

      tx_params = Utils.merge(self.class_defaults, tx_params);

      if (tx_params.data == null) {
        tx_params.data = self.binary;
      }

      // web3 0.9.0 and above calls new twice this callback twice.
      // Why, I have no idea...
      var intermediary = function(err, web3_instance) {
        if (err != null) {
          reject(err);
          return;
        }

        if (err == null && web3_instance != null && web3_instance.address != null) {
          accept(new self(web3_instance));
        }
      };

      args.push(tx_params, intermediary);
      contract_class.new.apply(contract_class, args);
    });
  };

  Contract.at = function(address) {
    if (address == null || typeof address != "string" || address.length != 42) {
      throw new Error("Invalid address passed to ICO.at(): " + address);
    }

    var contract_class = this.web3.eth.contract(this.abi);
    var contract = contract_class.at(address);

    return new this(contract);
  };

  Contract.deployed = function() {
    if (!this.address) {
      throw new Error("Cannot find deployed address: ICO not deployed or address not set.");
    }

    return this.at(this.address);
  };

  Contract.defaults = function(class_defaults) {
    if (this.class_defaults == null) {
      this.class_defaults = {};
    }

    if (class_defaults == null) {
      class_defaults = {};
    }

    var self = this;
    Object.keys(class_defaults).forEach(function(key) {
      var value = class_defaults[key];
      self.class_defaults[key] = value;
    });

    return this.class_defaults;
  };

  Contract.extend = function() {
    var args = Array.prototype.slice.call(arguments);

    for (var i = 0; i < arguments.length; i++) {
      var object = arguments[i];
      var keys = Object.keys(object);
      for (var j = 0; j < keys.length; j++) {
        var key = keys[j];
        var value = object[key];
        this.prototype[key] = value;
      }
    }
  };

  Contract.all_networks = {
  "default": {
    "abi": [
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "uint256"
          },
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "priceChange",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "erc20TokensContractAddress",
        "outputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "dealsNumber",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_erc20TokensContractAddress",
            "type": "address"
          }
        ],
        "name": "setErc20TokensContract",
        "outputs": [
          {
            "name": "",
            "type": "bool"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_to",
            "type": "address"
          },
          {
            "name": "_quantity",
            "type": "uint256"
          }
        ],
        "name": "transferTokensTo",
        "outputs": [
          {
            "name": "",
            "type": "bool"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_sumToWithdrawInFinney",
            "type": "uint256"
          }
        ],
        "name": "withdraw",
        "outputs": [
          {
            "name": "",
            "type": "bool"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "_index",
            "type": "uint256"
          }
        ],
        "name": "getPriceChange",
        "outputs": [
          {
            "name": "",
            "type": "uint256[3]"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "uint256"
          },
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "deals",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_priceToBuyInFinney",
            "type": "uint256"
          }
        ],
        "name": "setNewPriceInFinney",
        "outputs": [
          {
            "name": "",
            "type": "bool"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_quantity",
            "type": "uint256"
          },
          {
            "name": "_priceToBuyInFinney",
            "type": "uint256"
          }
        ],
        "name": "buyTokens",
        "outputs": [
          {
            "name": "",
            "type": "bool"
          }
        ],
        "payable": true,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_quantity",
            "type": "uint256"
          }
        ],
        "name": "transferTokensToContractOwner",
        "outputs": [
          {
            "name": "",
            "type": "bool"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [],
        "name": "withdrawAllToOwner",
        "outputs": [
          {
            "name": "",
            "type": "bool"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "priceToBuyInFinney",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [],
        "name": "transferAllTokensToOwner",
        "outputs": [
          {
            "name": "",
            "type": "bool"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "owner",
        "outputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_newOwner",
            "type": "address"
          }
        ],
        "name": "changeOwner",
        "outputs": [
          {
            "name": "",
            "type": "bool"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_manager",
            "type": "address"
          }
        ],
        "name": "removeManager",
        "outputs": [
          {
            "name": "",
            "type": "bool"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_newManager",
            "type": "address"
          }
        ],
        "name": "setManager",
        "outputs": [
          {
            "name": "",
            "type": "bool"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "currentPriceChangeNumber",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "name": "isManager",
        "outputs": [
          {
            "name": "",
            "type": "bool"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "inputs": [],
        "payable": false,
        "type": "constructor"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "tokensContractAddress",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "setBy",
            "type": "address"
          }
        ],
        "name": "TokensContractAddressSet",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "transactionInitiatedBy",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "message",
            "type": "string"
          }
        ],
        "name": "Result",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "oldOwner",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "newOwner",
            "type": "address"
          }
        ],
        "name": "OwnerChanged",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "change",
            "type": "string"
          },
          {
            "indexed": false,
            "name": "manager",
            "type": "address"
          }
        ],
        "name": "ManagersChanged",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "newPriceToBuyInFinney",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "changedBy",
            "type": "address"
          }
        ],
        "name": "PriceChanged",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "to",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "priceInFinney",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "quantity",
            "type": "uint256"
          }
        ],
        "name": "Deal",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "from",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "to",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "quantity",
            "type": "uint256"
          }
        ],
        "name": "TokensTransfer",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "to",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "sumToWithdrawInFinney",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "message",
            "type": "string"
          }
        ],
        "name": "Withdrawal",
        "type": "event"
      }
    ],
    "unlinked_binary": "0x60606040526001805460a060020a60ff02191690556000600781905560095534610000575b60048054600160a060020a03191633600160a060020a03169081179091556000908152600560205260408120805460ff191660011790556002819055610076906401000000006101308102610ef51704565b600355604080516060810180835260025482524360208084019190915242938301939093526000805260069092527f54cdd369e4e8a8515e52ca72ec816c2101831ad1f18bf44102ed171459c9b4f8917f54cdd369e4e8a8515e52ca72ec816c2101831ad1f18bf44102ed171459c9b4fb919083905b828111156101075782518255916020019190600101906100ec565b5b506101289291505b808211156101245760008155600101610110565b5090565b50505b610140565b66038d7ea4c6800081025b919050565b610f318061014f6000396000f300606060405236156100f65763ffffffff60e060020a6000350416630d5cda7081146100fb57806317fccb47146101205780631c3f2f8c1461014957806320857295146101685780632be8c2a5146101955780632e1a7d4d146101c55780633b0b037a146101e95780633e083f7d1461023657806340c48c8d1461025b5780637975ce281461027f5780637d19e292146102a157806380710f39146102c55780638817a198146102e65780638bd8669e146103055780638da5cb5b14610326578063a6f9dae11461034f578063ac18de431461037c578063d0ebdbe7146103a9578063d4bc87d9146103d6578063f3ae2415146103f5575b610000565b346100005761010e600435602435610422565b60408051918252519081900360200190f35b346100005761012d610447565b60408051600160a060020a039092168252519081900360200190f35b346100005761010e610456565b60408051918252519081900360200190f35b3461000057610181600160a060020a036004351661045c565b604080519115158252519081900360200190f35b3461000057610181600160a060020a036004351660243561052f565b604080519115158252519081900360200190f35b346100005761018160043561067e565b604080519115158252519081900360200190f35b34610000576101f96004356107a0565b604051808260608083835b80518252602083111561022457601f199092019160209182019101610204565b50505090500191505060405180910390f35b346100005761010e600435602435610806565b60408051918252519081900360200190f35b346100005761018160043561082b565b604080519115158252519081900360200190f35b61018160043560243561094d565b604080519115158252519081900360200190f35b3461000057610181600435610c02565b604080519115158252519081900360200190f35b3461000057610181610c16565b604080519115158252519081900360200190f35b346100005761010e610c31565b60408051918252519081900360200190f35b3461000057610181610c37565b604080519115158252519081900360200190f35b346100005761012d610cb3565b60408051600160a060020a039092168252519081900360200190f35b3461000057610181600160a060020a0360043516610cc2565b604080519115158252519081900360200190f35b3461000057610181600160a060020a0360043516610d6f565b604080519115158252519081900360200190f35b3461000057610181600160a060020a0360043516610e23565b604080519115158252519081900360200190f35b346100005761010e610eda565b60408051918252519081900360200190f35b3461000057610181600160a060020a0360043516610ee0565b604080519115158252519081900360200190f35b6006602052816000526040600020816003811015610000570160005b91509150505481565b600154600160a060020a031681565b60095481565b60045460009033600160a060020a0390811691161461047a57610000565b60015460a060020a900460ff161561049157610000565b60008054600160a060020a0380851673ffffffffffffffffffffffffffffffffffffffff1992831681179093556001805474ff000000000000000000000000000000000000000019931684179290921660a060020a179091556040805192835233909116602083015280517fbce440d511e8db212b359581b9d6d0e89084bee0352d2944a84c9381051a62909281900390910190a15060015b919050565b60045460009033600160a060020a0390811691161461054d57610000565b6000821161055a57610000565b60008054604080516020908101849052815160e060020a6370a08231028152600160a060020a0330811660048301529251879593909416936370a0823193602480840194938390030190829087803b156100005760325a03f115610000575050506040518051905010156105cd57610000565b600080546040805160e060020a63a9059cbb028152600160a060020a038781166004830152602482018790529151919092169263a9059cbb926044808201939182900301818387803b156100005760325a03f11561000057505060408051600160a060020a0333811682528616602082015280820185905290517f38e8feed990acd7f5210170f614d354c7a0485670b9a787e9e00f8fca640d57492509081900360600190a15060015b5b92915050565b60045460009033600160a060020a0390811691161461069c57610000565b600082116106a957610000565b6106b282610ef5565b30600160a060020a03163110156106c857610000565b60045433600160a060020a039081169116141561052a5733600160a060020a03166108fc6106f584610ef5565b6040518115909202916000818181858888f19350505050151561071a5750600061052a565b60408051600160a060020a03331681526020810184905260608183018190526013908201527f7769746864726177616c3a207375636365737300000000000000000000000000608082015290517fecb269d89bfded20a4f5e6e51b509df1e3309a995946c9be8d6a8e2ddfa6b89c9181900360a00190a150600161052a565b5b5b919050565b6060604051908101604052806003905b60008152602001906001900390816107b057505060008281526006602052604090819020815160608101928390529160039082845b8154815260200190600101908083116107e5575b505050505090505b919050565b6008602052816000526040600020816004811015610000570160005b91509150505481565b60045460009033600160a060020a0390811691161415806108655750600160a060020a03331660009081526005602052604090205460ff16155b1561086f57610000565b600282905561087d82610ef5565b600390815560078054600101908190556040805160608101808352600254825243602080840191909152428385015260009485526006905291909220928301919083905b828111156108dc5782518255916020019190600101906108c1565b5b506108fd9291505b808211156108f957600081556001016108e5565b5090565b505060025460408051918252600160a060020a033316602083015280517f04f17b11492baf3914d7c73ac4b35dad51bfe2b134267f62fa1ec60104b32d969281900390910190a15060015b919050565b60006000600060025411151561096257610000565b600254831461097057610000565b8360035434811561000057041461098657610000565b60008054604080516020908101849052815160e060020a6370a08231028152600160a060020a033081166004830152925192909316936370a082319360248082019492918390030190829087803b156100005760325a03f115610000575050604080518051600080546020938401829052845160e060020a6370a08231028152600160a060020a03308116600483015295519397508a96509416936370a0823193602480830194919391928390030190829087803b156100005760325a03f11561000057505050604051805190501015610a5f57610000565b600080546040805160e060020a63a9059cbb028152600160a060020a033381166004830152602482018990529151919092169263a9059cbb926044808201939182900301818387803b156100005760325a03f11561000057505060008054604080516020908101849052815160e060020a6370a08231028152600160a060020a03308116600483015292519290931694506370a08231936024808501949293928390030190829087803b156100005760325a03f115610000575050604051518214159050610b2c57610000565b60098054600101908190556040805160808101808352868252602080830189905243838501524260608401526000948552600890529190922091600483019183905b82811115610b89578251825591602001919060010190610b6e565b5b50610baa9291505b808211156108f957600081556001016108e5565b5090565b505060408051600160a060020a03331681526020810185905280820186905290517faf04d0c0cb708af9660465a0ccddafd6f15c37babeed996437bfac5d43deae769181900360600190a1600191505b5b5092915050565b6000610c0e338361052f565b90505b919050565b6000610c2b30600160a060020a03163161067e565b90505b90565b60025481565b6004805460008054604080516020908101849052815160e060020a6370a08231028152600160a060020a033081169782019790975291519395610c2b958116949316926370a0823192602480820193929182900301818987803b156100005760325a03f11561000057505060405151905061052f565b90505b90565b600454600160a060020a031681565b60045460009033600160a060020a03908116911614610ce057610000565b6004805473ffffffffffffffffffffffffffffffffffffffff1916600160a060020a038481169182178355600091825260056020908152604092839020805460ff1916600117905592548251338316815291169281019290925280517fb532073b38c83145e3e5135377a08bf9aab55bc0fd7c1179cd4fb995d2a5159c9281900390910190a15060015b919050565b60045460009033600160a060020a03908116911614156100f657600160a060020a038216600081815260056020908152604091829020805460ff19169055815190810192909252808252600f828201527f6d616e616765722072656d6f76656400000000000000000000000000000000006060830152517fee64f2a4e302af62450656d8e6a03ed729fae6e36c43a116fd401b42d5783bcb9181900360800190a150600161052a565b610000565b5b919050565b60045460009033600160a060020a03908116911614156100f657600160a060020a038216600081815260056020908152604091829020805460ff19166001179055815190810192909252808252600d828201527f6d616e61676572206164646564000000000000000000000000000000000000006060830152517fee64f2a4e302af62450656d8e6a03ed729fae6e36c43a116fd401b42d5783bcb9181900360800190a150600161052a565b610000565b5b919050565b60075481565b60056020526000908152604090205460ff1681565b66038d7ea4c6800081025b9190505600a165627a7a72305820f51c895c4a44ca350bcf8a23ab2ff90c8cfea60d672123be7ed2c70cce40b2510029",
    "events": {
      "0xbce440d511e8db212b359581b9d6d0e89084bee0352d2944a84c9381051a6290": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "tokensContractAddress",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "setBy",
            "type": "address"
          }
        ],
        "name": "TokensContractAddressSet",
        "type": "event"
      },
      "0xee09d27cc57ad50ec0f8a69b47fed3feed38ac3215a611242b45c51ca2368a08": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "transactionInitiatedBy",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "message",
            "type": "string"
          }
        ],
        "name": "Result",
        "type": "event"
      },
      "0xb532073b38c83145e3e5135377a08bf9aab55bc0fd7c1179cd4fb995d2a5159c": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "oldOwner",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "newOwner",
            "type": "address"
          }
        ],
        "name": "OwnerChanged",
        "type": "event"
      },
      "0xee64f2a4e302af62450656d8e6a03ed729fae6e36c43a116fd401b42d5783bcb": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "change",
            "type": "string"
          },
          {
            "indexed": false,
            "name": "manager",
            "type": "address"
          }
        ],
        "name": "ManagersChanged",
        "type": "event"
      },
      "0x04f17b11492baf3914d7c73ac4b35dad51bfe2b134267f62fa1ec60104b32d96": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "newPriceToBuyInFinney",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "changedBy",
            "type": "address"
          }
        ],
        "name": "PriceChanged",
        "type": "event"
      },
      "0xaf04d0c0cb708af9660465a0ccddafd6f15c37babeed996437bfac5d43deae76": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "to",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "priceInFinney",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "quantity",
            "type": "uint256"
          }
        ],
        "name": "Deal",
        "type": "event"
      },
      "0x38e8feed990acd7f5210170f614d354c7a0485670b9a787e9e00f8fca640d574": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "from",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "to",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "quantity",
            "type": "uint256"
          }
        ],
        "name": "TokensTransfer",
        "type": "event"
      },
      "0xecb269d89bfded20a4f5e6e51b509df1e3309a995946c9be8d6a8e2ddfa6b89c": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "to",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "sumToWithdrawInFinney",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "message",
            "type": "string"
          }
        ],
        "name": "Withdrawal",
        "type": "event"
      }
    },
    "updated_at": 1494892548381
  }
};

  Contract.checkNetwork = function(callback) {
    var self = this;

    if (this.network_id != null) {
      return callback();
    }

    this.web3.version.network(function(err, result) {
      if (err) return callback(err);

      var network_id = result.toString();

      // If we have the main network,
      if (network_id == "1") {
        var possible_ids = ["1", "live", "default"];

        for (var i = 0; i < possible_ids.length; i++) {
          var id = possible_ids[i];
          if (Contract.all_networks[id] != null) {
            network_id = id;
            break;
          }
        }
      }

      if (self.all_networks[network_id] == null) {
        return callback(new Error(self.name + " error: Can't find artifacts for network id '" + network_id + "'"));
      }

      self.setNetwork(network_id);
      callback();
    })
  };

  Contract.setNetwork = function(network_id) {
    var network = this.all_networks[network_id] || {};

    this.abi             = this.prototype.abi             = network.abi;
    this.unlinked_binary = this.prototype.unlinked_binary = network.unlinked_binary;
    this.address         = this.prototype.address         = network.address;
    this.updated_at      = this.prototype.updated_at      = network.updated_at;
    this.links           = this.prototype.links           = network.links || {};
    this.events          = this.prototype.events          = network.events || {};

    this.network_id = network_id;
  };

  Contract.networks = function() {
    return Object.keys(this.all_networks);
  };

  Contract.link = function(name, address) {
    if (typeof name == "function") {
      var contract = name;

      if (contract.address == null) {
        throw new Error("Cannot link contract without an address.");
      }

      Contract.link(contract.contract_name, contract.address);

      // Merge events so this contract knows about library's events
      Object.keys(contract.events).forEach(function(topic) {
        Contract.events[topic] = contract.events[topic];
      });

      return;
    }

    if (typeof name == "object") {
      var obj = name;
      Object.keys(obj).forEach(function(name) {
        var a = obj[name];
        Contract.link(name, a);
      });
      return;
    }

    Contract.links[name] = address;
  };

  Contract.contract_name   = Contract.prototype.contract_name   = "ICO";
  Contract.generated_with  = Contract.prototype.generated_with  = "3.2.0";

  // Allow people to opt-in to breaking changes now.
  Contract.next_gen = false;

  var properties = {
    binary: function() {
      var binary = Contract.unlinked_binary;

      Object.keys(Contract.links).forEach(function(library_name) {
        var library_address = Contract.links[library_name];
        var regex = new RegExp("__" + library_name + "_*", "g");

        binary = binary.replace(regex, library_address.replace("0x", ""));
      });

      return binary;
    }
  };

  Object.keys(properties).forEach(function(key) {
    var getter = properties[key];

    var definition = {};
    definition.enumerable = true;
    definition.configurable = false;
    definition.get = getter;

    Object.defineProperty(Contract, key, definition);
    Object.defineProperty(Contract.prototype, key, definition);
  });

  bootstrap(Contract);

  if (typeof module != "undefined" && typeof module.exports != "undefined") {
    module.exports = Contract;
  } else {
    // There will only be one version of this contract in the browser,
    // and we can use that.
    window.ICO = Contract;
  }
})();
