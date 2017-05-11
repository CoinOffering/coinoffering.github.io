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
      throw new Error("Corporation error: Please call setProvider() first before calling new().");
    }

    var args = Array.prototype.slice.call(arguments);

    if (!this.unlinked_binary) {
      throw new Error("Corporation error: contract binary not set. Can't deploy new instance.");
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

      throw new Error("Corporation contains unresolved libraries. You must deploy and link the following libraries before you can deploy a new version of Corporation: " + unlinked_libraries);
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
      throw new Error("Invalid address passed to Corporation.at(): " + address);
    }

    var contract_class = this.web3.eth.contract(this.abi);
    var contract = contract_class.at(address);

    return new this(contract);
  };

  Contract.deployed = function() {
    if (!this.address) {
      throw new Error("Cannot find deployed address: Corporation not deployed or address not set.");
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
        "constant": false,
        "inputs": [
          {
            "name": "_proposalID",
            "type": "uint256"
          }
        ],
        "name": "voteForProposal",
        "outputs": [
          {
            "name": "",
            "type": "string"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [],
        "name": "getMyShareholderID",
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
        "name": "name",
        "outputs": [
          {
            "name": "",
            "type": "string"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_address",
            "type": "address"
          }
        ],
        "name": "getBalanceByAdress",
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
        "name": "totalSupply",
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
            "name": "_proposalID",
            "type": "uint256"
          }
        ],
        "name": "countVotes",
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
            "type": "uint256"
          }
        ],
        "name": "results",
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
            "name": "_from",
            "type": "address"
          },
          {
            "name": "_to",
            "type": "address"
          },
          {
            "name": "_value",
            "type": "uint256"
          }
        ],
        "name": "transferFrom",
        "outputs": [
          {
            "name": "success",
            "type": "bool"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [],
        "name": "getCurrentShareholders",
        "outputs": [
          {
            "name": "",
            "type": "address[]"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_proposalDescription",
            "type": "string"
          },
          {
            "name": "_debatingPeriodInMinutes",
            "type": "uint256"
          }
        ],
        "name": "makeNewProposal",
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
        "name": "decimals",
        "outputs": [
          {
            "name": "",
            "type": "uint8"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_id",
            "type": "uint256"
          }
        ],
        "name": "getShareholderAdressByID",
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
        "inputs": [],
        "name": "getMyProposals",
        "outputs": [
          {
            "name": "",
            "type": "uint256[]"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [],
        "name": "getMyShares",
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
        "name": "shareholderID",
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
        "name": "standard",
        "outputs": [
          {
            "name": "",
            "type": "string"
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
          }
        ],
        "name": "shareholder",
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
        "inputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "proposalText",
        "outputs": [
          {
            "name": "",
            "type": "string"
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
        "name": "balanceOf",
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
        "name": "symbol",
        "outputs": [
          {
            "name": "",
            "type": "string"
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
            "name": "_value",
            "type": "uint256"
          }
        ],
        "name": "transfer",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "deadline",
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
            "type": "uint256"
          },
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "votes",
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
            "name": "_spender",
            "type": "address"
          },
          {
            "name": "_value",
            "type": "uint256"
          },
          {
            "name": "_extraData",
            "type": "bytes"
          }
        ],
        "name": "approveAndCall",
        "outputs": [
          {
            "name": "success",
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
            "name": "",
            "type": "address"
          },
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "proposalsByShareholder",
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
          },
          {
            "name": "",
            "type": "address"
          }
        ],
        "name": "allowance",
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
        "inputs": [],
        "payable": false,
        "type": "constructor"
      },
      {
        "payable": false,
        "type": "fallback"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "name": "from",
            "type": "address"
          },
          {
            "indexed": true,
            "name": "to",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "value",
            "type": "uint256"
          }
        ],
        "name": "Transfer",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "proposalID",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "initiator",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "description",
            "type": "string"
          },
          {
            "indexed": false,
            "name": "deadline",
            "type": "uint256"
          }
        ],
        "name": "ProposalAdded",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "proposalID",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "votes",
            "type": "uint256"
          }
        ],
        "name": "VotingFinished",
        "type": "event"
      }
    ],
    "unlinked_binary": "0x60a0604052600960608190527f546f6b656e20302e3100000000000000000000000000000000000000000000006080908152600080548180527f546f6b656e20302e310000000000000000000000000000000000000000000012825590927f290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563602060026001851615610100026000190190941693909304601f0192909204820192909190620000d9565b82800160010185558215620000d9579182015b82811115620000d9578251825591602001919060010190620000bc565b5b50620000fd9291505b80821115620000f95760008155600101620000e3565b5090565b50503462000000575b33600160a060020a03166000908152600860209081526040808320612ee0908190556004819055815180830190925260068083527f736861726573000000000000000000000000000000000000000000000000000092840192835260018054958190528351600c60ff19909116178155919491937fb10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf6600284871615610100026000190190941693909304601f0104820192909190620001f0565b82800160010185558215620001f0579182015b82811115620001f0578251825591602001919060010190620001d3565b5b50620002149291505b80821115620000f95760008155600101620000e3565b5090565b50506040805180820190915260028082527f73680000000000000000000000000000000000000000000000000000000000006020928301908152815460008390528151600460ff1990911617835591927f405787fa12a823e0f2b7631cc41b3ba8828b3321ca811111fa75cd3aa3bb5ace60018416156101000260001901909316849004601f01048201918391620002d7565b82800160010185558215620002d7579182015b82811115620002d7578251825591602001919060010190620002ba565b5b50620002fb9291505b80821115620000f95760008155600101620000e3565b5090565b50506003805460ff191690556005805460018181018084559092919082818380158290116200035257600083815260209020620003529181019083015b80821115620000f95760008155600101620000e3565b5090565b5b505050916000526020600020900160005b8154600160a060020a033081166101009390930a8381029102199091161790915560009081526006602052604090209190039055600580546001818101808455909291908281838015829011620003e357600083815260209020620003e39181019083015b80821115620000f95760008155600101620000e3565b5090565b5b505050916000526020600020900160005b8154600160a060020a033381166101009390930a8381029102199091161790915560009081526006602052604090209190039055600780546001810180835582818380158290116200046f576000838152602090206200046f9181019083015b80821115620000f95760008155600101620000e3565b5090565b5b505050916000526020600020900160005b8154600160a060020a033381166101009390930a92830292021916179055505b505b61198980620004b36000396000f300606060405236156101385763ffffffff60e060020a600035041663045c6ce0811461014a5780630645b5d5146101da57806306fdde03146101f95780631177892f1461028657806318160ddd146102b15780631840f0ca146102d05780631b0c27da146102f257806323b872dd146103145780632bf4e53d1461034a5780632f1e4968146103b2578063313ce56714610419578063347632e81461043c57806336ffa905146104685780633e83fe36146104d057806346cdb099146104ef5780635a3b7e421461051a5780636d8737e1146105a75780636d91acba146105d357806370a082311461066357806395d89b411461068e578063a9059cbb1461071b578063c40dc8ec14610739578063c6e36a321461075b578063cae9ca511461078a578063d59f1f3f146107fe578063dd62ed3e1461082c575b34610000576101485b610000565b565b005b346100005761015a60043561085d565b6040805160208082528351818301528351919283929083019185019080838382156101a0575b8051825260208311156101a057601f199092019160209182019101610180565b505050905090810190601f1680156101cc5780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b34610000576101e7610a5c565b60408051918252519081900360200190f35b346100005761015a610a79565b6040805160208082528351818301528351919283929083019185019080838382156101a0575b8051825260208311156101a057601f199092019160209182019101610180565b505050905090810190601f1680156101cc5780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b34610000576101e7600160a060020a0360043516610b06565b60408051918252519081900360200190f35b34610000576101e7610b25565b60408051918252519081900360200190f35b34610000576101e7600435610b2b565b60408051918252519081900360200190f35b34610000576101e7600435610c3a565b60408051918252519081900360200190f35b3461000057610336600160a060020a0360043581169060243516604435610c4c565b604080519115158252519081900360200190f35b3461000057610357610e0a565b604080516020808252835181830152835191928392908301918581019102808383821561039f575b80518252602083111561039f57601f19909201916020918201910161037f565b5050509050019250505060405180910390f35b34610000576101e7600480803590602001908201803590602001908080601f016020809104026020016040519081016040528093929190818152602001838380828437509496505093359350610fd192505050565b60408051918252519081900360200190f35b346100005761042661134e565b6040805160ff9092168252519081900360200190f35b346100005761044c600435611357565b60408051600160a060020a039092168252519081900360200190f35b346100005761035761138d565b604080516020808252835181830152835191928392908301918581019102808383821561039f575b80518252602083111561039f57601f19909201916020918201910161037f565b5050509050019250505060405180910390f35b34610000576101e7611400565b60408051918252519081900360200190f35b34610000576101e7600160a060020a036004351661141d565b60408051918252519081900360200190f35b346100005761015a61142f565b6040805160208082528351818301528351919283929083019185019080838382156101a0575b8051825260208311156101a057601f199092019160209182019101610180565b505050905090810190601f1680156101cc5780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b346100005761044c6004356114bd565b60408051600160a060020a039092168252519081900360200190f35b346100005761015a6004356114ed565b6040805160208082528351818301528351919283929083019185019080838382156101a0575b8051825260208311156101a057601f199092019160209182019101610180565b505050905090810190601f1680156101cc5780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b34610000576101e7600160a060020a0360043516611595565b60408051918252519081900360200190f35b346100005761015a6115a7565b6040805160208082528351818301528351919283929083019185019080838382156101a0575b8051825260208311156101a057601f199092019160209182019101610180565b505050905090810190601f1680156101cc5780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b3461000057610148600160a060020a0360043516602435611632565b005b34610000576101e760043561179d565b60408051918252519081900360200190f35b346100005761044c6004356024356117af565b60408051600160a060020a039092168252519081900360200190f35b3461000057604080516020600460443581810135601f8101849004840285018401909552848452610336948235600160a060020a03169460248035956064949293919092019181908401838280828437509496506117ee95505050505050565b604080519115158252519081900360200190f35b34610000576101e7600160a060020a0360043516602435611911565b60408051918252519081900360200190f35b34610000576101e7600160a060020a0360043581169060243516611940565b60408051918252519081900360200190f35b60408051602081810183526000808352600160a060020a03331681526008909152919091205460019010156108c6575060408051808201909152601c81527f6e6f207368617265732c20766f7465206e6f74206163636570746564000000006020820152610a57565b6000828152600b60209081526040808320600160a060020a033316845290915290205460ff161561092b57506040805180820190915260208082527f616c726561647920766f7465642c20766f7465206e6f7420616363657074656490820152610a57565b6000828152600d602052604090205442111561097b57506040805180820190915260208082527f766f7465206e6f7420616363657074656420616674657220646561646c696e6590820152610a57565b6000828152600c6020526040902080546001810180835582818380158290116109c9576000838152602090206109c99181019083015b808211156109c557600081556001016109b1565b5090565b5b505050916000526020600020900160005b8154600160a060020a033381166101009390930a838102910219909116179091556000848152600b6020908152604080832093835292815290829020805460ff191660011790558151808301909252600d82527f766f746520616363657074656400000000000000000000000000000000000000908201529150505b919050565b600160a060020a0333166000908152600660205260409020545b90565b60018054604080516020600284861615610100026000190190941693909304601f81018490048402820184019092528181529291830182828015610afe5780601f10610ad357610100808354040283529160200191610afe565b820191906000526020600020905b815481529060010190602001808311610ae157829003601f168201915b505050505081565b600160a060020a0381166000908152600860205260409020545b919050565b60045481565b6000818152600d6020526040812054819081908190421015610b4c57610000565b6000858152600e60205260408120541115610b77576000858152600e60205260409020549350610c32565b60009250600091505b6000858152600c6020526040902054821015610bf3576000858152600c602052604090208054839081101561000057906000526020600020900160005b9054600160a060020a036101009290920a900416600081815260086020526040902054939093019290505b600190910190610b80565b604080518681526020810185905281517fdddac1677fda47cbbbc403aec4ecd004a9a4f777b6c876510cdd9462e914fea0929181900390910190a18293505b505050919050565b600e6020526000908152604090205481565b60006001821015610c5c57610000565b82600160a060020a031630600160a060020a03161415610c7b57610000565b600160a060020a03841660009081526008602052604090205482901015610ca157610000565b600160a060020a0380851660009081526009602090815260408083203390941683529290522054821115610cd457610000565b600160a060020a0383166000908152600660205260409020541515610d7e57600160058054806001018281815481835581811511610d3757600083815260209020610d379181019083015b808211156109c557600081556001016109b1565b5090565b5b505050916000526020600020900160005b8154600160a060020a038089166101009390930a83810291021990911617909155600090815260066020526040902091900390555b600160a060020a03808516600081815260086020908152604080832080548890039055878516808452818420805489019055848452600983528184203390961684529482529182902080548790039055815186815291517fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef9281900390910190a35060015b9392505050565b6040805160208101909152600080825260078054828255908252610e66907fa66cc928b5edb82af9bd49922954155ab7b0942694bea4ce44661d9a8736c688908101905b808211156109c557600081556001016109b1565b5090565b5b50600090505b600554811015610f6f57600060086000600584815481101561000057906000526020600020900160005b9054906101000a9004600160a060020a0316600160a060020a0316600160a060020a03168152602001908152602001600020541115610f665760078054806001018281815481835581811511610f1257600083815260209020610f129181019083015b808211156109c557600081556001016109b1565b5090565b5b505050916000526020600020900160005b600584815481101561000057906000526020600020900160005b9054835461010093840a600160a060020a039390940a90910482168302929091021916179055505b5b600101610e6d565b6007805480602002602001604051908101604052809291908181526020018280548015610fc557602002820191906000526020600020905b8154600160a060020a03168152600190910190602001808311610fa7575b505050505091505b5090565b600160a060020a03331660009081526008602052604081205481906001901015610ffa57610000565b6001600a8054806001018281815481835581811511611097576000838152602090206110979181019083015b808211156109c557600081805460018160011615610100020316600290046000825580601f106110565750611088565b601f01602090049060005260206000209081019061108891905b808211156109c557600081556001016109b1565b5090565b5b5050600101611026565b5090565b5b505050916000526020600020900160005b8790919091509080519060200190828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f106110f857805160ff1916838001178555611125565b82800160010185558215611125579182015b8281111561112557825182559160200191906001019061110a565b5b506111469291505b808211156109c557600081556001016109b1565b5090565b5050036000818152600d6020908152604080832042603c8902019055600160a060020a0333168352600f9091529020805460018101808355929350909182818380158290116111ba576000838152602090206111ba9181019083015b808211156109c557600081556001016109b1565b5090565b5b505050916000526020600020900160005b50829055506000818152600c60205260409020805460018101808355828183801582901161121f5760008381526020902061121f9181019083015b808211156109c557600081556001016109b1565b5090565b5b505050916000526020600020900160005b8154600160a060020a03338181166101009490940a848102920219909216179092556000848152600b602090815260408083208484528252808320805460ff19166001179055868352600d825291829020548251878152808301949094526060840181905260809284018381528a519385019390935289517ebcb88305055ab94f1e3797d1448f38f5265bce9887da93d7acd1b0eb445e1796508795948b94929390929160a08401918601908083838215611307575b80518252602083111561130757601f1990920191602091820191016112e7565b505050905090810190601f1680156113335780820380516001836020036101000a031916815260200191505b509550505050505060405180910390a18091505b5092915050565b60035460ff1681565b6000600582815481101561000057906000526020600020900160005b9054906101000a9004600160a060020a031690505b919050565b60408051602081810183526000808352600160a060020a0333168152600f8252839020805484518184028101840190955280855292939290918301828280156113f557602002820191906000526020600020905b8154815260200190600101908083116113e1575b505050505090505b90565b600160a060020a0333166000908152600860205260409020545b90565b60066020526000908152604090205481565b6000805460408051602060026001851615610100026000190190941693909304601f81018490048402820184019092528181529291830182828015610afe5780601f10610ad357610100808354040283529160200191610afe565b820191906000526020600020905b815481529060010190602001808311610ae157829003601f168201915b505050505081565b600581815481101561000057906000526020600020900160005b915054906101000a9004600160a060020a031681565b600a81815481101561000057906000526020600020900160005b508054604080516020601f600260001961010060018816150201909516949094049384018190048102820181019092528281529350830182828015610afe5780601f10610ad357610100808354040283529160200191610afe565b820191906000526020600020905b815481529060010190602001808311610ae157829003601f168201915b505050505081565b60086020526000908152604090205481565b6002805460408051602060018416156101000260001901909316849004601f81018490048402820184019092528181529291830182828015610afe5780601f10610ad357610100808354040283529160200191610afe565b820191906000526020600020905b815481529060010190602001808311610ae157829003601f168201915b505050505081565b600181101561164057610000565b81600160a060020a031630600160a060020a0316141561165f57610000565b600160a060020a0333166000908152600860205260409020548190101561168557610000565b600160a060020a033381166000908152600860209081526040808320805486900390559285168252828220805485019055600690522054151561174d57600160058054806001018281815481835581811511611706576000838152602090206117069181019083015b808211156109c557600081556001016109b1565b5090565b5b505050916000526020600020900160005b8154600160a060020a038088166101009390930a83810291021990911617909155600090815260066020526040902091900390555b81600160a060020a031633600160a060020a03167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef836040518082815260200191505060405180910390a35b5050565b600d6020526000908152604090205481565b600c60205281600052604060002081815481101561000057906000526020600020900160005b915091509054906101000a9004600160a060020a031681565b33600160a060020a03818116600081815260096020908152604080832089861680855290835281842089905590517f8f4ffcb1000000000000000000000000000000000000000000000000000000008152600481019485526024810189905230958616604482015260806064820190815288516084830152885194978b979396638f4ffcb19691958c95948c94929360a49091019185019080838382156118b0575b8051825260208311156118b057601f199092019160209182019101611890565b505050905090810190601f1680156118dc5780820380516001836020036101000a031916815260200191505b5095505050505050600060405180830381600087803b156100005760325a03f11561000057505050600191505b509392505050565b600f60205281600052604060002081815481101561000057906000526020600020900160005b91509150505481565b6009602090815260009283526040808420909152908252902054815600a165627a7a723058206b5e98280266be24eaefa79d0d706ac80bea5923b7427b8ea7d179a16b39dea40029",
    "events": {
      "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "name": "from",
            "type": "address"
          },
          {
            "indexed": true,
            "name": "to",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "value",
            "type": "uint256"
          }
        ],
        "name": "Transfer",
        "type": "event"
      },
      "0x00bcb88305055ab94f1e3797d1448f38f5265bce9887da93d7acd1b0eb445e17": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "proposalID",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "initiator",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "description",
            "type": "string"
          },
          {
            "indexed": false,
            "name": "deadline",
            "type": "uint256"
          }
        ],
        "name": "ProposalAdded",
        "type": "event"
      },
      "0xdddac1677fda47cbbbc403aec4ecd004a9a4f777b6c876510cdd9462e914fea0": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "proposalID",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "votes",
            "type": "uint256"
          }
        ],
        "name": "VotingFinished",
        "type": "event"
      }
    },
    "updated_at": 1494536915317
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

  Contract.contract_name   = Contract.prototype.contract_name   = "Corporation";
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
    window.Corporation = Contract;
  }
})();
